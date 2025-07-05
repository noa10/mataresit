import { supabase } from '@/integrations/supabase/client';
import { NotificationType } from '@/types/notifications';

export interface EmailNotificationData {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  notificationType: NotificationType;
  templateData: any;
  teamId?: string;
  language?: 'en' | 'ms';
}

export interface ReceiptEmailData {
  receiptId: string;
  merchant?: string;
  total?: number;
  currency?: string;
  status: 'started' | 'completed' | 'failed' | 'ready_for_review';
  errorMessage?: string;
}

export interface BatchEmailData {
  totalReceipts: number;
  successfulReceipts: number;
  failedReceipts: number;
}

export interface TeamCollaborationEmailData {
  actorName: string;
  receiptId: string;
  merchant?: string;
  action: 'shared' | 'commented' | 'edited' | 'approved' | 'flagged';
  comment?: string;
  reason?: string;
  message?: string;
  teamName: string;
}

export class EmailNotificationService {
  
  // =============================================
  // RECEIPT PROCESSING EMAIL NOTIFICATIONS
  // =============================================

  static async sendReceiptProcessingEmail(
    recipientId: string,
    receiptData: ReceiptEmailData,
    teamId?: string
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(recipientId);
      if (!userProfile || !userProfile.email) {
        console.warn(`No email found for user ${recipientId}`);
        return;
      }

      // Check if user wants email notifications for this type
      const shouldSend = await this.shouldSendEmailNotification(
        recipientId,
        this.getNotificationTypeForReceiptStatus(receiptData.status)
      );

      if (!shouldSend) {
        console.log(`User ${recipientId} has disabled email notifications for receipt ${receiptData.status}`);
        return;
      }

      // Get team name if applicable
      const teamName = teamId ? await this.getTeamName(teamId) : undefined;

      // Prepare template data
      const templateData = {
        recipientName: this.getUserDisplayName(userProfile),
        receiptId: receiptData.receiptId,
        merchant: receiptData.merchant,
        total: receiptData.total,
        currency: receiptData.currency,
        status: receiptData.status,
        errorMessage: receiptData.errorMessage,
        actionUrl: `${this.getBaseUrl()}/receipts/${receiptData.receiptId}`,
        teamName,
        language: userProfile.preferred_language || 'en',
      };

      // Send email via Edge Function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: userProfile.email,
          template_name: 'receipt_processing',
          template_data: templateData,
          related_entity_type: 'receipt',
          related_entity_id: receiptData.receiptId,
          team_id: teamId,
          metadata: {
            notification_type: this.getNotificationTypeForReceiptStatus(receiptData.status),
            receipt_status: receiptData.status,
            merchant: receiptData.merchant,
          }
        }
      });

      if (error) {
        console.error('Failed to send receipt processing email:', error);
      } else {
        console.log(`✅ Receipt processing email sent to ${userProfile.email} for receipt ${receiptData.receiptId}`);
      }
    } catch (error) {
      console.error('Error sending receipt processing email:', error);
    }
  }

  static async sendBatchProcessingEmail(
    recipientId: string,
    batchData: BatchEmailData,
    teamId?: string
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(recipientId);
      if (!userProfile || !userProfile.email) {
        console.warn(`No email found for user ${recipientId}`);
        return;
      }

      // Check if user wants email notifications for batch processing
      const shouldSend = await this.shouldSendEmailNotification(
        recipientId,
        'batch_processing_completed'
      );

      if (!shouldSend) {
        console.log(`User ${recipientId} has disabled email notifications for batch processing`);
        return;
      }

      // Get team name if applicable
      const teamName = teamId ? await this.getTeamName(teamId) : undefined;

      // Prepare template data
      const templateData = {
        recipientName: this.getUserDisplayName(userProfile),
        totalReceipts: batchData.totalReceipts,
        successfulReceipts: batchData.successfulReceipts,
        failedReceipts: batchData.failedReceipts,
        actionUrl: `${this.getBaseUrl()}/dashboard`,
        teamName,
        language: userProfile.preferred_language || 'en',
      };

      // Send email via Edge Function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: userProfile.email,
          template_name: 'batch_processing',
          template_data: templateData,
          related_entity_type: 'batch_upload',
          team_id: teamId,
          metadata: {
            notification_type: 'batch_processing_completed',
            total_receipts: batchData.totalReceipts,
            successful_receipts: batchData.successfulReceipts,
            failed_receipts: batchData.failedReceipts,
          }
        }
      });

      if (error) {
        console.error('Failed to send batch processing email:', error);
      } else {
        console.log(`✅ Batch processing email sent to ${userProfile.email}`);
      }
    } catch (error) {
      console.error('Error sending batch processing email:', error);
    }
  }

  static async sendTeamCollaborationEmail(
    recipientId: string,
    collaborationData: TeamCollaborationEmailData
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(recipientId);
      if (!userProfile || !userProfile.email) {
        console.warn(`No email found for user ${recipientId}`);
        return;
      }

      // Check if user wants email notifications for team collaboration
      const notificationType = this.getNotificationTypeForCollaboration(collaborationData.action);
      const shouldSend = await this.shouldSendEmailNotification(recipientId, notificationType);

      if (!shouldSend) {
        console.log(`User ${recipientId} has disabled email notifications for ${collaborationData.action}`);
        return;
      }

      // Prepare template data
      const templateData = {
        recipientName: this.getUserDisplayName(userProfile),
        actorName: collaborationData.actorName,
        receiptId: collaborationData.receiptId,
        merchant: collaborationData.merchant,
        action: collaborationData.action,
        comment: collaborationData.comment,
        reason: collaborationData.reason,
        message: collaborationData.message,
        actionUrl: `${this.getBaseUrl()}/receipts/${collaborationData.receiptId}`,
        teamName: collaborationData.teamName,
        language: userProfile.preferred_language || 'en',
      };

      // Send email via Edge Function
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: userProfile.email,
          template_name: 'team_collaboration',
          template_data: templateData,
          related_entity_type: 'receipt',
          related_entity_id: collaborationData.receiptId,
          metadata: {
            notification_type: notificationType,
            collaboration_action: collaborationData.action,
            actor_name: collaborationData.actorName,
            team_name: collaborationData.teamName,
          }
        }
      });

      if (error) {
        console.error('Failed to send team collaboration email:', error);
      } else {
        console.log(`✅ Team collaboration email sent to ${userProfile.email} for ${collaborationData.action}`);
      }
    } catch (error) {
      console.error('Error sending team collaboration email:', error);
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private static async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, preferred_language')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  private static async shouldSendEmailNotification(userId: string, notificationType: NotificationType): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('get_user_notification_preferences', {
        _user_id: userId
      });

      if (error) {
        console.error('Error checking notification preferences:', error);
        return true; // Default to sending if we can't check preferences
      }

      if (!data || !data.email_enabled) {
        return false; // User has disabled email notifications
      }

      // Check specific notification type preferences
      switch (notificationType) {
        case 'receipt_processing_completed':
          return data.email_receipt_processing_completed !== false;
        case 'receipt_processing_failed':
          return data.email_receipt_processing_failed !== false;
        case 'receipt_processing_started':
          return data.email_receipt_processing_completed !== false; // Use same setting
        case 'receipt_ready_for_review':
          return data.email_receipt_ready_for_review !== false;
        case 'receipt_batch_completed':
        case 'batch_processing_completed':
          return data.email_receipt_batch_completed !== false;
        case 'receipt_shared':
        case 'receipt_comment_added':
        case 'receipt_edited_by_team_member':
        case 'receipt_approved_by_team':
        case 'receipt_flagged_for_review':
          return data.email_team_activity !== false;
        default:
          return true; // Default to sending for unknown types
      }
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to sending if we can't check preferences
    }
  }

  private static async getTeamName(teamId: string): Promise<string | undefined> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      if (error) {
        console.error('Error fetching team name:', error);
        return undefined;
      }

      return data?.name;
    } catch (error) {
      console.error('Error fetching team name:', error);
      return undefined;
    }
  }

  private static getUserDisplayName(userProfile: any): string {
    if (userProfile.first_name && userProfile.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return userProfile.email || 'User';
  }

  private static getBaseUrl(): string {
    return process.env.NODE_ENV === 'production' 
      ? 'https://mataresit.com' 
      : 'http://localhost:5173';
  }

  private static getNotificationTypeForReceiptStatus(status: string): NotificationType {
    switch (status) {
      case 'started':
        return 'receipt_processing_started';
      case 'completed':
        return 'receipt_processing_completed';
      case 'failed':
        return 'receipt_processing_failed';
      case 'ready_for_review':
        return 'receipt_ready_for_review';
      default:
        return 'receipt_processing_completed';
    }
  }

  private static getNotificationTypeForCollaboration(action: string): NotificationType {
    switch (action) {
      case 'shared':
        return 'receipt_shared';
      case 'commented':
        return 'receipt_comment_added';
      case 'edited':
        return 'receipt_edited_by_team_member';
      case 'approved':
        return 'receipt_approved_by_team';
      case 'flagged':
        return 'receipt_flagged_for_review';
      default:
        return 'receipt_shared';
    }
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
