/**
 * Cache Manager
 * 
 * Central management system for all cache instances in the Mataresit application.
 * Provides unified access to different cache backends and sources.
 */

import { 
  CacheManager, 
  CacheService, 
  CacheConfig, 
  CacheSource, 
  CacheStats,
  CacheBackend 
} from './types';
import { MemoryCache } from './memory-cache';
import { cacheKeyGenerator, CACHE_TTL_CONFIG } from './key-generator';

/**
 * Default cache configurations for different sources
 */
const DEFAULT_CACHE_CONFIGS: Record<CacheSource, CacheConfig> = {
  llm_preprocessing: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.llm_preprocessing,
    maxEntries: 1000,
    maxSize: 10 * 1024 * 1024, // 10MB
    metricsEnabled: true,
  },
  unified_search: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.unified_search,
    maxEntries: 500,
    maxSize: 50 * 1024 * 1024, // 50MB
    metricsEnabled: true,
  },
  financial_aggregation: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.financial_aggregation,
    maxEntries: 200,
    maxSize: 5 * 1024 * 1024, // 5MB
    metricsEnabled: true,
  },
  embedding_generation: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.embedding_generation,
    maxEntries: 2000,
    maxSize: 100 * 1024 * 1024, // 100MB
    metricsEnabled: true,
  },
  reranking_results: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.reranking_results,
    maxEntries: 300,
    maxSize: 20 * 1024 * 1024, // 20MB
    metricsEnabled: true,
  },
  ui_components: {
    backend: 'memory',
    defaultTTL: CACHE_TTL_CONFIG.ui_components,
    maxEntries: 500,
    maxSize: 10 * 1024 * 1024, // 10MB
    metricsEnabled: true,
  },
  conversation_history: {
    backend: 'localStorage',
    defaultTTL: CACHE_TTL_CONFIG.conversation_history,
    maxEntries: 100,
    maxSize: 20 * 1024 * 1024, // 20MB
    metricsEnabled: false,
  },
  user_preferences: {
    backend: 'localStorage',
    defaultTTL: CACHE_TTL_CONFIG.user_preferences,
    maxEntries: 50,
    maxSize: 1 * 1024 * 1024, // 1MB
    metricsEnabled: false,
  },
};

/**
 * Default Cache Manager Implementation
 */
export class DefaultCacheManager implements CacheManager {
  private caches = new Map<CacheSource, CacheService>();
  private configs = new Map<CacheSource, CacheConfig>();

  constructor() {
    // Initialize default configurations
    for (const [source, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
      this.configs.set(source as CacheSource, config);
    }
  }

  /**
   * Get cache instance for a specific source
   */
  getCache(source: CacheSource): CacheService {
    let cache = this.caches.get(source);
    
    if (!cache) {
      const config = this.configs.get(source) || DEFAULT_CACHE_CONFIGS[source];
      cache = this.createCache(source, config);
      this.caches.set(source, cache);
    }

    return cache;
  }

  /**
   * Create a new cache instance
   */
  createCache(source: CacheSource, config: CacheConfig): CacheService {
    switch (config.backend) {
      case 'memory':
        return new MemoryCache(config, source);
      
      case 'localStorage':
        return new LocalStorageCache(config, source);
      
      case 'sessionStorage':
        return new SessionStorageCache(config, source);
      
      case 'redis':
        // TODO: Implement Redis cache when needed
        console.warn(`Redis cache not implemented, falling back to memory cache for ${source}`);
        return new MemoryCache({ ...config, backend: 'memory' }, source);
      
      default:
        throw new Error(`Unsupported cache backend: ${config.backend}`);
    }
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const clearPromises = Array.from(this.caches.values()).map(cache => cache.clear());
    await Promise.all(clearPromises);
  }

  /**
   * Get global statistics for all caches
   */
  async getGlobalStats(): Promise<Record<CacheSource, CacheStats>> {
    const stats: Record<string, CacheStats> = {};
    
    for (const [source, cache] of this.caches.entries()) {
      try {
        stats[source] = await cache.getStats();
      } catch (error) {
        console.error(`Failed to get stats for ${source}:`, error);
        stats[source] = {
          hitCount: 0,
          missCount: 0,
          hitRate: 0,
          totalEntries: 0,
          totalSize: 0,
          averageResponseTime: 0,
        };
      }
    }

    return stats as Record<CacheSource, CacheStats>;
  }

  /**
   * Update configuration for a cache source
   */
  async updateConfig(source: CacheSource, config: Partial<CacheConfig>): Promise<void> {
    const currentConfig = this.configs.get(source) || DEFAULT_CACHE_CONFIGS[source];
    const newConfig = { ...currentConfig, ...config };
    
    this.configs.set(source, newConfig);
    
    // Recreate cache with new config if it exists
    if (this.caches.has(source)) {
      const oldCache = this.caches.get(source)!;
      
      // Clear old cache
      await oldCache.clear();
      
      // Destroy old cache if it has a destroy method
      if ('destroy' in oldCache && typeof oldCache.destroy === 'function') {
        oldCache.destroy();
      }
      
      // Create new cache with updated config
      const newCache = this.createCache(source, newConfig);
      this.caches.set(source, newCache);
    }
  }

  /**
   * Get configuration for a cache source
   */
  getConfig(source: CacheSource): CacheConfig {
    return this.configs.get(source) || DEFAULT_CACHE_CONFIGS[source];
  }

  /**
   * Destroy all caches and cleanup resources
   */
  async destroy(): Promise<void> {
    for (const cache of this.caches.values()) {
      if ('destroy' in cache && typeof cache.destroy === 'function') {
        cache.destroy();
      }
    }
    
    this.caches.clear();
    this.configs.clear();
  }
}

/**
 * Browser LocalStorage Cache Implementation
 */
class LocalStorageCache implements CacheService {
  private keyPrefix: string;

  constructor(private config: CacheConfig, private source: CacheSource) {
    this.keyPrefix = `mataresit:cache:${source}:`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const item = localStorage.getItem(fullKey);
      
      if (!item) {
        return null;
      }

      const entry = JSON.parse(item);
      
      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('LocalStorage cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      const entry = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
      };

      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch (error) {
      console.error('LocalStorage cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.error('LocalStorage cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('LocalStorage cache clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async touch(key: string, ttl?: number): Promise<void> {
    const value = await this.get(key);
    if (value !== null) {
      await this.set(key, value, ttl);
    }
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const matchingKeys: string[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        const shortKey = key.substring(this.keyPrefix.length);
        if (regex.test(shortKey)) {
          matchingKeys.push(shortKey);
        }
      }
    }

    return matchingKeys;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    await this.mdelete(keys);
  }

  async getStats(): Promise<CacheStats> {
    // Basic stats for localStorage
    return {
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      averageResponseTime: 0,
    };
  }

  async getSize(): Promise<number> {
    return 0; // Not easily calculable for localStorage
  }

  async getEntryCount(): Promise<number> {
    const keys = await this.keys('*');
    return keys.length;
  }
}

/**
 * Browser SessionStorage Cache Implementation
 */
class SessionStorageCache extends LocalStorageCache {
  constructor(config: CacheConfig, source: CacheSource) {
    super(config, source);
    // Override localStorage methods to use sessionStorage
    this.storage = sessionStorage;
  }

  private storage: Storage = sessionStorage;

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const item = this.storage.getItem(fullKey);
      
      if (!item) {
        return null;
      }

      const entry = JSON.parse(item);
      
      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('SessionStorage cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      const entry = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
      };

      this.storage.setItem(fullKey, JSON.stringify(entry));
    } catch (error) {
      console.error('SessionStorage cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.keyPrefix + key;
      this.storage.removeItem(fullKey);
    } catch (error) {
      console.error('SessionStorage cache delete error:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = new DefaultCacheManager();
