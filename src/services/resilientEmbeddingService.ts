import { generateEmbeddingsForReceipt } from '@/lib/ai-search';

// Circuit breaker states
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
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

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }
}

class ResilientEmbeddingService {
  private circuitBreaker: CircuitBreaker;
  private embeddingQueue: Set<string> = new Set();

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3, // Open circuit after 3 failures
      resetTimeout: 30000, // Wait 30 seconds before trying again
      monitoringPeriod: 60000, // Monitor for 1 minute
    });
  }

  /**
   * Generate embeddings with circuit breaker protection
   */
  async generateEmbeddingsWithFallback(receiptId: string): Promise<boolean> {
    // Avoid duplicate embedding generation for the same receipt
    if (this.embeddingQueue.has(receiptId)) {
      console.log(`Embedding generation already in progress for receipt ${receiptId}`);
      return false;
    }

    try {
      this.embeddingQueue.add(receiptId);

      const result = await this.circuitBreaker.execute(async () => {
        console.log(`Attempting to generate embeddings for receipt ${receiptId}`);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Embedding generation timeout')), 15000);
        });

        const embeddingPromise = generateEmbeddingsForReceipt(receiptId);
        
        return Promise.race([embeddingPromise, timeoutPromise]);
      });

      console.log(`Successfully generated embeddings for receipt ${receiptId}`);
      return true;
    } catch (error) {
      const circuitState = this.circuitBreaker.getState();
      console.warn(`Failed to generate embeddings for receipt ${receiptId}:`, {
        error: error instanceof Error ? error.message : String(error),
        circuitState,
        stats: this.circuitBreaker.getStats(),
      });

      // If circuit is open, schedule background retry
      if (circuitState === 'OPEN') {
        this.scheduleBackgroundRetry(receiptId);
      }

      return false;
    } finally {
      this.embeddingQueue.delete(receiptId);
    }
  }

  /**
   * Schedule a background retry for embedding generation
   */
  private scheduleBackgroundRetry(receiptId: string) {
    const retryDelay = 60000; // Retry after 1 minute
    
    setTimeout(async () => {
      try {
        console.log(`Background retry: generating embeddings for receipt ${receiptId}`);
        await this.generateEmbeddingsWithFallback(receiptId);
      } catch (error) {
        console.warn(`Background retry failed for receipt ${receiptId}:`, error);
      }
    }, retryDelay);
  }

  /**
   * Batch generate embeddings for multiple receipts
   */
  async batchGenerateEmbeddings(receiptIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };
    
    // Process in small batches to avoid overwhelming the service
    const batchSize = 3;
    for (let i = 0; i < receiptIds.length; i += batchSize) {
      const batch = receiptIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (receiptId) => {
        const success = await this.generateEmbeddingsWithFallback(receiptId);
        return { receiptId, success };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const receiptId = batch[index];
        if (result.status === 'fulfilled' && result.value.success) {
          results.success.push(receiptId);
        } else {
          results.failed.push(receiptId);
        }
      });

      // Add delay between batches to be respectful to the service
      if (i + batchSize < receiptIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    const stats = this.circuitBreaker.getStats();
    const isHealthy = stats.state === 'CLOSED';
    
    return {
      isHealthy,
      circuitState: stats.state,
      failureCount: stats.failureCount,
      lastFailureTime: stats.lastFailureTime ? new Date(stats.lastFailureTime).toISOString() : null,
      queueSize: this.embeddingQueue.size,
      recommendation: this.getHealthRecommendation(stats.state),
    };
  }

  private getHealthRecommendation(state: CircuitState): string {
    switch (state) {
      case 'CLOSED':
        return 'Embedding service is healthy and operational';
      case 'HALF_OPEN':
        return 'Embedding service is recovering - monitoring for stability';
      case 'OPEN':
        return 'Embedding service is temporarily unavailable - will retry automatically';
      default:
        return 'Unknown state';
    }
  }

  /**
   * Force reset the circuit breaker (for admin use)
   */
  resetCircuitBreaker() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
    });
    console.log('Circuit breaker has been reset');
  }
}

// Export singleton instance
export const resilientEmbeddingService = new ResilientEmbeddingService();
