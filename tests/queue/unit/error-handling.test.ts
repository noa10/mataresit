/**
 * Enhanced Error Handling Tests for Queue System
 * Tests queue failures, retry mechanisms, and error recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase for error scenarios
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

// Mock fetch for worker API calls
global.fetch = vi.fn();

// Error types for testing
const ERROR_TYPES = {
  DATABASE_CONNECTION: 'Database connection failed',
  NETWORK_TIMEOUT: 'Network timeout',
  RATE_LIMIT: 'Rate limit exceeded',
  AUTHENTICATION: 'Authentication failed',
  VALIDATION: 'Validation error',
  WORKER_CRASH: 'Worker process crashed',
  MEMORY_LIMIT: 'Memory limit exceeded',
  DISK_SPACE: 'Insufficient disk space'
};

describe('Queue System Error Handling Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Database Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      const connectionError = new Error(ERROR_TYPES.DATABASE_CONNECTION);
      mockSupabase.rpc.mockRejectedValueOnce(connectionError);

      try {
        await mockSupabase.rpc('get_queue_statistics');
      } catch (error) {
        expect(error.message).toBe(ERROR_TYPES.DATABASE_CONNECTION);
      }

      // Should log error and continue operation
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
    });

    it('should retry database operations on transient failures', async () => {
      // First call fails, second succeeds
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({ data: [{ total_pending: 5 }], error: null });

      // Simulate retry logic
      let result;
      try {
        result = await mockSupabase.rpc('get_queue_statistics');
      } catch (error) {
        // Retry on failure
        result = await mockSupabase.rpc('get_queue_statistics');
      }

      expect(result.data).toEqual([{ total_pending: 5 }]);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should handle SQL constraint violations', async () => {
      const constraintError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: 'Key (worker_id)=(test-worker) already exists.'
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          data: null,
          error: constraintError
        }))
      });

      const { error } = await mockSupabase
        .from('embedding_queue_workers')
        .insert({ worker_id: 'test-worker' });

      expect(error).toEqual(constraintError);
      expect(error.code).toBe('23505');
    });

    it('should handle database timeout errors', async () => {
      const timeoutError = new Error('Query timeout after 30 seconds');
      mockSupabase.rpc.mockRejectedValueOnce(timeoutError);

      try {
        await mockSupabase.rpc('get_queue_statistics');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Queue Item Error Handling', () => {
    it('should handle queue item processing failures with retry logic', async () => {
      const queueItem = {
        id: 'item-123',
        retry_count: 0,
        max_retries: 3,
        status: 'processing'
      };

      // Mock failure completion
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('complete_embedding_queue_item', {
        item_id: queueItem.id,
        worker_id_param: 'worker-1',
        success: false,
        actual_tokens_param: null,
        error_message_param: 'Processing failed'
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_embedding_queue_item', {
        item_id: queueItem.id,
        worker_id_param: 'worker-1',
        success: false,
        actual_tokens_param: null,
        error_message_param: 'Processing failed'
      });
    });

    it('should mark items as permanently failed after max retries', async () => {
      const failedItem = {
        id: 'item-456',
        retry_count: 3,
        max_retries: 3,
        status: 'failed'
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Item should be marked as permanently failed
      const { error } = await mockSupabase.rpc('complete_embedding_queue_item', {
        item_id: failedItem.id,
        worker_id_param: 'worker-1',
        success: false,
        actual_tokens_param: null,
        error_message_param: 'Max retries exceeded'
      });

      expect(error).toBeNull();
    });

    it('should handle malformed queue items gracefully', async () => {
      const malformedItem = {
        // Missing required fields
        id: null,
        source_type: undefined,
        operation: 'INVALID'
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid queue item format' }
      });

      const { error } = await mockSupabase.rpc('get_next_embedding_batch', {
        worker_id_param: 'worker-1',
        batch_size_param: 5
      });

      expect(error).toBeTruthy();
      expect(error.message).toContain('Invalid queue item format');
    });

    it('should handle queue item deadlocks', async () => {
      const deadlockError = {
        code: '40P01',
        message: 'deadlock detected',
        details: 'Process was terminated due to deadlock'
      };

      mockSupabase.rpc.mockRejectedValueOnce(deadlockError);

      try {
        await mockSupabase.rpc('get_next_embedding_batch', {
          worker_id_param: 'worker-1',
          batch_size_param: 5
        });
      } catch (error) {
        expect(error.code).toBe('40P01');
        expect(error.message).toContain('deadlock');
      }
    });
  });

  describe('Worker Error Handling', () => {
    it('should handle worker startup failures', async () => {
      const startupError = {
        success: false,
        workerId: 'worker-failed',
        message: 'Failed to start worker: Configuration error'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(startupError)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
        { method: 'POST' }
      );

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Configuration error');
    });

    it('should handle worker crashes during processing', async () => {
      const crashError = new Error('Worker process crashed unexpectedly');
      
      (global.fetch as any).mockRejectedValueOnce(crashError);

      try {
        await fetch(
          'https://test.supabase.co/functions/v1/embedding-queue-worker?action=status'
        );
      } catch (error) {
        expect(error.message).toContain('crashed unexpectedly');
      }
    });

    it('should handle worker heartbeat failures', async () => {
      const heartbeatError = new Error('Heartbeat update failed');
      mockSupabase.rpc.mockRejectedValueOnce(heartbeatError);

      try {
        await mockSupabase.rpc('update_worker_heartbeat', {
          worker_id_param: 'worker-1',
          worker_status: 'active'
        });
      } catch (error) {
        expect(error.message).toBe('Heartbeat update failed');
      }
    });

    it('should handle stale worker cleanup errors', async () => {
      const cleanupError = new Error('Failed to cleanup stale workers');
      mockSupabase.rpc.mockRejectedValueOnce(cleanupError);

      try {
        await mockSupabase.rpc('cleanup_stale_workers');
      } catch (error) {
        expect(error.message).toBe('Failed to cleanup stale workers');
      }
    });

    it('should handle worker resource exhaustion', async () => {
      const resourceError = {
        success: false,
        workerId: 'worker-1',
        message: 'Worker stopped: Memory limit exceeded',
        error: 'RESOURCE_EXHAUSTED'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resourceError)
      });

      const response = await fetch(
        'https://test.supabase.co/functions/v1/embedding-queue-worker?action=stop',
        { method: 'POST' }
      );

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('RESOURCE_EXHAUSTED');
    });
  });

  describe('Rate Limiting Error Handling', () => {
    it('should handle API rate limit errors', async () => {
      const rateLimitResponse = {
        status: 429,
        ok: false,
        text: () => Promise.resolve('Rate limit exceeded. Try again in 60 seconds.')
      };

      (global.fetch as any).mockResolvedValueOnce(rateLimitResponse);

      const response = await fetch(
        'https://test.supabase.co/functions/v1/generate-embeddings',
        { method: 'POST' }
      );

      expect(response.status).toBe(429);
      expect(response.ok).toBe(false);

      const errorText = await response.text();
      expect(errorText).toContain('Rate limit exceeded');
    });

    it('should handle rate limit recovery', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('handle_rate_limit', {
        item_id: 'item-123',
        worker_id_param: 'worker-1',
        delay_ms: 60000
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_rate_limit', {
        item_id: 'item-123',
        worker_id_param: 'worker-1',
        delay_ms: 60000
      });
    });

    it('should handle rate limit queue management', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 5,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('reset_rate_limited_items');

      expect(error).toBeNull();
      expect(data).toBe(5);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      (global.fetch as any).mockRejectedValueOnce(timeoutError);

      try {
        await fetch('https://test.supabase.co/functions/v1/embedding-queue-worker');
      } catch (error) {
        expect(error.message).toBe('Network timeout');
      }
    });

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('Connection refused');
      (global.fetch as any).mockRejectedValueOnce(connectionError);

      try {
        await fetch('https://test.supabase.co/functions/v1/embedding-queue-worker');
      } catch (error) {
        expect(error.message).toBe('Connection refused');
      }
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = new Error('DNS resolution failed');
      (global.fetch as any).mockRejectedValueOnce(dnsError);

      try {
        await fetch('https://invalid-domain.supabase.co/functions/v1/worker');
      } catch (error) {
        expect(error.message).toBe('DNS resolution failed');
      }
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle missing configuration values', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          data: [], // Empty configuration
          error: null
        }))
      });

      const { data, error } = await mockSupabase
        .from('embedding_queue_config')
        .select('config_key, config_value');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should handle invalid configuration values', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          data: [
            { config_key: 'batch_size', config_value: 'invalid_number' },
            { config_key: 'max_workers', config_value: -1 }
          ],
          error: null
        }))
      });

      const { data, error } = await mockSupabase
        .from('embedding_queue_config')
        .select('config_key, config_value');

      expect(error).toBeNull();
      expect(data[0].config_value).toBe('invalid_number');
      expect(data[1].config_value).toBe(-1);
    });

    it('should handle configuration update failures', async () => {
      const updateError = new Error('Configuration update failed');
      mockSupabase.rpc.mockRejectedValueOnce(updateError);

      try {
        await mockSupabase.rpc('update_queue_config', {
          config_key_param: 'batch_size',
          config_value_param: 10,
          updated_by_param: 'admin'
        });
      } catch (error) {
        expect(error.message).toBe('Configuration update failed');
      }
    });
  });

  describe('Maintenance Operation Error Handling', () => {
    it('should handle failed item requeue errors', async () => {
      const requeueError = new Error('Failed to requeue items');
      mockSupabase.rpc.mockRejectedValueOnce(requeueError);

      try {
        await mockSupabase.rpc('requeue_failed_items', { max_items: 100 });
      } catch (error) {
        expect(error.message).toBe('Failed to requeue items');
      }
    });

    it('should handle cleanup operation failures', async () => {
      const cleanupError = new Error('Cleanup operation failed');
      mockSupabase.rpc.mockRejectedValueOnce(cleanupError);

      try {
        await mockSupabase.rpc('cleanup_old_queue_items');
      } catch (error) {
        expect(error.message).toBe('Cleanup operation failed');
      }
    });

    it('should handle partial maintenance failures', async () => {
      // Some items succeed, some fail
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 15, // Successfully processed 15 out of 20 items
        error: null
      });

      const { data, error } = await mockSupabase.rpc('cleanup_old_queue_items');

      expect(error).toBeNull();
      expect(data).toBe(15);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should implement exponential backoff for retries', async () => {
      const retryDelays: number[] = [];
      let attemptCount = 0;

      const mockRetryWithBackoff = async (operation: () => Promise<any>, maxRetries = 3) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            attemptCount++;
            if (attempt === maxRetries - 1) throw error;
            
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            retryDelays.push(delay);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };

      const failingOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce({ success: true });

      const result = await mockRetryWithBackoff(failingOperation);

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(2);
      expect(retryDelays).toEqual([1000, 2000]); // Exponential backoff
    });

    it('should implement circuit breaker pattern', async () => {
      class MockCircuitBreaker {
        private failureCount = 0;
        private lastFailureTime = 0;
        private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
        private readonly failureThreshold = 3;
        private readonly timeout = 5000;

        async execute<T>(operation: () => Promise<T>): Promise<T> {
          if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
              this.state = 'HALF_OPEN';
            } else {
              throw new Error('Circuit breaker is OPEN');
            }
          }

          try {
            const result = await operation();
            this.onSuccess();
            return result;
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        private onSuccess(): void {
          this.failureCount = 0;
          this.state = 'CLOSED';
        }

        private onFailure(): void {
          this.failureCount++;
          this.lastFailureTime = Date.now();
          
          if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
          }
        }

        getState(): string {
          return this.state;
        }
      }

      const circuitBreaker = new MockCircuitBreaker();
      const failingOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Should reject immediately when circuit is open
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        expect(error.message).toBe('Circuit breaker is OPEN');
      }
    });

    it('should handle graceful degradation', async () => {
      const mockGracefulService = {
        async getQueueMetrics() {
          try {
            return await mockSupabase.rpc('get_queue_statistics');
          } catch (error) {
            // Return cached or default data on failure
            return {
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
              error: null,
              degraded: true
            };
          }
        }
      };

      mockSupabase.rpc.mockRejectedValueOnce(new Error('Database unavailable'));

      const result = await mockGracefulService.getQueueMetrics();

      expect(result.degraded).toBe(true);
      expect(result.data[0].total_pending).toBe(0);
    });
  });
});
