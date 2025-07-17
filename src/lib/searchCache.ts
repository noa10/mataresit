/**
 * Advanced Search Result Caching System
 * Implements multi-level caching with intelligent cache management
 */

import { UnifiedSearchParams, UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';

// Cache configuration
interface CacheConfig {
  memoryTTL: number;        // Memory cache TTL in milliseconds
  persistentTTL: number;    // Persistent cache TTL in milliseconds
  maxMemoryEntries: number; // Maximum entries in memory cache
  maxMemorySize: number;    // Maximum memory usage in MB
  compressionThreshold: number; // Compress results larger than this (bytes)
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Size in bytes
  compressed: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  compressions: number;
  totalRequests: number;
  averageResponseTime: number;
  cacheEfficiency: number;
}

interface SearchCacheKey {
  query: string;
  sources: string[];
  filters: string;
  userId: string;
  language?: string;
  similarityThreshold: number;
  limit: number;
  offset: number;
  temporalTimestamp?: number; // Added for temporal queries to ensure fresh results
}

class SearchCache {
  private memoryCache = new Map<string, CacheEntry<UnifiedSearchResponse>>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    cacheEfficiency: 0
  };

  private config: CacheConfig = {
    memoryTTL: 3 * 60 * 1000,      // 🚀 PERFORMANCE: Reduced to 3 minutes for faster cache turnover
    persistentTTL: 15 * 60 * 1000,  // 🚀 PERFORMANCE: Reduced to 15 minutes to prevent stale results
    maxMemoryEntries: 150,          // 🚀 PERFORMANCE: Increased for better hit rate
    maxMemorySize: 75, // 🚀 PERFORMANCE: Increased memory limit to 75MB
    compressionThreshold: 5120 // 🚀 PERFORMANCE: Reduced threshold for better compression (5KB)
  };

  private currentMemoryUsage = 0;

  /**
   * Check if a query is temporal (contains date/time references)
   */
  private isTemporalQuery(query: string): boolean {
    const temporalPatterns = [
      /\b(from|since|after|before|during|in|on)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      /\b(yesterday|today|tomorrow|last\s+week|this\s+week|next\s+week|last\s+month|this\s+month|next\s+month)\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, // Date formats like 12/25/2024
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/, // Date formats like 12-25-2024
      /\b(from|since|after|before)\s+\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i
    ];

    return temporalPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Generate a cache key from search parameters
   */
  private generateCacheKey(params: UnifiedSearchParams, userId: string): string {
    const keyData: SearchCacheKey = {
      query: params.query.toLowerCase().trim(),
      sources: (params.sources || []).sort(),
      filters: JSON.stringify(params.filters || {}),
      userId,
      language: params.filters?.language,
      similarityThreshold: params.similarityThreshold || 0.2,
      limit: params.limit || 20,
      offset: params.offset || 0
    };

    // For temporal queries, add a timestamp to make cache key unique
    // This ensures temporal queries always hit the Edge Function for fresh results
    if (this.isTemporalQuery(params.query)) {
      keyData.temporalTimestamp = Date.now();
      console.log('🕐 Temporal query detected, adding timestamp to cache key for fresh results');
    }

    // Create a hash-like key for consistent caching
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
  }

  /**
   * Calculate the size of data in bytes
   */
  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entries to free memory
   */
  private evictLRU(targetSize: number): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    let freedSize = 0;
    for (const [key, entry] of entries) {
      if (freedSize >= targetSize) break;
      
      this.memoryCache.delete(key);
      this.currentMemoryUsage -= entry.size;
      freedSize += entry.size;
      this.metrics.evictions++;
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(responseTime: number): void {
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    this.metrics.cacheEfficiency = 
      this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100;
  }

  /**
   * Get search results from cache
   */
  async get(params: UnifiedSearchParams, userId: string): Promise<UnifiedSearchResponse | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    // Check if this is a temporal query
    const isTemporalQuery = this.isTemporalQuery(params.query);
    if (isTemporalQuery) {
      console.log('🕐 Temporal query detected, cache will be bypassed for fresh results');
    }

    try {
      const cacheKey = this.generateCacheKey(params, userId);
      
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(cacheKey);
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        // Update access statistics
        memoryEntry.accessCount++;
        memoryEntry.lastAccessed = Date.now();
        
        this.metrics.hits++;
        this.updateMetrics(performance.now() - startTime);
        
        console.log(`🎯 Cache hit for query: "${params.query}" (${memoryEntry.accessCount} accesses)`);
        return memoryEntry.data;
      }

      // Remove expired entry
      if (memoryEntry && this.isExpired(memoryEntry)) {
        this.memoryCache.delete(cacheKey);
        this.currentMemoryUsage -= memoryEntry.size;
      }

      // Check persistent cache (localStorage)
      try {
        const persistentKey = `search_cache_${cacheKey}`;
        const persistentData = localStorage.getItem(persistentKey);
        
        if (persistentData) {
          const persistentEntry: CacheEntry<UnifiedSearchResponse> = JSON.parse(persistentData);
          
          if (!this.isExpired(persistentEntry)) {
            // Move back to memory cache
            await this.set(params, userId, persistentEntry.data);
            
            this.metrics.hits++;
            this.updateMetrics(performance.now() - startTime);
            
            console.log(`💾 Persistent cache hit for query: "${params.query}"`);
            return persistentEntry.data;
          } else {
            // Remove expired persistent entry
            localStorage.removeItem(persistentKey);
          }
        }
      } catch (error) {
        console.warn('Persistent cache access failed:', error);
      }

      this.metrics.misses++;
      this.updateMetrics(performance.now() - startTime);
      
      console.log(`❌ Cache miss for query: "${params.query}"`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Store search results in cache
   */
  async set(params: UnifiedSearchParams, userId: string, response: UnifiedSearchResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(params, userId);
      const size = this.calculateSize(response);
      const shouldCompress = size > this.config.compressionThreshold;

      // Check if we need to free memory
      const sizeInMB = size / (1024 * 1024);
      if (this.currentMemoryUsage + sizeInMB > this.config.maxMemorySize) {
        this.evictLRU(sizeInMB);
      }

      // Check if we exceed max entries
      if (this.memoryCache.size >= this.config.maxMemoryEntries) {
        this.evictLRU(0); // Evict at least one entry
      }

      const entry: CacheEntry<UnifiedSearchResponse> = {
        data: response,
        timestamp: Date.now(),
        ttl: this.config.memoryTTL,
        accessCount: 1,
        lastAccessed: Date.now(),
        size: sizeInMB,
        compressed: shouldCompress
      };

      // Store in memory cache
      this.memoryCache.set(cacheKey, entry);
      this.currentMemoryUsage += sizeInMB;

      // Store in persistent cache for longer TTL
      try {
        const persistentEntry: CacheEntry<UnifiedSearchResponse> = {
          ...entry,
          ttl: this.config.persistentTTL
        };

        const persistentKey = `search_cache_${cacheKey}`;
        localStorage.setItem(persistentKey, JSON.stringify(persistentEntry));
      } catch (error) {
        console.warn('Failed to store in persistent cache:', error);

        // If quota exceeded, try to clear some old cache entries
        if (error.name === 'QuotaExceededError') {
          console.log('🗑️ Storage quota exceeded, clearing old cache entries...');
          this.clearOldCacheEntries();

          // Try storing again after cleanup
          try {
            const persistentKey = `search_cache_${cacheKey}`;
            localStorage.setItem(persistentKey, JSON.stringify(persistentEntry));
            console.log('✅ Successfully stored after cache cleanup');
          } catch (retryError) {
            console.error('❌ Still failed to store after cleanup:', retryError);
          }
        }
      }

      if (shouldCompress) {
        this.metrics.compressions++;
      }

      console.log(`✅ Cached search results for query: "${params.query}" (${size} bytes, compressed: ${shouldCompress})`);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      // Clear all cache
      this.memoryCache.clear();
      this.currentMemoryUsage = 0;

      // Clear persistent cache
      const keys = Object.keys(localStorage).filter(key => key.startsWith('search_cache_'));
      keys.forEach(key => localStorage.removeItem(key));

      console.log('🗑️ Cleared all search cache');
      return;
    }

    // Pattern-based invalidation
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
        this.currentMemoryUsage -= entry.size;
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clear matching persistent cache entries
    const persistentKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('search_cache_') && key.includes(pattern));
    persistentKeys.forEach(key => localStorage.removeItem(key));

    console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Force clear all cache for a specific query (case-insensitive)
   */
  forceClearQuery(query: string): void {
    const queryLower = query.toLowerCase();

    // Clear memory cache
    const memoryKeysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.toLowerCase().includes(queryLower)) {
        memoryKeysToDelete.push(key);
        this.currentMemoryUsage -= entry.size;
      }
    }
    memoryKeysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clear persistent cache
    const allKeys = Object.keys(localStorage);
    const persistentKeysToDelete = allKeys.filter(key =>
      (key.startsWith('search_cache_') || key.startsWith('conv_cache_')) &&
      key.toLowerCase().includes(queryLower)
    );
    persistentKeysToDelete.forEach(key => localStorage.removeItem(key));

    console.log(`🗑️ Force cleared ${memoryKeysToDelete.length + persistentKeysToDelete.length} cache entries for query: "${query}"`);
  }

  /**
   * Clear old cache entries to free up storage space
   */
  private clearOldCacheEntries(): void {
    try {
      const allKeys = Object.keys(localStorage);
      const cacheKeys = allKeys.filter(key =>
        key.startsWith('search_cache_') ||
        key.startsWith('conv_cache_') ||
        key.includes('paperless_chat_conversations')
      );

      // Sort by timestamp (oldest first) and remove oldest entries
      const keyTimestamps: Array<{key: string, timestamp: number}> = [];

      cacheKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            const timestamp = parsed.timestamp || parsed.cachedAt || 0;
            keyTimestamps.push({ key, timestamp });
          }
        } catch (e) {
          // If we can't parse it, it's probably corrupted, so add it for removal
          keyTimestamps.push({ key, timestamp: 0 });
        }
      });

      // Sort by timestamp (oldest first)
      keyTimestamps.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of cache entries
      const toRemove = Math.max(1, Math.floor(keyTimestamps.length * 0.25));
      const keysToRemove = keyTimestamps.slice(0, toRemove);

      keysToRemove.forEach(({ key }) => {
        localStorage.removeItem(key);
      });

      console.log(`🗑️ Cleared ${keysToRemove.length} old cache entries to free up storage space`);
    } catch (error) {
      console.error('Error clearing old cache entries:', error);
    }
  }

  /**
   * Clear conversation cache for temporal queries
   */
  clearTemporalConversationCache(): void {
    try {
      const conversationCacheKeys = Object.keys(localStorage).filter(key => key.startsWith('conv_cache_'));
      let clearedCount = 0;

      conversationCacheKeys.forEach(key => {
        try {
          const cacheData = localStorage.getItem(key);
          if (cacheData) {
            const entry = JSON.parse(cacheData);
            if (entry.searchParams && this.isTemporalQuery(entry.searchParams.query)) {
              localStorage.removeItem(key);
              clearedCount++;
              console.log(`🕐 Cleared temporal conversation cache: ${key}`);
            }
          }
        } catch (error) {
          // If we can't parse the entry, remove it anyway
          localStorage.removeItem(key);
          clearedCount++;
        }
      });

      console.log(`🧹 Cleared ${clearedCount} temporal conversation cache entries`);
    } catch (error) {
      console.warn('Failed to clear temporal conversation cache:', error);
    }
  }

  /**
   * Nuclear option: Clear ALL search-related cache
   */
  forceNuclearClear(): void {
    console.log('💥 NUCLEAR CACHE CLEAR: Removing ALL search-related cache');

    // Clear all memory cache
    this.memoryCache.clear();
    this.currentMemoryUsage = 0;

    // Clear ALL localStorage entries related to search/cache/conversation
    const allKeys = Object.keys(localStorage);
    const cacheKeys = allKeys.filter(key =>
      key.includes('search_cache_') ||
      key.includes('conv_cache_') ||
      key.includes('background_search_') ||
      key.includes('conversation_') ||
      key.includes('chat_') ||
      key.includes('cache')
    );

    cacheKeys.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage too
    const sessionKeys = Object.keys(sessionStorage);
    const sessionCacheKeys = sessionKeys.filter(key =>
      key.includes('search') ||
      key.includes('cache') ||
      key.includes('conversation')
    );
    sessionCacheKeys.forEach(key => sessionStorage.removeItem(key));

    console.log(`💥 Nuclear clear removed ${cacheKeys.length + sessionCacheKeys.length} cache entries`);
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { memoryUsage: number; entryCount: number } {
    return {
      ...this.metrics,
      memoryUsage: this.currentMemoryUsage,
      entryCount: this.memoryCache.size
    };
  }

  /**
   * Warm cache with popular search terms
   */
  async warmCache(popularQueries: Array<{ params: UnifiedSearchParams; userId: string }>): Promise<void> {
    console.log(`🔥 Warming cache with ${popularQueries.length} popular queries...`);
    
    for (const { params, userId } of popularQueries) {
      // Check if already cached
      const cached = await this.get(params, userId);
      if (!cached) {
        console.log(`⏳ Cache warming needed for: "${params.query}"`);
        // Note: Actual search execution would happen in the calling code
      }
    }
  }

  /**
   * Get cache key for conversation-specific caching
   */
  getConversationCacheKey(conversationId: string, searchParams: UnifiedSearchParams, userId: string): string {
    const baseKey = this.generateCacheKey(searchParams, userId);
    return `conv_${conversationId}_${baseKey}`;
  }

  /**
   * Store search results with conversation association
   */
  async setForConversation(
    conversationId: string,
    searchParams: UnifiedSearchParams,
    userId: string,
    response: UnifiedSearchResponse
  ): Promise<void> {
    // Store in regular cache
    await this.set(searchParams, userId, response);

    // Store conversation-specific cache entry
    try {
      const conversationCacheKey = this.getConversationCacheKey(conversationId, searchParams, userId);
      const entry = {
        conversationId,
        searchParams,
        results: response,
        cachedAt: Date.now(),
        userId
      };

      localStorage.setItem(`conv_cache_${conversationCacheKey}`, JSON.stringify(entry));
      console.log(`💾 Stored conversation-specific cache for ${conversationId}`);
    } catch (error) {
      console.warn('Failed to store conversation cache:', error);
    }
  }

  /**
   * Get search results for a specific conversation
   */
  async getForConversation(
    conversationId: string,
    searchParams: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse | null> {
    // 🔧 FIX: Check for temporal queries first and bypass conversation cache
    const isTemporalQuery = this.isTemporalQuery(searchParams.query);
    if (isTemporalQuery) {
      console.log('🕐 Temporal query detected in conversation cache, bypassing conversation cache for fresh results');
      // Skip conversation cache and go directly to regular cache (which also bypasses for temporal queries)
      return await this.get(searchParams, userId);
    }

    try {
      const conversationCacheKey = this.getConversationCacheKey(conversationId, searchParams, userId);
      const cacheData = localStorage.getItem(`conv_cache_${conversationCacheKey}`);

      if (cacheData) {
        const entry = JSON.parse(cacheData);

        // Check if cache is still valid (24 hours)
        const maxAge = 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - entry.cachedAt > maxAge;

        if (!isExpired && entry.userId === userId) {
          console.log(`💾 Found conversation cache for ${conversationId}`);
          return entry.results;
        } else {
          // Remove expired cache
          localStorage.removeItem(`conv_cache_${conversationCacheKey}`);
        }
      }
    } catch (error) {
      console.warn('Failed to get conversation cache:', error);
    }

    // Fallback to regular cache
    return await this.get(searchParams, userId);
  }

  /**
   * Clear cache for a specific conversation
   */
  clearConversationCache(conversationId: string): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`conv_cache_conv_${conversationId}_`)) {
          localStorage.removeItem(key);
        }
      });
      console.log(`🗑️ Cleared conversation cache for ${conversationId}`);
    } catch (error) {
      console.warn('Failed to clear conversation cache:', error);
    }
  }

  /**
   * Check if conversation has cached results
   */
  hasConversationCache(conversationId: string, searchParams: UnifiedSearchParams, userId: string): boolean {
    try {
      const conversationCacheKey = this.getConversationCacheKey(conversationId, searchParams, userId);
      const cacheData = localStorage.getItem(`conv_cache_${conversationCacheKey}`);

      if (cacheData) {
        const entry = JSON.parse(cacheData);
        const maxAge = 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - entry.cachedAt > maxAge;

        return !isExpired && entry.userId === userId;
      }
    } catch (error) {
      console.warn('Failed to check conversation cache:', error);
    }

    return false;
  }
}

// Export singleton instance
export const searchCache = new SearchCache();

// Clear any existing temporal conversation cache on initialization
// This ensures the fix takes effect immediately for temporal queries
searchCache.clearTemporalConversationCache();

// Global utility for debugging - accessible from browser console
if (typeof window !== 'undefined') {
  (window as any).clearPowercatCache = () => {
    console.log('🗑️ Clearing POWERCAT cache...');
    searchCache.forceClearQuery('powercat');

    // Also clear conversation caches
    import('./conversation-history').then(({ forceInvalidateConversationsByQuery }) => {
      forceInvalidateConversationsByQuery('powercat');
    });

    console.log('✅ POWERCAT cache cleared! Please refresh the page and try searching again.');
  };

  (window as any).clearAllSearchCache = () => {
    console.log('🗑️ Clearing all search cache...');
    searchCache.invalidate();

    // Also clear all conversation caches
    import('./conversation-history').then(({ forceInvalidateAllConversationCaches }) => {
      forceInvalidateAllConversationCaches();
    });

    console.log('✅ All search cache cleared! Please refresh the page.');
  };

  (window as any).nuclearClearCache = () => {
    console.log('💥 NUCLEAR CACHE CLEAR...');
    searchCache.forceNuclearClear();

    // Also clear all conversation caches
    import('./conversation-history').then(({ forceInvalidateAllConversationCaches }) => {
      forceInvalidateAllConversationCaches();
    });

    console.log('💥 Nuclear cache clear complete! Please refresh the page.');
  };

  // Add temporal cache clearing to window for debugging
  (window as any).clearTemporalCache = () => {
    console.log('🕐 Clearing temporal conversation cache...');
    searchCache.clearTemporalConversationCache();
    console.log('✅ Temporal cache cleared! Try your search again.');
  };
}
export type { CacheMetrics, SearchCacheKey };
