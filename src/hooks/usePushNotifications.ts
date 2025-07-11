import { useState, useEffect, useCallback, useRef } from 'react';
import { PushNotificationService } from '@/services/pushNotificationService';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PushNotificationState {
  isSupported: boolean;
  isInitialized: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string | null;
}

export interface PushNotificationActions {
  initialize: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  showTestNotification: () => Promise<void>;
  clearError: () => void;
}

export function usePushNotifications(): PushNotificationState & PushNotificationActions {
  const { user } = useAuth();
  const [pushService] = useState(() => new PushNotificationService());
  
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isInitialized: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: false,
    error: null
  });

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
      setState(prev => ({
        ...prev,
        isSupported,
        permission: 'Notification' in window ? Notification.permission : 'denied'
      }));
    };

    checkSupport();
  }, []);

  // Initialize push service when user is available
  useEffect(() => {
    if (user && state.isSupported && !state.isInitialized) {
      initialize();
    }
  }, [user, state.isSupported, state.isInitialized]);

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Push notifications not supported' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await pushService.initialize();
      
      setState(prev => ({
        ...prev,
        isInitialized: success,
        isSubscribed: pushService.isSubscribed(),
        permission: pushService.getPermissionStatus(),
        isLoading: false
      }));

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize push notifications';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      return false;
    }
  }, [pushService, state.isSupported]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await pushService.requestPermission();
      
      setState(prev => ({
        ...prev,
        permission,
        isLoading: false
      }));

      if (permission === 'granted') {
        toast.success('Push notifications enabled successfully');
      } else if (permission === 'denied') {
        toast.error('Push notifications were denied. You can enable them in your browser settings.');
      }

      return permission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      toast.error('Failed to request notification permission');
      return 'denied';
    }
  }, [pushService]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      setState(prev => ({ ...prev, error: 'Push service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await pushService.subscribe();
      
      setState(prev => ({
        ...prev,
        isSubscribed: success,
        permission: pushService.getPermissionStatus(),
        isLoading: false
      }));

      if (success) {
        toast.success('Successfully subscribed to push notifications');
      } else {
        toast.error('Failed to subscribe to push notifications');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      toast.error('Failed to subscribe to push notifications');
      return false;
    }
  }, [pushService, state.isInitialized]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await pushService.unsubscribe();
      
      setState(prev => ({
        ...prev,
        isSubscribed: !success,
        isLoading: false
      }));

      if (success) {
        toast.success('Successfully unsubscribed from push notifications');
      } else {
        toast.error('Failed to unsubscribe from push notifications');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      toast.error('Failed to unsubscribe from push notifications');
      return false;
    }
  }, [pushService]);

  const showTestNotification = useCallback(async (): Promise<void> => {
    if (!state.isSubscribed) {
      toast.error('Not subscribed to push notifications');
      return;
    }

    try {
      await pushService.showLocalNotification({
        title: 'Test Notification',
        body: 'This is a test notification from Mataresit',
        icon: '/mataresit-icon.png',
        tag: 'test-notification',
        data: {
          type: 'receipt_processing_completed',
          actionUrl: '/dashboard'
        },
        actions: [
          {
            action: 'view',
            title: 'View Dashboard'
          }
        ]
      });

      toast.success('Test notification sent');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to show test notification';
      toast.error(errorMessage);
    }
  }, [pushService, state.isSubscribed]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    initialize,
    requestPermission,
    subscribe,
    unsubscribe,
    showTestNotification,
    clearError
  };
}

// DEPRECATED: Hook for checking notification preferences
// This hook is now deprecated. Use useNotifications() from NotificationContext instead
// which provides centralized preferences to avoid multiple API calls.
export function useNotificationPreferences() {
  console.error('🚫 useNotificationPreferences is DEPRECATED and DISABLED. Use useNotifications().preferences instead for better performance.');

  // Return empty state immediately to prevent any API calls
  return {
    preferences: null,
    isLoading: false,
    error: 'This hook is deprecated. Use useNotifications().preferences instead.',
    loadPreferences: async () => {
      console.error('🚫 loadPreferences is disabled. Use useNotifications().loadPreferences instead.');
    },
    updatePreferences: async () => {
      console.error('🚫 updatePreferences is disabled. Use useNotifications().updatePreferences instead.');
    }
  };

  // All implementation removed to prevent infinite loading issues
}
