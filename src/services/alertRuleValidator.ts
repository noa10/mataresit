/**
 * Alert Rule Validator and Testing Service
 * Validates alert rule configurations and provides testing capabilities
 * Task 5: Develop Configurable Alert Rules Interface - Validation & Testing
 */

import { supabase } from '@/lib/supabase';
import { AlertRule, AlertSeverity, NotificationChannel } from '@/types/alerting';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface TestResult {
  success: boolean;
  message: string;
  details: {
    wouldTrigger: boolean;
    currentValue?: number;
    thresholdValue: number;
    operator: string;
    evaluationTime: Date;
    nextEvaluation?: Date;
    estimatedNotifications?: number;
  };
  simulatedAlert?: {
    title: string;
    description: string;
    severity: AlertSeverity;
    metric_name: string;
    metric_value: number;
    context: Record<string, any>;
  };
}

interface MetricValue {
  metric_name: string;
  value: number;
  timestamp: Date;
  source: string;
  tags?: Record<string, any>;
}

export class AlertRuleValidator {
  /**
   * Validate alert rule configuration
   */
  validateRule(rule: Partial<AlertRule>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    } else if (rule.name.length > 255) {
      errors.push('Rule name must be 255 characters or less');
    }

    if (!rule.metric_name?.trim()) {
      errors.push('Metric name is required');
    }

    if (!rule.metric_source) {
      errors.push('Metric source is required');
    }

    if (!rule.condition_type) {
      errors.push('Condition type is required');
    }

    if (rule.threshold_value === undefined || rule.threshold_value === null) {
      errors.push('Threshold value is required');
    } else if (rule.threshold_value < 0) {
      warnings.push('Negative threshold values may not be meaningful for most metrics');
    }

    if (!rule.threshold_operator) {
      errors.push('Threshold operator is required');
    }

    if (!rule.severity) {
      errors.push('Severity level is required');
    }

    // Timing validation
    if (!rule.evaluation_window_minutes || rule.evaluation_window_minutes < 1) {
      errors.push('Evaluation window must be at least 1 minute');
    } else if (rule.evaluation_window_minutes > 1440) {
      warnings.push('Evaluation window longer than 24 hours may cause performance issues');
    }

    if (!rule.evaluation_frequency_minutes || rule.evaluation_frequency_minutes < 1) {
      errors.push('Evaluation frequency must be at least 1 minute');
    } else if (rule.evaluation_frequency_minutes > rule.evaluation_window_minutes!) {
      warnings.push('Evaluation frequency should typically be less than or equal to the evaluation window');
    }

    if (!rule.consecutive_failures_required || rule.consecutive_failures_required < 1) {
      errors.push('Consecutive failures required must be at least 1');
    } else if (rule.consecutive_failures_required > 10) {
      warnings.push('High consecutive failure requirements may delay alert detection');
    }

    // Rate limiting validation
    if (!rule.max_alerts_per_hour || rule.max_alerts_per_hour < 1) {
      errors.push('Max alerts per hour must be at least 1');
    } else if (rule.max_alerts_per_hour > 100) {
      warnings.push('High alert rate limits may cause notification spam');
    }

    if (rule.cooldown_minutes !== undefined && rule.cooldown_minutes < 0) {
      errors.push('Cooldown period cannot be negative');
    }

    // Severity-specific validation
    if (rule.severity) {
      this.validateSeverityConfiguration(rule, errors, warnings, suggestions);
    }

    // Condition-specific validation
    if (rule.condition_type) {
      this.validateConditionConfiguration(rule, errors, warnings, suggestions);
    }

    // Auto-resolution validation
    if (rule.auto_resolve_minutes !== undefined) {
      if (rule.auto_resolve_minutes < 1) {
        errors.push('Auto-resolve time must be at least 1 minute');
      } else if (rule.auto_resolve_minutes < (rule.cooldown_minutes || 0)) {
        warnings.push('Auto-resolve time should typically be longer than cooldown period');
      }
    }

    // Performance suggestions
    if (rule.evaluation_frequency_minutes && rule.evaluation_frequency_minutes < 5) {
      suggestions.push('Consider increasing evaluation frequency to reduce system load');
    }

    if (rule.severity === 'info' && rule.max_alerts_per_hour! > 10) {
      suggestions.push('Consider lower alert rates for info-level alerts to reduce noise');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate severity-specific configuration
   */
  private validateSeverityConfiguration(
    rule: Partial<AlertRule>,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const severity = rule.severity!;

    // Severity-specific timing recommendations
    switch (severity) {
      case 'critical':
        if (rule.evaluation_frequency_minutes! > 5) {
          warnings.push('Critical alerts should typically be evaluated every 1-5 minutes');
        }
        if (rule.cooldown_minutes! > 30) {
          warnings.push('Critical alerts should have short cooldown periods (≤30 minutes)');
        }
        if (rule.consecutive_failures_required! > 2) {
          warnings.push('Critical alerts should trigger quickly (≤2 consecutive failures)');
        }
        break;

      case 'high':
        if (rule.evaluation_frequency_minutes! > 10) {
          warnings.push('High severity alerts should be evaluated frequently (≤10 minutes)');
        }
        if (rule.consecutive_failures_required! > 3) {
          warnings.push('High severity alerts should trigger relatively quickly (≤3 consecutive failures)');
        }
        break;

      case 'low':
      case 'info':
        if (rule.evaluation_frequency_minutes! < 15) {
          suggestions.push('Low/info alerts can use longer evaluation frequencies to reduce load');
        }
        if (!rule.auto_resolve_minutes) {
          suggestions.push('Consider enabling auto-resolution for low/info alerts');
        }
        break;
    }
  }

  /**
   * Validate condition-specific configuration
   */
  private validateConditionConfiguration(
    rule: Partial<AlertRule>,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const conditionType = rule.condition_type!;
    const operator = rule.threshold_operator;
    const value = rule.threshold_value;

    switch (conditionType) {
      case 'percentage':
        if (value! < 0 || value! > 100) {
          errors.push('Percentage values must be between 0 and 100');
        }
        if (rule.threshold_unit && rule.threshold_unit !== '%') {
          warnings.push('Percentage conditions should use "%" as the unit');
        }
        break;

      case 'rate':
        if (operator === '=' || operator === '!=') {
          warnings.push('Equality operators may not be suitable for rate-based conditions');
        }
        break;

      case 'count':
        if (value! < 0) {
          errors.push('Count values cannot be negative');
        }
        if (value! !== Math.floor(value!)) {
          warnings.push('Count values should typically be whole numbers');
        }
        break;

      case 'duration':
        if (value! < 0) {
          errors.push('Duration values cannot be negative');
        }
        if (!rule.threshold_unit) {
          suggestions.push('Consider specifying a unit for duration conditions (e.g., "ms", "s", "m")');
        }
        break;
    }
  }

  /**
   * Test alert rule against current metrics
   */
  async testRule(rule: Partial<AlertRule>): Promise<TestResult> {
    try {
      // First validate the rule
      const validation = this.validateRule(rule);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Rule validation failed: ${validation.errors.join(', ')}`,
          details: {
            wouldTrigger: false,
            thresholdValue: rule.threshold_value || 0,
            operator: rule.threshold_operator || '>',
            evaluationTime: new Date()
          }
        };
      }

      // Get current metric value
      const currentValue = await this.getCurrentMetricValue(
        rule.metric_name!,
        rule.metric_source!,
        rule.evaluation_window_minutes || 5
      );

      if (currentValue === null) {
        return {
          success: false,
          message: `No current data available for metric "${rule.metric_name}" from source "${rule.metric_source}"`,
          details: {
            wouldTrigger: false,
            thresholdValue: rule.threshold_value || 0,
            operator: rule.threshold_operator || '>',
            evaluationTime: new Date()
          }
        };
      }

      // Evaluate condition
      const wouldTrigger = this.evaluateCondition(
        currentValue,
        rule.threshold_operator!,
        rule.threshold_value!
      );

      // Calculate next evaluation time
      const nextEvaluation = new Date();
      nextEvaluation.setMinutes(nextEvaluation.getMinutes() + (rule.evaluation_frequency_minutes || 5));

      // Estimate notification count
      const estimatedNotifications = this.estimateNotificationCount(rule, wouldTrigger);

      // Create simulated alert if would trigger
      let simulatedAlert;
      if (wouldTrigger) {
        simulatedAlert = {
          title: `${rule.name} - Test Alert`,
          description: `Metric ${rule.metric_name} is ${currentValue} ${rule.threshold_operator} ${rule.threshold_value}`,
          severity: rule.severity!,
          metric_name: rule.metric_name!,
          metric_value: currentValue,
          context: {
            test_mode: true,
            evaluation_window: rule.evaluation_window_minutes,
            threshold_operator: rule.threshold_operator,
            threshold_value: rule.threshold_value
          }
        };
      }

      return {
        success: true,
        message: wouldTrigger 
          ? `Alert would trigger! Current value ${currentValue} ${rule.threshold_operator} ${rule.threshold_value}`
          : `Alert would not trigger. Current value ${currentValue} does not meet condition ${rule.threshold_operator} ${rule.threshold_value}`,
        details: {
          wouldTrigger,
          currentValue,
          thresholdValue: rule.threshold_value!,
          operator: rule.threshold_operator!,
          evaluationTime: new Date(),
          nextEvaluation,
          estimatedNotifications
        },
        simulatedAlert
      };

    } catch (error) {
      console.error('Error testing alert rule:', error);
      return {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          wouldTrigger: false,
          thresholdValue: rule.threshold_value || 0,
          operator: rule.threshold_operator || '>',
          evaluationTime: new Date()
        }
      };
    }
  }

  /**
   * Get current metric value from the specified source
   */
  private async getCurrentMetricValue(
    metricName: string,
    metricSource: string,
    windowMinutes: number
  ): Promise<number | null> {
    try {
      const since = new Date();
      since.setMinutes(since.getMinutes() - windowMinutes);

      // This would query the appropriate metrics table based on source
      let tableName: string;
      switch (metricSource) {
        case 'embedding_metrics':
          tableName = 'embedding_metrics';
          break;
        case 'performance_metrics':
          tableName = 'performance_metrics';
          break;
        case 'system_health':
          tableName = 'system_health_metrics';
          break;
        case 'notification_metrics':
          tableName = 'notification_metrics';
          break;
        default:
          throw new Error(`Unknown metric source: ${metricSource}`);
      }

      // For now, return a simulated value
      // In a real implementation, this would query the actual metrics
      const simulatedValues: Record<string, number> = {
        'error_rate': Math.random() * 10,
        'response_time': Math.random() * 1000,
        'success_rate': 95 + Math.random() * 5,
        'throughput': Math.random() * 100,
        'cpu_usage': Math.random() * 100,
        'memory_usage': Math.random() * 100,
        'disk_usage': Math.random() * 100,
        'notification_delivery_rate': 90 + Math.random() * 10,
        'embedding_generation_time': Math.random() * 500
      };

      return simulatedValues[metricName] || Math.random() * 100;

    } catch (error) {
      console.error('Error fetching metric value:', error);
      return null;
    }
  }

  /**
   * Evaluate condition against current value
   */
  private evaluateCondition(
    currentValue: number,
    operator: string,
    thresholdValue: number
  ): boolean {
    switch (operator) {
      case '>':
        return currentValue > thresholdValue;
      case '<':
        return currentValue < thresholdValue;
      case '>=':
        return currentValue >= thresholdValue;
      case '<=':
        return currentValue <= thresholdValue;
      case '=':
        return Math.abs(currentValue - thresholdValue) < 0.001; // Float comparison
      case '!=':
        return Math.abs(currentValue - thresholdValue) >= 0.001;
      default:
        return false;
    }
  }

  /**
   * Estimate notification count based on rule configuration
   */
  private estimateNotificationCount(rule: Partial<AlertRule>, wouldTrigger: boolean): number {
    if (!wouldTrigger) return 0;

    // Base notification count (immediate notification)
    let count = 1;

    // Add escalation notifications
    const escalationLevels = 3; // Default escalation levels
    const escalationInterval = 30; // Default 30 minutes
    const maxAlertsPerHour = rule.max_alerts_per_hour || 10;

    // Estimate escalations within first hour
    const escalationsInHour = Math.min(
      Math.floor(60 / escalationInterval),
      escalationLevels,
      maxAlertsPerHour - 1
    );

    count += escalationsInHour;

    return count;
  }

  /**
   * Validate notification channel configuration
   */
  validateChannelConfiguration(
    channelType: string,
    configuration: Record<string, any>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    switch (channelType) {
      case 'email':
        if (!configuration.recipients || !Array.isArray(configuration.recipients) || configuration.recipients.length === 0) {
          errors.push('Email recipients are required');
        } else {
          configuration.recipients.forEach((email: string, index: number) => {
            if (!this.isValidEmail(email)) {
              errors.push(`Invalid email address at position ${index + 1}: ${email}`);
            }
          });
        }
        break;

      case 'webhook':
        if (!configuration.url) {
          errors.push('Webhook URL is required');
        } else if (!this.isValidUrl(configuration.url)) {
          errors.push('Invalid webhook URL format');
        }
        
        if (!configuration.method || !['POST', 'PUT', 'PATCH'].includes(configuration.method)) {
          errors.push('Valid HTTP method is required (POST, PUT, or PATCH)');
        }
        break;

      case 'slack':
        if (!configuration.webhook_url) {
          errors.push('Slack webhook URL is required');
        } else if (!configuration.webhook_url.includes('hooks.slack.com')) {
          warnings.push('URL does not appear to be a valid Slack webhook URL');
        }
        break;

      case 'sms':
        if (!configuration.phone_numbers || !Array.isArray(configuration.phone_numbers) || configuration.phone_numbers.length === 0) {
          errors.push('Phone numbers are required');
        } else {
          configuration.phone_numbers.forEach((phone: string, index: number) => {
            if (!this.isValidPhoneNumber(phone)) {
              errors.push(`Invalid phone number at position ${index + 1}: ${phone}`);
            }
          });
        }
        
        if (!configuration.provider || !['twilio', 'aws_sns'].includes(configuration.provider)) {
          errors.push('Valid SMS provider is required (twilio or aws_sns)');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number format (basic validation)
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }
}

// Export singleton instance
export const alertRuleValidator = new AlertRuleValidator();
