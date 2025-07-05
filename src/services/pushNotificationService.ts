import { notificationService } from './notificationService';
import { NotificationType, NotificationPriority } from '@/types/notifications';

// VAPID public key for push notifications
// This should be generated and stored securely in production
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HcCWLEaQK07x8hiKAantUM4hM5CxbxrwhHuFAU2dX4tnMJiHG9AJL0x8cs';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: {
    notificationId?: string;
    actionUrl?: string;
    type?: NotificationType;
    priority?: NotificationPriority;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  // =============================================
  // INITIALIZATION AND SETUP
  // =============================================

  async initialize(): Promise<boolean> {
    try {
      // Check if service workers and push notifications are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service workers not supported');
        return false;
      }

      if (!('PushManager' in window)) {
        console.warn('Push messaging not supported');
        return false;
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/'
      });

      console.log('✅ Push notification service worker registered');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Check for existing subscription
      await this.checkExistingSubscription();

      return true;
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      return false;
    }
  }

  private async checkExistingSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();

      if (this.subscription) {
        console.log('✅ Existing push subscription found');
        // Sync with backend
        await this.syncSubscriptionWithBackend();
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  }

  // =============================================
  // PERMISSION MANAGEMENT
  // =============================================

  async requestPermission(): Promise<NotificationPermission> {
    try {
      // Check current permission status
      let permission = Notification.permission;

      if (permission === 'default') {
        // Request permission
        permission = await Notification.requestPermission();
      }

      // Update user preferences based on permission
      if (permission === 'granted') {
        await notificationService.updateNotificationPreferences({
          browser_permission_granted: true,
          browser_permission_requested_at: new Date().toISOString(),
          push_enabled: true
        });
      } else if (permission === 'denied') {
        await notificationService.updateNotificationPreferences({
          browser_permission_granted: false,
          browser_permission_requested_at: new Date().toISOString(),
          push_enabled: false
        });
      }

      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  isPermissionGranted(): boolean {
    return Notification.permission === 'granted';
  }

  // =============================================
  // SUBSCRIPTION MANAGEMENT
  // =============================================

  async subscribe(): Promise<boolean> {
    try {
      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      if (!this.isPermissionGranted()) {
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
          return false;
        }
      }

      // Create push subscription
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log('✅ Push subscription created');

      // Save subscription to backend
      await this.syncSubscriptionWithBackend();

      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        console.log('No active subscription to unsubscribe');
        return true;
      }

      // Unsubscribe from push service
      const success = await this.subscription.unsubscribe();

      if (success) {
        // Remove from backend
        await notificationService.unsubscribeFromPushNotifications(this.subscription.endpoint);

        // Update preferences
        await notificationService.updateNotificationPreferences({
          push_enabled: false
        });

        this.subscription = null;
        console.log('✅ Successfully unsubscribed from push notifications');
      }

      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  private async syncSubscriptionWithBackend(): Promise<void> {
    if (!this.subscription) return;

    try {
      const subscriptionData = {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!)
        }
      };

      await notificationService.subscribeToPushNotifications(
        subscriptionData,
        navigator.userAgent
      );

      console.log('✅ Subscription synced with backend');
    } catch (error) {
      console.error('Failed to sync subscription with backend:', error);
    }
  }

  isSubscribed(): boolean {
    return this.subscription !== null;
  }

  getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  // =============================================
  // LOCAL NOTIFICATION DISPLAY
  // =============================================

  async showLocalNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      if (!this.isPermissionGranted()) {
        console.warn('Cannot show notification: permission not granted');
        return;
      }

      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      // Default notification options
      const options: any = {
        body: payload.body,
        icon: payload.icon || '/mataresit-icon.png',
        badge: payload.badge || '/mataresit-icon.png',
        tag: payload.tag || `notification-${Date.now()}`,
        data: payload.data || {},
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false,
        timestamp: Date.now()
      };

      // Add optional properties if they exist
      if (payload.image) options.image = payload.image;
      if (payload.actions && payload.actions.length > 0) options.actions = payload.actions;

      // Show notification via service worker
      await this.registration.showNotification(payload.title, options);

      console.log('✅ Local notification displayed');
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // =============================================
  // NOTIFICATION HELPERS
  // =============================================

  async showReceiptProcessingNotification(
    type: 'started' | 'completed' | 'failed',
    receiptData: {
      id: string;
      merchant?: string;
      total?: number;
      currency?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    const notifications = {
      started: {
        title: 'Receipt Processing Started',
        body: receiptData.merchant
          ? `Processing receipt from ${receiptData.merchant}...`
          : 'Your receipt is being processed...',
        icon: '/mataresit-icon.png',
        tag: `receipt-processing-${receiptData.id}`,
        data: {
          type: 'receipt_processing_started' as NotificationType,
          actionUrl: `/receipts/${receiptData.id}`,
          receiptId: receiptData.id
        }
      },
      completed: {
        title: 'Receipt Completed',
        body: receiptData.merchant && receiptData.total
          ? `Receipt from ${receiptData.merchant} (${receiptData.currency || 'MYR'} ${receiptData.total}) processed successfully`
          : 'Your receipt has been processed successfully',
        icon: '/mataresit-icon.png',
        tag: `receipt-processing-${receiptData.id}`,
        data: {
          type: 'receipt_processing_completed' as NotificationType,
          actionUrl: `/receipts/${receiptData.id}`,
          receiptId: receiptData.id
        },
        actions: [
          {
            action: 'view',
            title: 'View Receipt'
          }
        ]
      },
      failed: {
        title: 'Receipt Processing Failed',
        body: receiptData.errorMessage || 'Receipt processing failed. Please try again.',
        icon: '/mataresit-icon.png',
        tag: `receipt-processing-${receiptData.id}`,
        data: {
          type: 'receipt_processing_failed' as NotificationType,
          actionUrl: `/receipts/${receiptData.id}`,
          receiptId: receiptData.id,
          priority: 'high' as NotificationPriority
        },
        requireInteraction: true,
        actions: [
          {
            action: 'retry',
            title: 'Retry'
          },
          {
            action: 'view',
            title: 'View Details'
          }
        ]
      }
    };

    await this.showLocalNotification(notifications[type]);
  }

  async showBatchProcessingNotification(
    type: 'completed' | 'failed',
    batchData: {
      totalReceipts: number;
      successfulReceipts?: number;
      failedReceipts?: number;
    }
  ): Promise<void> {
    const isSuccess = type === 'completed';

    let body: string;
    if (isSuccess) {
      body = `Successfully processed ${batchData.successfulReceipts || batchData.totalReceipts} of ${batchData.totalReceipts} receipts`;
      if (batchData.failedReceipts && batchData.failedReceipts > 0) {
        body += ` (${batchData.failedReceipts} failed)`;
      }
    } else {
      body = `Failed to process ${batchData.failedReceipts || batchData.totalReceipts} of ${batchData.totalReceipts} receipts`;
    }

    await this.showLocalNotification({
      title: isSuccess ? 'Batch Processing Completed' : 'Batch Processing Failed',
      body,
      icon: '/mataresit-icon.png',
      tag: `batch-processing-${Date.now()}`,
      data: {
        type: isSuccess ? 'receipt_batch_completed' : 'receipt_batch_failed',
        actionUrl: '/dashboard',
        priority: isSuccess ? 'medium' : 'high'
      },
      requireInteraction: !isSuccess,
      actions: [
        {
          action: 'view',
          title: 'View Dashboard'
        }
      ]
    });
  }
}