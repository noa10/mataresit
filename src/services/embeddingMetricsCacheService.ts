/**
 * Embedding Metrics Cache Service
 * Intelligent caching for embedding metrics data with TTL and invalidation
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 2
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableCompression: boolean;
}

class EmbeddingMetricsCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    enableCompression: false
  };

  private accessTimes: Map<string, number> = new Map();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.missCount++;
      return null;
    }

    // Update access time for LRU
    this.accessTimes.set(key, Date.now());
    this.hitCount++;
    
    return entry.data;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const actualTTL = ttl || this.config.defaultTTL;
    
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
      key
    };

    this.cache.set(key, entry);
    this.accessTimes.set(key, Date.now());
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    this.accessTimes.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Get or set with a factory function
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    try {
      const data = await factory();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let deletedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const hitRate = this.hitCount + this.missCount > 0 
      ? (this.hitCount / (this.hitCount + this.missCount)) * 100 
      : 0;

    // Estimate memory usage (rough calculation)
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += JSON.stringify(entry).length * 2; // Rough estimate in bytes
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If max size was reduced, clean up excess entries
    while (this.cache.size > this.config.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries by pattern
   */
  getEntriesByPattern(pattern: string): Array<{ key: string; data: any; age: number }> {
    const regex = new RegExp(pattern);
    const entries: Array<{ key: string; data: any; age: number }> = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        entries.push({
          key,
          data: entry.data,
          age: now - entry.timestamp
        });
      }
    }

    return entries;
  }

  /**
   * Preload cache with data
   */
  preload<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.data, entry.ttl);
    }
  }

  /**
   * Export cache data for persistence
   */
  export(): Array<{ key: string; data: any; timestamp: number; ttl: number }> {
    const exported: Array<{ key: string; data: any; timestamp: number; ttl: number }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Only export non-expired entries
      if (Date.now() - entry.timestamp <= entry.ttl) {
        exported.push({
          key,
          data: entry.data,
          timestamp: entry.timestamp,
          ttl: entry.ttl
        });
      }
    }

    return exported;
  }

  /**
   * Import cache data from persistence
   */
  import(data: Array<{ key: string; data: any; timestamp: number; ttl: number }>): number {
    let importedCount = 0;
    const now = Date.now();

    for (const item of data) {
      // Only import non-expired entries
      if (now - item.timestamp <= item.ttl) {
        const entry: CacheEntry<any> = {
          data: item.data,
          timestamp: item.timestamp,
          ttl: item.ttl,
          key: item.key
        };
        
        this.cache.set(item.key, entry);
        this.accessTimes.set(item.key, item.timestamp);
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * Generate cache key for embedding metrics
   */
  static generateKey(operation: string, params?: Record<string, any>): string {
    const baseKey = `embedding_metrics:${operation}`;
    
    if (!params) {
      return baseKey;
    }

    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    return `${baseKey}:${sortedParams}`;
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check hit rate
    if (stats.hitRate < 50) {
      issues.push('Low cache hit rate');
      recommendations.push('Consider increasing TTL or reviewing cache keys');
    }

    // Check memory usage (rough threshold)
    if (stats.memoryUsage > 10 * 1024 * 1024) { // 10MB
      issues.push('High memory usage');
      recommendations.push('Consider reducing cache size or TTL');
    }

    // Check cache utilization
    if (stats.size / stats.maxSize > 0.9) {
      issues.push('Cache near capacity');
      recommendations.push('Consider increasing max cache size');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, issues, recommendations };
  }
}

// Export singleton instance and class
export const embeddingMetricsCacheService = new EmbeddingMetricsCacheService();
export { EmbeddingMetricsCacheService };
