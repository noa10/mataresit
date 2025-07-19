/**
 * Real-time Alert Trigger Engine
 * Monitors metrics in real-time and triggers alerts based on configurable thresholds
 * Task 2: Implement Real-time Alert Trigger Engine
 */

import { supabase } from '@/lib/supabase';
import { alertingService } from './alertingService';
import { embeddingHealthService } from './embeddingHealthService';
import { AlertRule, AlertSeverity } from '@/types/alerting';

interface MetricValue {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
  context?: Record<string, any>;
}

interface AlertTriggerResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  metricValue?: number;
  thresholdValue: number;
  severity: AlertSeverity;
  reason?: string;
}

interface EngineStatistics {
  rulesEvaluated: number;
  alertsTriggered: number;
  evaluationErrors: number;
  lastEvaluationTime: Date;
  averageEvaluationTime: number;
  uptime: number;
}

export class AlertTriggerEngine {
  private isRunning = false;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  
  // Statistics tracking
  private stats: EngineStatistics = {
    rulesEvaluated: 0,
    alertsTriggered: 0,
    evaluationErrors: 0,
    lastEvaluationTime: new Date(),
    averageEvaluationTime: 0,
    uptime: 0
  };
  
  private evaluationTimes: number[] = [];
  private readonly maxEvaluationTimeHistory = 100;
  
  // Configuration
  private readonly config = {
    defaultEvaluationInterval: 60000, // 1 minute
    healthCheckInterval: 300000, // 5 minutes
    maxConcurrentEvaluations: 10,
    evaluationTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
  };

  /**
   * Start the alert trigger engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Alert trigger engine is already running');
      return;
    }

    console.log('🚨 Starting Alert Trigger Engine');
    this.isRunning = true;
    this.startTime = new Date();

    // Start periodic rule evaluation
    this.evaluationInterval = setInterval(
      () => this.evaluateAllRules(),
      this.config.defaultEvaluationInterval
    );

    // Start health monitoring
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );

    // Perform initial evaluation
    await this.evaluateAllRules();
    
    console.log('✅ Alert Trigger Engine started successfully');
  }

  /**
   * Stop the alert trigger engine
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Alert trigger engine is not running');
      return;
    }

    console.log('🛑 Stopping Alert Trigger Engine');
    this.isRunning = false;

    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    console.log('✅ Alert Trigger Engine stopped');
  }

  /**
   * Evaluate all enabled alert rules
   */
  private async evaluateAllRules(): Promise<AlertTriggerResult[]> {
    const startTime = Date.now();
    const results: AlertTriggerResult[] = [];

    try {
      // Get all enabled alert rules
      const rules = await alertingService.getAlertRules();
      const enabledRules = rules.filter(rule => rule.enabled);

      console.log(`🔍 Evaluating ${enabledRules.length} alert rules`);

      // Evaluate rules in batches to prevent overwhelming the system
      const batchSize = this.config.maxConcurrentEvaluations;
      for (let i = 0; i < enabledRules.length; i += batchSize) {
        const batch = enabledRules.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(rule => this.evaluateRule(rule))
        );

        // Process batch results
        batchResults.forEach((result, index) => {
          const rule = batch[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.triggered) {
              this.stats.alertsTriggered++;
            }
          } else {
            console.error(`Failed to evaluate rule ${rule.name}:`, result.reason);
            this.stats.evaluationErrors++;
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              triggered: false,
              thresholdValue: rule.threshold_value,
              severity: rule.severity,
              reason: `Evaluation error: ${result.reason}`
            });
          }
        });
      }

      this.stats.rulesEvaluated += enabledRules.length;

    } catch (error) {
      console.error('Error during rule evaluation:', error);
      this.stats.evaluationErrors++;
    }

    // Update statistics
    const evaluationTime = Date.now() - startTime;
    this.evaluationTimes.push(evaluationTime);
    if (this.evaluationTimes.length > this.maxEvaluationTimeHistory) {
      this.evaluationTimes.shift();
    }
    
    this.stats.lastEvaluationTime = new Date();
    this.stats.averageEvaluationTime = this.evaluationTimes.reduce((a, b) => a + b, 0) / this.evaluationTimes.length;
    this.stats.uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    console.log(`✅ Rule evaluation completed in ${evaluationTime}ms. Triggered: ${results.filter(r => r.triggered).length}`);
    
    return results;
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<AlertTriggerResult> {
    try {
      // Get current metric value
      const metricValue = await this.getMetricValue(rule);
      
      if (metricValue === null) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          triggered: false,
          thresholdValue: rule.threshold_value,
          severity: rule.severity,
          reason: 'Metric value not available'
        };
      }

      // Check if we should skip evaluation due to cooldown
      if (await this.isInCooldown(rule)) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          triggered: false,
          metricValue,
          thresholdValue: rule.threshold_value,
          severity: rule.severity,
          reason: 'Rule in cooldown period'
        };
      }

      // Evaluate condition
      const conditionMet = this.evaluateCondition(
        metricValue,
        rule.threshold_value,
        rule.threshold_operator
      );

      // If condition is met, check consecutive failures requirement
      if (conditionMet && rule.consecutive_failures_required > 1) {
        const consecutiveFailures = await this.getConsecutiveFailures(rule);
        if (consecutiveFailures < rule.consecutive_failures_required) {
          await this.recordFailure(rule);
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            triggered: false,
            metricValue,
            thresholdValue: rule.threshold_value,
            severity: rule.severity,
            reason: `Consecutive failures: ${consecutiveFailures + 1}/${rule.consecutive_failures_required}`
          };
        }
      }

      // Trigger alert if condition is met
      if (conditionMet) {
        await this.triggerAlert(rule, metricValue);
        await this.clearFailureHistory(rule);
      } else {
        await this.clearFailureHistory(rule);
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: conditionMet,
        metricValue,
        thresholdValue: rule.threshold_value,
        severity: rule.severity
      };

    } catch (error) {
      console.error(`Error evaluating rule ${rule.name}:`, error);
      throw error;
    }
  }

  /**
   * Get current metric value for a rule
   */
  private async getMetricValue(rule: AlertRule): Promise<number | null> {
    try {
      switch (rule.metric_source) {
        case 'embedding_metrics':
          return await this.getEmbeddingMetricValue(rule);
        
        case 'performance_metrics':
          return await this.getPerformanceMetricValue(rule);
        
        case 'system_health':
          return await this.getSystemHealthMetricValue(rule);
        
        case 'notification_metrics':
          return await this.getNotificationMetricValue(rule);
        
        default:
          console.warn(`Unknown metric source: ${rule.metric_source}`);
          return null;
      }
    } catch (error) {
      console.error(`Error getting metric value for ${rule.metric_name}:`, error);
      return null;
    }
  }

  /**
   * Get embedding-related metric values
   */
  private async getEmbeddingMetricValue(rule: AlertRule): Promise<number | null> {
    const windowMinutes = rule.evaluation_window_minutes;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    switch (rule.metric_name) {
      case 'success_rate': {
        const { data, error } = await supabase
          .from('embedding_performance_metrics')
          .select('status')
          .gte('created_at', windowStart.toISOString())
          .eq('team_id', rule.team_id);

        if (error) throw error;
        if (!data || data.length === 0) return 100; // Default to 100% if no data

        const successCount = data.filter(m => m.status === 'success').length;
        return (successCount / data.length) * 100;
      }

      case 'avg_duration': {
        const { data, error } = await supabase
          .from('embedding_performance_metrics')
          .select('total_duration_ms')
          .gte('created_at', windowStart.toISOString())
          .eq('team_id', rule.team_id)
          .not('total_duration_ms', 'is', null);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const avgDuration = data.reduce((sum, m) => sum + (m.total_duration_ms || 0), 0) / data.length;
        return avgDuration;
      }

      case 'error_rate': {
        const { data, error } = await supabase
          .from('embedding_performance_metrics')
          .select('status')
          .gte('created_at', windowStart.toISOString())
          .eq('team_id', rule.team_id);

        if (error) throw error;
        if (!data || data.length === 0) return 0;

        const errorCount = data.filter(m => m.status === 'failed' || m.status === 'timeout').length;
        return (errorCount / data.length) * 100;
      }

      default:
        console.warn(`Unknown embedding metric: ${rule.metric_name}`);
        return null;
    }
  }

  /**
   * Get performance-related metric values
   */
  private async getPerformanceMetricValue(rule: AlertRule): Promise<number | null> {
    const windowMinutes = rule.evaluation_window_minutes;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data, error } = await supabase
      .from('performance_metrics')
      .select('metric_value')
      .eq('metric_name', rule.metric_name)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data[0].metric_value;
  }

  /**
   * Get system health metric values
   */
  private async getSystemHealthMetricValue(rule: AlertRule): Promise<number | null> {
    try {
      const healthStatus = await embeddingHealthService.performHealthCheck();

      switch (rule.metric_name) {
        case 'health_score':
          return healthStatus.healthScore;

        case 'api_response_time':
          const performance = await embeddingHealthService.getPerformanceMetrics();
          return performance.apiResponseTime;

        case 'error_rate':
          const performance2 = await embeddingHealthService.getPerformanceMetrics();
          return performance2.errorRate;

        case 'cache_hit_rate':
          const performance3 = await embeddingHealthService.getPerformanceMetrics();
          return performance3.cacheHitRate;

        default:
          console.warn(`Unknown system health metric: ${rule.metric_name}`);
          return null;
      }
    } catch (error) {
      console.error('Error getting system health metrics:', error);
      return null;
    }
  }

  /**
   * Get notification-related metric values
   */
  private async getNotificationMetricValue(rule: AlertRule): Promise<number | null> {
    const windowMinutes = rule.evaluation_window_minutes;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    switch (rule.metric_name) {
      case 'notification_success_rate': {
        const { data, error } = await supabase
          .from('alert_notifications')
          .select('delivery_status')
          .gte('created_at', windowStart.toISOString());

        if (error) throw error;
        if (!data || data.length === 0) return 100;

        const successCount = data.filter(n => n.delivery_status === 'delivered').length;
        return (successCount / data.length) * 100;
      }

      case 'notification_failure_rate': {
        const { data, error } = await supabase
          .from('alert_notifications')
          .select('delivery_status')
          .gte('created_at', windowStart.toISOString());

        if (error) throw error;
        if (!data || data.length === 0) return 0;

        const failureCount = data.filter(n => n.delivery_status === 'failed').length;
        return (failureCount / data.length) * 100;
      }

      default:
        console.warn(`Unknown notification metric: ${rule.metric_name}`);
        return null;
    }
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=': return Math.abs(value - threshold) < 0.001; // Float comparison
      case '!=': return Math.abs(value - threshold) >= 0.001;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Check if rule is in cooldown period
   */
  private async isInCooldown(rule: AlertRule): Promise<boolean> {
    const cooldownEnd = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);

    const { data, error } = await supabase
      .from('alerts')
      .select('created_at')
      .eq('alert_rule_id', rule.id)
      .gte('created_at', cooldownEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking cooldown:', error);
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Get consecutive failure count for a rule
   */
  private async getConsecutiveFailures(rule: AlertRule): Promise<number> {
    // This would be implemented with a separate tracking table or cache
    // For now, return 0 as a placeholder
    return 0;
  }

  /**
   * Record a failure for consecutive failure tracking
   */
  private async recordFailure(rule: AlertRule): Promise<void> {
    // This would be implemented with a separate tracking table or cache
    // For now, this is a placeholder
  }

  /**
   * Clear failure history for a rule
   */
  private async clearFailureHistory(rule: AlertRule): Promise<void> {
    // This would be implemented with a separate tracking table or cache
    // For now, this is a placeholder
  }

  /**
   * Trigger an alert for a rule
   */
  private async triggerAlert(rule: AlertRule, metricValue: number): Promise<void> {
    try {
      // Check if there's already an active alert for this rule
      const existingAlerts = await alertingService.getAlerts({
        alert_rule_id: rule.id,
        status: ['active', 'acknowledged']
      });

      if (existingAlerts.length > 0) {
        console.log(`Alert already exists for rule ${rule.name}, skipping`);
        return;
      }

      // Check rate limiting
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentAlerts = await alertingService.getAlerts({
        alert_rule_id: rule.id,
        date_from: hourAgo.toISOString()
      });

      if (recentAlerts.length >= rule.max_alerts_per_hour) {
        console.log(`Rate limit exceeded for rule ${rule.name}, skipping`);
        return;
      }

      // Create alert
      const alertTitle = `${rule.name} - Threshold ${rule.threshold_operator} ${rule.threshold_value}`;
      const alertDescription = `Metric ${rule.metric_name} is ${metricValue} ${rule.threshold_unit || ''}, which ${rule.threshold_operator} threshold of ${rule.threshold_value} ${rule.threshold_unit || ''}`;

      const { data, error } = await supabase
        .from('alerts')
        .insert({
          alert_rule_id: rule.id,
          title: alertTitle,
          description: alertDescription,
          severity: rule.severity,
          metric_name: rule.metric_name,
          metric_value: metricValue,
          threshold_value: rule.threshold_value,
          threshold_operator: rule.threshold_operator,
          context: {
            rule_name: rule.name,
            evaluation_window_minutes: rule.evaluation_window_minutes,
            metric_source: rule.metric_source,
            triggered_at: new Date().toISOString()
          },
          team_id: rule.team_id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating alert:', error);
        return;
      }

      console.log(`🚨 Alert triggered: ${alertTitle} (ID: ${data.id})`);

      // Add to alert history
      await supabase
        .from('alert_history')
        .insert({
          alert_id: data.id,
          event_type: 'created',
          event_description: `Alert created by trigger engine`,
          new_status: 'active',
          metadata: {
            metric_value: metricValue,
            threshold_value: rule.threshold_value,
            evaluation_time: new Date().toISOString()
          }
        });

    } catch (error) {
      console.error(`Error triggering alert for rule ${rule.name}:`, error);
      throw error;
    }
  }

  /**
   * Perform health check on the alert engine
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('🏥 Performing alert engine health check');

      // Check if we can access the database
      const { error } = await supabase
        .from('alert_rules')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Alert engine health check failed - database error:', error);
        return;
      }

      // Log current statistics
      console.log('📊 Alert Engine Statistics:', {
        uptime: Math.round(this.stats.uptime / 1000 / 60), // minutes
        rulesEvaluated: this.stats.rulesEvaluated,
        alertsTriggered: this.stats.alertsTriggered,
        evaluationErrors: this.stats.evaluationErrors,
        averageEvaluationTime: Math.round(this.stats.averageEvaluationTime),
        lastEvaluation: this.stats.lastEvaluationTime.toISOString()
      });

    } catch (error) {
      console.error('Error during alert engine health check:', error);
    }
  }

  /**
   * Get engine statistics
   */
  getStatistics(): EngineStatistics {
    return { ...this.stats };
  }

  /**
   * Get engine status
   */
  getStatus(): { isRunning: boolean; startTime: Date | null; uptime: number } {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.stats.uptime
    };
  }

  /**
   * Force evaluation of all rules (for testing/manual triggers)
   */
  async forceEvaluation(): Promise<AlertTriggerResult[]> {
    console.log('🔄 Force evaluation triggered');
    return await this.evaluateAllRules();
  }

  /**
   * Force evaluation of a specific rule
   */
  async forceRuleEvaluation(ruleId: string): Promise<AlertTriggerResult | null> {
    try {
      const rule = await alertingService.getAlertRule(ruleId);
      if (!rule) {
        console.error(`Rule not found: ${ruleId}`);
        return null;
      }

      console.log(`🔄 Force evaluation of rule: ${rule.name}`);
      return await this.evaluateRule(rule);
    } catch (error) {
      console.error(`Error force evaluating rule ${ruleId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const alertTriggerEngine = new AlertTriggerEngine();
