/**
 * Team Removal Notification Service
 * Handles in-app and email notifications for team member removals
 */

import { notificationService } from './notificationService';
import { EmailNotificationService } from './emailNotificationService';
import { notificationAuditService } from './notificationAuditService';
import { supabase } from '@/integrations/supabase/client';
import { NotificationType } from '@/types/notifications';

export interface TeamRemovalNotificationData {
  removedUserId: string;
  removedUserEmail: string;
  removedUserName: string;
  teamId: string;
  teamName: string;
  removalReason?: string;
  removedByUserId: string;
  removedByUserName: string;
  removedByUserEmail: string;
  removalTimestamp: string;
  isOwnerRemoval?: boolean;
  transferredToUserId?: string;
  transferredToUserName?: string;
}

export interface BulkRemovalNotificationData {
  removedUsers: Array<{
    userId: string;
    email: string;
    name: string;
  }>;
  teamId: string;
  teamName: string;
  removalReason?: string;
  removedByUserId: string;
  removedByUserName: string;
  removedByUserEmail: string;
  removalTimestamp: string;
  transferredToUserId?: string;
  transferredToUserName?: string;
}

export class TeamRemovalNotificationService {
  /**
   * Send notification for individual team member removal
   */
  static async notifyMemberRemoval(data: TeamRemovalNotificationData): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('🔔 Sending team removal notification for user:', data.removedUserId);

      // Check if user wants notifications for team removals
      const shouldSendInApp = await this.shouldSendInAppNotification(data.removedUserId);
      const shouldSendEmail = await this.shouldSendEmailNotification(data.removedUserId);

      // Log preference checks
      await notificationAuditService.logPreferenceCheck(
        data.removedUserId,
        'team_member_removed',
        'in_app',
        shouldSendInApp,
        shouldSendInApp ? 'User preferences allow in-app notifications' : 'User has disabled in-app notifications'
      );

      await notificationAuditService.logPreferenceCheck(
        data.removedUserId,
        'team_member_removed',
        'email',
        shouldSendEmail,
        shouldSendEmail ? 'User preferences allow email notifications' : 'User has disabled email notifications'
      );

      if (!shouldSendInApp && !shouldSendEmail) {
        console.log('User has disabled team removal notifications');

        // Log that notifications were skipped
        await notificationAuditService.logTeamRemovalNotification(
          data.removedUserId,
          data.removedUserEmail,
          data.teamId,
          data.teamName,
          'in_app',
          'skipped',
          'User has disabled all team removal notifications',
          { reason: 'user_preferences_disabled' }
        );

        return;
      }

      // Get user's language preference
      const userLanguage = await this.getUserLanguagePreference(data.removedUserId);

      // Send in-app notification
      if (shouldSendInApp) {
        await this.sendInAppRemovalNotification(data, userLanguage);
      }

      // Send email notification
      if (shouldSendEmail) {
        await this.sendEmailRemovalNotification(data, userLanguage);
      }

      const totalDuration = Date.now() - startTime;
      console.log(`✅ Team removal notifications sent successfully in ${totalDuration}ms`);

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error('❌ Error sending team removal notification:', error);

      // Log the error
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'in_app',
        'failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          errorCode: 'NOTIFICATION_SEND_FAILED',
          durationMs: totalDuration,
          stackTrace: error instanceof Error ? error.stack : undefined,
        }
      );

      // Don't throw error to avoid breaking the removal process
    }
  }

  /**
   * Send notifications for bulk team member removal
   */
  static async notifyBulkMemberRemoval(data: BulkRemovalNotificationData): Promise<void> {
    const batchId = `bulk_removal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      console.log('🔔 Sending bulk team removal notifications for', data.removedUsers.length, 'users');

      // Process each removed user individually
      const notificationPromises = data.removedUsers.map(async (removedUser) => {
        const individualData: TeamRemovalNotificationData = {
          removedUserId: removedUser.userId,
          removedUserEmail: removedUser.email,
          removedUserName: removedUser.name,
          teamId: data.teamId,
          teamName: data.teamName,
          removalReason: data.removalReason,
          removedByUserId: data.removedByUserId,
          removedByUserName: data.removedByUserName,
          removedByUserEmail: data.removedByUserEmail,
          removalTimestamp: data.removalTimestamp,
          transferredToUserId: data.transferredToUserId,
          transferredToUserName: data.transferredToUserName,
        };

        return this.notifyMemberRemoval(individualData);
      });

      const results = await Promise.allSettled(notificationPromises);

      // Count successful and failed notifications
      const successfulDeliveries = results.filter(result => result.status === 'fulfilled').length;
      const failedDeliveries = results.filter(result => result.status === 'rejected').length;
      const totalDuration = Date.now() - startTime;

      // Log batch notification event
      await notificationAuditService.logBatchNotificationEvent({
        batchId,
        notificationType: 'team_member_removed',
        totalRecipients: data.removedUsers.length,
        successfulDeliveries,
        failedDeliveries,
        skippedDeliveries: 0, // Individual notifications handle skipping
        teamId: data.teamId,
        teamName: data.teamName,
        batchDurationMs: totalDuration,
        metadata: {
          removalReason: data.removalReason,
          removedByUserId: data.removedByUserId,
          removedByUserName: data.removedByUserName,
          transferredToUserId: data.transferredToUserId,
          transferredToUserName: data.transferredToUserName,
          removedUserIds: data.removedUsers.map(u => u.userId),
        },
      });

      console.log(`✅ Bulk team removal notifications processed: ${successfulDeliveries} successful, ${failedDeliveries} failed in ${totalDuration}ms`);

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error('❌ Error sending bulk team removal notifications:', error);

      // Log batch failure
      await notificationAuditService.logBatchNotificationEvent({
        batchId,
        notificationType: 'team_member_removed',
        totalRecipients: data.removedUsers.length,
        successfulDeliveries: 0,
        failedDeliveries: data.removedUsers.length,
        skippedDeliveries: 0,
        teamId: data.teamId,
        teamName: data.teamName,
        batchDurationMs: totalDuration,
        metadata: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          errorCode: 'BULK_NOTIFICATION_FAILED',
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  }

  /**
   * Send in-app notification for team removal
   */
  private static async sendInAppRemovalNotification(
    data: TeamRemovalNotificationData,
    language: 'en' | 'ms'
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Log attempt
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'in_app',
        'attempted',
        undefined,
        { language, startTime }
      );

      const { title, message } = this.getInAppNotificationContent(data, language);

      await notificationService.createNotification(
        data.removedUserId,
        'team_member_removed' as NotificationType,
        title,
        message,
        {
          teamId: data.teamId,
          priority: 'high',
          actionUrl: '/teams',
          relatedEntityType: 'team',
          relatedEntityId: data.teamId,
          metadata: {
            teamName: data.teamName,
            removedByUserId: data.removedByUserId,
            removedByUserName: data.removedByUserName,
            removalReason: data.removalReason,
            removalTimestamp: data.removalTimestamp,
            transferredToUserId: data.transferredToUserId,
            transferredToUserName: data.transferredToUserName,
          },
        }
      );

      const deliveryTime = Date.now() - startTime;

      // Log successful delivery
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'in_app',
        'delivered',
        undefined,
        {
          language,
          deliveryDurationMs: deliveryTime,
          title,
          message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        }
      );

    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      // Log failed delivery
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'in_app',
        'failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          language,
          deliveryDurationMs: deliveryTime,
          errorCode: 'IN_APP_NOTIFICATION_FAILED',
          stackTrace: error instanceof Error ? error.stack : undefined,
        }
      );

      throw error; // Re-throw to be handled by parent
    }
  }

  /**
   * Send email notification for team removal
   */
  private static async sendEmailRemovalNotification(
    data: TeamRemovalNotificationData,
    language: 'en' | 'ms'
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Log attempt
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'email',
        'attempted',
        undefined,
        { language, startTime }
      );

      const templateData = {
        removedUserName: data.removedUserName,
        teamName: data.teamName,
        removedByUserName: data.removedByUserName,
        removedByUserEmail: data.removedByUserEmail,
        removalReason: data.removalReason,
        removalTimestamp: new Date(data.removalTimestamp).toLocaleString(
          language === 'ms' ? 'ms-MY' : 'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          }
        ),
        transferredToUserName: data.transferredToUserName,
        language,
      };

      // Send email via Edge Function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: data.removedUserEmail,
          template_name: 'team_member_removed',
          template_data: templateData,
          related_entity_type: 'team',
          related_entity_id: data.teamId,
          team_id: data.teamId,
          metadata: {
            notification_type: 'team_member_removed',
            removed_by_user_id: data.removedByUserId,
            removal_reason: data.removalReason,
          },
        },
      });

      const deliveryTime = Date.now() - startTime;

      if (error) {
        // Log failed delivery
        await notificationAuditService.logTeamRemovalNotification(
          data.removedUserId,
          data.removedUserEmail,
          data.teamId,
          data.teamName,
          'email',
          'failed',
          error.message || 'Email delivery failed',
          {
            language,
            deliveryDurationMs: deliveryTime,
            errorCode: 'EMAIL_DELIVERY_FAILED',
            emailError: error,
          }
        );

        console.error('Failed to send team removal email:', error);
        throw error;
      }

      // Log successful delivery
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'email',
        'delivered',
        undefined,
        {
          language,
          deliveryDurationMs: deliveryTime,
          templateName: 'team_member_removed',
          recipientEmail: data.removedUserEmail,
        }
      );

    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      // Log failed delivery if not already logged
      await notificationAuditService.logTeamRemovalNotification(
        data.removedUserId,
        data.removedUserEmail,
        data.teamId,
        data.teamName,
        'email',
        'failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          language,
          deliveryDurationMs: deliveryTime,
          errorCode: 'EMAIL_NOTIFICATION_FAILED',
          stackTrace: error instanceof Error ? error.stack : undefined,
        }
      );

      throw error; // Re-throw to be handled by parent
    }
  }

  /**
   * Get in-app notification content based on language
   */
  private static getInAppNotificationContent(
    data: TeamRemovalNotificationData,
    language: 'en' | 'ms'
  ): { title: string; message: string } {
    if (language === 'ms') {
      return {
        title: `Anda telah dikeluarkan dari pasukan "${data.teamName}"`,
        message: data.removalReason
          ? `Anda telah dikeluarkan dari pasukan "${data.teamName}" oleh ${data.removedByUserName}. Sebab: ${data.removalReason}`
          : `Anda telah dikeluarkan dari pasukan "${data.teamName}" oleh ${data.removedByUserName}.`,
      };
    }

    return {
      title: `You have been removed from team "${data.teamName}"`,
      message: data.removalReason
        ? `You have been removed from team "${data.teamName}" by ${data.removedByUserName}. Reason: ${data.removalReason}`
        : `You have been removed from team "${data.teamName}" by ${data.removedByUserName}.`,
    };
  }

  /**
   * Check if user wants in-app notifications for team removals
   */
  private static async shouldSendInAppNotification(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('push_team_member_removed')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return true; // Default to sending notifications
      }

      return data.push_team_member_removed ?? true;
    } catch (error) {
      console.error('Error checking in-app notification preference:', error);
      return true; // Default to sending notifications
    }
  }

  /**
   * Check if user wants email notifications for team removals
   */
  private static async shouldSendEmailNotification(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_enabled, email_team_member_removed')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return true; // Default to sending notifications
      }

      return (data.email_enabled ?? true) && (data.email_team_member_removed ?? true);
    } catch (error) {
      console.error('Error checking email notification preference:', error);
      return true; // Default to sending notifications
    }
  }

  /**
   * Get user's language preference
   */
  private static async getUserLanguagePreference(userId: string): Promise<'en' | 'ms'> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return 'en'; // Default to English
      }

      return data.language === 'ms' ? 'ms' : 'en';
    } catch (error) {
      console.error('Error getting user language preference:', error);
      return 'en'; // Default to English
    }
  }
}

export const teamRemovalNotificationService = TeamRemovalNotificationService;
