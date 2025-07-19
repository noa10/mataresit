/**
 * Alert Suppression Manager
 * Intelligent alert suppression system to prevent spam and optimize alert delivery
 * Task 6: Implement Alert Suppression and Rate Limiting
 */

import { supabase } from '@/lib/supabase';
import { Alert, AlertRule, AlertSeverity } from '@/types/alerting';

interface SuppressionRule {
  id: string;
  name: string;
  description?: string;
  rule_type: 'duplicate' | 'rate_limit' | 'maintenance' | 'grouping' | 'threshold' | 'custom';
  conditions: Record<string, any>;
  suppression_duration_minutes: number;
  max_alerts_per_window: number;
  window_size_minutes: number;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  team_id?: string;
  created_at: string;
  updated_at: string;
}

interface SuppressionContext {
  alert: Alert;
  rule: AlertRule;
  recentAlerts: Alert[];
  activeSuppressions: SuppressionRule[];
  maintenanceWindows: MaintenanceWindow[];
  groupedAlerts: Map<string, Alert[]>;
}

interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  affected_systems: string[];
  affected_severities: AlertSeverity[];
  suppress_all: boolean;
  team_id?: string;
  created_by: string;
  enabled: boolean;
}

interface SuppressionResult {
  shouldSuppress: boolean;
  reason: string;
  suppressionRule?: SuppressionRule;
  suppressUntil?: Date;
  groupKey?: string;
  relatedAlerts?: string[];
  metadata?: Record<string, any>;
}

interface AlertGroup {
  groupKey: string;
  alerts: Alert[];
  firstAlert: Alert;
  lastAlert: Alert;
  count: number;
  severities: AlertSeverity[];
  timeSpan: number; // minutes
  suppressionApplied: boolean;
}

export class AlertSuppressionManager {
  private readonly suppressionRules: Map<string, SuppressionRule> = new Map();
  private readonly maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private readonly alertGroups: Map<string, AlertGroup> = new Map();
  private readonly suppressionCache: Map<string, SuppressionResult> = new Map();

  constructor() {
    this.loadSuppressionRules();
    this.loadMaintenanceWindows();
    this.startCleanupTimer();
  }

  /**
   * Main suppression evaluation method
   */
  async evaluateAlertSuppression(alert: Alert, rule: AlertRule): Promise<SuppressionResult> {
    try {
      console.log(`🔍 Evaluating suppression for alert: ${alert.title} (${alert.id})`);

      // Check cache first
      const cacheKey = this.generateCacheKey(alert, rule);
      const cachedResult = this.suppressionCache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        console.log(`📋 Using cached suppression result for ${alert.id}`);
        return cachedResult;
      }

      // Build suppression context
      const context = await this.buildSuppressionContext(alert, rule);

      // Apply suppression rules in priority order
      const suppressionResult = await this.applySuppression(context);

      // Cache the result
      this.suppressionCache.set(cacheKey, suppressionResult);

      // Log suppression decision
      await this.logSuppressionDecision(alert, suppressionResult);

      return suppressionResult;

    } catch (error) {
      console.error(`Error evaluating suppression for alert ${alert.id}:`, error);
      return {
        shouldSuppress: false,
        reason: 'suppression_evaluation_error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Apply suppression rules in priority order
   */
  private async applySuppression(context: SuppressionContext): Promise<SuppressionResult> {
    // 1. Check maintenance windows first (highest priority)
    const maintenanceResult = this.checkMaintenanceWindows(context);
    if (maintenanceResult.shouldSuppress) {
      return maintenanceResult;
    }

    // 2. Check duplicate detection
    const duplicateResult = this.checkDuplicateAlerts(context);
    if (duplicateResult.shouldSuppress) {
      return duplicateResult;
    }

    // 3. Check rate limiting
    const rateLimitResult = this.checkRateLimiting(context);
    if (rateLimitResult.shouldSuppress) {
      return rateLimitResult;
    }

    // 4. Check alert grouping
    const groupingResult = this.checkAlertGrouping(context);
    if (groupingResult.shouldSuppress) {
      return groupingResult;
    }

    // 5. Check threshold-based suppression
    const thresholdResult = this.checkThresholdSuppression(context);
    if (thresholdResult.shouldSuppress) {
      return thresholdResult;
    }

    // 6. Check custom suppression rules
    const customResult = await this.checkCustomSuppressionRules(context);
    if (customResult.shouldSuppress) {
      return customResult;
    }

    // No suppression applied
    return {
      shouldSuppress: false,
      reason: 'no_suppression_applied'
    };
  }

  /**
   * Check maintenance windows
   */
  private checkMaintenanceWindows(context: SuppressionContext): SuppressionResult {
    const now = new Date();
    
    for (const window of context.maintenanceWindows) {
      if (!window.enabled) continue;

      const startTime = new Date(window.start_time);
      const endTime = new Date(window.end_time);

      if (now >= startTime && now <= endTime) {
        // Check if this alert should be suppressed during maintenance
        const shouldSuppress = window.suppress_all || 
          window.affected_systems.includes(context.alert.metric_name) ||
          window.affected_severities.includes(context.alert.severity);

        if (shouldSuppress) {
          return {
            shouldSuppress: true,
            reason: 'maintenance_window',
            suppressUntil: endTime,
            metadata: {
              maintenanceWindow: window.name,
              windowId: window.id,
              endTime: endTime.toISOString()
            }
          };
        }
      }
    }

    return { shouldSuppress: false, reason: 'no_maintenance_window' };
  }

  /**
   * Check for duplicate alerts
   */
  private checkDuplicateAlerts(context: SuppressionContext): SuppressionResult {
    const duplicateWindow = 30; // minutes
    const cutoffTime = new Date(Date.now() - duplicateWindow * 60 * 1000);

    // Find recent alerts with same rule and similar context
    const duplicates = context.recentAlerts.filter(alert => {
      if (alert.alert_rule_id !== context.alert.alert_rule_id) return false;
      if (new Date(alert.created_at) < cutoffTime) return false;
      
      // Check for similar metric values (within 5% tolerance)
      if (alert.metric_value && context.alert.metric_value) {
        const tolerance = Math.abs(alert.metric_value * 0.05);
        const valueDiff = Math.abs(alert.metric_value - context.alert.metric_value);
        if (valueDiff <= tolerance) return true;
      }

      // Check for identical context keys
      const alertContextKeys = Object.keys(alert.context || {});
      const currentContextKeys = Object.keys(context.alert.context || {});
      const commonKeys = alertContextKeys.filter(key => currentContextKeys.includes(key));
      
      if (commonKeys.length > 0) {
        const matchingKeys = commonKeys.filter(key => 
          alert.context[key] === context.alert.context[key]
        );
        return matchingKeys.length / commonKeys.length >= 0.8; // 80% context match
      }

      return false;
    });

    if (duplicates.length > 0) {
      return {
        shouldSuppress: true,
        reason: 'duplicate_alert',
        relatedAlerts: duplicates.map(a => a.id),
        suppressUntil: new Date(Date.now() + duplicateWindow * 60 * 1000),
        metadata: {
          duplicateCount: duplicates.length,
          windowMinutes: duplicateWindow,
          mostRecentDuplicate: duplicates[0].id
        }
      };
    }

    return { shouldSuppress: false, reason: 'no_duplicates_found' };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimiting(context: SuppressionContext): SuppressionResult {
    const rule = context.rule;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count recent alerts for this rule
    const recentAlertsForRule = context.recentAlerts.filter(alert => 
      alert.alert_rule_id === rule.id && 
      new Date(alert.created_at) >= hourAgo
    );

    if (recentAlertsForRule.length >= rule.max_alerts_per_hour) {
      const suppressUntil = new Date(Math.max(
        ...recentAlertsForRule.map(a => new Date(a.created_at).getTime())
      ) + 60 * 60 * 1000); // 1 hour from most recent alert

      return {
        shouldSuppress: true,
        reason: 'rate_limit_exceeded',
        suppressUntil,
        metadata: {
          currentCount: recentAlertsForRule.length,
          maxAllowed: rule.max_alerts_per_hour,
          windowHours: 1,
          nextAllowedAt: suppressUntil.toISOString()
        }
      };
    }

    // Check cooldown period
    if (rule.cooldown_minutes > 0) {
      const cooldownCutoff = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
      const recentAlertInCooldown = recentAlertsForRule.find(alert => 
        new Date(alert.created_at) >= cooldownCutoff
      );

      if (recentAlertInCooldown) {
        const suppressUntil = new Date(
          new Date(recentAlertInCooldown.created_at).getTime() + 
          rule.cooldown_minutes * 60 * 1000
        );

        return {
          shouldSuppress: true,
          reason: 'cooldown_period',
          suppressUntil,
          metadata: {
            cooldownMinutes: rule.cooldown_minutes,
            lastAlertAt: recentAlertInCooldown.created_at,
            nextAllowedAt: suppressUntil.toISOString()
          }
        };
      }
    }

    return { shouldSuppress: false, reason: 'rate_limit_ok' };
  }

  /**
   * Check alert grouping
   */
  private checkAlertGrouping(context: SuppressionContext): SuppressionResult {
    const groupKey = this.generateGroupKey(context.alert);
    const existingGroup = this.alertGroups.get(groupKey);

    if (existingGroup) {
      // Check if we should suppress based on group size and timing
      const timeSinceFirst = Date.now() - new Date(existingGroup.firstAlert.created_at).getTime();
      const groupingWindow = 15 * 60 * 1000; // 15 minutes

      if (timeSinceFirst <= groupingWindow && existingGroup.count >= 3) {
        // Add to existing group
        existingGroup.alerts.push(context.alert);
        existingGroup.lastAlert = context.alert;
        existingGroup.count++;
        existingGroup.timeSpan = timeSinceFirst / (60 * 1000); // minutes

        return {
          shouldSuppress: true,
          reason: 'alert_grouping',
          groupKey,
          relatedAlerts: existingGroup.alerts.map(a => a.id),
          metadata: {
            groupSize: existingGroup.count,
            timeSpanMinutes: existingGroup.timeSpan,
            firstAlertAt: existingGroup.firstAlert.created_at,
            groupingSeverities: [...new Set(existingGroup.alerts.map(a => a.severity))]
          }
        };
      }
    } else {
      // Create new group
      this.alertGroups.set(groupKey, {
        groupKey,
        alerts: [context.alert],
        firstAlert: context.alert,
        lastAlert: context.alert,
        count: 1,
        severities: [context.alert.severity],
        timeSpan: 0,
        suppressionApplied: false
      });
    }

    return { shouldSuppress: false, reason: 'no_grouping_applied' };
  }

  /**
   * Check threshold-based suppression
   */
  private checkThresholdSuppression(context: SuppressionContext): SuppressionResult {
    // Suppress low-severity alerts if there are many high-severity alerts
    if (context.alert.severity === 'low' || context.alert.severity === 'info') {
      const last30Minutes = new Date(Date.now() - 30 * 60 * 1000);
      const highSeverityAlerts = context.recentAlerts.filter(alert => 
        (alert.severity === 'critical' || alert.severity === 'high') &&
        new Date(alert.created_at) >= last30Minutes
      );

      if (highSeverityAlerts.length >= 5) {
        return {
          shouldSuppress: true,
          reason: 'high_severity_threshold',
          suppressUntil: new Date(Date.now() + 30 * 60 * 1000),
          metadata: {
            highSeverityCount: highSeverityAlerts.length,
            threshold: 5,
            suppressionMinutes: 30
          }
        };
      }
    }

    return { shouldSuppress: false, reason: 'threshold_not_met' };
  }

  /**
   * Check custom suppression rules
   */
  private async checkCustomSuppressionRules(context: SuppressionContext): SuppressionResult {
    const applicableRules = context.activeSuppressions
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const rule of applicableRules) {
      const result = await this.evaluateCustomRule(rule, context);
      if (result.shouldSuppress) {
        return {
          ...result,
          suppressionRule: rule
        };
      }
    }

    return { shouldSuppress: false, reason: 'no_custom_rules_matched' };
  }

  /**
   * Evaluate custom suppression rule
   */
  private async evaluateCustomRule(rule: SuppressionRule, context: SuppressionContext): Promise<SuppressionResult> {
    try {
      const conditions = rule.conditions;

      // Check metric-based conditions
      if (conditions.metric_name && context.alert.metric_name !== conditions.metric_name) {
        return { shouldSuppress: false, reason: 'metric_name_mismatch' };
      }

      if (conditions.severity && !conditions.severity.includes(context.alert.severity)) {
        return { shouldSuppress: false, reason: 'severity_mismatch' };
      }

      // Check time-based conditions
      if (conditions.time_window_minutes) {
        const windowStart = new Date(Date.now() - conditions.time_window_minutes * 60 * 1000);
        const alertsInWindow = context.recentAlerts.filter(alert => 
          new Date(alert.created_at) >= windowStart
        );

        if (alertsInWindow.length < rule.max_alerts_per_window) {
          return { shouldSuppress: false, reason: 'window_threshold_not_met' };
        }
      }

      // Check tag-based conditions
      if (conditions.required_tags) {
        const alertTags = context.alert.tags || {};
        const hasRequiredTags = conditions.required_tags.every((tag: string) => 
          alertTags.hasOwnProperty(tag)
        );

        if (!hasRequiredTags) {
          return { shouldSuppress: false, reason: 'required_tags_missing' };
        }
      }

      // Rule matches - apply suppression
      return {
        shouldSuppress: true,
        reason: 'custom_rule_matched',
        suppressUntil: new Date(Date.now() + rule.suppression_duration_minutes * 60 * 1000),
        metadata: {
          ruleName: rule.name,
          ruleType: rule.rule_type,
          suppressionMinutes: rule.suppression_duration_minutes
        }
      };

    } catch (error) {
      console.error(`Error evaluating custom rule ${rule.id}:`, error);
      return { shouldSuppress: false, reason: 'custom_rule_evaluation_error' };
    }
  }

  /**
   * Build suppression context
   */
  private async buildSuppressionContext(alert: Alert, rule: AlertRule): Promise<SuppressionContext> {
    // Get recent alerts (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('*')
      .gte('created_at', twoHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    // Get active suppression rules
    const { data: suppressionRules } = await supabase
      .from('alert_suppression_rules')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    // Get active maintenance windows
    const now = new Date();
    const { data: maintenanceWindows } = await supabase
      .from('maintenance_windows')
      .select('*')
      .eq('enabled', true)
      .lte('start_time', now.toISOString())
      .gte('end_time', now.toISOString());

    return {
      alert,
      rule,
      recentAlerts: recentAlerts || [],
      activeSuppressions: suppressionRules || [],
      maintenanceWindows: maintenanceWindows || [],
      groupedAlerts: this.alertGroups
    };
  }

  /**
   * Generate group key for alert grouping
   */
  private generateGroupKey(alert: Alert): string {
    const components = [
      alert.metric_name,
      alert.severity,
      alert.alert_rule_id,
      // Add context-based grouping
      JSON.stringify(Object.keys(alert.context || {}).sort())
    ];

    return components.join('|');
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(alert: Alert, rule: AlertRule): string {
    return `${alert.alert_rule_id}|${alert.metric_name}|${alert.severity}|${Date.now()}`;
  }

  /**
   * Check if cache result is still valid
   */
  private isCacheValid(result: SuppressionResult): boolean {
    // Cache is valid for 5 minutes
    const cacheValidityMs = 5 * 60 * 1000;
    return result.metadata?.cachedAt && 
           (Date.now() - result.metadata.cachedAt) < cacheValidityMs;
  }

  /**
   * Log suppression decision
   */
  private async logSuppressionDecision(alert: Alert, result: SuppressionResult): Promise<void> {
    try {
      await supabase
        .from('alert_suppression_log')
        .insert({
          alert_id: alert.id,
          suppressed: result.shouldSuppress,
          reason: result.reason,
          suppression_rule_id: result.suppressionRule?.id,
          suppress_until: result.suppressUntil?.toISOString(),
          metadata: result.metadata || {}
        });
    } catch (error) {
      console.error('Error logging suppression decision:', error);
    }
  }

  /**
   * Load suppression rules from database
   */
  private async loadSuppressionRules(): Promise<void> {
    try {
      const { data: rules } = await supabase
        .from('alert_suppression_rules')
        .select('*')
        .eq('enabled', true);

      if (rules) {
        rules.forEach(rule => this.suppressionRules.set(rule.id, rule));
      }
    } catch (error) {
      console.error('Error loading suppression rules:', error);
    }
  }

  /**
   * Load maintenance windows from database
   */
  private async loadMaintenanceWindows(): Promise<void> {
    try {
      const now = new Date();
      const { data: windows } = await supabase
        .from('maintenance_windows')
        .select('*')
        .eq('enabled', true)
        .gte('end_time', now.toISOString());

      if (windows) {
        windows.forEach(window => this.maintenanceWindows.set(window.id, window));
      }
    } catch (error) {
      console.error('Error loading maintenance windows:', error);
    }
  }

  /**
   * Start cleanup timer for expired data
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredData();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Clean up expired data
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const expiryTime = 2 * 60 * 60 * 1000; // 2 hours

    // Clean up alert groups
    for (const [key, group] of this.alertGroups.entries()) {
      const groupAge = now - new Date(group.firstAlert.created_at).getTime();
      if (groupAge > expiryTime) {
        this.alertGroups.delete(key);
      }
    }

    // Clean up suppression cache
    this.suppressionCache.clear();

    console.log(`🧹 Cleaned up expired suppression data`);
  }

  /**
   * Get suppression statistics
   */
  getSuppressionStatistics(): {
    activeGroups: number;
    cacheSize: number;
    suppressionRules: number;
    maintenanceWindows: number;
  } {
    return {
      activeGroups: this.alertGroups.size,
      cacheSize: this.suppressionCache.size,
      suppressionRules: this.suppressionRules.size,
      maintenanceWindows: this.maintenanceWindows.size
    };
  }
}

// Export singleton instance
export const alertSuppressionManager = new AlertSuppressionManager();
