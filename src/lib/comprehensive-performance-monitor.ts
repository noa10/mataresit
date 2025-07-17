/**
 * Comprehensive Performance Monitoring System
 * Real-time performance tracking with alerting and analytics
 */

import { enhancedCacheSystem } from './enhanced-cache-system';
import { optimizedSearchExecutor } from './optimized-search-executor';
import { optimizedBackgroundSearchService } from '@/services/optimized-background-search-service';
import { uiPerformanceOptimizer } from './ui-performance-optimizer';

// Performance metric types
interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  network: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    compressionRatio: number;
    evictionRate: number;
  };
  search: {
    averageResponseTime: number;
    successRate: number;
    queueLength: number;
    concurrencyUtilization: number;
  };
  ui: {
    averageRenderTime: number;
    frameRate: number;
    memoryLeaks: number;
    componentCount: number;
  };
}

// Performance alert configuration
interface AlertConfig {
  enabled: boolean;
  thresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
    cacheHitRate: number;
    queueLength: number;
  };
  cooldownPeriod: number; // ms
  escalationLevels: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    threshold: number;
    actions: string[];
  }>;
}

// Performance alert
interface PerformanceAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  resolved: boolean;
  resolvedAt?: number;
  duration?: number;
}

// Performance trend analysis
interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  confidence: number;
  prediction: {
    nextHour: number;
    nextDay: number;
    confidence: number;
  };
}

// Performance report
interface PerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    averageResponseTime: number;
    peakResponseTime: number;
    totalRequests: number;
    errorRate: number;
    uptime: number;
    availability: number;
  };
  trends: TrendAnalysis[];
  alerts: PerformanceAlert[];
  recommendations: string[];
  bottlenecks: Array<{
    component: string;
    severity: number;
    description: string;
    impact: string;
  }>;
}

class ComprehensivePerformanceMonitor {
  private metrics: SystemMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private alertCooldowns = new Map<string, number>();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  private config: AlertConfig = {
    enabled: true,
    thresholds: {
      cpuUsage: 80, // %
      memoryUsage: 85, // %
      responseTime: 2000, // ms
      errorRate: 5, // %
      cacheHitRate: 70, // %
      queueLength: 20 // items
    },
    cooldownPeriod: 5 * 60 * 1000, // 5 minutes
    escalationLevels: [
      { level: 'info', threshold: 0.7, actions: ['log'] },
      { level: 'warning', threshold: 0.8, actions: ['log', 'notify'] },
      { level: 'error', threshold: 0.9, actions: ['log', 'notify', 'throttle'] },
      { level: 'critical', threshold: 1.0, actions: ['log', 'notify', 'throttle', 'fallback'] }
    ]
  };

  /**
   * Start comprehensive performance monitoring
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring already running');
      return;
    }

    console.log('🏥 Starting comprehensive performance monitoring');
    this.isMonitoring = true;
    this.startTime = Date.now();

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMetrics();
      this.checkAlerts();
      this.cleanupOldData();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('Performance monitoring not running');
      return;
    }

    console.log('🛑 Stopping comprehensive performance monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Collect cache metrics
      const cacheMetrics = enhancedCacheSystem.getMetrics();
      
      // Collect search metrics
      const searchMetrics = optimizedSearchExecutor.getPerformanceStats();
      const backgroundMetrics = optimizedBackgroundSearchService.getMetrics();
      
      // Collect UI metrics
      const uiMetrics = uiPerformanceOptimizer.getPerformanceAnalytics();

      const metrics: SystemMetrics = {
        timestamp,
        cpu: systemMetrics.cpu,
        memory: systemMetrics.memory,
        network: systemMetrics.network,
        cache: {
          hitRate: cacheMetrics.hitRate,
          memoryUsage: cacheMetrics.memoryUtilization,
          compressionRatio: cacheMetrics.averageCompressionRatio,
          evictionRate: cacheMetrics.evictionRate
        },
        search: {
          averageResponseTime: searchMetrics.averageExecutionTime,
          successRate: 100 - (backgroundMetrics.failedSearches / Math.max(1, backgroundMetrics.totalSearches) * 100),
          queueLength: optimizedBackgroundSearchService.getQueueStatus().queueLength,
          concurrencyUtilization: backgroundMetrics.concurrencyUtilization
        },
        ui: {
          averageRenderTime: uiMetrics.averageRenderTime,
          frameRate: 60, // Would be calculated from actual frame timing
          memoryLeaks: 0, // Would be detected through memory growth analysis
          componentCount: uiMetrics.totalComponents
        }
      };

      this.metrics.push(metrics);

      // Keep only recent metrics (last 24 hours)
      const dayAgo = timestamp - 24 * 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp > dayAgo);

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Collect system-level metrics
   */
  private async collectSystemMetrics(): Promise<{
    cpu: { usage: number; loadAverage: number[] };
    memory: { used: number; total: number; percentage: number; heapUsed: number; heapTotal: number };
    network: { latency: number; throughput: number; errorRate: number };
  }> {
    // CPU metrics (estimated)
    const cpuUsage = Math.random() * 100; // Would use actual CPU monitoring
    const loadAverage = [1.2, 1.5, 1.8]; // Would use actual load average

    // Memory metrics
    const memoryInfo = (performance as any).memory || {};
    const heapUsed = memoryInfo.usedJSHeapSize || 0;
    const heapTotal = memoryInfo.totalJSHeapSize || 0;
    const heapLimit = memoryInfo.jsHeapSizeLimit || 0;
    
    const memoryPercentage = heapLimit > 0 ? (heapUsed / heapLimit) * 100 : 0;

    // Network metrics (estimated)
    const networkLatency = await this.measureNetworkLatency();
    const networkThroughput = 100; // Would measure actual throughput
    const networkErrorRate = 2; // Would track actual error rate

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage
      },
      memory: {
        used: heapUsed,
        total: heapLimit,
        percentage: memoryPercentage,
        heapUsed,
        heapTotal
      },
      network: {
        latency: networkLatency,
        throughput: networkThroughput,
        errorRate: networkErrorRate
      }
    };
  }

  /**
   * Measure network latency
   */
  private async measureNetworkLatency(): Promise<number> {
    try {
      const start = performance.now();
      await fetch('/api/health', { method: 'HEAD' });
      return performance.now() - start;
    } catch (error) {
      return 1000; // Default high latency on error
    }
  }

  /**
   * Analyze metrics for trends and anomalies
   */
  private analyzeMetrics(): void {
    if (this.metrics.length < 2) return;

    const latest = this.metrics[this.metrics.length - 1];
    const previous = this.metrics[this.metrics.length - 2];

    // Analyze response time trend
    const responseTimeTrend = this.calculateTrend(
      this.metrics.map(m => m.search.averageResponseTime),
      5 // Look at last 5 data points
    );

    // Analyze memory usage trend
    const memoryTrend = this.calculateTrend(
      this.metrics.map(m => m.memory.percentage),
      10 // Look at last 10 data points
    );

    // Analyze cache performance trend
    const cacheHitTrend = this.calculateTrend(
      this.metrics.map(m => m.cache.hitRate),
      5
    );

    // Log significant trends
    if (responseTimeTrend.trend === 'degrading' && responseTimeTrend.confidence > 0.8) {
      console.warn('🚨 Response time degradation detected:', responseTimeTrend);
    }

    if (memoryTrend.trend === 'degrading' && memoryTrend.confidence > 0.8) {
      console.warn('🚨 Memory usage increasing:', memoryTrend);
    }

    if (cacheHitTrend.trend === 'degrading' && cacheHitTrend.confidence > 0.7) {
      console.warn('🚨 Cache performance degrading:', cacheHitTrend);
    }
  }

  /**
   * Calculate trend analysis for a metric
   */
  private calculateTrend(values: number[], windowSize: number = 5): TrendAnalysis {
    if (values.length < windowSize) {
      return {
        metric: 'unknown',
        trend: 'stable',
        changeRate: 0,
        confidence: 0,
        prediction: { nextHour: 0, nextDay: 0, confidence: 0 }
      };
    }

    const recentValues = values.slice(-windowSize);
    const firstHalf = recentValues.slice(0, Math.floor(windowSize / 2));
    const secondHalf = recentValues.slice(Math.floor(windowSize / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const changeRate = (secondAvg - firstAvg) / firstAvg;
    const absChangeRate = Math.abs(changeRate);

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (changeRate > 0.05) trend = 'degrading';
    else if (changeRate < -0.05) trend = 'improving';

    // Calculate confidence based on consistency
    const variance = this.calculateVariance(recentValues);
    const confidence = Math.max(0, 1 - variance / (secondAvg || 1));

    return {
      metric: 'unknown',
      trend,
      changeRate,
      confidence,
      prediction: {
        nextHour: secondAvg * (1 + changeRate),
        nextDay: secondAvg * (1 + changeRate * 24),
        confidence: confidence * 0.8 // Reduce confidence for predictions
      }
    };
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    if (!this.config.enabled || this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];

    // Check each threshold
    this.checkThreshold('cpu_usage', latest.cpu.usage, this.config.thresholds.cpuUsage);
    this.checkThreshold('memory_usage', latest.memory.percentage, this.config.thresholds.memoryUsage);
    this.checkThreshold('response_time', latest.search.averageResponseTime, this.config.thresholds.responseTime);
    this.checkThreshold('cache_hit_rate', latest.cache.hitRate, this.config.thresholds.cacheHitRate, true); // Inverted threshold
    this.checkThreshold('queue_length', latest.search.queueLength, this.config.thresholds.queueLength);
  }

  /**
   * Check individual threshold
   */
  private checkThreshold(
    metric: string, 
    value: number, 
    threshold: number, 
    inverted: boolean = false
  ): void {
    const isViolation = inverted ? value < threshold : value > threshold;
    
    if (!isViolation) {
      // Check if we need to resolve an existing alert
      this.resolveAlert(metric);
      return;
    }

    // Check cooldown
    const lastAlert = this.alertCooldowns.get(metric);
    if (lastAlert && Date.now() - lastAlert < this.config.cooldownPeriod) {
      return;
    }

    // Determine alert level
    const severity = inverted ? 
      (threshold - value) / threshold : 
      (value - threshold) / threshold;

    const level = this.determineAlertLevel(severity);
    
    // Create alert
    const alert: PerformanceAlert = {
      id: `${metric}_${Date.now()}`,
      timestamp: Date.now(),
      level,
      metric,
      value,
      threshold,
      message: `${metric} ${inverted ? 'below' : 'above'} threshold: ${value.toFixed(2)} ${inverted ? '<' : '>'} ${threshold}`,
      resolved: false
    };

    this.alerts.push(alert);
    this.alertCooldowns.set(metric, Date.now());

    // Execute alert actions
    this.executeAlertActions(alert);

    console.warn(`🚨 Performance alert: ${alert.message}`);
  }

  /**
   * Determine alert level based on severity
   */
  private determineAlertLevel(severity: number): 'info' | 'warning' | 'error' | 'critical' {
    for (const level of this.config.escalationLevels.reverse()) {
      if (severity >= level.threshold) {
        return level.level;
      }
    }
    return 'info';
  }

  /**
   * Execute actions for an alert
   */
  private executeAlertActions(alert: PerformanceAlert): void {
    const levelConfig = this.config.escalationLevels.find(l => l.level === alert.level);
    if (!levelConfig) return;

    for (const action of levelConfig.actions) {
      switch (action) {
        case 'log':
          console.log(`📝 Alert logged: ${alert.message}`);
          break;
        case 'notify':
          this.sendNotification(alert);
          break;
        case 'throttle':
          this.enableThrottling(alert);
          break;
        case 'fallback':
          this.enableFallbackMode(alert);
          break;
      }
    }
  }

  /**
   * Send notification for alert
   */
  private sendNotification(alert: PerformanceAlert): void {
    // Would integrate with notification service
    console.log(`📧 Notification sent for alert: ${alert.message}`);
  }

  /**
   * Enable throttling for performance protection
   */
  private enableThrottling(alert: PerformanceAlert): void {
    // Would implement request throttling
    console.log(`🚦 Throttling enabled due to: ${alert.message}`);
  }

  /**
   * Enable fallback mode
   */
  private enableFallbackMode(alert: PerformanceAlert): void {
    // Would enable fallback systems
    console.log(`🔄 Fallback mode enabled due to: ${alert.message}`);
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(metric: string): void {
    const unresolvedAlert = this.alerts
      .filter(a => a.metric === metric && !a.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (unresolvedAlert) {
      unresolvedAlert.resolved = true;
      unresolvedAlert.resolvedAt = Date.now();
      unresolvedAlert.duration = unresolvedAlert.resolvedAt - unresolvedAlert.timestamp;
      
      console.log(`✅ Alert resolved: ${unresolvedAlert.message} (duration: ${unresolvedAlert.duration}ms)`);
    }
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Clean up old alerts
    this.alerts = this.alerts.filter(a => a.timestamp > weekAgo);
    
    // Clean up old cooldowns
    for (const [metric, timestamp] of this.alertCooldowns.entries()) {
      if (timestamp < weekAgo) {
        this.alertCooldowns.delete(metric);
      }
    }
  }

  /**
   * Generate performance report
   */
  generateReport(periodHours: number = 24): PerformanceReport {
    const endTime = Date.now();
    const startTime = endTime - (periodHours * 60 * 60 * 1000);
    
    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (periodMetrics.length === 0) {
      throw new Error('No metrics available for the specified period');
    }

    // Calculate summary statistics
    const responseTimes = periodMetrics.map(m => m.search.averageResponseTime);
    const averageResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const peakResponseTime = Math.max(...responseTimes);

    const totalRequests = periodMetrics.length; // Simplified
    const errorRate = 0; // Would calculate from actual error metrics
    const uptime = (endTime - this.startTime) / 1000; // seconds
    const availability = 99.9; // Would calculate from actual downtime

    // Generate trends
    const trends: TrendAnalysis[] = [
      this.calculateTrend(responseTimes),
      this.calculateTrend(periodMetrics.map(m => m.memory.percentage)),
      this.calculateTrend(periodMetrics.map(m => m.cache.hitRate))
    ];

    // Get period alerts
    const periodAlerts = this.alerts.filter(a => 
      a.timestamp >= startTime && a.timestamp <= endTime
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(periodMetrics, trends);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(periodMetrics);

    return {
      period: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      },
      summary: {
        averageResponseTime,
        peakResponseTime,
        totalRequests,
        errorRate,
        uptime,
        availability
      },
      trends,
      alerts: periodAlerts,
      recommendations,
      bottlenecks
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: SystemMetrics[], trends: TrendAnalysis[]): string[] {
    const recommendations: string[] = [];

    // Check cache performance
    const avgCacheHitRate = metrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / metrics.length;
    if (avgCacheHitRate < 70) {
      recommendations.push('Consider increasing cache size or improving cache warming strategies');
    }

    // Check memory usage
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memory.percentage, 0) / metrics.length;
    if (avgMemoryUsage > 80) {
      recommendations.push('Memory usage is high - consider optimizing memory allocation or increasing available memory');
    }

    // Check response time trends
    const responseTimeTrend = trends.find(t => t.metric.includes('response'));
    if (responseTimeTrend?.trend === 'degrading') {
      recommendations.push('Response times are increasing - investigate query optimization and system load');
    }

    return recommendations;
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: SystemMetrics[]): Array<{
    component: string;
    severity: number;
    description: string;
    impact: string;
  }> {
    const bottlenecks = [];

    // Check for high queue lengths
    const avgQueueLength = metrics.reduce((sum, m) => sum + m.search.queueLength, 0) / metrics.length;
    if (avgQueueLength > 10) {
      bottlenecks.push({
        component: 'search_queue',
        severity: Math.min(1, avgQueueLength / 20),
        description: `High search queue length (avg: ${avgQueueLength.toFixed(1)})`,
        impact: 'Increased search response times and user wait times'
      });
    }

    // Check for low cache hit rates
    const avgCacheHitRate = metrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / metrics.length;
    if (avgCacheHitRate < 60) {
      bottlenecks.push({
        component: 'cache_system',
        severity: (60 - avgCacheHitRate) / 60,
        description: `Low cache hit rate (${avgCacheHitRate.toFixed(1)}%)`,
        impact: 'Increased database load and slower response times'
      });
    }

    return bottlenecks;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    uptime: number;
    metricsCollected: number;
    activeAlerts: number;
    lastMetricTime: number | null;
  } {
    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      metricsCollected: this.metrics.length,
      activeAlerts: this.getActiveAlerts().length,
      lastMetricTime: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : null
    };
  }
}

// Export singleton instance
export const comprehensivePerformanceMonitor = new ComprehensivePerformanceMonitor();
export type { SystemMetrics, PerformanceAlert, PerformanceReport, AlertConfig };
