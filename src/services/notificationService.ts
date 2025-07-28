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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached, entering fallback mode');
      this.notifyConnectionStatusChange('disconnected');
      this.connectionInProgress = false;

      // Log diagnostic information for debugging
      console.log('🔍 Final connection diagnostic:', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        activeChannels: this.getActiveChannelCount(),
        connectionStatus: this.connectionStatus,
        timestamp: new Date().toISOString()
      });

      return false;
    }

    this.reconnectAttempts++;
    // Cap the delay at 30 seconds and add jitter to prevent thundering herd
    const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const maxDelay = Math.min(baseDelay, 30000);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = maxDelay + jitter;

    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms`);
    this.notifyConnectionStatusChange('reconnecting');

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const connected = await this.ensureConnection();
      if (connected) {
        console.log('✅ Reconnection successful');
        this.reconnectAttempts = 0; // Reset on success
      }
      return connected;
    } catch (error) {
      console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
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
            try {
              supabase.removeChannel(testChannel);
            } catch (e) {
              console.warn('Error cleaning up test channel:', e);
            }

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
            try {
              supabase.removeChannel(testChannel);
            } catch (e) {
              // Ignore cleanup errors
            }
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
      supabase.removeChannel(existingChannel);
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
      supabase.removeChannel(channel);
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
      supabase.removeChannel(existingChannel);
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
      supabase.removeChannel(channel);
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

    // OPTIMIZATION: Build notification type filter to reduce data transfer
    let typeFilter = '';
    if (options?.notificationTypes && options.notificationTypes.length > 0) {
      typeFilter = `&type=in.(${options.notificationTypes.join(',')})`;
    }

    // OPTIMIZATION: Build priority filter
    let priorityFilter = '';
    if (options?.priorities && options.priorities.length > 0) {
      priorityFilter = `&priority=in.(${options.priorities.join(',')})`;
    }

    const filter = `recipient_id=eq.${user.id}${typeFilter}${priorityFilter}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: eventFilter as any,
          schema: 'public',
          table: 'notifications',
          filter,
        },
        (payload) => {
          const notification = (payload.new || payload.old) as Notification;

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
        }
      )
      .subscribe((status) => {
        this.pendingSubscriptions.delete(channelName); // Remove from pending

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to all notification changes for user ${user.id}`);
          this.registerSubscription(channelName, channel, user.id, teamId);
          this.notifyConnectionStatusChange('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for all notification changes: ${channelName}`);
          console.log('🔍 Channel error diagnostic:', {
            channelName,
            userId: user.id,
            teamId,
            activeChannels: this.getActiveChannelCount(),
            reconnectAttempts: this.reconnectAttempts,
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
   * Check if a subscription already exists to prevent duplicates
   */
  private hasActiveSubscription(channelName: string, userId: string, teamId?: string): boolean {
    const existing = this.subscriptionRegistry.get(channelName);
    if (!existing) return false;

    // Check if it's for the same user and team context
    return existing.userId === userId && existing.teamId === teamId;
  }

  /**
   * Register a new subscription with metadata
   */
  private registerSubscription(channelName: string, channel: any, userId: string, teamId?: string): void {
    // Prevent recursive cleanup by checking if we're already cleaning up this channel
    if (!this.cleanupInProgress.has(channelName)) {
      // Clean up any existing subscription with the same name
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
   * Clean up a specific subscription
   */
  private cleanupSubscription(channelName: string): void {
    // TEMPORARY FIX: Disable cleanup to prevent infinite recursion
    console.log(`🚫 TEMP FIX: Skipping cleanup for ${channelName} to prevent infinite recursion`);
    return;

    // Prevent recursive cleanup calls
    if (this.cleanupInProgress.has(channelName)) {
      console.log(`⚠️ Cleanup already in progress for ${channelName}, skipping`);
      return;
    }

    this.cleanupInProgress.add(channelName);

    try {
      const existing = this.subscriptionRegistry.get(channelName);
      if (existing) {
        try {
          supabase.removeChannel(existing.channel);
          console.log(`🧹 Cleaned up subscription: ${channelName}`);
        } catch (error) {
          console.error(`❌ Error cleaning up subscription ${channelName}:`, error);
        }
      }

      this.subscriptionRegistry.delete(channelName);
      this.activeChannels.delete(channelName);

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
   * Clean up subscriptions for a specific user/team context
   */
  cleanupUserSubscriptions(userId: string, teamId?: string): void {
    console.log(`🧹 Cleaning up subscriptions for user ${userId}, team: ${teamId || 'none'}`);

    const toCleanup: string[] = [];
    for (const [channelName, subscription] of this.subscriptionRegistry) {
      if (subscription.userId === userId && subscription.teamId === teamId) {
        toCleanup.push(channelName);
      }
    }

    toCleanup.forEach(channelName => this.cleanupSubscription(channelName));
  }

  /**
   * Clean up all active channels with enhanced logging
   * TEMPORARY FIX: Disabled to prevent infinite recursion
   */
  disconnectAll(): void {
    // TEMPORARY FIX: Disable disconnectAll to prevent infinite recursion
    console.log(`🚫 TEMP FIX: Skipping disconnectAll to prevent infinite recursion`);
    return;

    console.log(`🔌 Disconnecting ${this.activeChannels.size} active channels`);

    for (const [channelName, channel] of this.activeChannels) {
      try {
        supabase.removeChannel(channel);
        console.log(`✅ Disconnected channel: ${channelName}`);
      } catch (error) {
        console.error(`❌ Error disconnecting channel ${channelName}:`, error);
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

    // Strategy 2: Exponential backoff reconnection
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
  }

  /**
   * Clean up subscriptions that haven't been active for a while
   */
  private cleanupStaleSubscriptions(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const toCleanup: string[] = [];

    for (const [channelName, subscription] of this.subscriptionRegistry) {
      if (now - subscription.lastActivity > staleThreshold) {
        console.log(`🧹 Cleaning up stale subscription: ${channelName} (inactive for ${Math.round((now - subscription.lastActivity) / 60000)} minutes)`);
        toCleanup.push(channelName);
      }
    }

    toCleanup.forEach(channelName => this.cleanupSubscription(channelName));
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
}

export const notificationService = new NotificationService();
