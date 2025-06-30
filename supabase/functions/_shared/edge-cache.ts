/**
 * Edge Function Cache Implementation
 * 
 * Lightweight caching system for Supabase Edge Functions with in-memory storage
 * and automatic TTL management.
 */

interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
}

/**
 * Simple in-memory cache for Edge Functions
 */
class EdgeCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
  };
  private cleanupInterval: number | null = null;

  constructor(private maxEntries: number = 1000, private defaultTTL: number = 300000) {
    // Start cleanup every 5 minutes
    this.startCleanup();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalEntries--;
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    this.stats.hitCount++;
    this.updateHitRate();
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.defaultTTL;
    
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: effectiveTTL,
      key,
    };

    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const isNewEntry = !this.cache.has(key);
    this.cache.set(key, entry);
    
    if (isNewEntry) {
      this.stats.totalEntries++;
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    if (this.cache.delete(key)) {
      this.stats.totalEntries--;
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.totalEntries = 0;
    this.stats.hitCount = 0;
    this.stats.missCount = 0;
    this.stats.hitRate = 0;
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalEntries--;
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.totalEntries--;
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    // Use setTimeout instead of setInterval for Edge Functions
    const cleanup = () => {
      this.cleanupExpired();
      this.cleanupInterval = setTimeout(cleanup, 300000) as any; // 5 minutes
    };
    
    this.cleanupInterval = setTimeout(cleanup, 300000) as any;
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.stats.totalEntries--;
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearTimeout(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Cache key generator for Edge Functions
 */
export class EdgeCacheKeyGenerator {
  /**
   * Generate cache key with hash
   */
  static generate(components: string[]): string {
    const key = components.join(':');
    return this.hashKey(key);
  }

  /**
   * Generate LLM preprocessing cache key
   */
  static generateLLMKey(query: string, userId?: string): string {
    const components = ['llm', query];
    if (userId) components.push(userId);
    return this.generate(components);
  }

  /**
   * Generate search cache key
   */
  static generateSearchKey(
    query: string, 
    userId: string, 
    filters?: Record<string, any>
  ): string {
    const components = ['search', query, userId];
    if (filters) {
      components.push(JSON.stringify(filters));
    }
    return this.generate(components);
  }

  /**
   * Generate financial cache key
   */
  static generateFinancialKey(
    functionName: string,
    userId: string,
    params?: Record<string, any>
  ): string {
    const components = ['financial', functionName, userId];
    if (params) {
      components.push(JSON.stringify(params));
    }
    // Add time window for financial data freshness
    const timeWindow = Math.floor(Date.now() / 300000); // 5-minute windows
    components.push(timeWindow.toString());
    return this.generate(components);
  }

  /**
   * Simple hash function for cache keys
   */
  private static hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Cache configuration for different types
 */
export const EDGE_CACHE_CONFIG = {
  LLM_PREPROCESSING: {
    ttl: 3600000, // 1 hour
    maxEntries: 500,
  },
  UNIFIED_SEARCH: {
    ttl: 900000, // 15 minutes
    maxEntries: 300,
  },
  FINANCIAL_AGGREGATION: {
    ttl: 300000, // 5 minutes
    maxEntries: 200,
  },
  EMBEDDING_GENERATION: {
    ttl: 86400000, // 24 hours
    maxEntries: 1000,
  },
};

/**
 * Global cache instances for Edge Functions
 */
export const llmCache = new EdgeCache(
  EDGE_CACHE_CONFIG.LLM_PREPROCESSING.maxEntries,
  EDGE_CACHE_CONFIG.LLM_PREPROCESSING.ttl
);

export const searchCache = new EdgeCache(
  EDGE_CACHE_CONFIG.UNIFIED_SEARCH.maxEntries,
  EDGE_CACHE_CONFIG.UNIFIED_SEARCH.ttl
);

export const financialCache = new EdgeCache(
  EDGE_CACHE_CONFIG.FINANCIAL_AGGREGATION.maxEntries,
  EDGE_CACHE_CONFIG.FINANCIAL_AGGREGATION.ttl
);

export const embeddingCache = new EdgeCache(
  EDGE_CACHE_CONFIG.EMBEDDING_GENERATION.maxEntries,
  EDGE_CACHE_CONFIG.EMBEDDING_GENERATION.ttl
);

/**
 * Cache wrapper with automatic key generation and error handling
 */
export class CacheWrapper<T = any> {
  constructor(
    private cache: EdgeCache,
    private keyPrefix: string
  ) {}

  /**
   * Get or set cached value with fetcher function
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const fullKey = `${this.keyPrefix}:${key}`;
    
    // Try to get from cache first
    const cached = await this.cache.get<T>(fullKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const fresh = await fetcher();
      await this.cache.set(fullKey, fresh, ttl);
      return fresh;
    } catch (error) {
      console.error(`Cache fetch error for key ${fullKey}:`, error);
      throw error;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = `${this.keyPrefix}:${key}`;
    await this.cache.set(fullKey, value, ttl);
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | null> {
    const fullKey = `${this.keyPrefix}:${key}`;
    return this.cache.get<T>(fullKey);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}:${key}`;
    await this.cache.delete(fullKey);
  }
}

// Export cache wrappers for common use cases
export const llmCacheWrapper = new CacheWrapper(llmCache, 'llm');
export const searchCacheWrapper = new CacheWrapper(searchCache, 'search');
export const financialCacheWrapper = new CacheWrapper(financialCache, 'financial');
export const embeddingCacheWrapper = new CacheWrapper(embeddingCache, 'embedding');
