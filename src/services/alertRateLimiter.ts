/**
 * Alert Rate Limiter
 * Advanced rate limiting system for alerts with multiple scopes and adaptive limits
 * Task 6: Implement Alert Suppression and Rate Limiting - Rate Limiting
 */

import { supabase } from '@/lib/supabase';
import { Alert, AlertRule, AlertSeverity } from '@/types/alerting';

interface RateLimitConfig {
  id: string;
  limitType: 'rule' | 'team' | 'metric' | 'severity' | 'global';
  scope: string; // rule_id, team_id, metric_name, severity, or 'global'
  maxAlerts: number;
  windowMinutes: number;
  currentCount: number;
  windowStart: Date;
  nextResetAt: Date;
  enabled: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  reason: string;
  currentCount: number;
  maxAllowed: number;
  windowMinutes: number;
  resetAt: Date;
  retryAfter?: number; // seconds
  metadata?: Record<string, any>;
}

interface AdaptiveRateLimit {
  baseLimit: number;
  currentLimit: number;
  adaptationFactor: number;
  lastAdjustment: Date;
  errorRate: number;
  loadFactor: number;
}

export class AlertRateLimiter {
  private readonly rateLimits: Map<string, RateLimitConfig> = new Map();
  private readonly adaptiveLimits: Map<string, AdaptiveRateLimit> = new Map();
  private readonly recentAlerts: Map<string, Date[]> = new Map();

  // Default rate limits by severity
  private readonly defaultLimits = {
    critical: { maxAlerts: 10, windowMinutes: 60 },
    high: { maxAlerts: 20, windowMinutes: 60 },
    medium: { maxAlerts: 50, windowMinutes: 60 },
    low: { maxAlerts: 100, windowMinutes: 60 },
    info: { maxAlerts: 200, windowMinutes: 60 }
  };

  constructor() {
    this.loadRateLimits();
    this.startCleanupTimer();
    this.startAdaptiveAdjustmentTimer();
  }

  /**
   * Check if alert should be rate limited
   */
  async checkRateLimit(alert: Alert, rule: AlertRule): Promise<RateLimitResult> {
    try {
      console.log(`🚦 Checking rate limits for alert: ${alert.title} (${alert.id})`);

      // Check multiple rate limit scopes in order of specificity
      const checks = [
        () => this.checkRuleRateLimit(alert, rule),
        () => this.checkTeamRateLimit(alert),
        () => this.checkMetricRateLimit(alert),
        () => this.checkSeverityRateLimit(alert),
        () => this.checkGlobalRateLimit(alert)
      ];

      for (const check of checks) {
        const result = await check();
        if (!result.allowed) {
          await this.logRateLimitHit(alert, result);
          return result;
        }
      }

      // All checks passed - update counters
      await this.updateRateLimitCounters(alert, rule);

      return {
        allowed: true,
        reason: 'rate_limit_passed',
        currentCount: 0,
        maxAllowed: 0,
        windowMinutes: 0,
        resetAt: new Date()
      };

    } catch (error) {
      console.error(`Error checking rate limits for alert ${alert.id}:`, error);
      // Allow alert on error to prevent blocking critical alerts
      return {
        allowed: true,
        reason: 'rate_limit_error',
        currentCount: 0,
        maxAllowed: 0,
        windowMinutes: 0,
        resetAt: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check rule-specific rate limit
   */
  private async checkRuleRateLimit(alert: Alert, rule: AlertRule): Promise<RateLimitResult> {
    const limitKey = `rule:${rule.id}`;
    const config = this.rateLimits.get(limitKey) || await this.createRuleRateLimit(rule);

    return this.evaluateRateLimit(config, alert, 'rule_rate_limit');
  }

  /**
   * Check team-specific rate limit
   */
  private async checkTeamRateLimit(alert: Alert): Promise<RateLimitResult> {
    if (!alert.team_id) {
      return { allowed: true, reason: 'no_team', currentCount: 0, maxAllowed: 0, windowMinutes: 0, resetAt: new Date() };
    }

    const limitKey = `team:${alert.team_id}`;
    const config = this.rateLimits.get(limitKey) || await this.createTeamRateLimit(alert.team_id);

    return this.evaluateRateLimit(config, alert, 'team_rate_limit');
  }

  /**
   * Check metric-specific rate limit
   */
  private async checkMetricRateLimit(alert: Alert): Promise<RateLimitResult> {
    const limitKey = `metric:${alert.metric_name}`;
    const config = this.rateLimits.get(limitKey) || await this.createMetricRateLimit(alert.metric_name);

    return this.evaluateRateLimit(config, alert, 'metric_rate_limit');
  }

  /**
   * Check severity-specific rate limit
   */
  private async checkSeverityRateLimit(alert: Alert): Promise<RateLimitResult> {
    const limitKey = `severity:${alert.severity}`;
    const config = this.rateLimits.get(limitKey) || await this.createSeverityRateLimit(alert.severity);

    return this.evaluateRateLimit(config, alert, 'severity_rate_limit');
  }

  /**
   * Check global rate limit
   */
  private async checkGlobalRateLimit(alert: Alert): Promise<RateLimitResult> {
    const limitKey = 'global';
    const config = this.rateLimits.get(limitKey) || await this.createGlobalRateLimit();

    return this.evaluateRateLimit(config, alert, 'global_rate_limit');
  }

  /**
   * Evaluate rate limit against configuration
   */
  private async evaluateRateLimit(
    config: RateLimitConfig, 
    alert: Alert, 
    limitType: string
  ): Promise<RateLimitResult> {
    const now = new Date();

    // Check if window has expired
    if (now >= config.nextResetAt) {
      await this.resetRateLimitWindow(config);
    }

    // Apply adaptive rate limiting
    const adaptiveLimit = this.getAdaptiveLimit(config);
    const effectiveLimit = Math.min(config.maxAlerts, adaptiveLimit);

    if (config.currentCount >= effectiveLimit) {
      const retryAfter = Math.ceil((config.nextResetAt.getTime() - now.getTime()) / 1000);

      return {
        allowed: false,
        reason: limitType,
        currentCount: config.currentCount,
        maxAllowed: effectiveLimit,
        windowMinutes: config.windowMinutes,
        resetAt: config.nextResetAt,
        retryAfter,
        metadata: {
          limitType: config.limitType,
          scope: config.scope,
          adaptiveLimit,
          originalLimit: config.maxAlerts
        }
      };
    }

    return {
      allowed: true,
      reason: `${limitType}_passed`,
      currentCount: config.currentCount,
      maxAllowed: effectiveLimit,
      windowMinutes: config.windowMinutes,
      resetAt: config.nextResetAt
    };
  }

  /**
   * Get adaptive rate limit based on system load and error rates
   */
  private getAdaptiveLimit(config: RateLimitConfig): number {
    const adaptiveKey = `${config.limitType}:${config.scope}`;
    const adaptive = this.adaptiveLimits.get(adaptiveKey);

    if (!adaptive) {
      // Initialize adaptive limit
      this.adaptiveLimits.set(adaptiveKey, {
        baseLimit: config.maxAlerts,
        currentLimit: config.maxAlerts,
        adaptationFactor: 1.0,
        lastAdjustment: new Date(),
        errorRate: 0,
        loadFactor: 1.0
      });
      return config.maxAlerts;
    }

    return Math.floor(adaptive.currentLimit);
  }

  /**
   * Create rule-specific rate limit
   */
  private async createRuleRateLimit(rule: AlertRule): Promise<RateLimitConfig> {
    const config: RateLimitConfig = {
      id: `rule:${rule.id}`,
      limitType: 'rule',
      scope: rule.id,
      maxAlerts: rule.max_alerts_per_hour,
      windowMinutes: 60,
      currentCount: 0,
      windowStart: new Date(),
      nextResetAt: new Date(Date.now() + 60 * 60 * 1000),
      enabled: true
    };

    this.rateLimits.set(config.id, config);
    await this.persistRateLimit(config);
    return config;
  }

  /**
   * Create team-specific rate limit
   */
  private async createTeamRateLimit(teamId: string): Promise<RateLimitConfig> {
    const config: RateLimitConfig = {
      id: `team:${teamId}`,
      limitType: 'team',
      scope: teamId,
      maxAlerts: 500, // Default team limit
      windowMinutes: 60,
      currentCount: 0,
      windowStart: new Date(),
      nextResetAt: new Date(Date.now() + 60 * 60 * 1000),
      enabled: true
    };

    this.rateLimits.set(config.id, config);
    await this.persistRateLimit(config);
    return config;
  }

  /**
   * Create metric-specific rate limit
   */
  private async createMetricRateLimit(metricName: string): Promise<RateLimitConfig> {
    const config: RateLimitConfig = {
      id: `metric:${metricName}`,
      limitType: 'metric',
      scope: metricName,
      maxAlerts: 100, // Default metric limit
      windowMinutes: 60,
      currentCount: 0,
      windowStart: new Date(),
      nextResetAt: new Date(Date.now() + 60 * 60 * 1000),
      enabled: true
    };

    this.rateLimits.set(config.id, config);
    await this.persistRateLimit(config);
    return config;
  }

  /**
   * Create severity-specific rate limit
   */
  private async createSeverityRateLimit(severity: AlertSeverity): Promise<RateLimitConfig> {
    const defaultLimit = this.defaultLimits[severity];
    
    const config: RateLimitConfig = {
      id: `severity:${severity}`,
      limitType: 'severity',
      scope: severity,
      maxAlerts: defaultLimit.maxAlerts,
      windowMinutes: defaultLimit.windowMinutes,
      currentCount: 0,
      windowStart: new Date(),
      nextResetAt: new Date(Date.now() + defaultLimit.windowMinutes * 60 * 1000),
      enabled: true
    };

    this.rateLimits.set(config.id, config);
    await this.persistRateLimit(config);
    return config;
  }

  /**
   * Create global rate limit
   */
  private async createGlobalRateLimit(): Promise<RateLimitConfig> {
    const config: RateLimitConfig = {
      id: 'global',
      limitType: 'global',
      scope: 'global',
      maxAlerts: 1000, // Global system limit
      windowMinutes: 60,
      currentCount: 0,
      windowStart: new Date(),
      nextResetAt: new Date(Date.now() + 60 * 60 * 1000),
      enabled: true
    };

    this.rateLimits.set(config.id, config);
    await this.persistRateLimit(config);
    return config;
  }

  /**
   * Update rate limit counters after allowing an alert
   */
  private async updateRateLimitCounters(alert: Alert, rule: AlertRule): Promise<void> {
    const updates = [
      `rule:${rule.id}`,
      alert.team_id ? `team:${alert.team_id}` : null,
      `metric:${alert.metric_name}`,
      `severity:${alert.severity}`,
      'global'
    ].filter(Boolean) as string[];

    for (const limitKey of updates) {
      const config = this.rateLimits.get(limitKey);
      if (config) {
        config.currentCount++;
        await this.persistRateLimit(config);
      }
    }
  }

  /**
   * Reset rate limit window
   */
  private async resetRateLimitWindow(config: RateLimitConfig): Promise<void> {
    const now = new Date();
    config.currentCount = 0;
    config.windowStart = now;
    config.nextResetAt = new Date(now.getTime() + config.windowMinutes * 60 * 1000);

    await this.persistRateLimit(config);
    console.log(`🔄 Reset rate limit window for ${config.id}`);
  }

  /**
   * Persist rate limit to database
   */
  private async persistRateLimit(config: RateLimitConfig): Promise<void> {
    try {
      const { error } = await supabase
        .from('alert_rate_limits')
        .upsert({
          id: config.id,
          alert_rule_id: config.limitType === 'rule' ? config.scope : null,
          team_id: config.limitType === 'team' ? config.scope : null,
          metric_name: config.limitType === 'metric' ? config.scope : null,
          severity: config.limitType === 'severity' ? config.scope as AlertSeverity : null,
          limit_type: config.limitType,
          max_alerts: config.maxAlerts,
          window_minutes: config.windowMinutes,
          current_count: config.currentCount,
          window_start: config.windowStart.toISOString(),
          next_reset_at: config.nextResetAt.toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error persisting rate limit:', error);
      }
    } catch (error) {
      console.error('Error in persistRateLimit:', error);
    }
  }

  /**
   * Load rate limits from database
   */
  private async loadRateLimits(): Promise<void> {
    try {
      const { data: rateLimits, error } = await supabase
        .from('alert_rate_limits')
        .select('*');

      if (error) {
        console.error('Error loading rate limits:', error);
        return;
      }

      if (rateLimits) {
        rateLimits.forEach(limit => {
          const config: RateLimitConfig = {
            id: limit.id,
            limitType: limit.limit_type,
            scope: limit.alert_rule_id || limit.team_id || limit.metric_name || limit.severity || 'global',
            maxAlerts: limit.max_alerts,
            windowMinutes: limit.window_minutes,
            currentCount: limit.current_count,
            windowStart: new Date(limit.window_start),
            nextResetAt: new Date(limit.next_reset_at),
            enabled: true
          };

          this.rateLimits.set(config.id, config);
        });
      }

      console.log(`📊 Loaded ${rateLimits?.length || 0} rate limit configurations`);
    } catch (error) {
      console.error('Error in loadRateLimits:', error);
    }
  }

  /**
   * Log rate limit hit
   */
  private async logRateLimitHit(alert: Alert, result: RateLimitResult): Promise<void> {
    try {
      await supabase
        .from('alert_suppression_log')
        .insert({
          alert_id: alert.id,
          suppressed: true,
          reason: result.reason,
          suppress_until: result.resetAt.toISOString(),
          metadata: {
            rate_limit_type: result.metadata?.limitType,
            current_count: result.currentCount,
            max_allowed: result.maxAllowed,
            window_minutes: result.windowMinutes,
            retry_after_seconds: result.retryAfter
          }
        });
    } catch (error) {
      console.error('Error logging rate limit hit:', error);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredLimits();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Start adaptive adjustment timer
   */
  private startAdaptiveAdjustmentTimer(): void {
    setInterval(() => {
      this.adjustAdaptiveLimits();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up expired rate limits
   */
  private cleanupExpiredLimits(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, config] of this.rateLimits.entries()) {
      if (now >= config.nextResetAt) {
        config.currentCount = 0;
        config.windowStart = now;
        config.nextResetAt = new Date(now.getTime() + config.windowMinutes * 60 * 1000);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired rate limit windows`);
    }
  }

  /**
   * Adjust adaptive rate limits based on system performance
   */
  private adjustAdaptiveLimits(): void {
    for (const [key, adaptive] of this.adaptiveLimits.entries()) {
      const timeSinceLastAdjustment = Date.now() - adaptive.lastAdjustment.getTime();
      
      // Only adjust every 10 minutes minimum
      if (timeSinceLastAdjustment < 10 * 60 * 1000) continue;

      // Adjust based on error rate and load
      let adjustmentFactor = 1.0;

      if (adaptive.errorRate > 0.1) { // High error rate
        adjustmentFactor = 0.8; // Reduce limits
      } else if (adaptive.errorRate < 0.01 && adaptive.loadFactor < 0.5) { // Low error rate and load
        adjustmentFactor = 1.1; // Increase limits
      }

      adaptive.currentLimit = Math.max(
        adaptive.baseLimit * 0.1, // Never go below 10% of base
        Math.min(
          adaptive.baseLimit * 2, // Never go above 200% of base
          adaptive.currentLimit * adjustmentFactor
        )
      );

      adaptive.adaptationFactor = adjustmentFactor;
      adaptive.lastAdjustment = new Date();
    }
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitingStatistics(): {
    totalLimits: number;
    activeLimits: number;
    adaptiveLimits: number;
    recentHits: number;
  } {
    const now = new Date();
    const activeLimits = Array.from(this.rateLimits.values()).filter(
      config => config.currentCount > 0 && now < config.nextResetAt
    ).length;

    return {
      totalLimits: this.rateLimits.size,
      activeLimits,
      adaptiveLimits: this.adaptiveLimits.size,
      recentHits: 0 // Would be calculated from recent logs
    };
  }

  /**
   * Update rate limit configuration
   */
  async updateRateLimit(
    limitId: string, 
    updates: Partial<Pick<RateLimitConfig, 'maxAlerts' | 'windowMinutes' | 'enabled'>>
  ): Promise<void> {
    const config = this.rateLimits.get(limitId);
    if (!config) {
      throw new Error(`Rate limit configuration not found: ${limitId}`);
    }

    Object.assign(config, updates);
    await this.persistRateLimit(config);
  }
}

// Export singleton instance
export const alertRateLimiter = new AlertRateLimiter();
