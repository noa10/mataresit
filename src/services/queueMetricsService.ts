/**
 * Queue Metrics Service
 * Service for fetching and managing queue performance metrics
 * Integrates with the existing embedding metrics system
 */

import { supabase } from '@/lib/supabase';

export interface QueueMetrics {
  total_pending: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  total_rate_limited: number;
  avg_processing_time_ms: number;
  active_workers: number;
  oldest_pending_age_hours: number;
}

export interface QueueWorkerMetrics {
  worker_id: string;
  status: 'active' | 'idle' | 'stopped' | 'error';
  last_heartbeat: string;
  tasks_processed: number;
  total_processing_time_ms: number;
  error_count: number;
  rate_limit_count: number;
  current_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface QueuePerformanceMetrics {
  timestamp: string;
  throughput_per_hour: number;
  success_rate: number;
  avg_queue_wait_time_ms: number;
  worker_efficiency: number;
  queue_health_score: number;
  total_items_processed: number;
  total_errors: number;
  total_rate_limits: number;
}

export interface QueueHealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number;
  issues: string[];
  recommendations: string[];
  last_updated: string;
}

export interface QueueTrendData {
  hourly_throughput: Array<{
    hour: string;
    items_processed: number;
    success_rate: number;
    avg_processing_time: number;
  }>;
  daily_summary: Array<{
    date: string;
    total_processed: number;
    total_failed: number;
    avg_throughput: number;
    peak_queue_size: number;
  }>;
}

class QueueMetricsService {
  /**
   * Get current queue statistics
   */
  async getQueueStatistics(): Promise<QueueMetrics | null> {
    try {
      const { data, error } = await supabase.rpc('get_queue_statistics');
      if (error) throw error;
      
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error fetching queue statistics:', error);
      throw error;
    }
  }

  /**
   * Get worker metrics and status
   */
  async getWorkerMetrics(): Promise<QueueWorkerMetrics[]> {
    try {
      const { data, error } = await supabase
        .from('embedding_queue_workers')
        .select('*')
        .order('last_heartbeat', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching worker metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate performance metrics from queue data
   */
  calculatePerformanceMetrics(queueMetrics: QueueMetrics, workers: QueueWorkerMetrics[]): QueuePerformanceMetrics {
    const totalProcessed = queueMetrics.total_completed + queueMetrics.total_failed;
    const successRate = totalProcessed > 0 ? (queueMetrics.total_completed / totalProcessed) * 100 : 0;
    
    // Estimate throughput (items per hour)
    const throughputPerHour = queueMetrics.avg_processing_time_ms > 0 
      ? Math.round((3600000 / queueMetrics.avg_processing_time_ms) * queueMetrics.active_workers)
      : 0;
    
    // Calculate worker efficiency
    const workerEfficiency = queueMetrics.total_processing > 0 && queueMetrics.active_workers > 0
      ? Math.min(100, (queueMetrics.total_processing / queueMetrics.active_workers) * 100)
      : 0;
    
    // Calculate queue health score (0-100)
    let healthScore = 100;
    
    // Deduct points for various issues
    if (queueMetrics.active_workers === 0) healthScore -= 50;
    if (queueMetrics.oldest_pending_age_hours > 1) healthScore -= 20;
    if (successRate < 90) healthScore -= 15;
    if (queueMetrics.total_pending > 100) healthScore -= 10;
    if (queueMetrics.total_rate_limited > 10) healthScore -= 5;
    
    healthScore = Math.max(0, healthScore);
    
    return {
      timestamp: new Date().toISOString(),
      throughput_per_hour: throughputPerHour,
      success_rate: successRate,
      avg_queue_wait_time_ms: queueMetrics.oldest_pending_age_hours * 3600000,
      worker_efficiency: workerEfficiency,
      queue_health_score: healthScore,
      total_items_processed: totalProcessed,
      total_errors: queueMetrics.total_failed,
      total_rate_limits: queueMetrics.total_rate_limited
    };
  }

  /**
   * Get queue health status with recommendations
   */
  async getQueueHealthStatus(): Promise<QueueHealthStatus> {
    try {
      const [queueMetrics, workers] = await Promise.all([
        this.getQueueStatistics(),
        this.getWorkerMetrics()
      ]);

      if (!queueMetrics) {
        return {
          status: 'unknown',
          score: 0,
          issues: ['Queue system not initialized'],
          recommendations: ['Deploy queue migrations and start workers'],
          last_updated: new Date().toISOString()
        };
      }

      const performance = this.calculatePerformanceMetrics(queueMetrics, workers);
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Analyze issues and provide recommendations
      if (queueMetrics.active_workers === 0) {
        issues.push('No active workers');
        recommendations.push('Start at least one worker to process queue items');
      }

      if (queueMetrics.oldest_pending_age_hours > 2) {
        issues.push(`Old pending items (${queueMetrics.oldest_pending_age_hours.toFixed(1)}h)`);
        recommendations.push('Increase worker count or check for processing issues');
      }

      if (performance.success_rate < 90) {
        issues.push(`Low success rate (${performance.success_rate.toFixed(1)}%)`);
        recommendations.push('Review error logs and check API connectivity');
      }

      if (queueMetrics.total_pending > 100) {
        issues.push(`High queue backlog (${queueMetrics.total_pending} items)`);
        recommendations.push('Scale up workers or optimize processing');
      }

      if (queueMetrics.total_rate_limited > 10) {
        issues.push(`Frequent rate limiting (${queueMetrics.total_rate_limited} items)`);
        recommendations.push('Adjust rate limiting delays or API quotas');
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical';
      if (performance.queue_health_score >= 80) status = 'healthy';
      else if (performance.queue_health_score >= 60) status = 'warning';
      else status = 'critical';

      return {
        status,
        score: performance.queue_health_score,
        issues,
        recommendations,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting queue health status:', error);
      return {
        status: 'unknown',
        score: 0,
        issues: ['Failed to fetch queue health data'],
        recommendations: ['Check database connectivity and queue system status'],
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get queue trend data for charts
   */
  async getQueueTrendData(hours = 24): Promise<QueueTrendData> {
    try {
      // For now, we'll generate mock trend data
      // In a real implementation, this would query historical metrics
      const hourlyThroughput = [];
      const dailySummary = [];
      
      const now = new Date();
      
      // Generate hourly data for the last N hours
      for (let i = hours; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        hourlyThroughput.push({
          hour: hour.toISOString(),
          items_processed: Math.floor(Math.random() * 50) + 10,
          success_rate: 85 + Math.random() * 15,
          avg_processing_time: 2000 + Math.random() * 3000
        });
      }
      
      // Generate daily data for the last 7 days
      for (let i = 7; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dailySummary.push({
          date: date.toISOString().split('T')[0],
          total_processed: Math.floor(Math.random() * 1000) + 500,
          total_failed: Math.floor(Math.random() * 50) + 5,
          avg_throughput: Math.floor(Math.random() * 100) + 50,
          peak_queue_size: Math.floor(Math.random() * 200) + 50
        });
      }
      
      return {
        hourly_throughput: hourlyThroughput,
        daily_summary: dailySummary
      };
    } catch (error) {
      console.error('Error fetching queue trend data:', error);
      throw error;
    }
  }

  /**
   * Get queue configuration
   */
  async getQueueConfig(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('embedding_queue_config')
        .select('config_key, config_value');
      
      if (error) throw error;
      
      const config: Record<string, any> = {};
      data?.forEach(item => {
        config[item.config_key] = item.config_value;
      });
      
      return config;
    } catch (error) {
      console.error('Error fetching queue config:', error);
      throw error;
    }
  }

  /**
   * Update queue configuration
   */
  async updateQueueConfig(key: string, value: any): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_queue_config', {
        config_key_param: key,
        config_value_param: value,
        updated_by_param: null
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating queue config:', error);
      throw error;
    }
  }

  /**
   * Perform queue maintenance operations
   */
  async performMaintenance(operation: 'requeue_failed' | 'cleanup_old' | 'reset_rate_limited', params?: any): Promise<number> {
    try {
      let result;
      
      switch (operation) {
        case 'requeue_failed':
          result = await supabase.rpc('requeue_failed_items', { max_items: params?.maxItems || 100 });
          break;
        case 'cleanup_old':
          result = await supabase.rpc('cleanup_old_queue_items');
          break;
        case 'reset_rate_limited':
          result = await supabase.rpc('reset_rate_limited_items');
          break;
        default:
          throw new Error(`Unknown maintenance operation: ${operation}`);
      }
      
      if (result.error) throw result.error;
      return result.data || 0;
    } catch (error) {
      console.error(`Error performing maintenance operation ${operation}:`, error);
      throw error;
    }
  }
}

export const queueMetricsService = new QueueMetricsService();
