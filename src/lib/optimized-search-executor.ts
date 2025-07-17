/**
 * Optimized Search Execution Engine
 * High-performance search execution with connection pooling, parallel processing, and intelligent caching
 */

import { UnifiedSearchParams, UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';
import { callEdgeFunction } from './edge-function-utils';
import { searchCache } from './searchCache';
import { supabase } from './supabase';

/**
 * Map frontend source names (plural) to backend source names (singular)
 */
function mapFrontendSourcesToBackend(frontendSources: string[]): string[] {
  const sourceMapping: Record<string, string> = {
    'receipts': 'receipt',
    'claims': 'claim',
    'team_members': 'team_member',
    'custom_categories': 'custom_category',
    'business_directory': 'business_directory', // Same
    'conversations': 'conversation'
  };

  return frontendSources.map(source => sourceMapping[source] || source);
}

/**
 * Create a timeout promise that rejects after specified time
 */
function createTimeoutPromise(timeoutMs: number, strategy: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${strategy} search timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

// Performance monitoring
interface SearchExecutionMetrics {
  totalTime: number;
  edgeFunctionTime: number;
  databaseTime: number;
  cacheTime: number;
  fallbackTime: number;
  parallelExecutions: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
  searchStrategy: string;
  timestamp: number;
}

// Search strategy configuration
interface SearchStrategy {
  name: string;
  priority: number;
  timeout: number;
  retries: number;
  fallbackEnabled: boolean;
  parallelEnabled: boolean;
}

// Connection pool configuration
interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
}

class OptimizedSearchExecutor {
  private connectionPool: Map<string, any> = new Map();
  private activeConnections = 0;
  private readonly maxConnections = 10;
  private readonly connectionTimeout = 5000; // 5 seconds
  private readonly idleTimeout = 30000; // 30 seconds
  
  // Search strategies ordered by priority
  private readonly searchStrategies: SearchStrategy[] = [
    {
      name: 'unified_edge_function',
      priority: 1,
      timeout: 15000, // Reduced from 90s to 15s
      retries: 1,
      fallbackEnabled: true,
      parallelEnabled: true
    },
    {
      name: 'direct_database',
      priority: 2,
      timeout: 10000, // 10 seconds
      retries: 2,
      fallbackEnabled: true,
      parallelEnabled: true
    },
    {
      name: 'cached_fallback',
      priority: 3,
      timeout: 5000, // 5 seconds
      retries: 0,
      fallbackEnabled: false,
      parallelEnabled: false
    }
  ];

  private performanceHistory: SearchExecutionMetrics[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    this.initializeConnectionPool();
    this.startConnectionCleanup();
  }

  /**
   * Initialize connection pool
   */
  private initializeConnectionPool(): void {
    // Pre-warm connection pool with a few connections
    for (let i = 0; i < 3; i++) {
      this.createConnection(`warmup_${i}`);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(connectionId: string): Promise<any> {
    try {
      const connection = {
        id: connectionId,
        client: supabase,
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: false
      };

      this.connectionPool.set(connectionId, connection);
      this.activeConnections++;

      console.log(`🔗 Created connection ${connectionId} (${this.activeConnections}/${this.maxConnections})`);
      return connection;
    } catch (error) {
      console.error(`Failed to create connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Get an available connection from the pool
   */
  private async getConnection(): Promise<any> {
    // Find an available connection
    for (const [id, connection] of this.connectionPool.entries()) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection;
      }
    }

    // Create new connection if under limit
    if (this.activeConnections < this.maxConnections) {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const connection = await this.createConnection(connectionId);
      connection.inUse = true;
      return connection;
    }

    // Wait for an available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.connectionTimeout);

      const checkForConnection = () => {
        for (const [id, connection] of this.connectionPool.entries()) {
          if (!connection.inUse) {
            clearTimeout(timeout);
            connection.inUse = true;
            connection.lastUsed = Date.now();
            resolve(connection);
            return;
          }
        }
        setTimeout(checkForConnection, 100); // Check again in 100ms
      };

      checkForConnection();
    });
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(connection: any): void {
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Start periodic connection cleanup
   */
  private startConnectionCleanup(): void {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Clean every minute
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connectionPool.entries()) {
      if (!connection.inUse && (now - connection.lastUsed) > this.idleTimeout) {
        connectionsToRemove.push(id);
      }
    }

    connectionsToRemove.forEach(id => {
      this.connectionPool.delete(id);
      this.activeConnections--;
      console.log(`🗑️ Cleaned up idle connection ${id}`);
    });
  }

  /**
   * Execute optimized search with parallel strategies
   */
  async executeSearch(params: UnifiedSearchParams, userId: string): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();
    const metrics: Partial<SearchExecutionMetrics> = {
      timestamp: Date.now(),
      parallelExecutions: 0,
      cacheHit: false,
      fallbackUsed: false
    };

    try {
      // Check cache first
      const cacheStartTime = performance.now();
      const cachedResult = await searchCache.get(params, userId);
      metrics.cacheTime = performance.now() - cacheStartTime;

      if (cachedResult) {
        metrics.cacheHit = true;
        metrics.totalTime = performance.now() - startTime;
        metrics.searchStrategy = 'cache';
        this.recordMetrics(metrics as SearchExecutionMetrics);
        
        console.log(`🎯 Cache hit for search: "${params.query}" (${metrics.totalTime.toFixed(2)}ms)`);
        return cachedResult;
      }

      // Execute parallel search strategies
      const result = await this.executeParallelSearch(params, userId, metrics);
      
      // 🚀 PERFORMANCE: Cache successful results asynchronously to avoid blocking
      if (result.success && result.results.length > 0) {
        // Don't await - cache in background
        searchCache.set(params, userId, result).catch(error => {
          console.warn('Background cache set failed:', error);
        });
      }

      metrics.totalTime = performance.now() - startTime;
      this.recordMetrics(metrics as SearchExecutionMetrics);

      return result;

    } catch (error) {
      console.error('❌ Search execution failed, attempting emergency fallback:', error);

      // Emergency fallback: try to get any cached results or recent data
      try {
        const emergencyResults = await this.executeEmergencyFallback(params, userId);
        if (emergencyResults) {
          console.log('✅ Emergency fallback succeeded');

          metrics.totalTime = performance.now() - startTime;
          metrics.fallbackUsed = true;
          metrics.searchStrategy = 'emergency_fallback';
          this.recordMetrics(metrics as SearchExecutionMetrics);

          return {
            ...emergencyResults,
            searchMetadata: {
              ...emergencyResults.searchMetadata,
              fallbacksUsed: ['emergency_fallback']
            }
          };
        }
      } catch (fallbackError) {
        console.error('❌ Emergency fallback also failed:', fallbackError);
      }

      // Final error response with helpful information
      const errorResult: UnifiedSearchResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Search execution failed',
        results: [],
        totalResults: 0,
        pagination: {
          hasMore: false,
          nextOffset: 0,
          totalPages: 0
        },
        searchMetadata: {
          searchDuration: performance.now() - startTime,
          sourcesSearched: params.sources || ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: ['error_fallback']
        }
      };

      metrics.totalTime = performance.now() - startTime;
      metrics.fallbackUsed = true;
      metrics.searchStrategy = 'error_fallback';
      this.recordMetrics(metrics as SearchExecutionMetrics);

      return errorResult;
    }
  }

  /**
   * Execute search strategies in parallel with intelligent fallback and performance optimization
   */
  private async executeParallelSearch(
    params: UnifiedSearchParams,
    userId: string,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<UnifiedSearchResponse> {

    // 🚀 PERFORMANCE: Quick query optimization
    const optimizedParams = this.optimizeSearchParams(params);

    // 🔧 TEMPORAL FIX: For temporal queries with date filters, use direct database search
    // Enhanced regex to include "last X days/hours/minutes" patterns and singular forms
    const isTemporalQuery = /\b(yesterday|today|tomorrow|last\s+week|this\s+week|next\s+week|last\s+month|this\s+month|next\s+month|last\s+(hour|minute)|last\s+\d+\s+(days?|hours?|minutes?|weeks?|months?)|past\s+\d+\s+(days?|hours?|minutes?|weeks?|months?))\b/i.test(params.query);

    if (isTemporalQuery && params.filters?.dateRange) {
      console.log('🔍 DEBUG: Temporal query detected, using direct database search for reliability');
      return await this.executeTemporalDatabaseSearch(optimizedParams, userId, metrics);
    }

    // 🔍 DEBUG: Force Edge Function for debugging enhanced response
    console.log('🔍 DEBUG: Forcing Edge Function path for all queries to get enhanced response');
    try {
      const edgeFunctionResult = await this.executeEdgeFunctionSearch(optimizedParams, metrics);
      if (edgeFunctionResult && edgeFunctionResult.success) {
        console.log('✅ DEBUG: Edge Function succeeded, returning enhanced response');
        metrics.searchStrategy = 'edge_function_forced';
        return edgeFunctionResult;
      } else {
        console.log('❌ DEBUG: Edge Function failed, falling back to parallel execution');
      }
    } catch (error) {
      console.log('❌ DEBUG: Edge Function error, falling back to parallel execution:', error);
    }

    // 🚀 PERFORMANCE: Create timeout promises for each strategy
    // 🔧 TEMPORAL FIX: Increase timeout for temporal queries that need more processing time
    const EDGE_FUNCTION_TIMEOUT = isTemporalQuery ? 15000 : 8000; // 15 seconds for temporal, 8 for others
    const DATABASE_TIMEOUT = 6000; // 6 seconds

    // Strategy 1: Optimized Edge Function Call with timeout
    const edgeFunctionPromise = Promise.race([
      this.executeEdgeFunctionSearch(optimizedParams, metrics),
      createTimeoutPromise(EDGE_FUNCTION_TIMEOUT, 'edge_function')
    ]);

    // Strategy 2: Direct Database Search with timeout
    const directDatabasePromise = Promise.race([
      this.executeDirectDatabaseSearch(optimizedParams, userId, metrics),
      createTimeoutPromise(DATABASE_TIMEOUT, 'direct_database')
    ]);

    // 🚀 PERFORMANCE: Use Promise.allSettled with early resolution
    const racePromise = Promise.race([
      edgeFunctionPromise.then(result => ({ strategy: 'edge_function', result })),
      directDatabasePromise.then(result => ({ strategy: 'direct_database', result }))
    ]);

    // 🚀 PERFORMANCE: Try to get the fastest successful result first
    try {
      const fastestResult = await Promise.race([
        racePromise,
        new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second race timeout
      ]) as { strategy: string; result: UnifiedSearchResponse } | null;

      if (fastestResult && fastestResult.result.success) {
        metrics.searchStrategy = fastestResult.strategy;
        metrics.parallelExecutions = 1; // Only one strategy needed
        console.log(`⚡ Fast search succeeded with strategy: ${fastestResult.strategy}`);
        return fastestResult.result;
      }
    } catch (error) {
      console.warn('Fast search failed, falling back to full parallel execution:', error);
    }

    // 🚀 PERFORMANCE: If fast search didn't work, wait for all strategies
    const results = await Promise.allSettled([
      edgeFunctionPromise,
      directDatabasePromise
    ]);

    metrics.parallelExecutions = results.length;

    // Process results in priority order
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === 'fulfilled' && result.value.success) {
        const strategy = i === 0 ? 'edge_function' : 'direct_database';
        metrics.searchStrategy = strategy;

        console.log(`✅ Search succeeded with strategy: ${strategy}`);
        return result.value;
      }
    }

    // All parallel strategies failed, try cached fallback
    console.warn('All parallel strategies failed, trying cached fallback');
    metrics.fallbackUsed = true;

    return this.executeCachedFallback(optimizedParams, userId, metrics);
  }

  /**
   * Optimize search parameters for better performance
   */
  private optimizeSearchParams(params: UnifiedSearchParams): UnifiedSearchParams {
    // 🚀 PERFORMANCE: Optimize query string
    const optimizedQuery = params.query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 200); // Limit query length

    // 🚀 PERFORMANCE: Optimize limits for faster response
    const optimizedLimit = Math.min(params.limit || 20, 50); // Cap at 50 for performance

    // 🚀 PERFORMANCE: Optimize similarity threshold for better results
    const optimizedThreshold = params.similarityThreshold || 0.2;

    return {
      ...params,
      query: optimizedQuery,
      limit: optimizedLimit,
      similarityThreshold: optimizedThreshold,
      // 🚀 PERFORMANCE: Ensure sources are optimized
      sources: params.sources || ['receipt']
    };
  }

  /**
   * Execute optimized edge function search with retry logic
   */
  private async executeEdgeFunctionSearch(
    params: UnifiedSearchParams,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();
    const maxRetries = 2;
    let lastError: Error | null = null;

    // 🔧 TEMPORAL FIX: Add retry logic for temporal queries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 DEBUG: Edge function search attempt ${attempt}/${maxRetries}`);

        // Map frontend source names to backend source names
        const mappedParams = {
          ...params,
          sources: params.sources ? mapFrontendSourcesToBackend(params.sources) : undefined
        };

      // 🚀 PERFORMANCE: Only log in development mode
      if (import.meta.env.DEV) {
        console.log('🔍 DEBUG: Edge function parameters:', {
          originalSources: params.sources,
          mappedSources: mappedParams.sources,
          query: params.query,
          limit: params.limit,
          similarityThreshold: params.similarityThreshold,
          filters: params.filters
        });
      }

      // Use optimized timeout and retry settings
      const response = await callEdgeFunction(
        'unified-search',
        'POST',
        mappedParams,
        undefined,
        1, // Only 1 retry for speed
        15000 // 15 second timeout instead of 90
      );

      metrics.edgeFunctionTime = performance.now() - startTime;

        if (response && response.success) {
          console.log(`✅ Edge function search completed successfully on attempt ${attempt}`);
          return response;
        } else {
          throw new Error(response?.error || 'Edge function returned unsuccessful response');
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Edge function search attempt ${attempt} failed:`, lastError.message);

        // If this is the last attempt, don't retry
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All attempts failed
    metrics.edgeFunctionTime = performance.now() - startTime;
    console.error('❌ All edge function search attempts failed:', lastError);
    throw lastError || new Error('Edge function search failed after all retries');
  }

  /**
   * Execute direct database search with connection pooling
   */
  private async executeDirectDatabaseSearch(
    params: UnifiedSearchParams,
    userId: string,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();
    let connection: any = null;

    try {
      // Get connection from pool
      connection = await this.getConnection();

      // Create AbortController for timeout (replaces deprecated .timeout() method)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 8000); // 8 second timeout for database

      let data: any, error: any;

      try {
        // Execute optimized database query with AbortSignal
        const result = await connection.client
          .rpc('enhanced_hybrid_search', {
            query_text: params.query,
            source_types: params.sources,
            similarity_threshold: params.similarityThreshold || 0.3,
            match_count: params.limit || 20,
            user_filter: userId,
            team_filter: params.filters?.teamId
          }, {
            signal: abortController.signal
          });

        data = result.data;
        error = result.error;

        // Clear timeout if query completes successfully
        clearTimeout(timeoutId);

        metrics.databaseTime = performance.now() - startTime;

        if (error) {
          throw new Error(`Database query failed: ${error.message}`);
        }
      } catch (queryError) {
        // Clear timeout on error
        clearTimeout(timeoutId);

        // Handle abort error specifically
        if (queryError.name === 'AbortError') {
          throw new Error('Database query timed out after 8 seconds');
        }

        // Re-throw other errors
        throw queryError;
      }

      // Convert database results to unified format
      const results: UnifiedSearchResult[] = (data || []).map((item: any) => ({
        id: item.id,
        type: item.source_type,
        title: item.title || item.merchant_name || 'Untitled',
        content: item.content || item.description || '',
        similarity: item.similarity_score || 0,
        metadata: {
          source: item.source_type,
          date: item.date,
          amount: item.amount,
          currency: item.currency || 'MYR'
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
          searchDuration: metrics.databaseTime || 0,
          sourcesSearched: params.sources || ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'direct_database'
        }
      };

    } catch (error) {
      metrics.databaseTime = performance.now() - startTime;
      console.warn('Direct database search failed:', error);
      throw error;
    } finally {
      // Always release connection back to pool
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  /**
   * Execute comprehensive fallback search with multiple strategies
   */
  private async executeCachedFallback(
    params: UnifiedSearchParams,
    userId: string,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();

    try {
      console.log('🔄 Executing comprehensive fallback search...');

      // Fallback Strategy 1: Similar cached results
      const similarResults = await this.findSimilarCachedResults(params, userId);
      if (similarResults) {
        metrics.fallbackTime = performance.now() - startTime;
        metrics.searchStrategy = 'cached_fallback';

        console.log('✅ Fallback succeeded with cached results');
        return {
          ...similarResults,
          searchMetadata: {
            ...similarResults.searchMetadata,
            fallbacksUsed: ['cached_results']
          }
        };
      }

      // Fallback Strategy 2: Basic database query (without embeddings)
      const basicResults = await this.executeBasicDatabaseFallback(params, userId);
      if (basicResults && basicResults.results.length > 0) {
        metrics.fallbackTime = performance.now() - startTime;
        metrics.searchStrategy = 'basic_database_fallback';

        console.log('✅ Fallback succeeded with basic database query');
        return {
          ...basicResults,
          searchMetadata: {
            ...basicResults.searchMetadata,
            fallbacksUsed: ['basic_database']
          }
        };
      }

      // Fallback Strategy 3: Recent results for user
      const recentResults = await this.getRecentResultsForUser(userId);
      if (recentResults && recentResults.results.length > 0) {
        metrics.fallbackTime = performance.now() - startTime;
        metrics.searchStrategy = 'recent_results_fallback';

        console.log('✅ Fallback succeeded with recent user results');
        return {
          ...recentResults,
          searchMetadata: {
            ...recentResults.searchMetadata,
            fallbacksUsed: ['recent_results'],

          }
        };
      }

      // Final fallback: Empty results with helpful message
      metrics.fallbackTime = performance.now() - startTime;
      metrics.searchStrategy = 'empty_fallback';

      console.warn('⚠️ All fallback strategies failed, returning empty results');
      return {
        success: true,
        results: [],
        totalResults: 0,
        pagination: {
          hasMore: false,
          nextOffset: 0,
          totalPages: 0
        },
        searchMetadata: {
          searchDuration: metrics.fallbackTime || 0,
          sourcesSearched: params.sources || ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: ['cached_results', 'basic_database', 'recent_results']
        }
      };

    } catch (error) {
      metrics.fallbackTime = performance.now() - startTime;
      console.error('❌ Fallback search failed:', error);

      // Return error fallback with empty results
      return {
        success: false,
        results: [],
        totalResults: 0,
        pagination: {
          hasMore: false,
          nextOffset: 0,
          totalPages: 0
        },
        searchMetadata: {
          searchDuration: metrics.fallbackTime || 0,
          sourcesSearched: params.sources || ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: ['error_fallback']
        },
        error: error instanceof Error ? error.message : 'Unknown fallback error'
      };
    }
  }

  /**
   * Find similar cached results for fallback
   */
  private async findSimilarCachedResults(
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse | null> {
    try {
      // Try to find cached results with similar queries
      const cachedResult = await searchCache.get(params, userId);

      if (cachedResult && cachedResult.results.length > 0) {
        console.log('🎯 Found similar cached results for fallback');
        return cachedResult;
      }

      // Try to find results with relaxed similarity threshold
      const relaxedParams = {
        ...params,
        similarityThreshold: Math.max(0.1, (params.similarityThreshold || 0.2) - 0.1)
      };

      const relaxedCached = await searchCache.get(relaxedParams, userId);
      if (relaxedCached && relaxedCached.results.length > 0) {
        console.log('🎯 Found cached results with relaxed similarity threshold');
        return relaxedCached;
      }

      return null;
    } catch (error) {
      console.warn('Error finding similar cached results:', error);
      return null;
    }
  }

  /**
   * Execute basic database fallback without embeddings
   */
  private async executeBasicDatabaseFallback(
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse | null> {
    try {
      console.log('🔄 Attempting basic database fallback...');

      // Get connection from pool
      const connection = await this.getConnection();

      try {
        // Execute simple text search without embeddings
        const { data, error } = await connection.client
          .from('receipts')
          .select(`
            id,
            merchant,
            total,
            currency,
            date,
            "fullText",
            created_at
          `)
          .eq('user_id', userId)
          .or(`merchant.ilike.%${params.query}%,"fullText".ilike.%${params.query}%`)
          .order('created_at', { ascending: false })
          .limit(params.limit || 10);

        if (error) {
          console.warn('Basic database fallback failed:', error);
          return null;
        }

        if (!data || data.length === 0) {
          return null;
        }

        // Convert to unified search results
        const results: UnifiedSearchResult[] = data.map((item: any) => ({
          id: item.id,
          sourceType: 'receipt' as const,
          sourceId: item.id,
          contentType: 'receipt',
          title: item.merchant || 'Unknown Merchant',
          description: `Receipt from ${item.merchant || 'Unknown'} - ${item.currency} ${item.total}`,
          similarity: 0.5, // Default similarity for text search
          metadata: {
            merchant: item.merchant,
            total: item.total,
            currency: item.currency,
            date: item.date,
            source: 'basic_database_fallback'
          },
          accessLevel: 'user' as const,
          createdAt: item.created_at,
          updatedAt: item.created_at
        }));

        return {
          success: true,
          results,
          totalResults: results.length,
          pagination: {
            hasMore: results.length >= (params.limit || 10),
            nextOffset: (params.offset || 0) + results.length,
            totalPages: 1
          },
          searchMetadata: {
            searchDuration: 0,
            sourcesSearched: ['receipt'],
            subscriptionLimitsApplied: false,
            fallbacksUsed: ['basic_database'],
            modelUsed: 'basic_text_search'
          }
        };

      } finally {
        this.releaseConnection(connection);
      }

    } catch (error) {
      console.warn('Basic database fallback error:', error);
      return null;
    }
  }

  /**
   * Get recent results for user as fallback
   */
  private async getRecentResultsForUser(userId: string): Promise<UnifiedSearchResponse | null> {
    try {
      console.log('🔄 Attempting recent results fallback...');

      // Get connection from pool
      const connection = await this.getConnection();

      try {
        // 🔧 TEMPORAL FIX: Get more recent receipts for temporal queries
        // Enhanced regex to include "last X days/hours/minutes" patterns and singular forms
        const isTemporalQuery = /\b(yesterday|today|tomorrow|last\s+week|this\s+week|next\s+week|last\s+month|this\s+month|next\s+month|last\s+(hour|minute)|last\s+\d+\s+(days?|hours?|minutes?|weeks?|months?)|past\s+\d+\s+(days?|hours?|minutes?|weeks?|months?))\b/i.test(params.query);
        // Match Edge Function logic: Math.max(50, (params.limit || 20) * 2)
        const limit = isTemporalQuery ? Math.max(50, (params.limit || 20) * 2) : 5;

        console.log(`🔍 DEBUG: Recent receipts fallback with limit: ${limit} (temporal: ${isTemporalQuery})`);

        // Get recent receipts for the user with optional date filtering
        let query = connection.client
          .from('receipts')
          .select(`
            id,
            merchant,
            total,
            currency,
            date,
            created_at
          `)
          .eq('user_id', userId);

        // 🔧 TEMPORAL FIX: Apply date filtering for temporal queries
        if (isTemporalQuery && params.filters?.dateRange) {
          const { start, end } = params.filters.dateRange;
          if (start && end) {
            console.log(`🔍 DEBUG: Applying date filter to fallback: ${start} to ${end}`);
            query = query
              .gte('date', start)
              .lte('date', end);
          }
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error || !data || data.length === 0) {
          return null;
        }

        // Convert to unified search results
        const results: UnifiedSearchResult[] = data.map((item: any) => ({
          id: item.id,
          sourceType: 'receipt' as const,
          sourceId: item.id,
          contentType: 'receipt',
          title: item.merchant || 'Recent Receipt',
          description: `Recent receipt from ${item.merchant || 'Unknown'} - ${item.currency} ${item.total}`,
          similarity: 0.3, // Lower similarity for recent results
          metadata: {
            merchant: item.merchant,
            total: item.total,
            currency: item.currency,
            date: item.date,
            source: 'recent_results_fallback'
          },
          accessLevel: 'user' as const,
          createdAt: item.created_at,
          updatedAt: item.created_at
        }));

        return {
          success: true,
          results,
          totalResults: results.length,
          pagination: {
            hasMore: false,
            nextOffset: 0,
            totalPages: 1
          },
          searchMetadata: {
            searchDuration: 0,
            sourcesSearched: ['receipt'],
            subscriptionLimitsApplied: false,
            fallbacksUsed: ['recent_results'],
            modelUsed: 'recent_data_fallback'
          }
        };

      } finally {
        this.releaseConnection(connection);
      }

    } catch (error) {
      console.warn('Recent results fallback error:', error);
      return null;
    }
  }

  /**
   * Emergency fallback when all other strategies fail
   */
  private async executeEmergencyFallback(
    params: UnifiedSearchParams,
    userId: string
  ): Promise<UnifiedSearchResponse | null> {
    try {
      console.log('🚨 Executing emergency fallback...');

      // Try cache first (most likely to work)
      const cachedResult = await searchCache.get(params, userId);
      if (cachedResult && cachedResult.results.length > 0) {
        console.log('✅ Emergency fallback found cached results');
        return cachedResult;
      }

      // Try any cached results for this user (broader search)
      try {
        const broadParams = { ...params, query: '', similarityThreshold: 0.1 };
        const broadCached = await searchCache.get(broadParams, userId);
        if (broadCached && broadCached.results.length > 0) {
          console.log('✅ Emergency fallback found broad cached results');
          return {
            ...broadCached,
            results: broadCached.results.slice(0, 3) // Limit to 3 results
          };
        }
      } catch (broadError) {
        console.warn('Broad cache search failed:', broadError);
      }

      // Last resort: try to get any recent data directly
      try {
        const connection = await this.getConnection();
        try {
          const { data } = await connection.client
            .from('receipts')
            .select('id, merchant, total, currency, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

          if (data && data.length > 0) {
            const results: UnifiedSearchResult[] = data.map((item: any) => ({
              id: item.id,
              sourceType: 'receipt' as const,
              sourceId: item.id,
              contentType: 'receipt',
              title: item.merchant || 'Recent Receipt',
              description: `Emergency fallback result - ${item.merchant || 'Unknown'}`,
              similarity: 0.1,
              metadata: {
                merchant: item.merchant,
                total: item.total,
                currency: item.currency,
                source: 'emergency_fallback'
              },
              accessLevel: 'user' as const,
              createdAt: item.created_at,
              updatedAt: item.created_at
            }));

            console.log('✅ Emergency fallback found recent receipts');
            return {
              success: true,
              results,
              totalResults: results.length,
              pagination: {
                hasMore: false,
                nextOffset: 0,
                totalPages: 1
              },
              searchMetadata: {
                searchDuration: 0,
                sourcesSearched: ['receipt'],
                subscriptionLimitsApplied: false,
                fallbacksUsed: ['emergency_database'],
                modelUsed: 'emergency_fallback'
              }
            };
          }
        } finally {
          this.releaseConnection(connection);
        }
      } catch (dbError) {
        console.warn('Emergency database query failed:', dbError);
      }

      return null;
    } catch (error) {
      console.error('Emergency fallback failed:', error);
      return null;
    }
  }

  /**
   * Record performance metrics with enhanced monitoring
   */
  private recordMetrics(metrics: SearchExecutionMetrics): void {
    this.performanceHistory.push(metrics);

    // Keep only recent history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }

    // 🚀 PERFORMANCE: Enhanced performance monitoring
    if (metrics.totalTime > 2000) {
      console.warn(`🐌 Very slow search: ${metrics.totalTime.toFixed(2)}ms for "${metrics.searchStrategy}"`, {
        cacheHit: metrics.cacheHit,
        parallelExecutions: metrics.parallelExecutions,
        fallbackUsed: metrics.fallbackUsed,
        edgeFunctionTime: metrics.edgeFunctionTime,
        databaseTime: metrics.databaseTime
      });
    } else if (metrics.totalTime > 1000) {
      console.warn(`🐌 Slow search: ${metrics.totalTime.toFixed(2)}ms for "${metrics.searchStrategy}"`);
    }

    // 🚀 PERFORMANCE: Track performance trends
    if (this.performanceHistory.length >= 10) {
      const recent = this.performanceHistory.slice(-10);
      const avgTime = recent.reduce((sum, m) => sum + m.totalTime, 0) / 10;
      const cacheHitRate = recent.filter(m => m.cacheHit).length / 10;

      if (avgTime > 1500) {
        console.warn(`📊 Performance degradation: ${avgTime.toFixed(2)}ms average (cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%)`);
      }
    }

    // Expose metrics globally for monitoring
    if (typeof window !== 'undefined') {
      (window as any).lastSearchMetrics = metrics;
      (window as any).searchPerformanceHistory = this.performanceHistory.slice(-50); // Last 50 searches
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageExecutionTime: number;
    cacheHitRate: number;
    fallbackRate: number;
    strategyDistribution: Record<string, number>;
    connectionPoolStats: {
      activeConnections: number;
      totalConnections: number;
      utilizationRate: number;
    };
  } {
    const history = this.performanceHistory;
    
    if (history.length === 0) {
      return {
        averageExecutionTime: 0,
        cacheHitRate: 0,
        fallbackRate: 0,
        strategyDistribution: {},
        connectionPoolStats: {
          activeConnections: 0,
          totalConnections: 0,
          utilizationRate: 0
        }
      };
    }

    const avgTime = history.reduce((sum, m) => sum + m.totalTime, 0) / history.length;
    const cacheHits = history.filter(m => m.cacheHit).length;
    const fallbacks = history.filter(m => m.fallbackUsed).length;
    
    const strategyDistribution: Record<string, number> = {};
    history.forEach(m => {
      strategyDistribution[m.searchStrategy] = (strategyDistribution[m.searchStrategy] || 0) + 1;
    });

    const inUseConnections = Array.from(this.connectionPool.values()).filter(c => c.inUse).length;

    return {
      averageExecutionTime: avgTime,
      cacheHitRate: (cacheHits / history.length) * 100,
      fallbackRate: (fallbacks / history.length) * 100,
      strategyDistribution,
      connectionPoolStats: {
        activeConnections: inUseConnections,
        totalConnections: this.connectionPool.size,
        utilizationRate: this.connectionPool.size > 0 ? (inUseConnections / this.connectionPool.size) * 100 : 0
      }
    };
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory(): void {
    this.performanceHistory = [];
  }

  /**
   * Execute temporal database search with proper date filtering
   */
  private async executeTemporalDatabaseSearch(
    params: UnifiedSearchParams,
    userId: string,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<UnifiedSearchResponse> {
    const startTime = performance.now();
    console.log('🔍 DEBUG: Executing temporal database search with date filtering');

    try {
      const connection = await this.getConnection();

      // Build query with date filtering
      let query = connection.client
        .from('receipts')
        .select(`
          id,
          merchant,
          total,
          currency,
          date,
          created_at,
          team_id,
          user_id
        `)
        .eq('user_id', userId);

      // Apply date filtering
      if (params.filters?.dateRange) {
        const { start, end } = params.filters.dateRange;
        if (start && end) {
          console.log(`🔍 DEBUG: Applying temporal date filter: ${start} to ${end}`);
          query = query
            .gte('date', start)
            .lte('date', end);
        }
      }

      // Apply limit - match Edge Function logic for temporal queries
      // Edge Function uses: Math.max(50, (params.limit || 20) * 2)
      const candidateLimit = Math.max(50, (params.limit || 20) * 2);
      console.log(`🔍 DEBUG: Using candidateLimit ${candidateLimit} to match Edge Function behavior`);

      const { data, error } = await query
        .order('date', { ascending: false })
        .limit(candidateLimit);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`🔍 DEBUG: Temporal database search found ${data?.length || 0} results`);

      // Transform results to match expected format
      const results = (data || []).map(item => ({
        id: item.id,
        sourceType: 'receipt' as const,
        sourceId: item.id,
        title: `${item.merchant} - ${item.currency} ${item.total}`,
        content: `Receipt from ${item.merchant} for ${item.currency} ${item.total} on ${item.date}`,
        similarity: 1.0,
        metadata: {
          merchant: item.merchant,
          total: item.total,
          currency: item.currency,
          date: item.date,
          receiptId: item.id,
          teamId: item.team_id,
          userId: item.user_id
        },
        accessLevel: 'user' as const,
        createdAt: item.created_at,
        updatedAt: item.created_at
      }));

      metrics.databaseTime = performance.now() - startTime;

      return {
        success: true,
        results,
        totalResults: results.length,
        pagination: {
          hasMore: results.length >= candidateLimit,
          nextOffset: results.length,
          totalPages: 1
        },
        searchMetadata: {
          searchDuration: metrics.databaseTime || 0,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'temporal_database_search'
        }
      };

    } catch (error) {
      console.error('❌ Temporal database search failed:', error);
      metrics.databaseTime = performance.now() - startTime;

      // Return empty results instead of throwing
      return {
        success: false,
        results: [],
        totalResults: 0,
        pagination: {
          hasMore: false,
          nextOffset: 0,
          totalPages: 0
        },
        searchMetadata: {
          searchDuration: metrics.databaseTime || 0,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: ['temporal_database_error'],
          modelUsed: 'temporal_database_search'
        },
        error: error instanceof Error ? error.message : 'Temporal database search failed'
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.connectionPool.clear();
    this.activeConnections = 0;
    this.performanceHistory = [];
  }
}

// Export singleton instance
export const optimizedSearchExecutor = new OptimizedSearchExecutor();
export type { SearchExecutionMetrics };
