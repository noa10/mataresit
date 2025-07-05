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
      console.error('Max reconnection attempts reached');
      this.notifyConnectionStatusChange('disconnected');
      this.connectionInProgress = false;
      return false;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    return await this.ensureConnection();
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
        return false;
      }

      // Now that we've fixed the database configuration, enable real-time in production
      const realTimeEnabled = import.meta.env.VITE_ENABLE_REALTIME !== 'false';
      if (!realTimeEnabled) {
        console.log('🚫 Real-time explicitly disabled via VITE_ENABLE_REALTIME=false');
        return false;
      }

      // Quick connection test with reasonable timeout
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Real-time quick test timeout (3s)');
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
            clearTimeout(timeout);
            try {
              supabase.removeChannel(testChannel);
            } catch (e) {
              // Ignore cleanup errors
            }

            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time test channel subscribed successfully');
              resolve(true);
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('❌ Real-time test channel error');
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

  // Get connection state for debugging
  getConnectionState(): {
    status: string;
    inProgress: boolean;
    attempts: number;
    lastAttempt: number;
    activeChannels: number;
    realTimeAvailable: boolean;
  } {
    return {
      status: this.connectionStatus,
      inProgress: this.connectionInProgress,
      attempts: this.reconnectAttempts,
      lastAttempt: this.lastConnectionAttempt,
      activeChannels: this.activeChannels.size,
      realTimeAvailable: this.isRealTimeAvailable(),
    };
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
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', (await supabase.auth.getUser()).data.user?.id);

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', notificationIds)
      .eq('recipient_id', user.id)
      .is('read_at', null);

    if (error) {
      throw new Error(error.message);
    }
  }

  async bulkArchiveNotifications(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('notifications')
      .update({ archived_at: new Date().toISOString() })
      .in('id', notificationIds)
      .eq('recipient_id', user.id)
      .is('archived_at', null);

    if (error) {
      throw new Error(error.message);
    }
  }

  async bulkDeleteNotifications(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', notificationIds)
      .eq('recipient_id', user.id);

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const updateData: any = {};
    const now = new Date().toISOString();

    if (updates.read !== undefined) {
      updateData.read_at = updates.read ? now : null;
    }
    if (updates.archived !== undefined) {
      updateData.archived_at = updates.archived ? now : null;
    }

    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .in('id', notificationIds)
      .eq('recipient_id', user.id);

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

    const channelName = `user-notifications-${user.id}`;

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
      channelName = `user-notification-updates-${user.id}`;
    } else {
      filter = `id=eq.${notificationId}`;
      channelName = `notification-updates-${notificationId}`;
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
  async subscribeToAllUserNotificationChanges(
    callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', notification: Notification) => void,
    teamId?: string
  ) {
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

    const channelName = `user-all-changes-${user.id}`;

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
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = (payload.new || payload.old) as Notification;
          if (!teamId || notification.team_id === teamId) {
            callback(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', notification);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to all notification changes for user ${user.id}`);
          this.notifyConnectionStatusChange('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for all notification changes: ${channelName}`);
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

  // Clean up all active channels
  disconnectAll(): void {
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
    this.notifyConnectionStatusChange('disconnected');
  }

  // Get active channel count for debugging
  getActiveChannelCount(): number {
    return this.activeChannels.size;
  }

  // Get active channel names for debugging
  getActiveChannelNames(): string[] {
    return Array.from(this.activeChannels.keys());
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
