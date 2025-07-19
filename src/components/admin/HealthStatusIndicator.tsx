/**
 * Health Status Indicator
 * Compact health status indicator for dashboard header
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 4
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Bell,
  Clock
} from 'lucide-react';
import { useHealthMonitoring } from '@/hooks/useHealthMonitoring';
import { cn } from '@/lib/utils';

interface HealthStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function HealthStatusIndicator({ 
  className,
  showDetails = true 
}: HealthStatusIndicatorProps) {
  const {
    healthStatus,
    isLoading,
    isRefreshing,
    refreshHealth,
    lastRefresh,
    isHealthy,
    unacknowledgedAlerts,
    criticalAlerts
  } = useHealthMonitoring({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    enableAlerts: true
  });

  const getStatusIcon = () => {
    if (isLoading || isRefreshing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    if (!healthStatus) {
      return <Activity className="h-4 w-4 text-gray-500" />;
    }

    switch (healthStatus.overallStatus) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    if (!healthStatus) return 'bg-gray-100 text-gray-800';

    switch (healthStatus.overallStatus) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (!healthStatus) return 'Unknown';
    
    return healthStatus.overallStatus.charAt(0).toUpperCase() + 
           healthStatus.overallStatus.slice(1);
  };

  const formatTimeAgo = (timestamp: Date | null) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return timestamp.toLocaleTimeString();
  };

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {getStatusIcon()}
        <Badge className={getStatusColor()}>
          {getStatusText()}
        </Badge>
        {unacknowledgedAlerts > 0 && (
          <Badge variant="destructive" className="ml-1">
            {unacknowledgedAlerts}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn('flex items-center gap-2 h-8', className)}
        >
          {getStatusIcon()}
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
          {unacknowledgedAlerts > 0 && (
            <Badge variant="destructive" className="ml-1">
              {unacknowledgedAlerts}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">System Health</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshHealth}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>

          {/* Overall Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Status</span>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <Badge className={getStatusColor()}>
                  {getStatusText()}
                </Badge>
              </div>
            </div>
            
            {healthStatus && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Health Score</span>
                <span className="font-medium">{healthStatus.healthScore}/100</span>
              </div>
            )}
          </div>

          {/* Alerts Summary */}
          {(unacknowledgedAlerts > 0 || criticalAlerts > 0) && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Active Alerts
              </h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {criticalAlerts > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Critical</span>
                    <Badge variant="destructive">{criticalAlerts}</Badge>
                  </div>
                )}
                {unacknowledgedAlerts > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-600">Unacknowledged</span>
                    <Badge variant="secondary">{unacknowledgedAlerts}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Component Status */}
          {healthStatus?.components && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Components</h5>
              <div className="space-y-1">
                {healthStatus.components.slice(0, 4).map((component, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {component.component.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1">
                      {component.status === 'healthy' ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : component.status === 'warning' ? (
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs capitalize">{component.status}</span>
                    </div>
                  </div>
                ))}
                {healthStatus.components.length > 4 && (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    +{healthStatus.components.length - 4} more components
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Issues */}
          {healthStatus?.issues && healthStatus.issues.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-red-800 dark:text-red-200">Issues</h5>
              <div className="space-y-1">
                {healthStatus.issues.slice(0, 2).map((issue, index) => (
                  <div key={index} className="text-xs text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-800/50">
                    {issue}
                  </div>
                ))}
                {healthStatus.issues.length > 2 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{healthStatus.issues.length - 2} more issues
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Last Update */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last check
            </div>
            <span>{formatTimeAgo(lastRefresh)}</span>
          </div>

          {/* No Issues State */}
          {healthStatus && 
           healthStatus.overallStatus === 'healthy' && 
           unacknowledgedAlerts === 0 && 
           criticalAlerts === 0 && (
            <div className="text-center py-2">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="text-sm text-green-700 font-medium">All Systems Operational</p>
              <p className="text-xs text-green-600">No issues detected</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
