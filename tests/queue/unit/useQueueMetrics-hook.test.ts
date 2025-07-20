/**
 * Enhanced Unit Tests for useQueueMetrics Hook
 * Comprehensive testing of queue metrics hook functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueueMetrics } from '@/hooks/useQueueMetrics';
import { supabase } from '@/lib/supabase';

// Mock Supabase - moved inside vi.mock to avoid hoisting issues
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          order: vi.fn(() => ({ data: [], error: null }))
        })),
        insert: vi.fn(() => ({ data: null, error: null })),
        update: vi.fn(() => ({ data: null, error: null })),
        upsert: vi.fn(() => ({ data: null, error: null }))
      }))
    }))
  }
}));

// Mock fetch for worker API calls
global.fetch = vi.fn();

describe('useQueueMetrics Hook Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    vi.useFakeTimers();

    // Setup default mock responses
    (supabase.rpc as any).mockImplementation((functionName) => {
      switch (functionName) {
        case 'get_queue_statistics':
          return Promise.resolve({
            data: [{
              total_pending: 15,
              total_processing: 3,
              total_completed: 142,
              total_failed: 2,
              total_rate_limited: 1,
              avg_processing_time_ms: 2500,
              active_workers: 2,
              oldest_pending_age_hours: 0.5
            }],
            error: null
          });
        case 'get_queue_config':
          return Promise.resolve({
            data: {
              batch_size: 5,
              max_concurrent_workers: 3,
              queue_enabled: true
            },
            error: null
          });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    (supabase.from as any).mockImplementation((table) => {
      if (table === 'embedding_queue_workers') {
        return {
          select: () => ({
            order: () => ({
              data: [
                {
                  worker_id: 'worker-1',
                  status: 'active',
                  last_heartbeat: new Date().toISOString(),
                  tasks_processed: 25,
                  total_processing_time_ms: 125000,
                  error_count: 2,
                  rate_limit_count: 1
                },
                {
                  worker_id: 'worker-2',
                  status: 'idle',
                  last_heartbeat: new Date(Date.now() - 30000).toISOString(),
                  tasks_processed: 18,
                  total_processing_time_ms: 90000,
                  error_count: 0,
                  rate_limit_count: 0
                }
              ],
              error: null
            })
          })
        };
      }
      return {
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null })
      };
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, workerId: 'worker-new' })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default values', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      expect(result.current.queueMetrics).toBeNull();
      expect(result.current.workers).toEqual([]);
      expect(result.current.config).toEqual({});
      expect(result.current.performanceData).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastUpdateTime).toBeNull();
    });

    it('should load initial data on mount', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.queueMetrics).toBeTruthy();
      expect(result.current.queueMetrics?.total_pending).toBe(15);
      expect(result.current.workers).toHaveLength(2);
      expect(result.current.config.batch_size).toBe(5);
      expect(result.current.performanceData).toBeTruthy();
      expect(result.current.lastUpdateTime).toBeTruthy();
    });

    it('should handle initialization errors gracefully', async () => {
      (supabase.rpc as any).mockRejectedValueOnce(new Error('Database connection failed'));

      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('Database connection failed');
      expect(result.current.queueMetrics).toBeNull();
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('should auto-refresh when enabled', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
      });
    });

    it('should not auto-refresh when disabled', async () => {
      const { result } = renderHook(() => useQueueMetrics(false, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      vi.clearAllMocks();

      // Fast-forward 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not have made additional calls
      expect((supabase.rpc as any)).not.toHaveBeenCalled();
    });

    it('should cleanup intervals on unmount', async () => {
      const { result, unmount } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      unmount();
      vi.clearAllMocks();

      // Fast-forward past refresh interval
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not make any calls after unmount
      expect((supabase.rpc as any)).not.toHaveBeenCalled();
    });
  });

  describe('Performance Data Calculation', () => {
    it('should calculate performance metrics correctly', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.performanceData).toBeTruthy();
      });

      const perfData = result.current.performanceData!;
      
      // Check throughput calculation
      expect(perfData.throughput_per_hour).toBeGreaterThan(0);
      
      // Check success rate calculation
      const totalProcessed = 142 + 2; // completed + failed
      const expectedSuccessRate = (142 / totalProcessed) * 100;
      expect(perfData.success_rate).toBeCloseTo(expectedSuccessRate, 1);
      
      // Check worker efficiency
      expect(perfData.worker_efficiency).toBeGreaterThanOrEqual(0);
      expect(perfData.worker_efficiency).toBeLessThanOrEqual(100);
      
      // Check health score
      expect(perfData.queue_health_score).toBeGreaterThanOrEqual(0);
      expect(perfData.queue_health_score).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases in performance calculation', async () => {
      // Mock edge case data
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{
          total_pending: 0,
          total_processing: 0,
          total_completed: 0,
          total_failed: 0,
          total_rate_limited: 0,
          avg_processing_time_ms: 0,
          active_workers: 0,
          oldest_pending_age_hours: 0
        }],
        error: null
      });

      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.performanceData).toBeTruthy();
      });

      const perfData = result.current.performanceData!;
      
      // Should handle division by zero gracefully
      expect(perfData.success_rate).toBe(100); // Default when no items processed
      expect(perfData.worker_efficiency).toBe(0);
      expect(perfData.queue_health_score).toBeLessThan(100); // Should be penalized for no workers
    });

    it('should update performance data when metrics change', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.performanceData).toBeTruthy();
      });

      const initialHealthScore = result.current.performanceData!.queue_health_score;

      // Mock degraded performance
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{
          total_pending: 200, // High backlog
          total_processing: 1,
          total_completed: 100,
          total_failed: 50, // High failure rate
          total_rate_limited: 25,
          avg_processing_time_ms: 8000, // Slow processing
          active_workers: 1, // Low worker count
          oldest_pending_age_hours: 3 // Old items
        }],
        error: null
      });

      await act(async () => {
        await result.current.refreshData();
      });

      const newHealthScore = result.current.performanceData!.queue_health_score;
      expect(newHealthScore).toBeLessThan(initialHealthScore);
    });
  });

  describe('Manual Refresh', () => {
    it('should refresh data manually', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Mock updated data
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{
          total_pending: 20,
          total_processing: 5,
          total_completed: 150,
          total_failed: 3,
          total_rate_limited: 2,
          avg_processing_time_ms: 3000,
          active_workers: 3,
          oldest_pending_age_hours: 0.3
        }],
        error: null
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.queueMetrics?.total_pending).toBe(20);
      expect(result.current.queueMetrics?.active_workers).toBe(3);
    });

    it('should handle refresh errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (supabase.rpc as any).mockRejectedValueOnce(new Error('Refresh failed'));

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('Refresh failed');
    });

    it('should set refreshing state during manual refresh', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Mock slow response
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      (supabase.rpc as any).mockReturnValueOnce(slowPromise);

      // Start refresh
      act(() => {
        result.current.refreshData();
      });

      // Should be in refreshing state
      expect(result.current.isRefreshing).toBe(true);

      // Complete the promise
      act(() => {
        resolvePromise!({
          data: [{ total_pending: 25, total_processing: 2, total_completed: 160, total_failed: 1, total_rate_limited: 0, avg_processing_time_ms: 2000, active_workers: 2, oldest_pending_age_hours: 0.2 }],
          error: null
        });
      });

      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false);
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.config).toBeTruthy();
      });

      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: null
      });

      await act(async () => {
        await result.current.updateConfig('batch_size', 10);
      });

      expect((supabase.rpc as any)).toHaveBeenCalledWith('update_queue_config', {
        config_key_param: 'batch_size',
        config_value_param: 10,
        updated_by_param: null
      });
    });

    it('should handle configuration update errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.config).toBeTruthy();
      });

      (supabase.rpc as any).mockRejectedValueOnce(new Error('Config update failed'));

      await expect(
        act(async () => {
          await result.current.updateConfig('batch_size', 10);
        })
      ).rejects.toThrow('Config update failed');
    });
  });

  describe('Worker Management', () => {
    it('should start worker successfully', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, workerId: 'worker-new' })
      });

      const success = await act(async () => {
        return await result.current.startWorker();
      });

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('embedding-queue-worker?action=start'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle worker start failure', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, message: 'Worker start failed' })
      });

      const success = await act(async () => {
        return await result.current.startWorker();
      });

      expect(success).toBe(false);
    });

    it('should stop worker successfully', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const success = await act(async () => {
        return await result.current.stopWorker();
      });

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('embedding-queue-worker?action=stop'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should get worker status', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      const mockStatus = { active: true, workerId: 'worker-1', tasksProcessed: 25 };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus)
      });

      const status = await act(async () => {
        return await result.current.getWorkerStatus();
      });

      expect(status).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('embedding-queue-worker?action=status')
      );
    });
  });

  describe('Maintenance Operations', () => {
    it('should requeue failed items', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (supabase.rpc as any).mockResolvedValueOnce({
        data: 5,
        error: null
      });

      const count = await act(async () => {
        return await result.current.requeFailedItems(10);
      });

      expect(count).toBe(5);
      expect((supabase.rpc as any)).toHaveBeenCalledWith('requeue_failed_items', {
        max_items: 10
      });
    });

    it('should cleanup old items', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (supabase.rpc as any).mockResolvedValueOnce({
        data: 15,
        error: null
      });

      const count = await act(async () => {
        return await result.current.cleanupOldItems();
      });

      expect(count).toBe(15);
      expect((supabase.rpc as any)).toHaveBeenCalledWith('cleanup_old_queue_items');
    });

    it('should reset rate limited items', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (supabase.rpc as any).mockResolvedValueOnce({
        data: 3,
        error: null
      });

      const count = await act(async () => {
        return await result.current.resetRateLimitedItems();
      });

      expect(count).toBe(3);
      expect((supabase.rpc as any)).toHaveBeenCalledWith('reset_rate_limited_items');
    });

    it('should handle maintenance operation errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      (supabase.rpc as any).mockRejectedValueOnce(new Error('Maintenance failed'));

      await expect(
        act(async () => {
          await result.current.requeFailedItems();
        })
      ).rejects.toThrow('Maintenance failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (supabase.rpc as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain('Network error');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear errors on successful refresh', async () => {
      // Start with an error
      (supabase.rpc as any).mockRejectedValueOnce(new Error('Initial error'));

      const { result } = renderHook(() => useQueueMetrics(false));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Mock successful response
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{
          total_pending: 10,
          total_processing: 2,
          total_completed: 100,
          total_failed: 1,
          total_rate_limited: 0,
          avg_processing_time_ms: 2000,
          active_workers: 2,
          oldest_pending_age_hours: 0.1
        }],
        error: null
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.queueMetrics).toBeTruthy();
    });
  });
});
