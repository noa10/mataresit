/**
 * Alert Notification Orchestrator
 * Coordinates alert notifications across multiple channels with escalation
 * Task 3: Create Multiple Notification Channel System - Orchestration
 */

import { supabase } from '@/lib/supabase';
import { alertNotificationDeliveryService } from './alertNotificationDeliveryService';
import { alertingService } from './alertingService';
import { Alert, AlertEscalationPolicy, NotificationChannel } from '@/types/alerting';

interface NotificationJob {
  id: string;
  alertId: string;
  channelId: string;
  escalationLevel: number;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

interface EscalationContext {
  alertId: string;
  currentLevel: number;
  maxLevel: number;
  policy: AlertEscalationPolicy;
  nextEscalationAt?: Date;
  escalationHistory: Array<{
    level: number;
    triggeredAt: Date;
    channels: string[];
    success: boolean;
  }>;
}

export class AlertNotificationOrchestrator {
  private processingJobs = new Map<string, NodeJS.Timeout>();
  private escalationTimers = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  /**
   * Start the notification orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Alert notification orchestrator is already running');
      return;
    }

    console.log('🎼 Starting Alert Notification Orchestrator');
    this.isRunning = true;

    // Process pending notifications
    await this.processPendingNotifications();

    // Set up escalation monitoring
    await this.setupEscalationMonitoring();

    console.log('✅ Alert Notification Orchestrator started');
  }

  /**
   * Stop the notification orchestrator
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Alert notification orchestrator is not running');
      return;
    }

    console.log('🛑 Stopping Alert Notification Orchestrator');
    this.isRunning = false;

    // Clear all timers
    this.processingJobs.forEach(timer => clearTimeout(timer));
    this.processingJobs.clear();

    this.escalationTimers.forEach(timer => clearTimeout(timer));
    this.escalationTimers.clear();

    console.log('✅ Alert Notification Orchestrator stopped');
  }

  /**
   * Process a new alert for notification delivery
   */
  async processAlert(alert: Alert): Promise<void> {
    try {
      console.log(`🔔 Processing alert for notifications: ${alert.title} (${alert.id})`);

      // Deliver to immediate notification channels
      const deliveryResult = await alertNotificationDeliveryService.deliverAlert(alert);

      console.log(`📊 Delivery summary: ${deliveryResult.successCount} success, ${deliveryResult.failureCount} failed`);

      // Set up escalation if configured
      await this.setupAlertEscalation(alert);

      // Log notification activity
      await this.logNotificationActivity(alert, deliveryResult);

    } catch (error) {
      console.error(`Error processing alert ${alert.id} for notifications:`, error);
    }
  }

  /**
   * Set up escalation for an alert
   */
  private async setupAlertEscalation(alert: Alert): Promise<void> {
    try {
      // Get escalation policy for this alert
      const escalationPolicy = await this.getEscalationPolicy(alert);
      
      if (!escalationPolicy) {
        console.log(`No escalation policy configured for alert ${alert.id}`);
        return;
      }

      console.log(`⏰ Setting up escalation for alert ${alert.id} with policy: ${escalationPolicy.name}`);

      // Create escalation context
      const escalationContext: EscalationContext = {
        alertId: alert.id,
        currentLevel: 0,
        maxLevel: escalationPolicy.max_escalation_level,
        policy: escalationPolicy,
        escalationHistory: []
      };

      // Schedule first escalation
      const firstEscalationDelay = escalationPolicy.initial_delay_minutes * 60 * 1000;
      const firstEscalationAt = new Date(Date.now() + firstEscalationDelay);

      escalationContext.nextEscalationAt = firstEscalationAt;

      // Update alert with escalation info
      await supabase
        .from('alerts')
        .update({
          escalation_level: 0,
          next_escalation_at: firstEscalationAt.toISOString()
        })
        .eq('id', alert.id);

      // Schedule escalation timer
      const timer = setTimeout(
        () => this.processEscalation(escalationContext),
        firstEscalationDelay
      );

      this.escalationTimers.set(alert.id, timer);

    } catch (error) {
      console.error(`Error setting up escalation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Process escalation for an alert
   */
  private async processEscalation(context: EscalationContext): Promise<void> {
    try {
      console.log(`⬆️ Processing escalation level ${context.currentLevel + 1} for alert ${context.alertId}`);

      // Check if alert is still active
      const alert = await alertingService.getAlert(context.alertId);
      if (!alert || alert.status === 'resolved' || alert.status === 'suppressed') {
        console.log(`Alert ${context.alertId} is no longer active, cancelling escalation`);
        this.escalationTimers.delete(context.alertId);
        return;
      }

      // Check if we've reached max escalation level
      if (context.currentLevel >= context.maxLevel) {
        console.log(`Max escalation level reached for alert ${context.alertId}`);
        this.escalationTimers.delete(context.alertId);
        return;
      }

      // Get escalation rule for current level
      const escalationRules = context.policy.escalation_rules as any[];
      const currentRule = escalationRules.find(rule => rule.level === context.currentLevel + 1);

      if (!currentRule) {
        console.warn(`No escalation rule found for level ${context.currentLevel + 1}`);
        return;
      }

      // Check time-based conditions
      if (!this.checkEscalationConditions(currentRule)) {
        console.log(`Escalation conditions not met for level ${context.currentLevel + 1}, skipping`);
        // Schedule next check
        this.scheduleNextEscalation(context);
        return;
      }

      // Get channels for this escalation level
      const channels = await this.getEscalationChannels(currentRule.notification_channels);

      if (channels.length === 0) {
        console.warn(`No valid channels found for escalation level ${context.currentLevel + 1}`);
        this.scheduleNextEscalation(context);
        return;
      }

      // Deliver notifications to escalation channels
      const deliveryPromises = channels.map(channel => 
        alertNotificationDeliveryService.deliverToChannel(alert, channel)
      );

      const results = await Promise.allSettled(deliveryPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      // Update escalation context
      context.currentLevel++;
      context.escalationHistory.push({
        level: context.currentLevel,
        triggeredAt: new Date(),
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
          event_description: `Alert escalated to level ${context.currentLevel}`,
          metadata: {
            escalation_level: context.currentLevel,
            channels_notified: channels.map(c => c.name),
            successful_deliveries: successCount,
            total_channels: channels.length
          }
        });

      console.log(`📈 Escalation level ${context.currentLevel} completed: ${successCount}/${channels.length} successful deliveries`);

      // Schedule next escalation if not at max level
      if (context.currentLevel < context.maxLevel) {
        this.scheduleNextEscalation(context);
      } else {
        this.escalationTimers.delete(context.alertId);
      }

    } catch (error) {
      console.error(`Error processing escalation for alert ${context.alertId}:`, error);
    }
  }

  /**
   * Schedule next escalation
   */
  private scheduleNextEscalation(context: EscalationContext): void {
    const nextDelay = context.policy.escalation_interval_minutes * 60 * 1000;
    const nextEscalationAt = new Date(Date.now() + nextDelay);

    context.nextEscalationAt = nextEscalationAt;

    // Update alert with next escalation time
    supabase
      .from('alerts')
      .update({
        next_escalation_at: nextEscalationAt.toISOString()
      })
      .eq('id', context.alertId);

    // Schedule next escalation
    const timer = setTimeout(
      () => this.processEscalation(context),
      nextDelay
    );

    this.escalationTimers.set(context.alertId, timer);

    console.log(`⏰ Next escalation scheduled for alert ${context.alertId} at ${nextEscalationAt.toISOString()}`);
  }

  /**
   * Check if escalation conditions are met
   */
  private checkEscalationConditions(escalationRule: any): boolean {
    // Check time of day conditions
    if (escalationRule.conditions?.time_of_day) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = this.parseTime(escalationRule.conditions.time_of_day.start);
      const endTime = this.parseTime(escalationRule.conditions.time_of_day.end);

      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }

    // Check day of week conditions
    if (escalationRule.conditions?.days_of_week) {
      const currentDay = new Date().getDay();
      if (!escalationRule.conditions.days_of_week.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse time string (HH:MM) to minutes
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  /**
   * Get escalation policy for an alert
   */
  private async getEscalationPolicy(alert: Alert): Promise<AlertEscalationPolicy | null> {
    const { data, error } = await supabase
      .from('alert_rule_channels')
      .select(`
        escalation_policy_id,
        alert_escalation_policies (*)
      `)
      .eq('alert_rule_id', alert.alert_rule_id)
      .not('escalation_policy_id', 'is', null)
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].alert_escalation_policies;
  }

  /**
   * Get channels for escalation
   */
  private async getEscalationChannels(channelIds: string[]): Promise<NotificationChannel[]> {
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .in('id', channelIds)
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching escalation channels:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Process pending notifications
   */
  private async processPendingNotifications(): Promise<void> {
    try {
      // Get alerts that need escalation
      const { data: alertsNeedingEscalation, error } = await supabase
        .from('alerts')
        .select('*')
        .in('status', ['active', 'acknowledged'])
        .not('next_escalation_at', 'is', null)
        .lte('next_escalation_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching alerts needing escalation:', error);
        return;
      }

      if (alertsNeedingEscalation && alertsNeedingEscalation.length > 0) {
        console.log(`📋 Found ${alertsNeedingEscalation.length} alerts needing escalation`);

        for (const alert of alertsNeedingEscalation) {
          // Set up escalation for this alert
          await this.setupAlertEscalation(alert);
        }
      }

    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  }

  /**
   * Set up escalation monitoring
   */
  private async setupEscalationMonitoring(): Promise<void> {
    // This would set up real-time monitoring for new alerts
    // For now, we'll use a simple polling mechanism
    setInterval(async () => {
      if (this.isRunning) {
        await this.processPendingNotifications();
      }
    }, 60000); // Check every minute
  }

  /**
   * Log notification activity
   */
  private async logNotificationActivity(alert: Alert, deliveryResult: any): Promise<void> {
    try {
      await supabase
        .from('alert_history')
        .insert({
          alert_id: alert.id,
          event_type: 'notifications_sent',
          event_description: `Notifications sent to ${deliveryResult.channels.length} channels`,
          metadata: {
            total_channels: deliveryResult.channels.length,
            successful_deliveries: deliveryResult.successCount,
            failed_deliveries: deliveryResult.failureCount,
            delivery_time_ms: deliveryResult.totalDeliveryTime,
            channels: deliveryResult.channels.map((c: NotificationChannel) => ({
              id: c.id,
              name: c.name,
              type: c.channel_type
            }))
          }
        });

    } catch (error) {
      console.error('Error logging notification activity:', error);
    }
  }

  /**
   * Cancel escalation for an alert (when resolved/suppressed)
   */
  async cancelEscalation(alertId: string): Promise<void> {
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
      console.log(`⏹️ Cancelled escalation for alert ${alertId}`);
    }

    // Clear next escalation time
    await supabase
      .from('alerts')
      .update({
        next_escalation_at: null
      })
      .eq('id', alertId);
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    isRunning: boolean;
    activeEscalations: number;
    processingJobs: number;
  } {
    return {
      isRunning: this.isRunning,
      activeEscalations: this.escalationTimers.size,
      processingJobs: this.processingJobs.size
    };
  }
}

// Export singleton instance
export const alertNotificationOrchestrator = new AlertNotificationOrchestrator();
