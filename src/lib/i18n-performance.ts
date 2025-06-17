/**
 * Performance Optimization System for Multi-language Support
 * Handles mobile-specific optimizations, bundle splitting, and caching strategies
 */

import { SupportedLanguage, Namespace } from './i18n';
import { lazyTranslationLoader } from './i18n-lazy';

// Performance configuration
export interface PerformanceConfig {
  enableMobileOptimizations: boolean;
  enableBundleSplitting: boolean;
  enableServiceWorkerCaching: boolean;
  preloadThreshold: number; // in milliseconds
  mobileDetectionMethod: 'userAgent' | 'viewport' | 'both';
  compressionLevel: 'none' | 'gzip' | 'brotli';
}

export const defaultPerformanceConfig: PerformanceConfig = {
  enableMobileOptimizations: true,
  enableBundleSplitting: true,
  enableServiceWorkerCaching: true,
  preloadThreshold: 100, // 100ms
  mobileDetectionMethod: 'both',
  compressionLevel: 'gzip'
};

// Mobile detection utilities
export class MobileDetector {
  /**
   * Detect if user is on mobile device
   */
  static isMobile(): boolean {
    const config = defaultPerformanceConfig;
    
    if (config.mobileDetectionMethod === 'userAgent') {
      return this.isMobileByUserAgent();
    } else if (config.mobileDetectionMethod === 'viewport') {
      return this.isMobileByViewport();
    } else {
      return this.isMobileByUserAgent() || this.isMobileByViewport();
    }
  }

  /**
   * Detect mobile by user agent
   */
  private static isMobileByUserAgent(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'mobile', 'android', 'iphone', 'ipad', 'ipod', 
      'blackberry', 'windows phone', 'opera mini'
    ];
    
    return mobileKeywords.some(keyword => userAgent.includes(keyword));
  }

  /**
   * Detect mobile by viewport size
   */
  private static isMobileByViewport(): boolean {
    return window.innerWidth <= 768; // Tailwind's md breakpoint
  }

  /**
   * Get connection speed estimate
   */
  static getConnectionSpeed(): 'slow' | 'medium' | 'fast' {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) return 'medium';
    
    const effectiveType = connection.effectiveType;
    
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'slow';
    } else if (effectiveType === '3g') {
      return 'medium';
    } else {
      return 'fast';
    }
  }

  /**
   * Check if device has limited memory
   */
  static hasLimitedMemory(): boolean {
    // @ts-ignore - navigator.deviceMemory is experimental
    const deviceMemory = navigator.deviceMemory;
    
    if (!deviceMemory) return false;
    
    return deviceMemory <= 2; // 2GB or less
  }
}

/**
 * Translation Bundle Manager
 */
export class TranslationBundleManager {
  private loadedBundles = new Set<string>();
  private bundleCache = new Map<string, any>();

  /**
   * Load translation bundle optimized for current device
   */
  async loadOptimizedBundle(language: SupportedLanguage): Promise<void> {
    const bundleKey = `${language}-optimized`;
    
    if (this.loadedBundles.has(bundleKey)) {
      return;
    }

    const isMobile = MobileDetector.isMobile();
    const connectionSpeed = MobileDetector.getConnectionSpeed();
    const hasLimitedMemory = MobileDetector.hasLimitedMemory();

    // Determine which namespaces to load based on device capabilities
    const namespacesToLoad = this.getOptimizedNamespaces(isMobile, connectionSpeed, hasLimitedMemory);

    try {
      const startTime = performance.now();
      
      // Load namespaces in parallel for fast connections, sequentially for slow
      if (connectionSpeed === 'fast') {
        await this.loadNamespacesParallel(language, namespacesToLoad);
      } else {
        await this.loadNamespacesSequential(language, namespacesToLoad);
      }

      const loadTime = performance.now() - startTime;
      console.log(`📱 Loaded optimized ${language} bundle in ${loadTime.toFixed(2)}ms`);

      this.loadedBundles.add(bundleKey);
    } catch (error) {
      console.error(`Failed to load optimized bundle for ${language}:`, error);
    }
  }

  /**
   * Get optimized namespaces based on device capabilities
   */
  private getOptimizedNamespaces(
    isMobile: boolean, 
    connectionSpeed: 'slow' | 'medium' | 'fast',
    hasLimitedMemory: boolean
  ): Namespace[] {
    // Critical namespaces that are always loaded
    const criticalNamespaces: Namespace[] = ['common', 'navigation', 'errors'];
    
    // Additional namespaces based on device capabilities
    const additionalNamespaces: Namespace[] = [];

    if (connectionSpeed === 'fast' && !hasLimitedMemory) {
      // Load all namespaces for fast connections with good memory
      additionalNamespaces.push('dashboard', 'receipts', 'auth', 'settings', 'forms');
    } else if (connectionSpeed === 'medium') {
      // Load essential namespaces for medium connections
      additionalNamespaces.push('dashboard', 'receipts', 'auth');
    } else {
      // Only critical namespaces for slow connections
      // Additional namespaces will be loaded on demand
    }

    if (!isMobile) {
      // Desktop users can handle more namespaces
      additionalNamespaces.push('admin', 'ai', 'categories', 'profile');
    }

    return [...criticalNamespaces, ...additionalNamespaces];
  }

  /**
   * Load namespaces in parallel
   */
  private async loadNamespacesParallel(language: SupportedLanguage, namespaces: Namespace[]): Promise<void> {
    const loadPromises = namespaces.map(namespace => 
      lazyTranslationLoader.loadNamespace(language, namespace)
    );

    await Promise.allSettled(loadPromises);
  }

  /**
   * Load namespaces sequentially (for slow connections)
   */
  private async loadNamespacesSequential(language: SupportedLanguage, namespaces: Namespace[]): Promise<void> {
    for (const namespace of namespaces) {
      try {
        await lazyTranslationLoader.loadNamespace(language, namespace);
        
        // Small delay to prevent overwhelming slow connections
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(`Failed to load namespace ${namespace}:`, error);
      }
    }
  }

  /**
   * Preload next likely namespaces based on current page
   */
  async preloadNextLikelyNamespaces(currentPage: string, language: SupportedLanguage): Promise<void> {
    const nextNamespaces = this.getPredictedNamespaces(currentPage);
    
    if (nextNamespaces.length === 0) return;

    // Only preload if connection is fast enough
    const connectionSpeed = MobileDetector.getConnectionSpeed();
    if (connectionSpeed === 'slow') return;

    // Preload with low priority
    requestIdleCallback(async () => {
      for (const namespace of nextNamespaces) {
        try {
          await lazyTranslationLoader.loadNamespace(language, namespace);
        } catch (error) {
          // Ignore preload errors
        }
      }
    });
  }

  /**
   * Predict next namespaces based on current page
   */
  private getPredictedNamespaces(currentPage: string): Namespace[] {
    const predictions: Record<string, Namespace[]> = {
      '/': ['dashboard', 'receipts'],
      '/dashboard': ['receipts', 'categories'],
      '/receipts': ['forms', 'ai'],
      '/settings': ['profile', 'admin'],
      '/auth': ['dashboard'],
      '/profile': ['settings']
    };

    return predictions[currentPage] || [];
  }
}

/**
 * Service Worker Cache Manager
 */
export class ServiceWorkerCacheManager {
  private static readonly CACHE_NAME = 'mataresit-translations-v1';
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Initialize service worker caching
   */
  static async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      await navigator.serviceWorker.register('/sw-translations.js');
      console.log('✅ Translation service worker registered');
    } catch (error) {
      console.error('Failed to register translation service worker:', error);
    }
  }

  /**
   * Cache translation files
   */
  static async cacheTranslations(language: SupportedLanguage, namespaces: Namespace[]): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.CACHE_NAME);
      
      const urlsToCache = namespaces.map(namespace => 
        `/locales/${language}/${namespace}.json`
      );

      await cache.addAll(urlsToCache);
      
      // Store cache timestamp
      const cacheInfo = {
        timestamp: Date.now(),
        language,
        namespaces
      };
      
      localStorage.setItem(`${this.CACHE_NAME}-info`, JSON.stringify(cacheInfo));
      
      console.log(`💾 Cached ${urlsToCache.length} translation files for ${language}`);
    } catch (error) {
      console.error('Failed to cache translations:', error);
    }
  }

  /**
   * Check if cache is expired
   */
  static isCacheExpired(): boolean {
    const cacheInfo = localStorage.getItem(`${this.CACHE_NAME}-info`);
    
    if (!cacheInfo) return true;

    try {
      const { timestamp } = JSON.parse(cacheInfo);
      return Date.now() - timestamp > this.CACHE_EXPIRY;
    } catch {
      return true;
    }
  }

  /**
   * Clear expired cache
   */
  static async clearExpiredCache(): Promise<void> {
    if (!this.isCacheExpired()) return;

    try {
      await caches.delete(this.CACHE_NAME);
      localStorage.removeItem(`${this.CACHE_NAME}-info`);
      console.log('🧹 Cleared expired translation cache');
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  /**
   * Record translation loading time
   */
  static recordLoadTime(key: string, time: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const times = this.metrics.get(key)!;
    times.push(time);
    
    // Keep only last 10 measurements
    if (times.length > 10) {
      times.shift();
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, any> = {};
    
    for (const [key, times] of this.metrics.entries()) {
      stats[key] = {
        avg: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        count: times.length
      };
    }
    
    return stats;
  }

  /**
   * Log performance report
   */
  static logPerformanceReport(): void {
    const stats = this.getStats();
    console.table(stats);
  }
}

// Global instances
export const bundleManager = new TranslationBundleManager();

// Utility functions
export const performanceUtils = {
  // Initialize performance optimizations
  initialize: async () => {
    await ServiceWorkerCacheManager.initialize();
    await ServiceWorkerCacheManager.clearExpiredCache();
  },

  // Load optimized bundle for current device
  loadOptimizedBundle: (language: SupportedLanguage) => {
    return bundleManager.loadOptimizedBundle(language);
  },

  // Check if mobile device
  isMobile: () => MobileDetector.isMobile(),

  // Get connection speed
  getConnectionSpeed: () => MobileDetector.getConnectionSpeed(),

  // Get performance stats
  getPerformanceStats: () => PerformanceMonitor.getStats(),

  // Log performance report
  logPerformanceReport: () => PerformanceMonitor.logPerformanceReport()
};
