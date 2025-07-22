/**
 * Mock API Responses for Phase 4 Integration Tests
 * 
 * This file provides mock responses for various API calls used in integration testing.
 */

/**
 * Mock Gemini API responses
 */
export const mockGeminiResponses = {
  success: {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            merchant_name: "Test Coffee Shop",
            total_amount: "15.99",
            currency: "USD",
            date: "2024-01-15",
            items: [
              {
                description: "Large Coffee",
                amount: "4.99",
                quantity: 1
              },
              {
                description: "Blueberry Muffin",
                amount: "3.50",
                quantity: 2
              },
              {
                description: "Tax",
                amount: "1.50",
                quantity: 1
              }
            ],
            payment_method: "Credit Card",
            receipt_number: "12345"
          })
        }]
      },
      finishReason: "STOP"
    }],
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: 800,
      totalTokenCount: 2000
    }
  },

  rateLimitError: {
    error: {
      code: 429,
      message: "Resource has been exhausted (e.g. check quota).",
      status: "RESOURCE_EXHAUSTED"
    }
  },

  quotaExceededError: {
    error: {
      code: 429,
      message: "Quota exceeded for requests per minute.",
      status: "RESOURCE_EXHAUSTED"
    }
  },

  invalidRequestError: {
    error: {
      code: 400,
      message: "Invalid request format.",
      status: "INVALID_ARGUMENT"
    }
  },

  serverError: {
    error: {
      code: 500,
      message: "Internal server error.",
      status: "INTERNAL"
    }
  }
};

/**
 * Mock OpenRouter API responses
 */
export const mockOpenRouterResponses = {
  success: {
    id: "chatcmpl-test-123",
    object: "chat.completion",
    created: 1704067200,
    model: "anthropic/claude-3-sonnet",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          merchant_name: "Test Restaurant",
          total_amount: "42.75",
          currency: "USD",
          date: "2024-01-15",
          items: [
            {
              description: "Grilled Chicken",
              amount: "18.99",
              quantity: 1
            },
            {
              description: "Caesar Salad",
              amount: "12.99",
              quantity: 1
            },
            {
              description: "Soft Drink",
              amount: "3.99",
              quantity: 2
            },
            {
              description: "Tax",
              amount: "3.79",
              quantity: 1
            }
          ],
          payment_method: "Debit Card",
          receipt_number: "67890"
        })
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 1500,
      completion_tokens: 900,
      total_tokens: 2400
    }
  },

  rateLimitError: {
    error: {
      message: "Rate limit exceeded",
      type: "rate_limit_error",
      code: 429
    }
  },

  quotaExceededError: {
    error: {
      message: "Insufficient quota",
      type: "insufficient_quota",
      code: 429
    }
  },

  serverError: {
    error: {
      message: "Internal server error",
      type: "server_error",
      code: 500
    }
  }
};

/**
 * Mock Supabase Edge Function responses
 */
export const mockSupabaseResponses = {
  generateEmbeddings: {
    success: {
      success: true,
      embedding: Array.from({ length: 1536 }, () => Math.random()),
      tokensUsed: 1200,
      processingTimeMs: 3500,
      model: "text-embedding-ada-002"
    },
    
    error: {
      success: false,
      error: "Failed to generate embeddings",
      errorCode: "EMBEDDING_GENERATION_FAILED",
      processingTimeMs: 1000
    },

    rateLimitError: {
      success: false,
      error: "Rate limit exceeded",
      errorCode: "RATE_LIMIT_EXCEEDED",
      retryAfter: 60,
      processingTimeMs: 500
    }
  },

  processReceipt: {
    success: {
      success: true,
      receiptData: {
        merchant_name: "Test Store",
        total_amount: "29.99",
        currency: "USD",
        date: "2024-01-15",
        items: [
          {
            description: "Test Product",
            amount: "25.99",
            quantity: 1
          },
          {
            description: "Tax",
            amount: "4.00",
            quantity: 1
          }
        ]
      },
      confidence: 0.95,
      processingTimeMs: 4200
    },

    error: {
      success: false,
      error: "Failed to process receipt",
      errorCode: "RECEIPT_PROCESSING_FAILED",
      processingTimeMs: 2000
    }
  },

  batchUpload: {
    success: {
      success: true,
      batchId: "batch-123",
      totalFiles: 10,
      processedFiles: 10,
      failedFiles: 0,
      processingTimeMs: 45000,
      averageTimePerFile: 4500
    },

    partialSuccess: {
      success: true,
      batchId: "batch-124",
      totalFiles: 10,
      processedFiles: 8,
      failedFiles: 2,
      processingTimeMs: 50000,
      averageTimePerFile: 5000,
      errors: [
        {
          fileIndex: 3,
          fileName: "receipt-4.jpg",
          error: "Rate limit exceeded",
          errorCode: "RATE_LIMIT_EXCEEDED"
        },
        {
          fileIndex: 7,
          fileName: "receipt-8.jpg",
          error: "Invalid image format",
          errorCode: "INVALID_IMAGE_FORMAT"
        }
      ]
    }
  }
};

/**
 * Mock database query responses
 */
export const mockDatabaseResponses = {
  queueStatistics: {
    total_pending: 25,
    total_processing: 3,
    total_completed: 1250,
    total_failed: 45,
    total_rate_limited: 12,
    oldest_pending_age_hours: 0.5,
    average_processing_time_ms: 4200,
    active_workers: 3,
    last_updated: new Date().toISOString()
  },

  embeddingMetrics: [
    {
      id: "metric-1",
      operation_type: "embedding_generation",
      source_type: "receipts",
      source_id: "receipt-1",
      status: "completed",
      processing_time_ms: 3500,
      tokens_used: 1200,
      api_provider: "gemini",
      model_used: "gemini-1.5-pro",
      timestamp: new Date().toISOString()
    },
    {
      id: "metric-2",
      operation_type: "embedding_generation",
      source_type: "receipts",
      source_id: "receipt-2",
      status: "failed",
      processing_time_ms: 1000,
      tokens_used: 0,
      api_provider: "gemini",
      model_used: "gemini-1.5-pro",
      error_type: "rate_limit",
      error_message: "Rate limit exceeded",
      timestamp: new Date().toISOString()
    }
  ],

  batchSessions: [
    {
      id: "session-1",
      session_name: "Test Batch 1",
      total_files: 50,
      files_completed: 45,
      files_failed: 2,
      files_pending: 3,
      status: "processing",
      processing_strategy: "balanced",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],

  queueWorkers: [
    {
      id: "worker-1",
      worker_id: "worker-1",
      status: "active",
      last_heartbeat: new Date().toISOString(),
      current_task: "task-123",
      processed_count: 150,
      error_count: 5
    },
    {
      id: "worker-2",
      worker_id: "worker-2",
      status: "active",
      last_heartbeat: new Date().toISOString(),
      current_task: null,
      processed_count: 200,
      error_count: 3
    }
  ]
};

/**
 * Mock performance metrics
 */
export const mockPerformanceMetrics = {
  dashboard: {
    loadTime: 1800,
    metricsCount: 1000,
    aggregatedStats: {
      totalOperations: 1000,
      successRate: 0.96,
      averageProcessingTime: 3800,
      totalTokensUsed: 1200000
    },
    realTimeLatency: 450
  },

  singleUpload: {
    processingTime: 6500,
    success: true,
    tokensUsed: 2200,
    apiCalls: 2,
    confidence: 0.94
  },

  batchUpload: {
    totalFiles: 25,
    processedFiles: 24,
    failedFiles: 1,
    averageTimePerFile: 7200,
    totalProcessingTime: 180000,
    successRate: 0.96,
    rateLimitHits: 0,
    queueWaitTime: 1500
  },

  queueSystem: {
    throughput: 48,
    workerEfficiency: 0.87,
    queueLatency: 800,
    averageRetryCount: 0.6,
    errorRate: 0.04
  }
};

/**
 * Mock system health metrics
 */
export const mockSystemHealthMetrics = {
  cpu: {
    usage: 0.65,
    cores: 8,
    loadAverage: [2.1, 2.3, 2.0]
  },
  
  memory: {
    usage: 0.72,
    total: 16000000000,
    used: 11520000000,
    free: 4480000000
  },
  
  database: {
    connections: 45,
    maxConnections: 100,
    queryTime: 25,
    lockWaitTime: 2
  },
  
  network: {
    requestsPerSecond: 150,
    responseTime: 120,
    errorRate: 0.02
  }
};

/**
 * Generate dynamic mock response based on request parameters
 */
export function generateDynamicMockResponse(
  type: 'gemini' | 'openrouter' | 'supabase',
  scenario: 'success' | 'error' | 'rateLimit' | 'timeout',
  customData?: any
): any {
  const baseResponses = {
    gemini: mockGeminiResponses,
    openrouter: mockOpenRouterResponses,
    supabase: mockSupabaseResponses
  };

  const base = baseResponses[type];
  
  switch (scenario) {
    case 'success':
      return { ...base.success, ...customData };
    case 'error':
      return { ...base.serverError, ...customData };
    case 'rateLimit':
      return { ...base.rateLimitError, ...customData };
    case 'timeout':
      return {
        error: {
          code: 408,
          message: "Request timeout",
          status: "TIMEOUT"
        },
        ...customData
      };
    default:
      return base.success;
  }
}
