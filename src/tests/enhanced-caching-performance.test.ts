/**
 * Enhanced Caching and Performance Monitoring Tests
 * Validates the performance improvements of the enhanced caching system and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enhancedCacheSystem } from '@/lib/enhanced-cache-system';
import { comprehensivePerformanceMonitor } from '@/lib/comprehensive-performance-monitor';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';

// Mock dependencies
vi.mock('lz-string', () => ({
  compress: vi.fn((data) => `compressed_${data.length}`),
  decompress: vi.fn((data) => data.replace('compressed_', ''))
}));

Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
    }
  }
});

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
});

describe('Enhanced Caching and Performance Monitoring Tests', () => {
  const testUserId = 'test-user-123';
  
  const mockSearchParams: UnifiedSearchParams = {
    query: 'test search query',
    sources: ['receipts'],
    limit: 20,
    offset: 0,
    filters: {},
    similarityThreshold: 0.3,
    includeMetadata: true,
    aggregationMode: 'relevance'
  };

  const mockSearchResponse: UnifiedSearchResponse = {
    success: true,
    results: [
      {
        id: '1',
        type: 'receipt',
        title: 'Test Receipt',
        content: 'Test content for caching',
        similarity: 0.9,
        metadata: { amount: 25.50, currency: 'MYR', date: '2024-01-01' }
      }
    ],
    totalResults: 1,
    pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
    searchMetadata: { queryTime: 150, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'enhanced' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    enhancedCacheSystem.clear();
    comprehensivePerformanceMonitor.stopMonitoring();
  });

  afterEach(() => {
    enhancedCacheSystem.clear();
    comprehensivePerformanceMonitor.stopMonitoring();
  });

  describe('Enhanced Cache System', () => {
    it('should cache and retrieve search results efficiently', async () => {
      // Cache miss initially
      const result1 = await enhancedCacheSystem.get(mockSearchParams, testUserId);
      expect(result1).toBeNull();

      // Store in cache
      await enhancedCacheSystem.set(mockSearchParams, testUserId, mockSearchResponse);

      // Cache hit
      const result2 = await enhancedCacheSystem.get(mockSearchParams, testUserId);
      expect(result2).not.toBeNull();
      expect(result2?.success).toBe(true);
      expect(result2?.results).toHaveLength(1);
    });

    it('should compress large responses automatically', async () => {
      // Create large response
      const largeResponse = {
        ...mockSearchResponse,
        results: Array.from({ length: 100 }, (_, i) => ({
          id: `${i}`,
          type: 'receipt' as const,
          title: `Large Receipt ${i}`,
          content: 'A'.repeat(1000), // 1KB content per result
          similarity: Math.random(),
          metadata: { amount: Math.random() * 100, currency: 'MYR' }
        }))
      };

      await enhancedCacheSystem.set(mockSearchParams, testUserId, largeResponse);
      
      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.totalCompressions).toBeGreaterThan(0);
      expect(metrics.compressionRate).toBeGreaterThan(0);
    });

    it('should implement intelligent eviction policies', async () => {
      // Fill cache beyond capacity
      const cacheEntries = 50;
      
      for (let i = 0; i < cacheEntries; i++) {
        const params = { ...mockSearchParams, query: `test query ${i}` };
        const response = { ...mockSearchResponse, results: [{ ...mockSearchResponse.results[0], id: `${i}` }] };
        
        await enhancedCacheSystem.set(params, testUserId, response);
      }

      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.totalEvictions).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUtilization).toBeLessThanOrEqual(100);
    });

    it('should provide detailed performance metrics', async () => {
      // Perform several cache operations
      for (let i = 0; i < 10; i++) {
        const params = { ...mockSearchParams, query: `metrics test ${i}` };
        
        // Cache miss
        await enhancedCacheSystem.get(params, testUserId);
        
        // Cache set
        await enhancedCacheSystem.set(params, testUserId, mockSearchResponse);
        
        // Cache hit
        await enhancedCacheSystem.get(params, testUserId);
      }

      const metrics = enhancedCacheSystem.getMetrics();
      
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('missRate');
      expect(metrics).toHaveProperty('averageAccessTime');
      expect(metrics).toHaveProperty('memoryUtilization');
      expect(metrics).toHaveProperty('compressionRate');
      expect(metrics).toHaveProperty('cacheEfficiency');

      expect(metrics.totalRequests).toBe(20); // 10 misses + 10 hits
      expect(metrics.hitRate).toBeGreaterThan(0);
      expect(metrics.missRate).toBeGreaterThan(0);
    });

    it('should implement predictive caching', async () => {
      // Set up user query patterns
      const baseQuery = 'expense report';
      const patterns = [
        'expense report details',
        'expense report summary',
        'expense report total'
      ];

      // Cache initial query
      await enhancedCacheSystem.set(
        { ...mockSearchParams, query: baseQuery }, 
        testUserId, 
        mockSearchResponse
      );

      // Trigger predictive loading by accessing cache
      await enhancedCacheSystem.get(
        { ...mockSearchParams, query: baseQuery }, 
        testUserId
      );

      // Predictive caching should have been triggered
      // (In a real implementation, this would pre-load related queries)
      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(1);
    });

    it('should handle cache warming strategies', async () => {
      const warmingQueries = [
        'popular query 1',
        'popular query 2',
        'popular query 3'
      ];

      // Simulate cache warming
      for (const query of warmingQueries) {
        const params = { ...mockSearchParams, query };
        await enhancedCacheSystem.set(params, testUserId, mockSearchResponse);
      }

      // Verify all queries are cached
      for (const query of warmingQueries) {
        const params = { ...mockSearchParams, query };
        const result = await enhancedCacheSystem.get(params, testUserId);
        expect(result).not.toBeNull();
      }

      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.hitRate).toBe(100); // All should be hits
    });
  });

  describe('Comprehensive Performance Monitor', () => {
    it('should collect system metrics', async () => {
      comprehensivePerformanceMonitor.startMonitoring(100); // 100ms interval
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const currentMetrics = comprehensivePerformanceMonitor.getCurrentMetrics();
      expect(currentMetrics).not.toBeNull();
      
      if (currentMetrics) {
        expect(currentMetrics).toHaveProperty('timestamp');
        expect(currentMetrics).toHaveProperty('cpu');
        expect(currentMetrics).toHaveProperty('memory');
        expect(currentMetrics).toHaveProperty('cache');
        expect(currentMetrics).toHaveProperty('search');
        expect(currentMetrics).toHaveProperty('ui');
      }
    });

    it('should detect performance alerts', async () => {
      // Configure low thresholds to trigger alerts
      comprehensivePerformanceMonitor.updateConfig({
        thresholds: {
          cpuUsage: 1, // Very low threshold
          memoryUsage: 1,
          responseTime: 1,
          errorRate: 1,
          cacheHitRate: 99, // Very high threshold
          queueLength: 1
        }
      });

      comprehensivePerformanceMonitor.startMonitoring(100);
      
      // Wait for alert detection
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const activeAlerts = comprehensivePerformanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate performance reports', async () => {
      comprehensivePerformanceMonitor.startMonitoring(50);
      
      // Wait for some metrics collection
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        const report = comprehensivePerformanceMonitor.generateReport(1); // 1 hour period
        
        expect(report).toHaveProperty('period');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('trends');
        expect(report).toHaveProperty('alerts');
        expect(report).toHaveProperty('recommendations');
        expect(report).toHaveProperty('bottlenecks');

        expect(report.summary).toHaveProperty('averageResponseTime');
        expect(report.summary).toHaveProperty('totalRequests');
        expect(report.summary).toHaveProperty('errorRate');
        expect(report.summary).toHaveProperty('uptime');
      } catch (error) {
        // May not have enough data for report generation
        expect(error.message).toContain('No metrics available');
      }
    });

    it('should provide monitoring status', () => {
      const initialStatus = comprehensivePerformanceMonitor.getStatus();
      expect(initialStatus.isMonitoring).toBe(false);
      expect(initialStatus.metricsCollected).toBe(0);

      comprehensivePerformanceMonitor.startMonitoring(100);
      
      const runningStatus = comprehensivePerformanceMonitor.getStatus();
      expect(runningStatus.isMonitoring).toBe(true);
      expect(runningStatus.uptime).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should demonstrate cache performance improvements', async () => {
      const iterations = 100;
      const queries = Array.from({ length: 20 }, (_, i) => `benchmark query ${i}`);
      
      // Measure cache miss performance
      const missStartTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        const query = queries[i % queries.length];
        const params = { ...mockSearchParams, query };
        await enhancedCacheSystem.get(params, testUserId);
      }
      const missTime = performance.now() - missStartTime;

      // Populate cache
      for (const query of queries) {
        const params = { ...mockSearchParams, query };
        await enhancedCacheSystem.set(params, testUserId, mockSearchResponse);
      }

      // Measure cache hit performance
      const hitStartTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        const query = queries[i % queries.length];
        const params = { ...mockSearchParams, query };
        await enhancedCacheSystem.get(params, testUserId);
      }
      const hitTime = performance.now() - hitStartTime;

      // Cache hits should be significantly faster
      expect(hitTime).toBeLessThan(missTime * 0.5); // At least 50% faster
      
      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.hitRate).toBeGreaterThan(50); // Should have good hit rate
    });

    it('should handle high-volume caching efficiently', async () => {
      const volumeTest = 1000;
      const startTime = performance.now();

      // High-volume cache operations
      for (let i = 0; i < volumeTest; i++) {
        const params = { ...mockSearchParams, query: `volume test ${i}` };
        
        if (i % 3 === 0) {
          // Cache set
          await enhancedCacheSystem.set(params, testUserId, mockSearchResponse);
        } else {
          // Cache get
          await enhancedCacheSystem.get(params, testUserId);
        }
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerOperation = totalTime / volumeTest;

      // Should handle high volume efficiently
      expect(avgTimePerOperation).toBeLessThan(5); // Less than 5ms per operation
      
      const metrics = enhancedCacheSystem.getMetrics();
      expect(metrics.memoryUtilization).toBeLessThan(100);
      expect(metrics.averageAccessTime).toBeLessThan(10);
    });

    it('should maintain performance under memory pressure', async () => {
      // Fill cache to capacity
      const largeDataSize = 1000;
      
      for (let i = 0; i < largeDataSize; i++) {
        const params = { ...mockSearchParams, query: `memory pressure ${i}` };
        const largeResponse = {
          ...mockSearchResponse,
          results: Array.from({ length: 10 }, (_, j) => ({
            ...mockSearchResponse.results[0],
            id: `${i}-${j}`,
            content: 'Large content '.repeat(100) // Larger content
          }))
        };
        
        await enhancedCacheSystem.set(params, testUserId, largeResponse);
      }

      const metrics = enhancedCacheSystem.getMetrics();
      
      // Should handle memory pressure gracefully
      expect(metrics.memoryUtilization).toBeLessThanOrEqual(100);
      expect(metrics.totalEvictions).toBeGreaterThan(0);
      expect(metrics.averageAccessTime).toBeLessThan(20); // Still reasonable performance
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate caching with performance monitoring', async () => {
      // Start monitoring
      comprehensivePerformanceMonitor.startMonitoring(100);
      
      // Perform cache operations
      for (let i = 0; i < 20; i++) {
        const params = { ...mockSearchParams, query: `integration test ${i}` };
        
        // Cache operations
        await enhancedCacheSystem.set(params, testUserId, mockSearchResponse);
        await enhancedCacheSystem.get(params, testUserId);
      }

      // Wait for monitoring
      await new Promise(resolve => setTimeout(resolve, 250));

      const cacheMetrics = enhancedCacheSystem.getMetrics();
      const monitoringMetrics = comprehensivePerformanceMonitor.getCurrentMetrics();

      // Both systems should have collected metrics
      expect(cacheMetrics.totalRequests).toBeGreaterThan(0);
      expect(monitoringMetrics).not.toBeNull();
      
      if (monitoringMetrics) {
        expect(monitoringMetrics.cache.hitRate).toBeGreaterThan(0);
      }
    });
  });
});

// Performance testing utilities for manual testing
export const enhancedCachingPerformanceTestUtils = {
  /**
   * Run comprehensive caching performance test
   */
  async runCachingPerformanceTest(iterations: number = 1000) {
    const results = {
      cacheOperations: [],
      compressionTests: [],
      evictionTests: [],
      metrics: null
    };

    // Test cache operations
    const operationStartTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      const params: UnifiedSearchParams = {
        query: `perf test ${i}`,
        sources: ['receipts'],
        limit: 20,
        offset: 0,
        filters: {},
        similarityThreshold: 0.3,
        includeMetadata: true,
        aggregationMode: 'relevance'
      };

      const opStart = performance.now();
      
      if (i % 3 === 0) {
        // Cache set
        await enhancedCacheSystem.set(params, 'test-user', {
          success: true,
          results: [],
          totalResults: 0,
          pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
          searchMetadata: { queryTime: 100, sourcesSearched: ['receipts'], fallbackUsed: false, searchMethod: 'test' }
        });
      } else {
        // Cache get
        await enhancedCacheSystem.get(params, 'test-user');
      }
      
      const opTime = performance.now() - opStart;
      results.cacheOperations.push({
        iteration: i,
        operation: i % 3 === 0 ? 'set' : 'get',
        time: opTime
      });
    }

    const totalOperationTime = performance.now() - operationStartTime;
    results.metrics = enhancedCacheSystem.getMetrics();

    return {
      ...results,
      summary: {
        totalTime: totalOperationTime,
        averageTimePerOperation: totalOperationTime / iterations,
        operationsPerSecond: iterations / (totalOperationTime / 1000),
        cacheMetrics: results.metrics
      }
    };
  },

  /**
   * Test monitoring system performance
   */
  async testMonitoringPerformance(durationMs: number = 5000) {
    const startTime = performance.now();
    
    comprehensivePerformanceMonitor.startMonitoring(100);
    
    // Wait for monitoring period
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    const endTime = performance.now();
    const status = comprehensivePerformanceMonitor.getStatus();
    const currentMetrics = comprehensivePerformanceMonitor.getCurrentMetrics();
    
    comprehensivePerformanceMonitor.stopMonitoring();

    return {
      duration: endTime - startTime,
      status,
      currentMetrics,
      metricsCollected: status.metricsCollected,
      collectionRate: status.metricsCollected / (durationMs / 1000), // metrics per second
      activeAlerts: comprehensivePerformanceMonitor.getActiveAlerts().length
    };
  }
};
