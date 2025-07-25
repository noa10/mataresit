import { notificationService } from './notificationService';
import { supabase } from '@/lib/supabase';
import { NotificationType } from '@/types/notifications';

/**
 * Enhanced Member Activity Notification Service
 * 
 * Provides comprehensive real-time notifications for member activities,
 * team changes, and system events with intelligent filtering and batching.
 */

export interface MemberActivityNotificationData {
  teamId: string;
  actorUserId: string;
  actorName: string;
  actorEmail?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  activityType: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  batchable?: boolean;
}

export interface ActivityBatch {
  id: string;
  teamId: string;
  activityType: string;
  count: number;
  actors: Array<{ id: string; name: string }>;
  startTime: Date;
  endTime: Date;
  metadata: Record<string, any>;
}

class MemberActivityNotificationService {
  private batchingEnabled = true;
  private batchWindow = 5 * 60 * 1000; // 5 minutes
  private activeBatches = new Map<string, ActivityBatch>();
  private batchTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Send notification for member activity with intelligent batching
   */
  async notifyMemberActivity(data: MemberActivityNotificationData): Promise<void> {
    try {
      // Check if this activity should be batched
      if (data.batchable && this.batchingEnabled) {
        await this.handleBatchedActivity(data);
      } else {
        await this.sendImmediateNotification(data);
      }
    } catch (error) {
      console.error('Error sending member activity notification:', error);
      throw error;
    }
  }

  /**
   * Send immediate notification for high-priority activities
   */
  private async sendImmediateNotification(data: MemberActivityNotificationData): Promise<void> {
    const { title, message, notificationType } = this.getNotificationContent(data);
    
    // Get team members to notify
    const recipients = await this.getNotificationRecipients(data);
    
    // Send notifications to all recipients
    const notifications = recipients.map(recipient => ({
      recipientId: recipient.user_id,
      type: notificationType,
      title,
      message,
      teamId: data.teamId,
      priority: data.priority || 'medium',
      actionUrl: this.getActionUrl(data),
      relatedEntityType: 'member_activity',
      relatedEntityId: data.targetUserId || data.actorUserId,
      metadata: {
        actorUserId: data.actorUserId,
        actorName: data.actorName,
        targetUserId: data.targetUserId,
        targetUserName: data.targetUserName,
        activityType: data.activityType,
        ...data.metadata
      }
    }));

    if (notifications.length > 0) {
      await notificationService.bulkCreateNotifications(notifications);
    }
  }

  /**
   * Handle batched activities to reduce notification spam
   */
  private async handleBatchedActivity(data: MemberActivityNotificationData): Promise<void> {
    const batchKey = `${data.teamId}-${data.activityType}`;
    const now = new Date();

    let batch = this.activeBatches.get(batchKey);
    
    if (!batch) {
      // Create new batch
      batch = {
        id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        teamId: data.teamId,
        activityType: data.activityType,
        count: 1,
        actors: [{ id: data.actorUserId, name: data.actorName }],
        startTime: now,
        endTime: now,
        metadata: { ...data.metadata }
      };
      
      this.activeBatches.set(batchKey, batch);
      
      // Set timer to send batched notification
      const timer = setTimeout(() => {
        this.sendBatchedNotification(batchKey);
      }, this.batchWindow);
      
      this.batchTimers.set(batchKey, timer);
    } else {
      // Update existing batch
      batch.count++;
      batch.endTime = now;
      
      // Add actor if not already included
      if (!batch.actors.find(actor => actor.id === data.actorUserId)) {
        batch.actors.push({ id: data.actorUserId, name: data.actorName });
      }
      
      // Merge metadata
      batch.metadata = { ...batch.metadata, ...data.metadata };
    }
  }

  /**
   * Send notification for batched activities
   */
  private async sendBatchedNotification(batchKey: string): Promise<void> {
    const batch = this.activeBatches.get(batchKey);
    if (!batch) return;

    try {
      const { title, message } = this.getBatchedNotificationContent(batch);
      
      // Get team members to notify
      const recipients = await this.getTeamMembers(batch.teamId);
      
      // Exclude actors from notifications to avoid self-notification
      const filteredRecipients = recipients.filter(
        recipient => !batch.actors.find(actor => actor.id === recipient.user_id)
      );
      
      // Send batched notifications
      const notifications = filteredRecipients.map(recipient => ({
        recipientId: recipient.user_id,
        type: this.getBatchedNotificationType(batch.activityType),
        title,
        message,
        teamId: batch.teamId,
        priority: 'medium' as const,
        actionUrl: `/teams/${batch.teamId}/activity`,
        relatedEntityType: 'batch_activity',
        relatedEntityId: batch.id,
        metadata: {
          batchId: batch.id,
          activityType: batch.activityType,
          actorCount: batch.actors.length,
          totalCount: batch.count,
          actors: batch.actors,
          timeRange: {
            start: batch.startTime.toISOString(),
            end: batch.endTime.toISOString()
          },
          ...batch.metadata
        }
      }));

      if (notifications.length > 0) {
        await notificationService.bulkCreateNotifications(notifications);
      }
    } catch (error) {
      console.error('Error sending batched notification:', error);
    } finally {
      // Clean up batch
      this.activeBatches.delete(batchKey);
      const timer = this.batchTimers.get(batchKey);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(batchKey);
      }
    }
  }

  /**
   * Get notification content based on activity type
   */
  private getNotificationContent(data: MemberActivityNotificationData): {
    title: string;
    message: string;
    notificationType: NotificationType;
  } {
    const contentMap: Record<string, any> = {
      'member_joined': {
        title: 'New Team Member',
        message: `${data.actorName} has joined the team`,
        notificationType: 'team_member_joined'
      },
      'member_left': {
        title: 'Team Member Left',
        message: `${data.actorName} has left the team`,
        notificationType: 'team_member_left'
      },
      'member_role_changed': {
        title: 'Member Role Updated',
        message: `${data.targetUserName || 'A team member'}'s role has been changed by ${data.actorName}`,
        notificationType: 'team_member_role_changed'
      },
      'member_invited': {
        title: 'Team Invitation Sent',
        message: `${data.actorName} invited a new member to join the team`,
        notificationType: 'team_invitation_sent'
      },
      'member_activated': {
        title: 'Member Activated',
        message: `${data.targetUserName || 'A team member'} has been activated by ${data.actorName}`,
        notificationType: 'team_member_updated'
      },
      'member_deactivated': {
        title: 'Member Deactivated',
        message: `${data.targetUserName || 'A team member'} has been deactivated by ${data.actorName}`,
        notificationType: 'team_member_updated'
      },
      'receipt_activity': {
        title: 'Receipt Activity',
        message: `${data.actorName} ${data.metadata?.action || 'updated'} a receipt`,
        notificationType: 'receipt_updated'
      },
      'team_settings_updated': {
        title: 'Team Settings Updated',
        message: `${data.actorName} updated team settings`,
        notificationType: 'team_settings_updated'
      }
    };

    const content = contentMap[data.activityType];
    if (!content) {
      return {
        title: 'Team Activity',
        message: `${data.actorName} performed an activity`,
        notificationType: 'team_activity'
      };
    }

    return content;
  }

  /**
   * Get batched notification content
   */
  private getBatchedNotificationContent(batch: ActivityBatch): {
    title: string;
    message: string;
  } {
    const actorNames = batch.actors.map(actor => actor.name);
    const actorText = actorNames.length === 1 
      ? actorNames[0]
      : actorNames.length === 2
      ? `${actorNames[0]} and ${actorNames[1]}`
      : `${actorNames[0]} and ${actorNames.length - 1} others`;

    const contentMap: Record<string, any> = {
      'receipt_activity': {
        title: 'Multiple Receipt Activities',
        message: `${actorText} ${batch.count === 1 ? 'updated' : `performed ${batch.count} receipt activities`}`
      },
      'member_activity': {
        title: 'Team Member Activities',
        message: `${actorText} ${batch.count === 1 ? 'performed' : `performed ${batch.count}`} team activities`
      }
    };

    const content = contentMap[batch.activityType];
    if (!content) {
      return {
        title: 'Team Activities',
        message: `${actorText} performed ${batch.count} activities`
      };
    }

    return content;
  }

  /**
   * Get notification type for batched activities
   */
  private getBatchedNotificationType(activityType: string): NotificationType {
    const typeMap: Record<string, NotificationType> = {
      'receipt_activity': 'receipt_batch_updated',
      'member_activity': 'team_batch_activity'
    };

    return typeMap[activityType] || 'team_activity';
  }

  /**
   * Get action URL based on activity type
   */
  private getActionUrl(data: MemberActivityNotificationData): string {
    const urlMap: Record<string, string> = {
      'member_joined': `/teams/${data.teamId}/members`,
      'member_left': `/teams/${data.teamId}/members`,
      'member_role_changed': `/teams/${data.teamId}/members`,
      'member_invited': `/teams/${data.teamId}/members`,
      'member_activated': `/teams/${data.teamId}/members`,
      'member_deactivated': `/teams/${data.teamId}/members`,
      'receipt_activity': `/teams/${data.teamId}/receipts`,
      'team_settings_updated': `/teams/${data.teamId}/settings`
    };

    return urlMap[data.activityType] || `/teams/${data.teamId}`;
  }

  /**
   * Get notification recipients based on activity type and team roles
   */
  private async getNotificationRecipients(data: MemberActivityNotificationData): Promise<any[]> {
    // For high-priority activities, notify all team members
    if (data.priority === 'high') {
      return this.getTeamMembers(data.teamId);
    }

    // For role changes, notify the target user and admins
    if (data.activityType === 'member_role_changed' && data.targetUserId) {
      const [targetUser, admins] = await Promise.all([
        this.getTeamMember(data.teamId, data.targetUserId),
        this.getTeamAdmins(data.teamId)
      ]);

      const recipients = [...admins];
      if (targetUser && !recipients.find(r => r.user_id === targetUser.user_id)) {
        recipients.push(targetUser);
      }

      return recipients.filter(r => r.user_id !== data.actorUserId);
    }

    // For other activities, notify team admins and owners
    const admins = await this.getTeamAdmins(data.teamId);
    return admins.filter(admin => admin.user_id !== data.actorUserId);
  }

  /**
   * Get all team members
   */
  private async getTeamMembers(teamId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role, profiles(full_name, email)')
      .eq('team_id', teamId)
      .is('removal_scheduled_at', null);

    if (error) {
      console.error('Error fetching team members:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get team admins and owners
   */
  private async getTeamAdmins(teamId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role, profiles(full_name, email)')
      .eq('team_id', teamId)
      .in('role', ['admin', 'owner'])
      .is('removal_scheduled_at', null);

    if (error) {
      console.error('Error fetching team admins:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get specific team member
   */
  private async getTeamMember(teamId: string, userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role, profiles(full_name, email)')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .is('removal_scheduled_at', null)
      .single();

    if (error) {
      console.error('Error fetching team member:', error);
      return null;
    }

    return data;
  }

  /**
   * Configure batching settings
   */
  configureBatching(enabled: boolean, windowMs?: number): void {
    this.batchingEnabled = enabled;
    if (windowMs) {
      this.batchWindow = windowMs;
    }
  }

  /**
   * Get current batching statistics
   */
  getBatchingStats(): {
    activeBatches: number;
    batchingEnabled: boolean;
    batchWindow: number;
  } {
    return {
      activeBatches: this.activeBatches.size,
      batchingEnabled: this.batchingEnabled,
      batchWindow: this.batchWindow
    };
  }

  /**
   * Force send all pending batched notifications
   */
  async flushPendingBatches(): Promise<void> {
    const batchKeys = Array.from(this.activeBatches.keys());
    
    for (const batchKey of batchKeys) {
      await this.sendBatchedNotification(batchKey);
    }
  }
}

// Export singleton instance
export const memberActivityNotificationService = new MemberActivityNotificationService();
