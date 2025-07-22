/**
 * Test Data Generators for Phase 4 Integration Tests
 * 
 * This file provides functions to generate test data for various integration testing scenarios.
 */

export interface TestReceiptData {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  merchantName: string;
  totalAmount: string;
  currency: string;
  date: string;
  items: TestReceiptItem[];
  metadata: Record<string, any>;
}

export interface TestReceiptItem {
  description: string;
  amount: string;
  quantity: number;
  category?: string;
}

export interface TestBatchSession {
  id: string;
  sessionName: string;
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesPending: number;
  processingStrategy: string;
  status: string;
  rateLimitConfig: Record<string, any>;
}

export interface TestQueueItem {
  id: string;
  sourceType: string;
  sourceId: string;
  operation: string;
  priority: string;
  status: string;
  retryCount: number;
  metadata: Record<string, any>;
}

/**
 * Generate test receipt data
 */
export function generateTestReceiptData(count: number): TestReceiptData[] {
  const receipts: TestReceiptData[] = [];
  const merchants = [
    'Starbucks Coffee', 'McDonald\'s', 'Walmart', 'Target', 'Amazon',
    'Best Buy', 'Home Depot', 'CVS Pharmacy', 'Walgreens', 'Costco',
    'Whole Foods', 'Trader Joe\'s', 'Safeway', 'Kroger', 'Shell',
    'Chevron', 'Exxon', 'BP', 'Subway', 'Pizza Hut'
  ];
  
  const categories = [
    'Food & Dining', 'Groceries', 'Gas & Fuel', 'Shopping', 'Electronics',
    'Health & Pharmacy', 'Entertainment', 'Travel', 'Utilities', 'Services'
  ];

  for (let i = 1; i <= count; i++) {
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items: TestReceiptItem[] = [];
    let totalAmount = 0;

    // Generate items
    for (let j = 1; j <= itemCount; j++) {
      const itemAmount = Math.random() * 50 + 5;
      const quantity = Math.floor(Math.random() * 3) + 1;
      
      items.push({
        description: `Test Item ${j}`,
        amount: itemAmount.toFixed(2),
        quantity,
        category
      });
      
      totalAmount += itemAmount * quantity;
    }

    // Add tax
    const tax = totalAmount * 0.08;
    totalAmount += tax;

    receipts.push({
      id: `test-receipt-${i}`,
      fileName: `test-receipt-${i}.jpg`,
      fileSize: Math.floor(Math.random() * 2000000) + 500000, // 0.5MB to 2.5MB
      fileType: 'image/jpeg',
      merchantName: merchant,
      totalAmount: totalAmount.toFixed(2),
      currency: 'USD',
      date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items,
      metadata: {
        test_data: true,
        test_index: i,
        category,
        tax_amount: tax.toFixed(2),
        subtotal: (totalAmount - tax).toFixed(2)
      }
    });
  }

  return receipts;
}

/**
 * Generate test batch session data
 */
export function generateTestBatchSessions(count: number): TestBatchSession[] {
  const sessions: TestBatchSession[] = [];
  const strategies = ['conservative', 'balanced', 'aggressive', 'adaptive'];
  const statuses = ['pending', 'processing', 'completed', 'failed', 'paused'];

  for (let i = 1; i <= count; i++) {
    const totalFiles = Math.floor(Math.random() * 100) + 10;
    const filesCompleted = Math.floor(Math.random() * totalFiles);
    const filesFailed = Math.floor(Math.random() * (totalFiles - filesCompleted));
    const filesPending = totalFiles - filesCompleted - filesFailed;

    sessions.push({
      id: `test-batch-session-${i}`,
      sessionName: `Test Batch ${i}`,
      totalFiles,
      filesCompleted,
      filesFailed,
      filesPending,
      processingStrategy: strategies[Math.floor(Math.random() * strategies.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      rateLimitConfig: {
        maxConcurrentRequests: Math.floor(Math.random() * 8) + 2,
        requestsPerMinute: Math.floor(Math.random() * 60) + 30,
        tokensPerMinute: Math.floor(Math.random() * 100000) + 50000,
        burstAllowance: Math.floor(Math.random() * 10) + 5,
        backoffMultiplier: 1.5 + Math.random(),
        maxBackoffMs: Math.floor(Math.random() * 60000) + 30000,
        adaptiveScaling: Math.random() > 0.5
      }
    });
  }

  return sessions;
}

/**
 * Generate test queue items
 */
export function generateTestQueueItems(count: number): TestQueueItem[] {
  const items: TestQueueItem[] = [];
  const sourceTypes = ['receipts', 'documents', 'images'];
  const operations = ['INSERT', 'UPDATE', 'DELETE'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['pending', 'processing', 'completed', 'failed', 'rate_limited'];

  for (let i = 1; i <= count; i++) {
    items.push({
      id: `test-queue-item-${i}`,
      sourceType: sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
      sourceId: `test-source-${i}`,
      operation: operations[Math.floor(Math.random() * operations.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      retryCount: Math.floor(Math.random() * 3),
      metadata: {
        test_data: true,
        test_index: i,
        estimated_tokens: Math.floor(Math.random() * 3000) + 500,
        processing_time_ms: Math.floor(Math.random() * 10000) + 1000
      }
    });
  }

  return items;
}

/**
 * Generate test embedding metrics
 */
export function generateTestEmbeddingMetrics(count: number): any[] {
  const metrics: any[] = [];
  const operationTypes = ['embedding_generation', 'embedding_update', 'embedding_deletion'];
  const sourceTypes = ['receipts', 'documents', 'images'];
  const statuses = ['completed', 'failed', 'rate_limited'];
  const apiProviders = ['gemini', 'openrouter', 'openai'];
  const models = ['gemini-1.5-pro', 'claude-3-sonnet', 'gpt-4-turbo'];
  const errorTypes = ['rate_limit', 'quota_exceeded', 'timeout', 'invalid_request', null];

  for (let i = 1; i <= count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const isSuccess = status === 'completed';
    
    metrics.push({
      id: `test-metric-${i}`,
      operation_type: operationTypes[Math.floor(Math.random() * operationTypes.length)],
      source_type: sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
      source_id: `test-source-${i}`,
      status,
      processing_time_ms: Math.floor(Math.random() * 15000) + 1000,
      tokens_used: isSuccess ? Math.floor(Math.random() * 3000) + 500 : 0,
      api_provider: apiProviders[Math.floor(Math.random() * apiProviders.length)],
      model_used: models[Math.floor(Math.random() * models.length)],
      error_type: isSuccess ? null : errorTypes[Math.floor(Math.random() * (errorTypes.length - 1))],
      error_message: isSuccess ? null : `Test error message ${i}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: true,
        test_index: i,
        batch_session_id: Math.random() > 0.5 ? `test-batch-${Math.floor(i / 10) + 1}` : null
      }
    });
  }

  return metrics;
}

/**
 * Generate test API quota tracking data
 */
export function generateTestAPIQuotaData(count: number): any[] {
  const quotaData: any[] = [];
  const apiProviders = ['gemini', 'openrouter', 'openai'];

  for (let i = 1; i <= count; i++) {
    const provider = apiProviders[Math.floor(Math.random() * apiProviders.length)];
    const requestsUsed = Math.floor(Math.random() * 1000);
    const tokensUsed = Math.floor(Math.random() * 100000);
    
    quotaData.push({
      id: `test-quota-${i}`,
      api_provider: provider,
      time_window: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      requests_used: requestsUsed,
      requests_limit: 1000,
      tokens_used: tokensUsed,
      tokens_limit: 100000,
      quota_exceeded: requestsUsed >= 1000 || tokensUsed >= 100000,
      reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: true,
        test_index: i
      }
    });
  }

  return quotaData;
}

/**
 * Generate test worker data
 */
export function generateTestWorkers(count: number): any[] {
  const workers: any[] = [];
  const statuses = ['active', 'idle', 'stopped', 'error'];

  for (let i = 1; i <= count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const isActive = status === 'active';
    
    workers.push({
      id: `test-worker-${i}`,
      worker_id: `test-worker-${i}`,
      status,
      last_heartbeat: new Date(Date.now() - Math.random() * 60000).toISOString(),
      current_task: isActive ? `test-task-${i}` : null,
      processed_count: Math.floor(Math.random() * 1000),
      error_count: Math.floor(Math.random() * 50),
      started_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        test_data: true,
        test_index: i,
        version: '1.0.0',
        capabilities: ['embedding_generation', 'batch_processing']
      }
    });
  }

  return workers;
}

/**
 * Generate performance baseline data
 */
export function generatePerformanceBaseline(): {
  singleUpload: any;
  batchUpload: any;
  queueSystem: any;
  monitoring: any;
} {
  return {
    singleUpload: {
      averageProcessingTime: 8500,
      successRate: 0.92,
      apiCallsPerReceipt: 3.2,
      tokensPerReceipt: 2800,
      p95ProcessingTime: 12000,
      p99ProcessingTime: 18000
    },
    batchUpload: {
      averageProcessingTime: 12000,
      successRate: 0.87,
      concurrentLimit: 2,
      rateLimitFailures: 0.15,
      throughputPerHour: 120,
      queueWaitTime: 5000
    },
    queueSystem: {
      throughput: 30,
      workerEfficiency: 0.75,
      queueLatency: 2000,
      averageRetryCount: 1.2,
      errorRate: 0.08
    },
    monitoring: {
      dashboardLoadTime: 3000,
      metricsAccuracy: 0.95,
      realTimeLatency: 1000,
      updateFrequency: 5000,
      dataRetention: 30
    }
  };
}

/**
 * Generate target performance metrics
 */
export function generateTargetMetrics(): {
  singleUpload: any;
  batchUpload: any;
  queueSystem: any;
  monitoring: any;
} {
  return {
    singleUpload: {
      averageProcessingTime: 7000,
      successRate: 0.97,
      apiCallsPerReceipt: 2.8,
      tokensPerReceipt: 2600,
      p95ProcessingTime: 9000,
      p99ProcessingTime: 12000
    },
    batchUpload: {
      averageProcessingTime: 8500,
      successRate: 0.96,
      concurrentLimit: 8,
      rateLimitFailures: 0.02,
      throughputPerHour: 200,
      queueWaitTime: 2000
    },
    queueSystem: {
      throughput: 50,
      workerEfficiency: 0.85,
      queueLatency: 1000,
      averageRetryCount: 0.8,
      errorRate: 0.05
    },
    monitoring: {
      dashboardLoadTime: 2000,
      metricsAccuracy: 0.99,
      realTimeLatency: 500,
      updateFrequency: 3000,
      dataRetention: 90
    }
  };
}
