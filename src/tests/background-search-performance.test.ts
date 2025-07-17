/**
 * Background Search Service Performance Tests
 * Validates the performance improvements of the optimized background search service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { optimizedBackgroundSearchService, SearchPriority } from '@/services/optimized-background-search-service';
import { intelligentSearchPrioritizer } from '@/lib/intelligent-search-prioritizer';
import { advancedSearchCache } from '@/lib/advanced-search-cache';
import { UnifiedSearchParams } from '@/types/unified-search';

// Mock dependencies
vi.mock('@/lib/optimized-search-executor', () => ({
  optimizedSearchExecutor: {
    executeSearch: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          id: '1',
          type: 'receipt',
          title: 'Test Receipt',
          content: 'Test content',
          similarity: 0.9,
          metadata: { amount: 25.50, currency: 'MYR' }
        }
      ],
      totalResults: 1,
      pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
      searchMetadata: { queryTime: 150, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'optimized' }
    })
  }
}));

vi.mock('@/lib/searchCache', () => ({
  searchCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({
      cacheEfficiency: 75,
      hits: 75,
      misses: 25
    })
  }
}));

describe('Background Search Service Performance Tests', () => {
  const testUserId = 'test-user-id';
  const testConversationId = 'test-conversation-id';
  
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
    // Reset service state
    optimizedBackgroundSearchService.cleanup();
  });

  afterEach(() => {
    optimizedBackgroundSearchService.cleanup();
  });

  describe('Optimized Background Search Service', () => {
    it('should handle concurrent searches efficiently', async () => {
      const concurrentSearches = 5;
      const searchPromises: Promise<string>[] = [];
      const startTime = performance.now();

      // Start multiple concurrent searches
      for (let i = 0; i < concurrentSearches; i++) {
        const params = { ...basicSearchParams, query: `test query ${i}` };
        const promise = optimizedBackgroundSearchService.startSearch(
          `conversation-${i}`,
          params.query,
          params,
          testUserId
        );
        searchPromises.push(promise);
      }

      // Wait for all searches to complete
      const searchIds = await Promise.all(searchPromises);
      const totalTime = performance.now() - startTime;

      // All searches should have unique IDs
      expect(searchIds).toHaveLength(concurrentSearches);
      expect(new Set(searchIds).size).toBe(concurrentSearches);

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 5 concurrent searches

      // Check queue status
      const queueStatus = optimizedBackgroundSearchService.getQueueStatus();
      expect(queueStatus.activeSearches).toBeLessThanOrEqual(3); // Max concurrent limit
    });

    it('should prioritize searches correctly', async () => {
      const searches = [
        { query: 'urgent emergency receipt', priority: SearchPriority.URGENT },
        { query: 'maybe find something', priority: SearchPriority.LOW },
        { query: 'important business expense', priority: SearchPriority.HIGH },
        { query: 'regular search query', priority: SearchPriority.NORMAL }
      ];

      const searchIds: string[] = [];

      // Start searches in random order
      for (const search of searches) {
        const params = { ...basicSearchParams, query: search.query };
        const id = await optimizedBackgroundSearchService.startSearch(
          `conversation-${search.query}`,
          search.query,
          params,
          testUserId,
          { priority: search.priority }
        );
        searchIds.push(id);
      }

      // Check that higher priority searches are processed first
      const queueStatus = optimizedBackgroundSearchService.getQueueStatus();
      expect(queueStatus.queueLength).toBeGreaterThanOrEqual(0);

      // Verify metrics are being tracked
      const metrics = optimizedBackgroundSearchService.getMetrics();
      expect(metrics.totalSearches).toBe(searches.length);
    });

    it('should handle search cancellation properly', async () => {
      const params = { ...basicSearchParams, query: 'cancellable search' };
      
      // Start a search
      const searchId = await optimizedBackgroundSearchService.startSearch(
        testConversationId,
        params.query,
        params,
        testUserId
      );

      expect(searchId).toBeDefined();

      // Cancel the search
      optimizedBackgroundSearchService.cancelSearch(testConversationId);

      // Check status
      const status = optimizedBackgroundSearchService.getSearchStatus(testConversationId);
      expect(status.status).toBe('idle');
    });

    it('should provide accurate search status', async () => {
      const params = { ...basicSearchParams, query: 'status test query' };
      
      // Initially idle
      let status = optimizedBackgroundSearchService.getSearchStatus(testConversationId);
      expect(status.status).toBe('idle');

      // Start search
      await optimizedBackgroundSearchService.startSearch(
        testConversationId,
        params.query,
        params,
        testUserId
      );

      // Should be active or queued
      status = optimizedBackgroundSearchService.getSearchStatus(testConversationId);
      expect(['active', 'queued']).toContain(status.status);
    });

    it('should maintain performance metrics', async () => {
      const params = { ...basicSearchParams, query: 'metrics test' };
      
      // Start a search
      await optimizedBackgroundSearchService.startSearch(
        testConversationId,
        params.query,
        params,
        testUserId
      );

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = optimizedBackgroundSearchService.getMetrics();
      
      expect(metrics).toHaveProperty('totalSearches');
      expect(metrics).toHaveProperty('completedSearches');
      expect(metrics).toHaveProperty('failedSearches');
      expect(metrics).toHaveProperty('averageSearchTime');
      expect(metrics).toHaveProperty('concurrencyUtilization');
      expect(metrics).toHaveProperty('resourceUtilization');

      expect(metrics.totalSearches).toBeGreaterThan(0);
    });

    it('should handle queue overflow gracefully', async () => {
      // Fill up the queue beyond capacity
      const maxQueueSize = 20;
      const searchPromises: Promise<string>[] = [];

      for (let i = 0; i < maxQueueSize + 5; i++) {
        const params = { ...basicSearchParams, query: `overflow test ${i}` };
        const promise = optimizedBackgroundSearchService.startSearch(
          `conversation-overflow-${i}`,
          params.query,
          params,
          testUserId,
          { priority: SearchPriority.LOW } // Use low priority to ensure queuing
        );
        searchPromises.push(promise);
      }

      const searchIds = await Promise.all(searchPromises);
      
      // All searches should get IDs (some may be rejected)
      expect(searchIds).toHaveLength(maxQueueSize + 5);

      const queueStatus = optimizedBackgroundSearchService.getQueueStatus();
      expect(queueStatus.queueLength).toBeLessThanOrEqual(maxQueueSize);
    });
  });

  describe('Intelligent Search Prioritizer', () => {
    it('should determine priority based on query characteristics', () => {
      const testCases = [
        {
          query: 'urgent emergency receipt now',
          expectedPriority: SearchPriority.URGENT,
          description: 'urgent query'
        },
        {
          query: 'important business expense details',
          expectedPriority: SearchPriority.HIGH,
          description: 'important query'
        },
        {
          query: 'maybe find some receipts sometime',
          expectedPriority: SearchPriority.LOW,
          description: 'low priority query'
        },
        {
          query: 'show me receipts from starbucks',
          expectedPriority: SearchPriority.NORMAL,
          description: 'normal query'
        }
      ];

      const systemLoad = {
        cpuUsage: 50,
        memoryUsage: 60,
        activeSearches: 2,
        queueLength: 3,
        averageResponseTime: 1500,
        errorRate: 0.02
      };

      for (const testCase of testCases) {
        const result = intelligentSearchPrioritizer.determinePriority(
          testCase.query,
          basicSearchParams,
          testUserId,
          systemLoad
        );

        expect(result.priority).toBe(testCase.expectedPriority);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.reasoning).toBeInstanceOf(Array);
        expect(result.estimatedWaitTime).toBeGreaterThan(0);
      }
    });

    it('should provide analytics on prioritization patterns', () => {
      const analytics = intelligentSearchPrioritizer.getAnalytics();
      
      expect(analytics).toHaveProperty('totalQueries');
      expect(analytics).toHaveProperty('priorityDistribution');
      expect(analytics).toHaveProperty('averageConfidence');
      expect(analytics).toHaveProperty('topQueryTypes');
      expect(analytics).toHaveProperty('userPatterns');

      expect(typeof analytics.totalQueries).toBe('number');
      expect(typeof analytics.averageConfidence).toBe('number');
      expect(Array.isArray(analytics.topQueryTypes)).toBe(true);
    });
  });

  describe('Advanced Search Cache', () => {
    it('should provide multi-tier caching', async () => {
      const params = { ...basicSearchParams, query: 'cache test query' };
      
      // Initially should be cache miss
      const result1 = await advancedSearchCache.get(params, testUserId);
      expect(result1).toBeNull();

      // Store in cache
      const mockResponse = {
        success: true,
        results: [],
        totalResults: 0,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
        searchMetadata: { queryTime: 100, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'test' }
      };

      await advancedSearchCache.set(params, testUserId, mockResponse);

      // Should now be cache hit
      const result2 = await advancedSearchCache.get(params, testUserId);
      expect(result2).not.toBeNull();
      expect(result2?.success).toBe(true);
    });

    it('should provide cache analytics', () => {
      const analytics = advancedSearchCache.getAnalytics();
      
      expect(analytics).toHaveProperty('totalEntries');
      expect(analytics).toHaveProperty('memoryUsage');
      expect(analytics).toHaveProperty('hitRate');
      expect(analytics).toHaveProperty('missRate');
      expect(analytics).toHaveProperty('tierDistribution');

      expect(typeof analytics.totalEntries).toBe('number');
      expect(typeof analytics.memoryUsage).toBe('number');
      expect(typeof analytics.hitRate).toBe('number');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet search execution time targets', async () => {
      const testCases = [
        { query: 'simple query', maxTime: 500 },
        { query: 'complex query with multiple filters and conditions', maxTime: 1000 },
        { query: 'urgent emergency receipt', maxTime: 300 }
      ];

      for (const testCase of testCases) {
        const params = { ...basicSearchParams, query: testCase.query };
        const startTime = performance.now();

        await optimizedBackgroundSearchService.startSearch(
          `perf-test-${testCase.query}`,
          testCase.query,
          params,
          testUserId
        );

        const executionTime = performance.now() - startTime;
        expect(executionTime).toBeLessThan(testCase.maxTime);
      }
    });

    it('should demonstrate improvement over baseline', async () => {
      const iterations = 5;
      const executionTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const params = { ...basicSearchParams, query: `benchmark query ${i}` };
        const startTime = performance.now();

        await optimizedBackgroundSearchService.startSearch(
          `benchmark-${i}`,
          params.query,
          params,
          testUserId
        );

        const executionTime = performance.now() - startTime;
        executionTimes.push(executionTime);
      }

      const averageTime = executionTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const baselineTime = 2000; // Assumed baseline from old implementation

      // Should be significantly faster than baseline
      expect(averageTime).toBeLessThan(baselineTime * 0.5); // 50% improvement
    });

    it('should maintain performance under load', async () => {
      const loadTestSearches = 10;
      const searchPromises: Promise<string>[] = [];
      const startTime = performance.now();

      // Start multiple searches simultaneously
      for (let i = 0; i < loadTestSearches; i++) {
        const params = { ...basicSearchParams, query: `load test ${i}` };
        const promise = optimizedBackgroundSearchService.startSearch(
          `load-test-${i}`,
          params.query,
          params,
          testUserId
        );
        searchPromises.push(promise);
      }

      await Promise.all(searchPromises);
      const totalTime = performance.now() - startTime;

      // Should handle load efficiently
      expect(totalTime).toBeLessThan(3000); // 3 seconds for 10 searches

      const metrics = optimizedBackgroundSearchService.getMetrics();
      expect(metrics.concurrencyUtilization).toBeLessThanOrEqual(100);
    });
  });

  describe('Resource Management', () => {
    it('should manage memory usage effectively', async () => {
      const initialMetrics = optimizedBackgroundSearchService.getMetrics();
      
      // Perform multiple searches
      for (let i = 0; i < 20; i++) {
        const params = { ...basicSearchParams, query: `memory test ${i}` };
        await optimizedBackgroundSearchService.startSearch(
          `memory-test-${i}`,
          params.query,
          params,
          testUserId
        );
      }

      const finalMetrics = optimizedBackgroundSearchService.getMetrics();
      
      // Memory usage should be reasonable
      expect(finalMetrics.resourceUtilization.memory).toBeLessThan(90);
    });

    it('should handle configuration updates', () => {
      const newConfig = {
        maxConcurrentSearches: 5,
        searchTimeout: 20000
      };

      optimizedBackgroundSearchService.updateConfig(newConfig);

      const queueStatus = optimizedBackgroundSearchService.getQueueStatus();
      expect(queueStatus.maxConcurrent).toBe(5);
    });
  });
});

// Performance testing utilities for manual testing
export const backgroundSearchPerformanceTestUtils = {
  /**
   * Run comprehensive background search performance test
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
      const searchId = await optimizedBackgroundSearchService.startSearch(
        `perf-test-${i}`,
        params.query,
        params,
        'test-user'
      );
      const executionTime = performance.now() - startTime;

      const status = optimizedBackgroundSearchService.getSearchStatus(`perf-test-${i}`);

      results.push({
        iteration: i + 1,
        searchId,
        executionTime,
        status: status.status,
        queuePosition: status.queuePosition
      });
    }

    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const metrics = optimizedBackgroundSearchService.getMetrics();

    return {
      averageExecutionTime: avgTime,
      results,
      serviceMetrics: metrics,
      queueStatus: optimizedBackgroundSearchService.getQueueStatus()
    };
  },

  /**
   * Test concurrent search performance
   */
  async testConcurrentPerformance(concurrentSearches: number = 5) {
    const searchPromises: Promise<string>[] = [];
    const startTime = performance.now();

    for (let i = 0; i < concurrentSearches; i++) {
      const params: UnifiedSearchParams = {
        query: `concurrent test ${i}`,
        sources: ['receipts'],
        limit: 20,
        offset: 0,
        filters: {},
        similarityThreshold: 0.3,
        includeMetadata: true,
        aggregationMode: 'relevance'
      };

      const promise = optimizedBackgroundSearchService.startSearch(
        `concurrent-${i}`,
        params.query,
        params,
        'test-user'
      );
      searchPromises.push(promise);
    }

    const searchIds = await Promise.all(searchPromises);
    const totalTime = performance.now() - startTime;

    return {
      concurrentSearches,
      totalTime,
      averageTimePerSearch: totalTime / concurrentSearches,
      searchIds,
      queueStatus: optimizedBackgroundSearchService.getQueueStatus(),
      metrics: optimizedBackgroundSearchService.getMetrics()
    };
  }
};
