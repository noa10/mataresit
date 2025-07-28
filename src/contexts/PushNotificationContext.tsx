import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { usePushNotifications, PushNotificationState, PushNotificationActions } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationType } from '@/types/notifications';
import { PushNotificationService } from '@/services/pushNotificationService';

interface PushNotificationContextType extends PushNotificationState, PushNotificationActions {
  // Additional context-specific methods
  sendReceiptNotification: (
    type: 'started' | 'completed' | 'failed',
    receiptData: {
      id: string;
      merchant?: string;
      total?: number;
      currency?: string;
      errorMessage?: string;
    }
  ) => Promise<void>;

  sendBatchNotification: (
    type: 'completed' | 'failed',
    batchData: {
      totalReceipts: number;
      successfulReceipts?: number;
      failedReceipts?: number;
    }
  ) => Promise<void>;

  showTestNotification: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

interface PushNotificationProviderProps {
  children: ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user } = useAuth();
  const pushNotifications = usePushNotifications();
  const { notifications, lastUpdated, preferences: centralizedPreferences } = useNotifications();

  // Auto-initialize when user is available and push is supported
  useEffect(() => {
    if (user && pushNotifications.isSupported && !pushNotifications.isInitialized) {
      pushNotifications.initialize();
    }
  }, [user, pushNotifications.isSupported, pushNotifications.isInitialized]);

  // Listen for new notifications from centralized state and show push notifications
  useEffect(() => {
    if (!user || !pushNotifications.isSubscribed || !lastUpdated) return;

    // Get the most recent notification (first in the array)
    const latestNotification = notifications[0];

    if (latestNotification && !latestNotification.read_at) {
      // Check if this is a new notification (created within the last 10 seconds)
      const notificationAge = Date.now() - new Date(latestNotification.created_at).getTime();
      const isNewNotification = notificationAge < 10000; // 10 seconds

      if (isNewNotification) {
        // Check if we should show a push notification for this type
        shouldShowPushNotification(latestNotification.type).then(shouldShow => {
          if (shouldShow) {
            showNotificationForType(latestNotification);
          }
        });
      }
    }
  }, [user, pushNotifications.isSubscribed, notifications, lastUpdated]);

  const shouldShowPushNotification = useCallback(async (type: NotificationType): Promise<boolean> => {
    try {
      if (!user) return false;

      // Use centralized preferences from NotificationContext to avoid duplicate API calls
      if (!centralizedPreferences) {
        console.warn('Push notification preferences not loaded yet');
        return false;
      }

      // Check if push notifications are enabled
      if (!centralizedPreferences.push_enabled) return false;

      // Check specific notification type preference
      const prefKey = `push_${type}` as keyof typeof centralizedPreferences;
      const isEnabled = centralizedPreferences[prefKey];

      return typeof isEnabled === 'boolean' ? isEnabled : true;
    } catch (error) {
      console.error('Error checking push notification preferences:', error);
      return false;
    }
  }, [user, centralizedPreferences]);

  const showNotificationForType = async (notification: any) => {
    try {
      const payload = {
        title: notification.title,
        body: notification.message,
        icon: '/mataresit-icon.png',
        tag: `notification-${notification.id}`,
        data: {
          notificationId: notification.id,
          actionUrl: notification.action_url,
          type: notification.type,
          priority: notification.priority
        }
      };

      // Add actions based on notification type
      switch (notification.type) {
        case 'receipt_processing_completed':
          payload.actions = [
            { action: 'view', title: 'View Receipt' }
          ];
          break;
          
        case 'receipt_processing_failed':
          payload.actions = [
            { action: 'retry', title: 'Retry' },
            { action: 'view', title: 'View Details' }
          ];
          payload.requireInteraction = true;
          break;
          
        case 'receipt_shared':
        case 'receipt_comment_added':
          payload.actions = [
            { action: 'view', title: 'View Receipt' }
          ];
          break;
          
        case 'team_invitation_sent':
          payload.actions = [
            { action: 'view', title: 'View Invitation' }
          ];
          payload.requireInteraction = true;
          break;
      }

      // Show the notification using the push service
      const pushService = new PushNotificationService();
      await pushService.showLocalNotification(payload);
      
    } catch (error) {
      console.error('Error showing push notification:', error);
    }
  };

  const sendReceiptNotification = async (
    type: 'started' | 'completed' | 'failed',
    receiptData: {
      id: string;
      merchant?: string;
      total?: number;
      currency?: string;
      errorMessage?: string;
    }
  ) => {
    try {
      const pushService = new PushNotificationService();
      await pushService.showReceiptProcessingNotification(type, receiptData);
    } catch (error) {
      console.error('Error sending receipt notification:', error);
    }
  };

  const sendBatchNotification = async (
    type: 'completed' | 'failed',
    batchData: {
      totalReceipts: number;
      successfulReceipts?: number;
      failedReceipts?: number;
    }
  ) => {
    try {
      const pushService = new PushNotificationService();
      await pushService.showBatchProcessingNotification(type, batchData);
    } catch (error) {
      console.error('Error sending batch notification:', error);
    }
  };

  const contextValue: PushNotificationContextType = {
    ...pushNotifications,
    sendReceiptNotification,
    sendBatchNotification,
    showTestNotification: pushNotifications.showTestNotification
  };

  return (
    <PushNotificationContext.Provider value={contextValue}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotificationContext(): PushNotificationContextType {
  const context = useContext(PushNotificationContext);
  if (context === undefined) {
    throw new Error('usePushNotificationContext must be used within a PushNotificationProvider');
  }
  return context;
}

// Utility hook for checking if push notifications are available and enabled
export function usePushNotificationStatus() {
  const context = usePushNotificationContext();
  
  return {
    isAvailable: context.isSupported && context.isInitialized,
    isEnabled: context.isSubscribed && context.permission === 'granted',
    canEnable: context.isSupported && context.permission !== 'denied',
    needsPermission: context.permission === 'default',
    isBlocked: context.permission === 'denied'
  };
}

// Utility hook for managing push notification settings
export function usePushNotificationSettings() {
  const context = usePushNotificationContext();
  const { preferences, updatePreferences } = useNotifications();
  
  const togglePushNotifications = async (enabled: boolean) => {
    if (enabled && !context.isSubscribed) {
      // Enable push notifications
      const permission = await context.requestPermission();
      if (permission === 'granted') {
        await context.subscribe();
      }
    } else if (!enabled && context.isSubscribed) {
      // Disable push notifications
      await context.unsubscribe();
    }
    
    // Update preferences
    await updatePreferences({ push_enabled: enabled });
  };

  const toggleNotificationType = async (type: string, enabled: boolean) => {
    const prefKey = `push_${type}`;
    await updatePreferences({ [prefKey]: enabled });
  };

  return {
    preferences,
    togglePushNotifications,
    toggleNotificationType,
    isLoading: context.isLoading
  };
}

// REMOVED: Re-export of deprecated useNotificationPreferences hook
// Use useNotifications() from NotificationContext instead for centralized preferences
