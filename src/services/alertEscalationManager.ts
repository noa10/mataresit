/**
 * Alert Escalation Manager
 * Advanced escalation policies with severity-based routing and team assignment
 * Task 4: Build Alert Escalation and Severity Management
 */

import { supabase } from '@/lib/supabase';
import { alertingService } from './alertingService';
import { alertNotificationDeliveryService } from './alertNotificationDeliveryService';
import { 
  Alert, 
  AlertSeverity, 
  AlertEscalationPolicy, 
  EscalationRule,
  NotificationChannel
} from '@/types/alerting';

interface SeverityConfig {
  severity: AlertSeverity;
  priority: number; // 1-5, 1 being highest priority
  defaultEscalationDelay: number; // minutes
  maxEscalationLevel: number;
  autoAcknowledgeTimeout?: number; // minutes
  autoResolveTimeout?: number; // minutes
  requiresImmediateAttention: boolean;
  allowedBusinessHours: boolean;
  weekendEscalation: boolean;
}

interface TeamAssignment {
  teamId: string;
  teamName: string;
  primaryContacts: string[]; // User IDs
  escalationContacts: string[]; // User IDs
  supportedSeverities: AlertSeverity[];
  businessHours: {
    timezone: string;
    weekdays: {
      start: string; // HH:MM
      end: string;   // HH:MM
    };
    weekends: {
      enabled: boolean;
      start?: string;
      end?: string;
    };
  };
  escalationChain: Array<{
    level: number;
    contacts: string[];
    delayMinutes: number;
    channels: string[];
  }>;
}

interface EscalationContext {
  alertId: string;
  alert: Alert;
  severityConfig: SeverityConfig;
  teamAssignment?: TeamAssignment;
  currentLevel: number;
  maxLevel: number;
  escalationHistory: Array<{
    level: number;
    triggeredAt: Date;
    contacts: string[];
    channels: string[];
    success: boolean;
    reason?: string;
  }>;
  nextEscalationAt?: Date;
  isBusinessHours: boolean;
  isWeekend: boolean;
}

export class AlertEscalationManager {
  private readonly severityConfigs: Map<AlertSeverity, SeverityConfig> = new Map();
  private readonly teamAssignments: Map<string, TeamAssignment> = new Map();
  private readonly activeEscalations: Map<string, EscalationContext> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeSeverityConfigs();
  }

  /**
   * Initialize default severity configurations
   */
  private initializeSeverityConfigs(): void {
    this.severityConfigs.set('critical', {
      severity: 'critical',
      priority: 1,
      defaultEscalationDelay: 5, // 5 minutes
      maxEscalationLevel: 5,
      autoAcknowledgeTimeout: 30, // 30 minutes
      requiresImmediateAttention: true,
      allowedBusinessHours: false, // Can escalate outside business hours
      weekendEscalation: true
    });

    this.severityConfigs.set('high', {
      severity: 'high',
      priority: 2,
      defaultEscalationDelay: 15, // 15 minutes
      maxEscalationLevel: 4,
      autoAcknowledgeTimeout: 60, // 1 hour
      requiresImmediateAttention: true,
      allowedBusinessHours: false,
      weekendEscalation: true
    });

    this.severityConfigs.set('medium', {
      severity: 'medium',
      priority: 3,
      defaultEscalationDelay: 30, // 30 minutes
      maxEscalationLevel: 3,
      autoAcknowledgeTimeout: 120, // 2 hours
      autoResolveTimeout: 480, // 8 hours
      requiresImmediateAttention: false,
      allowedBusinessHours: true, // Only during business hours
      weekendEscalation: false
    });

    this.severityConfigs.set('low', {
      severity: 'low',
      priority: 4,
      defaultEscalationDelay: 60, // 1 hour
      maxEscalationLevel: 2,
      autoAcknowledgeTimeout: 240, // 4 hours
      autoResolveTimeout: 1440, // 24 hours
      requiresImmediateAttention: false,
      allowedBusinessHours: true,
      weekendEscalation: false
    });

    this.severityConfigs.set('info', {
      severity: 'info',
      priority: 5,
      defaultEscalationDelay: 120, // 2 hours
      maxEscalationLevel: 1,
      autoResolveTimeout: 2880, // 48 hours
      requiresImmediateAttention: false,
      allowedBusinessHours: true,
      weekendEscalation: false
    });
  }

  /**
   * Process alert for escalation with severity-based routing
   */
  async processAlertEscalation(alert: Alert): Promise<void> {
    try {
      console.log(`🎯 Processing escalation for ${alert.severity} alert: ${alert.title} (${alert.id})`);

      // Get severity configuration
      const severityConfig = this.severityConfigs.get(alert.severity);
      if (!severityConfig) {
        console.error(`No severity configuration found for: ${alert.severity}`);
        return;
      }

      // Get team assignment
      const teamAssignment = await this.getTeamAssignment(alert);

      // Check if escalation should proceed based on business hours
      const { isBusinessHours, isWeekend } = this.checkBusinessHours(teamAssignment);

      if (!this.shouldEscalate(severityConfig, isBusinessHours, isWeekend)) {
        console.log(`Escalation skipped for ${alert.severity} alert due to business hours restrictions`);
        await this.scheduleBusinessHoursEscalation(alert, severityConfig, teamAssignment);
        return;
      }

      // Create escalation context
      const escalationContext: EscalationContext = {
        alertId: alert.id,
        alert,
        severityConfig,
        teamAssignment,
        currentLevel: 0,
        maxLevel: teamAssignment?.escalationChain.length || severityConfig.maxEscalationLevel,
        escalationHistory: [],
        isBusinessHours,
        isWeekend
      };

      // Store active escalation
      this.activeEscalations.set(alert.id, escalationContext);

      // Start immediate escalation for critical/high severity
      if (severityConfig.requiresImmediateAttention) {
        await this.executeImmediateEscalation(escalationContext);
      }

      // Schedule first escalation
      await this.scheduleNextEscalation(escalationContext);

    } catch (error) {
      console.error(`Error processing escalation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Execute immediate escalation for critical alerts
   */
  private async executeImmediateEscalation(context: EscalationContext): Promise<void> {
    try {
      console.log(`🚨 Executing immediate escalation for critical alert: ${context.alertId}`);

      // Get immediate contacts
      const immediateContacts = this.getImmediateContacts(context);
      
      if (immediateContacts.length === 0) {
        console.warn(`No immediate contacts found for alert ${context.alertId}`);
        return;
      }

      // Send immediate notifications
      const channels = await this.getChannelsForContacts(immediateContacts, ['push', 'sms', 'in_app']);
      
      const deliveryPromises = channels.map(channel => 
        alertNotificationDeliveryService.deliverToChannel(context.alert, channel)
      );

      const results = await Promise.allSettled(deliveryPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      // Record immediate escalation
      context.escalationHistory.push({
        level: 0,
        triggeredAt: new Date(),
        contacts: immediateContacts,
        channels: channels.map(c => c.id),
        success: successCount > 0,
        reason: 'immediate_escalation'
      });

      console.log(`⚡ Immediate escalation completed: ${successCount}/${channels.length} successful deliveries`);

    } catch (error) {
      console.error(`Error in immediate escalation for alert ${context.alertId}:`, error);
    }
  }

  /**
   * Schedule next escalation based on severity and team configuration
   */
  private async scheduleNextEscalation(context: EscalationContext): Promise<void> {
    try {
      if (context.currentLevel >= context.maxLevel) {
        console.log(`Max escalation level reached for alert ${context.alertId}`);
        this.activeEscalations.delete(context.alertId);
        return;
      }

      // Calculate delay based on severity and team configuration
      let delayMinutes = context.severityConfig.defaultEscalationDelay;
      
      if (context.teamAssignment?.escalationChain[context.currentLevel]) {
        delayMinutes = context.teamAssignment.escalationChain[context.currentLevel].delayMinutes;
      }

      // Adjust delay for business hours
      if (!context.isBusinessHours && !context.severityConfig.allowedBusinessHours) {
        delayMinutes = Math.min(delayMinutes, 15); // Faster escalation outside business hours
      }

      const nextEscalationAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      context.nextEscalationAt = nextEscalationAt;

      // Update alert with escalation info
      await supabase
        .from('alerts')
        .update({
          escalation_level: context.currentLevel,
          next_escalation_at: nextEscalationAt.toISOString()
        })
        .eq('id', context.alertId);

      // Schedule escalation timer
      const timer = setTimeout(
        () => this.executeEscalation(context),
        delayMinutes * 60 * 1000
      );

      this.escalationTimers.set(context.alertId, timer);

      console.log(`⏰ Next escalation scheduled for alert ${context.alertId} in ${delayMinutes} minutes`);

    } catch (error) {
      console.error(`Error scheduling escalation for alert ${context.alertId}:`, error);
    }
  }

  /**
   * Execute escalation level
   */
  private async executeEscalation(context: EscalationContext): Promise<void> {
    try {
      // Check if alert is still active
      const currentAlert = await alertingService.getAlert(context.alertId);
      if (!currentAlert || currentAlert.status === 'resolved' || currentAlert.status === 'suppressed') {
        console.log(`Alert ${context.alertId} is no longer active, cancelling escalation`);
        this.cancelEscalation(context.alertId);
        return;
      }

      context.currentLevel++;
      console.log(`📈 Executing escalation level ${context.currentLevel} for alert ${context.alertId}`);

      // Get contacts for this escalation level
      const contacts = this.getContactsForLevel(context, context.currentLevel);
      
      if (contacts.length === 0) {
        console.warn(`No contacts found for escalation level ${context.currentLevel}`);
        await this.scheduleNextEscalation(context);
        return;
      }

      // Get appropriate channels based on severity and level
      const channelTypes = this.getChannelTypesForLevel(context, context.currentLevel);
      const channels = await this.getChannelsForContacts(contacts, channelTypes);

      if (channels.length === 0) {
        console.warn(`No channels found for escalation level ${context.currentLevel}`);
        await this.scheduleNextEscalation(context);
        return;
      }

      // Deliver notifications
      const deliveryPromises = channels.map(channel => 
        alertNotificationDeliveryService.deliverToChannel(context.alert, channel)
      );

      const results = await Promise.allSettled(deliveryPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      // Record escalation
      context.escalationHistory.push({
        level: context.currentLevel,
        triggeredAt: new Date(),
        contacts,
        channels: channels.map(c => c.id),
        success: successCount > 0
      });

      // Update alert escalation info
      await supabase
        .from('alerts')
        .update({
          escalation_level: context.currentLevel,
          last_escalated_at: new Date().toISOString()
        })
        .eq('id', context.alertId);

      // Add escalation event to history
      await supabase
        .from('alert_history')
        .insert({
          alert_id: context.alertId,
          event_type: 'escalated',
          event_description: `Alert escalated to level ${context.currentLevel} (${context.alert.severity})`,
          metadata: {
            escalation_level: context.currentLevel,
            severity: context.alert.severity,
            contacts_notified: contacts,
            channels_used: channels.map(c => c.name),
            successful_deliveries: successCount,
            total_channels: channels.length,
            business_hours: context.isBusinessHours,
            weekend: context.isWeekend
          }
        });

      console.log(`✅ Escalation level ${context.currentLevel} completed: ${successCount}/${channels.length} successful deliveries`);

      // Schedule next escalation if not at max level
      await this.scheduleNextEscalation(context);

    } catch (error) {
      console.error(`Error executing escalation for alert ${context.alertId}:`, error);
    }
  }

  /**
   * Get team assignment for an alert
   */
  private async getTeamAssignment(alert: Alert): Promise<TeamAssignment | undefined> {
    if (!alert.team_id) return undefined;

    // Check cache first
    if (this.teamAssignments.has(alert.team_id)) {
      return this.teamAssignments.get(alert.team_id);
    }

    try {
      // Get team information and members
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          team_members (
            user_id,
            role,
            profiles (
              id,
              email,
              full_name
            )
          )
        `)
        .eq('id', alert.team_id)
        .single();

      if (teamError || !teamData) {
        console.error('Error fetching team data:', teamError);
        return undefined;
      }

      // Get team-specific escalation configuration
      const { data: configData, error: configError } = await supabase
        .from('team_escalation_configs')
        .select('*')
        .eq('team_id', alert.team_id)
        .single();

      // Create team assignment with default configuration if none exists
      const teamAssignment: TeamAssignment = {
        teamId: teamData.id,
        teamName: teamData.name,
        primaryContacts: teamData.team_members
          .filter((m: any) => m.role === 'owner' || m.role === 'admin')
          .map((m: any) => m.user_id),
        escalationContacts: teamData.team_members
          .map((m: any) => m.user_id),
        supportedSeverities: ['critical', 'high', 'medium', 'low', 'info'],
        businessHours: configData?.business_hours || {
          timezone: 'UTC',
          weekdays: { start: '09:00', end: '17:00' },
          weekends: { enabled: false }
        },
        escalationChain: configData?.escalation_chain || this.getDefaultEscalationChain(alert.severity)
      };

      // Cache the team assignment
      this.teamAssignments.set(alert.team_id, teamAssignment);
      return teamAssignment;

    } catch (error) {
      console.error('Error getting team assignment:', error);
      return undefined;
    }
  }

  /**
   * Get default escalation chain based on severity
   */
  private getDefaultEscalationChain(severity: AlertSeverity): Array<{
    level: number;
    contacts: string[];
    delayMinutes: number;
    channels: string[];
  }> {
    const severityConfig = this.severityConfigs.get(severity);
    if (!severityConfig) return [];

    const chain = [];
    for (let level = 1; level <= severityConfig.maxEscalationLevel; level++) {
      chain.push({
        level,
        contacts: [], // Will be populated with team members
        delayMinutes: severityConfig.defaultEscalationDelay * level,
        channels: this.getDefaultChannelsForLevel(severity, level)
      });
    }

    return chain;
  }

  /**
   * Get default channels for escalation level
   */
  private getDefaultChannelsForLevel(severity: AlertSeverity, level: number): string[] {
    switch (severity) {
      case 'critical':
        return level === 1 ? ['push', 'sms', 'in_app'] : ['email', 'slack', 'webhook'];
      case 'high':
        return level === 1 ? ['push', 'in_app'] : ['email', 'slack'];
      case 'medium':
        return ['email', 'in_app'];
      case 'low':
      case 'info':
        return ['in_app'];
      default:
        return ['in_app'];
    }
  }

  /**
   * Check business hours
   */
  private checkBusinessHours(teamAssignment?: TeamAssignment): { isBusinessHours: boolean; isWeekend: boolean } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!teamAssignment) {
      return { isBusinessHours: !isWeekend, isWeekend };
    }

    const businessHours = teamAssignment.businessHours;

    // Check if weekends are supported
    if (isWeekend && !businessHours.weekends.enabled) {
      return { isBusinessHours: false, isWeekend: true };
    }

    // Get current time in team's timezone
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 100 + currentMinute;

    const schedule = isWeekend ? businessHours.weekends : businessHours.weekdays;
    if (!schedule.start || !schedule.end) {
      return { isBusinessHours: false, isWeekend };
    }

    const startTime = this.parseTime(schedule.start);
    const endTime = this.parseTime(schedule.end);

    const isBusinessHours = currentTime >= startTime && currentTime <= endTime;
    return { isBusinessHours, isWeekend };
  }

  /**
   * Parse time string to minutes
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  /**
   * Check if escalation should proceed
   */
  private shouldEscalate(
    severityConfig: SeverityConfig,
    isBusinessHours: boolean,
    isWeekend: boolean
  ): boolean {
    // Critical and high severity always escalate
    if (severityConfig.requiresImmediateAttention) {
      return true;
    }

    // Check business hours restriction
    if (severityConfig.allowedBusinessHours && !isBusinessHours) {
      return false;
    }

    // Check weekend restriction
    if (isWeekend && !severityConfig.weekendEscalation) {
      return false;
    }

    return true;
  }

  /**
   * Schedule escalation for business hours
   */
  private async scheduleBusinessHoursEscalation(
    alert: Alert,
    severityConfig: SeverityConfig,
    teamAssignment?: TeamAssignment
  ): Promise<void> {
    try {
      // Calculate next business hours start time
      const nextBusinessHours = this.getNextBusinessHours(teamAssignment);

      if (!nextBusinessHours) {
        console.warn(`Cannot determine next business hours for alert ${alert.id}`);
        return;
      }

      // Update alert with business hours escalation time
      await supabase
        .from('alerts')
        .update({
          next_escalation_at: nextBusinessHours.toISOString()
        })
        .eq('id', alert.id);

      // Schedule timer for business hours
      const delay = nextBusinessHours.getTime() - Date.now();
      const timer = setTimeout(
        () => this.processAlertEscalation(alert),
        delay
      );

      this.escalationTimers.set(alert.id, timer);

      console.log(`⏰ Business hours escalation scheduled for alert ${alert.id} at ${nextBusinessHours.toISOString()}`);

    } catch (error) {
      console.error(`Error scheduling business hours escalation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Get next business hours start time
   */
  private getNextBusinessHours(teamAssignment?: TeamAssignment): Date | null {
    const now = new Date();
    const businessHours = teamAssignment?.businessHours || {
      timezone: 'UTC',
      weekdays: { start: '09:00', end: '17:00' },
      weekends: { enabled: false }
    };

    // Simple implementation - find next weekday at start time
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0); // Default to 9 AM

    // Skip weekends if not enabled
    while ((nextDay.getDay() === 0 || nextDay.getDay() === 6) && !businessHours.weekends.enabled) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return nextDay;
  }

  /**
   * Get immediate contacts for critical alerts
   */
  private getImmediateContacts(context: EscalationContext): string[] {
    if (!context.teamAssignment) return [];

    // For critical alerts, use primary contacts
    if (context.alert.severity === 'critical') {
      return context.teamAssignment.primaryContacts;
    }

    // For high severity, use a subset of escalation contacts
    if (context.alert.severity === 'high') {
      return context.teamAssignment.primaryContacts.slice(0, 2);
    }

    return [];
  }

  /**
   * Get contacts for escalation level
   */
  private getContactsForLevel(context: EscalationContext, level: number): string[] {
    if (!context.teamAssignment) return [];

    const escalationChain = context.teamAssignment.escalationChain;
    const levelConfig = escalationChain.find(chain => chain.level === level);

    if (levelConfig && levelConfig.contacts.length > 0) {
      return levelConfig.contacts;
    }

    // Fallback to escalation contacts
    const contactsPerLevel = Math.ceil(context.teamAssignment.escalationContacts.length / context.maxLevel);
    const startIndex = (level - 1) * contactsPerLevel;
    const endIndex = Math.min(startIndex + contactsPerLevel, context.teamAssignment.escalationContacts.length);

    return context.teamAssignment.escalationContacts.slice(startIndex, endIndex);
  }

  /**
   * Get channel types for escalation level
   */
  private getChannelTypesForLevel(context: EscalationContext, level: number): string[] {
    if (context.teamAssignment?.escalationChain[level - 1]?.channels) {
      return context.teamAssignment.escalationChain[level - 1].channels;
    }

    return this.getDefaultChannelsForLevel(context.alert.severity, level);
  }

  /**
   * Get channels for contacts
   */
  private async getChannelsForContacts(contacts: string[], channelTypes: string[]): Promise<NotificationChannel[]> {
    // This is a simplified implementation
    // In practice, you'd query for user-specific notification preferences
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .in('channel_type', channelTypes)
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching channels for contacts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Cancel escalation for an alert
   */
  cancelEscalation(alertId: string): void {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    this.activeEscalations.delete(alertId);
    console.log(`⏹️ Cancelled escalation for alert ${alertId}`);
  }

  /**
   * Get escalation status for an alert
   */
  getEscalationStatus(alertId: string): EscalationContext | null {
    return this.activeEscalations.get(alertId) || null;
  }

  /**
   * Update severity configuration
   */
  updateSeverityConfig(severity: AlertSeverity, config: Partial<SeverityConfig>): void {
    const currentConfig = this.severityConfigs.get(severity);
    if (currentConfig) {
      this.severityConfigs.set(severity, { ...currentConfig, ...config });
    }
  }

  /**
   * Get all active escalations
   */
  getActiveEscalations(): Map<string, EscalationContext> {
    return new Map(this.activeEscalations);
  }

  /**
   * Get escalation statistics
   */
  getEscalationStatistics(): {
    activeEscalations: number;
    totalEscalations: number;
    escalationsByLevel: Record<number, number>;
    escalationsBySeverity: Record<AlertSeverity, number>;
  } {
    const activeEscalations = this.activeEscalations.size;
    const escalationsByLevel: Record<number, number> = {};
    const escalationsBySeverity: Record<AlertSeverity, number> = {};

    this.activeEscalations.forEach(context => {
      escalationsByLevel[context.currentLevel] = (escalationsByLevel[context.currentLevel] || 0) + 1;
      escalationsBySeverity[context.alert.severity] = (escalationsBySeverity[context.alert.severity] || 0) + 1;
    });

    return {
      activeEscalations,
      totalEscalations: this.activeEscalations.size,
      escalationsByLevel,
      escalationsBySeverity
    };
  }
}

// Export singleton instance
export const alertEscalationManager = new AlertEscalationManager();
