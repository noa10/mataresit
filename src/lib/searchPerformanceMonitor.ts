/**
 * Search Performance Monitoring System
 * Tracks and analyzes search performance metrics in real-time
 */

import { supabase } from '@/integrations/supabase/client';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';

interface PerformanceMetric {
  id?: string;
  metric_name: string;
  metric_type: string;
  metric_value: number;
  metric_unit: string;
  context?: any;
  user_id?: string;
  created_at?: string;
}

interface SearchPerformanceData {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  sources: string[];
  similarityThreshold: number;
  errorOccurred: boolean;
  errorMessage?: string;
}

interface PerformanceThresholds {
  queryTimeWarning: number;    // ms
  queryTimeCritical: number;   // ms
  lowResultCountThreshold: number;
  cacheHitRateTarget: number;  // percentage
}

interface PerformanceAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
}

class SearchPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private isEnabled = true;

  private thresholds: PerformanceThresholds = {
    queryTimeWarning: 500,      // 500ms
    queryTimeCritical: 2000,    // 2 seconds
    lowResultCountThreshold: 3,
    cacheHitRateTarget: 70      // 70%
  };

  private recentMetrics = new Map<string, number[]>(); // Rolling window of recent values

  /**
   * Log a search performance metric
   */
  async logSearchMetric(
    params: UnifiedSearchParams,
    response: UnifiedSearchResponse | null,
    performanceData: SearchPerformanceData,
    userId?: string
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const baseMetric = {
        user_id: userId,
        created_at: new Date().toISOString()
      };

      const metrics: PerformanceMetric[] = [
        {
          ...baseMetric,
          metric_name: 'search_query_time',
          metric_type: 'performance',
          metric_value: performanceData.queryTime,
          metric_unit: 'ms',
          context: {
            query: params.query,
            sources: performanceData.sources,
            cache_hit: performanceData.cacheHit,
            result_count: performanceData.resultCount,
            similarity_threshold: performanceData.similarityThreshold
          }
        },
        {
          ...baseMetric,
          metric_name: 'search_result_count',
          metric_type: 'quality',
          metric_value: performanceData.resultCount,
          metric_unit: 'count',
          context: {
            query: params.query,
            sources: performanceData.sources,
            query_length: params.query.length
          }
        },
        {
          ...baseMetric,
          metric_name: 'search_cache_hit',
          metric_type: 'efficiency',
          metric_value: performanceData.cacheHit ? 1 : 0,
          metric_unit: 'boolean',
          context: {
            query: params.query,
            sources: performanceData.sources
          }
        }
      ];

      // Add error metric if applicable
      if (performanceData.errorOccurred) {
        metrics.push({
          ...baseMetric,
          metric_name: 'search_error',
          metric_type: 'error',
          metric_value: 1,
          metric_unit: 'count',
          context: {
            query: params.query,
            error_message: performanceData.errorMessage,
            sources: performanceData.sources
          }
        });
      }

      // Store metrics locally for immediate analysis
      this.metrics.push(...metrics);

      // Log to database asynchronously
      this.logToDatabase(metrics);

      // Check for performance alerts
      this.checkPerformanceAlerts(performanceData, params);

      // Update rolling metrics
      this.updateRollingMetrics(performanceData);

    } catch (error) {
      console.error('Failed to log search metric:', error);
    }
  }

  /**
   * Log metrics to database
   */
  private async logToDatabase(metrics: PerformanceMetric[]): Promise<void> {
    try {
      for (const metric of metrics) {
        const { error } = await supabase.rpc('log_performance_metric', {
          p_metric_name: metric.metric_name,
          p_metric_type: metric.metric_type,
          p_metric_value: metric.metric_value,
          p_metric_unit: metric.metric_unit,
          p_context: metric.context,
          p_user_id: metric.user_id || null
        });

        if (error) {
          console.warn('Failed to log metric to database:', error);
        }
      }
    } catch (error) {
      console.error('Database logging error:', error);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(
    performanceData: SearchPerformanceData,
    params: UnifiedSearchParams
  ): void {
    const now = new Date().toISOString();

    // Query time alerts
    if (performanceData.queryTime > this.thresholds.queryTimeCritical) {
      this.addAlert({
        type: 'critical',
        message: `Search query extremely slow: ${performanceData.queryTime}ms`,
        metric: 'query_time',
        value: performanceData.queryTime,
        threshold: this.thresholds.queryTimeCritical,
        timestamp: now
      });
    } else if (performanceData.queryTime > this.thresholds.queryTimeWarning) {
      this.addAlert({
        type: 'warning',
        message: `Search query slow: ${performanceData.queryTime}ms`,
        metric: 'query_time',
        value: performanceData.queryTime,
        threshold: this.thresholds.queryTimeWarning,
        timestamp: now
      });
    }

    // Low result count alert
    if (performanceData.resultCount < this.thresholds.lowResultCountThreshold && 
        params.query.length > 3) { // Only for meaningful queries
      this.addAlert({
        type: 'info',
        message: `Low search results: ${performanceData.resultCount} for "${params.query}"`,
        metric: 'result_count',
        value: performanceData.resultCount,
        threshold: this.thresholds.lowResultCountThreshold,
        timestamp: now
      });
    }

    // Cache hit rate monitoring
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < this.thresholds.cacheHitRateTarget) {
      this.addAlert({
        type: 'warning',
        message: `Low cache hit rate: ${cacheHitRate.toFixed(1)}%`,
        metric: 'cache_hit_rate',
        value: cacheHitRate,
        threshold: this.thresholds.cacheHitRateTarget,
        timestamp: now
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log alert to console
    const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} Performance Alert: ${alert.message}`);
  }

  /**
   * Update rolling metrics for trend analysis
   */
  private updateRollingMetrics(performanceData: SearchPerformanceData): void {
    const windowSize = 50; // Keep last 50 measurements

    // Update query time rolling average
    if (!this.recentMetrics.has('query_time')) {
      this.recentMetrics.set('query_time', []);
    }
    const queryTimes = this.recentMetrics.get('query_time')!;
    queryTimes.push(performanceData.queryTime);
    if (queryTimes.length > windowSize) {
      queryTimes.shift();
    }

    // Update result count rolling average
    if (!this.recentMetrics.has('result_count')) {
      this.recentMetrics.set('result_count', []);
    }
    const resultCounts = this.recentMetrics.get('result_count')!;
    resultCounts.push(performanceData.resultCount);
    if (resultCounts.length > windowSize) {
      resultCounts.shift();
    }

    // Update cache hit tracking
    if (!this.recentMetrics.has('cache_hits')) {
      this.recentMetrics.set('cache_hits', []);
    }
    const cacheHits = this.recentMetrics.get('cache_hits')!;
    cacheHits.push(performanceData.cacheHit ? 1 : 0);
    if (cacheHits.length > windowSize) {
      cacheHits.shift();
    }
  }

  /**
   * Calculate current cache hit rate
   */
  private calculateCacheHitRate(): number {
    const cacheHits = this.recentMetrics.get('cache_hits') || [];
    if (cacheHits.length === 0) return 0;
    
    const hits = cacheHits.reduce((sum, hit) => sum + hit, 0);
    return (hits / cacheHits.length) * 100;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageQueryTime: number;
    averageResultCount: number;
    cacheHitRate: number;
    totalQueries: number;
    recentAlerts: PerformanceAlert[];
    trends: {
      queryTimeImproving: boolean;
      resultQualityImproving: boolean;
      cacheEfficiencyImproving: boolean;
    };
  } {
    const queryTimes = this.recentMetrics.get('query_time') || [];
    const resultCounts = this.recentMetrics.get('result_count') || [];
    const cacheHits = this.recentMetrics.get('cache_hits') || [];

    const averageQueryTime = queryTimes.length > 0 
      ? queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length 
      : 0;

    const averageResultCount = resultCounts.length > 0
      ? resultCounts.reduce((sum, count) => sum + count, 0) / resultCounts.length
      : 0;

    const cacheHitRate = this.calculateCacheHitRate();

    // Calculate trends (comparing first half vs second half of recent data)
    const trends = this.calculateTrends();

    return {
      averageQueryTime,
      averageResultCount,
      cacheHitRate,
      totalQueries: this.metrics.filter(m => m.metric_name === 'search_query_time').length,
      recentAlerts: this.alerts.slice(-10), // Last 10 alerts
      trends
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): {
    queryTimeImproving: boolean;
    resultQualityImproving: boolean;
    cacheEfficiencyImproving: boolean;
  } {
    const queryTimes = this.recentMetrics.get('query_time') || [];
    const resultCounts = this.recentMetrics.get('result_count') || [];
    const cacheHits = this.recentMetrics.get('cache_hits') || [];

    const calculateTrend = (values: number[]): boolean => {
      if (values.length < 10) return false; // Need enough data
      
      const midPoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, midPoint);
      const secondHalf = values.slice(midPoint);
      
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      return secondAvg < firstAvg; // Improving if recent values are lower (for time) or higher (for quality)
    };

    return {
      queryTimeImproving: calculateTrend(queryTimes),
      resultQualityImproving: !calculateTrend(resultCounts.map(c => -c)), // Invert for result count (higher is better)
      cacheEfficiencyImproving: !calculateTrend(cacheHits.map(h => -h)) // Invert for cache hits (higher is better)
    };
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Search performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics = [];
    this.alerts = [];
    this.recentMetrics.clear();
    console.log('Performance monitoring data cleared');
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Performance thresholds updated:', this.thresholds);
  }
}

// Export singleton instance
export const searchPerformanceMonitor = new SearchPerformanceMonitor();
export type { PerformanceMetric, SearchPerformanceData, PerformanceAlert, PerformanceThresholds };
