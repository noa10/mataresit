import { notificationService } from './notificationService';
import { EmailNotificationService } from './emailNotificationService';
import { supabase } from '@/integrations/supabase/client';
import { ProcessingStatus } from '@/types/receipt';
import { NotificationType } from '@/types/notifications';

export interface ReceiptNotificationData {
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

export class ReceiptNotificationService {
  
  // =============================================
  // RECEIPT PROCESSING NOTIFICATIONS
  // =============================================

  static async notifyReceiptProcessingStarted(data: ReceiptNotificationData): Promise<void> {
    try {
      // FILTER OUT: Skip receipt_processing_started notifications (noise reduction)
      // This matches the filtering logic in the EdgeNotificationHelper and database trigger
      console.log(`⏭️ Skipping receipt_processing_started notification for receipt ${data.receiptId} - filtered out for noise reduction (client-side)`);
      return;

      // The following code is commented out but kept for reference:
      /*
      await notificationService.createReceiptProcessingNotification(
        data.userId,
        data.receiptId,
        'receipt_processing_started',
        {
          teamId: data.teamId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency
        }
      );

      console.log(`✅ Receipt processing started notification sent for receipt ${data.receiptId}`);
      */
    } catch (error) {
      console.error('Failed to send receipt processing started notification:', error);
    }
  }

  static async notifyReceiptProcessingCompleted(data: ReceiptNotificationData): Promise<void> {
    try {
      // Send in-app notification
      await notificationService.createReceiptProcessingNotification(
        data.userId,
        data.receiptId,
        'receipt_processing_completed',
        {
          teamId: data.teamId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency
        }
      );

      // Send email notification
      await EmailNotificationService.sendReceiptProcessingEmail(
        data.userId,
        {
          receiptId: data.receiptId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency,
          status: 'completed'
        },
        data.teamId
      );

      console.log(`✅ Receipt processing completed notification sent for receipt ${data.receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt processing completed notification:', error);
    }
  }

  static async notifyReceiptProcessingFailed(data: ReceiptNotificationData): Promise<void> {
    try {
      // Send in-app notification
      await notificationService.createReceiptProcessingNotification(
        data.userId,
        data.receiptId,
        'receipt_processing_failed',
        {
          teamId: data.teamId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency,
          errorMessage: data.errorMessage
        }
      );

      // Send email notification
      await EmailNotificationService.sendReceiptProcessingEmail(
        data.userId,
        {
          receiptId: data.receiptId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency,
          status: 'failed',
          errorMessage: data.errorMessage
        },
        data.teamId
      );

      console.log(`✅ Receipt processing failed notification sent for receipt ${data.receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt processing failed notification:', error);
    }
  }

  static async notifyReceiptReadyForReview(data: ReceiptNotificationData): Promise<void> {
    try {
      await notificationService.createReceiptProcessingNotification(
        data.userId,
        data.receiptId,
        'receipt_ready_for_review',
        {
          teamId: data.teamId,
          merchant: data.merchant,
          total: data.total,
          currency: data.currency
        }
      );

      console.log(`✅ Receipt ready for review notification sent for receipt ${data.receiptId}`);
    } catch (error) {
      console.error('Failed to send receipt ready for review notification:', error);
    }
  }

  // =============================================
  // BATCH PROCESSING NOTIFICATIONS
  // =============================================

  static async notifyBatchProcessingCompleted(data: BatchNotificationData): Promise<void> {
    try {
      // Send in-app notification
      await notificationService.createBatchProcessingNotification(
        data.userId,
        'receipt_batch_completed',
        {
          totalReceipts: data.totalReceipts,
          successfulReceipts: data.successfulReceipts,
          failedReceipts: data.failedReceipts,
          teamId: data.teamId
        }
      );

      // Send email notification
      await EmailNotificationService.sendBatchProcessingEmail(
        data.userId,
        {
          totalReceipts: data.totalReceipts,
          successfulReceipts: data.successfulReceipts || 0,
          failedReceipts: data.failedReceipts || 0
        },
        data.teamId
      );

      console.log(`✅ Batch processing completed notification sent for ${data.totalReceipts} receipts`);
    } catch (error) {
      console.error('Failed to send batch processing completed notification:', error);
    }
  }

  static async notifyBatchProcessingFailed(data: BatchNotificationData): Promise<void> {
    try {
      await notificationService.createBatchProcessingNotification(
        data.userId,
        'receipt_batch_failed',
        {
          totalReceipts: data.totalReceipts,
          successfulReceipts: data.successfulReceipts,
          failedReceipts: data.failedReceipts,
          teamId: data.teamId
        }
      );

      console.log(`✅ Batch processing failed notification sent for ${data.totalReceipts} receipts`);
    } catch (error) {
      console.error('Failed to send batch processing failed notification:', error);
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  static async getReceiptDataForNotification(receiptId: string): Promise<Partial<ReceiptNotificationData> | null> {
    try {
      const { data: receipt, error } = await supabase
        .from('receipts')
        .select('user_id, merchant, total, currency, team_id')
        .eq('id', receiptId)
        .single();

      if (error || !receipt) {
        console.error('Failed to get receipt data for notification:', error);
        return null;
      }

      return {
        receiptId,
        userId: receipt.user_id,
        merchant: receipt.merchant,
        total: receipt.total,
        currency: receipt.currency,
        teamId: receipt.team_id
      };
    } catch (error) {
      console.error('Error getting receipt data for notification:', error);
      return null;
    }
  }

  static async shouldSendNotificationForStatus(
    userId: string,
    status: ProcessingStatus,
    deliveryMethod: 'email' | 'push'
  ): Promise<boolean> {
    try {
      const notificationTypeMap: Record<ProcessingStatus, NotificationType | null> = {
        'uploading': null,
        'uploaded': null,
        'processing': 'receipt_processing_started',
        'complete': 'receipt_processing_completed',
        'failed': 'receipt_processing_failed',
        'error': 'receipt_processing_failed'
      };

      const notificationType = notificationTypeMap[status];
      if (!notificationType) {
        return false;
      }

      return await notificationService.shouldSendNotification(userId, notificationType, deliveryMethod);
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to true if we can't check preferences
      return true;
    }
  }

  // =============================================
  // INTEGRATION WITH RECEIPT PROCESSING
  // =============================================

  static async handleReceiptStatusChange(
    receiptId: string,
    newStatus: ProcessingStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      const receiptData = await this.getReceiptDataForNotification(receiptId);
      if (!receiptData || !receiptData.userId) {
        console.warn(`No receipt data found for notification: ${receiptId}`);
        return;
      }

      // Check if user wants notifications for this status
      const shouldSendPush = await this.shouldSendNotificationForStatus(
        receiptData.userId,
        newStatus,
        'push'
      );
      const shouldSendEmail = await this.shouldSendNotificationForStatus(
        receiptData.userId,
        newStatus,
        'email'
      );

      if (!shouldSendPush && !shouldSendEmail) {
        console.log(`User ${receiptData.userId} has disabled notifications for status: ${newStatus}`);
        return;
      }

      // Send appropriate notification based on status
      switch (newStatus) {
        case 'processing':
          await this.notifyReceiptProcessingStarted(receiptData as ReceiptNotificationData);
          break;
        
        case 'complete':
          await this.notifyReceiptProcessingCompleted(receiptData as ReceiptNotificationData);
          // Also send "ready for review" notification if enabled
          await this.notifyReceiptReadyForReview(receiptData as ReceiptNotificationData);
          break;
        
        case 'failed':
        case 'error':
          await this.notifyReceiptProcessingFailed({
            ...receiptData,
            errorMessage
          } as ReceiptNotificationData);
          break;
        
        default:
          // No notification for uploading, uploaded states
          break;
      }
    } catch (error) {
      console.error('Error handling receipt status change notification:', error);
    }
  }

  static async handleBatchProcessingComplete(
    userId: string,
    results: {
      totalReceipts: number;
      successfulReceipts: number;
      failedReceipts: number;
      batchId?: string;
    },
    teamId?: string
  ): Promise<void> {
    try {
      const batchData: BatchNotificationData = {
        userId,
        totalReceipts: results.totalReceipts,
        successfulReceipts: results.successfulReceipts,
        failedReceipts: results.failedReceipts,
        teamId,
        batchId: results.batchId
      };

      if (results.failedReceipts > 0) {
        // Some receipts failed
        if (results.successfulReceipts === 0) {
          // All failed
          await this.notifyBatchProcessingFailed(batchData);
        } else {
          // Mixed results - send completed notification with failure info
          await this.notifyBatchProcessingCompleted(batchData);
        }
      } else {
        // All successful
        await this.notifyBatchProcessingCompleted(batchData);
      }
    } catch (error) {
      console.error('Error handling batch processing complete notification:', error);
    }
  }

  // =============================================
  // PUSH NOTIFICATION INTEGRATION
  // =============================================

  static async sendPushNotificationForReceipt(
    receiptId: string,
    status: ProcessingStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      const receiptData = await this.getReceiptDataForNotification(receiptId);
      if (!receiptData || !receiptData.userId) {
        return;
      }

      // Call the push notification Edge Function
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: receiptData.userId,
          notificationType: this.getNotificationTypeForStatus(status),
          payload: this.createPushPayloadForReceipt(receiptData, status, errorMessage),
          respectPreferences: true,
          respectQuietHours: true
        }
      });

      if (error) {
        console.error('Failed to send push notification:', error);
      } else {
        console.log('Push notification sent successfully:', data);
      }
    } catch (error) {
      console.error('Error sending push notification for receipt:', error);
    }
  }

  private static getNotificationTypeForStatus(status: ProcessingStatus): string {
    const typeMap: Record<ProcessingStatus, string> = {
      'uploading': 'receipt_processing_started',
      'uploaded': 'receipt_processing_started',
      'processing': 'receipt_processing_started',
      'complete': 'receipt_processing_completed',
      'failed': 'receipt_processing_failed',
      'error': 'receipt_processing_failed'
    };
    return typeMap[status] || 'receipt_processing_started';
  }

  private static createPushPayloadForReceipt(
    receiptData: Partial<ReceiptNotificationData>,
    status: ProcessingStatus,
    errorMessage?: string
  ): any {
    const basePayload = {
      icon: '/mataresit-icon.png',
      tag: `receipt-${receiptData.receiptId}`,
      data: {
        receiptId: receiptData.receiptId,
        actionUrl: `/receipt/${receiptData.receiptId}`,
        type: this.getNotificationTypeForStatus(status)
      }
    };

    switch (status) {
      case 'processing':
        return {
          ...basePayload,
          title: 'Processing Started',
          body: receiptData.merchant
            ? `Processing receipt from ${receiptData.merchant}...`
            : 'Your receipt is being processed...'
        };

      case 'complete':
        return {
          ...basePayload,
          title: 'Receipt Completed',
          body: receiptData.merchant && receiptData.total
            ? `Receipt from ${receiptData.merchant} (${receiptData.currency || 'MYR'} ${receiptData.total}) processed successfully`
            : 'Your receipt has been processed successfully',
          actions: [
            { action: 'view', title: 'View Receipt' }
          ]
        };
      
      case 'failed':
      case 'error':
        return {
          ...basePayload,
          title: 'Receipt Processing Failed',
          body: errorMessage || 'Receipt processing failed. Please try again.',
          requireInteraction: true,
          actions: [
            { action: 'retry', title: 'Retry' },
            { action: 'view', title: 'View Details' }
          ]
        };
      
      default:
        return basePayload;
    }
  }
}

// Export singleton instance
export const receiptNotificationService = new ReceiptNotificationService();
