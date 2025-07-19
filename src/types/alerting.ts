/**
 * TypeScript types for the comprehensive alerting system
 * Corresponds to the database schema in 20250718000000_create_alerting_system.sql
 */

// Enums matching database types
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed' | 'expired';
export type AlertConditionType = 'threshold' | 'percentage' | 'rate' | 'count' | 'duration' | 'custom';
export type NotificationChannelType = 'email' | 'push' | 'webhook' | 'slack' | 'sms' | 'in_app';

// Alert Rule Configuration
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  
  // Rule configuration
  metric_name: string;
  metric_source: string;
  condition_type: AlertConditionType;
  
  // Threshold configuration
  threshold_value: number;
  threshold_operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
  threshold_unit?: string;
  
  // Time-based conditions
  evaluation_window_minutes: number;
  evaluation_frequency_minutes: number;
  consecutive_failures_required: number;
  
  // Alert configuration
  severity: AlertSeverity;
  enabled: boolean;
  
  // Suppression and rate limiting
  cooldown_minutes: number;
  max_alerts_per_hour: number;
  auto_resolve_minutes?: number;
  
  // Metadata
  tags: Record<string, any>;
  custom_conditions: Record<string, any>;
  
  // Ownership
  created_by?: string;
  team_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_evaluated_at?: string;
}

// Notification Channel Configuration
export interface NotificationChannel {
  id: string;
  name: string;
  description?: string;
  
  // Channel configuration
  channel_type: NotificationChannelType;
  enabled: boolean;
  
  // Channel-specific configuration
  configuration: Record<string, any>;
  
  // Rate limiting
  max_notifications_per_hour: number;
  max_notifications_per_day: number;
  
  // Ownership
  created_by?: string;
  team_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Escalation Policy Configuration
export interface AlertEscalationPolicy {
  id: string;
  name: string;
  description?: string;
  
  // Escalation configuration
  escalation_rules: EscalationRule[];
  
  // Default timing
  initial_delay_minutes: number;
  escalation_interval_minutes: number;
  max_escalation_level: number;
  
  // Ownership
  created_by?: string;
  team_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Escalation Rule Structure
export interface EscalationRule {
  level: number;
  delay_minutes: number;
  notification_channels: string[]; // Channel IDs
  conditions?: {
    severity_filter?: AlertSeverity[];
    time_of_day?: {
      start: string; // HH:MM
      end: string;   // HH:MM
    };
    days_of_week?: number[]; // 0-6, Sunday = 0
  };
}

// Alert Rule to Channel Mapping
export interface AlertRuleChannel {
  id: string;
  alert_rule_id: string;
  notification_channel_id: string;
  escalation_policy_id?: string;
  
  // Channel-specific overrides
  severity_filter?: AlertSeverity[];
  enabled: boolean;
  
  // Timestamps
  created_at: string;
}

// Active Alert
export interface Alert {
  id: string;
  alert_rule_id: string;
  
  // Alert details
  title: string;
  description?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  
  // Metric information
  metric_name: string;
  metric_value?: number;
  threshold_value?: number;
  threshold_operator?: string;
  
  // Context and metadata
  context: Record<string, any>;
  tags: Record<string, any>;
  
  // Status tracking
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  suppressed_until?: string;
  
  // Escalation tracking
  escalation_level: number;
  last_escalated_at?: string;
  next_escalation_at?: string;
  
  // Ownership
  team_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at?: string;
  
  // Joined data
  alert_rule?: AlertRule;
  acknowledged_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
  resolved_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// Alert History Event
export interface AlertHistoryEvent {
  id: string;
  alert_id: string;
  
  // Event details
  event_type: 'created' | 'acknowledged' | 'resolved' | 'escalated' | 'suppressed' | 'expired';
  event_description?: string;
  
  // Status changes
  previous_status?: AlertStatus;
  new_status?: AlertStatus;
  performed_by?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  created_at: string;
  
  // Joined data
  performed_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// Alert Notification Delivery
export interface AlertNotification {
  id: string;
  alert_id: string;
  notification_channel_id: string;
  
  // Delivery details
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';
  delivery_attempt: number;
  max_delivery_attempts: number;
  
  // Content
  subject?: string;
  message?: string;
  
  // Delivery tracking
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;
  
  // External tracking
  external_message_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data
  alert?: Alert;
  notification_channel?: NotificationChannel;
}

// Alert Statistics
export interface AlertStatistics {
  total_alerts: number;
  active_alerts: number;
  acknowledged_alerts: number;
  resolved_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  avg_resolution_time_minutes?: number;
}

// Alert Filters for queries
export interface AlertFilters {
  team_id?: string;
  status?: AlertStatus | AlertStatus[];
  severity?: AlertSeverity | AlertSeverity[];
  metric_name?: string;
  alert_rule_id?: string;
  date_from?: string;
  date_to?: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

// Channel Configuration Types
export interface EmailChannelConfig {
  recipients: string[];
  subject_template?: string;
  body_template?: string;
}

export interface WebhookChannelConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  payload_template?: string;
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    api_key_header?: string;
    api_key_value?: string;
  };
}

export interface SlackChannelConfig {
  webhook_url: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  message_template?: string;
}

export interface SMSChannelConfig {
  phone_numbers: string[];
  provider: 'twilio' | 'aws_sns';
  provider_config: Record<string, any>;
  message_template?: string;
}

// Union type for all channel configurations
export type ChannelConfiguration = 
  | EmailChannelConfig 
  | WebhookChannelConfig 
  | SlackChannelConfig 
  | SMSChannelConfig 
  | Record<string, any>;
