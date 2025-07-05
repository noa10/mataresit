import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { notificationService } from '@/services/notificationService';
import { Notification, NotificationFilters, shouldShowNotificationWithPreferences } from '@/types/notifications';
import { useNotificationPreferences } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

// Notification state interface
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// Notification actions
type NotificationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'UPDATE_NOTIFICATION'; payload: { id: string; updates: Partial<Notification> } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'INCREMENT_UNREAD_COUNT' }
  | { type: 'DECREMENT_UNREAD_COUNT' }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'ARCHIVE_NOTIFICATION'; payload: string }
  | { type: 'SET_LAST_UPDATED'; payload: string };

// Initial state
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isConnected: false,
  error: null,
  lastUpdated: null,
};

// Reducer function
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    
    case 'SET_NOTIFICATIONS':
      return { 
        ...state, 
        notifications: action.payload, 
        isLoading: false,
        lastUpdated: new Date().toISOString()
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: !action.payload.read_at ? state.unreadCount + 1 : state.unreadCount,
        lastUpdated: new Date().toISOString()
      };
    
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
        ),
        lastUpdated: new Date().toISOString()
      };
    
    case 'REMOVE_NOTIFICATION':
      const removedNotification = state.notifications.find(n => n.id === action.payload);
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: removedNotification && !removedNotification.read_at 
          ? Math.max(0, state.unreadCount - 1) 
          : state.unreadCount,
        lastUpdated: new Date().toISOString()
      };
    
    case 'SET_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload };
    
    case 'INCREMENT_UNREAD_COUNT':
      return { ...state, unreadCount: state.unreadCount + 1 };
    
    case 'DECREMENT_UNREAD_COUNT':
      return { ...state, unreadCount: Math.max(0, state.unreadCount - 1) };
    
    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload && !n.read_at
            ? { ...n, read_at: new Date().toISOString() }
            : n
        ),
        unreadCount: state.notifications.find(n => n.id === action.payload && !n.read_at)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
        lastUpdated: new Date().toISOString()
      };
    
    case 'MARK_ALL_AS_READ':
      const unreadNotifications = state.notifications.filter(n => !n.read_at);
      return {
        ...state,
        notifications: state.notifications.map(n => 
          !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
        ),
        unreadCount: 0,
        lastUpdated: new Date().toISOString()
      };
    
    case 'ARCHIVE_NOTIFICATION':
      const archivedNotification = state.notifications.find(n => n.id === action.payload);
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload
            ? { ...n, archived_at: new Date().toISOString() }
            : n
        ),
        unreadCount: archivedNotification && !archivedNotification.read_at
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
        lastUpdated: new Date().toISOString()
      };
    
    case 'SET_LAST_UPDATED':
      return { ...state, lastUpdated: action.payload };
    
    default:
      return state;
  }
}

// Context interface
interface NotificationContextType {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: string | null;
  
  // Actions
  loadNotifications: (filters?: NotificationFilters) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  
  // Real-time connection management
  reconnect: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { preferences: notificationPreferences } = useNotificationPreferences();
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const retryAttempts = useRef(0);
  const maxRetryAttempts = parseInt(import.meta.env.VITE_REALTIME_MAX_RETRIES || '3', 10);
  const fallbackMode = useRef(false);

  // Load notifications from the server
  const loadNotifications = useCallback(async (filters?: NotificationFilters) => {
    if (!user) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const teamFilters = {
        ...filters,
        team_id: currentTeam?.id || filters?.team_id,
      };

      const notifications = await notificationService.getUserNotifications(teamFilters, 50, 0);
      const unreadCount = await notificationService.getUnreadNotificationCount(currentTeam?.id);

      dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
      dispatch({ type: 'SET_UNREAD_COUNT', payload: unreadCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load notifications';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Error loading notifications:', error);
    }
  }, [user, currentTeam?.id]);

  // Helper function to broadcast changes to other tabs
  const broadcastToOtherTabs = useCallback((action: string, notificationId?: string, notification?: Notification) => {
    try {
      const syncData = {
        action,
        notificationId,
        notification,
        timestamp: Date.now(),
        tabId: Math.random().toString(36).substr(2, 9) // Unique tab identifier
      };

      const key = `notification_sync_${Date.now()}_${Math.random()}`;
      localStorage.setItem(key, JSON.stringify(syncData));

      // Clean up old sync events
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 1000);
    } catch (error) {
      console.error('Error broadcasting to other tabs:', error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      dispatch({ type: 'MARK_AS_READ', payload: notificationId });
      broadcastToOtherTabs('mark_read', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  }, [broadcastToOtherTabs]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllNotificationsAsRead(currentTeam?.id);
      dispatch({ type: 'MARK_ALL_AS_READ' });
      broadcastToOtherTabs('mark_all_read');
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  }, [currentTeam?.id, broadcastToOtherTabs]);

  // Archive notification
  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.archiveNotification(notificationId);
      dispatch({ type: 'ARCHIVE_NOTIFICATION', payload: notificationId });
      broadcastToOtherTabs('archive', notificationId);
      toast.success('Notification archived');
    } catch (error) {
      console.error('Error archiving notification:', error);
      toast.error('Failed to archive notification');
    }
  }, [broadcastToOtherTabs]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: notificationId });
      broadcastToOtherTabs('delete', notificationId);
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  }, [broadcastToOtherTabs]);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
    broadcastToOtherTabs('refresh');
  }, [loadNotifications, broadcastToOtherTabs]);

  // Reconnect to real-time subscriptions
  const reconnect = useCallback(() => {
    dispatch({ type: 'SET_CONNECTED', payload: false });
    // The useEffect will handle reconnection when isConnected becomes false
  }, []);

  // Real-time subscription management
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      return;
    }

    let unsubscribeNotifications: (() => void) | null = null;
    let unsubscribeUpdates: (() => void) | null = null;
    let unsubscribeDeletes: (() => void) | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSetupInProgress = false;

    const setupRealTimeSubscriptions = async () => {
      // Skip real-time setup if in fallback mode
      if (fallbackMode.current) {
        console.log('📱 Skipping real-time setup - in fallback mode');
        return;
      }

      // Prevent multiple simultaneous setup attempts
      if (isSetupInProgress) {
        console.log('🔄 Setup already in progress, skipping...');
        return;
      }

      // Quick real-time availability test
      console.log('🔍 Testing real-time availability...');
      const quickTestResult = await notificationService.quickRealTimeTest();
      if (!quickTestResult) {
        console.warn('⚠️ Real-time not available (quick test failed), switching to fallback mode immediately');
        fallbackMode.current = true;
        dispatch({ type: 'SET_CONNECTED', payload: false });
        dispatch({ type: 'SET_ERROR', payload: null });

        // Only show toast in development or if explicitly requested
        if (import.meta.env.DEV || import.meta.env.VITE_SHOW_REALTIME_STATUS === 'true') {
          toast.info('Real-time notifications unavailable. Using manual refresh mode.', {
            duration: 3000,
          });
        }
        return;
      }

      console.log('✅ Real-time quick test passed, proceeding with setup...');

      isSetupInProgress = true;

      try {
        // Subscribe to new notifications
        unsubscribeNotifications = await notificationService.subscribeToUserNotifications(
          (notification) => {
            // Filter by team if applicable
            if (!currentTeam?.id || notification.team_id === currentTeam.id) {
              // Apply enhanced filtering logic to prevent unwanted notifications
              if (shouldShowNotificationWithPreferences(notification, notificationPreferences)) {
                dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

                // Show toast for high priority notifications
                if (notification.priority === 'high') {
                  if (notification.action_url) {
                    toast(notification.title, {
                      description: notification.message,
                      action: {
                        label: 'View',
                        onClick: () => window.open(notification.action_url, '_blank'),
                      },
                    });
                  } else {
                    toast(notification.title, {
                      description: notification.message,
                    });
                  }
                }
              } else {
                console.log(`🚫 Filtered out notification: ${notification.type} - ${notification.title}`);
              }
            }
          },
          currentTeam?.id
        );

        // Subscribe to notification updates (read status, etc.)
        unsubscribeUpdates = await notificationService.subscribeToNotificationUpdates(
          '*', // Subscribe to all notification updates for the user
          (updatedNotification) => {
            console.log('📝 Notification updated:', updatedNotification.id, {
              read_at: updatedNotification.read_at,
              archived_at: updatedNotification.archived_at
            });

            dispatch({
              type: 'UPDATE_NOTIFICATION',
              payload: {
                id: updatedNotification.id,
                updates: updatedNotification
              }
            });

            // Update unread count if read status changed
            const currentNotification = state.notifications.find(n => n.id === updatedNotification.id);
            if (currentNotification) {
              const wasUnread = !currentNotification.read_at;
              const isNowRead = !!updatedNotification.read_at;

              if (wasUnread && isNowRead) {
                dispatch({ type: 'DECREMENT_UNREAD_COUNT' });
              } else if (!wasUnread && !isNowRead) {
                dispatch({ type: 'INCREMENT_UNREAD_COUNT' });
              }
            }
          }
        );

        // Subscribe to notification deletions for cross-tab synchronization
        unsubscribeDeletes = await notificationService.subscribeToAllUserNotificationChanges(
          (event, notification) => {
            if (event === 'DELETE') {
              console.log('🗑️ Notification deleted in another tab:', notification.id);
              dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
            }
          },
          currentTeam?.id
        );

        dispatch({ type: 'SET_CONNECTED', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        retryAttempts.current = 0; // Reset retry counter on success
        isSetupInProgress = false;

        console.log('✅ Real-time notification subscriptions established');
      } catch (error) {
        isSetupInProgress = false;
        console.error('Failed to setup real-time subscriptions:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to real-time updates' });
        dispatch({ type: 'SET_CONNECTED', payload: false });

        // Retry connection with exponential backoff and max attempts
        retryAttempts.current++;
        if (retryAttempts.current <= maxRetryAttempts && !fallbackMode.current) {
          const delay = Math.min(5000 * Math.pow(2, retryAttempts.current - 1), 30000); // Max 30 seconds
          console.log(`🔄 Retrying real-time connection... (${retryAttempts.current}/${maxRetryAttempts}) in ${delay}ms`);

          reconnectTimeout = setTimeout(() => {
            if (!fallbackMode.current) { // Double-check fallback mode before retry
              setupRealTimeSubscriptions();
            }
          }, delay);
        } else {
          console.error('❌ Max retry attempts reached. Switching to fallback mode.');
          fallbackMode.current = true;
          dispatch({ type: 'SET_ERROR', payload: null }); // Clear error to allow app to function
          dispatch({ type: 'SET_CONNECTED', payload: false });

          // Log diagnostic information
          const connectionState = notificationService.getConnectionState();
          console.log('🔍 Connection diagnostic:', connectionState);

          // In fallback mode, we'll rely on manual refresh and polling
          console.log('📱 Real-time notifications disabled. Using fallback mode.');

          // Show user-friendly message about fallback mode
          toast.info('Real-time notifications unavailable. Using manual refresh mode.', {
            duration: 5000,
          });
        }
      }
    };

    // Initial setup
    setupRealTimeSubscriptions();

    // Cleanup function
    return () => {
      isSetupInProgress = false;
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
      if (unsubscribeUpdates) {
        unsubscribeUpdates();
      }
      if (unsubscribeDeletes) {
        unsubscribeDeletes();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      dispatch({ type: 'SET_CONNECTED', payload: false });
    };
  }, [user, currentTeam?.id]);

  // Load initial notifications when user or team changes
  useEffect(() => {
    if (user) {
      loadNotifications();
      // Reset fallback mode when user changes (fresh start)
      fallbackMode.current = false;
      retryAttempts.current = 0;
    }
  }, [user, currentTeam?.id, loadNotifications]);

  // Cross-tab synchronization using localStorage
  useEffect(() => {
    if (!user) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key?.startsWith('notification_sync_')) return;

      try {
        const syncData = JSON.parse(event.newValue || '{}');
        const { action, notificationId, notification, timestamp } = syncData;

        // Ignore old events (older than 5 seconds)
        if (Date.now() - timestamp > 5000) return;

        console.log('🔄 Cross-tab sync event:', action, notificationId);

        switch (action) {
          case 'mark_read':
            dispatch({ type: 'MARK_AS_READ', payload: notificationId });
            break;
          case 'mark_all_read':
            dispatch({ type: 'MARK_ALL_AS_READ' });
            break;
          case 'archive':
            dispatch({ type: 'ARCHIVE_NOTIFICATION', payload: notificationId });
            break;
          case 'delete':
            dispatch({ type: 'REMOVE_NOTIFICATION', payload: notificationId });
            break;
          case 'update':
            if (notification) {
              dispatch({
                type: 'UPDATE_NOTIFICATION',
                payload: { id: notificationId, updates: notification }
              });
            }
            break;
          case 'refresh':
            // Trigger a refresh in other tabs
            loadNotifications();
            break;
        }
      } catch (error) {
        console.error('Error handling cross-tab sync:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, loadNotifications]);

  // Handle connection status changes
  useEffect(() => {
    if (!state.isConnected && user) {
      // Connection lost, try to reconnect after a delay
      const reconnectTimeout = setTimeout(() => {
        console.log('🔄 Attempting to reconnect to real-time notifications...');
        // The real-time subscription effect will handle reconnection
      }, 3000);

      return () => clearTimeout(reconnectTimeout);
    }
  }, [state.isConnected, user]);

  // Handle tab visibility changes for performance optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Tab became visible, refresh notifications to ensure sync
        console.log('🔄 Tab became visible, refreshing notifications...');
        loadNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, loadNotifications]);

  const contextValue: NotificationContextType = {
    // State
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isLoading: state.isLoading,
    isConnected: state.isConnected,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    reconnect,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
