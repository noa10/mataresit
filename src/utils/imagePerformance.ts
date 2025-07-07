/**
 * Image Performance Monitoring Utilities
 * Tracks and analyzes image loading performance across the application
 */

interface ImagePerformanceMetric {
  url: string;
  loadTime: number;
  success: boolean;
  retryCount: number;
  cacheHit: boolean;
  imageSize?: { width: number; height: number };
  optimizationUsed?: boolean;
  lazyLoaded?: boolean;
  timestamp: number;
}

interface PerformanceStats {
  totalImages: number;
  averageLoadTime: number;
  successRate: number;
  cacheHitRate: number;
  lazyLoadedCount: number;
  optimizedCount: number;
  failedImages: string[];
}

class ImagePerformanceMonitor {
  private metrics: ImagePerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Record an image loading metric
   */
  recordMetric(metric: Omit<ImagePerformanceMetric, 'timestamp'>) {
    const fullMetric: ImagePerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.metrics.push(fullMetric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Image Performance:', {
        url: metric.url.substring(metric.url.lastIndexOf('/') + 1),
        loadTime: `${metric.loadTime.toFixed(2)}ms`,
        success: metric.success,
        cacheHit: metric.cacheHit,
        lazyLoaded: metric.lazyLoaded
      });
    }

    // Alert on slow loading
    if (metric.loadTime > 2000 && metric.success) {
      console.warn('⚠️ Slow image loading detected:', {
        url: metric.url,
        loadTime: metric.loadTime
      });
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindow?: number): PerformanceStats {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (relevantMetrics.length === 0) {
      return {
        totalImages: 0,
        averageLoadTime: 0,
        successRate: 0,
        cacheHitRate: 0,
        lazyLoadedCount: 0,
        optimizedCount: 0,
        failedImages: []
      };
    }

    const successfulMetrics = relevantMetrics.filter(m => m.success);
    const cacheHits = relevantMetrics.filter(m => m.cacheHit);
    const lazyLoaded = relevantMetrics.filter(m => m.lazyLoaded);
    const optimized = relevantMetrics.filter(m => m.optimizationUsed);
    const failed = relevantMetrics.filter(m => !m.success);

    return {
      totalImages: relevantMetrics.length,
      averageLoadTime: successfulMetrics.length > 0 
        ? successfulMetrics.reduce((sum, m) => sum + m.loadTime, 0) / successfulMetrics.length
        : 0,
      successRate: relevantMetrics.length > 0 
        ? (successfulMetrics.length / relevantMetrics.length) * 100
        : 0,
      cacheHitRate: relevantMetrics.length > 0 
        ? (cacheHits.length / relevantMetrics.length) * 100
        : 0,
      lazyLoadedCount: lazyLoaded.length,
      optimizedCount: optimized.length,
      failedImages: failed.map(m => m.url)
    };
  }

  /**
   * Get slow loading images
   */
  getSlowImages(threshold: number = 2000): ImagePerformanceMetric[] {
    return this.metrics.filter(m => m.success && m.loadTime > threshold);
  }

  /**
   * Get cache performance
   */
  getCachePerformance(): { hits: number; misses: number; hitRate: number } {
    const hits = this.metrics.filter(m => m.cacheHit).length;
    const total = this.metrics.length;
    const misses = total - hits;

    return {
      hits,
      misses,
      hitRate: total > 0 ? (hits / total) * 100 : 0
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): ImagePerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStats();
    const cachePerf = this.getCachePerformance();
    const slowImages = this.getSlowImages();

    return `
📊 Image Performance Report
==========================

📈 Overall Stats:
- Total Images: ${stats.totalImages}
- Average Load Time: ${stats.averageLoadTime.toFixed(2)}ms
- Success Rate: ${stats.successRate.toFixed(1)}%
- Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%

🚀 Optimization Stats:
- Lazy Loaded: ${stats.lazyLoadedCount}
- Optimized: ${stats.optimizedCount}

🐌 Performance Issues:
- Slow Images (>2s): ${slowImages.length}
- Failed Images: ${stats.failedImages.length}

💾 Cache Performance:
- Cache Hits: ${cachePerf.hits}
- Cache Misses: ${cachePerf.misses}
- Hit Rate: ${cachePerf.hitRate.toFixed(1)}%

${slowImages.length > 0 ? `
⚠️ Slow Loading Images:
${slowImages.map(img => `- ${img.url.substring(img.url.lastIndexOf('/') + 1)}: ${img.loadTime.toFixed(2)}ms`).join('\n')}
` : ''}

${stats.failedImages.length > 0 ? `
❌ Failed Images:
${stats.failedImages.map(url => `- ${url.substring(url.lastIndexOf('/') + 1)}`).join('\n')}
` : ''}
    `.trim();
  }
}

// Global instance
export const imagePerformanceMonitor = new ImagePerformanceMonitor();

/**
 * Measure image loading time
 */
export function measureImageLoad(url: string): {
  start: () => void;
  end: (success: boolean, options?: Partial<ImagePerformanceMetric>) => void;
} {
  let startTime: number;

  return {
    start: () => {
      startTime = performance.now();
    },
    end: (success: boolean, options = {}) => {
      const loadTime = performance.now() - startTime;
      imagePerformanceMonitor.recordMetric({
        url,
        loadTime,
        success,
        retryCount: 0,
        cacheHit: false,
        ...options
      });
    }
  };
}

/**
 * Performance monitoring hook for React components
 */
export function useImagePerformanceMonitoring() {
  const recordMetric = (metric: Omit<ImagePerformanceMetric, 'timestamp'>) => {
    imagePerformanceMonitor.recordMetric(metric);
  };

  const getStats = (timeWindow?: number) => {
    return imagePerformanceMonitor.getStats(timeWindow);
  };

  const generateReport = () => {
    return imagePerformanceMonitor.generateReport();
  };

  return {
    recordMetric,
    getStats,
    generateReport,
    monitor: imagePerformanceMonitor
  };
}

/**
 * Development helper to log performance stats
 */
export function logPerformanceStats(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(imagePerformanceMonitor.generateReport());
  }
}

// Auto-log performance stats every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = imagePerformanceMonitor.getStats();
    if (stats.totalImages > 0) {
      console.group('📊 Image Performance Update');
      console.log(`Images loaded: ${stats.totalImages}`);
      console.log(`Average load time: ${stats.averageLoadTime.toFixed(2)}ms`);
      console.log(`Success rate: ${stats.successRate.toFixed(1)}%`);
      console.log(`Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
      console.groupEnd();
    }
  }, 30000);
}
