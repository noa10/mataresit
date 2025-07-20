/**
 * Unit Tests for Queue Management Admin Interface
 * Tests the React components for queue administration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmbeddingQueueManagement } from '@/components/admin/EmbeddingQueueManagement';

// Mock hooks and dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({ data: [], error: null }))
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock fetch for worker API calls
global.fetch = vi.fn();

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  }
});

describe('EmbeddingQueueManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    
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
      } else if (table === 'embedding_queue_config') {
        return {
          select: () => ({
            data: [
              { config_key: 'queue_enabled', config_value: true },
              { config_key: 'batch_size', config_value: 5 },
              { config_key: 'max_concurrent_workers', config_value: 3 }
            ],
            error: null
          })
        };
      }
      return {
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null })
      };
    });

    // Mock worker status API
    (global.fetch as any).mockImplementation((url) => {
      if (url.includes('action=status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            worker: {
              workerId: 'worker-test-123',
              isRunning: true,
              processedCount: 10,
              errorCount: 0
            },
            isRunning: true
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  describe('Component Rendering', () => {
    it('should render queue statistics correctly', async () => {
      render(<EmbeddingQueueManagement />);

      await waitFor(() => {
        expect(screen.getByText('Queue Management')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument(); // pending items
        expect(screen.getByText('3')).toBeInTheDocument(); // processing items
        expect(screen.getByText('142')).toBeInTheDocument(); // completed items
      });
    });

    it('should render worker management section', async () => {
      render(<EmbeddingQueueManagement />);

      await waitFor(() => {
        expect(screen.getByText('Worker Control')).toBeInTheDocument();
        expect(screen.getByText('Start Worker')).toBeInTheDocument();
        expect(screen.getByText('Stop Worker')).toBeInTheDocument();
      });
    });

    it('should render configuration section', async () => {
      render(<EmbeddingQueueManagement />);

      // Click on Configuration tab
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        expect(screen.getByText('Queue Configuration')).toBeInTheDocument();
        expect(screen.getByLabelText('Queue Processing Enabled')).toBeInTheDocument();
        expect(screen.getByLabelText('Batch Size')).toBeInTheDocument();
      });
    });

    it('should render maintenance section', async () => {
      render(<EmbeddingQueueManagement />);

      // Click on Maintenance tab
      fireEvent.click(screen.getByText('Maintenance'));

      await waitFor(() => {
        expect(screen.getByText('Queue Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Requeue Failed Items')).toBeInTheDocument();
        expect(screen.getByText('Cleanup Old Items')).toBeInTheDocument();
      });
    });
  });

  describe('Worker Control', () => {
    it('should start worker when start button is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          workerId: 'worker-new-123',
          message: 'Worker started successfully'
        })
      });

      render(<EmbeddingQueueManagement />);

      const startButton = screen.getByText('Start Worker');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-anon-key'
            })
          })
        );
      });
    });

    it('should stop worker when stop button is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Worker stopped successfully'
        })
      });

      render(<EmbeddingQueueManagement />);

      const stopButton = screen.getByText('Stop Worker');
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://test.supabase.co/functions/v1/embedding-queue-worker?action=stop',
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration when values change', async () => {
      render(<EmbeddingQueueManagement />);

      // Click on Configuration tab
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        const batchSizeInput = screen.getByLabelText('Batch Size');
        expect(batchSizeInput).toBeInTheDocument();

        // Change batch size
        fireEvent.change(batchSizeInput, { target: { value: '10' } });
      });

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('update_queue_config', {
          config_key_param: 'batch_size',
          config_value_param: 10,
          updated_by_param: null
        });
      });
    });

    it('should toggle queue enabled status', async () => {
      render(<EmbeddingQueueManagement />);

      // Click on Configuration tab
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        const enabledSwitch = screen.getByLabelText('Queue Processing Enabled');
        expect(enabledSwitch).toBeInTheDocument();

        // Toggle the switch
        fireEvent.click(enabledSwitch);
      });

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('update_queue_config', {
          config_key_param: 'queue_enabled',
          config_value_param: false, // Should toggle from true to false
          updated_by_param: null
        });
      });
    });
  });

  describe('Maintenance Operations', () => {
    it('should requeue failed items when button is clicked', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 5,
        error: null
      });

      render(<EmbeddingQueueManagement />);

      // Click on Maintenance tab
      fireEvent.click(screen.getByText('Maintenance'));

      const requeueButton = screen.getByText('Requeue Failed Items');
      fireEvent.click(requeueButton);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('requeue_failed_items', {
          max_items: 100
        });
      });
    });

    it('should cleanup old items when button is clicked', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 25,
        error: null
      });

      render(<EmbeddingQueueManagement />);

      // Click on Maintenance tab
      fireEvent.click(screen.getByText('Maintenance'));

      const cleanupButton = screen.getByText('Cleanup Old Items');
      fireEvent.click(cleanupButton);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_queue_items');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Database connection failed'));

      render(<EmbeddingQueueManagement />);

      // Component should still render even with API errors
      await waitFor(() => {
        expect(screen.getByText('Queue Management')).toBeInTheDocument();
      });
    });

    it('should handle worker API errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<EmbeddingQueueManagement />);

      const startButton = screen.getByText('Start Worker');
      fireEvent.click(startButton);

      // Should handle the error without crashing
      await waitFor(() => {
        expect(screen.getByText('Start Worker')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data automatically', async () => {
      vi.useFakeTimers();

      render(<EmbeddingQueueManagement />);

      // Fast-forward 10 seconds (auto-refresh interval)
      vi.advanceTimersByTime(10000);

      await waitFor(() => {
        // Should have called the statistics function multiple times
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
      });

      vi.useRealTimers();
    });

    it('should refresh data when refresh button is clicked', async () => {
      render(<EmbeddingQueueManagement />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
      });
    });
  });
});
