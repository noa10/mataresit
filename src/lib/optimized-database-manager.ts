/**
 * Optimized Database Query Manager
 * High-performance database operations with query optimization, connection pooling, and intelligent caching
 */

import { supabase } from './supabase';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';

// Query optimization configuration
interface QueryOptimizationConfig {
  maxQueryTime: number;
  batchSize: number;
  indexHints: string[];
  queryPlan: boolean;
  parallelQueries: boolean;
}

// Database connection configuration
interface DatabaseConnection {
  id: string;
  client: any;
  created: number;
  lastUsed: number;
  queryCount: number;
  inUse: boolean;
  healthy: boolean;
}

// Query performance metrics
interface QueryMetrics {
  queryTime: number;
  rowsReturned: number;
  indexesUsed: string[];
  planCost: number;
  cacheHit: boolean;
  timestamp: number;
}

class OptimizedDatabaseManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private queryMetrics: QueryMetrics[] = [];
  
  private readonly config: QueryOptimizationConfig = {
    maxQueryTime: 8000, // 8 seconds max
    batchSize: 50,
    indexHints: ['idx_receipts_user_date', 'idx_receipts_embedding', 'idx_line_items_embedding'],
    queryPlan: true,
    parallelQueries: true
  };

  private readonly maxConnections = 5;
  private readonly connectionTTL = 300000; // 5 minutes
  private readonly queryCacheTTL = 60000; // 1 minute

  constructor() {
    this.initializeConnections();
    this.startMaintenanceTasks();
  }

  /**
   * Initialize database connections
   */
  private async initializeConnections(): Promise<void> {
    for (let i = 0; i < 3; i++) { // Start with 3 connections
      await this.createConnection(`init_${i}`);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(connectionId: string): Promise<DatabaseConnection> {
    try {
      const connection: DatabaseConnection = {
        id: connectionId,
        client: supabase,
        created: Date.now(),
        lastUsed: Date.now(),
        queryCount: 0,
        inUse: false,
        healthy: true
      };

      // Test connection health
      const { error } = await connection.client.from('receipts').select('id').limit(1);
      if (error) {
        console.warn(`Connection ${connectionId} health check failed:`, error);
        connection.healthy = false;
      }

      this.connections.set(connectionId, connection);
      console.log(`📊 Created database connection ${connectionId}`);
      
      return connection;
    } catch (error) {
      console.error(`Failed to create connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Get an available healthy connection
   */
  private async getConnection(): Promise<DatabaseConnection> {
    // Find available healthy connection
    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.healthy) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection;
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.maxConnections) {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const connection = await this.createConnection(connectionId);
      connection.inUse = true;
      return connection;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database connection timeout'));
      }, 5000);

      const checkConnection = () => {
        for (const connection of this.connections.values()) {
          if (!connection.inUse && connection.healthy) {
            clearTimeout(timeout);
            connection.inUse = true;
            connection.lastUsed = Date.now();
            resolve(connection);
            return;
          }
        }
        setTimeout(checkConnection, 100);
      };

      checkConnection();
    });
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(connection: DatabaseConnection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    connection.queryCount++;
  }

  /**
   * Execute optimized hybrid search
   */
  async executeOptimizedHybridSearch(
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();
    let connection: DatabaseConnection | null = null;

    try {
      // Check query cache first
      const cacheKey = this.generateQueryCacheKey(params, userId);
      const cached = this.queryCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log(`🎯 Database query cache hit for: "${params.query}"`);
        return cached.result;
      }

      // Get database connection
      connection = await this.getConnection();

      // Execute optimized query based on query type
      const result = await this.executeOptimizedQuery(connection, params, userId);

      // Cache successful results
      if (result.success && result.results.length > 0) {
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          ttl: this.queryCacheTTL
        });
      }

      // Record metrics
      this.recordQueryMetrics({
        queryTime: performance.now() - startTime,
        rowsReturned: result.totalResults,
        indexesUsed: [], // Would be populated by query plan analysis
        planCost: 0,
        cacheHit: false,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      console.error('Optimized database query failed:', error);
      throw error;
    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute optimized query based on parameters
   */
  private async executeOptimizedQuery(
    connection: DatabaseConnection,
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {
    
    // Determine optimal query strategy
    const strategy = this.determineQueryStrategy(params);
    
    switch (strategy) {
      case 'semantic_only':
        return this.executeSemanticSearch(connection, params, userId);
      case 'keyword_only':
        return this.executeKeywordSearch(connection, params, userId);
      case 'hybrid':
        return this.executeHybridSearch(connection, params, userId);
      case 'filtered':
        return this.executeFilteredSearch(connection, params, userId);
      default:
        return this.executeHybridSearch(connection, params, userId);
    }
  }

  /**
   * Determine optimal query strategy based on parameters
   */
  private determineQueryStrategy(params: UnifiedSearchParams): string {
    const query = params.query.toLowerCase().trim();
    
    // If query is very short, use keyword search
    if (query.length < 5) {
      return 'keyword_only';
    }

    // If query has specific filters, use filtered search
    if (params.filters && (
      params.filters.dateRange ||
      params.filters.amountRange ||
      params.filters.merchants?.length ||
      params.filters.categories?.length
    )) {
      return 'filtered';
    }

    // If query looks like a product name, use semantic search
    if (this.isProductQuery(query)) {
      return 'semantic_only';
    }

    // Default to hybrid search
    return 'hybrid';
  }

  /**
   * Check if query is likely a product search
   */
  private isProductQuery(query: string): boolean {
    const productIndicators = [
      'coffee', 'tea', 'food', 'drink', 'meal', 'snack',
      'bread', 'rice', 'noodles', 'chicken', 'beef', 'fish'
    ];
    
    return productIndicators.some(indicator => query.includes(indicator));
  }

  /**
   * Execute semantic-only search
   */
  private async executeSemanticSearch(
    connection: DatabaseConnection,
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {

    // Create AbortController for timeout (replaces deprecated .timeout() method)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.maxQueryTime);

    try {
      const { data, error } = await connection.client
        .rpc('semantic_search_optimized', {
          query_text: params.query,
          user_filter: userId,
          similarity_threshold: params.similarityThreshold || 0.3,
          match_count: params.limit || 20,
          source_types: params.sources
        }, {
          signal: abortController.signal
        });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(`Semantic search failed: ${error.message}`);
      }

      return this.formatSearchResults(data || [], params);
    } catch (queryError) {
      clearTimeout(timeoutId);

      if (queryError.name === 'AbortError') {
        throw new Error(`Semantic search timed out after ${this.config.maxQueryTime}ms`);
      }

      throw queryError;
    }
  }

  /**
   * Execute keyword-only search
   */
  private async executeKeywordSearch(
    connection: DatabaseConnection,
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {

    // Create AbortController for timeout (replaces deprecated .timeout() method)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.maxQueryTime);

    try {
      const { data, error } = await connection.client
        .rpc('keyword_search_optimized', {
          query_text: params.query,
          user_filter: userId,
          match_count: params.limit || 20,
          source_types: params.sources
        }, {
          signal: abortController.signal
        });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(`Keyword search failed: ${error.message}`);
      }

      return this.formatSearchResults(data || [], params);
    } catch (queryError) {
      clearTimeout(timeoutId);

      if (queryError.name === 'AbortError') {
        throw new Error(`Keyword search timed out after ${this.config.maxQueryTime}ms`);
      }

      throw queryError;
    }
  }

  /**
   * Execute hybrid search
   */
  private async executeHybridSearch(
    connection: DatabaseConnection,
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {

    // Create AbortController for timeout (replaces deprecated .timeout() method)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.maxQueryTime);

    try {
      const { data, error } = await connection.client
        .rpc('hybrid_search_optimized', {
          query_text: params.query,
          user_filter: userId,
          similarity_threshold: params.similarityThreshold || 0.3,
          semantic_weight: 0.6,
          keyword_weight: 0.4,
          match_count: params.limit || 20,
          source_types: params.sources
        }, {
          signal: abortController.signal
        });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(`Hybrid search failed: ${error.message}`);
      }

      return this.formatSearchResults(data || [], params);
    } catch (queryError) {
      clearTimeout(timeoutId);

      if (queryError.name === 'AbortError') {
        throw new Error(`Hybrid search timed out after ${this.config.maxQueryTime}ms`);
      }

      throw queryError;
    }
  }

  /**
   * Execute filtered search
   */
  private async executeFilteredSearch(
    connection: DatabaseConnection,
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse> {

    const filters = params.filters || {};

    // Create AbortController for timeout (replaces deprecated .timeout() method)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.maxQueryTime);

    try {
      const { data, error } = await connection.client
        .rpc('filtered_search_optimized', {
          query_text: params.query,
          user_filter: userId,
          date_start: filters.dateRange?.start,
          date_end: filters.dateRange?.end,
          amount_min: filters.amountRange?.min,
          amount_max: filters.amountRange?.max,
          merchants: filters.merchants,
          categories: filters.categories,
          similarity_threshold: params.similarityThreshold || 0.3,
          match_count: params.limit || 20,
          source_types: params.sources
        }, {
          signal: abortController.signal
        });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(`Filtered search failed: ${error.message}`);
      }

      return this.formatSearchResults(data || [], params);
    } catch (queryError) {
      clearTimeout(timeoutId);

      if (queryError.name === 'AbortError') {
        throw new Error(`Filtered search timed out after ${this.config.maxQueryTime}ms`);
      }

      throw queryError;
    }
  }

  /**
   * Format search results into unified response
   */
  private formatSearchResults(data: any[], params: UnifiedSearchParams): UnifiedSearchResponse {
    const results = data.map(item => ({
      id: item.id,
      type: item.source_type || 'receipt',
      title: item.title || item.merchant_name || 'Untitled',
      content: item.content || item.description || '',
      similarity: item.similarity_score || item.score || 0,
      metadata: {
        source: item.source_type || 'receipt',
        date: item.date,
        amount: item.amount,
        currency: item.currency || 'MYR',
        merchant: item.merchant_name,
        category: item.category
      }
    }));

    return {
      success: true,
      results,
      totalResults: results.length,
      pagination: {
        hasMore: results.length >= (params.limit || 20),
        nextOffset: (params.offset || 0) + results.length,
        totalPages: Math.ceil(results.length / (params.limit || 20))
      },
      searchMetadata: {
        queryTime: 0, // Will be set by caller
        sourcesSearched: params.sources || ['receipts'],
        fallbackUsed: false,
        searchMethod: 'optimized_database'
      }
    };
  }

  /**
   * Generate cache key for query
   */
  private generateQueryCacheKey(params: UnifiedSearchParams, userId: string): string {
    const key = {
      query: params.query.toLowerCase().trim(),
      sources: params.sources?.sort(),
      filters: params.filters,
      limit: params.limit,
      userId
    };
    
    return btoa(JSON.stringify(key)).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Record query performance metrics
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    // Log slow queries
    if (metrics.queryTime > 2000) {
      console.warn(`🐌 Slow database query: ${metrics.queryTime.toFixed(2)}ms`);
    }
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Clean up connections every 5 minutes
    setInterval(() => {
      this.cleanupConnections();
    }, 300000);

    // Clean up query cache every minute
    setInterval(() => {
      this.cleanupQueryCache();
    }, 60000);
  }

  /**
   * Clean up old connections
   */
  private cleanupConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse && (now - connection.lastUsed) > this.connectionTTL) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      this.connections.delete(id);
      console.log(`🗑️ Cleaned up database connection ${id}`);
    });
  }

  /**
   * Clean up expired query cache
   */
  private cleanupQueryCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.queryCache.delete(key));
  }

  /**
   * Get database performance statistics
   */
  getPerformanceStats(): {
    averageQueryTime: number;
    queryCacheHitRate: number;
    activeConnections: number;
    totalConnections: number;
    queryDistribution: Record<string, number>;
  } {
    const metrics = this.queryMetrics;
    const avgQueryTime = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.queryTime, 0) / metrics.length
      : 0;

    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cacheHitRate = metrics.length > 0 ? (cacheHits / metrics.length) * 100 : 0;

    const activeConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;

    return {
      averageQueryTime: avgQueryTime,
      queryCacheHitRate: cacheHitRate,
      activeConnections,
      totalConnections: this.connections.size,
      queryDistribution: {} // Would track query types
    };
  }

  /**
   * Clear all caches and reset connections
   */
  cleanup(): void {
    this.queryCache.clear();
    this.connections.clear();
    this.queryMetrics = [];
  }
}

// Export singleton instance
export const optimizedDatabaseManager = new OptimizedDatabaseManager();
export type { QueryMetrics };
