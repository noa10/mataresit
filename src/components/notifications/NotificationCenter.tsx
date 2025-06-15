import React, { useState, useEffect } from 'react';
import { Bell, Check, Archive, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { notificationService } from '@/services/notificationService';
import {
  Notification,
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_PRIORITY_COLORS,
  formatNotificationTime,
  shouldShowNotification,
} from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  teamId?: string;
  className?: string;
}

export function NotificationCenter({ teamId, className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Load notifications
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getUserNotifications(
        { team_id: teamId },
        20,
        0
      );
      setNotifications(data.filter(shouldShowNotification));
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load unread count
  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadNotificationCount(teamId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const updatedCount = await notificationService.markAllNotificationsAsRead(teamId);
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast({
        title: 'Success',
        description: `Marked ${updatedCount} notifications as read`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    }
  };

  // Archive notification
  const archiveNotification = async (notificationId: string) => {
    try {
      await notificationService.archiveNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (!notifications.find(n => n.id === notificationId)?.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast({
        title: 'Success',
        description: 'Notification archived',
      });
    } catch (error) {
      console.error('Error archiving notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive notification',
        variant: 'destructive',
      });
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (!notifications.find(n => n.id === notificationId)?.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast({
        title: 'Success',
        description: 'Notification deleted',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    
    setOpen(false);
  };

  // Load data on mount and when teamId changes
  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [teamId]);

  // Set up real-time subscription
  useEffect(() => {
    const unsubscribe = notificationService.subscribeToUserNotifications(
      (notification) => {
        if (!teamId || notification.team_id === teamId) {
          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for high priority notifications
          if (notification.priority === 'high') {
            toast({
              title: notification.title,
              description: notification.message,
            });
          }
        }
      },
      teamId
    );

    return unsubscribe;
  }, [teamId, toast]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-96">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onArchive={() => archiveNotification(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onMarkAsRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
  onArchive,
  onDelete,
}: NotificationItemProps) {
  const isUnread = !notification.read_at;
  const typeColor = NOTIFICATION_TYPE_COLORS[notification.type];
  const priorityColor = NOTIFICATION_PRIORITY_COLORS[notification.priority];
  const icon = NOTIFICATION_TYPE_ICONS[notification.type];

  return (
    <div
      className={cn(
        "group relative p-3 hover:bg-muted/50 cursor-pointer border-l-2 transition-colors",
        isUnread ? "bg-blue-50 border-l-blue-500" : "border-l-transparent"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn("text-lg", typeColor)}>
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "text-sm font-medium truncate",
              isUnread && "font-semibold"
            )}>
              {notification.title}
            </h4>
            <span className={cn("text-xs", priorityColor)}>
              {notification.priority}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatNotificationTime(notification.created_at)}
            </span>
            
            {notification.team_name && (
              <span className="text-xs text-muted-foreground">
                {notification.team_name}
              </span>
            )}
          </div>
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {isUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              className="h-6 w-6 p-0"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="h-6 w-6 p-0"
          >
            <Archive className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
