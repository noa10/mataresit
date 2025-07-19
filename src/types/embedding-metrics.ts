/**
 * Types for Embedding Performance Monitoring System
 * Phase 1: Embedding Success Rate Monitoring Dashboard
 */

export interface EmbeddingPerformanceMetric {
  id: string;
  receipt_id: string;
  user_id: string;
  team_id: string;
  upload_context: 'single' | 'batch';
  model_used: string;
  embedding_start_time: string;
  embedding_end_time?: string;
  total_duration_ms?: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'timeout';
  retry_count: number;
  error_type?: 'api_limit' | 'network' | 'validation' | 'timeout' | 'unknown';
  error_message?: string;
  content_types_processed: string[];
  total_content_types: number;
  successful_content_types: number;
  failed_content_types: number;
  api_calls_made: number;
  api_tokens_used: number;
  api_rate_limited: boolean;
  embedding_dimensions?: number;
  content_length: number;
  synthetic_content_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmbeddingHourlyStats {
  id: string;
  hour_bucket: string;
  team_id: string;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  timeout_attempts: number;
  single_upload_attempts: number;
  batch_upload_attempts: number;
  single_upload_success: number;
  batch_upload_success: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  total_api_calls: number;
  total_tokens_used: number;
  rate_limited_count: number;
  api_limit_errors: number;
  network_errors: number;
  validation_errors: number;
  timeout_errors: number;
  unknown_errors: number;
  created_at: string;
}

export interface EmbeddingDailyStats {
  id: string;
  date_bucket: string;
  team_id: string;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  success_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  total_api_calls: number;
  total_tokens_used: number;
  estimated_cost_usd: number;
  synthetic_content_percentage: number;
  avg_content_types_per_receipt: number;
  created_at: string;
}

export interface EmbeddingHealthStatus {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  metrics: {
    raw_metrics_24h: number;
    hourly_stats_7d: number;
    daily_stats_30d: number;
    latest_hourly_aggregation: string | null;
    latest_daily_aggregation: string | null;
  };
  issues: string[];
}

export interface EmbeddingAggregationResult {
  success: boolean;
  aggregationType: 'hourly' | 'daily' | 'cleanup' | 'all';
  summary: {
    successful: number;
    failed: number;
    totalOperations: number;
    totalExecutionTime: number;
  };
  results: Array<{
    operation: string;
    success: boolean;
    message: string;
    executionTime: number;
  }>;
  timestamp: string;
}

export interface EmbeddingMetricsSummary {
  totalEmbeddings: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
  topErrors: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  performanceTrend: 'improving' | 'stable' | 'declining';
  healthScore: number;
}

export interface EmbeddingChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }>;
}

export interface EmbeddingMetricsFilters {
  dateRange: {
    start: string;
    end: string;
  };
  uploadContext?: 'single' | 'batch' | 'all';
  status?: 'success' | 'failed' | 'all';
  teamId?: string;
  modelUsed?: string;
}

export interface EmbeddingAlertThreshold {
  id: string;
  name: string;
  metric: 'success_rate' | 'avg_duration' | 'error_rate' | 'cost_per_hour';
  operator: 'less_than' | 'greater_than' | 'equals';
  value: number;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notification_channels: string[];
}

export interface EmbeddingAlert {
  id: string;
  threshold_id: string;
  triggered_at: string;
  resolved_at?: string;
  current_value: number;
  threshold_value: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
}

export interface EmbeddingCostBreakdown {
  totalCost: number;
  costByModel: Record<string, number>;
  costByContext: {
    single: number;
    batch: number;
  };
  costTrend: Array<{
    date: string;
    cost: number;
    tokens: number;
  }>;
  projectedMonthlyCost: number;
  budgetUtilization: number;
}

export interface EmbeddingQualityMetrics {
  syntheticContentUsage: number;
  avgContentTypesPerReceipt: number;
  contentTypeSuccessRates: Record<string, number>;
  embeddingDimensionsDistribution: Record<number, number>;
  qualityScore: number;
  qualityTrend: 'improving' | 'stable' | 'declining';
}
