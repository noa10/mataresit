// OPTIMIZATION: Comprehensive Real-time Performance Monitoring System
import { notificationService } from './notificationService';
import { getReceiptSubscriptionStats, getReceiptSubscriptionHealth } from './receiptService';

interface PerformanceMetrics {
  timestamp: number;
  notifications: {
    activeSubscriptions: number;
    processed: number;
    blocked: number;
    blockRate: number;
    averageProcessingTime: number;
    maxProcessingTime: number;
    circuitBreakerTrips: number;
  };
  receipts: {
    legacy: {
      activeSubscriptions: number;
      totalCallbacks: number;
    };
    unified: {
      activeSubscriptions: number;
      totalCallbacks: number;
    };
    total: {
      activeSubscriptions: number;
      totalCallbacks: number;
    };
    healthScore: number;
  };
  system: {
    memoryUsage?: number;
    connectionCount: number;
    errorRate: number;
    uptime: number;
  };
}

interface PerformanceAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'notifications' | 'receipts' | 'system' | 'performance';
  message: string;
  metrics: any;
  resolved: boolean;
}

class RealTimePerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private errorCount = 0;
  private totalOperations = 0;

  // Configuration
  private readonly config = {
    metricsRetentionMs: 30 * 60 * 1000, // 30 minutes
    alertRetentionMs: 60 * 60 * 1000, // 1 hour
    monitoringIntervalMs: 10 * 1000, // 10 seconds
    thresholds: {
      notifications: {
        blockRateWarning: 15, // %
        blockRateCritical: 30, // %
        processingTimeWarning: 50, // ms
        processingTimeCritical: 100, // ms
        circuitBreakerTripsWarning: 3,
        circuitBreakerTripsCritical: 10
      },
      receipts: {
        subscriptionCountWarning: 15,
        subscriptionCountCritical: 25,
        healthScoreWarning: 70,
        healthScoreCritical: 50
      },
      system: {
        errorRateWarning: 5, // %
        errorRateCritical: 15, // %
        connectionCountWarning: 20,
        connectionCountCritical: 35
      }
    }
  };

  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring already started');
      return;
    }

    console.log('🏥 Starting real-time performance monitoring');
    this.isMonitoring = true;
    this.startTime = Date.now();

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMetrics();
      this.cleanupOldData();
    }, this.config.monitoringIntervalMs);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('Performance monitoring not running');
      return;
    }

    console.log('🛑 Stopping real-time performance monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private collectMetrics(): void {
    try {
      // Get notification metrics
      const notificationStats = notificationService.getConnectionState();
      
      // Get receipt subscription metrics
      const receiptStats = getReceiptSubscriptionStats();
      const receiptHealth = getReceiptSubscriptionHealth();

      // Calculate system metrics
      const uptime = Date.now() - this.startTime;
      const errorRate = this.totalOperations > 0 ? (this.errorCount / this.totalOperations) * 100 : 0;

      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        notifications: {
          activeSubscriptions: notificationStats.activeChannels,
          processed: 0, // Will be updated by notification context
          blocked: 0, // Will be updated by notification context
          blockRate: 0, // Will be calculated
          averageProcessingTime: 0, // Will be updated by notification context
          maxProcessingTime: 0, // Will be updated by notification context
          circuitBreakerTrips: 0 // Will be updated by notification context
        },
        receipts: {
          legacy: {
            activeSubscriptions: receiptStats.legacy.activeSubscriptions,
            totalCallbacks: receiptStats.legacy.subscriptions.reduce((sum, sub) => sum + sub.callbackCount, 0)
          },
          unified: {
            activeSubscriptions: receiptStats.unified.activeSubscriptions,
            totalCallbacks: receiptStats.unified.subscriptions.reduce((sum, sub) => sum + sub.callbackCount, 0)
          },
          total: receiptStats.total,
          healthScore: receiptHealth.healthScore
        },
        system: {
          connectionCount: notificationStats.activeChannels + receiptStats.total.activeSubscriptions,
          errorRate,
          uptime
        }
      };

      this.metrics.push(metrics);
      this.totalOperations++;

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
      this.errorCount++;
      this.totalOperations++;
    }
  }

  private analyzeMetrics(): void {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    const alerts: PerformanceAlert[] = [];

    // Analyze notification performance
    if (latest.notifications.blockRate >= this.config.thresholds.notifications.blockRateCritical) {
      alerts.push(this.createAlert('critical', 'notifications', 
        `Critical notification block rate: ${latest.notifications.blockRate.toFixed(1)}%`, latest.notifications));
    } else if (latest.notifications.blockRate >= this.config.thresholds.notifications.blockRateWarning) {
      alerts.push(this.createAlert('high', 'notifications', 
        `High notification block rate: ${latest.notifications.blockRate.toFixed(1)}%`, latest.notifications));
    }

    if (latest.notifications.averageProcessingTime >= this.config.thresholds.notifications.processingTimeCritical) {
      alerts.push(this.createAlert('critical', 'performance', 
        `Critical notification processing time: ${latest.notifications.averageProcessingTime.toFixed(2)}ms`, latest.notifications));
    } else if (latest.notifications.averageProcessingTime >= this.config.thresholds.notifications.processingTimeWarning) {
      alerts.push(this.createAlert('medium', 'performance', 
        `Slow notification processing: ${latest.notifications.averageProcessingTime.toFixed(2)}ms`, latest.notifications));
    }

    // Analyze receipt subscription health
    if (latest.receipts.healthScore <= this.config.thresholds.receipts.healthScoreCritical) {
      alerts.push(this.createAlert('critical', 'receipts', 
        `Critical receipt subscription health: ${latest.receipts.healthScore}%`, latest.receipts));
    } else if (latest.receipts.healthScore <= this.config.thresholds.receipts.healthScoreWarning) {
      alerts.push(this.createAlert('medium', 'receipts', 
        `Poor receipt subscription health: ${latest.receipts.healthScore}%`, latest.receipts));
    }

    // Analyze system performance
    if (latest.system.connectionCount >= this.config.thresholds.system.connectionCountCritical) {
      alerts.push(this.createAlert('critical', 'system', 
        `Critical connection count: ${latest.system.connectionCount}`, latest.system));
    } else if (latest.system.connectionCount >= this.config.thresholds.system.connectionCountWarning) {
      alerts.push(this.createAlert('high', 'system', 
        `High connection count: ${latest.system.connectionCount}`, latest.system));
    }

    if (latest.system.errorRate >= this.config.thresholds.system.errorRateCritical) {
      alerts.push(this.createAlert('critical', 'system', 
        `Critical error rate: ${latest.system.errorRate.toFixed(1)}%`, latest.system));
    } else if (latest.system.errorRate >= this.config.thresholds.system.errorRateWarning) {
      alerts.push(this.createAlert('medium', 'system', 
        `High error rate: ${latest.system.errorRate.toFixed(1)}%`, latest.system));
    }

    // Add new alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.logAlert(alert);
    });
  }

  private createAlert(
    severity: PerformanceAlert['severity'], 
    category: PerformanceAlert['category'], 
    message: string, 
    metrics: any
  ): PerformanceAlert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      category,
      message,
      metrics,
      resolved: false
    };
  }

  private logAlert(alert: PerformanceAlert): void {
    const emoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    }[alert.severity];

    console.warn(`${emoji} Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    
    // Clean up old metrics
    this.metrics = this.metrics.filter(metric => 
      now - metric.timestamp < this.config.metricsRetentionMs
    );

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => 
      now - alert.timestamp < this.config.alertRetentionMs
    );
  }

  // Public API for getting performance data
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(durationMs: number = 5 * 60 * 1000): PerformanceMetrics[] {
    const cutoff = Date.now() - durationMs;
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`✅ Resolved alert: ${alert.message}`);
      return true;
    }
    return false;
  }

  getPerformanceSummary(): {
    status: 'excellent' | 'good' | 'warning' | 'critical';
    score: number;
    summary: string;
    recommendations: string[];
  } {
    const current = this.getCurrentMetrics();
    if (!current) {
      return {
        status: 'warning',
        score: 0,
        summary: 'No performance data available',
        recommendations: ['Start performance monitoring to get insights']
      };
    }

    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
    const highAlerts = activeAlerts.filter(a => a.severity === 'high').length;
    const mediumAlerts = activeAlerts.filter(a => a.severity === 'medium').length;

    let score = 100;
    score -= criticalAlerts * 30;
    score -= highAlerts * 15;
    score -= mediumAlerts * 5;
    score = Math.max(0, score);

    let status: 'excellent' | 'good' | 'warning' | 'critical';
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'warning';
    else status = 'critical';

    const recommendations: string[] = [];
    if (current.system.connectionCount > 20) {
      recommendations.push('Consider implementing more aggressive connection pooling');
    }
    if (current.receipts.legacy.activeSubscriptions > current.receipts.unified.activeSubscriptions) {
      recommendations.push('Migrate remaining components to unified subscription system');
    }
    if (current.system.errorRate > 5) {
      recommendations.push('Investigate and fix sources of errors in real-time system');
    }

    return {
      status,
      score,
      summary: `Performance score: ${score}/100 with ${activeAlerts.length} active alerts`,
      recommendations
    };
  }

  // Update metrics from external sources
  updateNotificationMetrics(metrics: Partial<PerformanceMetrics['notifications']>): void {
    if (this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      Object.assign(latest.notifications, metrics);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new RealTimePerformanceMonitor();
