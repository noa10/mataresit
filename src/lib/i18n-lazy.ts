/**
 * Lazy Loading Translation System
 * Implements dynamic loading of translation files for better performance
 */

import { SupportedLanguage, Namespace } from './i18n';

// Translation cache
const translationCache = new Map<string, any>();

// Loading states
const loadingStates = new Map<string, Promise<any>>();

// Preloaded namespaces (critical for initial render)
const PRELOAD_NAMESPACES: Namespace[] = ['common', 'navigation', 'errors'];

// Lazy loading configuration
export interface LazyLoadConfig {
  enableLazyLoading: boolean;
  preloadNamespaces: Namespace[];
  cacheTimeout: number; // in milliseconds
  maxCacheSize: number;
}

export const defaultLazyLoadConfig: LazyLoadConfig = {
  enableLazyLoading: true,
  preloadNamespaces: PRELOAD_NAMESPACES,
  cacheTimeout: 30 * 60 * 1000, // 30 minutes
  maxCacheSize: 50 // Maximum number of cached translation files
};

// Cache entry interface
interface CacheEntry {
  data: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Lazy translation loader class
 */
export class LazyTranslationLoader {
  private config: LazyLoadConfig;
  private cache = new Map<string, CacheEntry>();
  private loadingPromises = new Map<string, Promise<any>>();

  constructor(config: LazyLoadConfig = defaultLazyLoadConfig) {
    this.config = config;
    this.setupCacheCleanup();
  }

  /**
   * Load translation namespace dynamically
   */
  async loadNamespace(language: SupportedLanguage, namespace: Namespace): Promise<any> {
    const cacheKey = `${language}:${namespace}`;
    
    // Check cache first
    const cached = this.getCachedTranslation(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Start loading
    const loadPromise = this.loadTranslationFile(language, namespace);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const translation = await loadPromise;
      this.setCachedTranslation(cacheKey, translation);
      return translation;
    } catch (error) {
      console.error(`Failed to load translation ${cacheKey}:`, error);
      throw error;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Load multiple namespaces in parallel
   */
  async loadNamespaces(language: SupportedLanguage, namespaces: Namespace[]): Promise<Record<string, any>> {
    const loadPromises = namespaces.map(async (namespace) => {
      const translation = await this.loadNamespace(language, namespace);
      return { namespace, translation };
    });

    const results = await Promise.allSettled(loadPromises);
    const translations: Record<string, any> = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        translations[namespaces[index]] = result.value.translation;
      } else {
        console.warn(`Failed to load namespace ${namespaces[index]}:`, result.reason);
      }
    });

    return translations;
  }

  /**
   * Preload critical namespaces
   */
  async preloadCriticalNamespaces(language: SupportedLanguage): Promise<void> {
    try {
      await this.loadNamespaces(language, this.config.preloadNamespaces);
      console.log(`✅ Preloaded critical namespaces for ${language}`);
    } catch (error) {
      console.error('Failed to preload critical namespaces:', error);
    }
  }

  /**
   * Load translation file from server or static imports
   */
  private async loadTranslationFile(language: SupportedLanguage, namespace: Namespace): Promise<any> {
    const startTime = performance.now();

    try {
      // Try dynamic import first (for build-time optimization)
      const translation = await this.dynamicImport(language, namespace);
      
      const loadTime = performance.now() - startTime;
      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 Loaded ${language}:${namespace} in ${loadTime.toFixed(2)}ms`);
      }

      return translation;
    } catch (error) {
      // Fallback to HTTP request
      console.warn(`Dynamic import failed for ${language}:${namespace}, falling back to HTTP`);
      return this.httpFallback(language, namespace);
    }
  }

  /**
   * Dynamic import with Vite optimization
   */
  private async dynamicImport(language: SupportedLanguage, namespace: Namespace): Promise<any> {
    // Use dynamic imports that Vite can optimize
    const importPath = `/src/locales/${language}/${namespace}.json`;
    
    try {
      // This will be optimized by Vite's dynamic import handling
      const module = await import(/* @vite-ignore */ importPath);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to dynamically import ${importPath}: ${error}`);
    }
  }

  /**
   * HTTP fallback for translation loading
   */
  private async httpFallback(language: SupportedLanguage, namespace: Namespace): Promise<any> {
    const url = `/locales/${language}/${namespace}.json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to load ${url}`);
    }

    return response.json();
  }

  /**
   * Get cached translation
   */
  private getCachedTranslation(cacheKey: string): any | null {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheTimeout) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data;
  }

  /**
   * Set cached translation
   */
  private setCachedTranslation(cacheKey: string, data: any): void {
    const now = Date.now();
    
    // Ensure cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    });
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Setup periodic cache cleanup
   */
  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.config.cacheTimeout) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => this.cache.delete(key));

      if (expiredKeys.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(`🧹 Cleaned up ${expiredKeys.length} expired translation cache entries`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: now - entry.timestamp
    }));

    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (this.cache.size / totalAccesses) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: Math.round(hitRate * 100) / 100,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount)
    };
  }

  /**
   * Clear all cached translations
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}

// Global lazy loader instance
export const lazyTranslationLoader = new LazyTranslationLoader();

// Utility functions for integration with i18next
export const lazyLoadingUtils = {
  // Initialize lazy loading for a language
  initializeLanguage: async (language: SupportedLanguage): Promise<void> => {
    await lazyTranslationLoader.preloadCriticalNamespaces(language);
  },

  // Load namespace on demand
  loadNamespaceOnDemand: async (language: SupportedLanguage, namespace: Namespace): Promise<any> => {
    return lazyTranslationLoader.loadNamespace(language, namespace);
  },

  // Get cache statistics for monitoring
  getCacheStats: () => lazyTranslationLoader.getCacheStats(),

  // Clear cache for memory management
  clearCache: () => lazyTranslationLoader.clearCache()
};
