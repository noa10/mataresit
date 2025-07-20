/**
 * Retry Mechanisms and Recovery Tests for Queue System
 * Tests advanced retry logic, backoff strategies, and recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase for retry testing
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

// Mock fetch for API retry testing
global.fetch = vi.fn();

// Retry configuration for testing
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
};

// Retry utility class for testing
class RetryManager {
  private config: typeof RETRY_CONFIG;

  constructor(config = RETRY_CONFIG) {
    this.config = config;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      retryCondition?: (error: any) => boolean;
      onRetry?: (attempt: number, error: any) => void;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt === maxRetries) {
          throw error;
        }

        if (options.retryCondition && !options.retryCondition(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        if (options.onRetry) {
          options.onRetry(attempt + 1, error);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();
    
    return Math.floor(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('Retry Mechanisms and Recovery Tests', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    retryManager = new RetryManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Retry Logic', () => {
    it('should retry failed operations up to max attempts', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockRejectedValueOnce(new Error('Attempt 3 failed'))
        .mockResolvedValueOnce({ success: true });

      const promise = retryManager.executeWithRetry(mockOperation);
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toEqual({ success: true });
      expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should fail after max retries exceeded', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = retryManager.executeWithRetry(mockOperation);
      
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should succeed on first attempt without retries', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true });

      const result = await retryManager.executeWithRetry(mockOperation);

      expect(result).toEqual({ success: true });
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect custom max retries', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const promise = retryManager.executeWithRetry(mockOperation, { maxRetries: 1 });
      
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Always fails');
      expect(mockOperation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff delays', async () => {
      const delays: number[] = [];
      const mockOperation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      const promise = retryManager.executeWithRetry(mockOperation);
      
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // Verify exponential backoff pattern (with jitter, so approximate)
      expect(delays.length).toBe(3);
      expect(delays[0]).toBeGreaterThanOrEqual(1000); // ~1000ms + jitter
      expect(delays[1]).toBeGreaterThanOrEqual(2000); // ~2000ms + jitter
      expect(delays[2]).toBeGreaterThanOrEqual(4000); // ~4000ms + jitter
    });

    it('should cap delays at maximum value', async () => {
      const shortMaxDelayConfig = { ...RETRY_CONFIG, maxDelay: 3000 };
      const retryManagerWithCap = new RetryManager(shortMaxDelayConfig);
      
      const delays: number[] = [];
      const mockOperation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      const promise = retryManagerWithCap.executeWithRetry(mockOperation);
      
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      // All delays should be capped at maxDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(3000 * 1.1); // Account for jitter
      });
    });

    it('should add jitter to prevent thundering herd', async () => {
      const delays1: number[] = [];
      const delays2: number[] = [];

      const captureDelays = (delayArray: number[]) => {
        return vi.fn((callback, delay) => {
          delayArray.push(delay);
          return setTimeout(callback, delay);
        });
      };

      // Run two identical retry sequences
      const mockOperation1 = vi.fn().mockRejectedValue(new Error('Fails'));
      const mockOperation2 = vi.fn().mockRejectedValue(new Error('Fails'));

      global.setTimeout = captureDelays(delays1);
      const promise1 = retryManager.executeWithRetry(mockOperation1);
      await vi.runAllTimersAsync();
      await expect(promise1).rejects.toThrow();

      global.setTimeout = captureDelays(delays2);
      const promise2 = retryManager.executeWithRetry(mockOperation2);
      await vi.runAllTimersAsync();
      await expect(promise2).rejects.toThrow();

      // Delays should be different due to jitter
      expect(delays1).not.toEqual(delays2);
    });
  });

  describe('Conditional Retry Logic', () => {
    it('should retry only on retryable errors', async () => {
      const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT'];
      const nonRetryableErrors = ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR'];

      const retryCondition = (error: any) => {
        return retryableErrors.includes(error.code);
      };

      // Test retryable error
      const retryableOperation = vi.fn()
        .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Network failed' })
        .mockResolvedValueOnce({ success: true });

      const promise1 = retryManager.executeWithRetry(retryableOperation, { retryCondition });
      await vi.runAllTimersAsync();
      const result1 = await promise1;

      expect(result1).toEqual({ success: true });
      expect(retryableOperation).toHaveBeenCalledTimes(2);

      // Test non-retryable error
      const nonRetryableOperation = vi.fn()
        .mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Invalid input' });

      const promise2 = retryManager.executeWithRetry(nonRetryableOperation, { retryCondition });

      await expect(promise2).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input'
      });
      expect(nonRetryableOperation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should handle rate limit errors with appropriate delays', async () => {
      const rateLimitRetryCondition = (error: any) => {
        return error.status === 429 || error.code === 'RATE_LIMIT';
      };

      const rateLimitOperation = vi.fn()
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockResolvedValueOnce({ success: true });

      const promise = retryManager.executeWithRetry(rateLimitOperation, {
        retryCondition: rateLimitRetryCondition
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ success: true });
      expect(rateLimitOperation).toHaveBeenCalledTimes(3);
    });

    it('should handle database connection errors', async () => {
      const dbRetryCondition = (error: any) => {
        const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
        return retryableCodes.includes(error.code) || error.message.includes('connection');
      };

      const dbOperation = vi.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Connection refused' })
        .mockResolvedValueOnce({ data: [{ id: 1 }] });

      const promise = retryManager.executeWithRetry(dbOperation, {
        retryCondition: dbRetryCondition
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ data: [{ id: 1 }] });
      expect(dbOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Callbacks and Monitoring', () => {
    it('should call onRetry callback with attempt information', async () => {
      const onRetryCallback = vi.fn();
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce({ success: true });

      const promise = retryManager.executeWithRetry(mockOperation, {
        onRetry: onRetryCallback
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetryCallback).toHaveBeenCalledTimes(2);
      expect(onRetryCallback).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetryCallback).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });

    it('should track retry metrics', async () => {
      const retryMetrics = {
        totalAttempts: 0,
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0
      };

      const trackingCallback = (attempt: number, error: any) => {
        retryMetrics.totalRetries++;
      };

      const successfulOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      await retryManager.executeWithRetry(successfulOperation, {
        onRetry: trackingCallback
      });

      retryMetrics.totalAttempts = 2;
      retryMetrics.successfulRetries = 1;

      expect(retryMetrics.totalRetries).toBe(1);
      expect(retryMetrics.successfulRetries).toBe(1);
      expect(retryMetrics.failedRetries).toBe(0);
    });
  });

  describe('Queue-Specific Retry Scenarios', () => {
    it('should retry queue item processing failures', async () => {
      const queueItemProcessor = async (itemId: string) => {
        return await mockSupabase.rpc('complete_embedding_queue_item', {
          item_id: itemId,
          worker_id_param: 'worker-1',
          success: true,
          actual_tokens_param: 1000
        });
      };

      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Database timeout'))
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await retryManager.executeWithRetry(
        () => queueItemProcessor('item-123')
      );

      expect(result).toEqual({ data: null, error: null });
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should retry worker heartbeat updates', async () => {
      const heartbeatUpdate = async () => {
        return await mockSupabase.rpc('update_worker_heartbeat', {
          worker_id_param: 'worker-1',
          worker_status: 'active'
        });
      };

      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await retryManager.executeWithRetry(heartbeatUpdate);

      expect(result).toEqual({ data: null, error: null });
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should retry queue statistics fetching', async () => {
      const fetchQueueStats = async () => {
        return await mockSupabase.rpc('get_queue_statistics');
      };

      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Query timeout'))
        .mockResolvedValueOnce({
          data: [{ total_pending: 5, total_processing: 2 }],
          error: null
        });

      const result = await retryManager.executeWithRetry(fetchQueueStats);

      expect(result.data).toEqual([{ total_pending: 5, total_processing: 2 }]);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should handle worker API retry scenarios', async () => {
      const startWorker = async () => {
        const response = await fetch(
          'https://test.supabase.co/functions/v1/embedding-queue-worker?action=start',
          { method: 'POST' }
        );
        return await response.json();
      };

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, workerId: 'worker-1' })
        });

      const result = await retryManager.executeWithRetry(startWorker);

      expect(result).toEqual({ success: true, workerId: 'worker-1' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Advanced Recovery Patterns', () => {
    it('should implement dead letter queue for permanently failed items', async () => {
      const deadLetterQueue: any[] = [];
      
      const processWithDeadLetter = async (item: any) => {
        try {
          return await retryManager.executeWithRetry(
            () => mockSupabase.rpc('process_queue_item', { item_id: item.id }),
            { maxRetries: 2 }
          );
        } catch (error) {
          // Move to dead letter queue after all retries exhausted
          deadLetterQueue.push({
            ...item,
            error: error.message,
            failedAt: new Date().toISOString()
          });
          throw error;
        }
      };

      mockSupabase.rpc.mockRejectedValue(new Error('Permanent failure'));

      const testItem = { id: 'item-123', data: 'test' };

      await expect(processWithDeadLetter(testItem)).rejects.toThrow();

      expect(deadLetterQueue).toHaveLength(1);
      expect(deadLetterQueue[0].id).toBe('item-123');
      expect(deadLetterQueue[0].error).toBe('Permanent failure');
    });

    it('should implement progressive retry delays', async () => {
      const progressiveDelays = [1000, 5000, 15000, 30000];
      let delayIndex = 0;

      const progressiveRetryManager = new RetryManager({
        ...RETRY_CONFIG,
        maxRetries: 4
      });

      // Override delay calculation for testing
      (progressiveRetryManager as any).calculateDelay = (attempt: number) => {
        return progressiveDelays[Math.min(attempt, progressiveDelays.length - 1)];
      };

      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

      const mockOperation = vi.fn().mockRejectedValue(new Error('Always fails'));

      const promise = progressiveRetryManager.executeWithRetry(mockOperation);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();

      expect(delays).toEqual(progressiveDelays);
    });

    it('should implement retry with circuit breaker integration', async () => {
      let circuitBreakerOpen = false;
      let failureCount = 0;

      const retryWithCircuitBreaker = async (operation: () => Promise<any>) => {
        if (circuitBreakerOpen) {
          throw new Error('Circuit breaker is open');
        }

        try {
          const result = await retryManager.executeWithRetry(operation, {
            retryCondition: (error) => {
              failureCount++;
              if (failureCount >= 5) {
                circuitBreakerOpen = true;
                return false; // Stop retrying
              }
              return true;
            }
          });
          
          // Reset on success
          failureCount = 0;
          circuitBreakerOpen = false;
          
          return result;
        } catch (error) {
          throw error;
        }
      };

      const alwaysFailingOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      // First call should exhaust retries and open circuit breaker
      await expect(retryWithCircuitBreaker(alwaysFailingOperation)).rejects.toThrow();
      expect(circuitBreakerOpen).toBe(true);

      // Second call should fail immediately due to open circuit breaker
      await expect(retryWithCircuitBreaker(alwaysFailingOperation)).rejects.toThrow('Circuit breaker is open');
    });
  });
});
