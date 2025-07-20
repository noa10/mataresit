/**
 * Real-time Functionality Tests for Queue System
 * Tests WebSocket connections, live updates, and real-time metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueueMetrics } from '@/hooks/useQueueMetrics';

// Mock Supabase for real-time subscriptions
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
  unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' }),
  send: vi.fn()
};

const mockSupabase = {
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
  })),
  channel: vi.fn(() => mockChannel)
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock timers for interval testing
vi.mock('timers', () => ({
  setInterval: vi.fn(),
  clearInterval: vi.fn()
}));

describe('Real-time Queue Functionality Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mock responses
    mockSupabase.rpc.mockImplementation((functionName) => {
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
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    mockSupabase.from.mockImplementation((table) => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Auto-refresh Functionality', () => {
    it('should automatically refresh queue metrics at specified intervals', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 5000));

      // Initial load
      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Fast-forward 5 seconds (refresh interval)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
      });
    });

    it('should not auto-refresh when disabled', async () => {
      const { result } = renderHook(() => useQueueMetrics(false, 5000));

      // Initial load
      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Fast-forward 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not have made additional calls
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle different refresh intervals', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 2000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      vi.clearAllMocks();

      // Fast-forward 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
      });
    });

    it('should cleanup intervals on unmount', async () => {
      const { result, unmount } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Unmount the hook
      unmount();

      vi.clearAllMocks();

      // Fast-forward past refresh interval
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not make any calls after unmount
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('Real-time Data Updates', () => {
    it('should handle real-time queue statistics updates', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Simulate real-time update with new data
      const updatedMetrics = {
        total_pending: 20,
        total_processing: 5,
        total_completed: 150,
        total_failed: 3,
        total_rate_limited: 2,
        avg_processing_time_ms: 2800,
        active_workers: 3,
        oldest_pending_age_hours: 0.3
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [updatedMetrics],
        error: null
      });

      // Trigger manual refresh
      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.queueMetrics).toEqual(updatedMetrics);
    });

    it('should handle worker status updates in real-time', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.workers).toHaveLength(1);
      });

      // Simulate new worker joining
      const updatedWorkers = [
        {
          worker_id: 'worker-1',
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          tasks_processed: 30,
          total_processing_time_ms: 150000,
          error_count: 2,
          rate_limit_count: 1
        },
        {
          worker_id: 'worker-2',
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          tasks_processed: 15,
          total_processing_time_ms: 75000,
          error_count: 0,
          rate_limit_count: 0
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            data: updatedWorkers,
            error: null
          })
        })
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.workers).toHaveLength(2);
      expect(result.current.workers[1].worker_id).toBe('worker-2');
    });

    it('should update performance data in real-time', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.performanceData).toBeTruthy();
      });

      const initialHealthScore = result.current.performanceData?.queue_health_score;

      // Simulate performance degradation
      const degradedMetrics = {
        total_pending: 100, // High pending count
        total_processing: 2,
        total_completed: 150,
        total_failed: 15, // High failure rate
        total_rate_limited: 10,
        avg_processing_time_ms: 5000, // Slow processing
        active_workers: 1, // Low worker count
        oldest_pending_age_hours: 2.5 // Old pending items
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [degradedMetrics],
        error: null
      });

      await act(async () => {
        await result.current.refreshData();
      });

      const newHealthScore = result.current.performanceData?.queue_health_score;
      expect(newHealthScore).toBeLessThan(initialHealthScore || 100);
    });
  });

  describe('Live Metrics Streaming', () => {
    it('should establish WebSocket connection for live updates', async () => {
      // Mock WebSocket-like behavior through Supabase channels
      const channelName = 'queue_metrics_live';
      
      mockSupabase.channel.mockReturnValueOnce(mockChannel);

      // Simulate establishing a live connection
      const mockHandler = vi.fn();
      
      // Setup channel subscription
      mockChannel.on.mockImplementation((event, config, handler) => {
        if (event === 'postgres_changes') {
          // Store handler for later simulation
          setTimeout(() => {
            handler({
              eventType: 'UPDATE',
              new: {
                total_pending: 18,
                total_processing: 4,
                active_workers: 2
              },
              old: {
                total_pending: 15,
                total_processing: 3,
                active_workers: 2
              }
            });
          }, 100);
        }
        return mockChannel;
      });

      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Verify channel was created
      expect(mockSupabase.channel).toHaveBeenCalledWith(expect.any(String));
      expect(mockChannel.on).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockChannel.subscribe.mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.error).toBeNull(); // Should not propagate connection errors
        expect(result.current.queueMetrics).toBeTruthy(); // Should still work with polling
      });
    });

    it('should reconnect on connection loss', async () => {
      let subscribeCallCount = 0;
      mockChannel.subscribe.mockImplementation(() => {
        subscribeCallCount++;
        if (subscribeCallCount === 1) {
          return Promise.reject(new Error('Connection lost'));
        }
        return Promise.resolve({ status: 'SUBSCRIBED' });
      });

      const { result } = renderHook(() => useQueueMetrics(true, 30000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Should have attempted reconnection
      expect(subscribeCallCount).toBeGreaterThan(1);
    });
  });

  describe('Real-time Error Handling', () => {
    it('should handle real-time data fetch errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Simulate error on next refresh
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Database connection lost'));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain('Database connection lost');
      });
    });

    it('should recover from temporary errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      // Simulate temporary error
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Temporary error'));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Restore normal operation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          total_pending: 10,
          total_processing: 2,
          total_completed: 200,
          total_failed: 1,
          total_rate_limited: 0,
          avg_processing_time_ms: 2000,
          active_workers: 2,
          oldest_pending_age_hours: 0.2
        }],
        error: null
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.queueMetrics?.total_pending).toBe(10);
      });
    });

    it('should maintain data integrity during errors', async () => {
      const { result } = renderHook(() => useQueueMetrics(true, 5000));

      await waitFor(() => {
        expect(result.current.queueMetrics).toBeTruthy();
      });

      const originalMetrics = result.current.queueMetrics;

      // Simulate error
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        // Should keep previous data
        expect(result.current.queueMetrics).toEqual(originalMetrics);
      });
    });
  });
});
