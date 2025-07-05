import React from 'react';
import { Bell, BellOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePushNotificationStatus } from '@/contexts/PushNotificationContext';
import { useNavigate } from 'react-router-dom';

interface NotificationStatusIndicatorProps {
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
}

export function NotificationStatusIndicator({ 
  showBadge = true, 
  size = 'md',
  variant = 'ghost' 
}: NotificationStatusIndicatorProps) {
  const navigate = useNavigate();
  const pushStatus = usePushNotificationStatus();

  const handleClick = () => {
    navigate('/settings?tab=notifications');
  };

  const getIcon = () => {
    if (!pushStatus.isAvailable) {
      return <BellOff className="h-4 w-4" />;
    }
    
    if (pushStatus.isBlocked) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    
    if (pushStatus.isEnabled) {
      return <Bell className="h-4 w-4 text-green-500" />;
    }
    
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  const getTooltipText = () => {
    if (!pushStatus.isAvailable) {
      return 'Push notifications not supported';
    }
    
    if (pushStatus.isBlocked) {
      return 'Push notifications blocked - click to enable';
    }
    
    if (pushStatus.isEnabled) {
      return 'Push notifications enabled';
    }
    
    if (pushStatus.needsPermission) {
      return 'Click to enable push notifications';
    }
    
    return 'Push notifications disabled';
  };

  const getBadgeVariant = () => {
    if (!pushStatus.isAvailable || pushStatus.isBlocked) {
      return 'destructive';
    }
    
    if (pushStatus.isEnabled) {
      return 'default';
    }
    
    return 'secondary';
  };

  const getBadgeText = () => {
    if (!pushStatus.isAvailable) {
      return 'N/A';
    }
    
    if (pushStatus.isBlocked) {
      return 'Blocked';
    }
    
    if (pushStatus.isEnabled) {
      return 'On';
    }
    
    return 'Off';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          className="relative"
        >
          {getIcon()}
          {showBadge && (
            <Badge 
              variant={getBadgeVariant()}
              className="absolute -top-1 -right-1 h-4 w-8 text-xs px-1"
            >
              {getBadgeText()}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Simplified version for use in navigation
export function NotificationStatusIcon() {
  const pushStatus = usePushNotificationStatus();
  
  if (!pushStatus.isAvailable) {
    return <BellOff className="h-4 w-4 text-muted-foreground" />;
  }
  
  if (pushStatus.isBlocked) {
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  }
  
  if (pushStatus.isEnabled) {
    return <Bell className="h-4 w-4 text-green-500" />;
  }
  
  return <Bell className="h-4 w-4 text-muted-foreground" />;
}
