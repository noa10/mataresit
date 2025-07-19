/**
 * Embedding Metrics Service
 * Service for fetching and managing embedding performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard
 */

import { supabase } from '@/lib/supabase';
import { embeddingMetricsErrorHandler } from './embeddingMetricsErrorHandler';
import { embeddingMetricsCacheService, EmbeddingMetricsCacheService } from './embeddingMetricsCacheService';
import {
  EmbeddingPerformanceMetric,
  EmbeddingHourlyStats,
  EmbeddingDailyStats,
  EmbeddingHealthStatus,
  EmbeddingAggregationResult,
  EmbeddingMetricsSummary,
  EmbeddingMetricsFilters,
  EmbeddingCostBreakdown,
  EmbeddingQualityMetrics,
  EmbeddingChartData
} from '@/types/embedding-metrics';

class EmbeddingMetricsService {
  /**
   * Get embedding health status
   */
  async getHealthStatus(): Promise<EmbeddingHealthStatus> {
    return embeddingMetricsErrorHandler.withRetry(
      async () => {
        try {
          const { data, error } = await supabase.rpc('check_embedding_aggregation_health');

          if (error) {
            throw new Error(`Health check failed: ${error.message}`);
          }

          return data;
        } catch (error) {
          // Fallback for when the function doesn't exist yet
          console.warn('Health check function not available, using fallback');
          return {
            status: 'warning' as const,
            timestamp: new Date().toISOString(),
            metrics: {
              raw_metrics_24h: 0,
              hourly_stats_7d: 0,
              daily_stats_30d: 0,
              latest_hourly_aggregation: null,
              latest_daily_aggregation: null
            },
            issues: ['Embedding metrics system not yet configured']
          };
        }
      },
      {
        operation: 'getHealthStatus',
        timestamp: new Date(),
        url: 'check_embedding_aggregation_health'
      },
      {
        maxAttempts: 1, // Reduce retries for missing functions
        baseDelay: 1000
      }
    );
  }

  /**
   * Trigger aggregation manually
   */
  async triggerAggregation(type: 'hourly' | 'daily' | 'cleanup' | 'all' = 'all'): Promise<EmbeddingAggregationResult> {
    return embeddingMetricsErrorHandler.withRetry(
      async () => {
        try {
          const { data, error } = await supabase.rpc('webhook_trigger_embedding_aggregation', {
            aggregation_type: type
          });

          if (error) {
            throw new Error(`Aggregation failed: ${error.message}`);
          }

          return data;
        } catch (error) {
          // Fallback for when the function doesn't exist yet
          console.warn('Aggregation function not available, using fallback');
          return {
            success: false,
            aggregationType: type,
            summary: {
              successful: 0,
              failed: 1,
              totalOperations: 1,
              totalExecutionTime: 0
            },
            results: [{
              operation: 'aggregation',
              success: false,
              message: 'Embedding metrics system not yet configured',
              executionTime: 0
            }],
            timestamp: new Date().toISOString()
          };
        }
      },
      {
        operation: 'triggerAggregation',
        timestamp: new Date(),
        url: 'webhook_trigger_embedding_aggregation',
        additionalData: { type }
      },
      {
        maxAttempts: 1, // Reduce retries for missing functions
        baseDelay: 2000
      }
    );
  }

  /**
   * Get recent performance metrics
   */
  async getRecentMetrics(limit: number = 100): Promise<EmbeddingPerformanceMetric[]> {
    const cacheKey = EmbeddingMetricsCacheService.generateKey('recent_metrics', { limit });

    return embeddingMetricsCacheService.getOrSet(
      cacheKey,
      async () => {
        return embeddingMetricsErrorHandler.withRetry(
          async () => {
            try {
              const { data, error } = await supabase
                .from('embedding_performance_metrics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

              if (error) {
                throw new Error(`Failed to fetch metrics: ${error.message}`);
              }

              return data || [];
            } catch (error) {
              // Fallback for when the table doesn't exist yet
              console.warn('Embedding performance metrics table not available, using fallback');
              return [];
            }
          },
          {
            operation: 'getRecentMetrics',
            timestamp: new Date(),
            additionalData: { limit }
          }
        );
      },
      2 * 60 * 1000 // 2 minutes TTL for recent metrics
    );
  }

  /**
   * Get hourly stats for a date range
   */
  async getHourlyStats(startDate: string, endDate: string): Promise<EmbeddingHourlyStats[]> {
    const cacheKey = EmbeddingMetricsCacheService.generateKey('hourly_stats', { startDate, endDate });

    return embeddingMetricsCacheService.getOrSet(
      cacheKey,
      async () => {
        return embeddingMetricsErrorHandler.withRetry(
          async () => {
            try {
              const { data, error } = await supabase
                .from('embedding_hourly_stats')
                .select('*')
                .gte('hour_bucket', startDate)
                .lte('hour_bucket', endDate)
                .order('hour_bucket', { ascending: true });

              if (error) {
                throw new Error(`Failed to fetch hourly stats: ${error.message}`);
              }

              return data || [];
            } catch (error) {
              // Fallback for when the table doesn't exist yet
              console.warn('Embedding hourly stats table not available, using fallback');
              return [];
            }
          },
          {
            operation: 'getHourlyStats',
            timestamp: new Date(),
            additionalData: { startDate, endDate }
          }
        );
      },
      5 * 60 * 1000 // 5 minutes TTL for hourly stats
    );
  }

  /**
   * Get daily stats for a date range
   */
  async getDailyStats(startDate: string, endDate: string): Promise<EmbeddingDailyStats[]> {
    try {
      const { data, error } = await supabase
        .from('embedding_daily_stats')
        .select('*')
        .gte('date_bucket', startDate)
        .lte('date_bucket', endDate)
        .order('date_bucket', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch daily stats: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      // Fallback for when the table doesn't exist yet
      console.warn('Embedding daily stats table not available, using fallback');
      return [];
    }
  }

  /**
   * Get metrics summary for dashboard
   */
  async getMetricsSummary(filters?: EmbeddingMetricsFilters): Promise<EmbeddingMetricsSummary> {
    try {
      // Get recent metrics for summary calculation
      let query = supabase
        .from('embedding_performance_metrics')
        .select('*');

      // Apply filters
      if (filters?.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.start)
          .lte('created_at', filters.dateRange.end);
      }

      if (filters?.uploadContext && filters.uploadContext !== 'all') {
        query = query.eq('upload_context', filters.uploadContext);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.teamId) {
        query = query.eq('team_id', filters.teamId);
      }

      if (filters?.modelUsed) {
        query = query.eq('model_used', filters.modelUsed);
      }

      const { data: metrics, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch metrics summary: ${error.message}`);
      }

      // Calculate summary statistics
      const totalEmbeddings = metrics?.length || 0;
      const successfulEmbeddings = metrics?.filter(m => m.status === 'success').length || 0;
      const successRate = totalEmbeddings > 0 ? (successfulEmbeddings / totalEmbeddings) * 100 : 0;
      
      const durations = metrics?.filter(m => m.total_duration_ms).map(m => m.total_duration_ms) || [];
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      
      const totalCost = metrics?.reduce((sum, m) => sum + (m.api_tokens_used * 0.00015 / 1000), 0) || 0;

      // Calculate error breakdown
      const errorCounts: Record<string, number> = {};
      metrics?.filter(m => m.error_type).forEach(m => {
        errorCounts[m.error_type!] = (errorCounts[m.error_type!] || 0) + 1;
      });

      const topErrors = Object.entries(errorCounts)
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalEmbeddings > 0 ? (count / totalEmbeddings) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate health score (simplified)
      let healthScore = 100;
      if (successRate < 95) healthScore -= (95 - successRate) * 2;
      if (avgDuration > 5000) healthScore -= Math.min(20, (avgDuration - 5000) / 1000);
      healthScore = Math.max(0, Math.round(healthScore));

      return {
        totalEmbeddings,
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round(avgDuration),
        totalCost: Math.round(totalCost * 10000) / 10000,
        topErrors,
        performanceTrend: 'stable', // TODO: Calculate based on historical data
        healthScore
      };
    } catch (error) {
      // Fallback for when the table doesn't exist yet
      console.warn('Embedding performance metrics table not available, using fallback summary');
      return {
        totalEmbeddings: 0,
        successRate: 0,
        avgDuration: 0,
        totalCost: 0,
        topErrors: [],
        performanceTrend: 'stable',
        healthScore: 50
      };
    }
  }

  /**
   * Get cost breakdown
   */
  async getCostBreakdown(startDate: string, endDate: string): Promise<EmbeddingCostBreakdown> {
    try {
      const { data: metrics, error } = await supabase
        .from('embedding_performance_metrics')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (error) {
        throw new Error(`Failed to fetch cost data: ${error.message}`);
      }

      const totalCost = metrics?.reduce((sum, m) => sum + (m.api_tokens_used * 0.00015 / 1000), 0) || 0;

      // Cost by model
      const costByModel: Record<string, number> = {};
      metrics?.forEach(m => {
        const cost = m.api_tokens_used * 0.00015 / 1000;
        costByModel[m.model_used] = (costByModel[m.model_used] || 0) + cost;
      });

      // Cost by context
      const singleCost = metrics?.filter(m => m.upload_context === 'single')
        .reduce((sum, m) => sum + (m.api_tokens_used * 0.00015 / 1000), 0) || 0;
      const batchCost = metrics?.filter(m => m.upload_context === 'batch')
        .reduce((sum, m) => sum + (m.api_tokens_used * 0.00015 / 1000), 0) || 0;

      // Daily cost trend (simplified)
      const costTrend = await this.getDailyCostTrend(startDate, endDate);

      // Project monthly cost based on current trend
      const daysInPeriod = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
      const dailyAvgCost = totalCost / daysInPeriod;
      const projectedMonthlyCost = dailyAvgCost * 30;

      return {
        totalCost: Math.round(totalCost * 10000) / 10000,
        costByModel,
        costByContext: {
          single: Math.round(singleCost * 10000) / 10000,
          batch: Math.round(batchCost * 10000) / 10000
        },
        costTrend,
        projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
        budgetUtilization: 0 // TODO: Implement budget tracking
      };
    } catch (error) {
      // Fallback for when the table doesn't exist yet
      console.warn('Embedding performance metrics table not available, using fallback cost breakdown');
      return {
        totalCost: 0,
        costByModel: {},
        costByContext: {
          single: 0,
          batch: 0
        },
        costTrend: [],
        projectedMonthlyCost: 0,
        budgetUtilization: 0
      };
    }
  }

  /**
   * Get daily cost trend
   */
  private async getDailyCostTrend(startDate: string, endDate: string): Promise<Array<{date: string; cost: number; tokens: number}>> {
    try {
      const { data: dailyStats, error } = await supabase
        .from('embedding_daily_stats')
        .select('date_bucket, estimated_cost_usd, total_tokens_used')
        .gte('date_bucket', startDate)
        .lte('date_bucket', endDate)
        .order('date_bucket', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch daily cost trend: ${error.message}`);
      }

      return dailyStats?.map(stat => ({
        date: stat.date_bucket,
        cost: stat.estimated_cost_usd || 0,
        tokens: stat.total_tokens_used || 0
      })) || [];
    } catch (error) {
      console.error('Error fetching daily cost trend:', error);
      return [];
    }
  }

  /**
   * Get quality metrics
   */
  async getQualityMetrics(startDate: string, endDate: string): Promise<EmbeddingQualityMetrics> {
    try {
      const { data: metrics, error } = await supabase
        .from('embedding_performance_metrics')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      
      if (error) {
        throw new Error(`Failed to fetch quality metrics: ${error.message}`);
      }

      const totalMetrics = metrics?.length || 0;
      const syntheticContentCount = metrics?.filter(m => m.synthetic_content_used).length || 0;
      const syntheticContentUsage = totalMetrics > 0 ? (syntheticContentCount / totalMetrics) * 100 : 0;

      const avgContentTypes = totalMetrics > 0 
        ? metrics.reduce((sum, m) => sum + m.total_content_types, 0) / totalMetrics 
        : 0;

      // Content type success rates
      const contentTypeStats: Record<string, { total: number; success: number }> = {};
      metrics?.forEach(m => {
        m.content_types_processed.forEach(type => {
          if (!contentTypeStats[type]) {
            contentTypeStats[type] = { total: 0, success: 0 };
          }
          contentTypeStats[type].total++;
          if (m.status === 'success') {
            contentTypeStats[type].success++;
          }
        });
      });

      const contentTypeSuccessRates: Record<string, number> = {};
      Object.entries(contentTypeStats).forEach(([type, stats]) => {
        contentTypeSuccessRates[type] = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
      });

      // Embedding dimensions distribution
      const dimensionsDistribution: Record<number, number> = {};
      metrics?.filter(m => m.embedding_dimensions).forEach(m => {
        const dims = m.embedding_dimensions!;
        dimensionsDistribution[dims] = (dimensionsDistribution[dims] || 0) + 1;
      });

      // Calculate quality score
      const successRate = totalMetrics > 0 ? (metrics.filter(m => m.status === 'success').length / totalMetrics) * 100 : 0;
      const qualityScore = Math.round((successRate + (100 - syntheticContentUsage)) / 2);

      return {
        syntheticContentUsage: Math.round(syntheticContentUsage * 100) / 100,
        avgContentTypesPerReceipt: Math.round(avgContentTypes * 100) / 100,
        contentTypeSuccessRates,
        embeddingDimensionsDistribution: dimensionsDistribution,
        qualityScore,
        qualityTrend: 'stable' // TODO: Calculate based on historical data
      };
    } catch (error) {
      // Fallback for when the table doesn't exist yet
      console.warn('Embedding performance metrics table not available, using fallback quality metrics');
      return {
        syntheticContentUsage: 0,
        avgContentTypesPerReceipt: 0,
        contentTypeSuccessRates: {},
        embeddingDimensionsDistribution: {},
        qualityScore: 50,
        qualityTrend: 'stable'
      };
    }
  }

  /**
   * Call the aggregator Edge Function directly
   */
  async callAggregatorFunction(action: 'health' | 'webhook' | 'aggregate', type?: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('embedding-metrics-aggregator', {
        body: { action, type }
      });

      if (error) {
        throw new Error(`Aggregator function error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error calling aggregator function:', error);
      throw error;
    }
  }
}

export const embeddingMetricsService = new EmbeddingMetricsService();
