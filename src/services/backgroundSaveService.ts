import { updateReceiptWithLineItems } from './receiptService';
import { ReceiptWithDetails, ReceiptLineItem } from '@/types/receipt';
import { backgroundEmbeddingService } from './backgroundEmbeddingService';

// Types for save operations
export interface SaveOperation {
  id: string;
  receiptId: string;
  receiptData: Partial<ReceiptWithDetails>;
  lineItems?: ReceiptLineItem[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export interface SaveQueueStatus {
  totalOperations: number;
  pendingOperations: number;
  processingOperations: number;
  completedOperations: number;
  failedOperations: number;
}

// Event types for save status updates
export type SaveStatusEvent = 
  | { type: 'OPERATION_ADDED'; operation: SaveOperation }
  | { type: 'OPERATION_STARTED'; operationId: string }
  | { type: 'OPERATION_COMPLETED'; operationId: string; result: any }
  | { type: 'OPERATION_FAILED'; operationId: string; error: string }
  | { type: 'OPERATION_RETRYING'; operationId: string; retryCount: number }
  | { type: 'QUEUE_STATUS_CHANGED'; status: SaveQueueStatus };

// Event listener type
export type SaveStatusListener = (event: SaveStatusEvent) => void;

class BackgroundSaveService {
  private queue: Map<string, SaveOperation> = new Map();
  private listeners: Set<SaveStatusListener> = new Set();
  private isProcessing = false;
  private processingDelay = 100; // Small delay to batch operations

  // Add a save operation to the queue
  addSaveOperation(
    receiptId: string,
    receiptData: Partial<ReceiptWithDetails>,
    lineItems?: ReceiptLineItem[],
    options?: {
      maxRetries?: number;
      onSuccess?: (result: any) => void;
      onError?: (error: Error) => void;
    }
  ): string {
    const operationId = `save_${receiptId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const operation: SaveOperation = {
      id: operationId,
      receiptId,
      receiptData,
      lineItems,
      status: 'pending',
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
      timestamp: Date.now(),
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    };

    // If there's already a pending operation for this receipt, replace it
    // This handles rapid successive saves for the same receipt
    const existingOperationId = this.findPendingOperationForReceipt(receiptId);
    if (existingOperationId) {
      this.queue.delete(existingOperationId);
    }

    this.queue.set(operationId, operation);
    this.emitEvent({ type: 'OPERATION_ADDED', operation });
    this.emitQueueStatusChange();

    // Start processing if not already running
    this.startProcessing();

    return operationId;
  }

  // Find pending operation for a specific receipt
  private findPendingOperationForReceipt(receiptId: string): string | null {
    for (const [id, operation] of this.queue) {
      if (operation.receiptId === receiptId && operation.status === 'pending') {
        return id;
      }
    }
    return null;
  }

  // Start processing the queue
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    // Small delay to allow batching of rapid operations
    await new Promise(resolve => setTimeout(resolve, this.processingDelay));

    while (this.hasPendingOperations()) {
      const operation = this.getNextPendingOperation();
      if (operation) {
        await this.processOperation(operation);
      }
    }

    this.isProcessing = false;
  }

  // Check if there are pending operations
  private hasPendingOperations(): boolean {
    return Array.from(this.queue.values()).some(op => op.status === 'pending');
  }

  // Get the next pending operation (FIFO)
  private getNextPendingOperation(): SaveOperation | null {
    for (const operation of this.queue.values()) {
      if (operation.status === 'pending') {
        return operation;
      }
    }
    return null;
  }

  // Process a single save operation
  private async processOperation(operation: SaveOperation) {
    try {
      // Update status to processing
      operation.status = 'processing';
      this.emitEvent({ type: 'OPERATION_STARTED', operationId: operation.id });
      this.emitQueueStatusChange();

      // Perform the actual save operation
      const result = await updateReceiptWithLineItems(
        operation.receiptId,
        operation.receiptData,
        operation.lineItems,
        { skipEmbeddings: true } // Skip embeddings in background saves to avoid delays
      );

      // Mark as completed
      operation.status = 'completed';
      this.emitEvent({ type: 'OPERATION_COMPLETED', operationId: operation.id, result });
      this.emitQueueStatusChange();

      // Queue background embedding generation after successful save
      try {
        backgroundEmbeddingService.queueEmbeddingGeneration(operation.receiptId, 'normal');
      } catch (embeddingError) {
        console.warn('Failed to queue background embedding generation:', embeddingError);
        // Don't fail the save operation if embedding queueing fails
      }

      // Call success callback if provided
      if (operation.onSuccess) {
        try {
          operation.onSuccess(result);
        } catch (callbackError) {
          console.error('Error in save success callback:', callbackError);
        }
      }

      // Remove completed operation after a delay to allow UI updates
      setTimeout(() => {
        this.queue.delete(operation.id);
        this.emitQueueStatusChange();
      }, 2000);

    } catch (error) {
      console.error('Save operation failed:', error);
      
      // Handle retry logic
      if (operation.retryCount < operation.maxRetries) {
        operation.retryCount++;
        operation.status = 'pending'; // Reset to pending for retry
        this.emitEvent({ 
          type: 'OPERATION_RETRYING', 
          operationId: operation.id, 
          retryCount: operation.retryCount 
        });
        
        // Add exponential backoff delay for retries
        const retryDelay = Math.min(1000 * Math.pow(2, operation.retryCount - 1), 10000);
        setTimeout(() => {
          this.startProcessing();
        }, retryDelay);
      } else {
        // Max retries reached, mark as failed
        operation.status = 'failed';
        operation.error = error instanceof Error ? error.message : 'Unknown error';
        this.emitEvent({ 
          type: 'OPERATION_FAILED', 
          operationId: operation.id, 
          error: operation.error 
        });

        // Call error callback if provided
        if (operation.onError) {
          try {
            operation.onError(error instanceof Error ? error : new Error('Unknown error'));
          } catch (callbackError) {
            console.error('Error in save error callback:', callbackError);
          }
        }
      }

      this.emitQueueStatusChange();
    }
  }

  // Get current queue status
  getQueueStatus(): SaveQueueStatus {
    const operations = Array.from(this.queue.values());
    return {
      totalOperations: operations.length,
      pendingOperations: operations.filter(op => op.status === 'pending').length,
      processingOperations: operations.filter(op => op.status === 'processing').length,
      completedOperations: operations.filter(op => op.status === 'completed').length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
    };
  }

  // Get operation by ID
  getOperation(operationId: string): SaveOperation | null {
    return this.queue.get(operationId) || null;
  }

  // Retry a failed operation
  retryOperation(operationId: string): boolean {
    const operation = this.queue.get(operationId);
    if (operation && operation.status === 'failed') {
      operation.status = 'pending';
      operation.retryCount = 0; // Reset retry count
      operation.error = undefined;
      this.emitQueueStatusChange();
      this.startProcessing();
      return true;
    }
    return false;
  }

  // Cancel a pending operation
  cancelOperation(operationId: string): boolean {
    const operation = this.queue.get(operationId);
    if (operation && operation.status === 'pending') {
      this.queue.delete(operationId);
      this.emitQueueStatusChange();
      return true;
    }
    return false;
  }

  // Event management
  addListener(listener: SaveStatusListener) {
    this.listeners.add(listener);
  }

  removeListener(listener: SaveStatusListener) {
    this.listeners.delete(listener);
  }

  private emitEvent(event: SaveStatusEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in save status listener:', error);
      }
    });
  }

  private emitQueueStatusChange() {
    this.emitEvent({ 
      type: 'QUEUE_STATUS_CHANGED', 
      status: this.getQueueStatus() 
    });
  }

  // Clear all completed and failed operations
  clearCompletedOperations() {
    const toDelete: string[] = [];
    for (const [id, operation] of this.queue) {
      if (operation.status === 'completed' || operation.status === 'failed') {
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => this.queue.delete(id));
    this.emitQueueStatusChange();
  }
}

// Create and export singleton instance
export const backgroundSaveService = new BackgroundSaveService();
