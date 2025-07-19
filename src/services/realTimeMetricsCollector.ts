/**
 * Real-time Metrics Collector
 * Collects and processes metrics from various sources for alert evaluation
 * Task 2: Implement Real-time Alert Trigger Engine - Metrics Collection
 */

import { supabase } from '@/lib/supabase';
import { embeddingHealthService } from './embeddingHealthService';
import { notificationService } from './notificationService';

interface MetricSnapshot {
  timestamp: Date;
  source: string;
  metrics: Record<string, number>;
  metadata?: Record<string, any>;
}

interface CollectorStatistics {
  totalSnapshots: number;
  lastCollectionTime: Date;
  collectionErrors: number;
  averageCollectionTime: number;
  activeCollectors: string[];
}

export class RealTimeMetricsCollector {
  private isRunning = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private snapshots: MetricSnapshot[] = [];
  private readonly maxSnapshots = 1000; // Keep last 1000 snapshots in memory
  
  private stats: CollectorStatistics = {
    totalSnapshots: 0,
    lastCollectionTime: new Date(),
    collectionErrors: 0,
    averageCollectionTime: 0,
    activeCollectors: []
  };

  private collectionTimes: number[] = [];
  private readonly maxCollectionTimeHistory = 50;

  // Configuration
  private readonly config = {
    collectionInterval: 30000, // 30 seconds
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 2000,
    enablePersistence: true,
    enableMemoryCache: true
  };

  /**
   * Start real-time metrics collection
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Metrics collector is already running');
      return;
    }

    console.log('📊 Starting Real-time Metrics Collector');
    this.isRunning = true;

    // Start periodic collection
    this.collectionInterval = setInterval(
      () => this.collectAllMetrics(),
      this.config.collectionInterval
    );

    // Perform initial collection
    await this.collectAllMetrics();
    
    console.log('✅ Real-time Metrics Collector started');
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Metrics collector is not running');
      return;
    }

    console.log('🛑 Stopping Real-time Metrics Collector');
    this.isRunning = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    console.log('✅ Real-time Metrics Collector stopped');
  }

  /**
   * Collect metrics from all sources
   */
  private async collectAllMetrics(): Promise<void> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      console.log('📈 Collecting metrics from all sources');

      // Collect from different sources in parallel
      const [
        embeddingMetrics,
        systemHealthMetrics,
        notificationMetrics,
        databaseMetrics
      ] = await Promise.allSettled([
        this.collectEmbeddingMetrics(),
        this.collectSystemHealthMetrics(),
        this.collectNotificationMetrics(),
        this.collectDatabaseMetrics()
      ]);

      // Process results and create snapshots
      const snapshots: MetricSnapshot[] = [];

      if (embeddingMetrics.status === 'fulfilled') {
        snapshots.push({
          timestamp,
          source: 'embedding_metrics',
          metrics: embeddingMetrics.value,
          metadata: { collection_method: 'api_query' }
        });
      } else {
        console.error('Failed to collect embedding metrics:', embeddingMetrics.reason);
        this.stats.collectionErrors++;
      }

      if (systemHealthMetrics.status === 'fulfilled') {
        snapshots.push({
          timestamp,
          source: 'system_health',
          metrics: systemHealthMetrics.value,
          metadata: { collection_method: 'health_service' }
        });
      } else {
        console.error('Failed to collect system health metrics:', systemHealthMetrics.reason);
        this.stats.collectionErrors++;
      }

      if (notificationMetrics.status === 'fulfilled') {
        snapshots.push({
          timestamp,
          source: 'notification_metrics',
          metrics: notificationMetrics.value,
          metadata: { collection_method: 'service_stats' }
        });
      } else {
        console.error('Failed to collect notification metrics:', notificationMetrics.reason);
        this.stats.collectionErrors++;
      }

      if (databaseMetrics.status === 'fulfilled') {
        snapshots.push({
          timestamp,
          source: 'database_metrics',
          metrics: databaseMetrics.value,
          metadata: { collection_method: 'direct_query' }
        });
      } else {
        console.error('Failed to collect database metrics:', databaseMetrics.reason);
        this.stats.collectionErrors++;
      }

      // Store snapshots
      if (this.config.enableMemoryCache) {
        this.snapshots.push(...snapshots);
        if (this.snapshots.length > this.maxSnapshots) {
          this.snapshots = this.snapshots.slice(-this.maxSnapshots);
        }
      }

      // Persist to database if enabled
      if (this.config.enablePersistence) {
        await this.persistMetrics(snapshots);
      }

      // Update statistics
      this.stats.totalSnapshots += snapshots.length;
      this.stats.lastCollectionTime = timestamp;
      
      const collectionTime = Date.now() - startTime;
      this.collectionTimes.push(collectionTime);
      if (this.collectionTimes.length > this.maxCollectionTimeHistory) {
        this.collectionTimes.shift();
      }
      this.stats.averageCollectionTime = this.collectionTimes.reduce((a, b) => a + b, 0) / this.collectionTimes.length;

      console.log(`✅ Collected ${snapshots.length} metric snapshots in ${collectionTime}ms`);

    } catch (error) {
      console.error('Error during metrics collection:', error);
      this.stats.collectionErrors++;
    }
  }

  /**
   * Collect embedding-related metrics
   */
  private async collectEmbeddingMetrics(): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};
    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // Last hour

    try {
      // Get recent embedding performance data
      const { data: performanceData, error: perfError } = await supabase
        .from('embedding_performance_metrics')
        .select('status, total_duration_ms, api_calls_made, api_tokens_used')
        .gte('created_at', windowStart.toISOString());

      if (perfError) throw perfError;

      if (performanceData && performanceData.length > 0) {
        // Calculate success rate
        const successCount = performanceData.filter(m => m.status === 'success').length;
        metrics.success_rate = (successCount / performanceData.length) * 100;

        // Calculate error rate
        const errorCount = performanceData.filter(m => m.status === 'failed' || m.status === 'timeout').length;
        metrics.error_rate = (errorCount / performanceData.length) * 100;

        // Calculate average duration
        const validDurations = performanceData.filter(m => m.total_duration_ms != null);
        if (validDurations.length > 0) {
          metrics.avg_duration = validDurations.reduce((sum, m) => sum + (m.total_duration_ms || 0), 0) / validDurations.length;
        }

        // Calculate API usage
        metrics.total_api_calls = performanceData.reduce((sum, m) => sum + (m.api_calls_made || 0), 0);
        metrics.total_tokens_used = performanceData.reduce((sum, m) => sum + (m.api_tokens_used || 0), 0);
        
        // Calculate throughput (operations per minute)
        metrics.throughput = performanceData.length / 60;
      } else {
        // No data available, set default values
        metrics.success_rate = 100;
        metrics.error_rate = 0;
        metrics.avg_duration = 0;
        metrics.total_api_calls = 0;
        metrics.total_tokens_used = 0;
        metrics.throughput = 0;
      }

      // Get hourly stats for additional context
      const { data: hourlyData, error: hourlyError } = await supabase
        .from('embedding_hourly_stats')
        .select('success_rate, avg_duration_ms, total_attempts')
        .gte('hour_bucket', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('hour_bucket', { ascending: false })
        .limit(1);

      if (!hourlyError && hourlyData && hourlyData.length > 0) {
        const latest = hourlyData[0];
        metrics.hourly_success_rate = latest.success_rate || 100;
        metrics.hourly_avg_duration = latest.avg_duration_ms || 0;
        metrics.hourly_attempts = latest.total_attempts || 0;
      }

    } catch (error) {
      console.error('Error collecting embedding metrics:', error);
      throw error;
    }

    return metrics;
  }

  /**
   * Collect system health metrics
   */
  private async collectSystemHealthMetrics(): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    try {
      // Get health status from embedding health service
      const healthStatus = await embeddingHealthService.performHealthCheck();
      metrics.health_score = healthStatus.healthScore;

      // Get performance metrics
      const performance = await embeddingHealthService.getPerformanceMetrics();
      metrics.api_response_time = performance.apiResponseTime;
      metrics.database_response_time = performance.databaseResponseTime;
      metrics.cache_hit_rate = performance.cacheHitRate;
      metrics.error_rate = performance.errorRate;
      metrics.throughput = performance.throughput;
      metrics.active_connections = performance.activeConnections;

      // Calculate component health scores
      let componentHealthSum = 0;
      let componentCount = 0;

      for (const [componentName, component] of Object.entries(healthStatus.components)) {
        const score = component.status === 'healthy' ? 100 : 
                     component.status === 'degraded' ? 50 : 0;
        metrics[`component_${componentName}_health`] = score;
        componentHealthSum += score;
        componentCount++;
      }

      if (componentCount > 0) {
        metrics.avg_component_health = componentHealthSum / componentCount;
      }

    } catch (error) {
      console.error('Error collecting system health metrics:', error);
      throw error;
    }

    return metrics;
  }

  /**
   * Collect notification system metrics
   */
  private async collectNotificationMetrics(): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};
    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // Last hour

    try {
      // Get notification delivery statistics
      const { data: notificationData, error: notifError } = await supabase
        .from('alert_notifications')
        .select('delivery_status, created_at, sent_at, delivered_at')
        .gte('created_at', windowStart.toISOString());

      if (notifError) throw notifError;

      if (notificationData && notificationData.length > 0) {
        // Calculate delivery success rate
        const deliveredCount = notificationData.filter(n => n.delivery_status === 'delivered').length;
        metrics.notification_success_rate = (deliveredCount / notificationData.length) * 100;

        // Calculate failure rate
        const failedCount = notificationData.filter(n => n.delivery_status === 'failed').length;
        metrics.notification_failure_rate = (failedCount / notificationData.length) * 100;

        // Calculate average delivery time
        const deliveredNotifications = notificationData.filter(n => n.sent_at && n.delivered_at);
        if (deliveredNotifications.length > 0) {
          const totalDeliveryTime = deliveredNotifications.reduce((sum, n) => {
            const sentTime = new Date(n.sent_at!).getTime();
            const deliveredTime = new Date(n.delivered_at!).getTime();
            return sum + (deliveredTime - sentTime);
          }, 0);
          metrics.avg_delivery_time = totalDeliveryTime / deliveredNotifications.length;
        }

        metrics.total_notifications = notificationData.length;
      } else {
        metrics.notification_success_rate = 100;
        metrics.notification_failure_rate = 0;
        metrics.avg_delivery_time = 0;
        metrics.total_notifications = 0;
      }

      // Get notification service connection state if available
      try {
        const connectionState = notificationService.getConnectionState();
        metrics.notification_active_channels = connectionState.activeChannels || 0;
        metrics.notification_total_sent = connectionState.totalSent || 0;
        metrics.notification_total_failed = connectionState.totalFailed || 0;
      } catch (error) {
        // Connection state might not be available, continue without it
        console.debug('Notification connection state not available:', error);
      }

    } catch (error) {
      console.error('Error collecting notification metrics:', error);
      throw error;
    }

    return metrics;
  }

  /**
   * Collect database performance metrics
   */
  private async collectDatabaseMetrics(): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    try {
      // Test database response time
      const startTime = Date.now();
      const { error } = await supabase
        .from('alert_rules')
        .select('count')
        .limit(1);
      
      const responseTime = Date.now() - startTime;
      metrics.database_response_time = responseTime;
      metrics.database_available = error ? 0 : 1;

      // Get active alert counts
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('status, severity')
        .in('status', ['active', 'acknowledged']);

      if (!alertError && alertData) {
        metrics.active_alerts_total = alertData.length;
        metrics.active_alerts_critical = alertData.filter(a => a.severity === 'critical').length;
        metrics.active_alerts_high = alertData.filter(a => a.severity === 'high').length;
        metrics.active_alerts_medium = alertData.filter(a => a.severity === 'medium').length;
        metrics.active_alerts_low = alertData.filter(a => a.severity === 'low').length;
      }

      // Get alert rule counts
      const { data: ruleData, error: ruleError } = await supabase
        .from('alert_rules')
        .select('enabled');

      if (!ruleError && ruleData) {
        metrics.total_alert_rules = ruleData.length;
        metrics.enabled_alert_rules = ruleData.filter(r => r.enabled).length;
      }

    } catch (error) {
      console.error('Error collecting database metrics:', error);
      throw error;
    }

    return metrics;
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(snapshots: MetricSnapshot[]): Promise<void> {
    try {
      const metricsToInsert = snapshots.flatMap(snapshot => 
        Object.entries(snapshot.metrics).map(([metricName, metricValue]) => ({
          metric_name: metricName,
          metric_type: snapshot.source,
          metric_value: metricValue,
          metric_unit: this.getMetricUnit(metricName),
          context: {
            source: snapshot.source,
            collection_timestamp: snapshot.timestamp.toISOString(),
            ...snapshot.metadata
          },
          created_at: snapshot.timestamp.toISOString()
        }))
      );

      if (metricsToInsert.length > 0) {
        const { error } = await supabase
          .from('performance_metrics')
          .insert(metricsToInsert);

        if (error) {
          console.error('Error persisting metrics:', error);
        } else {
          console.log(`📝 Persisted ${metricsToInsert.length} metrics to database`);
        }
      }

    } catch (error) {
      console.error('Error during metrics persistence:', error);
    }
  }

  /**
   * Get appropriate unit for a metric
   */
  private getMetricUnit(metricName: string): string {
    if (metricName.includes('rate') || metricName.includes('percentage')) return '%';
    if (metricName.includes('time') || metricName.includes('duration')) return 'ms';
    if (metricName.includes('count') || metricName.includes('total')) return 'count';
    if (metricName.includes('score')) return 'score';
    return 'value';
  }

  /**
   * Get recent metrics for a specific source and metric
   */
  getRecentMetrics(source: string, metricName: string, windowMinutes: number = 60): number[] {
    const windowStart = Date.now() - windowMinutes * 60 * 1000;
    
    return this.snapshots
      .filter(snapshot => 
        snapshot.source === source && 
        snapshot.timestamp.getTime() >= windowStart &&
        snapshot.metrics[metricName] !== undefined
      )
      .map(snapshot => snapshot.metrics[metricName])
      .sort((a, b) => a - b); // Sort for easier analysis
  }

  /**
   * Get collector statistics
   */
  getStatistics(): CollectorStatistics {
    return { ...this.stats };
  }

  /**
   * Get current status
   */
  getStatus(): { isRunning: boolean; snapshotsInMemory: number } {
    return {
      isRunning: this.isRunning,
      snapshotsInMemory: this.snapshots.length
    };
  }

  /**
   * Force immediate collection (for testing)
   */
  async forceCollection(): Promise<void> {
    console.log('🔄 Force collection triggered');
    await this.collectAllMetrics();
  }
}

// Export singleton instance
export const realTimeMetricsCollector = new RealTimeMetricsCollector();
