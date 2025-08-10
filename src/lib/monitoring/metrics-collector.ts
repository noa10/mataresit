// Production Metrics Collector
// Comprehensive metrics collection for embedding processing and system health

import { createPrometheusMetrics } from 'prom-client';
import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';

// Metrics configuration
const METRICS_CONFIG = {
  defaultLabels: {
    service: 'mataresit',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  collectDefaultMetrics: true,
  timeout: 5000
};

// Initialize default metrics collection
createPrometheusMetrics(METRICS_CONFIG);

// Embedding Processing Metrics
export const embeddingJobsProcessed = new Counter({
  name: 'embedding_jobs_processed_total',
  help: 'Total number of embedding jobs processed',
  labelNames: ['status', 'team_id', 'user_id', 'provider', 'model']
});

export const embeddingProcessingDuration = new Histogram({
  name: 'embedding_processing_duration_seconds',
  help: 'Time spent processing embedding jobs',
  labelNames: ['team_id', 'provider', 'model', 'batch_size'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
});

export const embeddingQueueDepth = new Gauge({
  name: 'embedding_queue_depth',
  help: 'Current depth of the embedding queue',
  labelNames: ['priority', 'team_id']
});

export const embeddingErrors = new Counter({
  name: 'embedding_errors_total',
  help: 'Total number of embedding processing errors',
  labelNames: ['type', 'provider', 'error_code', 'team_id']
});

// API and Rate Limiting Metrics
export const apiRequests = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests made',
  labelNames: ['provider', 'endpoint', 'status', 'method']
});

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Time spent on API requests',
  labelNames: ['provider', 'endpoint', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

export const apiQuotaUsage = new Gauge({
  name: 'api_quota_usage_percent',
  help: 'Current API quota usage percentage',
  labelNames: ['provider', 'type', 'window']
});

export const rateLimitRemaining = new Gauge({
  name: 'rate_limit_remaining',
  help: 'Remaining rate limit quota',
  labelNames: ['provider', 'type', 'window']
});

export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['provider', 'type']
});

// Cost Tracking Metrics
export const apiCost = new Counter({
  name: 'api_cost_total',
  help: 'Total API costs incurred',
  labelNames: ['provider', 'model', 'type', 'team_id']
});

export const tokenUsage = new Counter({
  name: 'token_usage_total',
  help: 'Total tokens consumed',
  labelNames: ['provider', 'model', 'type', 'team_id']
});

// Worker Health Metrics
export const workerJobsProcessed = new Counter({
  name: 'worker_jobs_processed_total',
  help: 'Total jobs processed by workers',
  labelNames: ['worker_id', 'status', 'job_type']
});

export const workerJobsFailed = new Counter({
  name: 'worker_jobs_failed_total',
  help: 'Total jobs failed by workers',
  labelNames: ['worker_id', 'error_type', 'job_type']
});

export const workerActiveJobs = new Gauge({
  name: 'worker_active_jobs',
  help: 'Currently active jobs per worker',
  labelNames: ['worker_id', 'job_type']
});

export const workerAssignedJobs = new Gauge({
  name: 'worker_assigned_jobs',
  help: 'Jobs assigned to worker',
  labelNames: ['worker_id', 'job_type']
});

export const workerHealthScore = new Gauge({
  name: 'worker_health_score',
  help: 'Worker health score (0-100)',
  labelNames: ['worker_id']
});

export const workerErrors = new Counter({
  name: 'worker_errors_total',
  help: 'Total worker errors',
  labelNames: ['worker_id', 'type', 'severity']
});

// Database Metrics
export const databaseQueries = new Counter({
  name: 'database_queries_total',
  help: 'Total database queries executed',
  labelNames: ['operation', 'table', 'status']
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Time spent on database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Currently active database connections'
});

export const databaseConnectionsMax = new Gauge({
  name: 'database_connections_max',
  help: 'Maximum database connections allowed'
});

// Batch Processing Metrics
export const batchJobsProcessed = new Counter({
  name: 'batch_jobs_processed_total',
  help: 'Total batch jobs processed',
  labelNames: ['status', 'team_id', 'batch_type']
});

export const batchSize = new Histogram({
  name: 'batch_size',
  help: 'Size of processed batches',
  labelNames: ['status', 'batch_type'],
  buckets: [1, 5, 10, 20, 50, 100, 200]
});

export const batchProcessingDuration = new Histogram({
  name: 'batch_processing_duration_seconds',
  help: 'Time spent processing batches',
  labelNames: ['batch_type', 'team_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600]
});

// Feature Flag Metrics
export const featureFlagEvaluations = new Counter({
  name: 'feature_flag_evaluations_total',
  help: 'Total feature flag evaluations',
  labelNames: ['flag_name', 'result', 'user_id', 'team_id']
});

export const featureFlagErrors = new Counter({
  name: 'feature_flag_errors_total',
  help: 'Total feature flag evaluation errors',
  labelNames: ['flag_name', 'error_type']
});

// System Health Metrics
export const systemHealth = new Gauge({
  name: 'system_health_score',
  help: 'Overall system health score (0-100)',
  labelNames: ['component']
});

export const deploymentVersion = new Gauge({
  name: 'deployment_version',
  help: 'Current deployment version',
  labelNames: ['version', 'component']
});

// Metrics Collection Helper Class
export class MetricsCollector {
  private static instance: MetricsCollector;
  private collectionInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Start automatic metrics collection
  startCollection(intervalMs: number = 30000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  // Stop metrics collection
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  // Collect system-level metrics
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      systemHealth.set(
        { component: 'memory' },
        Math.max(0, 100 - (memUsage.heapUsed / memUsage.heapTotal) * 100)
      );

      // Event loop lag
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
        systemHealth.set({ component: 'event_loop' }, Math.max(0, 100 - lag));
      });

      // Update deployment version
      deploymentVersion.set(
        { 
          version: process.env.npm_package_version || '1.0.0',
          component: 'api'
        },
        1
      );

    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  // Record embedding job processing
  recordEmbeddingJob(
    status: 'success' | 'failed',
    duration: number,
    labels: {
      teamId?: string;
      userId?: string;
      provider: string;
      model: string;
      batchSize?: number;
    }
  ): void {
    embeddingJobsProcessed.inc({
      status,
      team_id: labels.teamId || 'unknown',
      user_id: labels.userId || 'unknown',
      provider: labels.provider,
      model: labels.model
    });

    embeddingProcessingDuration.observe(
      {
        team_id: labels.teamId || 'unknown',
        provider: labels.provider,
        model: labels.model,
        batch_size: labels.batchSize?.toString() || '1'
      },
      duration
    );
  }

  // Record API request
  recordApiRequest(
    provider: string,
    endpoint: string,
    method: string,
    status: string,
    duration: number
  ): void {
    apiRequests.inc({ provider, endpoint, status, method });
    apiRequestDuration.observe({ provider, endpoint, status }, duration);
  }

  // Record rate limit status
  recordRateLimit(
    provider: string,
    type: 'requests' | 'tokens',
    remaining: number,
    total: number,
    window: string = '1m'
  ): void {
    const usagePercent = ((total - remaining) / total) * 100;
    apiQuotaUsage.set({ provider, type, window }, usagePercent);
    rateLimitRemaining.set({ provider, type, window }, remaining);
  }

  // Record cost information
  recordCost(
    provider: string,
    model: string,
    type: 'input' | 'output',
    cost: number,
    teamId?: string
  ): void {
    apiCost.inc(
      {
        provider,
        model,
        type,
        team_id: teamId || 'unknown'
      },
      cost
    );
  }

  // Record worker activity
  recordWorkerActivity(
    workerId: string,
    jobType: string,
    status: 'success' | 'failed',
    activeJobs: number,
    assignedJobs: number
  ): void {
    workerJobsProcessed.inc({ worker_id: workerId, status, job_type: jobType });
    workerActiveJobs.set({ worker_id: workerId, job_type: jobType }, activeJobs);
    workerAssignedJobs.set({ worker_id: workerId, job_type: jobType }, assignedJobs);
  }

  // Record database query
  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    status: 'success' | 'error' = 'success'
  ): void {
    databaseQueries.inc({ operation, table, status });
    databaseQueryDuration.observe({ operation, table }, duration);
  }

  // Update queue depth
  updateQueueDepth(depth: number, priority: string = 'normal', teamId?: string): void {
    embeddingQueueDepth.set(
      {
        priority,
        team_id: teamId || 'all'
      },
      depth
    );
  }

  // Record feature flag evaluation
  recordFeatureFlagEvaluation(
    flagName: string,
    result: boolean,
    userId?: string,
    teamId?: string
  ): void {
    featureFlagEvaluations.inc({
      flag_name: flagName,
      result: result.toString(),
      user_id: userId || 'unknown',
      team_id: teamId || 'unknown'
    });
  }

  // Get metrics for export
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Clear all metrics (for testing)
  clearMetrics(): void {
    register.clear();
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();

// Auto-start collection in production
if (process.env.NODE_ENV === 'production') {
  metricsCollector.startCollection();
}
