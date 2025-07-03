import { searchCache } from '@/lib/searchCache';
import { 
  invalidateConversationSearchCache, 
  updateConversationSearchStatus,
  getAllConversations 
} from '@/lib/conversation-history';

/**
 * Search Cache Manager
 * 
 * Handles cache invalidation strategies and cache management across
 * the application to ensure users always see fresh data when needed.
 */
export class SearchCacheManager {
  private static instance: SearchCacheManager;

  private constructor() {}

  static getInstance(): SearchCacheManager {
    if (!SearchCacheManager.instance) {
      SearchCacheManager.instance = new SearchCacheManager();
    }
    return SearchCacheManager.instance;
  }

  /**
   * Invalidate cache when new receipts are uploaded
   */
  invalidateOnReceiptUpload(userId: string): void {
    console.log('🗑️ Invalidating search cache due to new receipt upload');
    
    // Clear all search cache for this user
    searchCache.invalidateByPattern(userId);
    
    // Update all conversation statuses to indicate cache is invalid
    const conversations = getAllConversations();
    conversations.forEach(conv => {
      if (conv.hasSearchResults) {
        invalidateConversationSearchCache(conv.id);
      }
    });
  }

  /**
   * Invalidate cache when receipts are deleted
   */
  invalidateOnReceiptDeletion(receiptIds: string[], userId: string): void {
    console.log(`🗑️ Invalidating search cache due to receipt deletion: ${receiptIds.length} receipts`);
    
    // For receipt deletions, we need to invalidate all caches since
    // we don't know which searches might have included these receipts
    searchCache.invalidateByPattern(userId);
    
    // Update conversation statuses
    const conversations = getAllConversations();
    conversations.forEach(conv => {
      if (conv.hasSearchResults) {
        invalidateConversationSearchCache(conv.id);
      }
    });
  }

  /**
   * Invalidate cache when receipt data is modified
   */
  invalidateOnReceiptModification(receiptIds: string[], userId: string): void {
    console.log(`🗑️ Invalidating search cache due to receipt modification: ${receiptIds.length} receipts`);
    
    // Similar to deletion, modifications require full cache invalidation
    searchCache.invalidateByPattern(userId);
    
    // Update conversation statuses
    const conversations = getAllConversations();
    conversations.forEach(conv => {
      if (conv.hasSearchResults) {
        invalidateConversationSearchCache(conv.id);
      }
    });
  }

  /**
   * Invalidate cache for temporal queries (time-sensitive searches)
   */
  invalidateTemporalQueries(userId: string): void {
    console.log('🕐 Invalidating temporal search queries');
    
    // Temporal queries should always get fresh data
    const temporalPatterns = [
      'today', 'yesterday', 'this week', 'this month', 'recent',
      'latest', 'last', 'current', 'now'
    ];
    
    temporalPatterns.forEach(pattern => {
      searchCache.invalidateByPattern(pattern);
    });
  }

  /**
   * Scheduled cache cleanup (run periodically)
   */
  performScheduledCleanup(): void {
    console.log('🧹 Performing scheduled cache cleanup');
    
    // Clean up expired cache entries
    const conversations = getAllConversations();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    conversations.forEach(conv => {
      if (conv.searchResultsCache) {
        const isExpired = now - conv.searchResultsCache.cachedAt > maxAge;
        if (isExpired) {
          invalidateConversationSearchCache(conv.id);
        }
      }
    });
    
    // Clean up localStorage cache entries
    this.cleanupLocalStorageCache();
  }

  /**
   * Clean up old localStorage cache entries
   */
  private cleanupLocalStorageCache(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      keys.forEach(key => {
        if (key.startsWith('search_cache_') || key.startsWith('conv_cache_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const entry = JSON.parse(data);
              if (entry.timestamp || entry.cachedAt) {
                const entryAge = now - (entry.timestamp || entry.cachedAt);
                if (entryAge > maxAge) {
                  localStorage.removeItem(key);
                }
              }
            }
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup localStorage cache:', error);
    }
  }

  /**
   * Force refresh cache for a specific conversation
   */
  forceRefreshConversation(conversationId: string): void {
    console.log(`🔄 Force refreshing cache for conversation ${conversationId}`);
    
    // Clear conversation-specific cache
    searchCache.clearConversationCache(conversationId);
    invalidateConversationSearchCache(conversationId);
    updateConversationSearchStatus(conversationId, 'idle');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryUsage: number;
    entryCount: number;
    conversationsWithCache: number;
    totalConversations: number;
  } {
    const cacheMetrics = searchCache.getMetrics();
    const conversations = getAllConversations();
    const conversationsWithCache = conversations.filter(conv => conv.hasSearchResults).length;
    
    return {
      memoryUsage: cacheMetrics.memoryUsage,
      entryCount: cacheMetrics.entryCount,
      conversationsWithCache,
      totalConversations: conversations.length
    };
  }

  /**
   * Initialize cache manager with periodic cleanup
   */
  initialize(): void {
    console.log('🚀 Initializing Search Cache Manager');
    
    // Set up periodic cleanup (every hour)
    setInterval(() => {
      this.performScheduledCleanup();
    }, 60 * 60 * 1000);
    
    // Set up temporal query invalidation (every 5 minutes)
    setInterval(() => {
      // Only invalidate temporal queries during active hours
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 23) { // 6 AM to 11 PM
        this.invalidateTemporalQueries('*'); // Wildcard for all users
      }
    }, 5 * 60 * 1000);
    
    // Initial cleanup
    this.performScheduledCleanup();
  }
}

// Export singleton instance
export const searchCacheManager = SearchCacheManager.getInstance();

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
  searchCacheManager.initialize();
}
