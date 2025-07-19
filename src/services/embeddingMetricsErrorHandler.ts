/**
 * Embedding Metrics Error Handler
 * Enhanced error handling with retry logic and error classification
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 2
 */

import { toast } from 'sonner';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ErrorContext {
  operation: string;
  timestamp: Date;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
}

export interface ClassifiedError {
  type: 'network' | 'authentication' | 'authorization' | 'validation' | 'rate_limit' | 'server' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  userMessage: string;
  technicalMessage: string;
  suggestedAction?: string;
}

class EmbeddingMetricsErrorHandler {
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'network',
      'timeout',
      'rate_limit',
      'server_error',
      'connection_error'
    ]
  };

  private errorCounts: Map<string, number> = new Map();
  private lastErrors: Map<string, Date> = new Map();

  /**
   * Classify an error based on its characteristics
   */
  classifyError(error: Error | any, context?: ErrorContext): ClassifiedError {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status;
    const lowerMessage = errorMessage.toLowerCase();

    // Network errors
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('fetch') || 
        lowerMessage.includes('connection') ||
        errorCode === 'NETWORK_ERROR') {
      return {
        type: 'network',
        severity: 'medium',
        isRetryable: true,
        userMessage: 'Connection issue detected. Retrying...',
        technicalMessage: errorMessage,
        suggestedAction: 'Check your internet connection'
      };
    }

    // Authentication errors
    if (lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('authentication') ||
        errorCode === 401) {
      return {
        type: 'authentication',
        severity: 'high',
        isRetryable: false,
        userMessage: 'Authentication failed. Please sign in again.',
        technicalMessage: errorMessage,
        suggestedAction: 'Sign out and sign back in'
      };
    }

    // Authorization errors
    if (lowerMessage.includes('forbidden') || 
        lowerMessage.includes('permission') ||
        errorCode === 403) {
      return {
        type: 'authorization',
        severity: 'high',
        isRetryable: false,
        userMessage: 'You don\'t have permission to access this data.',
        technicalMessage: errorMessage,
        suggestedAction: 'Contact your administrator'
      };
    }

    // Rate limiting
    if (lowerMessage.includes('rate limit') || 
        lowerMessage.includes('too many requests') ||
        errorCode === 429) {
      return {
        type: 'rate_limit',
        severity: 'medium',
        isRetryable: true,
        userMessage: 'Rate limit exceeded. Slowing down requests...',
        technicalMessage: errorMessage,
        suggestedAction: 'Wait a moment before trying again'
      };
    }

    // Validation errors
    if (lowerMessage.includes('validation') || 
        lowerMessage.includes('invalid') ||
        errorCode === 400) {
      return {
        type: 'validation',
        severity: 'low',
        isRetryable: false,
        userMessage: 'Invalid data provided.',
        technicalMessage: errorMessage,
        suggestedAction: 'Check your input and try again'
      };
    }

    // Server errors
    if (errorCode >= 500 || 
        lowerMessage.includes('server error') ||
        lowerMessage.includes('internal error')) {
      return {
        type: 'server',
        severity: 'high',
        isRetryable: true,
        userMessage: 'Server error occurred. Retrying...',
        technicalMessage: errorMessage,
        suggestedAction: 'Try again in a few moments'
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      severity: 'medium',
      isRetryable: false,
      userMessage: 'An unexpected error occurred.',
      technicalMessage: errorMessage,
      suggestedAction: 'Try refreshing the page'
    };
  }

  /**
   * Execute an operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Reset error count on success
        this.errorCounts.delete(context.operation);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const classified = this.classifyError(error, context);
        
        // Track error frequency
        const errorKey = `${context.operation}_${classified.type}`;
        this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
        this.lastErrors.set(errorKey, new Date());
        
        console.error(`Attempt ${attempt}/${retryConfig.maxAttempts} failed for ${context.operation}:`, {
          error: classified,
          context
        });

        // Don't retry if error is not retryable or we've reached max attempts
        if (!classified.isRetryable || attempt === retryConfig.maxAttempts) {
          this.handleFinalError(classified, context, attempt);
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        console.log(`Retrying ${context.operation} in ${jitteredDelay}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`);
        
        await this.delay(jitteredDelay);
      }
    }

    throw lastError!;
  }

  /**
   * Handle final error after all retries exhausted
   */
  private handleFinalError(
    classified: ClassifiedError, 
    context: ErrorContext, 
    attempts: number
  ): void {
    const errorKey = `${context.operation}_${classified.type}`;
    const errorCount = this.errorCounts.get(errorKey) || 0;

    // Show appropriate toast based on severity
    switch (classified.severity) {
      case 'critical':
        toast.error(classified.userMessage, {
          description: classified.suggestedAction,
          duration: 10000
        });
        break;
      case 'high':
        toast.error(classified.userMessage, {
          description: classified.suggestedAction,
          duration: 7000
        });
        break;
      case 'medium':
        toast.warning(classified.userMessage, {
          description: classified.suggestedAction,
          duration: 5000
        });
        break;
      case 'low':
        toast.info(classified.userMessage, {
          description: classified.suggestedAction,
          duration: 3000
        });
        break;
    }

    // Log detailed error information
    console.error('Final error after retries:', {
      classified,
      context,
      attempts,
      errorCount,
      timestamp: new Date().toISOString()
    });

    // Report to error tracking service if available
    this.reportError(classified, context, attempts, errorCount);
  }

  /**
   * Report error to external error tracking service
   */
  private reportError(
    classified: ClassifiedError,
    context: ErrorContext,
    attempts: number,
    errorCount: number
  ): void {
    // This would integrate with services like Sentry, LogRocket, etc.
    // For now, we'll just log to console
    if (classified.severity === 'critical' || classified.severity === 'high') {
      console.error('High severity error reported:', {
        type: classified.type,
        severity: classified.severity,
        operation: context.operation,
        attempts,
        errorCount,
        timestamp: context.timestamp,
        technicalMessage: classified.technicalMessage,
        userAgent: context.userAgent,
        url: context.url,
        additionalData: context.additionalData
      });
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{ operation: string; type: string; timestamp: Date; count: number }>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    const errorsByType: Record<string, number> = {};
    const recentErrors: Array<{ operation: string; type: string; timestamp: Date; count: number }> = [];

    for (const [key, count] of this.errorCounts.entries()) {
      const [operation, type] = key.split('_');
      errorsByType[type] = (errorsByType[type] || 0) + count;
      
      const timestamp = this.lastErrors.get(key);
      if (timestamp) {
        recentErrors.push({ operation, type, timestamp, count });
      }
    }

    // Sort recent errors by timestamp (most recent first)
    recentErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalErrors,
      errorsByType,
      recentErrors: recentErrors.slice(0, 10) // Last 10 errors
    };
  }

  /**
   * Clear error statistics
   */
  clearErrorStatistics(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
  }

  /**
   * Delay helper function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if an operation is experiencing frequent errors
   */
  isOperationUnhealthy(operation: string, threshold: number = 5): boolean {
    let totalErrors = 0;
    for (const [key, count] of this.errorCounts.entries()) {
      if (key.startsWith(operation)) {
        totalErrors += count;
      }
    }
    return totalErrors >= threshold;
  }

  /**
   * Get health status of error handler
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    totalErrors: number;
    unhealthyOperations: string[];
  } {
    const stats = this.getErrorStatistics();
    const unhealthyOperations: string[] = [];

    // Check each operation for health
    const operations = new Set<string>();
    for (const key of this.errorCounts.keys()) {
      const operation = key.split('_')[0];
      operations.add(operation);
    }

    for (const operation of operations) {
      if (this.isOperationUnhealthy(operation)) {
        unhealthyOperations.push(operation);
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyOperations.length === 0) {
      status = 'healthy';
    } else if (unhealthyOperations.length <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      totalErrors: stats.totalErrors,
      unhealthyOperations
    };
  }
}

// Export singleton instance
export const embeddingMetricsErrorHandler = new EmbeddingMetricsErrorHandler();
