/**
 * Alert Severity Router
 * Routes alerts to appropriate teams and individuals based on severity and configuration
 * Task 4: Build Alert Escalation and Severity Management - Routing
 */

import { supabase } from '@/lib/supabase';
import { Alert, AlertSeverity } from '@/types/alerting';

interface SeverityRoutingRule {
  id: string;
  team_id: string;
  severity: AlertSeverity;
  assigned_users: string[];
  assigned_channels: string[];
  initial_delay_minutes: number;
  escalation_interval_minutes: number;
  max_escalation_level: number;
  business_hours_only: boolean;
  weekend_escalation: boolean;
  auto_acknowledge_minutes?: number;
  auto_resolve_minutes?: number;
  conditions: Record<string, any>;
  enabled: boolean;
  priority: number;
}

interface OnCallUser {
  user_id: string;
  full_name: string;
  email: string;
  is_primary: boolean;
  schedule_name: string;
  backup_user_id?: string;
}

interface RoutingResult {
  success: boolean;
  assignedUsers: string[];
  assignedChannels: string[];
  routingRule?: SeverityRoutingRule;
  onCallUser?: OnCallUser;
  assignmentReason: string;
  escalationConfig: {
    initialDelay: number;
    escalationInterval: number;
    maxLevel: number;
  };
}

export class AlertSeverityRouter {
  /**
   * Route alert based on severity and team configuration
   */
  async routeAlert(alert: Alert): Promise<RoutingResult> {
    try {
      console.log(`🎯 Routing ${alert.severity} alert: ${alert.title} (${alert.id})`);

      // Get severity routing rules for the team
      const routingRules = await this.getSeverityRoutingRules(alert.team_id, alert.severity);
      
      if (routingRules.length === 0) {
        console.log(`No specific routing rules found for ${alert.severity} alerts in team ${alert.team_id}`);
        return await this.applyDefaultRouting(alert);
      }

      // Apply the highest priority routing rule
      const selectedRule = routingRules[0]; // Already sorted by priority
      console.log(`Applying routing rule: ${selectedRule.id} (priority: ${selectedRule.priority})`);

      // Check if conditions are met
      if (!this.evaluateRoutingConditions(alert, selectedRule)) {
        console.log(`Routing conditions not met for rule ${selectedRule.id}, applying default routing`);
        return await this.applyDefaultRouting(alert);
      }

      // Get on-call user if no specific users assigned
      let onCallUser: OnCallUser | undefined;
      let assignedUsers = selectedRule.assigned_users;

      if (assignedUsers.length === 0) {
        onCallUser = await this.getCurrentOnCallUser(alert.team_id!, alert.severity);
        if (onCallUser) {
          assignedUsers = [onCallUser.user_id];
          if (onCallUser.backup_user_id) {
            assignedUsers.push(onCallUser.backup_user_id);
          }
        }
      }

      // Create alert assignment
      if (assignedUsers.length > 0) {
        await this.createAlertAssignments(alert.id, assignedUsers, 'auto_severity');
      }

      return {
        success: true,
        assignedUsers,
        assignedChannels: selectedRule.assigned_channels,
        routingRule: selectedRule,
        onCallUser,
        assignmentReason: onCallUser ? 'on_call_schedule' : 'severity_routing',
        escalationConfig: {
          initialDelay: selectedRule.initial_delay_minutes,
          escalationInterval: selectedRule.escalation_interval_minutes,
          maxLevel: selectedRule.max_escalation_level
        }
      };

    } catch (error) {
      console.error(`Error routing alert ${alert.id}:`, error);
      return await this.applyDefaultRouting(alert);
    }
  }

  /**
   * Get severity routing rules for a team
   */
  private async getSeverityRoutingRules(teamId?: string, severity?: AlertSeverity): Promise<SeverityRoutingRule[]> {
    if (!teamId || !severity) return [];

    const { data, error } = await supabase
      .from('alert_severity_routing')
      .select('*')
      .eq('team_id', teamId)
      .eq('severity', severity)
      .eq('enabled', true)
      .order('priority', { ascending: true }); // Lower number = higher priority

    if (error) {
      console.error('Error fetching severity routing rules:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Evaluate routing conditions
   */
  private evaluateRoutingConditions(alert: Alert, rule: SeverityRoutingRule): boolean {
    // Check business hours restriction
    if (rule.business_hours_only && !this.isBusinessHours()) {
      return false;
    }

    // Check weekend restriction
    if (!rule.weekend_escalation && this.isWeekend()) {
      return false;
    }

    // Check custom conditions
    if (rule.conditions && Object.keys(rule.conditions).length > 0) {
      return this.evaluateCustomConditions(alert, rule.conditions);
    }

    return true;
  }

  /**
   * Check if current time is business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Simple business hours check (9 AM - 5 PM, Monday-Friday)
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Check if current time is weekend
   */
  private isWeekend(): boolean {
    const dayOfWeek = new Date().getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Evaluate custom routing conditions
   */
  private evaluateCustomConditions(alert: Alert, conditions: Record<string, any>): boolean {
    // Check metric-based conditions
    if (conditions.metric_name && alert.metric_name !== conditions.metric_name) {
      return false;
    }

    if (conditions.metric_value_min && (alert.metric_value || 0) < conditions.metric_value_min) {
      return false;
    }

    if (conditions.metric_value_max && (alert.metric_value || 0) > conditions.metric_value_max) {
      return false;
    }

    // Check tag-based conditions
    if (conditions.required_tags) {
      const requiredTags = conditions.required_tags as string[];
      const alertTags = Object.keys(alert.tags || {});
      
      if (!requiredTags.every(tag => alertTags.includes(tag))) {
        return false;
      }
    }

    // Check context-based conditions
    if (conditions.context_filters) {
      const contextFilters = conditions.context_filters as Record<string, any>;
      
      for (const [key, value] of Object.entries(contextFilters)) {
        if (alert.context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get current on-call user for a team
   */
  private async getCurrentOnCallUser(teamId: string, severity: AlertSeverity): Promise<OnCallUser | undefined> {
    const { data, error } = await supabase.rpc('get_current_on_call_user', {
      _team_id: teamId,
      _severity: severity
    });

    if (error) {
      console.error('Error getting current on-call user:', error);
      return undefined;
    }

    return data && data.length > 0 ? data[0] : undefined;
  }

  /**
   * Apply default routing when no specific rules exist
   */
  private async applyDefaultRouting(alert: Alert): Promise<RoutingResult> {
    console.log(`Applying default routing for ${alert.severity} alert ${alert.id}`);

    // Get team members as fallback
    const teamMembers = await this.getTeamMembers(alert.team_id);
    
    // Filter team members based on role for different severities
    let assignedUsers: string[] = [];
    
    switch (alert.severity) {
      case 'critical':
      case 'high':
        // Assign to owners and admins for high-priority alerts
        assignedUsers = teamMembers
          .filter(member => member.role === 'owner' || member.role === 'admin')
          .map(member => member.user_id);
        break;
      
      case 'medium':
        // Assign to all team members for medium priority
        assignedUsers = teamMembers.map(member => member.user_id);
        break;
      
      case 'low':
      case 'info':
        // Assign to regular members for low priority
        assignedUsers = teamMembers
          .filter(member => member.role === 'member' || member.role === 'admin')
          .map(member => member.user_id)
          .slice(0, 2); // Limit to 2 users
        break;
    }

    // Create assignments if users found
    if (assignedUsers.length > 0) {
      await this.createAlertAssignments(alert.id, assignedUsers, 'default_routing');
    }

    // Get default escalation config based on severity
    const escalationConfig = this.getDefaultEscalationConfig(alert.severity);

    return {
      success: assignedUsers.length > 0,
      assignedUsers,
      assignedChannels: [],
      assignmentReason: 'default_routing',
      escalationConfig
    };
  }

  /**
   * Get team members
   */
  private async getTeamMembers(teamId?: string): Promise<Array<{ user_id: string; role: string }>> {
    if (!teamId) return [];

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (error) {
      console.error('Error fetching team members:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create alert assignments
   */
  private async createAlertAssignments(
    alertId: string, 
    userIds: string[], 
    reason: string
  ): Promise<void> {
    try {
      const assignments = userIds.map(userId => ({
        alert_id: alertId,
        assigned_to: userId,
        assignment_reason: reason,
        assignment_level: 1
      }));

      const { error } = await supabase
        .from('alert_assignments')
        .insert(assignments);

      if (error) {
        console.error('Error creating alert assignments:', error);
      } else {
        console.log(`✅ Created ${assignments.length} alert assignments for alert ${alertId}`);
      }

    } catch (error) {
      console.error('Error in createAlertAssignments:', error);
    }
  }

  /**
   * Get default escalation configuration based on severity
   */
  private getDefaultEscalationConfig(severity: AlertSeverity): {
    initialDelay: number;
    escalationInterval: number;
    maxLevel: number;
  } {
    switch (severity) {
      case 'critical':
        return { initialDelay: 5, escalationInterval: 10, maxLevel: 5 };
      case 'high':
        return { initialDelay: 15, escalationInterval: 20, maxLevel: 4 };
      case 'medium':
        return { initialDelay: 30, escalationInterval: 30, maxLevel: 3 };
      case 'low':
        return { initialDelay: 60, escalationInterval: 60, maxLevel: 2 };
      case 'info':
        return { initialDelay: 120, escalationInterval: 120, maxLevel: 1 };
      default:
        return { initialDelay: 30, escalationInterval: 30, maxLevel: 3 };
    }
  }

  /**
   * Update severity routing rule
   */
  async updateSeverityRoutingRule(
    ruleId: string, 
    updates: Partial<SeverityRoutingRule>
  ): Promise<SeverityRoutingRule> {
    const { data, error } = await supabase
      .from('alert_severity_routing')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update severity routing rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Create severity routing rule
   */
  async createSeverityRoutingRule(
    rule: Omit<SeverityRoutingRule, 'id'>
  ): Promise<SeverityRoutingRule> {
    const { data, error } = await supabase
      .from('alert_severity_routing')
      .insert(rule)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create severity routing rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Get routing statistics
   */
  async getRoutingStatistics(teamId?: string, hours: number = 24): Promise<{
    totalAlerts: number;
    routedAlerts: number;
    routingsByReason: Record<string, number>;
    routingsBySeverity: Record<AlertSeverity, number>;
    averageAssignmentTime: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    let alertQuery = supabase
      .from('alert_assignments')
      .select(`
        assignment_reason,
        created_at,
        alerts (
          severity,
          team_id,
          created_at
        )
      `)
      .gte('created_at', since.toISOString());

    if (teamId) {
      // This would need a join or subquery in a real implementation
      alertQuery = alertQuery.eq('alerts.team_id', teamId);
    }

    const { data: assignments, error } = await alertQuery;

    if (error) {
      console.error('Error fetching routing statistics:', error);
      return {
        totalAlerts: 0,
        routedAlerts: 0,
        routingsByReason: {},
        routingsBySeverity: {},
        averageAssignmentTime: 0
      };
    }

    const routingsByReason: Record<string, number> = {};
    const routingsBySeverity: Record<AlertSeverity, number> = {};
    let totalAssignmentTime = 0;

    assignments?.forEach(assignment => {
      const reason = assignment.assignment_reason;
      const severity = assignment.alerts?.severity;
      
      routingsByReason[reason] = (routingsByReason[reason] || 0) + 1;
      
      if (severity) {
        routingsBySeverity[severity] = (routingsBySeverity[severity] || 0) + 1;
      }

      // Calculate assignment time (time from alert creation to assignment)
      if (assignment.alerts?.created_at) {
        const alertTime = new Date(assignment.alerts.created_at).getTime();
        const assignmentTime = new Date(assignment.created_at).getTime();
        totalAssignmentTime += assignmentTime - alertTime;
      }
    });

    const averageAssignmentTime = assignments?.length 
      ? totalAssignmentTime / assignments.length / 1000 / 60 // Convert to minutes
      : 0;

    return {
      totalAlerts: assignments?.length || 0,
      routedAlerts: assignments?.length || 0,
      routingsByReason,
      routingsBySeverity,
      averageAssignmentTime
    };
  }

  /**
   * Get alert assignments for a user
   */
  async getUserAlertAssignments(
    userId: string, 
    status: 'active' | 'acknowledged' | 'all' = 'active'
  ): Promise<Array<{
    assignment: any;
    alert: Alert;
  }>> {
    let query = supabase
      .from('alert_assignments')
      .select(`
        *,
        alerts (*)
      `)
      .eq('assigned_to', userId);

    if (status !== 'all') {
      if (status === 'active') {
        query = query.is('acknowledged_at', null);
      } else {
        query = query.not('acknowledged_at', 'is', null);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user alert assignments:', error);
      return [];
    }

    return data?.map(item => ({
      assignment: item,
      alert: item.alerts
    })) || [];
  }
}

// Export singleton instance
export const alertSeverityRouter = new AlertSeverityRouter();
