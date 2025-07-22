/**
 * Performance Baseline and Target Metrics
 * 
 * This file defines the performance baselines and target metrics for Phase 4
 * performance benchmarking tests.
 */

export interface PerformanceMetrics {
  averageProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  successRate: number;
  throughput: number;
  errorRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export interface SingleUploadMetrics extends PerformanceMetrics {
  tokensPerReceipt: number;
  apiCallsPerReceipt: number;
  embeddingGenerationTime: number;
  receiptProcessingTime: number;
}

export interface BatchUploadMetrics extends PerformanceMetrics {
  concurrentLimit: number;
  rateLimitFailures: number;
  queueWaitTime: number;
  batchCompletionTime: number;
  filesPerMinute: number;
}

export interface QueueSystemMetrics extends PerformanceMetrics {
  workerEfficiency: number;
  queueLatency: number;
  averageRetryCount: number;
  deadLetterQueueRate: number;
  workerUtilization: number;
}

export interface MonitoringDashboardMetrics extends PerformanceMetrics {
  dashboardLoadTime: number;
  metricsAccuracy: number;
  realTimeLatency: number;
  updateFrequency: number;
  dataRetentionDays: number;
}

/**
 * Current baseline performance metrics (before Phase 4 optimizations)
 */
export const BASELINE_METRICS = {
  singleUpload: {
    averageProcessingTime: 8500, // ms
    p95ProcessingTime: 12000, // ms
    p99ProcessingTime: 18000, // ms
    successRate: 0.92,
    throughput: 7, // uploads per minute
    errorRate: 0.08,
    tokensPerReceipt: 2800,
    apiCallsPerReceipt: 3.2,
    embeddingGenerationTime: 3500, // ms
    receiptProcessingTime: 5000, // ms
    resourceUtilization: {
      cpu: 0.65,
      memory: 0.70,
      network: 0.45
    }
  } as SingleUploadMetrics,

  batchUpload: {
    averageProcessingTime: 12000, // ms per file
    p95ProcessingTime: 18000, // ms
    p99ProcessingTime: 25000, // ms
    successRate: 0.87,
    throughput: 5, // files per minute
    errorRate: 0.13,
    concurrentLimit: 2,
    rateLimitFailures: 0.15,
    queueWaitTime: 5000, // ms
    batchCompletionTime: 600000, // ms for 50 files
    filesPerMinute: 5,
    resourceUtilization: {
      cpu: 0.75,
      memory: 0.80,
      network: 0.60
    }
  } as BatchUploadMetrics,

  queueSystem: {
    averageProcessingTime: 4000, // ms per item
    p95ProcessingTime: 8000, // ms
    p99ProcessingTime: 15000, // ms
    successRate: 0.85,
    throughput: 30, // items per minute
    errorRate: 0.15,
    workerEfficiency: 0.75,
    queueLatency: 2000, // ms
    averageRetryCount: 1.2,
    deadLetterQueueRate: 0.02,
    workerUtilization: 0.70,
    resourceUtilization: {
      cpu: 0.60,
      memory: 0.65,
      network: 0.50
    }
  } as QueueSystemMetrics,

  monitoring: {
    averageProcessingTime: 500, // ms for metric queries
    p95ProcessingTime: 1000, // ms
    p99ProcessingTime: 2000, // ms
    successRate: 0.95,
    throughput: 120, // queries per minute
    errorRate: 0.05,
    dashboardLoadTime: 3000, // ms
    metricsAccuracy: 0.95,
    realTimeLatency: 1000, // ms
    updateFrequency: 5000, // ms
    dataRetentionDays: 30,
    resourceUtilization: {
      cpu: 0.30,
      memory: 0.40,
      network: 0.25
    }
  } as MonitoringDashboardMetrics
};

/**
 * Target performance metrics (Phase 4 goals)
 */
export const TARGET_METRICS = {
  singleUpload: {
    averageProcessingTime: 7000, // 17% improvement
    p95ProcessingTime: 9000, // 25% improvement
    p99ProcessingTime: 12000, // 33% improvement
    successRate: 0.97, // 5% improvement
    throughput: 10, // 43% improvement
    errorRate: 0.03, // 62% improvement
    tokensPerReceipt: 2600, // 7% improvement
    apiCallsPerReceipt: 2.8, // 12% improvement
    embeddingGenerationTime: 3000, // 14% improvement
    receiptProcessingTime: 4000, // 20% improvement
    resourceUtilization: {
      cpu: 0.55, // 15% improvement
      memory: 0.60, // 14% improvement
      network: 0.40 // 11% improvement
    }
  } as SingleUploadMetrics,

  batchUpload: {
    averageProcessingTime: 8500, // 29% improvement
    p95ProcessingTime: 12000, // 33% improvement
    p99ProcessingTime: 16000, // 36% improvement
    successRate: 0.96, // 10% improvement
    throughput: 8, // 60% improvement
    errorRate: 0.04, // 69% improvement
    concurrentLimit: 8, // 300% improvement
    rateLimitFailures: 0.02, // 87% improvement
    queueWaitTime: 2000, // 60% improvement
    batchCompletionTime: 375000, // 37% improvement for 50 files
    filesPerMinute: 8,
    resourceUtilization: {
      cpu: 0.65, // 13% improvement
      memory: 0.70, // 12% improvement
      network: 0.50 // 17% improvement
    }
  } as BatchUploadMetrics,

  queueSystem: {
    averageProcessingTime: 3000, // 25% improvement
    p95ProcessingTime: 6000, // 25% improvement
    p99ProcessingTime: 10000, // 33% improvement
    successRate: 0.95, // 12% improvement
    throughput: 50, // 67% improvement
    errorRate: 0.05, // 67% improvement
    workerEfficiency: 0.85, // 13% improvement
    queueLatency: 1000, // 50% improvement
    averageRetryCount: 0.8, // 33% improvement
    deadLetterQueueRate: 0.01, // 50% improvement
    workerUtilization: 0.80, // 14% improvement
    resourceUtilization: {
      cpu: 0.50, // 17% improvement
      memory: 0.55, // 15% improvement
      network: 0.40 // 20% improvement
    }
  } as QueueSystemMetrics,

  monitoring: {
    averageProcessingTime: 300, // 40% improvement
    p95ProcessingTime: 600, // 40% improvement
    p99ProcessingTime: 1200, // 40% improvement
    successRate: 0.99, // 4% improvement
    throughput: 200, // 67% improvement
    errorRate: 0.01, // 80% improvement
    dashboardLoadTime: 2000, // 33% improvement
    metricsAccuracy: 0.99, // 4% improvement
    realTimeLatency: 500, // 50% improvement
    updateFrequency: 3000, // 40% improvement
    dataRetentionDays: 90, // 200% improvement
    resourceUtilization: {
      cpu: 0.25, // 17% improvement
      memory: 0.35, // 12% improvement
      network: 0.20 // 20% improvement
    }
  } as MonitoringDashboardMetrics
};

/**
 * Performance test thresholds (minimum acceptable performance)
 */
export const PERFORMANCE_THRESHOLDS = {
  singleUpload: {
    maxProcessingTime: 7500, // ms
    minSuccessRate: 0.95,
    maxTokensPerReceipt: 2800,
    maxApiCallsPerReceipt: 3.0
  },

  batchUpload: {
    maxProcessingTime: 9000, // ms per file
    minSuccessRate: 0.94,
    minConcurrentLimit: 6,
    maxRateLimitFailures: 0.05,
    maxQueueWaitTime: 3000 // ms
  },

  queueSystem: {
    minThroughput: 45, // items per minute
    minWorkerEfficiency: 0.80,
    maxQueueLatency: 1500, // ms
    maxAverageRetryCount: 1.0
  },

  monitoring: {
    maxDashboardLoadTime: 2500, // ms
    minMetricsAccuracy: 0.98,
    maxRealTimeLatency: 750, // ms
    minUpdateFrequency: 4000 // ms
  }
};

/**
 * Calculate performance improvement percentage
 */
export function calculateImprovement(baseline: number, current: number, higherIsBetter: boolean = false): number {
  if (higherIsBetter) {
    return ((current - baseline) / baseline) * 100;
  } else {
    return ((baseline - current) / baseline) * 100;
  }
}

/**
 * Check if metrics meet performance thresholds
 */
export function validatePerformanceThresholds(
  category: 'singleUpload' | 'batchUpload' | 'queueSystem' | 'monitoring',
  metrics: any
): { passed: boolean; failures: string[] } {
  const thresholds = PERFORMANCE_THRESHOLDS[category];
  const failures: string[] = [];

  switch (category) {
    case 'singleUpload':
      if (metrics.averageProcessingTime > thresholds.maxProcessingTime) {
        failures.push(`Processing time ${metrics.averageProcessingTime}ms exceeds threshold ${thresholds.maxProcessingTime}ms`);
      }
      if (metrics.successRate < thresholds.minSuccessRate) {
        failures.push(`Success rate ${metrics.successRate} below threshold ${thresholds.minSuccessRate}`);
      }
      if (metrics.tokensPerReceipt > thresholds.maxTokensPerReceipt) {
        failures.push(`Tokens per receipt ${metrics.tokensPerReceipt} exceeds threshold ${thresholds.maxTokensPerReceipt}`);
      }
      if (metrics.apiCallsPerReceipt > thresholds.maxApiCallsPerReceipt) {
        failures.push(`API calls per receipt ${metrics.apiCallsPerReceipt} exceeds threshold ${thresholds.maxApiCallsPerReceipt}`);
      }
      break;

    case 'batchUpload':
      if (metrics.averageProcessingTime > thresholds.maxProcessingTime) {
        failures.push(`Processing time ${metrics.averageProcessingTime}ms exceeds threshold ${thresholds.maxProcessingTime}ms`);
      }
      if (metrics.successRate < thresholds.minSuccessRate) {
        failures.push(`Success rate ${metrics.successRate} below threshold ${thresholds.minSuccessRate}`);
      }
      if (metrics.concurrentLimit < thresholds.minConcurrentLimit) {
        failures.push(`Concurrent limit ${metrics.concurrentLimit} below threshold ${thresholds.minConcurrentLimit}`);
      }
      if (metrics.rateLimitFailures > thresholds.maxRateLimitFailures) {
        failures.push(`Rate limit failures ${metrics.rateLimitFailures} exceeds threshold ${thresholds.maxRateLimitFailures}`);
      }
      if (metrics.queueWaitTime > thresholds.maxQueueWaitTime) {
        failures.push(`Queue wait time ${metrics.queueWaitTime}ms exceeds threshold ${thresholds.maxQueueWaitTime}ms`);
      }
      break;

    case 'queueSystem':
      if (metrics.throughput < thresholds.minThroughput) {
        failures.push(`Throughput ${metrics.throughput} below threshold ${thresholds.minThroughput}`);
      }
      if (metrics.workerEfficiency < thresholds.minWorkerEfficiency) {
        failures.push(`Worker efficiency ${metrics.workerEfficiency} below threshold ${thresholds.minWorkerEfficiency}`);
      }
      if (metrics.queueLatency > thresholds.maxQueueLatency) {
        failures.push(`Queue latency ${metrics.queueLatency}ms exceeds threshold ${thresholds.maxQueueLatency}ms`);
      }
      if (metrics.averageRetryCount > thresholds.maxAverageRetryCount) {
        failures.push(`Average retry count ${metrics.averageRetryCount} exceeds threshold ${thresholds.maxAverageRetryCount}`);
      }
      break;

    case 'monitoring':
      if (metrics.dashboardLoadTime > thresholds.maxDashboardLoadTime) {
        failures.push(`Dashboard load time ${metrics.dashboardLoadTime}ms exceeds threshold ${thresholds.maxDashboardLoadTime}ms`);
      }
      if (metrics.metricsAccuracy < thresholds.minMetricsAccuracy) {
        failures.push(`Metrics accuracy ${metrics.metricsAccuracy} below threshold ${thresholds.minMetricsAccuracy}`);
      }
      if (metrics.realTimeLatency > thresholds.maxRealTimeLatency) {
        failures.push(`Real-time latency ${metrics.realTimeLatency}ms exceeds threshold ${thresholds.maxRealTimeLatency}ms`);
      }
      break;
  }

  return {
    passed: failures.length === 0,
    failures
  };
}
