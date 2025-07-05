import { supabaseClient } from './supabase-client.ts';

export interface NotificationData {
  receiptId: string;
  userId: string;
  merchant?: string;
  total?: number;
  currency?: string;
  errorMessage?: string;
  teamId?: string;
  batchId?: string;
}

export interface BatchNotificationData {
  userId: string;
  totalReceipts: number;
  successfulReceipts?: number;
  failedReceipts?: number;
  teamId?: string;
  batchId?: string;
}

export type ProcessingStatus = 'started' | 'completed' | 'failed' | 'ready_for_review';
export type BatchStatus = 'completed' | 'failed';

/**
 * Edge Function notification helper for sending notifications from Deno environment
 * This helper calls the notification Edge Functions and respects user preferences
 */
export class EdgeNotificationHelper {
  private supabase: any;
  private baseUrl: string;

  constructor(authHeader?: string) {
    this.supabase = supabaseClient(authHeader);
    this.baseUrl = Deno.env.get('SUPABASE_URL') || '';
  }

  /**
   * Check if user has notifications enabled for a specific type
   */
  private async checkUserNotificationPreferences(
    userId: string,
    notificationType: string
  ): Promise<{ pushEnabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }> {
    try {
      // Use the correct table name and get specific preference columns
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .select(`
          push_enabled,
          email_enabled,
          push_${notificationType},
          email_${notificationType}
        `)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Default to enabled if no preferences found, but still apply filtering logic
        console.log(`No notification preferences found for user ${userId}, using defaults with filtering`);
        const inAppEnabled = this.shouldShowInAppNotification(notificationType, {});
        return { pushEnabled: true, emailEnabled: true, inAppEnabled };
      }

      // Check specific notification type preferences
      const pushSpecificKey = `push_${notificationType}` as keyof typeof data;
      const emailSpecificKey = `email_${notificationType}` as keyof typeof data;

      const pushEnabled = data.push_enabled !== false && data[pushSpecificKey] !== false;
      const emailEnabled = data.email_enabled !== false && data[emailSpecificKey] !== false;

      // Apply enhanced filtering logic for in-app notifications
      const inAppEnabled = this.shouldShowInAppNotification(notificationType, data);

      return {
        pushEnabled,
        emailEnabled,
        inAppEnabled
      };
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to enabled on error, but still apply filtering logic
      const inAppEnabled = this.shouldShowInAppNotification(notificationType, {});
      return { pushEnabled: true, emailEnabled: true, inAppEnabled };
    }
  }

  /**
   * Enhanced filtering logic for in-app notifications
   * This implements the same logic as the client-side shouldShowNotificationWithPreferences function
   */
  private shouldShowInAppNotification(notificationType: string, preferences: any): boolean {
    // Check if push notifications are enabled globally first
    if (preferences && preferences.push_enabled === false) {
      return false;
    }

    // Notification type to preference key mapping (synchronized with client-side)
    const notificationTypeToPreferenceKey: Record<string, string | null> = {
      // Receipt processing notifications
      'receipt_processing_started': null, // Not configurable - always hidden
      'receipt_processing_completed': 'push_receipt_processing_completed',
      'receipt_processing_failed': 'push_receipt_processing_failed',
      'receipt_ready_for_review': 'push_receipt_ready_for_review', // Restored - but won't be created anyway
      'receipt_batch_completed': 'push_receipt_batch_completed',
      'receipt_batch_failed': 'push_receipt_batch_failed',

      // Team collaboration notifications
      'team_invitation_sent': 'push_team_invitations',
      'team_invitation_accepted': 'push_team_invitations',
      'team_member_joined': 'push_team_activity',
      'team_member_left': 'push_team_activity',
      'team_member_role_changed': 'push_team_activity',
      'team_settings_updated': 'push_team_activity',

      // Claims notifications (use team activity preference)
      'claim_submitted': 'push_team_activity',
      'claim_approved': 'push_team_activity',
      'claim_rejected': 'push_team_activity',
      'claim_review_requested': 'push_team_activity',

      // Receipt collaboration notifications
      'receipt_shared': 'push_receipt_shared',
      'receipt_comment_added': 'push_receipt_comments',
      'receipt_edited_by_team_member': 'push_receipt_comments',
      'receipt_approved_by_team': 'push_receipt_comments',
      'receipt_flagged_for_review': 'push_receipt_comments',
    };

    const preferenceKey = notificationTypeToPreferenceKey[notificationType];

    // If no preference key is mapped, hide the notification (like processing_started)
    if (preferenceKey === null) {
      return false;
    }

    // If preference key exists, check the user's setting
    if (preferenceKey) {
      const isEnabled = preferences[preferenceKey];
      return typeof isEnabled === 'boolean' ? isEnabled : true;
    }

    // Default to showing if we can't determine the preference
    return true;
  }

  /**
   * Get receipt data for notifications
   */
  private async getReceiptData(receiptId: string): Promise<NotificationData | null> {
    try {
      const { data, error } = await this.supabase
        .from('receipts')
        .select(`
          id,
          user_id,
          merchant,
          total,
          currency,
          team_id
        `)
        .eq('id', receiptId)
        .single();

      if (error || !data) {
        console.error('Error fetching receipt data:', error);
        return null;
      }

      return {
        receiptId: data.id,
        userId: data.user_id,
        merchant: data.merchant,
        total: data.total,
        currency: data.currency,
        teamId: data.team_id
      };
    } catch (error) {
      console.error('Error getting receipt data:', error);
      return null;
    }
  }

  /**
   * Send push notification via Edge Function
   */
  private async sendPushNotification(
    userId: string,
    notificationType: string,
    payload: any
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          userId,
          notificationType,
          payload,
          respectPreferences: true,
          respectQuietHours: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Push notification failed:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Push notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send email notification via Edge Function
   */
  private async sendEmailNotification(
    userId: string,
    templateName: string,
    templateData: any,
    relatedEntityType: string,
    relatedEntityId: string,
    teamId?: string
  ): Promise<boolean> {
    try {
      // Get user email
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', userId)
        .single();

      if (profileError || !userProfile?.email) {
        console.error('Could not get user email for notification:', profileError);
        return false;
      }

      const response = await fetch(`${this.baseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          to: userProfile.email,
          template_name: templateName,
          template_data: templateData,
          related_entity_type: relatedEntityType,
          related_entity_id: relatedEntityId,
          team_id: teamId,
          metadata: {
            notification_type: templateName,
            user_id: userId
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email notification failed:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Email notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    options?: {
      teamId?: string;
      priority?: string;
      actionUrl?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          recipient_id: userId,
          team_id: options?.teamId,
          type,
          priority: options?.priority || 'medium',
          title,
          message,
          action_url: options?.actionUrl,
          related_entity_type: options?.relatedEntityType,
          related_entity_id: options?.relatedEntityId,
          metadata: options?.metadata || {},
        });

      if (error) {
        console.error('Error creating in-app notification:', error);
        return false;
      }

      console.log('✅ In-app notification created');
      return true;
    } catch (error) {
      console.error('Error creating in-app notification:', error);
      return false;
    }
  }

  /**
   * Send receipt processing started notification
   */
  async notifyReceiptProcessingStarted(receiptId: string): Promise<void> {
    try {
      // FILTER OUT: Skip receipt_processing_started notifications entirely (noise reduction)
      // This matches the filtering logic in the client-side and database trigger
      console.log(`⏭️ Skipping receipt_processing_started notification for receipt ${receiptId} - filtered out for noise reduction (Edge Function)`);
      return;

      // The following code is commented out but kept for reference:
      /*
      const receiptData = await this.getReceiptData(receiptId);
      if (!receiptData) {
        console.error('Could not get receipt data for notification');
        return;
      }

      const preferences = await this.checkUserNotificationPreferences(
        receiptData.userId,
        'receipt_processing_started'
      );

      // Create in-app notification only if enabled
      if (preferences.inAppEnabled) {
        await this.createInAppNotification(
          receiptData.userId,
          'receipt_processing_started',
          'Receipt Processing Started',
          `Processing started for receipt from ${receiptData.merchant || 'Unknown Merchant'}`,
          {
            teamId: receiptData.teamId,
            relatedEntityType: 'receipt',
            relatedEntityId: receiptId,
            actionUrl: `/receipt/${receiptId}`,
            metadata: {
              merchant: receiptData.merchant,
              total: receiptData.total,
              currency: receiptData.currency
            }
          }
        );
      } else {
        console.log(`⏭️ Skipping in-app notification for receipt ${receiptId} - user has disabled receipt_processing_started notifications`);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(
          receiptData.userId,
          'receipt_processing_started',
          {
            title: 'Receipt Processing Started',
            body: `Processing started for receipt from ${receiptData.merchant || 'Unknown Merchant'}`,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            data: {
              receiptId,
              url: `/receipt/${receiptId}`
            }
          }
        );
      }

      console.log(`✅ Receipt processing started notification sent for receipt ${receiptId}`);
      */
    } catch (error) {
      console.error('Failed to send receipt processing started notification:', error);
    }
  }

  /**
   * Send receipt processing completed notification
   */
  async notifyReceiptProcessingCompleted(receiptId: string): Promise<void> {
    try {
      const receiptData = await this.getReceiptData(receiptId);
      if (!receiptData) {
        console.error('Could not get receipt data for notification');
        return;
      }

      const preferences = await this.checkUserNotificationPreferences(
        receiptData.userId,
        'receipt_processing_completed'
      );

      const totalText = receiptData.total && receiptData.currency
        ? ` (${receiptData.currency} ${receiptData.total.toFixed(2)})`
        : '';

      // Create in-app notification only if enabled
      if (preferences.inAppEnabled) {
        await this.createInAppNotification(
          receiptData.userId,
          'receipt_processing_completed',
          'Receipt Completed',
          `Receipt from ${receiptData.merchant || 'Unknown Merchant'}${totalText} has been processed successfully`,
          {
            teamId: receiptData.teamId,
            relatedEntityType: 'receipt',
            relatedEntityId: receiptId,
            actionUrl: `/receipt/${receiptId}`,
            metadata: {
              merchant: receiptData.merchant,
              total: receiptData.total,
              currency: receiptData.currency
            }
          }
        );
      } else {
        console.log(`⏭️ Skipping in-app notification for receipt ${receiptId} - user has disabled receipt_processing_completed notifications`);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(
          receiptData.userId,
          'receipt_processing_completed',
          {
            title: 'Receipt Completed',
            body: `Receipt from ${receiptData.merchant || 'Unknown Merchant'}${totalText} is ready for review`,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            data: {
              receiptId,
              url: `/receipt/${receiptId}`
            }
          }
        );
      }

      // Send email notification if enabled
      if (preferences.emailEnabled) {
        await this.sendEmailNotification(
          receiptData.userId,
          'receipt_processing',
          {
            merchant: receiptData.merchant || 'Unknown Merchant',
            total: receiptData.total || 0,
            currency: receiptData.currency || 'MYR',
            status: 'completed',
            receipt_url: `${Deno.env.get('FRONTEND_URL') || 'https://paperless-maverick.vercel.app'}/receipt/${receiptId}`
          },
          'receipt',
          receiptId,
          receiptData.teamId
        );
      }

      console.log(`✅ Receipt processing completed notification sent for receipt ${receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt processing completed notification:', error);
    }
  }

  /**
   * Send receipt processing failed notification
   */
  async notifyReceiptProcessingFailed(receiptId: string, errorMessage?: string): Promise<void> {
    try {
      const receiptData = await this.getReceiptData(receiptId);
      if (!receiptData) {
        console.error('Could not get receipt data for notification');
        return;
      }

      const preferences = await this.checkUserNotificationPreferences(
        receiptData.userId,
        'receipt_processing_failed'
      );

      const errorText = errorMessage ? `: ${errorMessage}` : '';

      // Create in-app notification only if enabled
      if (preferences.inAppEnabled) {
        await this.createInAppNotification(
          receiptData.userId,
          'receipt_processing_failed',
          'Receipt Processing Failed',
          `Failed to process receipt from ${receiptData.merchant || 'Unknown Merchant'}${errorText}`,
          {
            teamId: receiptData.teamId,
            relatedEntityType: 'receipt',
            relatedEntityId: receiptId,
            actionUrl: `/receipt/${receiptId}`,
            priority: 'high',
            metadata: {
              merchant: receiptData.merchant,
              total: receiptData.total,
              currency: receiptData.currency,
              error: errorMessage
            }
          }
        );
      } else {
        console.log(`⏭️ Skipping in-app notification for receipt ${receiptId} - user has disabled receipt_processing_failed notifications`);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(
          receiptData.userId,
          'receipt_processing_failed',
          {
            title: 'Receipt Processing Failed',
            body: `Failed to process receipt from ${receiptData.merchant || 'Unknown Merchant'}`,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            data: {
              receiptId,
              url: `/receipt/${receiptId}`,
              error: errorMessage
            }
          }
        );
      }

      // Send email notification if enabled
      if (preferences.emailEnabled) {
        await this.sendEmailNotification(
          receiptData.userId,
          'receipt_processing',
          {
            merchant: receiptData.merchant || 'Unknown Merchant',
            total: receiptData.total || 0,
            currency: receiptData.currency || 'MYR',
            status: 'failed',
            error_message: errorMessage || 'Unknown error occurred',
            receipt_url: `${Deno.env.get('FRONTEND_URL') || 'https://paperless-maverick.vercel.app'}/receipt/${receiptId}`
          },
          'receipt',
          receiptId,
          receiptData.teamId
        );
      }

      console.log(`✅ Receipt processing failed notification sent for receipt ${receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt processing failed notification:', error);
    }
  }

  /**
   * Send batch processing completed notification
   */
  async notifyBatchProcessingCompleted(batchData: BatchNotificationData): Promise<void> {
    try {
      const preferences = await this.checkUserNotificationPreferences(
        batchData.userId,
        'batch_processing_completed'
      );

      const successCount = batchData.successfulReceipts || 0;
      const failCount = batchData.failedReceipts || 0;
      const statusText = failCount > 0
        ? `${successCount} successful, ${failCount} failed`
        : `${successCount} receipts processed successfully`;

      // Create in-app notification only if enabled
      if (preferences.inAppEnabled) {
        await this.createInAppNotification(
          batchData.userId,
          'receipt_batch_completed',
          'Batch Processing Completed',
          `Batch upload completed: ${statusText}`,
          {
            teamId: batchData.teamId,
            relatedEntityType: 'batch_upload',
            relatedEntityId: batchData.batchId,
            actionUrl: '/dashboard',
            metadata: {
              totalReceipts: batchData.totalReceipts,
              successfulReceipts: successCount,
              failedReceipts: failCount,
              batchId: batchData.batchId
            }
          }
        );
      } else {
        console.log(`⏭️ Skipping in-app notification for batch ${batchData.batchId} - user has disabled batch_processing_completed notifications`);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(
          batchData.userId,
          'receipt_batch_completed',
          {
            title: 'Batch Processing Completed',
            body: `Batch upload completed: ${statusText}`,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            data: {
              batchId: batchData.batchId,
              url: '/dashboard',
              totalReceipts: batchData.totalReceipts,
              successfulReceipts: successCount,
              failedReceipts: failCount
            }
          }
        );
      }

      // Send email notification if enabled
      if (preferences.emailEnabled) {
        await this.sendEmailNotification(
          batchData.userId,
          'batch_processing',
          {
            total_receipts: batchData.totalReceipts,
            successful_receipts: successCount,
            failed_receipts: failCount,
            dashboard_url: `${Deno.env.get('FRONTEND_URL') || 'https://paperless-maverick.vercel.app'}/dashboard`
          },
          'batch_upload',
          batchData.batchId || 'unknown',
          batchData.teamId
        );
      }

      console.log(`✅ Batch processing completed notification sent for user ${batchData.userId}`);
    } catch (error) {
      console.error('Failed to send batch processing completed notification:', error);
    }
  }

  /**
   * Send receipt ready for review notification
   */
  async notifyReceiptReadyForReview(receiptId: string): Promise<void> {
    try {
      const receiptData = await this.getReceiptData(receiptId);
      if (!receiptData) {
        console.error('Could not get receipt data for notification');
        return;
      }

      const preferences = await this.checkUserNotificationPreferences(
        receiptData.userId,
        'receipt_ready_for_review'
      );

      const totalText = receiptData.total && receiptData.currency
        ? ` (${receiptData.currency} ${receiptData.total.toFixed(2)})`
        : '';

      // Create in-app notification only if enabled
      if (preferences.inAppEnabled) {
        await this.createInAppNotification(
          receiptData.userId,
          'receipt_ready_for_review',
          'Review Needed',
          `Receipt from ${receiptData.merchant || 'Unknown Merchant'}${totalText} is ready for review`,
          {
            teamId: receiptData.teamId,
            relatedEntityType: 'receipt',
            relatedEntityId: receiptId,
            actionUrl: `/receipt/${receiptId}`,
            metadata: {
              merchant: receiptData.merchant,
              total: receiptData.total,
              currency: receiptData.currency
            }
          }
        );
      } else {
        console.log(`⏭️ Skipping in-app notification for receipt ${receiptId} - user has disabled receipt_ready_for_review notifications`);
      }

      // Send push notification if enabled
      if (preferences.pushEnabled) {
        await this.sendPushNotification(
          receiptData.userId,
          'receipt_ready_for_review',
          {
            title: 'Review Needed',
            body: `Receipt from ${receiptData.merchant || 'Unknown Merchant'}${totalText} needs your review`,
            icon: '/mataresit-icon.png',
            badge: '/mataresit-icon.png',
            data: {
              receiptId,
              url: `/receipt/${receiptId}`
            }
          }
        );
      }

      console.log(`✅ Receipt ready for review notification sent for receipt ${receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt ready for review notification:', error);
    }
  }
}
