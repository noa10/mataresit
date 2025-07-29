import { supabase } from '@/integrations/supabase/client';
import {
  Notification,
  NotificationFilters,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  NotificationPreferences,
  PushSubscription,
} from '@/types/notifications';

export class NotificationService {
  private activeChannels: Map<string, any> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private connectionListeners: Set<(status: string) => void> = new Set();
  private connectionInProgress: boolean = false;
  private lastConnectionAttempt: number = 0;
  private connectionCooldown: number = 2000; // 2 seconds between attempts

  // Enhanced retry and circuit breaker configuration
  private retryConfig = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitterFactor: 0.1 // Add randomness to prevent thundering herd
  };

  private circuitBreaker = {
    failureThreshold: 5, // Number of failures before opening circuit
    recoveryTimeout: 60000, // 1 minute before trying again
    state: 'closed' as 'closed' | 'open' | 'half-open',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0
  };

  // Subscription health monitoring
  private subscriptionHealth = new Map<string, {
    channelName: string;
    createdAt: number;
    lastActivity: number;
    errorCount: number;
    successCount: number;
    status: 'healthy' | 'degraded' | 'failed';
  }>();

  // OPTIMIZATION: Enhanced connection management
  private subscriptionRegistry: Map<string, {
    channel: any;
    userId: string;
    teamId?: string;
    createdAt: number;
    lastActivity: number;
  }> = new Map();
  private pendingSubscriptions: Set<string> = new Set();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInProgress: Set<string> = new Set();

  // 🔧 FIX: Enhanced cleanup tracking to prevent recursion
  private deferredCleanupQueue: Set<string> = new Set();
  private cleanupBatchTimer: NodeJS.Timeout | null = null;

  // =============================================
  // CONNECTION MANAGEMENT
  // =============================================

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  onConnectionStatusChange(callback: (status: string) => void): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  private notifyConnectionStatusChange(status: 'connected' | 'disconnected' | 'reconnecting') {
    this.connectionStatus = status;
    this.connectionListeners.forEach(callback => callback(status));
  }

  private async waitForConnection(maxWaitTime: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let attempts = 0;
      const maxAttempts = Math.floor(maxWaitTime / 100);

      const checkConnection = () => {
        attempts++;
        const elapsed = Date.now() - startTime;

        // Check if we've exceeded max wait time or attempts
        if (elapsed >= maxWaitTime || attempts >= maxAttempts) {
          console.log(`Connection check timeout after ${elapsed}ms (${attempts} attempts)`);
          resolve(false);
          return;
        }

        // Check connection status
        try {
          const isConnected = supabase.realtime.isConnected();
          if (isConnected) {
            console.log(`✅ Real-time connection established after ${elapsed}ms (${attempts} attempts)`);
            resolve(true);
            return;
          }
        } catch (error) {
          console.warn('Error checking connection status:', error);
        }

        // Continue checking
        setTimeout(checkConnection, 100);
      };

      checkConnection();
    });
  }

  private async testConnection(): Promise<boolean> {
    try {
      // Create a test channel to verify real-time functionality
      const testChannel = supabase.channel('connection-test-' + Date.now());

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          supabase.removeChannel(testChannel);
          resolve(false);
        }, 3000);

        testChannel.subscribe((status) => {
          clearTimeout(timeout);
          supabase.removeChannel(testChannel);

          if (status === 'SUBSCRIBED') {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  async ensureConnection(): Promise<boolean> {
    try {
      // Quick real-time availability test first
      const quickTestResult = await this.quickRealTimeTest();
      if (!quickTestResult) {
        console.warn('⚠️ Real-time not available (quick test failed)');
        this.notifyConnectionStatusChange('disconnected');
        return false;
      }

      // If quick test passed, trust it and mark as connected
      console.log('✅ Real-time connection verified via quick test');
      this.notifyConnectionStatusChange('connected');
      this.reconnectAttempts = 0;
      this.connectionInProgress = false;
      return true;

    } catch (error) {
      console.error('Connection establishment failed:', error);
      this.notifyConnectionStatusChange('disconnected');
      this.connectionInProgress = false;
      return false;
    }
  }

  async reconnectWithBackoff(): Promise<boolean> {
    // 🔧 ENHANCED: Check circuit breaker before attempting reconnection
    if (!this.canExecuteOperation()) {
      console.warn('🔴 Circuit breaker is open - skipping reconnection attempt');
      return false;
    }

    if (this.reconnectAttempts >= this.retryConfig.maxRetries) {
      console.error('❌ Max reconnection attempts reached, entering fallback mode');
      this.notifyConnectionStatusChange('disconnected');
      this.connectionInProgress = false;
      this.recordFailure(); // Record final failure

      // 🔧 ENHANCED: Log comprehensive diagnostic information
      console.log('🔍 Final connection diagnostic:', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.retryConfig.maxRetries,
        activeChannels: this.getActiveChannelCount(),
        connectionStatus: this.connectionStatus,
        circuitBreakerStatus: this.getCircuitBreakerStatus(),
        subscriptionHealth: this.getSubscriptionHealthStatus(),
        timestamp: new Date().toISOString()
      });

      return false;
    }

    this.reconnectAttempts++;

    // 🔧 ENHANCED: Use improved exponential backoff with jitter
    const baseDelay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, this.reconnectAttempts - 1);
    const cappedDelay = Math.min(baseDelay, this.retryConfig.maxDelay);
    const jitter = cappedDelay * this.retryConfig.jitterFactor * Math.random();
    const delay = cappedDelay + jitter;

    console.log(`🔄 Enhanced reconnection attempt ${this.reconnectAttempts}/${this.retryConfig.maxRetries} in ${Math.round(delay)}ms`);
    this.notifyConnectionStatusChange('reconnecting');

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const connected = await this.ensureConnection();
      if (connected) {
        console.log('✅ Reconnection successful');
        this.reconnectAttempts = 0; // Reset on success
        this.recordSuccess(); // Record success for circuit breaker
      } else {
        this.recordFailure(); // Record failure for circuit breaker
      }
      return connected;
    } catch (error) {
      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      this.recordFailure(); // Record failure for circuit breaker
      return false;
    }
  }

  // Reset connection state for fresh start
  resetConnectionState(): void {
    this.connectionInProgress = false;
    this.reconnectAttempts = 0;
    this.lastConnectionAttempt = 0;
    this.notifyConnectionStatusChange('disconnected');
    console.log('🔄 Connection state reset');
  }

  // Check if real-time is available in this environment
  isRealTimeAvailable(): boolean {
    try {
      return !!supabase.realtime && typeof supabase.realtime.connect === 'function';
    } catch (error) {
      console.warn('Real-time not available:', error);
      return false;
    }
  }

  // Quick real-time availability test with short timeout
  async quickRealTimeTest(): Promise<boolean> {
    try {
      // Check if real-time is disabled via environment variable
      const realTimeDisabled = import.meta.env.VITE_DISABLE_REALTIME === 'true';
      if (realTimeDisabled) {
        console.log('🚫 Real-time disabled via environment variable');
        return false;
      }

      if (!this.isRealTimeAvailable()) {
        console.warn('❌ Real-time not available in this environment');
        return false;
      }

      // Now that we've fixed the database configuration, enable real-time in production
      const realTimeEnabled = import.meta.env.VITE_ENABLE_REALTIME !== 'false';
      if (!realTimeEnabled) {
        console.log('🚫 Real-time explicitly disabled via VITE_ENABLE_REALTIME=false');
        return false;
      }

      // Log connection attempt details for debugging
      console.log('🔍 Starting real-time connection test...', {
        url: import.meta.env.VITE_SUPABASE_URL || "https://mpmkbtsufihzdelrlszs.supabase.co",
        hasRealtime: !!supabase.realtime,
        isConnected: supabase.realtime?.isConnected?.() || false
      });

      // Quick connection test with reasonable timeout
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('⏰ Real-time quick test timeout (3s) - WebSocket connection failed');
          console.log('🔍 Connection diagnostic:', {
            realtimeStatus: supabase.realtime?.isConnected?.() || 'unknown',
            websocketUrl: `wss://${import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || 'mpmkbtsufihzdelrlszs.supabase.co'}/realtime/v1/websocket`,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          });
          resolve(false);
        }, 3000); // Increased to 3 seconds for better reliability

        try {
          // Try to check if real-time is already connected
          if (supabase.realtime.isConnected()) {
            clearTimeout(timeout);
            console.log('✅ Real-time already connected');
            resolve(true);
            return;
          }

          // If not connected, try a quick test channel
          const testChannelName = `quick-test-${Date.now()}`;
          const testChannel = supabase.channel(testChannelName);

          testChannel.subscribe((status) => {
            console.log(`📡 Test channel status: ${status}`);
            clearTimeout(timeout);

            // 🔧 FIX: Defer channel cleanup to prevent recursion
            this.safeRemoveChannel(testChannel, testChannelName);

            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time test channel subscribed successfully');
              resolve(true);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Real-time test channel error - WebSocket connection failed');
              console.log('🔍 Error diagnostic:', {
                status,
                websocketUrl: `wss://${import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || 'mpmkbtsufihzdelrlszs.supabase.co'}/realtime/v1/websocket`,
                timestamp: new Date().toISOString()
              });
              resolve(false);
            } else if (status === 'TIMED_OUT') {
              console.warn('⏰ Real-time test channel timed out');
              resolve(false);
            }
            // For other statuses like 'JOINING', continue waiting
          });

          // Also listen for errors
          testChannel.on('error', (error) => {
            clearTimeout(timeout);
            console.warn('❌ Real-time test channel error:', error);

            // 🔧 FIX: Defer channel cleanup to prevent recursion
            this.safeRemoveChannel(testChannel, testChannelName);
            resolve(false);
          });
        } catch (error) {
          clearTimeout(timeout);
          console.warn('Error during real-time test:', error);
          resolve(false);
        }
      });
    } catch (error) {
      console.warn('Quick real-time test failed:', error);
      return false;
    }
  }



  // =============================================
  // NOTIFICATION MANAGEMENT
  // =============================================

  async getUserNotifications(
    filters?: NotificationFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<Notification[]> {
    const { data, error } = await supabase.rpc('get_user_notifications', {
      _limit: limit,
      _offset: offset,
      _unread_only: filters?.unread_only || false,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  async getNotification(notificationId: string): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        team:team_id(name)
      `)
      .eq('id', notificationId)
      .eq('recipient_id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(error.message);
    }

    return {
      ...data,
      team_name: data.team?.name,
    };
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      _notification_id: notificationId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async markAllNotificationsAsRead(teamId?: string): Promise<number> {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
      _team_id: teamId || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data || 0;
  }

  async archiveNotification(notificationId: string): Promise<void> {
    const { data, error } = await supabase.rpc('archive_notification', {
      _notification_id: notificationId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    // Use RLS policy instead of explicit recipient_id check for better performance
    // The RLS policy will automatically filter by auth.uid()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getUnreadNotificationCount(teamId?: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      _team_id: teamId || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data || 0;
  }

  // =============================================
  // BULK OPERATIONS
  // =============================================

  async bulkMarkAsRead(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    // Use RLS policy instead of explicit recipient_id check for better performance
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', notificationIds)
      .is('read_at', null);

    if (error) {
      throw new Error(error.message);
    }
  }

  async bulkArchiveNotifications(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    // Use optimized RPC function for better performance
    const { error } = await supabase.rpc('bulk_archive_notifications', {
      _notification_ids: notificationIds,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async bulkDeleteNotifications(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    // Use optimized RPC function for better performance
    const { error } = await supabase.rpc('bulk_delete_notifications', {
      _notification_ids: notificationIds,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async bulkUpdateNotificationStatus(
    notificationIds: string[],
    updates: {
      read?: boolean;
      archived?: boolean;
    }
  ): Promise<void> {
    if (notificationIds.length === 0) return;

    const updateData: any = {};
    const now = new Date().toISOString();

    if (updates.read !== undefined) {
      updateData.read_at = updates.read ? now : null;
    }
    if (updates.archived !== undefined) {
      updateData.archived_at = updates.archived ? now : null;
    }

    // Use RLS policy instead of explicit recipient_id check for better performance
    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .in('id', notificationIds);

    if (error) {
      throw new Error(error.message);
    }
  }

  // =============================================
  // NOTIFICATION STATISTICS
  // =============================================

  async getNotificationStats(teamId?: string): Promise<NotificationStats> {
    const { data, error } = await supabase
      .from('notifications')
      .select('type, read_at, priority')
      .eq('recipient_id', (await supabase.auth.getUser()).data.user?.id)
      .eq('team_id', teamId || null)
      .is('archived_at', null);

    if (error) {
      throw new Error(error.message);
    }

    const notifications = data || [];
    const unreadNotifications = notifications.filter(n => !n.read_at);
    
    const notificationsByType = notifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType, number>);

    const stats: NotificationStats = {
      total_notifications: notifications.length,
      unread_notifications: unreadNotifications.length,
      high_priority_unread: unreadNotifications.filter(n => n.priority === 'high').length,
      notifications_by_type: notificationsByType,
    };

    return stats;
  }

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================

  async subscribeToUserNotifications(
    callback: (notification: Notification) => void,
    teamId?: string
  ) {
    // Ensure connection before subscribing
    const connected = await this.ensureConnection();
    if (!connected) {
      console.warn('⚠️ Real-time connection not available, subscription will be skipped');
      throw new Error('Failed to establish real-time connection');
    }

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // 🔧 FIX: Shorten channel name to avoid length limits
    const userIdShort = user.id.substring(0, 8);
    const channelName = `user-notifs-${userIdShort}`;

    // Remove existing channel if it exists
    if (this.activeChannels.has(channelName)) {
      const existingChannel = this.activeChannels.get(channelName);
      // 🔧 FIX: Use safe removal to prevent recursion
      this.safeRemoveChannel(existingChannel, channelName);
      this.activeChannels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          if (!teamId || notification.team_id === teamId) {
            callback(notification);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 User notifications subscription status: ${status} for channel: ${channelName}`);
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to user notifications for user ${user.id}`);
          this.notifyConnectionStatusChange('connected');
          this.reconnectAttempts = 0; // Reset on successful connection
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error for user notifications');
          this.notifyConnectionStatusChange('disconnected');
          // Attempt reconnection
          this.reconnectWithBackoff();
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Channel subscription timed out for user notifications');
          this.notifyConnectionStatusChange('disconnected');
          this.reconnectWithBackoff();
        } else if (status === 'CLOSED') {
          console.log('🔌 Channel subscription closed for user notifications');
          this.notifyConnectionStatusChange('disconnected');
        }
      });

    // Store the channel for management
    this.activeChannels.set(channelName, channel);

    return () => {
      // 🔧 FIX: Use safe removal to prevent recursion
      this.safeRemoveChannel(channel, channelName);
      this.activeChannels.delete(channelName);
    };
  }

  async subscribeToNotificationUpdates(
    notificationId: string,
    callback: (notification: Notification) => void
  ) {
    // Ensure connection before subscribing
    const connected = await this.ensureConnection();
    if (!connected) {
      throw new Error('Failed to establish real-time connection');
    }

    // Support subscribing to all user notifications with '*'
    const isAllNotifications = notificationId === '*';

    let filter: string;
    let channelName: string;

    if (isAllNotifications) {
      // Get current user ID for all notifications filter
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      filter = `recipient_id=eq.${user.id}`;
      // 🔧 FIX: Shorten channel name
      const userIdShort = user.id.substring(0, 8);
      channelName = `user-updates-${userIdShort}`;
    } else {
      filter = `id=eq.${notificationId}`;
      // 🔧 FIX: Shorten notification ID for channel name
      const notifIdShort = notificationId.substring(0, 8);
      channelName = `notif-updates-${notifIdShort}`;
    }

    // Remove existing channel if it exists
    if (this.activeChannels.has(channelName)) {
      const existingChannel = this.activeChannels.get(channelName);
      // 🔧 FIX: Use safe removal to prevent recursion
      this.safeRemoveChannel(existingChannel, channelName);
      this.activeChannels.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to notification updates: ${channelName}`);
          this.notifyConnectionStatusChange('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for notification updates: ${channelName}`);
          this.notifyConnectionStatusChange('disconnected');
          // Attempt reconnection
          this.reconnectWithBackoff();
        }
      });

    // Store the channel for management
    this.activeChannels.set(channelName, channel);

    return () => {
      // 🔧 FIX: Use safe removal to prevent recursion
      this.safeRemoveChannel(channel, channelName);
      this.activeChannels.delete(channelName);
    };
  }

  // Subscribe to all notification changes for a user (INSERT, UPDATE, DELETE)
  // OPTIMIZATION: Enhanced with selective event filtering and notification type filtering
  async subscribeToAllUserNotificationChanges(
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', notification: Notification) => void,
    teamId?: string,
    options?: {
      events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
      notificationTypes?: NotificationType[];
      priorities?: NotificationPriority[];
      _recursionDepth?: number;
    }
  ) {
    // Prevent infinite recursion
    const recursionDepth = (options?._recursionDepth || 0) + 1;
    if (recursionDepth > 3) {
      console.error('🚫 Preventing infinite recursion in notification subscription');
      return () => {};
    }

    // Ensure connection before subscribing
    const connected = await this.ensureConnection();
    if (!connected) {
      throw new Error('Failed to establish real-time connection');
    }

    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // 🔧 ENHANCED: Circuit breaker check before creating subscription
    if (!this.canExecuteOperation()) {
      console.warn('🔴 Circuit breaker is open - subscription creation blocked');
      throw new Error('Circuit breaker is open - too many recent failures');
    }

    // 🔧 ENHANCED: Comprehensive validation with detailed feedback
    const validation = this.validateSubscriptionOptions(options);
    if (!validation.isValid) {
      console.error('🚫 Subscription validation failed:', validation.errors);
      this.recordFailure();
      throw new Error(`Invalid subscription options: ${validation.errors.join(', ')}`);
    }

    // Use sanitized options from validation
    options = validation.sanitizedOptions;

    // 🔧 FIX: Shorten channel name to avoid length limits and improve reliability
    const userIdShort = user.id.substring(0, 8); // Use first 8 chars of UUID
    const channelName = `user-changes-${userIdShort}`;

    // OPTIMIZATION: Check for duplicate subscriptions and prevent them
    if (this.hasActiveSubscription(channelName, user.id, teamId)) {
      console.log(`⚠️ Subscription already exists for ${channelName}, skipping duplicate`);
      // Return existing subscription's unsubscribe function
      const existing = this.subscriptionRegistry.get(channelName);
      if (existing) {
        existing.lastActivity = Date.now(); // Update activity timestamp
        return () => this.cleanupSubscription(channelName);
      }
    }

    // Check if subscription is already pending
    if (this.pendingSubscriptions.has(channelName)) {
      console.log(`⏳ Subscription already pending for ${channelName}, skipping duplicate`);
      return () => {}; // Return no-op function
    }

    this.pendingSubscriptions.add(channelName);

    // OPTIMIZATION: Build selective event filter instead of using '*'
    const events = options?.events || ['INSERT', 'UPDATE', 'DELETE'];
    const eventFilter = events.length === 3 ? '*' : events.join(',');

    // 🔧 FIX: Build notification type filter with proper validation
    let typeFilter = '';
    if (options?.notificationTypes && options.notificationTypes.length > 0) {
      // Ensure all types are properly escaped and valid
      const sanitizedTypes = options.notificationTypes
        .filter(type => type && typeof type === 'string')
        .map(type => type.trim());

      if (sanitizedTypes.length > 0) {
        // 🔧 CORRECTED: Use unquoted values for PostgREST in() filter
        // Only quote if values contain commas, but our enum values don't
        typeFilter = `&type=in.(${sanitizedTypes.join(',')})`;
      }
    }

    // 🔧 FIX: Build priority filter with proper validation
    let priorityFilter = '';
    if (options?.priorities && options.priorities.length > 0) {
      // Ensure all priorities are properly escaped and valid
      const sanitizedPriorities = options.priorities
        .filter(priority => priority && typeof priority === 'string')
        .map(priority => priority.trim());

      if (sanitizedPriorities.length > 0) {
        // 🔧 CORRECTED: Use unquoted values for PostgREST in() filter
        // Only quote if values contain commas, but our enum values don't
        priorityFilter = `&priority=in.(${sanitizedPriorities.join(',')})`;
      }
    }

    // 🔧 CORRECTED: Use only recipient_id filter for realtime subscription
    // PostgREST realtime filters should be simple and additional filtering done client-side
    const filter = `recipient_id=eq.${user.id}`;

    // 🔧 ENHANCED: Enhanced debugging for filter construction
    console.log(`🔍 Filter components:`, {
      userId: user.id,
      typeFilter,
      priorityFilter,
      finalFilter: filter,
      notificationTypes: options?.notificationTypes,
      priorities: options?.priorities
    });

    // 🔧 ENHANCED: Validate filter before using it
    const filterValidation = this.validateFilter(filter);
    if (!filterValidation.isValid) {
      console.error('🚫 Filter validation failed:', filterValidation.error);
      console.error('🔍 Problematic filter:', filter);
      console.error('🔍 Filter breakdown:', {
        typeFilter,
        priorityFilter,
        notificationTypes: options?.notificationTypes,
        priorities: options?.priorities
      });
      this.recordFailure();
      throw new Error(`Invalid filter: ${filterValidation.error}`);
    }

    // 🔧 ENHANCED: Initialize health monitoring for this subscription
    this.initializeHealthMonitoring(channelName);

    // 🔧 ENHANCED: Log the corrected filter for monitoring
    console.log(`✅ Creating subscription with corrected filter: ${filter}`);
    console.log(`🔍 Detailed subscription config:`, {
      channelName,
      eventFilter,
      schema: 'public',
      table: 'notifications',
      filter,
      filterLength: filter.length,
      filterBytes: new TextEncoder().encode(filter),
      filterCharCodes: Array.from(filter).map((char, i) => ({
        index: i,
        char,
        code: char.charCodeAt(0),
        hex: char.charCodeAt(0).toString(16)
      }))
    });

    const channel = supabase
      .channel(channelName)
      .on('system', {}, (payload) => {
        // 🔧 ENHANCED: Capture system messages including errors
        console.log(`🔍 [${channelName}] System message:`, payload);
        if (payload.status === 'error') {
          console.error(`🚨 [${channelName}] Realtime system error:`, payload);
          console.error(`🔍 Error details:`, {
            message: payload.message,
            extension: payload.extension,
            channel: channelName,
            filter,
            timestamp: new Date().toISOString()
          });
        }
      })
      .on(
        'postgres_changes',
        {
          event: eventFilter as any,
          schema: 'public',
          table: 'notifications',
          filter,
        },
        (payload) => {
          try {
            const notification = (payload.new || payload.old) as Notification;

            // 🔧 ENHANCED: Record successful activity for health monitoring
            this.recordHealthSuccess(channelName);
            this.recordSuccess(); // Circuit breaker success

            // Additional client-side filtering for team and notification preferences
            if (!teamId || notification.team_id === teamId) {
              // OPTIMIZATION: Apply client-side notification type filtering if specified
              if (options?.notificationTypes && options.notificationTypes.length > 0) {
                if (!options.notificationTypes.includes(notification.type)) {
                  console.log(`🚫 Filtered out notification type: ${notification.type}`);
                  return;
                }
              }

              // OPTIMIZATION: Apply client-side priority filtering if specified
              if (options?.priorities && options.priorities.length > 0) {
                if (!options.priorities.includes(notification.priority)) {
                  console.log(`🚫 Filtered out notification priority: ${notification.priority}`);
                  return;
                }
              }

              callback(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', notification);
            }
          } catch (error) {
            console.error('Error processing notification payload:', error);
            this.recordHealthError(channelName);
            this.recordFailure(); // Circuit breaker failure
          }
        }
      )
      .subscribe((status) => {
        this.pendingSubscriptions.delete(channelName); // Remove from pending

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to all notification changes for user ${user.id}`);
          this.registerSubscription(channelName, channel, user.id, teamId);
          this.notifyConnectionStatusChange('connected');

          // 🔧 ENHANCED: Record successful subscription for circuit breaker and health monitoring
          this.recordSuccess();
          this.recordHealthSuccess(channelName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for all notification changes: ${channelName}`);
          console.error(`🔍 Failed filter was: ${filter}`);
          console.error(`🔍 Filter breakdown:`, {
            typeFilter,
            priorityFilter,
            notificationTypes: options?.notificationTypes,
            priorities: options?.priorities
          });

          // 🔧 ENHANCED: Record failure for circuit breaker and health monitoring
          this.recordFailure();
          this.recordHealthError(channelName);

          console.log('🔍 Enhanced channel error diagnostic:', {
            channelName,
            userId: user.id,
            teamId,
            filter,
            typeFilter,
            priorityFilter,
            notificationTypes: options?.notificationTypes,
            priorities: options?.priorities,
            activeChannels: this.getActiveChannelCount(),
            reconnectAttempts: this.reconnectAttempts,
            circuitBreakerStatus: this.getCircuitBreakerStatus(),
            subscriptionHealth: this.getSubscriptionHealthStatus(),
            timestamp: new Date().toISOString()
          });

          // Enhanced error recovery
          this.handleChannelError(channelName, user.id, teamId, callback, options, recursionDepth);
        } else if (status === 'CLOSED') {
          console.log(`🔌 Channel closed for all notification changes: ${channelName}`);
          this.cleanupSubscription(channelName);
          this.notifyConnectionStatusChange('disconnected');

          // Attempt to reestablish if not intentionally closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('🔄 Attempting to reestablish closed channel...');
            setTimeout(() => {
              this.reconnectWithBackoff();
            }, 2000);
          }
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏰ Channel subscription timed out: ${channelName}`);
          this.handleChannelTimeout(channelName, user.id, teamId, callback, options, recursionDepth);
        }
      });

    // OPTIMIZATION: Enhanced cleanup with proper subscription management
    return () => {
      this.cleanupSubscription(channelName);
    };
  }

  // OPTIMIZATION: Enhanced connection management and cleanup

  /**
   * 🔧 ENHANCED: Check if a subscription already exists with validation
   */
  private hasActiveSubscription(channelName: string, userId: string, teamId?: string): boolean {
    const existing = this.subscriptionRegistry.get(channelName);
    if (!existing) return false;

    // Check if it's for the same user and team context
    const isMatch = existing.userId === userId && existing.teamId === teamId;

    if (isMatch) {
      // Validate that the channel is still active in Supabase
      try {
        // Update last activity timestamp for active subscriptions
        existing.lastActivity = Date.now();
        console.log(`✅ Active subscription validated: ${channelName}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ Subscription exists but channel is invalid: ${channelName}`, error);
        // Clean up invalid subscription
        this.cleanupSubscription(channelName);
        return false;
      }
    }

    return false;
  }

  /**
   * 🔧 ENHANCED: Register a new subscription with improved duplicate handling
   */
  private registerSubscription(channelName: string, channel: any, userId: string, teamId?: string): void {
    // Check if we already have this exact subscription
    const existing = this.subscriptionRegistry.get(channelName);
    if (existing && existing.userId === userId && existing.teamId === teamId) {
      console.log(`⚠️ Subscription already exists for ${channelName}, updating activity timestamp`);
      existing.lastActivity = Date.now();
      return;
    }

    // Clean up any existing subscription with different context
    if (existing) {
      console.log(`🔄 Replacing existing subscription for ${channelName}`);
      this.cleanupSubscription(channelName);
    }

    this.subscriptionRegistry.set(channelName, {
      channel,
      userId,
      teamId,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    this.activeChannels.set(channelName, channel);
    console.log(`📝 Registered subscription: ${channelName} (user: ${userId}, team: ${teamId || 'none'})`);
  }

  /**
   * 🔧 FIX: Safe channel removal that prevents recursion
   */
  private safeRemoveChannel(channel: any, channelName?: string): void {
    if (!channel) return;

    const name = channelName || `channel-${Date.now()}`;

    // Add to deferred cleanup queue to prevent immediate recursion
    this.deferredCleanupQueue.add(name);

    // Batch cleanup to avoid multiple setTimeout calls
    if (!this.cleanupBatchTimer) {
      this.cleanupBatchTimer = setTimeout(() => {
        this.processDeferredCleanup();
      }, 0); // Next tick
    }
  }

  /**
   * 🔧 FIX: Process deferred cleanup queue safely
   */
  private processDeferredCleanup(): void {
    const channelsToCleanup = Array.from(this.deferredCleanupQueue);
    this.deferredCleanupQueue.clear();
    this.cleanupBatchTimer = null;

    for (const channelName of channelsToCleanup) {
      try {
        // Find the channel in our registries
        const subscription = this.subscriptionRegistry.get(channelName);
        const activeChannel = this.activeChannels.get(channelName);

        const channel = subscription?.channel || activeChannel;
        if (channel) {
          supabase.removeChannel(channel);
          console.log(`🧹 Safely cleaned up channel: ${channelName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error in deferred cleanup for ${channelName}:`, error);
      }
    }
  }

  /**
   * Clean up a specific subscription with enhanced safety
   */
  private cleanupSubscription(channelName: string): void {
    // Prevent recursive cleanup calls
    if (this.cleanupInProgress.has(channelName)) {
      console.log(`⚠️ Cleanup already in progress for ${channelName}, skipping`);
      return;
    }

    this.cleanupInProgress.add(channelName);

    try {
      const existing = this.subscriptionRegistry.get(channelName);
      if (existing) {
        // 🔧 FIX: Use safe removal instead of direct removeChannel
        this.safeRemoveChannel(existing.channel, channelName);
        console.log(`🧹 Queued cleanup for subscription: ${channelName}`);
      }

      this.subscriptionRegistry.delete(channelName);
      this.activeChannels.delete(channelName);

      // 🔧 ENHANCED: Clean up health monitoring
      this.cleanupHealthMonitoring(channelName);

      // Clear any pending cleanup timers
      const timer = this.cleanupTimers.get(channelName);
      if (timer) {
        clearTimeout(timer);
        this.cleanupTimers.delete(channelName);
      }
    } finally {
      // Always remove from cleanup progress, even if an error occurred
      this.cleanupInProgress.delete(channelName);
    }
  }

  /**
   * 🔧 ENHANCED: Clean up subscriptions for a specific user/team context with batching
   */
  cleanupUserSubscriptions(userId: string, teamId?: string): void {
    console.log(`🧹 Cleaning up subscriptions for user ${userId}, team: ${teamId || 'none'}`);

    const toCleanup: string[] = [];
    for (const [channelName, subscription] of this.subscriptionRegistry) {
      if (subscription.userId === userId && subscription.teamId === teamId) {
        toCleanup.push(channelName);
      }
    }

    if (toCleanup.length === 0) {
      console.log(`✅ No subscriptions to clean up for user ${userId}`);
      return;
    }

    console.log(`🧹 Found ${toCleanup.length} subscriptions to clean up`);

    // Batch cleanup to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < toCleanup.length; i += batchSize) {
      const batch = toCleanup.slice(i, i + batchSize);

      // Process batch with slight delay to prevent overwhelming
      setTimeout(() => {
        batch.forEach(channelName => {
          try {
            this.cleanupSubscription(channelName);
          } catch (error) {
            console.error(`Error cleaning up subscription ${channelName}:`, error);
          }
        });
      }, i * 10); // 10ms delay between batches
    }
  }

  /**
   * Clean up all active channels with enhanced logging and safety
   */
  disconnectAll(): void {
    console.log(`🔌 Disconnecting ${this.activeChannels.size} active channels`);

    // 🔧 FIX: Use safe cleanup for all channels
    for (const [channelName, channel] of this.activeChannels) {
      try {
        this.safeRemoveChannel(channel, channelName);
        console.log(`✅ Queued disconnection for channel: ${channelName}`);
      } catch (error) {
        console.error(`❌ Error queuing disconnection for channel ${channelName}:`, error);
      }
    }

    this.activeChannels.clear();
    this.subscriptionRegistry.clear();

    // Clear all cleanup timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    // Clear cleanup progress tracking
    this.cleanupInProgress.clear();

    this.notifyConnectionStatusChange('disconnected');
  }

  /**
   * Get detailed connection state for debugging
   */
  getConnectionState(): {
    status: string;
    activeChannels: number;
    registeredSubscriptions: number;
    pendingSubscriptions: number;
    reconnectAttempts: number;
    circuitBreaker: {
      state: string;
      failureCount: number;
      successCount: number;
      lastFailureTime: number;
    };
    subscriptionHealth: Array<{
      channelName: string;
      status: string;
      errorCount: number;
      successCount: number;
      age: number;
      lastActivity: number;
    }>;
    subscriptions: Array<{
      channelName: string;
      userId: string;
      teamId?: string;
      age: number;
      lastActivity: number;
    }>;
  } {
    const now = Date.now();
    return {
      status: this.connectionStatus,
      activeChannels: this.activeChannels.size,
      registeredSubscriptions: this.subscriptionRegistry.size,
      pendingSubscriptions: this.pendingSubscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      circuitBreaker: this.getCircuitBreakerStatus(),
      subscriptionHealth: this.getSubscriptionHealthStatus(),
      subscriptions: Array.from(this.subscriptionRegistry.entries()).map(([channelName, sub]) => ({
        channelName,
        userId: sub.userId,
        teamId: sub.teamId,
        age: now - sub.createdAt,
        lastActivity: now - sub.lastActivity
      }))
    };
  }

  // Get active channel count for debugging
  getActiveChannelCount(): number {
    return this.activeChannels.size;
  }

  // Get active channel names for debugging
  getActiveChannelNames(): string[] {
    return Array.from(this.activeChannels.keys());
  }

  // Test WebSocket connection directly
  async testWebSocketConnection(): Promise<{
    success: boolean;
    error?: string;
    diagnostics: any;
  }> {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "https://mpmkbtsufihzdelrlszs.supabase.co",
      websocketUrl: `wss://${(import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || 'mpmkbtsufihzdelrlszs.supabase.co')}/realtime/v1/websocket`,
      hasRealtime: !!supabase.realtime,
      isConnected: supabase.realtime?.isConnected?.() || false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      environment: {
        dev: import.meta.env.DEV,
        disableRealtime: import.meta.env.VITE_DISABLE_REALTIME,
        enableRealtime: import.meta.env.VITE_ENABLE_REALTIME,
        realtimeDebug: import.meta.env.VITE_REALTIME_DEBUG
      }
    };

    try {
      // Test basic WebSocket connectivity
      const testResult = await this.quickRealTimeTest();

      return {
        success: testResult,
        diagnostics: {
          ...diagnostics,
          testResult,
          connectionStatus: this.connectionStatus,
          activeChannels: this.getActiveChannelCount(),
          reconnectAttempts: this.reconnectAttempts
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        diagnostics: {
          ...diagnostics,
          error: error instanceof Error ? error.stack : error
        }
      };
    }
  }

  /**
   * Enhanced channel error handling with recovery strategies
   */
  private async handleChannelError(
    channelName: string,
    userId: string,
    teamId: string | undefined,
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', notification: Notification) => void,
    options?: any,
    recursionDepth: number = 0
  ): Promise<void> {
    console.log(`🔧 Handling channel error for: ${channelName}`);

    // Clean up the failed channel
    this.cleanupSubscription(channelName);
    this.notifyConnectionStatusChange('disconnected');

    // Strategy 1: Try immediate reconnection with shorter channel name
    if (this.reconnectAttempts < 2) {
      console.log('🔄 Attempting immediate recovery with optimized channel...');

      try {
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to reestablish the subscription
        const connected = await this.ensureConnection();
        if (connected) {
          // Retry the subscription with the same parameters, incrementing recursion depth
          return this.subscribeToAllUserNotificationChanges(callback, teamId, {
            ...options,
            _recursionDepth: recursionDepth
          });
        }
      } catch (retryError) {
        console.warn('Immediate recovery failed:', retryError);
      }
    }

    // Strategy 2: Try fallback subscription without filters
    if (this.reconnectAttempts < 3) {
      console.log('🔄 Attempting fallback subscription without filters...');
      try {
        await this.createFallbackSubscription(userId, teamId, callback, recursionDepth);
        return; // Success, no need for exponential backoff
      } catch (fallbackError) {
        console.warn('Fallback subscription failed:', fallbackError);
      }
    }

    // Strategy 3: Exponential backoff reconnection
    this.reconnectWithBackoff();
  }

  /**
   * Handle channel timeout with progressive recovery
   */
  private async handleChannelTimeout(
    channelName: string,
    userId: string,
    teamId: string | undefined,
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', notification: Notification) => void,
    options?: any,
    recursionDepth: number = 0
  ): Promise<void> {
    console.log(`⏰ Handling channel timeout for: ${channelName}`);

    // Clean up the timed out channel
    this.cleanupSubscription(channelName);

    // Progressive timeout recovery
    const timeoutDelay = Math.min(3000 * (this.reconnectAttempts + 1), 15000);
    console.log(`🔄 Retrying after timeout in ${timeoutDelay}ms...`);

    setTimeout(async () => {
      try {
        const connected = await this.ensureConnection();
        if (connected) {
          return this.subscribeToAllUserNotificationChanges(callback, teamId, {
            ...options,
            _recursionDepth: recursionDepth
          });
        }
      } catch (error) {
        console.error('Timeout recovery failed:', error);
        this.reconnectWithBackoff();
      }
    }, timeoutDelay);
  }

  /**
   * 🔧 ENHANCED: Validate and repair subscription registry integrity
   */
  private validateSubscriptionRegistry(): void {
    const orphanedChannels: string[] = [];
    const duplicateChannels: Map<string, string[]> = new Map();

    // Check for orphaned channels in activeChannels but not in subscriptionRegistry
    for (const [channelName, channel] of this.activeChannels) {
      if (!this.subscriptionRegistry.has(channelName)) {
        orphanedChannels.push(channelName);
      }
    }

    // Check for duplicate user/team combinations
    const userTeamMap: Map<string, string[]> = new Map();
    for (const [channelName, subscription] of this.subscriptionRegistry) {
      const key = `${subscription.userId}-${subscription.teamId || 'none'}`;
      if (!userTeamMap.has(key)) {
        userTeamMap.set(key, []);
      }
      userTeamMap.get(key)!.push(channelName);
    }

    for (const [key, channels] of userTeamMap) {
      if (channels.length > 1) {
        duplicateChannels.set(key, channels);
      }
    }

    // Clean up orphaned channels
    if (orphanedChannels.length > 0) {
      console.log(`🔧 Found ${orphanedChannels.length} orphaned channels, cleaning up...`);
      orphanedChannels.forEach(channelName => {
        const channel = this.activeChannels.get(channelName);
        if (channel) {
          this.safeRemoveChannel(channel, channelName);
        }
        this.activeChannels.delete(channelName);
      });
    }

    // Clean up duplicate subscriptions (keep the most recent)
    if (duplicateChannels.size > 0) {
      console.log(`🔧 Found ${duplicateChannels.size} duplicate subscription groups, cleaning up...`);
      for (const [key, channels] of duplicateChannels) {
        // Sort by creation time, keep the most recent
        const subscriptions = channels.map(name => ({
          name,
          subscription: this.subscriptionRegistry.get(name)!
        })).sort((a, b) => b.subscription.createdAt - a.subscription.createdAt);

        // Clean up all but the most recent
        for (let i = 1; i < subscriptions.length; i++) {
          console.log(`🔧 Removing duplicate subscription: ${subscriptions[i].name}`);
          this.cleanupSubscription(subscriptions[i].name);
        }
      }
    }
  }

  /**
   * OPTIMIZATION: Connection health monitoring and automatic cleanup
   */
  startConnectionHealthMonitoring(): void {
    // Clean up stale subscriptions every 5 minutes
    setInterval(() => {
      this.cleanupStaleSubscriptions();
    }, 5 * 60 * 1000);

    // Monitor connection health every minute
    setInterval(() => {
      this.monitorConnectionHealth();
    }, 60 * 1000);

    // Validate subscription registry every 10 minutes
    setInterval(() => {
      this.validateSubscriptionRegistry();
    }, 10 * 60 * 1000);
  }

  /**
   * 🔧 ENHANCED: Clean up stale subscriptions with intelligent thresholds
   */
  private cleanupStaleSubscriptions(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const veryStaleThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const toCleanup: string[] = [];
    const toCleanupImmediate: string[] = [];

    for (const [channelName, subscription] of this.subscriptionRegistry) {
      const inactiveTime = now - subscription.lastActivity;

      if (inactiveTime > veryStaleThreshold) {
        // Very stale - clean up immediately
        toCleanupImmediate.push(channelName);
        console.log(`🧹 Cleaning up very stale subscription: ${channelName} (inactive for ${Math.round(inactiveTime / 60000)} minutes)`);
      } else if (inactiveTime > staleThreshold) {
        // Moderately stale - clean up in batch
        toCleanup.push(channelName);
        console.log(`🧹 Cleaning up stale subscription: ${channelName} (inactive for ${Math.round(inactiveTime / 60000)} minutes)`);
      }
    }

    // Clean up very stale subscriptions immediately
    toCleanupImmediate.forEach(channelName => this.cleanupSubscription(channelName));

    // Clean up moderately stale subscriptions in batches
    if (toCleanup.length > 0) {
      const batchSize = 3;
      for (let i = 0; i < toCleanup.length; i += batchSize) {
        const batch = toCleanup.slice(i, i + batchSize);
        setTimeout(() => {
          batch.forEach(channelName => this.cleanupSubscription(channelName));
        }, i * 100); // 100ms delay between batches
      }
    }

    if (toCleanup.length > 0 || toCleanupImmediate.length > 0) {
      console.log(`🧹 Cleaned up ${toCleanupImmediate.length} very stale and ${toCleanup.length} stale subscriptions`);
    }
  }

  /**
   * Monitor overall connection health
   */
  private monitorConnectionHealth(): void {
    const state = this.getConnectionState();

    // Only log health metrics in development or when explicitly enabled
    if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_CONNECTION_LOGS === 'true') {
      console.log(`📊 Connection Health: ${state.activeChannels} channels, ${state.registeredSubscriptions} subscriptions, ${state.pendingSubscriptions} pending`);
    }

    // Alert if too many subscriptions (potential leak) - always show critical alerts
    if (state.activeChannels > 10) {
      console.warn(`⚠️ High number of active channels (${state.activeChannels}). Possible subscription leak.`);
    }

    // Alert if many pending subscriptions (potential issue) - always show critical alerts
    if (state.pendingSubscriptions > 5) {
      console.warn(`⚠️ High number of pending subscriptions (${state.pendingSubscriptions}). Possible connection issues.`);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  async createNotification(
    recipientId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      teamId?: string;
      priority?: NotificationPriority;
      actionUrl?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      metadata?: Record<string, any>;
      expiresAt?: string;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: recipientId,
        team_id: options?.teamId,
        type,
        priority: options?.priority || 'medium',
        title,
        message,
        action_url: options?.actionUrl,
        related_entity_type: options?.relatedEntityType,
        related_entity_id: options?.relatedEntityId,
        metadata: options?.metadata || {},
        expires_at: options?.expiresAt,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id;
  }

  async bulkCreateNotifications(
    notifications: Array<{
      recipientId: string;
      type: NotificationType;
      title: string;
      message: string;
      teamId?: string;
      priority?: NotificationPriority;
      actionUrl?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      metadata?: Record<string, any>;
      expiresAt?: string;
    }>
  ): Promise<string[]> {
    const notificationData = notifications.map(n => ({
      recipient_id: n.recipientId,
      team_id: n.teamId,
      type: n.type,
      priority: n.priority || 'medium',
      title: n.title,
      message: n.message,
      action_url: n.actionUrl,
      related_entity_type: n.relatedEntityType,
      related_entity_id: n.relatedEntityId,
      metadata: n.metadata || {},
      expires_at: n.expiresAt,
    }));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select('id');

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(item => item.id);
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).length;
  }

  // =============================================
  // NOTIFICATION PREFERENCES
  // =============================================

  async getUserNotificationPreferences(userId?: string): Promise<NotificationPreferences> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;

    if (!targetUserId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('get_user_notification_preferences', {
      _user_id: targetUserId
    });

    if (error) {
      throw new Error(error.message);
    }

    return data?.[0] || this.getDefaultNotificationPreferences(targetUserId);
  }

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('upsert_notification_preferences', {
      _user_id: user.id,
      _preferences: preferences
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private getDefaultNotificationPreferences(userId: string): NotificationPreferences {
    return {
      user_id: userId,
      email_enabled: true,
      email_receipt_processing_completed: true,
      email_receipt_processing_failed: true,
      email_receipt_ready_for_review: false,
      email_receipt_batch_completed: true,
      email_receipt_batch_failed: true,
      email_team_invitations: true,
      email_team_activity: false,
      email_billing_updates: true,
      email_security_alerts: true,
      email_weekly_reports: false,
      push_enabled: true,
      push_receipt_processing_completed: true,
      push_receipt_processing_failed: true,
      push_receipt_ready_for_review: true,
      push_receipt_batch_completed: true,
      push_receipt_batch_failed: true,
      push_team_invitations: true,
      push_team_activity: true,
      push_receipt_comments: true,
      push_receipt_shared: true,
      browser_permission_granted: false,
      quiet_hours_enabled: false,
      timezone: 'Asia/Kuala_Lumpur',
      daily_digest_enabled: false,
      weekly_digest_enabled: false,
      digest_time: '09:00',
    };
  }

  // =============================================
  // PUSH SUBSCRIPTION MANAGEMENT
  // =============================================

  async subscribeToPushNotifications(subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }, userAgent?: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('upsert_push_subscription', {
      _user_id: user.id,
      _endpoint: subscription.endpoint,
      _p256dh_key: subscription.keys.p256dh,
      _auth_key: subscription.keys.auth,
      _user_agent: userAgent
    });

    if (error) {
      throw new Error(error.message);
    }

    // Update notification preferences to mark browser permission as granted
    await this.updateNotificationPreferences({
      browser_permission_granted: true,
      browser_permission_requested_at: new Date().toISOString()
    });

    return data;
  }

  async unsubscribeFromPushNotifications(endpoint: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getUserPushSubscriptions(): Promise<PushSubscription[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  // =============================================
  // RECEIPT-SPECIFIC NOTIFICATION HELPERS
  // =============================================

  async createReceiptProcessingNotification(
    recipientId: string,
    receiptId: string,
    type: 'receipt_processing_started' | 'receipt_processing_completed' | 'receipt_processing_failed' | 'receipt_ready_for_review',
    options?: {
      teamId?: string;
      merchant?: string;
      total?: number;
      currency?: string;
      errorMessage?: string;
    }
  ): Promise<string> {
    const titles = {
      receipt_processing_started: 'Processing Started',
      receipt_processing_completed: 'Receipt Completed',
      receipt_processing_failed: 'Processing Failed',
      receipt_ready_for_review: 'Review Needed'
    };

    const messages = {
      receipt_processing_started: options?.merchant
        ? `Processing receipt from ${options.merchant}...`
        : 'Your receipt is being processed...',
      receipt_processing_completed: options?.merchant && options?.total
        ? `Receipt from ${options.merchant} (${options.currency || 'MYR'} ${options.total}) has been processed successfully`
        : 'Your receipt has been processed successfully',
      receipt_processing_failed: options?.errorMessage
        ? `Receipt processing failed: ${options.errorMessage}`
        : 'Receipt processing failed. Please try again.',
      receipt_ready_for_review: options?.merchant
        ? `Receipt from ${options.merchant} is ready for your review`
        : 'Your receipt is ready for review'
    };

    const priority: NotificationPriority = type === 'receipt_processing_failed' ? 'high' : 'medium';

    return this.createNotification(
      recipientId,
      type,
      titles[type],
      messages[type],
      {
        teamId: options?.teamId,
        priority,
        actionUrl: `/receipt/${receiptId}`,
        relatedEntityType: 'receipt',
        relatedEntityId: receiptId,
        metadata: {
          merchant: options?.merchant,
          total: options?.total,
          currency: options?.currency,
          errorMessage: options?.errorMessage
        }
      }
    );
  }

  async createBatchProcessingNotification(
    recipientId: string,
    type: 'receipt_batch_completed' | 'receipt_batch_failed',
    batchInfo: {
      totalReceipts: number;
      successfulReceipts?: number;
      failedReceipts?: number;
      teamId?: string;
    }
  ): Promise<string> {
    const isSuccess = type === 'receipt_batch_completed';
    const title = isSuccess ? 'Batch Processing Completed' : 'Batch Processing Failed';

    let message: string;
    if (isSuccess) {
      message = `Successfully processed ${batchInfo.successfulReceipts || batchInfo.totalReceipts} of ${batchInfo.totalReceipts} receipts`;
      if (batchInfo.failedReceipts && batchInfo.failedReceipts > 0) {
        message += ` (${batchInfo.failedReceipts} failed)`;
      }
    } else {
      message = `Failed to process ${batchInfo.failedReceipts || batchInfo.totalReceipts} of ${batchInfo.totalReceipts} receipts`;
    }

    return this.createNotification(
      recipientId,
      type,
      title,
      message,
      {
        teamId: batchInfo.teamId,
        priority: isSuccess ? 'medium' : 'high',
        actionUrl: '/dashboard',
        relatedEntityType: 'batch_upload',
        metadata: batchInfo
      }
    );
  }

  async createTeamReceiptNotification(
    recipientId: string,
    receiptId: string,
    type: 'receipt_shared' | 'receipt_comment_added' | 'receipt_edited_by_team_member' | 'receipt_approved_by_team' | 'receipt_flagged_for_review',
    options: {
      teamId: string;
      actorName: string;
      merchant?: string;
      comment?: string;
      reason?: string;
    }
  ): Promise<string> {
    const titles = {
      receipt_shared: 'Receipt Shared',
      receipt_comment_added: 'New Comment Added',
      receipt_edited_by_team_member: 'Receipt Edited',
      receipt_approved_by_team: 'Receipt Approved',
      receipt_flagged_for_review: 'Receipt Flagged for Review'
    };

    const messages = {
      receipt_shared: `${options.actorName} shared a receipt${options.merchant ? ` from ${options.merchant}` : ''} with your team`,
      receipt_comment_added: `${options.actorName} added a comment${options.merchant ? ` to the receipt from ${options.merchant}` : ''}${options.comment ? `: "${options.comment}"` : ''}`,
      receipt_edited_by_team_member: `${options.actorName} edited a receipt${options.merchant ? ` from ${options.merchant}` : ''}`,
      receipt_approved_by_team: `${options.actorName} approved a receipt${options.merchant ? ` from ${options.merchant}` : ''}`,
      receipt_flagged_for_review: `${options.actorName} flagged a receipt${options.merchant ? ` from ${options.merchant}` : ''} for review${options.reason ? `: ${options.reason}` : ''}`
    };

    const priority: NotificationPriority = type === 'receipt_flagged_for_review' ? 'high' : 'medium';

    return this.createNotification(
      recipientId,
      type,
      titles[type],
      messages[type],
      {
        teamId: options.teamId,
        priority,
        actionUrl: `/receipt/${receiptId}`,
        relatedEntityType: 'receipt',
        relatedEntityId: receiptId,
        metadata: {
          actorName: options.actorName,
          merchant: options.merchant,
          comment: options.comment,
          reason: options.reason
        }
      }
    );
  }

  // =============================================
  // CIRCUIT BREAKER METHODS
  // =============================================

  /**
   * Check if circuit breaker allows operation
   */
  private canExecuteOperation(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if recovery timeout has passed
        if (now - this.circuitBreaker.lastFailureTime >= this.circuitBreaker.recoveryTimeout) {
          console.log('🔄 Circuit breaker transitioning to half-open state');
          this.circuitBreaker.state = 'half-open';
          this.circuitBreaker.successCount = 0;
          return true;
        }
        return false;

      case 'half-open':
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation for circuit breaker
   */
  private recordSuccess(): void {
    this.circuitBreaker.failureCount = 0;

    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.successCount++;
      // After 3 successful operations, close the circuit
      if (this.circuitBreaker.successCount >= 3) {
        console.log('✅ Circuit breaker closing - operations successful');
        this.circuitBreaker.state = 'closed';
        this.circuitBreaker.successCount = 0;
      }
    }
  }

  /**
   * Record failed operation for circuit breaker
   */
  private recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      console.warn('🔴 Circuit breaker opening due to repeated failures');
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  private getCircuitBreakerStatus(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.circuitBreaker.state,
      failureCount: this.circuitBreaker.failureCount,
      successCount: this.circuitBreaker.successCount,
      lastFailureTime: this.circuitBreaker.lastFailureTime
    };
  }

  // =============================================
  // FALLBACK SUBSCRIPTION METHODS
  // =============================================

  /**
   * Create a fallback subscription without filters when the main subscription fails
   * This ensures users still get real-time notifications even if there are filter issues
   */
  private async createFallbackSubscription(
    userId: string,
    teamId: string | undefined,
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', notification: Notification) => void,
    recursionDepth: number
  ): Promise<() => void> {
    console.log('🔄 Creating fallback subscription without filters...');

    try {
      // Create a simple subscription without any filters
      const userIdShort = userId.substring(0, 8);
      const fallbackChannelName = `user-fallback-${userIdShort}`;

      const fallbackChannel = supabase
        .channel(fallbackChannelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userId}`, // Only basic user filter
          },
          (payload) => {
            const notification = (payload.new || payload.old) as Notification;

            // Apply client-side filtering since server-side filtering failed
            if (!teamId || notification.team_id === teamId) {
              callback(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', notification);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Fallback subscription established: ${fallbackChannelName}`);
            this.registerSubscription(fallbackChannelName, fallbackChannel, userId, teamId);
            this.notifyConnectionStatusChange('connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Fallback subscription also failed: ${fallbackChannelName}`);
            this.notifyConnectionStatusChange('disconnected');
            // Last resort: use polling mode
            this.enablePollingMode();
          }
        });

      return () => {
        // 🔧 FIX: Use safe removal to prevent recursion
        this.safeRemoveChannel(fallbackChannel, fallbackChannelName);
        this.cleanupSubscription(fallbackChannelName);
      };
    } catch (error) {
      console.error('Failed to create fallback subscription:', error);
      this.enablePollingMode();
      return () => {};
    }
  }

  /**
   * Enable polling mode as a last resort when real-time subscriptions fail
   */
  private enablePollingMode(): void {
    console.log('🔄 Enabling polling mode as fallback for real-time notifications');
    // This would trigger the existing fallback mechanisms in NotificationContext
    this.notifyConnectionStatusChange('disconnected');
  }

  // =============================================
  // SUBSCRIPTION HEALTH MONITORING
  // =============================================

  /**
   * Initialize health monitoring for a subscription
   */
  private initializeHealthMonitoring(channelName: string): void {
    this.subscriptionHealth.set(channelName, {
      channelName,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      errorCount: 0,
      successCount: 0,
      status: 'healthy'
    });
  }

  /**
   * Record successful activity for health monitoring
   */
  private recordHealthSuccess(channelName: string): void {
    const health = this.subscriptionHealth.get(channelName);
    if (health) {
      health.lastActivity = Date.now();
      health.successCount++;
      health.errorCount = Math.max(0, health.errorCount - 1); // Gradually reduce error count

      // Update status based on recent activity
      if (health.errorCount === 0) {
        health.status = 'healthy';
      } else if (health.errorCount < 3) {
        health.status = 'degraded';
      }
    }
  }

  /**
   * Record error for health monitoring
   */
  private recordHealthError(channelName: string): void {
    const health = this.subscriptionHealth.get(channelName);
    if (health) {
      health.errorCount++;
      health.lastActivity = Date.now();

      // Update status based on error count
      if (health.errorCount >= 5) {
        health.status = 'failed';
      } else if (health.errorCount >= 3) {
        health.status = 'degraded';
      }
    }
  }

  /**
   * Get health status for all subscriptions
   */
  private getSubscriptionHealthStatus(): Array<{
    channelName: string;
    status: string;
    errorCount: number;
    successCount: number;
    age: number;
    lastActivity: number;
  }> {
    const now = Date.now();
    return Array.from(this.subscriptionHealth.entries()).map(([channelName, health]) => ({
      channelName,
      status: health.status,
      errorCount: health.errorCount,
      successCount: health.successCount,
      age: now - health.createdAt,
      lastActivity: now - health.lastActivity
    }));
  }

  /**
   * Clean up health monitoring for a subscription
   */
  private cleanupHealthMonitoring(channelName: string): void {
    this.subscriptionHealth.delete(channelName);
  }

  // =============================================
  // VALIDATION HELPERS
  // =============================================

  /**
   * Get valid notification types from the enum definition
   * This helps prevent subscription errors from invalid types
   */
  private getValidNotificationTypes(): NotificationType[] {
    return [
      // Team collaboration notifications
      'team_invitation_sent',
      'team_invitation_accepted',
      'team_member_joined',
      'team_member_left',
      'team_member_role_changed',
      'claim_submitted',
      'claim_approved',
      'claim_rejected',
      'claim_review_requested',
      'team_settings_updated',
      // Receipt processing notifications
      'receipt_processing_started',
      'receipt_processing_completed',
      'receipt_processing_failed',
      'receipt_ready_for_review',
      'receipt_batch_completed',
      'receipt_batch_failed',
      // Team receipt collaboration notifications
      'receipt_shared',
      'receipt_comment_added',
      'receipt_edited_by_team_member',
      'receipt_approved_by_team',
      'receipt_flagged_for_review'
    ];
  }

  /**
   * Comprehensive subscription validation before creating real-time subscriptions
   * Validates all parameters and provides detailed feedback
   */
  private validateSubscriptionOptions(options?: {
    events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
    notificationTypes?: NotificationType[];
    priorities?: NotificationPriority[];
  }): { isValid: boolean; errors: string[]; sanitizedOptions: any } {
    const errors: string[] = [];
    const sanitizedOptions: any = { ...options };

    // Validate events
    if (options?.events) {
      const validEvents = ['INSERT', 'UPDATE', 'DELETE'];
      const invalidEvents = options.events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        errors.push(`Invalid events: ${invalidEvents.join(', ')}`);
        sanitizedOptions.events = options.events.filter(event => validEvents.includes(event));
      }
    }

    // Validate notification types
    if (options?.notificationTypes) {
      const validTypes = this.getValidNotificationTypes();
      const invalidTypes = options.notificationTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid notification types: ${invalidTypes.join(', ')}`);
        sanitizedOptions.notificationTypes = options.notificationTypes.filter(type => validTypes.includes(type));
      }
    }

    // Validate priorities
    if (options?.priorities) {
      const validPriorities: NotificationPriority[] = ['low', 'medium', 'high'];
      const invalidPriorities = options.priorities.filter(priority => !validPriorities.includes(priority));
      if (invalidPriorities.length > 0) {
        errors.push(`Invalid priorities: ${invalidPriorities.join(', ')}`);
        sanitizedOptions.priorities = options.priorities.filter(priority => validPriorities.includes(priority));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedOptions
    };
  }

  /**
   * Advanced filter validation to prevent malformed PostgREST filters
   * 🔧 FIXED: Distinguish between legitimate PostgreSQL event types and actual SQL injection patterns
   */
  private validateFilter(filter: string): { isValid: boolean; error?: string; sanitizedFilter?: string } {
    try {
      // Check for basic filter structure
      if (!filter.includes('recipient_id=eq.')) {
        return { isValid: false, error: 'Filter must include recipient_id constraint' };
      }

      // Validate filter syntax patterns
      const filterParts = filter.split('&');
      for (const part of filterParts) {
        if (part.includes('=in.(') && !part.includes(')')) {
          return { isValid: false, error: `Malformed in() filter: ${part}` };
        }

        // 🔧 ENHANCED: Validate proper syntax in in() filters
        if (part.includes('=in.(') && part.includes(')')) {
          const inFilterMatch = part.match(/=in\.\(([^)]+)\)/);
          if (inFilterMatch) {
            const values = inFilterMatch[1];
            // Check for proper PostgREST in() syntax - values should be unquoted unless they contain commas
            if (values.includes('"') && !values.includes(',')) {
              console.warn(`⚠️ Unnecessary quotes in in() filter - PostgREST expects unquoted values: ${part}`);
            }
          }
        }

        // 🔧 FIXED: Check for actual SQL injection patterns, excluding legitimate PostgreSQL event types
        // Note: UPDATE, DELETE, INSERT are legitimate PostgreSQL event types used by Supabase realtime
        // They should only be flagged if they appear in dangerous SQL contexts, not as notification types
        const actualDangerousPatterns = [
          ';',           // SQL statement terminator
          '--',          // SQL comment
          '/*',          // SQL block comment start
          '*/',          // SQL block comment end
          'DROP TABLE',  // Dangerous SQL command
          'DROP DATABASE', // Dangerous SQL command
          'TRUNCATE',    // Dangerous SQL command
          'ALTER TABLE', // Dangerous SQL command
          'CREATE TABLE', // Potentially dangerous SQL command
          'GRANT',       // SQL permission command
          'REVOKE',      // SQL permission command
          'EXEC',        // SQL execution command
          'EXECUTE',     // SQL execution command
          'UNION',       // SQL injection technique
          'SCRIPT',      // Script injection
          '<SCRIPT',     // XSS attempt
          'JAVASCRIPT:', // XSS attempt
          'VBSCRIPT:',   // XSS attempt
          'ONLOAD',      // XSS attempt
          'ONERROR'      // XSS attempt
        ];

        // Check for actual dangerous patterns
        const upperPart = part.toUpperCase();
        for (const pattern of actualDangerousPatterns) {
          if (upperPart.includes(pattern)) {
            return { isValid: false, error: `Potentially dangerous pattern detected: ${pattern}` };
          }
        }

        // 🔧 ADDITIONAL: Check for suspicious SQL injection patterns in values
        // Look for patterns that might indicate SQL injection in filter values
        if (part.includes('=') && !part.startsWith('recipient_id=') && !part.startsWith('type=') && !part.startsWith('priority=')) {
          // Check for SQL keywords in unexpected filter parameters
          const suspiciousInFilterPatterns = [
            'DELETE FROM',
            'INSERT INTO',
            'UPDATE SET',
            'SELECT FROM',
            'WHERE 1=1',
            'OR 1=1',
            'AND 1=1',
            ') OR (',
            ') AND (',
            'UNION SELECT'
          ];

          for (const suspiciousPattern of suspiciousInFilterPatterns) {
            if (upperPart.includes(suspiciousPattern)) {
              return { isValid: false, error: `Suspicious SQL pattern in filter: ${suspiciousPattern}` };
            }
          }
        }
      }

      return { isValid: true, sanitizedFilter: filter };
    } catch (error) {
      return { isValid: false, error: `Filter validation error: ${error}` };
    }
  }

  // =============================================
  // MONITORING AND DIAGNOSTICS
  // =============================================

  /**
   * Get comprehensive monitoring dashboard for debugging and health checks
   */
  getMonitoringDashboard(): {
    connectionStatus: string;
    circuitBreaker: {
      state: string;
      failureCount: number;
      successCount: number;
      lastFailureTime: number;
      canExecute: boolean;
    };
    subscriptions: {
      active: number;
      registered: number;
      pending: number;
      healthy: number;
      degraded: number;
      failed: number;
    };
    performance: {
      reconnectAttempts: number;
      maxReconnectAttempts: number;
      lastConnectionAttempt: number;
      connectionCooldown: number;
    };
    healthDetails: Array<{
      channelName: string;
      status: string;
      errorCount: number;
      successCount: number;
      age: number;
      lastActivity: number;
    }>;
  } {
    const healthStatus = this.getSubscriptionHealthStatus();
    const circuitBreakerStatus = this.getCircuitBreakerStatus();

    return {
      connectionStatus: this.connectionStatus,
      circuitBreaker: {
        ...circuitBreakerStatus,
        canExecute: this.canExecuteOperation()
      },
      subscriptions: {
        active: this.activeChannels.size,
        registered: this.subscriptionRegistry.size,
        pending: this.pendingSubscriptions.size,
        healthy: healthStatus.filter(h => h.status === 'healthy').length,
        degraded: healthStatus.filter(h => h.status === 'degraded').length,
        failed: healthStatus.filter(h => h.status === 'failed').length
      },
      performance: {
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.retryConfig.maxRetries,
        lastConnectionAttempt: this.lastConnectionAttempt,
        connectionCooldown: this.connectionCooldown
      },
      healthDetails: healthStatus
    };
  }

  /**
   * Log monitoring dashboard to console (useful for debugging)
   */
  logMonitoringDashboard(): void {
    const dashboard = this.getMonitoringDashboard();
    console.group('📊 Notification Service Monitoring Dashboard');
    console.log('🔌 Connection Status:', dashboard.connectionStatus);
    console.log('🔴 Circuit Breaker:', dashboard.circuitBreaker);
    console.log('📡 Subscriptions:', dashboard.subscriptions);
    console.log('⚡ Performance:', dashboard.performance);
    if (dashboard.healthDetails.length > 0) {
      console.table(dashboard.healthDetails);
    }
    console.groupEnd();
  }

  // =============================================
  // NOTIFICATION PREFERENCE CHECKING
  // =============================================

  async shouldSendNotification(
    userId: string,
    notificationType: NotificationType,
    deliveryMethod: 'email' | 'push'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);

      // Check if the delivery method is enabled
      if (deliveryMethod === 'email' && !preferences.email_enabled) {
        return false;
      }
      if (deliveryMethod === 'push' && !preferences.push_enabled) {
        return false;
      }

      // Check specific notification type preferences
      const preferenceKey = `${deliveryMethod}_${notificationType}` as keyof NotificationPreferences;
      const isEnabled = preferences[preferenceKey];

      if (typeof isEnabled === 'boolean') {
        return isEnabled;
      }

      // Default to true for unknown notification types
      return true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to true if we can't check preferences
      return true;
    }
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);

      if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
        return false;
      }

      const now = new Date();
      const userTimezone = preferences.timezone || 'Asia/Kuala_Lumpur';

      // Convert current time to user's timezone
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }).format(now);

      const [currentHour, currentMinute] = userTime.split(':').map(Number);
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = preferences.quiet_hours_start.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;

      const [endHour, endMinute] = preferences.quiet_hours_end.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (startTimeMinutes > endTimeMinutes) {
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
      } else {
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * 🔧 FIX: Cleanup method for proper service shutdown
   */
  cleanup(): void {
    console.log('🧹 Cleaning up notification service...');

    // Clear any pending batch cleanup timer
    if (this.cleanupBatchTimer) {
      clearTimeout(this.cleanupBatchTimer);
      this.cleanupBatchTimer = null;
    }

    // Process any remaining deferred cleanup
    if (this.deferredCleanupQueue.size > 0) {
      this.processDeferredCleanup();
    }

    // Clear all registries
    this.subscriptionRegistry.clear();
    this.activeChannels.clear();
    this.cleanupInProgress.clear();
    this.deferredCleanupQueue.clear();

    // Clear timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    console.log('✅ Notification service cleanup completed');
  }
}

export const notificationService = new NotificationService();

// 🔧 ENHANCED: Expose monitoring dashboard in development for debugging
if (import.meta.env.DEV) {
  (window as any).notificationServiceDebug = {
    getMonitoringDashboard: () => notificationService.getMonitoringDashboard(),
    logMonitoringDashboard: () => notificationService.logMonitoringDashboard(),
    getConnectionState: () => notificationService.getConnectionState(),
    resetConnectionState: () => notificationService.resetConnectionState()
  };
  console.log('🔧 Notification Service Debug Tools available at window.notificationServiceDebug');
}
