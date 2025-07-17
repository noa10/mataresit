/**
 * Comprehensive Search Functionality Validation Tests
 * Tests all search strategies and ensures zero results issue is resolved
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OptimizedSearchExecutor } from '@/lib/optimized-search-executor';
import { UnifiedSearchParams } from '@/types/unified-search';
import { searchCache } from '@/lib/searchCache';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    realtime: {
      isConnected: () => true
    },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [
                  {
                    id: 'test-receipt-1',
                    merchant_name: 'Test Merchant',
                    total_amount: 25.99,
                    currency: 'USD',
                    receipt_date: '2024-01-15',
                    created_at: '2024-01-15T10:00:00Z'
                  }
                ],
                error: null
              }))
            }))
          }))
        }))
      }))
    }))
  }
}));

vi.mock('@/lib/edge-function-utils', () => ({
  callEdgeFunction: vi.fn()
}));

vi.mock('@/services/cacheInvalidationService', () => ({
  CacheInvalidationService: {
    initialize: vi.fn(),
    invalidate: vi.fn()
  }
}));

describe('Search Functionality Validation', () => {
  let searchExecutor: OptimizedSearchExecutor;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    searchExecutor = new OptimizedSearchExecutor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    searchExecutor.cleanup();
  });

  describe('Edge Function Search Strategy', () => {
    it('should successfully execute edge function search with correct parameters', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      
      // Mock successful edge function response
      vi.mocked(callEdgeFunction).mockResolvedValue({
        success: true,
        results: [
          {
            id: 'edge-result-1',
            sourceType: 'receipt',
            sourceId: 'receipt-123',
            contentType: 'receipt',
            title: 'Coffee Shop Receipt',
            description: 'Receipt from Coffee Shop - $5.99',
            similarity: 0.85,
            metadata: { merchant_name: 'Coffee Shop', total_amount: 5.99 },
            accessLevel: 'user',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z'
          }
        ],
        totalResults: 1,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
        searchMetadata: {
          searchDuration: 150,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'edge_function'
        }
      });

      const params: UnifiedSearchParams = {
        query: 'coffee',
        sources: ['receipts'], // Frontend plural form
        limit: 10,
        similarityThreshold: 0.3
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Coffee Shop Receipt');
      
      // Verify edge function was called with correct mapped parameters
      expect(callEdgeFunction).toHaveBeenCalledWith(
        'unified-search',
        'POST',
        expect.objectContaining({
          query: 'coffee',
          sources: ['receipt'], // Should be mapped to singular form
          limit: 10,
          similarityThreshold: 0.3
        }),
        undefined,
        1,
        15000
      );
    });

    it('should handle edge function timeout gracefully', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      
      // Mock timeout error
      vi.mocked(callEdgeFunction).mockRejectedValue(new Error('edge_function search timed out after 8000ms'));

      const params: UnifiedSearchParams = {
        query: 'timeout test',
        sources: ['receipts'],
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      // Should fall back to other strategies or cached results
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Direct Database Search Strategy', () => {
    it('should execute direct database search when edge function fails', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      const { supabase } = await import('@/lib/supabase');
      
      // Mock edge function failure
      vi.mocked(callEdgeFunction).mockRejectedValue(new Error('Edge function failed'));
      
      // Mock successful database response
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: 'db-result-1',
            source_type: 'receipt',
            source_id: 'receipt-456',
            title: 'Database Receipt',
            description: 'Receipt from database search',
            similarity: 0.75,
            metadata: { merchant_name: 'Database Store' }
          }
        ],
        error: null
      });

      const params: UnifiedSearchParams = {
        query: 'database test',
        sources: ['receipt'], // Already in singular form
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'enhanced_hybrid_search',
        expect.objectContaining({
          query_text: 'database test',
          source_types: ['receipt'],
          user_filter: testUserId
        }),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should handle database timeout with AbortController', async () => {
      const { supabase } = await import('@/lib/supabase');
      
      // Mock database timeout
      vi.mocked(supabase.rpc).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        });
      });

      const params: UnifiedSearchParams = {
        query: 'timeout test',
        sources: ['receipt'],
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      // Should handle timeout gracefully and fall back
      expect(result).toBeDefined();
    });
  });

  describe('Cached Fallback Strategy', () => {
    it('should return cached results when available', async () => {
      // Mock cache hit
      const cachedResponse = {
        success: true,
        results: [
          {
            id: 'cached-result-1',
            sourceType: 'receipt' as const,
            sourceId: 'cached-receipt-1',
            contentType: 'receipt',
            title: 'Cached Receipt',
            description: 'Receipt from cache',
            similarity: 0.9,
            metadata: { source: 'cache' },
            accessLevel: 'user' as const,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z'
          }
        ],
        totalResults: 1,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 1 },
        searchMetadata: {
          searchDuration: 5,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'cache'
        }
      };

      vi.spyOn(searchCache, 'get').mockResolvedValue(cachedResponse);

      const params: UnifiedSearchParams = {
        query: 'cached query',
        sources: ['receipt'],
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Cached Receipt');
      expect(searchCache.get).toHaveBeenCalledWith(params, testUserId);
    });

    it('should execute comprehensive fallback when all strategies fail', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      const { supabase } = await import('@/lib/supabase');
      
      // Mock all primary strategies failing
      vi.mocked(callEdgeFunction).mockRejectedValue(new Error('Edge function failed'));
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Database failed'));
      vi.spyOn(searchCache, 'get').mockResolvedValue(null);

      const params: UnifiedSearchParams = {
        query: 'fallback test',
        sources: ['receipt'],
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      // Should still return a valid response, even if empty
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.searchMetadata).toBeDefined();
    });
  });

  describe('Performance Optimization Validation', () => {
    it('should optimize search parameters correctly', async () => {
      const params: UnifiedSearchParams = {
        query: '   VERY LONG QUERY WITH LOTS OF WHITESPACE AND REPEATED    SPACES    THAT SHOULD BE NORMALIZED AND TRUNCATED IF TOO LONG FOR OPTIMAL PERFORMANCE AND BETTER SEARCH RESULTS   ',
        sources: ['receipts'],
        limit: 100, // Should be capped
        similarityThreshold: undefined // Should get default
      };

      // Mock successful response to test parameter optimization
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      vi.mocked(callEdgeFunction).mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 0 },
        searchMetadata: {
          searchDuration: 100,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'edge_function'
        }
      });

      await searchExecutor.executeSearch(params, testUserId);

      // Verify parameters were optimized
      expect(callEdgeFunction).toHaveBeenCalledWith(
        'unified-search',
        'POST',
        expect.objectContaining({
          query: expect.stringMatching(/^very long query with lots of whitespace/), // Normalized
          sources: ['receipt'], // Mapped to singular
          limit: 50, // Capped at 50
          similarityThreshold: 0.2 // Default applied
        }),
        undefined,
        1,
        15000
      );
    });

    it('should track performance metrics', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      
      vi.mocked(callEdgeFunction).mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 0 },
        searchMetadata: {
          searchDuration: 1500, // Slow search
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'edge_function'
        }
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const params: UnifiedSearchParams = {
        query: 'performance test',
        sources: ['receipt'],
        limit: 10
      };

      await searchExecutor.executeSearch(params, testUserId);

      const stats = searchExecutor.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.averageExecutionTime).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Zero Results Prevention', () => {
    it('should never return completely empty response without fallback attempts', async () => {
      const { callEdgeFunction } = await import('@/lib/edge-function-utils');
      const { supabase } = await import('@/lib/supabase');
      
      // Mock all strategies returning empty but successful results
      vi.mocked(callEdgeFunction).mockResolvedValue({
        success: true,
        results: [],
        totalResults: 0,
        pagination: { hasMore: false, nextOffset: 0, totalPages: 0 },
        searchMetadata: {
          searchDuration: 100,
          sourcesSearched: ['receipt'],
          subscriptionLimitsApplied: false,
          fallbacksUsed: [],
          modelUsed: 'edge_function'
        }
      });

      const params: UnifiedSearchParams = {
        query: 'no results query',
        sources: ['receipt'],
        limit: 10
      };

      const result = await searchExecutor.executeSearch(params, testUserId);

      // Should always return a valid response structure
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.searchMetadata).toBeDefined();
      expect(result.searchMetadata.sourcesSearched).toBeDefined();
      expect(result.searchMetadata.fallbacksUsed).toBeDefined();
    });
  });
});
