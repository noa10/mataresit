/**
 * In-Memory Cache Implementation
 * 
 * High-performance in-memory cache with LRU eviction, TTL support,
 * and comprehensive metrics for the Mataresit caching system.
 */

import { 
  CacheService, 
  CacheEntry, 
  CacheStats, 
  CacheConfig,
  CacheError,
  CacheSource 
} from './types';

/**
 * LRU Node for doubly-linked list
 */
class LRUNode<T = any> {
  constructor(
    public key: string,
    public entry: CacheEntry<T>,
    public prev: LRUNode<T> | null = null,
    public next: LRUNode<T> | null = null
  ) {}
}

/**
 * In-Memory Cache with LRU eviction and TTL support
 */
export class MemoryCache implements CacheService {
  private cache = new Map<string, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: CacheConfig,
    private source: CacheSource
  ) {
    this.stats = {
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      averageResponseTime: 0,
    };

    // Start cleanup interval for expired entries
    this.startCleanupInterval();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const node = this.cache.get(key);
      
      if (!node) {
        this.recordMiss();
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(node.entry)) {
        await this.delete(key);
        this.recordMiss();
        return null;
      }

      // Move to head (most recently used)
      this.moveToHead(node);
      
      // Update access metadata
      if (node.entry.metadata) {
        node.entry.metadata.lastAccessed = Date.now();
        node.entry.metadata.hitCount = (node.entry.metadata.hitCount || 0) + 1;
      }

      const responseTime = Date.now() - startTime;
      this.recordHit(responseTime);
      
      return node.entry.value as T;
    } catch (error) {
      this.recordMiss();
      throw new CacheError(
        `Failed to get cache entry: ${error.message}`,
        this.source,
        'get',
        key
      );
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const effectiveTTL = ttl || this.config.defaultTTL;
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: effectiveTTL,
        key,
        metadata: {
          source: this.source,
          size: this.estimateSize(value),
          hitCount: 0,
          lastAccessed: Date.now(),
        },
      };

      // Check if key already exists
      const existingNode = this.cache.get(key);
      if (existingNode) {
        // Update existing entry
        existingNode.entry = entry;
        this.moveToHead(existingNode);
      } else {
        // Create new entry
        const newNode = new LRUNode(key, entry);
        this.cache.set(key, newNode);
        this.addToHead(newNode);
        this.stats.totalEntries++;
      }

      // Update total size
      this.stats.totalSize += entry.metadata?.size || 0;

      // Check if we need to evict entries
      await this.evictIfNecessary();
    } catch (error) {
      throw new CacheError(
        `Failed to set cache entry: ${error.message}`,
        this.source,
        'set',
        key
      );
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const node = this.cache.get(key);
      if (!node) {
        return;
      }

      this.cache.delete(key);
      this.removeNode(node);
      
      this.stats.totalEntries--;
      this.stats.totalSize -= node.entry.metadata?.size || 0;
    } catch (error) {
      throw new CacheError(
        `Failed to delete cache entry: ${error.message}`,
        this.source,
        'delete',
        key
      );
    }
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.head = null;
      this.tail = null;
      this.stats.totalEntries = 0;
      this.stats.totalSize = 0;
      this.stats.lastCleared = Date.now();
    } catch (error) {
      throw new CacheError(
        `Failed to clear cache: ${error.message}`,
        this.source,
        'clear'
      );
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    // Check if expired
    if (this.isExpired(node.entry)) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Update TTL for existing entry
   */
  async touch(key: string, ttl?: number): Promise<void> {
    const node = this.cache.get(key);
    if (!node) {
      return;
    }

    if (ttl !== undefined) {
      node.entry.ttl = ttl;
    }
    node.entry.timestamp = Date.now();
    this.moveToHead(node);
  }

  /**
   * Increment numeric value
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    const currentValue = await this.get<number>(key);
    const newValue = (currentValue || 0) + delta;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Get multiple values
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    return results;
  }

  /**
   * Set multiple values
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Delete multiple keys
   */
  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    const matchingKeys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    
    return matchingKeys;
  }

  /**
   * Invalidate entries matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const keysToDelete = await this.keys(pattern);
    await this.mdelete(keysToDelete);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    this.updateHitRate();
    return { ...this.stats };
  }

  /**
   * Get total cache size
   */
  async getSize(): Promise<number> {
    return this.stats.totalSize;
  }

  /**
   * Get total entry count
   */
  async getEntryCount(): Promise<number> {
    return this.stats.totalEntries;
  }

  /**
   * Cleanup expired entries
   */
  private async cleanupExpired(): Promise<void> {
    const expiredKeys: string[] = [];
    
    for (const [key, node] of this.cache.entries()) {
      if (this.isExpired(node.entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict entries if cache is over limits
   */
  private async evictIfNecessary(): Promise<void> {
    // Evict by count
    if (this.config.maxEntries && this.stats.totalEntries > this.config.maxEntries) {
      await this.evictLRU();
    }

    // Evict by size
    if (this.config.maxSize && this.stats.totalSize > this.config.maxSize) {
      while (this.stats.totalSize > this.config.maxSize && this.tail) {
        await this.evictLRU();
      }
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    if (this.tail) {
      await this.delete(this.tail.key);
    }
  }

  /**
   * Move node to head of LRU list
   */
  private moveToHead(node: LRUNode): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Add node to head of LRU list
   */
  private addToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from LRU list
   */
  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(responseTime: number): void {
    this.stats.hitCount++;
    this.updateAverageResponseTime(responseTime);
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.stats.missCount++;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const total = this.stats.hitCount;
    this.stats.averageResponseTime = 
      ((this.stats.averageResponseTime * (total - 1)) + responseTime) / total;
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 0;
    }
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    const interval = Math.min(this.config.defaultTTL / 4, 60000); // Max 1 minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired().catch(console.error);
    }, interval);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
