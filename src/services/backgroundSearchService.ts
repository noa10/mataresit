import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/search';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { unifiedSearch } from '@/lib/ai-search';
import { searchCache } from '@/lib/searchCache';

/**
 * Background Search Service
 * 
 * This service handles search operations that can run independently of the UI state,
 * allowing users to navigate freely while searches are processing in the background.
 */
export class BackgroundSearchService {
  private static instance: BackgroundSearchService;
  private activeSearches = new Map<string, AbortController>();
  private searchPromises = new Map<string, Promise<UnifiedSearchResponse>>();

  private constructor() {}

  static getInstance(): BackgroundSearchService {
    if (!BackgroundSearchService.instance) {
      BackgroundSearchService.instance = new BackgroundSearchService();
    }
    return BackgroundSearchService.instance;
  }

  /**
   * Start a background search that can be cancelled and doesn't block navigation
   */
  async startSearch(
    conversationId: string,
    query: string,
    searchParams: UnifiedSearchParams,
    userId: string,
    onProgress?: (status: string, progress: string) => void
  ): Promise<UnifiedSearchResponse> {
    // Cancel any existing search for this conversation
    this.cancelSearch(conversationId);

    // Create abort controller for this search
    const abortController = new AbortController();
    this.activeSearches.set(conversationId, abortController);

    // Create the search promise
    const searchPromise = this.executeSearch(
      conversationId,
      query,
      searchParams,
      userId,
      abortController.signal,
      onProgress
    );

    this.searchPromises.set(conversationId, searchPromise);

    try {
      const result = await searchPromise;
      
      // Clean up
      this.activeSearches.delete(conversationId);
      this.searchPromises.delete(conversationId);
      
      return result;
    } catch (error) {
      // Clean up on error
      this.activeSearches.delete(conversationId);
      this.searchPromises.delete(conversationId);
      
      throw error;
    }
  }

  /**
   * Cancel an active search
   */
  cancelSearch(conversationId: string): void {
    const abortController = this.activeSearches.get(conversationId);
    if (abortController) {
      abortController.abort();
      this.activeSearches.delete(conversationId);
      this.searchPromises.delete(conversationId);
      console.log(`🚫 Cancelled search for conversation ${conversationId}`);
    }
  }

  /**
   * Check if a search is currently active
   */
  isSearchActive(conversationId: string): boolean {
    return this.activeSearches.has(conversationId);
  }

  /**
   * Get the promise for an active search (useful for awaiting results)
   */
  getSearchPromise(conversationId: string): Promise<UnifiedSearchResponse> | null {
    return this.searchPromises.get(conversationId) || null;
  }

  /**
   * Check if cached results exist for a search
   */
  async hasCachedResults(searchParams: UnifiedSearchParams, userId: string): Promise<boolean> {
    try {
      const cached = await searchCache.get(searchParams, userId);
      return cached !== null;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Get cached results for a search
   */
  async getCachedResults(searchParams: UnifiedSearchParams, userId: string): Promise<UnifiedSearchResponse | null> {
    try {
      return await searchCache.get(searchParams, userId);
    } catch (error) {
      console.error('Error getting cached results:', error);
      return null;
    }
  }

  /**
   * Execute the actual search with progress tracking
   */
  private async executeSearch(
    conversationId: string,
    query: string,
    searchParams: UnifiedSearchParams,
    userId: string,
    abortSignal: AbortSignal,
    onProgress?: (status: string, progress: string) => void
  ): Promise<UnifiedSearchResponse> {
    console.log(`🔍 Starting background search for conversation ${conversationId}: "${query}"`);

    // Check if search was cancelled before starting
    if (abortSignal.aborted) {
      throw new Error('Search was cancelled');
    }

    // Update progress
    onProgress?.('preprocessing', 'Understanding your question...');

    // Check cache first
    const cachedResult = await searchCache.get(searchParams, userId);
    if (cachedResult) {
      console.log(`💾 Found cached results for conversation ${conversationId}`);
      onProgress?.('cached', 'Loading cached results...');
      return cachedResult;
    }

    // Check if search was cancelled after cache check
    if (abortSignal.aborted) {
      throw new Error('Search was cancelled');
    }

    // Update progress
    onProgress?.('searching', 'Searching through your data...');

    try {
      // Perform the actual search
      const result = await unifiedSearch(searchParams);

      // Check if search was cancelled after completion
      if (abortSignal.aborted) {
        throw new Error('Search was cancelled');
      }

      if (result.success) {
        // Cache the successful result
        await searchCache.set(searchParams, userId, result);
        
        onProgress?.('complete', 'Search completed successfully');
        console.log(`✅ Background search completed for conversation ${conversationId}`);
        
        return result;
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      if (abortSignal.aborted) {
        throw new Error('Search was cancelled');
      }
      
      console.error(`❌ Background search failed for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Generate search parameters from a chat message
   */
  generateSearchParams(query: string, conversationHistory?: ChatMessage[]): UnifiedSearchParams {
    return {
      query: query.trim(),
      // 🔧 FIX: Use singular source names that match backend validation
      sources: ['receipt', 'business_directory'],
      limit: 20,
      offset: 0,
      filters: {
        dateRange: undefined,
        amountRange: undefined,
        categories: [],
        merchants: [],
        teamId: undefined,
        language: 'en'
      },
      similarityThreshold: 0.2,
      includeMetadata: true,
      aggregationMode: 'relevance',
      // Enhanced parameters for better search
      useEnhancedPrompting: true,
      conversationHistory: conversationHistory?.slice(-5).map(m => m.content) || []
    };
  }

  /**
   * Extract search intent from a message to determine if it needs fresh search or can use cache
   */
  shouldUseFreshSearch(query: string, conversationHistory?: ChatMessage[]): boolean {
    const freshSearchIndicators = [
      'latest', 'recent', 'new', 'updated', 'current',
      'today', 'yesterday', 'this week', 'this month',
      'refresh', 'reload', 'update'
    ];

    const queryLower = query.toLowerCase();
    return freshSearchIndicators.some(indicator => queryLower.includes(indicator));
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Cancel all active searches
    for (const [conversationId] of this.activeSearches) {
      this.cancelSearch(conversationId);
    }
    
    console.log('🧹 Background search service cleaned up');
  }
}

// Export singleton instance
export const backgroundSearchService = BackgroundSearchService.getInstance();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    backgroundSearchService.cleanup();
  });
}
