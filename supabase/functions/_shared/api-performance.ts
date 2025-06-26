/**
 * API Performance Optimization and Caching
 * Provides caching, query optimization, and performance monitoring
 */

import type { ApiContext } from './api-auth.ts';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  key: string;
  tags?: string[];
}

export interface PerformanceMetrics {
  requestId: string;
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  cacheHit?: boolean;
  dbQueries?: number;
  dbQueryTime?: number;
  memoryUsage?: number;
}

export interface QueryOptimization {
  useIndex?: boolean;
  selectFields?: string[];
  batchSize?: number;
  prefetchRelations?: boolean;
}

/**
 * Simple in-memory cache for API responses
 * In production, you'd use Redis or similar
 */
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number; tags: string[] }>();
  private maxSize = 1000; // Maximum cache entries

  set(key: string, data: any, ttl: number, tags: string[] = []): void {
    // Clean up expired entries if cache is getting full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { data, expires, tags });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Global cache instance
const apiCache = new MemoryCache();

/**
 * Caches API responses with automatic invalidation
 */
export async function withCache<T>(
  config: CacheConfig,
  fetchFn: () => Promise<T>,
  context?: ApiContext
): Promise<T> {
  // Check cache first
  const cached = apiCache.get(config.key);
  if (cached !== null) {
    // Record cache hit
    if (context) {
      recordCacheHit(config.key, context);
    }
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();
  
  // Cache the result
  apiCache.set(config.key, data, config.ttl, config.tags || []);
  
  // Record cache miss
  if (context) {
    recordCacheMiss(config.key, context);
  }

  return data;
}

/**
 * Generates cache keys for different API operations
 */
export const CacheKeys = {
  userProfile: (userId: string) => `profile:${userId}`,
  userTeams: (userId: string) => `teams:${userId}`,
  teamMembers: (teamId: string) => `team_members:${teamId}`,
  teamStats: (teamId: string) => `team_stats:${teamId}`,
  receiptsList: (userId: string, filters: string) => `receipts:${userId}:${filters}`,
  claimsList: (userId: string, filters: string) => `claims:${userId}:${filters}`,
  analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
  searchResults: (userId: string, query: string) => `search:${userId}:${btoa(query)}`,
  apiUsageStats: (userId: string) => `api_usage:${userId}`
};

/**
 * Cache invalidation tags for different data types
 */
export const CacheTags = {
  user: (userId: string) => `user:${userId}`,
  team: (teamId: string) => `team:${teamId}`,
  receipts: (userId: string) => `receipts:${userId}`,
  claims: (userId: string) => `claims:${userId}`,
  analytics: (userId: string) => `analytics:${userId}`,
  search: (userId: string) => `search:${userId}`
};

/**
 * Invalidates cache entries when data changes
 */
export function invalidateCache(tags: string[]): void {
  for (const tag of tags) {
    apiCache.invalidateByTag(tag);
  }
}

/**
 * Optimizes database queries for better performance
 */
export function optimizeQuery(
  baseQuery: any,
  optimization: QueryOptimization
): any {
  let query = baseQuery;

  // Select only needed fields
  if (optimization.selectFields && optimization.selectFields.length > 0) {
    query = query.select(optimization.selectFields.join(', '));
  }

  // Use appropriate batch size for pagination
  if (optimization.batchSize) {
    // This would be applied in the calling function
  }

  return query;
}

/**
 * Performance monitoring for API requests
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;

  constructor(endpoint: string, method: string) {
    this.metrics = {
      requestId: crypto.randomUUID(),
      endpoint,
      method,
      startTime: Date.now(),
      dbQueries: 0,
      dbQueryTime: 0
    };
  }

  recordDbQuery(duration: number): void {
    this.metrics.dbQueries = (this.metrics.dbQueries || 0) + 1;
    this.metrics.dbQueryTime = (this.metrics.dbQueryTime || 0) + duration;
  }

  recordCacheHit(): void {
    this.metrics.cacheHit = true;
  }

  recordMemoryUsage(): void {
    // In Deno, memory usage monitoring is limited
    // In production, you might use external monitoring
    this.metrics.memoryUsage = 0;
  }

  finish(): PerformanceMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    return this.metrics;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}

/**
 * Wraps API functions with performance monitoring
 */
export function withPerformanceMonitoring<T extends any[], R>(
  endpoint: string,
  method: string,
  fn: (monitor: PerformanceMonitor, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const monitor = new PerformanceMonitor(endpoint, method);
    
    try {
      const result = await fn(monitor, ...args);
      return result;
    } finally {
      const metrics = monitor.finish();
      logPerformanceMetrics(metrics);
    }
  };
}

/**
 * Batch processing for multiple operations
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches to prevent overwhelming the system
    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Database connection pooling and query optimization
 */
export class QueryOptimizer {
  private queryCache = new Map<string, any>();
  
  /**
   * Optimizes repeated queries by caching prepared statements
   */
  async optimizeQuery(
    supabase: any,
    queryKey: string,
    queryBuilder: () => any,
    ttl: number = 300
  ): Promise<any> {
    const cached = this.queryCache.get(queryKey);
    if (cached && Date.now() < cached.expires) {
      return cached.query;
    }
    
    const query = queryBuilder();
    this.queryCache.set(queryKey, {
      query,
      expires: Date.now() + (ttl * 1000)
    });
    
    return query;
  }

  /**
   * Batches multiple database operations
   */
  async batchQueries(operations: Array<() => Promise<any>>): Promise<any[]> {
    return Promise.all(operations.map(op => op()));
  }

  /**
   * Implements query result pagination with cursor-based approach
   */
  async paginateQuery(
    baseQuery: any,
    cursor?: string,
    limit: number = 50
  ): Promise<{ data: any[]; nextCursor?: string; hasMore: boolean }> {
    let query = baseQuery.limit(limit + 1); // Fetch one extra to check if there are more
    
    if (cursor) {
      query = query.gt('created_at', cursor);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const hasMore = data.length > limit;
    const results = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore ? results[results.length - 1].created_at : undefined;
    
    return {
      data: results,
      nextCursor,
      hasMore
    };
  }
}

/**
 * Response compression for large payloads
 */
export function compressResponse(data: any): string {
  // Simple JSON compression - in production you might use gzip
  return JSON.stringify(data, null, 0);
}

/**
 * Logs performance metrics for monitoring
 */
function logPerformanceMetrics(metrics: PerformanceMetrics): void {
  console.log('API Performance:', {
    requestId: metrics.requestId,
    endpoint: metrics.endpoint,
    method: metrics.method,
    duration: metrics.duration,
    cacheHit: metrics.cacheHit,
    dbQueries: metrics.dbQueries,
    dbQueryTime: metrics.dbQueryTime,
    timestamp: new Date().toISOString()
  });

  // In production, send to monitoring service
  // await sendToMonitoringService(metrics);
}

/**
 * Records cache hit for analytics
 */
function recordCacheHit(key: string, context: ApiContext): void {
  console.log('Cache Hit:', {
    key,
    userId: context.userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Records cache miss for analytics
 */
function recordCacheMiss(key: string, context: ApiContext): void {
  console.log('Cache Miss:', {
    key,
    userId: context.userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): any {
  return {
    ...apiCache.getStats(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Clears all cached data
 */
export function clearCache(): void {
  apiCache.clear();
}

/**
 * Health check for performance monitoring
 */
export function getPerformanceHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: any;
} {
  const cacheStats = getCacheStats();
  
  // Simple health check based on cache usage
  const cacheUsagePercent = (cacheStats.size / cacheStats.maxSize) * 100;
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (cacheUsagePercent > 90) {
    status = 'unhealthy';
  } else if (cacheUsagePercent > 75) {
    status = 'degraded';
  }
  
  return {
    status,
    metrics: {
      cache: cacheStats,
      memory: {
        // Deno memory info is limited
        available: true
      },
      timestamp: new Date().toISOString()
    }
  };
}
