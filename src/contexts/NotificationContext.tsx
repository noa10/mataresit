import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef, ReactNode, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { notificationService } from '@/services/notificationService';
import { Notification, NotificationFilters, NotificationType, NotificationPriority, shouldShowNotificationWithPreferences, NotificationPreferences } from '@/types/notifications';
import { toast } from 'sonner';
import { performanceMonitor } from '@/services/realTimePerformanceMonitor';

// OPTIMIZATION: Enhanced rate limiting and throttling utilities
interface RateLimiterOptions {
  maxCalls: number;
  windowMs: number;
  throttleMs?: number;
  burstLimit?: number;
}

class RateLimiter {
  private calls: number[] = [];
  private throttleTimeout: NodeJS.Timeout | null = null;
  private burstCount = 0;
  private lastResetTime = Date.now();

  constructor(private options: RateLimiterOptions) {}

  canExecute(): boolean {
    const now = Date.now();

    // Reset burst count every second
    if (now - this.lastResetTime > 1000) {
      this.burstCount = 0;
      this.lastResetTime = now;
    }

    // Check burst limit (immediate protection against rapid-fire calls)
    if (this.options.burstLimit && this.burstCount >= this.options.burstLimit) {
      console.warn(`🚫 Burst limit exceeded (${this.burstCount}/${this.options.burstLimit})`);
      return false;
    }

    // Clean old calls outside the window
    this.calls = this.calls.filter(callTime => now - callTime < this.options.windowMs);

    // Check rate limit
    if (this.calls.length >= this.options.maxCalls) {
      console.warn(`🚫 Rate limit exceeded (${this.calls.length}/${this.options.maxCalls} calls in ${this.options.windowMs}ms)`);
      return false;
    }

    return true;
  }

  execute<T extends (...args: any[]) => void>(func: T, ...args: any[]): boolean {
    if (!this.canExecute()) {
      return false;
    }

    this.calls.push(Date.now());
    this.burstCount++;

    if (this.options.throttleMs) {
      // Apply throttling
      if (this.throttleTimeout) {
        clearTimeout(this.throttleTimeout);
      }

      this.throttleTimeout = setTimeout(() => {
        func(...args);
      }, this.options.throttleMs);
    } else {
      // Execute immediately
      func(...args);
    }

    return true;
  }

  getStats(): { callsInWindow: number; burstCount: number; windowMs: number } {
    const now = Date.now();
    this.calls = this.calls.filter(callTime => now - callTime < this.options.windowMs);
    return {
      callsInWindow: this.calls.length,
      burstCount: this.burstCount,
      windowMs: this.options.windowMs
    };
  }
}

// Enhanced throttling utility with rate limiting
const createThrottledFunction = <T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  rateLimitOptions?: RateLimiterOptions
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  const rateLimiter = rateLimitOptions ? new RateLimiter(rateLimitOptions) : null;

  return ((...args: any[]) => {
    // Check rate limiting first
    if (rateLimiter && !rateLimiter.canExecute()) {
      console.warn('🚫 Function call blocked by rate limiter');
      return;
    }

    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      if (rateLimiter) {
        rateLimiter.execute(func, ...args);
      } else {
        func(...args);
      }
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (rateLimiter) {
          rateLimiter.execute(func, ...args);
        } else {
          func(...args);
        }
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
};

// Debouncing utility for batch operations
const debounce = <T extends (...args: any[]) => void>(func: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

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

  // Notification Preferences (centralized)
  preferences: NotificationPreferences | null;
  preferencesLoading: boolean;
  preferencesError: string | null;

  // Actions
  loadNotifications: (filters?: NotificationFilters) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;

  // Notification Preferences Actions
  loadPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;

  // Real-time connection management
  reconnect: () => void;

  // Performance monitoring
  getPerformanceStats: () => {
    averageArchiveTime: number;
    averageDeleteTime: number;
    averageMarkReadTime: number;
    totalOperations: number;
  };

  // OPTIMIZATION: Rate limiting debugging utilities
  getRateLimitingStats: () => {
    performance: {
      processed: number;
      blocked: number;
      blockRate: number;
      averageProcessingTime: number;
      maxProcessingTime: number;
      circuitBreakerTrips: number;
      timeWindowMs: number;
    };
    circuitBreaker: {
      isOpen: boolean;
      failureCount: number;
      lastFailureTime: number;
    };
  };
  resetRateLimiting: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const retryAttempts = useRef(0);
  const maxRetryAttempts = parseInt(import.meta.env.VITE_REALTIME_MAX_RETRIES || '3', 10);
  const fallbackMode = useRef(false);
  const healthMonitoringStarted = useRef(false);

  // Centralized notification preferences state
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const preferencesLoadedRef = useRef(false);

  // OPTIMIZATION: Performance monitoring for rate limiting and operations
  const performanceMetrics = useRef({
    notificationsProcessed: 0,
    notificationsBlocked: 0,
    lastResetTime: Date.now(),
    averageProcessingTime: 0,
    maxProcessingTime: 0,
    circuitBreakerTrips: 0,

    // Operation-specific performance tracking
    archiveOperations: { count: 0, totalTime: 0 },
    deleteOperations: { count: 0, totalTime: 0 },
    markReadOperations: { count: 0, totalTime: 0 },

    recordProcessing: function(processingTime: number) {
      this.notificationsProcessed++;
      this.averageProcessingTime = (this.averageProcessingTime + processingTime) / 2;
      this.maxProcessingTime = Math.max(this.maxProcessingTime, processingTime);
    },

    recordBlocked: function() {
      this.notificationsBlocked++;
    },

    recordCircuitBreakerTrip: function() {
      this.circuitBreakerTrips++;
    },

    recordArchiveOperation: function(duration: number) {
      this.archiveOperations.count++;
      this.archiveOperations.totalTime += duration;
    },

    recordDeleteOperation: function(duration: number) {
      this.deleteOperations.count++;
      this.deleteOperations.totalTime += duration;
    },

    recordMarkReadOperation: function(duration: number) {
      this.markReadOperations.count++;
      this.markReadOperations.totalTime += duration;
    },

    getStats: function() {
      const now = Date.now();
      const timeWindow = now - this.lastResetTime;
      return {
        processed: this.notificationsProcessed,
        blocked: this.notificationsBlocked,
        blockRate: this.notificationsBlocked / (this.notificationsProcessed + this.notificationsBlocked) * 100,
        averageProcessingTime: this.averageProcessingTime,
        maxProcessingTime: this.maxProcessingTime,
        circuitBreakerTrips: this.circuitBreakerTrips,
        timeWindowMs: timeWindow
      };
    },

    reset: function() {
      this.notificationsProcessed = 0;
      this.notificationsBlocked = 0;
      this.lastResetTime = Date.now();
      this.averageProcessingTime = 0;
      this.maxProcessingTime = 0;
      this.circuitBreakerTrips = 0;
    }
  });

  // OPTIMIZATION: Circuit breaker for extreme rate limiting scenarios
  const circuitBreaker = useRef({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    threshold: 10, // Open circuit after 10 failures
    timeout: 30000, // 30 seconds timeout
    reset: function() {
      this.isOpen = false;
      this.failureCount = 0;
      this.lastFailureTime = 0;
    },
    recordFailure: function() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.threshold) {
        this.isOpen = true;
        console.warn('🔴 Circuit breaker opened - too many notification failures');
      }
    },
    canExecute: function() {
      if (!this.isOpen) return true;

      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        console.log('🟡 Circuit breaker half-open - attempting recovery');
        this.isOpen = false;
        this.failureCount = Math.floor(this.failureCount / 2); // Gradual recovery
        return true;
      }

      return false;
    }
  });

  // OPTIMIZATION: Enhanced throttled dispatch functions with rate limiting
  const throttledAddNotification = useRef(
    createThrottledFunction(
      (notification: Notification) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
      },
      100, // Throttle to max 10 notifications per second
      {
        maxCalls: 15, // Max 15 notifications per 5-second window
        windowMs: 5000,
        burstLimit: 5, // Max 5 rapid notifications per second
        throttleMs: 50 // Additional throttling for UI smoothness
      }
    )
  );

  const throttledUpdateNotification = useRef(
    createThrottledFunction(
      (id: string, updates: Partial<Notification>) => {
        dispatch({ type: 'UPDATE_NOTIFICATION', payload: { id, updates } });
      },
      50, // Throttle updates to max 20 per second
      {
        maxCalls: 30, // Max 30 updates per 5-second window
        windowMs: 5000,
        burstLimit: 10, // Max 10 rapid updates per second
        throttleMs: 25 // Smooth UI updates
      }
    )
  );

  const throttledRemoveNotification = useRef(
    createThrottledFunction(
      (id: string) => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      },
      50, // Throttle removals to max 20 per second
      {
        maxCalls: 20, // Max 20 removals per 5-second window
        windowMs: 5000,
        burstLimit: 5, // Max 5 rapid removals per second
        throttleMs: 25 // Smooth UI updates
      }
    )
  );

  // OPTIMIZATION: Debounced functions for batch operations to prevent rapid-fire calls
  const debouncedLoadNotifications = useRef(
    debounce(async (filters?: NotificationFilters) => {
      if (!circuitBreaker.current.canExecute()) {
        console.warn('🔴 Circuit breaker open - skipping notification load');
        return;
      }

      try {
        await loadNotifications(filters);
        // Reset circuit breaker on success
        if (circuitBreaker.current.failureCount > 0) {
          circuitBreaker.current.reset();
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        circuitBreaker.current.recordFailure();
      }
    }, 300) // Debounce rapid load requests
  );

  const debouncedRefreshNotifications = useRef(
    debounce(async () => {
      if (!circuitBreaker.current.canExecute()) {
        console.warn('🔴 Circuit breaker open - skipping notification refresh');
        return;
      }

      try {
        await refreshNotifications();
        // Reset circuit breaker on success
        if (circuitBreaker.current.failureCount > 0) {
          circuitBreaker.current.reset();
        }
      } catch (error) {
        console.error('Failed to refresh notifications:', error);
        circuitBreaker.current.recordFailure();
      }
    }, 500) // Debounce rapid refresh requests
  );

  // Centralized notification preferences loading
  const loadPreferences = useCallback(async () => {
    if (!user || preferencesLoadedRef.current) return;

    setPreferencesLoading(true);
    setPreferencesError(null);

    try {
      const prefs = await notificationService.getUserNotificationPreferences();
      setPreferences(prefs);
      preferencesLoadedRef.current = true;
      if (import.meta.env.DEV) {
        console.log('✅ Notification preferences loaded centrally');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences';
      setPreferencesError(errorMessage);
      console.error('❌ Error loading notification preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  }, [user]);

  // Centralized notification preferences updating
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user) return;

    setPreferencesLoading(true);
    setPreferencesError(null);

    try {
      await notificationService.updateNotificationPreferences(updates);

      // Reload preferences after update (avoid circular dependency)
      preferencesLoadedRef.current = false;
      const prefs = await notificationService.getUserNotificationPreferences();
      setPreferences(prefs);
      preferencesLoadedRef.current = true;

      toast.success('Notification preferences updated');
      if (import.meta.env.DEV) {
        console.log('✅ Notification preferences updated and reloaded');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preferences';
      setPreferencesError(errorMessage);
      toast.error(errorMessage);
      console.error('❌ Error updating notification preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  }, [user]);

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

  // Optimized helper function to broadcast changes to other tabs
  const broadcastToOtherTabs = useCallback((action: string, notificationId?: string, notification?: Notification) => {
    // Skip broadcasting for non-critical operations to reduce overhead
    if (action === 'refresh') return;

    try {
      const syncData = {
        action,
        notificationId,
        notification: notification ? {
          id: notification.id,
          read_at: notification.read_at,
          archived_at: notification.archived_at
        } : undefined, // Only sync essential fields
        timestamp: Date.now()
      };

      // Use a simpler key format for better performance
      const key = `notification_sync_${action}_${notificationId || 'bulk'}`;
      localStorage.setItem(key, JSON.stringify(syncData));

      // Immediate cleanup to prevent localStorage bloat
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 500); // Reduced cleanup time
    } catch (error) {
      console.error('Error broadcasting to other tabs:', error);
    }
  }, []);

  // Mark notification as read with optimistic updates
  const markAsRead = useCallback(async (notificationId: string) => {
    const startTime = performance.now();

    // Optimistic update: Mark as read immediately
    dispatch({ type: 'MARK_AS_READ', payload: notificationId });
    broadcastToOtherTabs('mark_read', notificationId);

    try {
      // Perform backend operation
      await notificationService.markNotificationAsRead(notificationId);

      const duration = performance.now() - startTime;
      performanceMetrics.current.recordMarkReadOperation(duration);
      console.log(`✅ Mark as read operation completed in ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error('Error marking notification as read:', error);

      // Revert optimistic update on error
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification) {
        dispatch({
          type: 'UPDATE_NOTIFICATION',
          payload: {
            id: notificationId,
            updates: { read_at: null }
          }
        });
        broadcastToOtherTabs('update', notificationId, { ...notification, read_at: null });
      }

      toast.error('Failed to mark notification as read');
    }
  }, [broadcastToOtherTabs, state.notifications]);

  // Mark all notifications as read with optimistic updates
  const markAllAsRead = useCallback(async () => {
    const startTime = performance.now();
    const unreadNotifications = state.notifications.filter(n => !n.read_at);

    // Optimistic update: Mark all as read immediately
    dispatch({ type: 'MARK_ALL_AS_READ' });
    broadcastToOtherTabs('mark_all_read');

    try {
      // Perform backend operation
      const count = await notificationService.markAllNotificationsAsRead(currentTeam?.id);

      const duration = performance.now() - startTime;
      console.log(`✅ Mark all as read operation completed in ${duration.toFixed(2)}ms`);

      toast.success(`Marked ${count || unreadNotifications.length} notifications as read`);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);

      // Revert optimistic update on error
      unreadNotifications.forEach(notification => {
        dispatch({
          type: 'UPDATE_NOTIFICATION',
          payload: {
            id: notification.id,
            updates: { read_at: null }
          }
        });
      });

      toast.error('Failed to mark all notifications as read');
    }
  }, [currentTeam?.id, broadcastToOtherTabs, state.notifications]);

  // Archive notification with optimistic updates
  const archiveNotification = useCallback(async (notificationId: string) => {
    const startTime = performance.now();

    // Optimistic update: Update UI immediately
    dispatch({ type: 'ARCHIVE_NOTIFICATION', payload: notificationId });
    broadcastToOtherTabs('archive', notificationId);

    try {
      // Perform backend operation
      await notificationService.archiveNotification(notificationId);

      const duration = performance.now() - startTime;
      performanceMetrics.current.recordArchiveOperation(duration);
      console.log(`✅ Archive operation completed in ${duration.toFixed(2)}ms`);

      toast.success('Notification archived');
    } catch (error) {
      console.error('Error archiving notification:', error);

      // Revert optimistic update on error
      const notification = state.notifications.find(n => n.id === notificationId);
      if (notification) {
        dispatch({
          type: 'UPDATE_NOTIFICATION',
          payload: {
            id: notificationId,
            updates: { archived_at: null }
          }
        });
        broadcastToOtherTabs('update', notificationId, { ...notification, archived_at: null });
      }

      toast.error('Failed to archive notification');
    }
  }, [broadcastToOtherTabs, state.notifications]);

  // Delete notification with optimistic updates
  const deleteNotification = useCallback(async (notificationId: string) => {
    const startTime = performance.now();

    // Store notification for potential rollback
    const notification = state.notifications.find(n => n.id === notificationId);

    // Optimistic update: Remove from UI immediately
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: notificationId });
    broadcastToOtherTabs('delete', notificationId);

    try {
      // Perform backend operation
      await notificationService.deleteNotification(notificationId);

      const duration = performance.now() - startTime;
      performanceMetrics.current.recordDeleteOperation(duration);
      console.log(`✅ Delete operation completed in ${duration.toFixed(2)}ms`);

      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);

      // Revert optimistic update on error
      if (notification) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
        broadcastToOtherTabs('add', notificationId, notification);
      }

      toast.error('Failed to delete notification');
    }
  }, [broadcastToOtherTabs, state.notifications]);

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

  // Real-time subscription management with enhanced connection management
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      return;
    }

    let unsubscribeAllNotifications: (() => void) | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSetupInProgress = false;
    let cleanupTimeout: NodeJS.Timeout | null = null;

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

      // OPTIMIZATION: Clean up any existing subscriptions for this user/team context
      // This prevents duplicate subscriptions during team switching
      console.log(`🧹 Cleaning up existing subscriptions for user ${user.id}, team: ${currentTeam?.id || 'none'}`);
      notificationService.cleanupUserSubscriptions(user.id, currentTeam?.id);

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
        // 🔧 FIX: Enhanced subscription with better error handling
        // Single consolidated subscription with selective event filtering and validation
        console.log('🔄 Setting up real-time notification subscription...');
        unsubscribeAllNotifications = await notificationService.subscribeToAllUserNotificationChanges(
          (event, notification) => {
            // Filter by team if applicable
            if (!currentTeam?.id || notification.team_id === currentTeam.id) {

              if (event === 'INSERT') {
                // OPTIMIZATION: Circuit breaker protection for new notifications
                if (!circuitBreaker.current.canExecute()) {
                  console.warn('🔴 Circuit breaker open - skipping notification INSERT');
                  return;
                }

                // Handle new notifications with enhanced throttling and rate limiting
                if (shouldShowNotificationWithPreferences(notification, preferences)) {
                  const startTime = performance.now();
                  try {
                    const success = throttledAddNotification.current(notification);
                    if (!success) {
                      performanceMetrics.current.recordBlocked();
                      circuitBreaker.current.recordFailure();
                      return;
                    }

                    // Record successful processing
                    const processingTime = performance.now() - startTime;
                    performanceMetrics.current.recordProcessing(processingTime);
                    circuitBreaker.current.recordSuccess();

                    // Show toast for high priority notifications (not throttled for important alerts)
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
                  } catch (error) {
                    console.error('Error handling notification INSERT:', error);
                    circuitBreaker.current.recordFailure();
                  }
                } else {
                  console.log(`🚫 Filtered out notification: ${notification.type} - ${notification.title}`);
                }
              } else if (event === 'UPDATE') {
                // OPTIMIZATION: Circuit breaker protection for notification updates
                if (!circuitBreaker.current.canExecute()) {
                  console.warn('🔴 Circuit breaker open - skipping notification UPDATE');
                  return;
                }

                try {
                  // Streamlined notification update handling
                  const success = throttledUpdateNotification.current(notification.id, notification);
                  if (!success) {
                    circuitBreaker.current.recordFailure();
                    return;
                  }

                  circuitBreaker.current.recordSuccess();

                  // Update unread count if read status changed (not throttled for accuracy)
                  const currentNotification = state.notifications.find(n => n.id === notification.id);
                  if (currentNotification) {
                    const wasUnread = !currentNotification.read_at;
                    const isNowRead = !!notification.read_at;

                    if (wasUnread && isNowRead) {
                      dispatch({ type: 'DECREMENT_UNREAD_COUNT' });
                    } else if (!wasUnread && !isNowRead) {
                      dispatch({ type: 'INCREMENT_UNREAD_COUNT' });
                    }
                  }
                } catch (error) {
                  console.error('Error handling notification UPDATE:', error);
                  circuitBreaker.current.recordFailure();
                }
              } else if (event === 'DELETE') {
                // Streamlined DELETE handling for better performance
                if (!circuitBreaker.current.canExecute()) {
                  return;
                }

                try {
                  const success = throttledRemoveNotification.current(notification.id);
                  if (success) {
                    circuitBreaker.current.recordSuccess();
                  } else {
                    circuitBreaker.current.recordFailure();
                  }
                } catch (error) {
                  console.error('Error handling notification DELETE:', error);
                  circuitBreaker.current.recordFailure();
                }
              }
            }
          },
          currentTeam?.id,
          {
            // OPTIMIZATION: Only subscribe to essential events (exclude rarely used events)
            events: ['INSERT', 'UPDATE', 'DELETE'],

            // 🔧 FIX: Validated notification types to prevent subscription errors
            // Only include types that exist in the database enum
            // 🔧 CORRECTED: Full notification types list - server-side filtering removed, client-side filtering active
            notificationTypes: [
              // Receipt processing (excluding started for noise reduction)
              'receipt_processing_completed',
              'receipt_processing_failed',
              'receipt_ready_for_review',
              'receipt_batch_completed',
              'receipt_batch_failed',

              // Team collaboration
              'team_invitation_sent',
              'team_invitation_accepted',
              'team_member_joined',
              'team_member_left',
              'team_member_role_changed',
              'team_settings_updated',

              // Receipt collaboration
              'receipt_shared',
              'receipt_comment_added',
              'receipt_edited_by_team_member',
              'receipt_approved_by_team',
              'receipt_flagged_for_review',

              // Claims (using correct enum value)
              'claim_submitted',
              'claim_approved',
              'claim_rejected',
              'claim_review_requested'
            ] as NotificationType[], // Type assertion to ensure compile-time validation

            // OPTIMIZATION: Only subscribe to medium and high priority notifications for real-time updates
            // Low priority notifications can be loaded on refresh
            priorities: ['medium', 'high']
          }
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

    // OPTIMIZATION: Enhanced cleanup function with proper connection management
    return () => {
      isSetupInProgress = false;

      // Clean up subscription
      if (unsubscribeAllNotifications) {
        unsubscribeAllNotifications();
      }

      // Clean up timers
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }

      // OPTIMIZATION: Clean up user-specific subscriptions to prevent leaks
      if (user) {
        // Delay cleanup slightly to allow for component re-mounting
        cleanupTimeout = setTimeout(() => {
          console.log(`🧹 Delayed cleanup for user ${user.id}, team: ${currentTeam?.id || 'none'}`);
          notificationService.cleanupUserSubscriptions(user.id, currentTeam?.id);
        }, 1000);
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

      // OPTIMIZATION: Start connection health monitoring (only once)
      if (!healthMonitoringStarted.current) {
        console.log('🏥 Starting connection health monitoring');
        notificationService.startConnectionHealthMonitoring();

        // OPTIMIZATION: Start performance monitoring with integration (only in development)
        const performanceReportInterval = setInterval(() => {
          const stats = performanceMetrics.current.getStats();
          if (stats.processed > 0 || stats.blocked > 0) {
            // Only log performance stats in development or when explicitly enabled
            if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_PERFORMANCE_LOGS === 'true') {
              console.log('📊 Notification Performance Stats:', {
                processed: stats.processed,
                blocked: stats.blocked,
                blockRate: `${stats.blockRate.toFixed(1)}%`,
                avgProcessingTime: `${stats.averageProcessingTime.toFixed(2)}ms`,
                maxProcessingTime: `${stats.maxProcessingTime.toFixed(2)}ms`,
                circuitBreakerTrips: stats.circuitBreakerTrips,
                timeWindow: `${(stats.timeWindowMs / 1000).toFixed(1)}s`
              });
            }

            // OPTIMIZATION: Update performance monitor with notification metrics
            performanceMonitor.updateNotificationMetrics({
              processed: stats.processed,
              blocked: stats.blocked,
              blockRate: stats.blockRate,
              averageProcessingTime: stats.averageProcessingTime,
              maxProcessingTime: stats.maxProcessingTime,
              circuitBreakerTrips: stats.circuitBreakerTrips
            });

            // Alert if block rate is too high (only critical alerts in production)
            if (stats.blockRate > 20) {
              console.warn(`⚠️ High notification block rate: ${stats.blockRate.toFixed(1)}%`);
            }

            // Alert if processing time is too high (only critical alerts in production)
            if (stats.averageProcessingTime > 50) {
              console.warn(`⚠️ High notification processing time: ${stats.averageProcessingTime.toFixed(2)}ms`);
            }

            // Reset metrics for next window
            performanceMetrics.current.reset();
          }
        }, 300000); // Report every 5 minutes for reduced overhead in production

        // Cleanup interval on unmount
        return () => clearInterval(performanceReportInterval);

        healthMonitoringStarted.current = true;
      }
    }
  }, [user, currentTeam?.id, loadNotifications]);

  // Load notification preferences when user changes
  useEffect(() => {
    if (user && !preferencesLoadedRef.current) {
      loadPreferences();
    } else if (!user) {
      // Reset preferences state when user logs out
      setPreferences(null);
      setPreferencesError(null);
      preferencesLoadedRef.current = false;
    }
  }, [user]); // Remove loadPreferences dependency to prevent infinite loops

  // Optimized cross-tab synchronization using localStorage
  useEffect(() => {
    if (!user) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key?.startsWith('notification_sync_')) return;

      try {
        const syncData = JSON.parse(event.newValue || '{}');
        const { action, notificationId, notification, timestamp } = syncData;

        // Ignore old events (older than 2 seconds for faster sync)
        if (Date.now() - timestamp > 2000) return;

        // Batch similar operations to reduce re-renders
        switch (action) {
          case 'mark_read':
            if (notificationId) {
              dispatch({ type: 'MARK_AS_READ', payload: notificationId });
            }
            break;
          case 'mark_all_read':
            dispatch({ type: 'MARK_ALL_AS_READ' });
            break;
          case 'archive':
            if (notificationId) {
              dispatch({ type: 'ARCHIVE_NOTIFICATION', payload: notificationId });
            }
            break;
          case 'delete':
            if (notificationId) {
              dispatch({ type: 'REMOVE_NOTIFICATION', payload: notificationId });
            }
            break;
          case 'update':
            if (notification && notificationId) {
              dispatch({
                type: 'UPDATE_NOTIFICATION',
                payload: { id: notificationId, updates: notification }
              });
            }
            break;
          case 'add':
            if (notification) {
              dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
            }
            break;
          // Skip refresh action as it's handled by optimistic updates
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

  // Performance stats getter
  const getPerformanceStats = useCallback(() => {
    const metrics = performanceMetrics.current;
    return {
      averageArchiveTime: metrics.archiveOperations.count > 0
        ? metrics.archiveOperations.totalTime / metrics.archiveOperations.count
        : 0,
      averageDeleteTime: metrics.deleteOperations.count > 0
        ? metrics.deleteOperations.totalTime / metrics.deleteOperations.count
        : 0,
      averageMarkReadTime: metrics.markReadOperations.count > 0
        ? metrics.markReadOperations.totalTime / metrics.markReadOperations.count
        : 0,
      totalOperations: metrics.archiveOperations.count + metrics.deleteOperations.count + metrics.markReadOperations.count
    };
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: NotificationContextType = useMemo(() => ({
    // State
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isLoading: state.isLoading,
    isConnected: state.isConnected,
    error: state.error,
    lastUpdated: state.lastUpdated,

    // Notification Preferences (centralized)
    preferences,
    preferencesLoading,
    preferencesError,

    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    reconnect,

    // Notification Preferences Actions
    loadPreferences,
    updatePreferences,

    // Performance monitoring
    getPerformanceStats,

    // OPTIMIZATION: Debugging utilities for rate limiting
    getRateLimitingStats: () => ({
      performance: performanceMetrics.current.getStats(),
      circuitBreaker: {
        isOpen: circuitBreaker.current.isOpen,
        failureCount: circuitBreaker.current.failureCount,
        lastFailureTime: circuitBreaker.current.lastFailureTime
      }
    }),

    resetRateLimiting: () => {
      performanceMetrics.current.reset();
      circuitBreaker.current.reset();
      console.log('🔄 Rate limiting metrics reset');
    },
  }), [
    // Dependencies for useMemo
    state.notifications,
    state.unreadCount,
    state.isLoading,
    state.isConnected,
    state.error,
    state.lastUpdated,
    preferences,
    preferencesLoading,
    preferencesError,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    reconnect,
    loadPreferences,
    updatePreferences,
    getPerformanceStats,
  ]);

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
