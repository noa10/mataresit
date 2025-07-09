/**
 * Enhanced fallback processing service
 * Handles intelligent retries, method switching, and error recovery
 */

import { toast } from "sonner";
import { ProcessingRecommendation, FallbackStrategy, shouldTriggerFallback } from "@/utils/processingOptimizer";
import { processReceiptWithOCR, updateReceiptProcessingStatus } from "./receiptService";

export interface FallbackProcessingOptions {
  receiptId: string;
  recommendation: ProcessingRecommendation;
  onProgress?: (stage: string, progress: number) => void;
  onFallback?: (reason: string, newMethod: string) => void;
  onRetry?: (attempt: number, maxAttempts: number) => void;
}

export interface ProcessingAttempt {
  attempt: number;
  method: 'ocr-ai' | 'ai-vision';
  model: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  fallbackTriggered: boolean;
}

export class FallbackProcessingService {
  private attempts: ProcessingAttempt[] = [];
  private currentAttempt = 0;
  private maxAttempts = 3;

  constructor(private options: FallbackProcessingOptions) {
    this.maxAttempts = options.recommendation.fallbackStrategy.maxRetries + 1;
  }

  /**
   * Process receipt with intelligent fallback mechanisms
   */
  async processWithFallback(): Promise<boolean> {
    const { receiptId, recommendation, onProgress, onFallback, onRetry } = this.options;
    const { fallbackStrategy } = recommendation;

    // Start with primary method
    let currentMethod = fallbackStrategy.primaryMethod;
    let currentModel = fallbackStrategy.primaryModel;
    let lastError = '';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      this.currentAttempt = attempt;

      const attemptRecord: ProcessingAttempt = {
        attempt,
        method: currentMethod,
        model: currentModel,
        startTime: Date.now(),
        success: false,
        fallbackTriggered: false
      };

      try {
        onProgress?.(`Attempt ${attempt}: ${currentMethod}`, 0);
        onRetry?.(attempt, this.maxAttempts);

        // Log attempt
        console.log(`Processing attempt ${attempt}/${this.maxAttempts}:`, {
          method: currentMethod,
          model: currentModel,
          receiptId
        });

        // Update receipt status
        await updateReceiptProcessingStatus(receiptId, 'processing_ocr', null);

        // Attempt processing
        await processReceiptWithOCR(receiptId, {
          primaryMethod: currentMethod,
          modelId: currentModel,
          compareWithAlternative: false // Disable comparison during fallback
        });

        // Success!
        attemptRecord.success = true;
        attemptRecord.endTime = Date.now();
        this.attempts.push(attemptRecord);

        const processingTime = (attemptRecord.endTime - attemptRecord.startTime) / 1000;
        console.log(`Processing successful on attempt ${attempt} after ${processingTime.toFixed(2)}s`);

        toast.success(`Receipt processed successfully${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
        return true;

      } catch (error: any) {
        attemptRecord.endTime = Date.now();
        attemptRecord.error = error.message;
        lastError = error.message;

        const processingTime = (attemptRecord.endTime - attemptRecord.startTime) / 1000;
        console.error(`Processing attempt ${attempt} failed after ${processingTime.toFixed(2)}s:`, error.message);

        // Check if this error should trigger fallback
        const shouldFallback = shouldTriggerFallback(error.message, fallbackStrategy);
        attemptRecord.fallbackTriggered = shouldFallback;

        if (shouldFallback && attempt < this.maxAttempts) {
          // Switch to fallback method
          const previousMethod = currentMethod;
          currentMethod = fallbackStrategy.fallbackMethod;
          currentModel = fallbackStrategy.fallbackModel;

          console.log(`Fallback triggered: ${previousMethod} → ${currentMethod}`);
          onFallback?.(error.message, currentMethod);

          toast.info(`Switching to ${currentMethod === 'ai-vision' ? 'AI Vision' : 'OCR + AI'} method...`);

          // Add delay before retry to allow system recovery
          await this.waitWithBackoff(attempt);

        } else if (attempt < this.maxAttempts) {
          // Same method retry with different model or settings
          currentModel = this.getAlternativeModel(currentModel, fallbackStrategy);
          console.log(`Retrying with alternative model: ${currentModel}`);

          toast.info(`Retrying with different settings...`);

          // Add delay before retry
          await this.waitWithBackoff(attempt);
        }

        this.attempts.push(attemptRecord);
      }
    }

    // All attempts failed
    console.error(`All ${this.maxAttempts} processing attempts failed. Last error:`, lastError);

    // Update receipt status to failed
    await updateReceiptProcessingStatus(receiptId, 'failed_ocr',
      `Processing failed after ${this.maxAttempts} attempts. Last error: ${lastError}`
    );

    toast.error(`Processing failed after ${this.maxAttempts} attempts. Please try editing manually.`);
    return false;
  }

  /**
   * Get alternative model for retry attempts
   */
  private getAlternativeModel(currentModel: string, fallbackStrategy: FallbackStrategy): string {
    // Model fallback hierarchy - updated to use current models
    const modelFallbacks: Record<string, string> = {
      // Gemini models
      'gemini-2.0-flash-lite': 'gemini-2.0-flash',
      'gemini-2.0-flash': 'gemini-2.5-flash',
      'gemini-2.5-flash': 'gemini-2.5-pro',
      'gemini-2.5-pro': 'openrouter/google/gemini-2.0-flash-exp:free',

      // Specific fallback for problematic model
      'gemini-2.5-flash-lite-preview-06-17': 'gemini-2.5-flash',

      // OpenRouter free models
      'openrouter/google/gemini-2.0-flash-exp:free': 'openrouter/google/gemma-3-27b-it:free',
      'openrouter/google/gemma-3-27b-it:free': 'openrouter/qwen/qwen2.5-vl-72b-instruct:free',
      'openrouter/qwen/qwen2.5-vl-72b-instruct:free': 'openrouter/meta-llama/llama-4-scout:free',
      'openrouter/meta-llama/llama-4-scout:free': 'openrouter/moonshotai/kimi-vl-a3b-thinking:free',
      'openrouter/moonshotai/kimi-vl-a3b-thinking:free': 'gemini-2.0-flash-lite'
    };

    return modelFallbacks[currentModel] || 'gemini-2.0-flash-lite';
  }

  /**
   * Wait with exponential backoff between retries
   */
  private async waitWithBackoff(attempt: number): Promise<void> {
    const baseDelay = 2000; // 2 seconds
    const delay = baseDelay * Math.pow(1.5, attempt - 1);
    const maxDelay = 10000; // 10 seconds max

    const actualDelay = Math.min(delay, maxDelay);
    console.log(`Waiting ${actualDelay}ms before retry...`);

    return new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  /**
   * Get processing attempt history
   */
  getAttemptHistory(): ProcessingAttempt[] {
    return [...this.attempts];
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalAttempts: number;
    successfulAttempt?: number;
    totalProcessingTime: number;
    fallbacksTriggered: number;
    finalMethod?: string;
    finalModel?: string;
  } {
    const totalProcessingTime = this.attempts.reduce((sum, attempt) => {
      if (attempt.endTime) {
        return sum + (attempt.endTime - attempt.startTime);
      }
      return sum;
    }, 0);

    const fallbacksTriggered = this.attempts.filter(a => a.fallbackTriggered).length;
    const successfulAttempt = this.attempts.find(a => a.success);

    return {
      totalAttempts: this.attempts.length,
      successfulAttempt: successfulAttempt?.attempt,
      totalProcessingTime,
      fallbacksTriggered,
      finalMethod: successfulAttempt?.method,
      finalModel: successfulAttempt?.model
    };
  }
}

/**
 * Enhanced processing function with automatic fallback
 */
export async function processReceiptWithEnhancedFallback(
  receiptId: string,
  recommendation: ProcessingRecommendation,
  callbacks?: {
    onProgress?: (stage: string, progress: number) => void;
    onFallback?: (reason: string, newMethod: string) => void;
    onRetry?: (attempt: number, maxAttempts: number) => void;
    onComplete?: (success: boolean, stats: any) => void;
  }
): Promise<boolean> {
  const service = new FallbackProcessingService({
    receiptId,
    recommendation,
    ...callbacks
  });

  try {
    const success = await service.processWithFallback();
    const stats = service.getProcessingStats();

    callbacks?.onComplete?.(success, stats);

    // Log final statistics
    console.log('Processing completed with stats:', stats);

    return success;
  } catch (error) {
    console.error('Enhanced fallback processing failed:', error);
    callbacks?.onComplete?.(false, service.getProcessingStats());
    return false;
  }
}

/**
 * Batch processing with intelligent queuing and fallback
 */
export class BatchFallbackProcessor {
  private queue: Array<{
    receiptId: string;
    recommendation: ProcessingRecommendation;
    priority: number;
  }> = [];

  private processing = false;
  private concurrentLimit = 2;
  private activeProcessors = new Set<string>();

  constructor(concurrentLimit = 2) {
    this.concurrentLimit = concurrentLimit;
  }

  /**
   * Add receipt to processing queue with priority
   */
  addToQueue(receiptId: string, recommendation: ProcessingRecommendation): void {
    const priority = recommendation.riskLevel === 'low' ? 1 :
                    recommendation.riskLevel === 'medium' ? 2 : 3;

    this.queue.push({ receiptId, recommendation, priority });

    // Sort queue by priority (low risk first)
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Start batch processing with intelligent queuing
   */
  async startBatchProcessing(
    callbacks?: {
      onItemStart?: (receiptId: string, position: number, total: number) => void;
      onItemComplete?: (receiptId: string, success: boolean, stats: any) => void;
      onBatchComplete?: (results: Array<{ receiptId: string; success: boolean; stats: any }>) => void;
    }
  ): Promise<void> {
    if (this.processing) {
      console.warn('Batch processing already in progress');
      return;
    }

    this.processing = true;
    const results: Array<{ receiptId: string; success: boolean; stats: any }> = [];

    console.log(`Starting batch processing of ${this.queue.length} items with concurrency ${this.concurrentLimit}`);

    try {
      while (this.queue.length > 0 && this.processing) {
        // Process items up to concurrent limit
        const batch = [];

        while (batch.length < this.concurrentLimit && this.queue.length > 0) {
          const item = this.queue.shift()!;
          batch.push(item);
        }

        // Process batch concurrently
        const batchPromises = batch.map(async (item, index) => {
          const position = results.length + index + 1;
          const total = results.length + this.queue.length + batch.length;

          callbacks?.onItemStart?.(item.receiptId, position, total);
          this.activeProcessors.add(item.receiptId);

          try {
            const success = await processReceiptWithEnhancedFallback(
              item.receiptId,
              item.recommendation
            );

            const service = new FallbackProcessingService({
              receiptId: item.receiptId,
              recommendation: item.recommendation
            });

            const stats = service.getProcessingStats();
            const result = { receiptId: item.receiptId, success, stats };

            callbacks?.onItemComplete?.(item.receiptId, success, stats);
            return result;

          } finally {
            this.activeProcessors.delete(item.receiptId);
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      callbacks?.onBatchComplete?.(results);
      console.log('Batch processing completed:', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } finally {
      this.processing = false;
      this.activeProcessors.clear();
    }
  }

  /**
   * Stop batch processing
   */
  stopBatchProcessing(): void {
    this.processing = false;
    console.log('Batch processing stopped');
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeProcessors: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      activeProcessors: this.activeProcessors.size,
      isProcessing: this.processing
    };
  }
}
