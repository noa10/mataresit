/**
 * Chart Utilities for Embedding Metrics
 * Helper functions for data transformation and chart configuration
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import {
  EmbeddingHourlyStats,
  EmbeddingDailyStats,
  EmbeddingPerformanceMetric,
  EmbeddingMetricsSummary
} from '@/types/embedding-metrics';

export interface ChartDataPoint {
  timestamp: string;
  date: string;
  time: string;
  value: number;
  label: string;
  category?: string;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color: string;
  type?: 'line' | 'bar' | 'area';
}

export interface ChartConfig {
  title: string;
  subtitle?: string;
  xAxisLabel: string;
  yAxisLabel: string;
  series: ChartSeries[];
  chartType: 'line' | 'bar' | 'area' | 'pie' | 'scatter';
  showLegend: boolean;
  showGrid: boolean;
  responsive: boolean;
  height?: number;
}

/**
 * Color palette for charts
 */
export const CHART_COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#6366F1',
  purple: '#8B5CF6',
  pink: '#EC4899',
  teal: '#14B8A6',
  orange: '#F97316',
  gray: '#6B7280'
};

export const CHART_GRADIENTS = {
  success: ['#10B981', '#34D399'],
  warning: ['#F59E0B', '#FBBF24'],
  error: ['#EF4444', '#F87171'],
  primary: ['#3B82F6', '#60A5FA'],
  purple: ['#8B5CF6', '#A78BFA']
};

/**
 * Transform hourly stats to chart data for success rate trends
 */
export function transformHourlyStatsToSuccessRate(stats: EmbeddingHourlyStats[]): ChartSeries[] {
  const successRateData: ChartDataPoint[] = stats.map(stat => {
    const successRate = stat.total_attempts > 0 
      ? (stat.successful_attempts / stat.total_attempts) * 100 
      : 0;
    
    const date = new Date(stat.hour_bucket);
    return {
      timestamp: stat.hour_bucket,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: Math.round(successRate * 100) / 100,
      label: `${successRate.toFixed(1)}%`,
      category: 'success_rate'
    };
  });

  return [{
    name: 'Success Rate',
    data: successRateData,
    color: CHART_COLORS.success,
    type: 'line'
  }];
}

/**
 * Transform hourly stats to chart data for duration trends
 */
export function transformHourlyStatsToDuration(stats: EmbeddingHourlyStats[]): ChartSeries[] {
  const avgDurationData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.hour_bucket);
    return {
      timestamp: stat.hour_bucket,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: stat.avg_duration_ms,
      label: `${stat.avg_duration_ms}ms`,
      category: 'avg_duration'
    };
  });

  const p95DurationData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.hour_bucket);
    return {
      timestamp: stat.hour_bucket,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: stat.p95_duration_ms,
      label: `${stat.p95_duration_ms}ms`,
      category: 'p95_duration'
    };
  });

  return [
    {
      name: 'Average Duration',
      data: avgDurationData,
      color: CHART_COLORS.primary,
      type: 'line'
    },
    {
      name: 'P95 Duration',
      data: p95DurationData,
      color: CHART_COLORS.warning,
      type: 'line'
    }
  ];
}

/**
 * Transform hourly stats to API usage chart data
 */
export function transformHourlyStatsToApiUsage(stats: EmbeddingHourlyStats[]): ChartSeries[] {
  const apiCallsData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.hour_bucket);
    return {
      timestamp: stat.hour_bucket,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: stat.total_api_calls,
      label: `${stat.total_api_calls} calls`,
      category: 'api_calls'
    };
  });

  const tokensData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.hour_bucket);
    return {
      timestamp: stat.hour_bucket,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: stat.total_tokens_used,
      label: `${stat.total_tokens_used} tokens`,
      category: 'tokens'
    };
  });

  return [
    {
      name: 'API Calls',
      data: apiCallsData,
      color: CHART_COLORS.info,
      type: 'bar'
    },
    {
      name: 'Tokens Used',
      data: tokensData,
      color: CHART_COLORS.purple,
      type: 'line'
    }
  ];
}

/**
 * Transform hourly stats to error pattern chart data
 */
export function transformHourlyStatsToErrorPatterns(stats: EmbeddingHourlyStats[]): ChartSeries[] {
  const errorTypes = [
    { key: 'api_limit_errors', name: 'API Limit', color: CHART_COLORS.error },
    { key: 'network_errors', name: 'Network', color: CHART_COLORS.warning },
    { key: 'validation_errors', name: 'Validation', color: CHART_COLORS.info },
    { key: 'timeout_errors', name: 'Timeout', color: CHART_COLORS.orange },
    { key: 'unknown_errors', name: 'Unknown', color: CHART_COLORS.gray }
  ];

  return errorTypes.map(errorType => ({
    name: errorType.name,
    data: stats.map(stat => {
      const date = new Date(stat.hour_bucket);
      const value = (stat as any)[errorType.key] || 0;
      return {
        timestamp: stat.hour_bucket,
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value,
        label: `${value} errors`,
        category: errorType.key
      };
    }),
    color: errorType.color,
    type: 'bar' as const
  }));
}

/**
 * Transform daily stats to cost trend chart data
 */
export function transformDailyStatsToCostTrend(stats: EmbeddingDailyStats[]): ChartSeries[] {
  const costData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.date_bucket);
    return {
      timestamp: stat.date_bucket,
      date: date.toLocaleDateString(),
      time: '',
      value: stat.estimated_cost_usd,
      label: `$${stat.estimated_cost_usd.toFixed(4)}`,
      category: 'cost'
    };
  });

  const tokensData: ChartDataPoint[] = stats.map(stat => {
    const date = new Date(stat.date_bucket);
    return {
      timestamp: stat.date_bucket,
      date: date.toLocaleDateString(),
      time: '',
      value: stat.total_tokens_used,
      label: `${stat.total_tokens_used} tokens`,
      category: 'tokens'
    };
  });

  return [
    {
      name: 'Daily Cost',
      data: costData,
      color: CHART_COLORS.success,
      type: 'area'
    },
    {
      name: 'Tokens Used',
      data: tokensData,
      color: CHART_COLORS.primary,
      type: 'line'
    }
  ];
}

/**
 * Create pie chart data for error distribution
 */
export function createErrorDistributionData(summary: EmbeddingMetricsSummary): Array<{
  name: string;
  value: number;
  color: string;
  percentage: number;
}> {
  const colors = [CHART_COLORS.error, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.orange, CHART_COLORS.gray];
  
  return summary.topErrors.map((error, index) => ({
    name: error.type.replace('_', ' ').toUpperCase(),
    value: error.count,
    color: colors[index % colors.length],
    percentage: error.percentage
  }));
}

/**
 * Create upload context distribution data
 */
export function createUploadContextData(stats: EmbeddingHourlyStats[]): Array<{
  name: string;
  value: number;
  color: string;
}> {
  const totalSingle = stats.reduce((sum, stat) => sum + stat.single_upload_attempts, 0);
  const totalBatch = stats.reduce((sum, stat) => sum + stat.batch_upload_attempts, 0);
  
  return [
    {
      name: 'Single Upload',
      value: totalSingle,
      color: CHART_COLORS.primary
    },
    {
      name: 'Batch Upload',
      value: totalBatch,
      color: CHART_COLORS.purple
    }
  ];
}

/**
 * Format chart tooltip content
 */
export function formatTooltipContent(value: any, name: string, props: any): [string, string] {
  const { payload } = props;
  
  if (payload && payload.category) {
    switch (payload.category) {
      case 'success_rate':
        return [`${value}%`, name];
      case 'avg_duration':
      case 'p95_duration':
        return [`${value}ms`, name];
      case 'api_calls':
        return [`${value} calls`, name];
      case 'tokens':
        return [`${value} tokens`, name];
      case 'cost':
        return [`$${value.toFixed(4)}`, name];
      default:
        return [value, name];
    }
  }
  
  return [value, name];
}

/**
 * Get responsive chart dimensions
 */
export function getResponsiveChartConfig(containerWidth: number): {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
} {
  const isMobile = containerWidth < 768;
  const isTablet = containerWidth < 1024;
  
  return {
    width: containerWidth,
    height: isMobile ? 250 : isTablet ? 300 : 350,
    margin: {
      top: 20,
      right: isMobile ? 10 : 30,
      bottom: isMobile ? 40 : 60,
      left: isMobile ? 40 : 60
    }
  };
}

/**
 * Generate mock hourly stats for testing charts
 */
export function generateMockHourlyStats(hours: number = 24): any[] {
  const stats = [];
  const now = new Date();

  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const baseAttempts = Math.floor(Math.random() * 50) + 10;
    const successRate = 0.85 + Math.random() * 0.14; // 85-99% success rate

    stats.push({
      hour_bucket: timestamp.toISOString(),
      total_attempts: baseAttempts,
      successful_attempts: Math.floor(baseAttempts * successRate),
      avg_duration_ms: Math.floor(Math.random() * 3000) + 1000, // 1-4 seconds
      p95_duration_ms: Math.floor(Math.random() * 5000) + 3000, // 3-8 seconds
      total_api_calls: baseAttempts + Math.floor(Math.random() * 10),
      total_tokens_used: Math.floor(Math.random() * 50000) + 10000,
      rate_limited_count: Math.floor(Math.random() * 3),
      single_upload_attempts: Math.floor(baseAttempts * 0.7),
      batch_upload_attempts: Math.floor(baseAttempts * 0.3),
      api_limit_errors: Math.floor(Math.random() * 2),
      network_errors: Math.floor(Math.random() * 2),
      validation_errors: Math.floor(Math.random() * 1),
      timeout_errors: Math.floor(Math.random() * 1),
      unknown_errors: Math.floor(Math.random() * 1)
    });
  }

  return stats;
}

/**
 * Generate mock daily stats for testing charts
 */
export function generateMockDailyStats(days: number = 7): any[] {
  const stats = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const baseAttempts = Math.floor(Math.random() * 500) + 100;
    const successRate = 85 + Math.random() * 14; // 85-99% success rate

    stats.push({
      date_bucket: timestamp.toISOString().split('T')[0],
      total_attempts: baseAttempts,
      success_rate: successRate,
      avg_duration_ms: Math.floor(Math.random() * 3000) + 1000,
      estimated_cost_usd: Math.random() * 10 + 1,
      total_tokens_used: Math.floor(Math.random() * 500000) + 100000
    });
  }

  return stats;
}

/**
 * Generate mock summary for testing charts
 */
export function generateMockSummary(): any {
  return {
    totalEmbeddings: Math.floor(Math.random() * 1000) + 500,
    successRate: 85 + Math.random() * 14,
    avgDuration: Math.floor(Math.random() * 3000) + 1000,
    totalCost: Math.random() * 50 + 10,
    topErrors: [
      { type: 'api_limit_errors', count: Math.floor(Math.random() * 10) + 1, percentage: Math.random() * 5 + 1 },
      { type: 'network_errors', count: Math.floor(Math.random() * 8) + 1, percentage: Math.random() * 3 + 0.5 },
      { type: 'timeout_errors', count: Math.floor(Math.random() * 5) + 1, percentage: Math.random() * 2 + 0.2 }
    ],
    performanceTrend: 'stable',
    healthScore: Math.floor(Math.random() * 20) + 80
  };
}

/**
 * Generate chart configuration for different chart types
 */
export function generateChartConfig(
  type: 'success-rate' | 'duration' | 'api-usage' | 'errors' | 'cost',
  data: ChartSeries[]
): ChartConfig {
  const configs = {
    'success-rate': {
      title: 'Success Rate Trend',
      subtitle: 'Embedding generation success rate over time',
      xAxisLabel: 'Time',
      yAxisLabel: 'Success Rate (%)',
      chartType: 'line' as const,
      showLegend: false,
      showGrid: true,
      responsive: true,
      height: 300
    },
    'duration': {
      title: 'Performance Trends',
      subtitle: 'Average and P95 embedding generation duration',
      xAxisLabel: 'Time',
      yAxisLabel: 'Duration (ms)',
      chartType: 'line' as const,
      showLegend: true,
      showGrid: true,
      responsive: true,
      height: 300
    },
    'api-usage': {
      title: 'API Usage Metrics',
      subtitle: 'API calls and token consumption over time',
      xAxisLabel: 'Time',
      yAxisLabel: 'Count',
      chartType: 'bar' as const,
      showLegend: true,
      showGrid: true,
      responsive: true,
      height: 300
    },
    'errors': {
      title: 'Error Patterns',
      subtitle: 'Error distribution by type over time',
      xAxisLabel: 'Time',
      yAxisLabel: 'Error Count',
      chartType: 'bar' as const,
      showLegend: true,
      showGrid: true,
      responsive: true,
      height: 350
    },
    'cost': {
      title: 'Cost Analysis',
      subtitle: 'Daily cost and token usage trends',
      xAxisLabel: 'Date',
      yAxisLabel: 'Cost / Tokens',
      chartType: 'area' as const,
      showLegend: true,
      showGrid: true,
      responsive: true,
      height: 300
    }
  };

  return {
    ...configs[type],
    series: data
  };
}
