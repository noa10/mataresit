/**
 * Notification Audit Service
 * Comprehensive logging for notification attempts, delivery status, and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { NotificationType } from '@/types/notifications';

export interface NotificationAuditEvent {
  notificationType: NotificationType;
  recipientUserId: string;
  recipientEmail?: string;
  teamId?: string;
  teamName?: string;
  deliveryChannel: 'in_app' | 'email' | 'push';
  status: 'attempted' | 'delivered' | 'failed' | 'skipped';
  errorMessage?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
  deliveryAttempts?: number;
  deliveryDurationMs?: number;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface NotificationBatchAuditEvent {
  batchId: string;
  notificationType: NotificationType;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  skippedDeliveries: number;
  teamId?: string;
  teamName?: string;
  batchDurationMs: number;
  metadata?: Record<string, any>;
}

export class NotificationAuditService {
  private static instance: NotificationAuditService;
  private batchEvents: NotificationAuditEvent[] = [];
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds
  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Start batch processing
    this.startBatchProcessing();
  }

  public static getInstance(): NotificationAuditService {
    if (!NotificationAuditService.instance) {
      NotificationAuditService.instance = new NotificationAuditService();
    }
    return NotificationAuditService.instance;
  }

  /**
   * Log a single notification event
   */
  async logNotificationEvent(event: NotificationAuditEvent): Promise<void> {
    try {
      // Add to batch for efficient processing
      this.batchEvents.push({
        ...event,
        timestamp: new Date().toISOString(),
      } as any);

      // Process batch if it's full
      if (this.batchEvents.length >= this.BATCH_SIZE) {
        await this.processBatch();
      }

      // Log critical errors immediately
      if (event.status === 'failed' && event.errorCode === 'CRITICAL') {
        await this.logCriticalError(event);
      }

    } catch (error) {
      console.error('Failed to log notification event:', error);
      // Don't throw to avoid breaking notification flow
    }
  }

  /**
   * Log a batch notification event
   */
  async logBatchNotificationEvent(event: NotificationBatchAuditEvent): Promise<void> {
    try {
      const auditEntry = {
        event_type: 'notification_batch',
        notification_type: event.notificationType,
        team_id: event.teamId,
        metadata: {
          batchId: event.batchId,
          teamName: event.teamName,
          totalRecipients: event.totalRecipients,
          successfulDeliveries: event.successfulDeliveries,
          failedDeliveries: event.failedDeliveries,
          skippedDeliveries: event.skippedDeliveries,
          batchDurationMs: event.batchDurationMs,
          successRate: (event.successfulDeliveries / event.totalRecipients) * 100,
          ...event.metadata,
        },
        timestamp: new Date().toISOString(),
      };

      await this.insertAuditLog(auditEntry);

      // Log warning if success rate is low
      const successRate = (event.successfulDeliveries / event.totalRecipients) * 100;
      if (successRate < 80) {
        console.warn(`🚨 Low notification success rate: ${successRate.toFixed(1)}% for batch ${event.batchId}`);
      }

    } catch (error) {
      console.error('Failed to log batch notification event:', error);
    }
  }

  /**
   * Log team removal notification attempt
   */
  async logTeamRemovalNotification(
    recipientUserId: string,
    recipientEmail: string,
    teamId: string,
    teamName: string,
    deliveryChannel: 'in_app' | 'email',
    status: 'attempted' | 'delivered' | 'failed' | 'skipped',
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logNotificationEvent({
      notificationType: 'team_member_removed',
      recipientUserId,
      recipientEmail,
      teamId,
      teamName,
      deliveryChannel,
      status,
      errorMessage,
      metadata: {
        ...metadata,
        auditCategory: 'team_member_removal',
        sensitiveAction: true,
      },
    });
  }

  /**
   * Log notification preference check
   */
  async logPreferenceCheck(
    userId: string,
    notificationType: NotificationType,
    deliveryChannel: 'in_app' | 'email',
    allowed: boolean,
    reason?: string
  ): Promise<void> {
    try {
      const auditEntry = {
        event_type: 'notification_preference_check',
        user_id: userId,
        notification_type: notificationType,
        metadata: {
          deliveryChannel,
          allowed,
          reason,
          timestamp: new Date().toISOString(),
        },
      };

      // Log preference checks in batch to avoid overwhelming the database
      this.batchEvents.push(auditEntry as any);

    } catch (error) {
      console.error('Failed to log preference check:', error);
    }
  }

  /**
   * Get notification delivery statistics
   */
  async getDeliveryStatistics(
    teamId?: string,
    notificationType?: NotificationType,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageDeliveryTime: number;
  }> {
    try {
      let query = supabase
        .from('notification_audit_log')
        .select('*');

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      if (notificationType) {
        query = query.eq('notification_type', notificationType);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get delivery statistics:', error);
        return {
          totalAttempts: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          successRate: 0,
          averageDeliveryTime: 0,
        };
      }

      const totalAttempts = data.length;
      const successfulDeliveries = data.filter(d => d.metadata?.status === 'delivered').length;
      const failedDeliveries = data.filter(d => d.metadata?.status === 'failed').length;
      const successRate = totalAttempts > 0 ? (successfulDeliveries / totalAttempts) * 100 : 0;
      
      const deliveryTimes = data
        .filter(d => d.metadata?.deliveryDurationMs)
        .map(d => d.metadata.deliveryDurationMs);
      const averageDeliveryTime = deliveryTimes.length > 0 
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length 
        : 0;

      return {
        totalAttempts,
        successfulDeliveries,
        failedDeliveries,
        successRate,
        averageDeliveryTime,
      };

    } catch (error) {
      console.error('Failed to get delivery statistics:', error);
      return {
        totalAttempts: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        averageDeliveryTime: 0,
      };
    }
  }

  /**
   * Process batched events
   */
  private async processBatch(): Promise<void> {
    if (this.batchEvents.length === 0) return;

    const eventsToProcess = [...this.batchEvents];
    this.batchEvents = [];

    try {
      const auditEntries = eventsToProcess.map(event => ({
        event_type: 'notification_delivery',
        user_id: event.recipientUserId,
        team_id: event.teamId,
        notification_type: event.notificationType,
        metadata: {
          recipientEmail: event.recipientEmail,
          teamName: event.teamName,
          deliveryChannel: event.deliveryChannel,
          status: event.status,
          errorMessage: event.errorMessage,
          errorCode: event.errorCode,
          deliveryAttempts: event.deliveryAttempts,
          deliveryDurationMs: event.deliveryDurationMs,
          userAgent: event.userAgent,
          ipAddress: event.ipAddress,
          sessionId: event.sessionId,
          ...event.metadata,
        },
        timestamp: event.timestamp || new Date().toISOString(),
      }));

      await this.insertBatchAuditLogs(auditEntries);

    } catch (error) {
      console.error('Failed to process audit batch:', error);
      // Re-add events to batch for retry
      this.batchEvents.unshift(...eventsToProcess);
    }
  }

  /**
   * Start batch processing timer
   */
  private startBatchProcessing(): void {
    this.batchTimer = setInterval(async () => {
      await this.processBatch();
    }, this.BATCH_TIMEOUT);
  }

  /**
   * Log critical error immediately
   */
  private async logCriticalError(event: NotificationAuditEvent): Promise<void> {
    try {
      const criticalEntry = {
        event_type: 'critical_notification_error',
        user_id: event.recipientUserId,
        team_id: event.teamId,
        notification_type: event.notificationType,
        metadata: {
          errorMessage: event.errorMessage,
          errorCode: event.errorCode,
          recipientEmail: event.recipientEmail,
          teamName: event.teamName,
          deliveryChannel: event.deliveryChannel,
          severity: 'CRITICAL',
          requiresImmedateAttention: true,
          ...event.metadata,
        },
        timestamp: new Date().toISOString(),
      };

      await this.insertAuditLog(criticalEntry);

      // Also log to console for immediate visibility
      console.error('🚨 CRITICAL NOTIFICATION ERROR:', criticalEntry);

    } catch (error) {
      console.error('Failed to log critical error:', error);
    }
  }

  /**
   * Insert single audit log entry
   */
  private async insertAuditLog(entry: any): Promise<void> {
    const { error } = await supabase
      .from('notification_audit_log')
      .insert(entry);

    if (error) {
      console.error('Failed to insert audit log:', error);
      throw error;
    }
  }

  /**
   * Insert batch audit log entries
   */
  private async insertBatchAuditLogs(entries: any[]): Promise<void> {
    const { error } = await supabase
      .from('notification_audit_log')
      .insert(entries);

    if (error) {
      console.error('Failed to insert batch audit logs:', error);
      throw error;
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  public cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Process remaining events
    if (this.batchEvents.length > 0) {
      this.processBatch().catch(error => {
        console.error('Failed to process final batch during cleanup:', error);
      });
    }
  }
}

export const notificationAuditService = NotificationAuditService.getInstance();
