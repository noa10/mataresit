import React, { useState, useEffect } from 'react';
import { Bell, Check, Archive, Trash2, X, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Notification,
  NotificationPreferences,
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_PRIORITY_COLORS,
  formatNotificationTime,
  shouldShowNotificationWithPreferences,
} from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  teamId?: string;
  className?: string;
}

export function NotificationCenter({ teamId, className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Use centralized notification context
  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    reconnect,
    preferences: notificationPreferences,
  } = useNotifications();

  // Filter notifications by team if specified
  const filteredNotifications = teamId
    ? notifications.filter(n => !n.team_id || n.team_id === teamId)
    : notifications;

  // Filter notifications that should be shown based on user preferences
  const visibleNotifications = filteredNotifications.filter(notification =>
    shouldShowNotificationWithPreferences(notification, notificationPreferences)
  );

  // Calculate unread count based on visible notifications only
  const filteredUnreadCount = visibleNotifications.filter(n => !n.read_at).length;

  // Handle connection error display
  useEffect(() => {
    if (error) {
      toast.error('Connection Error', {
        description: error,
        action: {
          label: 'Reconnect',
          onClick: reconnect,
        },
      });
    }
  }, [error, reconnect]);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      // Use React Router navigation instead of window.location for better UX
      navigate(notification.action_url);
    }

    setOpen(false);
  };

  // Handle refresh action
  const handleRefresh = async () => {
    await refreshNotifications();
  };

  // Handle reconnect action
  const handleReconnect = () => {
    reconnect();
    toast.info('Reconnecting...', {
      description: 'Attempting to restore real-time connection',
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {filteredUnreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 rounded-full p-0 flex items-center justify-center font-bold leading-none",
                filteredUnreadCount > 99
                  ? "h-5 min-w-6 px-1 text-[10px]"
                  : "h-5 w-5 text-[11px]"
              )}
            >
              {filteredUnreadCount > 99 ? '99+' : filteredUnreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {/* Connection status indicator */}
            {isConnected ? (
              <Wifi className="h-3 w-3 text-green-500" title="Connected" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" title="Disconnected" />
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0"
              title="Refresh notifications"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
            {/* Reconnect button (only show when disconnected) */}
            {!isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReconnect}
                className="text-xs"
                title="Reconnect to real-time updates"
              >
                Reconnect
              </Button>
            )}
            {/* Mark all read button */}
            {filteredUnreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading notifications...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4 mx-auto mb-2 text-red-500" />
              <p>Connection error</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReconnect}
                className="mt-2 text-xs"
              >
                Try reconnecting
              </Button>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Bell className="h-4 w-4 mx-auto mb-2" />
              No notifications
            </div>
          ) : (
            <div className="space-y-1">
              {visibleNotifications.map((notification) => (
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
        isUnread ? "bg-blue-900/10 border-l-blue-400" : "border-l-transparent"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-sm",
          typeColor
        )}>
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
