import { resilientEmbeddingService } from './resilientEmbeddingService';

interface EmbeddingTask {
  receiptId: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class BackgroundEmbeddingService {
  private queue: EmbeddingTask[] = [];
  private isProcessing = false;
  private processingDelay = 5000; // 5 second delay between processing
  private maxConcurrent = 2; // Maximum concurrent embedding operations

  /**
   * Add a receipt to the embedding queue
   */
  queueEmbeddingGeneration(receiptId: string, priority: 'high' | 'normal' | 'low' = 'normal') {
    // Remove any existing task for this receipt
    this.queue = this.queue.filter(task => task.receiptId !== receiptId);
    
    // Add new task
    const task: EmbeddingTask = {
      receiptId,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 2,
    };

    this.queue.push(task);
    this.sortQueue();
    
    console.log(`Queued embedding generation for receipt ${receiptId} with priority ${priority}`);
    
    // Start processing if not already running
    this.startProcessing();
  }

  /**
   * Sort queue by priority and timestamp
   */
  private sortQueue() {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    
    this.queue.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Start processing the queue
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        // Check service health before processing
        const healthStatus = resilientEmbeddingService.getHealthStatus();
        if (!healthStatus.isHealthy) {
          console.log('Embedding service is unhealthy, pausing background processing:', healthStatus.recommendation);
          await this.delay(30000); // Wait 30 seconds before checking again
          continue;
        }

        // Process tasks in batches
        const batch = this.queue.splice(0, this.maxConcurrent);
        if (batch.length === 0) break;

        console.log(`Processing ${batch.length} embedding tasks`);
        
        const promises = batch.map(task => this.processTask(task));
        await Promise.allSettled(promises);
        
        // Delay between batches to avoid overwhelming the service
        if (this.queue.length > 0) {
          await this.delay(this.processingDelay);
        }
      }
    } catch (error) {
      console.error('Error in background embedding processing:', error);
    } finally {
      this.isProcessing = false;
      
      // If there are still tasks in the queue, schedule another processing round
      if (this.queue.length > 0) {
        setTimeout(() => this.startProcessing(), this.processingDelay);
      }
    }
  }

  /**
   * Process a single embedding task
   */
  private async processTask(task: EmbeddingTask): Promise<void> {
    try {
      console.log(`Processing embedding for receipt ${task.receiptId} (attempt ${task.retryCount + 1})`);
      
      const success = await resilientEmbeddingService.generateEmbeddingsWithFallback(task.receiptId);
      
      if (success) {
        console.log(`Successfully generated embeddings for receipt ${task.receiptId}`);
      } else {
        throw new Error('Embedding generation failed');
      }
    } catch (error) {
      console.warn(`Failed to generate embeddings for receipt ${task.receiptId}:`, error);
      
      // Retry if we haven't exceeded max retries
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.timestamp = Date.now() + (task.retryCount * 60000); // Exponential backoff
        
        // Re-add to queue with lower priority
        task.priority = 'low';
        this.queue.push(task);
        this.sortQueue();
        
        console.log(`Retrying embedding generation for receipt ${task.receiptId} (attempt ${task.retryCount + 1})`);
      } else {
        console.error(`Max retries exceeded for receipt ${task.receiptId} embedding generation`);
      }
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const priorityCounts = this.queue.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTasks: this.queue.length,
      isProcessing: this.isProcessing,
      priorityCounts,
      healthStatus: resilientEmbeddingService.getHealthStatus(),
    };
  }

  /**
   * Clear all tasks for a specific receipt
   */
  clearTasksForReceipt(receiptId: string) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(task => task.receiptId !== receiptId);
    const removed = initialLength - this.queue.length;
    
    if (removed > 0) {
      console.log(`Removed ${removed} embedding tasks for receipt ${receiptId}`);
    }
  }

  /**
   * Clear all tasks
   */
  clearAllTasks() {
    const cleared = this.queue.length;
    this.queue = [];
    console.log(`Cleared ${cleared} embedding tasks from queue`);
  }

  /**
   * Pause processing
   */
  pauseProcessing() {
    this.isProcessing = false;
    console.log('Background embedding processing paused');
  }

  /**
   * Resume processing
   */
  resumeProcessing() {
    if (!this.isProcessing && this.queue.length > 0) {
      console.log('Resuming background embedding processing');
      this.startProcessing();
    }
  }

  /**
   * Process embeddings for multiple receipts immediately (high priority)
   */
  async processImmediately(receiptIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    console.log(`Processing embeddings immediately for ${receiptIds.length} receipts`);
    
    // Add to queue with high priority
    receiptIds.forEach(receiptId => {
      this.queueEmbeddingGeneration(receiptId, 'high');
    });

    // Use the resilient service for immediate processing
    return await resilientEmbeddingService.batchGenerateEmbeddings(receiptIds);
  }
}

// Export singleton instance
export const backgroundEmbeddingService = new BackgroundEmbeddingService();
