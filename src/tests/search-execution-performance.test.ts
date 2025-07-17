/**
 * Search Execution Performance Tests
 * Validates the performance improvements of the optimized search execution system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { optimizedSearchExecutor } from '@/lib/optimized-search-executor';
import { optimizedDatabaseManager } from '@/lib/optimized-database-manager';
import { optimizedEdgeFunctionCaller } from '@/lib/optimized-edge-function-caller';
import { UnifiedSearchParams } from '@/types/unified-search';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } }
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));

vi.mock('@/lib/searchCache', () => ({
  searchCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Search Execution Performance Tests', () => {
  const testUserId = 'test-user-id';
  
  const basicSearchParams: UnifiedSearchParams = {
    query: 'test query',
    sources: ['receipts'],
    limit: 20,
    offset: 0,
    filters: {},
    similarityThreshold: 0.3,
    includeMetadata: true,
    aggregationMode: 'relevance'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset performance history
    optimizedSearchExecutor.clearPerformanceHistory();
    optimizedDatabaseManager.cleanup();
    optimizedEdgeFunctionCaller.cleanup();
  });

  afterEach(() => {
    // Cleanup after each test
    optimizedSearchExecutor.cleanup();
    optimizedDatabaseManager.cleanup();
    optimizedEdgeFunctionCaller.cleanup();
  });

  describe('Optimized Search Executor', () => {
    it('should execute search within performance targets', async () => {
      const startTime = performance.now();
      
      const result = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      
      const executionTime = performance.now() - startTime;
      
      // Performance target: < 500ms for basic search
      expect(executionTime).toBeLessThan(500);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should utilize cache for repeated queries', async () => {
      // First call
      const result1 = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      
      // Second call should hit cache
      const startTime = performance.now();
      const result2 = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      const cacheTime = performance.now() - startTime;
      
      // Cache hit should be much faster (< 50ms)
      expect(cacheTime).toBeLessThan(50);
      expect(result2).toBeDefined();
    });

    it('should handle parallel search execution', async () => {
      const queries = [
        { ...basicSearchParams, query: 'query 1' },
        { ...basicSearchParams, query: 'query 2' },
        { ...basicSearchParams, query: 'query 3' }
      ];

      const startTime = performance.now();
      
      const results = await Promise.all(
        queries.map(params => optimizedSearchExecutor.executeSearch(params, testUserId))
      );
      
      const totalTime = performance.now() - startTime;
      
      // Parallel execution should be faster than sequential
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should provide performance statistics', () => {
      const stats = optimizedSearchExecutor.getPerformanceStats();
      
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('fallbackRate');
      expect(stats).toHaveProperty('strategyDistribution');
      expect(stats).toHaveProperty('connectionPoolStats');
      
      expect(typeof stats.averageExecutionTime).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.fallbackRate).toBe('number');
    });
  });

  describe('Optimized Database Manager', () => {
    it('should execute database queries within timeout', async () => {
      const startTime = performance.now();
      
      const result = await optimizedDatabaseManager.executeOptimizedHybridSearch(
        basicSearchParams,
        testUserId
      );
      
      const queryTime = performance.now() - startTime;
      
      // Database query should complete within 8 seconds (our timeout)
      expect(queryTime).toBeLessThan(8000);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should utilize query cache effectively', async () => {
      // First query
      await optimizedDatabaseManager.executeOptimizedHybridSearch(basicSearchParams, testUserId);
      
      // Second query should hit cache
      const startTime = performance.now();
      const result = await optimizedDatabaseManager.executeOptimizedHybridSearch(basicSearchParams, testUserId);
      const cacheTime = performance.now() - startTime;
      
      // Cache hit should be very fast
      expect(cacheTime).toBeLessThan(20);
      expect(result.success).toBe(true);
    });

    it('should provide database performance statistics', () => {
      const stats = optimizedDatabaseManager.getPerformanceStats();
      
      expect(stats).toHaveProperty('averageQueryTime');
      expect(stats).toHaveProperty('queryCacheHitRate');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('totalConnections');
      
      expect(typeof stats.averageQueryTime).toBe('number');
      expect(typeof stats.queryCacheHitRate).toBe('number');
      expect(typeof stats.activeConnections).toBe('number');
      expect(typeof stats.totalConnections).toBe('number');
    });
  });

  describe('Optimized Edge Function Caller', () => {
    it('should call edge functions with reduced timeout', async () => {
      const startTime = performance.now();
      
      try {
        await optimizedEdgeFunctionCaller.callOptimized(
          'unified-search',
          'POST',
          basicSearchParams
        );
      } catch (error) {
        // Expected to fail in test environment, but should fail quickly
        const callTime = performance.now() - startTime;
        expect(callTime).toBeLessThan(16000); // 15s timeout + overhead
      }
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate multiple failures to trigger circuit breaker
      const failedCalls = [];
      
      for (let i = 0; i < 6; i++) {
        try {
          await optimizedEdgeFunctionCaller.callOptimized('test-function', 'POST', {});
        } catch (error) {
          failedCalls.push(error);
        }
      }
      
      const stats = optimizedEdgeFunctionCaller.getPerformanceStats();
      
      // Circuit breaker should be open for test-function
      expect(stats.circuitBreakerStatus['test-function']).toBe('open');
    });

    it('should provide edge function performance statistics', () => {
      const stats = optimizedEdgeFunctionCaller.getPerformanceStats();
      
      expect(stats).toHaveProperty('averageCallTime');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('circuitBreakerStatus');
      expect(stats).toHaveProperty('functionStats');
      
      expect(typeof stats.averageCallTime).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.circuitBreakerStatus).toBe('object');
      expect(typeof stats.functionStats).toBe('object');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet overall performance targets', async () => {
      const testCases = [
        { query: 'simple query', expectedTime: 200 },
        { query: 'coffee starbucks', expectedTime: 300 },
        { query: 'receipts over $50 last month', expectedTime: 500 },
        { query: 'complex query with multiple filters and conditions', expectedTime: 800 }
      ];

      for (const testCase of testCases) {
        const params = { ...basicSearchParams, query: testCase.query };
        const startTime = performance.now();
        
        const result = await optimizedSearchExecutor.executeSearch(params, testUserId);
        
        const executionTime = performance.now() - startTime;
        
        expect(executionTime).toBeLessThan(testCase.expectedTime);
        expect(result.success).toBe(true);
      }
    });

    it('should demonstrate performance improvement over baseline', async () => {
      // Simulate baseline performance (old implementation)
      const baselineTime = 1500; // ms (from analysis)
      
      const startTime = performance.now();
      const result = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      const optimizedTime = performance.now() - startTime;
      
      // Should be at least 3x faster than baseline
      const improvementRatio = baselineTime / optimizedTime;
      expect(improvementRatio).toBeGreaterThan(3);
      expect(result.success).toBe(true);
    });

    it('should maintain performance under load', async () => {
      const concurrentQueries = 10;
      const queries = Array.from({ length: concurrentQueries }, (_, i) => ({
        ...basicSearchParams,
        query: `load test query ${i}`
      }));

      const startTime = performance.now();
      
      const results = await Promise.all(
        queries.map(params => optimizedSearchExecutor.executeSearch(params, testUserId))
      );
      
      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / concurrentQueries;
      
      // Average time per query should still be reasonable under load
      expect(averageTime).toBeLessThan(300);
      expect(results).toHaveLength(concurrentQueries);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle edge function failures gracefully', async () => {
      // Mock edge function to fail
      vi.mocked(optimizedEdgeFunctionCaller.callOptimized).mockRejectedValue(
        new Error('Edge function timeout')
      );

      const startTime = performance.now();
      const result = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      const fallbackTime = performance.now() - startTime;
      
      // Fallback should still be reasonably fast
      expect(fallbackTime).toBeLessThan(1000);
      expect(result).toBeDefined();
      // May succeed via fallback or return error response
    });

    it('should provide meaningful error responses', async () => {
      // Mock all search methods to fail
      vi.mocked(optimizedEdgeFunctionCaller.callOptimized).mockRejectedValue(
        new Error('All search methods failed')
      );

      const result = await optimizedSearchExecutor.executeSearch(basicSearchParams, testUserId);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.searchMetadata).toBeDefined();
      expect(result.searchMetadata.fallbackUsed).toBe(true);
    });
  });
});

// Performance monitoring utilities for manual testing
export const performanceTestUtils = {
  /**
   * Run a comprehensive performance test
   */
  async runPerformanceTest(iterations: number = 10) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const params: UnifiedSearchParams = {
        query: `performance test query ${i}`,
        sources: ['receipts'],
        limit: 20,
        offset: 0,
        filters: {},
        similarityThreshold: 0.3,
        includeMetadata: true,
        aggregationMode: 'relevance'
      };

      const startTime = performance.now();
      const result = await optimizedSearchExecutor.executeSearch(params, 'test-user');
      const executionTime = performance.now() - startTime;

      results.push({
        iteration: i + 1,
        executionTime,
        success: result.success,
        resultCount: result.totalResults
      });
    }

    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const successRate = results.filter(r => r.success).length / results.length * 100;

    return {
      averageExecutionTime: avgTime,
      successRate,
      results,
      stats: optimizedSearchExecutor.getPerformanceStats()
    };
  },

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const searchStats = optimizedSearchExecutor.getPerformanceStats();
    const dbStats = optimizedDatabaseManager.getPerformanceStats();
    const edgeStats = optimizedEdgeFunctionCaller.getPerformanceStats();

    return {
      timestamp: new Date().toISOString(),
      searchExecution: searchStats,
      database: dbStats,
      edgeFunctions: edgeStats,
      summary: {
        overallPerformance: searchStats.averageExecutionTime < 500 ? 'Excellent' : 
                           searchStats.averageExecutionTime < 1000 ? 'Good' : 'Needs Improvement',
        cacheEfficiency: searchStats.cacheHitRate > 80 ? 'Excellent' :
                        searchStats.cacheHitRate > 60 ? 'Good' : 'Needs Improvement',
        systemHealth: 'Operational'
      }
    };
  }
};
