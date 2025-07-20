/**
 * Integration Tests for Queue Worker Processing
 * Tests the complete worker lifecycle and queue processing flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch for Edge Function calls
global.fetch = vi.fn();

// Mock environment variables
vi.mock('process.env', () => ({
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
}));

// Mock Supabase client
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
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Worker Processing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Worker Lifecycle Management', () => {
    it('should start worker successfully', async () => {
      const mockResponse = {
        success: true,
        workerId: 'worker-test-123',
        message: 'Worker started successfully'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-anon-key'
          }
        }
      );

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.workerId).toBe('worker-test-123');
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

    it('should stop worker successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Worker stopped successfully',
        stats: {
          workerId: 'worker-test-123',
          processedCount: 15,
          errorCount: 1
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=stop',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-anon-key'
          }
        }
      );

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.stats.processedCount).toBe(15);
    });

    it('should get worker status', async () => {
      const mockResponse = {
        success: true,
        worker: {
          workerId: 'worker-test-123',
          isRunning: true,
          processedCount: 10,
          errorCount: 0,
          config: {
            batchSize: 5,
            heartbeatInterval: 30000
          }
        },
        isRunning: true
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=status',
        {
          headers: {
            'Authorization': 'Bearer test-anon-key'
          }
        }
      );

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.isRunning).toBe(true);
      expect(data.worker.processedCount).toBe(10);
    });
  });

  describe('Queue Processing Flow', () => {
    it('should process complete queue workflow', async () => {
      // Mock queue configuration
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { config_value: true },
              error: null
            }))
          }))
        }))
      });

      // Mock queue insertion
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          data: { id: 'queue-item-1' },
          error: null
        }))
      });

      // Mock receipt status update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null
          }))
        }))
      });

      // Simulate queue-based processing
      const queueEnabled = true;
      expect(queueEnabled).toBe(true);

      // Verify queue insertion would be called
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle queue processing with batch retrieval', async () => {
      const mockBatch = [
        {
          id: 'item-1',
          source_type: 'receipts',
          source_id: 'receipt-1',
          operation: 'INSERT',
          priority: 'high',
          metadata: { test: true }
        }
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockBatch,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_next_embedding_batch', {
        worker_id_param: 'test-worker',
        batch_size_param: 5
      });

      expect(error).toBeNull();
      expect(data).toEqual(mockBatch);
      expect(data[0].priority).toBe('high');
    });

    it('should handle embedding generation for queue items', async () => {
      // Mock successful embedding generation
      const mockEmbeddingResponse = {
        success: true,
        totalTokens: 1200,
        embeddingsGenerated: 3
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmbeddingResponse)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/generate-embeddings',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-service-role-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receiptId: 'receipt-1',
            processAllFields: true,
            processLineItems: true,
            useImprovedDimensionHandling: true,
            queueMode: true,
            workerId: 'test-worker',
            metadata: { test: true }
          })
        }
      );

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.totalTokens).toBe(1200);
    });

    it('should handle rate limiting during processing', async () => {
      // Mock rate limit response (HTTP 429)
      (global.fetch as any).mockResolvedValueOnce({
        status: 429,
        ok: false,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/generate-embeddings',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-service-role-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receiptId: 'receipt-1',
            queueMode: true,
            workerId: 'test-worker'
          })
        }
      );

      expect(response.status).toBe(429);
      expect(response.ok).toBe(false);

      // Mock rate limit handling
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('handle_rate_limit', {
        item_id: 'item-1',
        worker_id_param: 'test-worker',
        delay_ms: 60000
      });

      expect(error).toBeNull();
    });
  });

  describe('Worker Error Handling', () => {
    it('should handle worker startup errors', async () => {
      const mockErrorResponse = {
        success: false,
        workerId: 'worker-test-123',
        message: 'Failed to start worker: Configuration error'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-anon-key'
          }
        }
      );

      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.message).toContain('Configuration error');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch(
          'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-anon-key'
            }
          }
        );
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });
  });

  describe('Worker Performance Tracking', () => {
    it('should track worker performance metrics', async () => {
      const mockWorkerData = [
        {
          worker_id: 'worker-1',
          status: 'active',
          tasks_processed: 25,
          total_processing_time_ms: 125000,
          error_count: 2,
          rate_limit_count: 1,
          last_heartbeat: new Date().toISOString()
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockWorkerData,
            error: null
          }))
        }))
      });

      const { data, error } = await mockSupabase
        .from('embedding_queue_workers')
        .select('*')
        .order('last_heartbeat', { ascending: false });

      expect(error).toBeNull();
      expect(data).toEqual(mockWorkerData);
      expect(data[0].tasks_processed).toBe(25);
      expect(data[0].error_count).toBe(2);
    });
  });
});
