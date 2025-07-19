/**
 * Comprehensive Alerting Service
 * Handles alert rule management, evaluation, and notification delivery
 * Task 1: Design Alert Configuration Schema and Database Structure - Implementation
 */

import { supabase } from '@/lib/supabase';
import { 
  AlertRule, 
  Alert, 
  AlertStatistics, 
  AlertFilters, 
  NotificationChannel,
  AlertEscalationPolicy,
  AlertHistoryEvent,
  AlertNotification,
  AlertSeverity,
  AlertStatus
} from '@/types/alerting';

export class AlertingService {
  /**
   * Alert Rule Management
   */
  
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): Promise<AlertRule> {
    const { data, error } = await supabase
      .from('alert_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create alert rule: ${error.message}`);
    }

    return data;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const { data, error } = await supabase
      .from('alert_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update alert rule: ${error.message}`);
    }

    return data;
  }

  async deleteAlertRule(id: string): Promise<void> {
    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete alert rule: ${error.message}`);
    }
  }

  async getAlertRules(teamId?: string): Promise<AlertRule[]> {
    let query = supabase.from('alert_rules').select('*');
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch alert rules: ${error.message}`);
    }

    return data || [];
  }

  async getAlertRule(id: string): Promise<AlertRule | null> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch alert rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Notification Channel Management
   */

  async createNotificationChannel(channel: Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationChannel> {
    const { data, error } = await supabase
      .from('notification_channels')
      .insert(channel)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification channel: ${error.message}`);
    }

    return data;
  }

  async updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel> {
    const { data, error } = await supabase
      .from('notification_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update notification channel: ${error.message}`);
    }

    return data;
  }

  async deleteNotificationChannel(id: string): Promise<void> {
    const { error } = await supabase
      .from('notification_channels')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete notification channel: ${error.message}`);
    }
  }

  async getNotificationChannels(teamId?: string): Promise<NotificationChannel[]> {
    let query = supabase.from('notification_channels').select('*');
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch notification channels: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Alert Management
   */

  async getAlerts(filters: AlertFilters = {}): Promise<Alert[]> {
    let query = supabase
      .from('alerts')
      .select(`
        *,
        alert_rule:alert_rules(*),
        acknowledged_by_user:profiles!alerts_acknowledged_by_fkey(id, email, full_name),
        resolved_by_user:profiles!alerts_resolved_by_fkey(id, email, full_name)
      `);

    // Apply filters
    if (filters.team_id) {
      query = query.eq('team_id', filters.team_id);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        query = query.in('severity', filters.severity);
      } else {
        query = query.eq('severity', filters.severity);
      }
    }

    if (filters.metric_name) {
      query = query.eq('metric_name', filters.metric_name);
    }

    if (filters.alert_rule_id) {
      query = query.eq('alert_rule_id', filters.alert_rule_id);
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (filters.acknowledged !== undefined) {
      if (filters.acknowledged) {
        query = query.not('acknowledged_at', 'is', null);
      } else {
        query = query.is('acknowledged_at', null);
      }
    }

    if (filters.resolved !== undefined) {
      if (filters.resolved) {
        query = query.not('resolved_at', 'is', null);
      } else {
        query = query.is('resolved_at', null);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }

    return data || [];
  }

  async getAlert(id: string): Promise<Alert | null> {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        alert_rule:alert_rules(*),
        acknowledged_by_user:profiles!alerts_acknowledged_by_fkey(id, email, full_name),
        resolved_by_user:profiles!alerts_resolved_by_fkey(id, email, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch alert: ${error.message}`);
    }

    return data;
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('acknowledge_alert', {
      _alert_id: alertId,
      _user_id: user.id
    });

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }

    return data;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('resolve_alert', {
      _alert_id: alertId,
      _user_id: user.id
    });

    if (error) {
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }

    return data;
  }

  async suppressAlert(alertId: string, suppressUntil: Date): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('suppress_alert', {
      _alert_id: alertId,
      _suppress_until: suppressUntil.toISOString(),
      _user_id: user.id
    });

    if (error) {
      throw new Error(`Failed to suppress alert: ${error.message}`);
    }

    return data;
  }

  /**
   * Alert Statistics
   */

  async getAlertStatistics(teamId?: string, hours: number = 24): Promise<AlertStatistics> {
    const { data, error } = await supabase.rpc('get_alert_statistics', {
      _team_id: teamId,
      _hours: hours
    });

    if (error) {
      throw new Error(`Failed to fetch alert statistics: ${error.message}`);
    }

    return data[0] || {
      total_alerts: 0,
      active_alerts: 0,
      acknowledged_alerts: 0,
      resolved_alerts: 0,
      critical_alerts: 0,
      high_alerts: 0,
      medium_alerts: 0,
      low_alerts: 0,
      avg_resolution_time_minutes: 0
    };
  }

  /**
   * Alert Rule Evaluation
   */

  async evaluateAlertRule(ruleId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('evaluate_alert_rule', {
      _rule_id: ruleId
    });

    if (error) {
      throw new Error(`Failed to evaluate alert rule: ${error.message}`);
    }

    return data;
  }

  async evaluateAllAlertRules(teamId?: string): Promise<{ evaluated: number; triggered: number }> {
    const rules = await this.getAlertRules(teamId);
    const enabledRules = rules.filter(rule => rule.enabled);
    
    let triggered = 0;
    
    for (const rule of enabledRules) {
      try {
        const wasTriggered = await this.evaluateAlertRule(rule.id);
        if (wasTriggered) triggered++;
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.name}:`, error);
      }
    }

    return {
      evaluated: enabledRules.length,
      triggered
    };
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
