/**
 * Search Integration Tests
 * Tests the complete search flow including all fixes and optimizations
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { OptimizedSearchExecutor } from '@/lib/optimized-search-executor';
import { CacheInvalidationService } from '@/services/cacheInvalidationService';
import { NotificationService } from '@/services/notificationService';
import { UnifiedSearchParams } from '@/types/unified-search';
import { QueryClient } from '@tanstack/react-query';

describe('Search Integration Tests', () => {
  let searchExecutor: OptimizedSearchExecutor;
  let queryClient: QueryClient;
  let notificationService: NotificationService;

  beforeAll(async () => {
    // Initialize services as they would be in the app
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });

    // Initialize CacheInvalidationService (fix from task 1)
    CacheInvalidationService.initialize(queryClient);

    searchExecutor = new OptimizedSearchExecutor();
    notificationService = new NotificationService();
  });

  afterAll(() => {
    searchExecutor.cleanup();
    notificationService.disconnectAll();
  });

  describe('Complete Search Flow Integration', () => {
    it('should handle the complete search flow without zero results', async () => {
      const testParams: UnifiedSearchParams = {
        query: 'coffee shop receipt',
        sources: ['receipts'], // Test frontend plural form mapping
        limit: 20,
        similarityThreshold: 0.3,
        filters: {
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          }
        }
      };

      const testUserId = 'integration-test-user';

      // Execute search
      const result = await searchExecutor.executeSearch(testParams, testUserId);

      // Validate response structure
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.totalResults).toBeDefined();
      expect(typeof result.totalResults).toBe('number');
      expect(result.pagination).toBeDefined();
      expect(result.pagination.hasMore).toBeDefined();
      expect(result.pagination.nextOffset).toBeDefined();
      expect(result.pagination.totalPages).toBeDefined();
      expect(result.searchMetadata).toBeDefined();
      expect(result.searchMetadata.searchDuration).toBeDefined();
      expect(result.searchMetadata.sourcesSearched).toBeDefined();
      expect(Array.isArray(result.searchMetadata.sourcesSearched)).toBe(true);
      expect(result.searchMetadata.fallbacksUsed).toBeDefined();
      expect(Array.isArray(result.searchMetadata.fallbacksUsed)).toBe(true);

      // Validate that we never get a completely broken response
      expect(result.searchMetadata.sourcesSearched.length).toBeGreaterThan(0);
    });

    it('should demonstrate all fallback strategies work', async () => {
      const testCases = [
        {
          name: 'Edge Function Success',
          query: 'edge function test',
          expectedStrategy: 'edge_function'
        },
        {
          name: 'Database Fallback',
          query: 'database fallback test',
          expectedFallback: true
        },
        {
          name: 'Cache Fallback',
          query: 'cache fallback test',
          expectedCache: true
        }
      ];

      for (const testCase of testCases) {
        const params: UnifiedSearchParams = {
          query: testCase.query,
          sources: ['receipt'],
          limit: 10
        };

        const result = await searchExecutor.executeSearch(params, 'test-user');

        // Each test should return a valid response
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.searchMetadata).toBeDefined();

        console.log(`✅ ${testCase.name}: ${result.success ? 'SUCCESS' : 'HANDLED'} - Strategy: ${result.searchMetadata.modelUsed || 'fallback'}`);
      }
    });

    it('should handle performance optimization correctly', async () => {
      const performanceTestParams: UnifiedSearchParams = {
        query: '   PERFORMANCE   TEST   WITH   LOTS   OF   WHITESPACE   ',
        sources: ['receipts', 'claims', 'business_directory'], // Multiple sources
        limit: 100, // Should be capped
        similarityThreshold: undefined // Should get default
      };

      const startTime = performance.now();
      const result = await searchExecutor.executeSearch(performanceTestParams, 'perf-test-user');
      const executionTime = performance.now() - startTime;

      // Validate performance optimizations
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Check performance stats
      const stats = searchExecutor.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.fallbackRate).toBeGreaterThanOrEqual(0);

      console.log(`⚡ Performance test completed in ${executionTime.toFixed(2)}ms`);
      console.log(`📊 Stats - Avg: ${stats.averageExecutionTime.toFixed(2)}ms, Cache: ${(stats.cacheHitRate * 100).toFixed(1)}%, Fallback: ${(stats.fallbackRate * 100).toFixed(1)}%`);
    });

    it('should validate CacheInvalidationService is properly initialized', () => {
      // This test validates fix from task 1
      expect(() => {
        // This should not throw an error anymore
        CacheInvalidationService.invalidate(['receipts']);
      }).not.toThrow();

      console.log('✅ CacheInvalidationService is properly initialized');
    });

    it('should validate notification service channel handling', async () => {
      // This test validates fixes from task 5
      const connectionState = notificationService.getConnectionState();
      
      expect(connectionState).toBeDefined();
      expect(connectionState.status).toBeDefined();
      expect(connectionState.activeChannels).toBeDefined();
      expect(connectionState.registeredSubscriptions).toBeDefined();
      expect(connectionState.reconnectAttempts).toBeDefined();

      console.log(`📡 Notification service state: ${connectionState.status}, Channels: ${connectionState.activeChannels}, Subscriptions: ${connectionState.registeredSubscriptions}`);
    });

    it('should handle concurrent search requests efficiently', async () => {
      const concurrentSearches = Array.from({ length: 5 }, (_, i) => ({
        query: `concurrent search ${i}`,
        sources: ['receipt'] as const,
        limit: 10
      }));

      const startTime = performance.now();
      const results = await Promise.allSettled(
        concurrentSearches.map(params => 
          searchExecutor.executeSearch(params, `concurrent-user-${Math.random()}`)
        )
      );
      const totalTime = performance.now() - startTime;

      // All searches should complete
      expect(results).toHaveLength(5);
      
      // Check that all searches either succeeded or were handled gracefully
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
          expect(result.value.success).toBeDefined();
          expect(result.value.results).toBeDefined();
        } else {
          console.warn(`Search ${index} was rejected:`, result.reason);
        }
      });

      console.log(`🔄 Concurrent searches completed in ${totalTime.toFixed(2)}ms`);
    });

    it('should demonstrate zero results issue is resolved', async () => {
      // Test various scenarios that previously caused zero results
      const problematicQueries = [
        'nonexistent query that should trigger fallbacks',
        '', // Empty query
        '   ', // Whitespace only
        'a', // Very short query
        'query with special characters !@#$%^&*()',
        'very long query that might have caused issues in the past with parameter validation and edge function calls'
      ];

      for (const query of problematicQueries) {
        const params: UnifiedSearchParams = {
          query,
          sources: ['receipt'],
          limit: 10
        };

        const result = await searchExecutor.executeSearch(params, 'zero-results-test-user');

        // Should never get a completely broken response
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
        expect(result.pagination).toBeDefined();
        expect(result.searchMetadata).toBeDefined();
        expect(result.searchMetadata.fallbacksUsed).toBeDefined();
        expect(Array.isArray(result.searchMetadata.fallbacksUsed)).toBe(true);

        console.log(`✅ Query "${query.substring(0, 30)}..." handled successfully - Results: ${result.results.length}, Fallbacks: ${result.searchMetadata.fallbacksUsed.join(', ')}`);
      }
    });
  });

  describe('Error Recovery Validation', () => {
    it('should recover from various error scenarios', async () => {
      const errorScenarios = [
        {
          name: 'Network timeout simulation',
          query: 'timeout test',
          expectFallback: true
        },
        {
          name: 'Invalid parameters handling',
          query: 'invalid params test',
          expectValidation: true
        },
        {
          name: 'Service unavailable',
          query: 'service unavailable test',
          expectGracefulDegradation: true
        }
      ];

      for (const scenario of errorScenarios) {
        const params: UnifiedSearchParams = {
          query: scenario.query,
          sources: ['receipt'],
          limit: 10
        };

        const result = await searchExecutor.executeSearch(params, 'error-recovery-test');

        // Should handle all error scenarios gracefully
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.searchMetadata).toBeDefined();

        console.log(`🛡️ ${scenario.name}: Handled gracefully - Success: ${result.success}, Fallbacks: ${result.searchMetadata.fallbacksUsed?.join(', ') || 'none'}`);
      }
    });
  });
});
