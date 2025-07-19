/**
 * Alert Engine Manager
 * Coordinates the real-time alert trigger engine and metrics collection
 * Task 2: Implement Real-time Alert Trigger Engine - Orchestration
 */

import { alertTriggerEngine } from './alertTriggerEngine';
import { realTimeMetricsCollector } from './realTimeMetricsCollector';
import { alertingService } from './alertingService';
import { supabase } from '@/lib/supabase';

interface EngineManagerConfig {
  autoStart: boolean;
  metricsCollectionInterval: number;
  alertEvaluationInterval: number;
  healthCheckInterval: number;
  enableMetricsCollection: boolean;
  enableAlertEvaluation: boolean;
  enableHealthMonitoring: boolean;
}

interface EngineManagerStatus {
  isRunning: boolean;
  startTime: Date | null;
  uptime: number;
  components: {
    metricsCollector: {
      isRunning: boolean;
      lastCollection: Date;
      totalSnapshots: number;
      errors: number;
    };
    alertEngine: {
      isRunning: boolean;
      lastEvaluation: Date;
      rulesEvaluated: number;
      alertsTriggered: number;
      errors: number;
    };
  };
  lastHealthCheck: Date | null;
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

export class AlertEngineManager {
  private isRunning = false;
  private startTime: Date | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;

  private readonly defaultConfig: EngineManagerConfig = {
    autoStart: true,
    metricsCollectionInterval: 30000, // 30 seconds
    alertEvaluationInterval: 60000, // 1 minute
    healthCheckInterval: 300000, // 5 minutes
    enableMetricsCollection: true,
    enableAlertEvaluation: true,
    enableHealthMonitoring: true
  };

  private config: EngineManagerConfig;

  constructor(config: Partial<EngineManagerConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Start the complete alert engine system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Alert Engine Manager is already running');
      return;
    }

    console.log('🚀 Starting Alert Engine Manager');
    this.isRunning = true;
    this.startTime = new Date();

    try {
      // Start metrics collection if enabled
      if (this.config.enableMetricsCollection) {
        console.log('📊 Starting metrics collection...');
        await realTimeMetricsCollector.start();
      }

      // Start alert evaluation if enabled
      if (this.config.enableAlertEvaluation) {
        console.log('🚨 Starting alert trigger engine...');
        await alertTriggerEngine.start();
      }

      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        console.log('🏥 Starting health monitoring...');
        this.startHealthMonitoring();
      }

      // Perform initial health check
      await this.performHealthCheck();

      console.log('✅ Alert Engine Manager started successfully');

      // Log initial status
      const status = await this.getStatus();
      console.log('📋 Initial Status:', {
        components: Object.keys(status.components).length,
        health: status.overallHealth,
        uptime: 0
      });

    } catch (error) {
      console.error('❌ Failed to start Alert Engine Manager:', error);
      await this.stop(); // Clean up on failure
      throw error;
    }
  }

  /**
   * Stop the complete alert engine system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Alert Engine Manager is not running');
      return;
    }

    console.log('🛑 Stopping Alert Engine Manager');
    this.isRunning = false;

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop alert trigger engine
      alertTriggerEngine.stop();

      // Stop metrics collector
      realTimeMetricsCollector.stop();

      console.log('✅ Alert Engine Manager stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping Alert Engine Manager:', error);
    }
  }

  /**
   * Restart the alert engine system
   */
  async restart(): Promise<void> {
    console.log('🔄 Restarting Alert Engine Manager');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('🏥 Performing comprehensive health check');
      this.lastHealthCheck = new Date();

      // Check database connectivity
      const dbStartTime = Date.now();
      const { error: dbError } = await supabase
        .from('alert_rules')
        .select('count')
        .limit(1);
      const dbResponseTime = Date.now() - dbStartTime;

      if (dbError) {
        console.error('❌ Database health check failed:', dbError);
      } else {
        console.log(`✅ Database responsive (${dbResponseTime}ms)`);
      }

      // Check component health
      const metricsCollectorStatus = realTimeMetricsCollector.getStatus();
      const alertEngineStatus = alertTriggerEngine.getStatus();

      console.log('📊 Component Status:', {
        metricsCollector: metricsCollectorStatus.isRunning ? '✅' : '❌',
        alertEngine: alertEngineStatus.isRunning ? '✅' : '❌',
        database: dbError ? '❌' : '✅'
      });

      // Check for stuck processes
      const now = Date.now();
      const metricsStats = realTimeMetricsCollector.getStatistics();
      const alertStats = alertTriggerEngine.getStatistics();

      // Alert if metrics collection is stale (no collection in last 10 minutes)
      const metricsStaleThreshold = 10 * 60 * 1000; // 10 minutes
      if (now - metricsStats.lastCollectionTime.getTime() > metricsStaleThreshold) {
        console.warn('⚠️ Metrics collection appears stale');
      }

      // Alert if alert evaluation is stale (no evaluation in last 15 minutes)
      const alertStaleThreshold = 15 * 60 * 1000; // 15 minutes
      if (now - alertStats.lastEvaluationTime.getTime() > alertStaleThreshold) {
        console.warn('⚠️ Alert evaluation appears stale');
      }

      // Log performance statistics
      console.log('📈 Performance Statistics:', {
        metricsCollector: {
          totalSnapshots: metricsStats.totalSnapshots,
          averageCollectionTime: Math.round(metricsStats.averageCollectionTime),
          errors: metricsStats.collectionErrors
        },
        alertEngine: {
          rulesEvaluated: alertStats.rulesEvaluated,
          alertsTriggered: alertStats.alertsTriggered,
          averageEvaluationTime: Math.round(alertStats.averageEvaluationTime),
          errors: alertStats.evaluationErrors
        }
      });

    } catch (error) {
      console.error('❌ Error during health check:', error);
    }
  }

  /**
   * Get comprehensive status of the alert engine system
   */
  async getStatus(): Promise<EngineManagerStatus> {
    const metricsStats = realTimeMetricsCollector.getStatistics();
    const metricsStatus = realTimeMetricsCollector.getStatus();
    
    const alertStats = alertTriggerEngine.getStatistics();
    const alertStatus = alertTriggerEngine.getStatus();

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (!metricsStatus.isRunning || !alertStatus.isRunning) {
      overallHealth = 'critical';
    } else if (metricsStats.collectionErrors > 10 || alertStats.evaluationErrors > 10) {
      overallHealth = 'degraded';
    }

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      components: {
        metricsCollector: {
          isRunning: metricsStatus.isRunning,
          lastCollection: metricsStats.lastCollectionTime,
          totalSnapshots: metricsStats.totalSnapshots,
          errors: metricsStats.collectionErrors
        },
        alertEngine: {
          isRunning: alertStatus.isRunning,
          lastEvaluation: alertStats.lastEvaluationTime,
          rulesEvaluated: alertStats.rulesEvaluated,
          alertsTriggered: alertStats.alertsTriggered,
          errors: alertStats.evaluationErrors
        }
      },
      lastHealthCheck: this.lastHealthCheck,
      overallHealth
    };
  }

  /**
   * Force immediate evaluation of all alert rules
   */
  async forceEvaluation(): Promise<void> {
    console.log('🔄 Forcing immediate alert evaluation');
    
    // Force metrics collection first
    await realTimeMetricsCollector.forceCollection();
    
    // Then force alert evaluation
    const results = await alertTriggerEngine.forceEvaluation();
    
    console.log(`✅ Force evaluation completed. Triggered: ${results.filter(r => r.triggered).length}/${results.length}`);
  }

  /**
   * Get recent alert activity summary
   */
  async getRecentActivity(hours: number = 24): Promise<{
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByStatus: Record<string, number>;
    topTriggeredRules: Array<{ ruleName: string; count: number }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const alerts = await alertingService.getAlerts({
      date_from: since.toISOString()
    });

    const alertsBySeverity: Record<string, number> = {};
    const alertsByStatus: Record<string, number> = {};
    const ruleTriggersCount: Record<string, number> = {};

    alerts.forEach(alert => {
      // Count by severity
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      
      // Count by status
      alertsByStatus[alert.status] = (alertsByStatus[alert.status] || 0) + 1;
      
      // Count by rule
      const ruleName = alert.alert_rule?.name || 'Unknown Rule';
      ruleTriggersCount[ruleName] = (ruleTriggersCount[ruleName] || 0) + 1;
    });

    // Get top triggered rules
    const topTriggeredRules = Object.entries(ruleTriggersCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ruleName, count]) => ({ ruleName, count }));

    return {
      totalAlerts: alerts.length,
      alertsBySeverity,
      alertsByStatus,
      topTriggeredRules
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EngineManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Alert Engine Manager configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): EngineManagerConfig {
    return { ...this.config };
  }

  /**
   * Check if the manager is healthy
   */
  isHealthy(): boolean {
    if (!this.isRunning) return false;
    
    const metricsStatus = realTimeMetricsCollector.getStatus();
    const alertStatus = alertTriggerEngine.getStatus();
    
    return metricsStatus.isRunning && alertStatus.isRunning;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }
}

// Export singleton instance
export const alertEngineManager = new AlertEngineManager();
