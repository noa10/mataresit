// ============================================================================
// ANALYTICS PERFORMANCE OPTIMIZATION UTILITIES
// ============================================================================

import { supabase } from '@/lib/supabase';

// ============================================================================
// CACHING UTILITIES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class AnalyticsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const analyticsCache = new AnalyticsCache();

// Auto-cleanup every 10 minutes
setInterval(() => {
  analyticsCache.cleanup();
}, 10 * 60 * 1000);

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000;

  startTimer(operation: string): () => PerformanceMetric {
    const startTime = performance.now();
    const startTimestamp = Date.now();

    return (success: boolean = true, cacheHit?: boolean, dataSize?: number): PerformanceMetric => {
      const duration = performance.now() - startTime;
      const metric: PerformanceMetric = {
        operation,
        duration,
        timestamp: startTimestamp,
        success,
        cacheHit,
        dataSize
      };

      this.addMetric(metric);
      return metric;
    };
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(operation?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }

    return filtered.slice(-limit);
  }

  getAveragePerformance(operation: string, timeWindow: number = 60000): {
    avgDuration: number;
    successRate: number;
    cacheHitRate: number;
    totalOperations: number;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(
      m => m.operation === operation && m.timestamp > cutoff
    );

    if (recentMetrics.length === 0) {
      return {
        avgDuration: 0,
        successRate: 0,
        cacheHitRate: 0,
        totalOperations: 0
      };
    }

    const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    const cacheHitRate = recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length;

    return {
      avgDuration,
      successRate,
      cacheHitRate,
      totalOperations: recentMetrics.length
    };
  }

  getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// QUERY OPTIMIZATION UTILITIES
// ============================================================================

export class QueryOptimizer {
  
  /**
   * Optimize analytics queries with caching and performance monitoring
   */
  static async optimizedQuery<T>(
    operation: string,
    queryFn: () => Promise<T>,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    const timer = performanceMonitor.startTimer(operation);
    
    try {
      // Check cache first
      if (cacheKey) {
        const cached = analyticsCache.get<T>(cacheKey);
        if (cached) {
          timer(true, true);
          return cached;
        }
      }

      // Execute query
      const result = await queryFn();
      
      // Cache result
      if (cacheKey && result) {
        analyticsCache.set(cacheKey, result, cacheTTL);
      }

      timer(true, false, JSON.stringify(result).length);
      return result;
    } catch (error) {
      timer(false);
      throw error;
    }
  }

  /**
   * Batch multiple analytics queries for better performance
   */
  static async batchQueries<T>(
    queries: Array<{
      operation: string;
      queryFn: () => Promise<T>;
      cacheKey?: string;
      cacheTTL?: number;
    }>
  ): Promise<T[]> {
    const timer = performanceMonitor.startTimer('batch_queries');
    
    try {
      const results = await Promise.all(
        queries.map(query => 
          this.optimizedQuery(
            query.operation,
            query.queryFn,
            query.cacheKey,
            query.cacheTTL
          )
        )
      );
      
      timer(true, false, results.length);
      return results;
    } catch (error) {
      timer(false);
      throw error;
    }
  }

  /**
   * Paginated query optimization for large datasets
   */
  static async paginatedQuery<T>(
    operation: string,
    queryBuilder: (offset: number, limit: number) => Promise<{ data: T[]; count: number }>,
    pageSize: number = 100,
    maxPages: number = 10
  ): Promise<T[]> {
    const timer = performanceMonitor.startTimer(`${operation}_paginated`);
    const results: T[] = [];
    
    try {
      for (let page = 0; page < maxPages; page++) {
        const offset = page * pageSize;
        const { data, count } = await queryBuilder(offset, pageSize);
        
        results.push(...data);
        
        // Stop if we've got all data or reached the page limit
        if (data.length < pageSize || results.length >= count) {
          break;
        }
      }
      
      timer(true, false, results.length);
      return results;
    } catch (error) {
      timer(false);
      throw error;
    }
  }
}

// ============================================================================
// DATABASE PERFORMANCE UTILITIES
// ============================================================================

export class DatabasePerformanceUtils {
  
  /**
   * Check materialized view freshness
   */
  static async checkViewFreshness(viewName: string): Promise<{
    lastRefresh: Date | null;
    isStale: boolean;
    stalenessMinutes: number;
  }> {
    try {
      const { data, error } = await supabase
        .rpc('get_materialized_view_stats', { view_name: viewName });

      if (error) throw error;

      const lastRefresh = data?.last_refresh ? new Date(data.last_refresh) : null;
      const now = new Date();
      const stalenessMinutes = lastRefresh 
        ? (now.getTime() - lastRefresh.getTime()) / (1000 * 60)
        : Infinity;
      
      return {
        lastRefresh,
        isStale: stalenessMinutes > 30, // Consider stale after 30 minutes
        stalenessMinutes
      };
    } catch (error) {
      console.error('Error checking view freshness:', error);
      return {
        lastRefresh: null,
        isStale: true,
        stalenessMinutes: Infinity
      };
    }
  }

  /**
   * Refresh materialized views if needed
   */
  static async refreshViewsIfNeeded(viewNames: string[]): Promise<{
    refreshed: string[];
    skipped: string[];
    errors: Array<{ view: string; error: string }>;
  }> {
    const refreshed: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ view: string; error: string }> = [];

    for (const viewName of viewNames) {
      try {
        const freshness = await this.checkViewFreshness(viewName);
        
        if (freshness.isStale) {
          const { error } = await supabase.rpc('refresh_materialized_view', {
            view_name: viewName
          });
          
          if (error) {
            errors.push({ view: viewName, error: error.message });
          } else {
            refreshed.push(viewName);
            // Invalidate related cache entries
            analyticsCache.invalidate(viewName);
          }
        } else {
          skipped.push(viewName);
        }
      } catch (error: any) {
        errors.push({ view: viewName, error: error.message });
      }
    }

    return { refreshed, skipped, errors };
  }

  /**
   * Get database performance statistics
   */
  static async getDatabaseStats(): Promise<{
    connectionCount: number;
    slowQueries: number;
    cacheHitRatio: number;
    avgQueryTime: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_database_performance_stats');
      
      if (error) throw error;
      
      return {
        connectionCount: data?.connection_count || 0,
        slowQueries: data?.slow_queries || 0,
        cacheHitRatio: data?.cache_hit_ratio || 0,
        avgQueryTime: data?.avg_query_time || 0
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        connectionCount: 0,
        slowQueries: 0,
        cacheHitRatio: 0,
        avgQueryTime: 0
      };
    }
  }
}

// ============================================================================
// COMPONENT PERFORMANCE UTILITIES
// ============================================================================

export class ComponentPerformanceUtils {
  
  /**
   * Debounce function for expensive operations
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function for frequent operations
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Memoize expensive calculations
   */
  static memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func(...args);
      cache.set(key, result);
      
      return result;
    }) as T;
  }

  /**
   * Lazy load data with intersection observer
   */
  static createLazyLoader(
    callback: () => void,
    options: IntersectionObserverInit = {}
  ): (element: Element | null) => void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback();
          observer.unobserve(entry.target);
        }
      });
    }, options);

    return (element: Element | null) => {
      if (element) {
        observer.observe(element);
      }
    };
  }
}

// ============================================================================
// PERFORMANCE MONITORING HOOKS
// ============================================================================

export const usePerformanceMonitoring = () => {
  const trackOperation = (operation: string) => {
    return performanceMonitor.startTimer(operation);
  };

  const getPerformanceStats = (operation?: string) => {
    return performanceMonitor.getAveragePerformance(operation || 'default');
  };

  const getSlowestOperations = (limit?: number) => {
    return performanceMonitor.getSlowestOperations(limit);
  };

  return {
    trackOperation,
    getPerformanceStats,
    getSlowestOperations
  };
};

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export {
  AnalyticsCache,
  PerformanceMonitor,
  QueryOptimizer,
  DatabasePerformanceUtils,
  ComponentPerformanceUtils
};
