import { supabase } from '@/integrations/supabase/client';
import {
  Notification,
  NotificationFilters,
  NotificationStats,
  NotificationType,
  NotificationPriority,
} from '@/types/notifications';

export class NotificationService {
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

  subscribeToUserNotifications(
    callback: (notification: Notification) => void,
    teamId?: string
  ) {
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${supabase.auth.getUser().then(u => u.data.user?.id)}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          if (!teamId || notification.team_id === teamId) {
            callback(notification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  subscribeToNotificationUpdates(
    notificationId: string,
    callback: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel(`notification-${notificationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `id=eq.${notificationId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
}

export const notificationService = new NotificationService();
