import { supabase } from '@/lib/supabase';
import { memberActivityNotificationService } from './memberActivityNotificationService';

/**
 * Real-time Activity Service
 * 
 * Manages real-time subscriptions for team activities, member changes,
 * and system events with intelligent filtering and performance optimization.
 */

export interface ActivitySubscriptionOptions {
  teamId: string;
  userId?: string;
  activityTypes?: string[];
  priority?: 'low' | 'medium' | 'high';
  batchUpdates?: boolean;
  maxUpdatesPerSecond?: number;
}

export interface ActivityEvent {
  id: string;
  type: 'team_audit' | 'member_activity' | 'notification' | 'system_event';
  action: string;
  data: any;
  timestamp: string;
  teamId: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface SubscriptionStats {
  activeSubscriptions: number;
  eventsReceived: number;
  eventsFiltered: number;
  lastEventTime: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  averageLatency: number;
}

class RealTimeActivityService {
  private subscriptions = new Map<string, any>();
  private eventHandlers = new Map<string, Set<(event: ActivityEvent) => void>>();
  private rateLimiters = new Map<string, { count: number; resetTime: number }>();
  private stats: SubscriptionStats = {
    activeSubscriptions: 0,
    eventsReceived: 0,
    eventsFiltered: 0,
    lastEventTime: null,
    connectionStatus: 'disconnected',
    averageLatency: 0
  };
  private latencyMeasurements: number[] = [];

  /**
   * Subscribe to real-time team activities
   */
  async subscribeToTeamActivities(
    subscriptionId: string,
    options: ActivitySubscriptionOptions,
    onEvent: (event: ActivityEvent) => void
  ): Promise<void> {
    try {
      // Store event handler
      if (!this.eventHandlers.has(subscriptionId)) {
        this.eventHandlers.set(subscriptionId, new Set());
      }
      this.eventHandlers.get(subscriptionId)!.add(onEvent);

      // Set up rate limiting if specified
      if (options.maxUpdatesPerSecond) {
        this.rateLimiters.set(subscriptionId, {
          count: 0,
          resetTime: Date.now() + 1000
        });
      }

      // Subscribe to team audit logs
      const auditSubscription = supabase
        .channel(`team-audit-${options.teamId}-${subscriptionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'team_audit_logs',
            filter: `team_id=eq.${options.teamId}`
          },
          (payload) => {
            this.handleAuditLogEvent(subscriptionId, payload, options);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'team_audit_logs',
            filter: `team_id=eq.${options.teamId}`
          },
          (payload) => {
            this.handleAuditLogEvent(subscriptionId, payload, options);
          }
        )
        .subscribe((status) => {
          this.updateConnectionStatus(status);
        });

      // Subscribe to team member changes
      const memberSubscription = supabase
        .channel(`team-members-${options.teamId}-${subscriptionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_members',
            filter: `team_id=eq.${options.teamId}`
          },
          (payload) => {
            this.handleMemberEvent(subscriptionId, payload, options);
          }
        )
        .subscribe((status) => {
          this.updateConnectionStatus(status);
        });

      // Subscribe to notifications if user-specific
      let notificationSubscription = null;
      if (options.userId) {
        notificationSubscription = supabase
          .channel(`notifications-${options.userId}-${subscriptionId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${options.userId}`
            },
            (payload) => {
              this.handleNotificationEvent(subscriptionId, payload, options);
            }
          )
          .subscribe((status) => {
            this.updateConnectionStatus(status);
          });
      }

      // Store subscriptions for cleanup
      this.subscriptions.set(subscriptionId, {
        auditSubscription,
        memberSubscription,
        notificationSubscription,
        options
      });

      this.stats.activeSubscriptions++;
      
      console.log(`Real-time subscription created: ${subscriptionId}`);
    } catch (error) {
      console.error('Error creating real-time subscription:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from real-time activities
   */
  async unsubscribeFromTeamActivities(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) return;

      // Remove Supabase subscriptions
      if (subscription.auditSubscription) {
        await supabase.removeChannel(subscription.auditSubscription);
      }
      if (subscription.memberSubscription) {
        await supabase.removeChannel(subscription.memberSubscription);
      }
      if (subscription.notificationSubscription) {
        await supabase.removeChannel(subscription.notificationSubscription);
      }

      // Clean up handlers and rate limiters
      this.subscriptions.delete(subscriptionId);
      this.eventHandlers.delete(subscriptionId);
      this.rateLimiters.delete(subscriptionId);

      this.stats.activeSubscriptions--;
      
      console.log(`Real-time subscription removed: ${subscriptionId}`);
    } catch (error) {
      console.error('Error removing real-time subscription:', error);
      throw error;
    }
  }

  /**
   * Handle audit log events
   */
  private handleAuditLogEvent(
    subscriptionId: string,
    payload: any,
    options: ActivitySubscriptionOptions
  ): void {
    const eventStartTime = Date.now();
    this.stats.eventsReceived++;

    try {
      const auditLog = payload.new || payload.old;
      
      // Apply filters
      if (options.activityTypes && !options.activityTypes.includes(auditLog.action)) {
        this.stats.eventsFiltered++;
        return;
      }

      if (options.userId && auditLog.performed_by !== options.userId && auditLog.target_user_id !== options.userId) {
        this.stats.eventsFiltered++;
        return;
      }

      // Check rate limiting
      if (!this.checkRateLimit(subscriptionId)) {
        this.stats.eventsFiltered++;
        return;
      }

      const event: ActivityEvent = {
        id: `audit-${auditLog.id}`,
        type: 'team_audit',
        action: auditLog.action,
        data: auditLog,
        timestamp: auditLog.created_at,
        teamId: auditLog.team_id,
        userId: auditLog.performed_by,
        priority: this.getEventPriority(auditLog.action)
      };

      this.emitEvent(subscriptionId, event);
      this.recordLatency(eventStartTime);
      this.stats.lastEventTime = new Date();

      // Trigger notifications for high-priority events
      if (event.priority === 'high') {
        this.triggerActivityNotification(event);
      }
    } catch (error) {
      console.error('Error handling audit log event:', error);
    }
  }

  /**
   * Handle team member events
   */
  private handleMemberEvent(
    subscriptionId: string,
    payload: any,
    options: ActivitySubscriptionOptions
  ): void {
    const eventStartTime = Date.now();
    this.stats.eventsReceived++;

    try {
      const member = payload.new || payload.old;
      const eventType = payload.eventType;

      // Check rate limiting
      if (!this.checkRateLimit(subscriptionId)) {
        this.stats.eventsFiltered++;
        return;
      }

      let action = 'member_updated';
      if (eventType === 'INSERT') action = 'member_joined';
      if (eventType === 'DELETE') action = 'member_left';
      if (eventType === 'UPDATE' && payload.old?.role !== payload.new?.role) {
        action = 'member_role_changed';
      }

      const event: ActivityEvent = {
        id: `member-${member.id || member.user_id}-${Date.now()}`,
        type: 'member_activity',
        action,
        data: {
          member,
          oldValues: payload.old,
          newValues: payload.new,
          eventType
        },
        timestamp: new Date().toISOString(),
        teamId: member.team_id,
        userId: member.user_id,
        priority: action === 'member_role_changed' ? 'high' : 'medium'
      };

      this.emitEvent(subscriptionId, event);
      this.recordLatency(eventStartTime);
      this.stats.lastEventTime = new Date();

      // Trigger notifications
      this.triggerActivityNotification(event);
    } catch (error) {
      console.error('Error handling member event:', error);
    }
  }

  /**
   * Handle notification events
   */
  private handleNotificationEvent(
    subscriptionId: string,
    payload: any,
    options: ActivitySubscriptionOptions
  ): void {
    const eventStartTime = Date.now();
    this.stats.eventsReceived++;

    try {
      const notification = payload.new;

      // Filter by team if specified
      if (options.teamId && notification.team_id !== options.teamId) {
        this.stats.eventsFiltered++;
        return;
      }

      // Check rate limiting
      if (!this.checkRateLimit(subscriptionId)) {
        this.stats.eventsFiltered++;
        return;
      }

      const event: ActivityEvent = {
        id: `notification-${notification.id}`,
        type: 'notification',
        action: 'notification_received',
        data: notification,
        timestamp: notification.created_at,
        teamId: notification.team_id,
        userId: notification.recipient_id,
        priority: notification.priority || 'medium'
      };

      this.emitEvent(subscriptionId, event);
      this.recordLatency(eventStartTime);
      this.stats.lastEventTime = new Date();
    } catch (error) {
      console.error('Error handling notification event:', error);
    }
  }

  /**
   * Emit event to all handlers for a subscription
   */
  private emitEvent(subscriptionId: string, event: ActivityEvent): void {
    const handlers = this.eventHandlers.get(subscriptionId);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  /**
   * Check rate limiting for subscription
   */
  private checkRateLimit(subscriptionId: string): boolean {
    const rateLimiter = this.rateLimiters.get(subscriptionId);
    if (!rateLimiter) return true;

    const now = Date.now();
    
    // Reset counter if window has passed
    if (now >= rateLimiter.resetTime) {
      rateLimiter.count = 0;
      rateLimiter.resetTime = now + 1000;
    }

    // Check if under limit
    const subscription = this.subscriptions.get(subscriptionId);
    const maxUpdates = subscription?.options.maxUpdatesPerSecond || 10;
    
    if (rateLimiter.count >= maxUpdates) {
      return false;
    }

    rateLimiter.count++;
    return true;
  }

  /**
   * Get event priority based on action type
   */
  private getEventPriority(action: string): 'low' | 'medium' | 'high' {
    const highPriorityActions = [
      'member_role_changed',
      'team_settings_updated',
      'member_removed',
      'team_deleted'
    ];
    
    const lowPriorityActions = [
      'receipt_created',
      'receipt_updated',
      'member_last_active_updated'
    ];

    if (highPriorityActions.includes(action)) return 'high';
    if (lowPriorityActions.includes(action)) return 'low';
    return 'medium';
  }

  /**
   * Trigger activity notification
   */
  private async triggerActivityNotification(event: ActivityEvent): Promise<void> {
    try {
      if (event.type === 'team_audit' || event.type === 'member_activity') {
        await memberActivityNotificationService.notifyMemberActivity({
          teamId: event.teamId,
          actorUserId: event.userId || 'system',
          actorName: event.data.performed_by_name || 'System',
          actorEmail: event.data.performed_by_email,
          targetUserId: event.data.target_user_id,
          targetUserName: event.data.target_user_name,
          targetUserEmail: event.data.target_user_email,
          activityType: event.action,
          metadata: event.data,
          priority: event.priority,
          batchable: event.priority === 'low'
        });
      }
    } catch (error) {
      console.error('Error triggering activity notification:', error);
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(status: string): void {
    if (status === 'SUBSCRIBED') {
      this.stats.connectionStatus = 'connected';
    } else if (status === 'CHANNEL_ERROR') {
      this.stats.connectionStatus = 'disconnected';
    } else if (status === 'TIMED_OUT') {
      this.stats.connectionStatus = 'reconnecting';
    }
  }

  /**
   * Record latency measurement
   */
  private recordLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    this.latencyMeasurements.push(latency);
    
    // Keep only last 100 measurements
    if (this.latencyMeasurements.length > 100) {
      this.latencyMeasurements.shift();
    }
    
    // Calculate average
    this.stats.averageLatency = this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length;
  }

  /**
   * Get subscription statistics
   */
  getStats(): SubscriptionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.eventsReceived = 0;
    this.stats.eventsFiltered = 0;
    this.stats.lastEventTime = null;
    this.stats.averageLatency = 0;
    this.latencyMeasurements = [];
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());
    
    for (const subscriptionId of subscriptionIds) {
      await this.unsubscribeFromTeamActivities(subscriptionId);
    }
    
    this.resetStats();
  }
}

// Export singleton instance
export const realTimeActivityService = new RealTimeActivityService();
