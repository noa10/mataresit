/**
 * System Alerts Panel
 * Real-time alerts and notifications for system health issues
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 4
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  X,
  Bell,
  BellOff,
  Filter,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAlertColors,
  getAlertClasses,
  getButtonStateClasses,
  getRingColors,
  getMutedTextClasses,
  getEmphasisTextClasses
} from '@/lib/darkModeUtils';

export interface SystemAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  component: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  details?: Record<string, any>;
}

interface SystemAlertsPanelProps {
  className?: string;
  maxAlerts?: number;
}

export function SystemAlertsPanel({ 
  className, 
  maxAlerts = 50 
}: SystemAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('unresolved');
  const [isAlertsEnabled, setIsAlertsEnabled] = useState(true);

  // Generate mock alerts for demonstration
  useEffect(() => {
    const mockAlerts: SystemAlert[] = [
      {
        id: '1',
        type: 'warning',
        title: 'Database Response Time Elevated',
        message: 'Database queries are taking longer than usual (avg: 2.5s)',
        component: 'database',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        acknowledged: false,
        resolved: false,
        details: { avgResponseTime: 2500, threshold: 1000 }
      },
      {
        id: '2',
        type: 'info',
        title: 'Embedding Tables Not Found',
        message: 'Embedding metrics tables are not yet deployed',
        component: 'embedding_tables',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        acknowledged: true,
        resolved: false,
        details: { missingTables: ['embedding_performance_metrics', 'embedding_hourly_stats'] }
      },
      {
        id: '3',
        type: 'success',
        title: 'Cache System Optimized',
        message: 'Cache hit rate improved to 95.2%',
        component: 'cache_system',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        acknowledged: true,
        resolved: true,
        details: { hitRate: 95.2, previousHitRate: 78.5 }
      },
      {
        id: '4',
        type: 'warning',
        title: 'Aggregation Functions Missing',
        message: 'Supabase functions for metrics aggregation are not deployed',
        component: 'aggregation_functions',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        acknowledged: false,
        resolved: false,
        details: { missingFunctions: ['check_embedding_aggregation_health', 'webhook_trigger_embedding_aggregation'] }
      },
      {
        id: '5',
        type: 'info',
        title: 'Health Monitoring Started',
        message: 'System health monitoring is now active',
        component: 'health_monitor',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        acknowledged: true,
        resolved: true,
        details: { interval: 30000, components: 6 }
      }
    ];

    setAlerts(mockAlerts);
  }, []);

  const getAlertIcon = (type: string) => {
    const alertType = type as 'critical' | 'warning' | 'success' | 'info';
    const colors = getAlertColors(alertType);

    switch (type) {
      case 'critical': return <XCircle className={cn("h-4 w-4", colors.icon)} />;
      case 'warning': return <AlertTriangle className={cn("h-4 w-4", colors.icon)} />;
      case 'success': return <CheckCircle className={cn("h-4 w-4", colors.icon)} />;
      default: return <Clock className={cn("h-4 w-4", colors.icon)} />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return time.toLocaleDateString();
  };

  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unresolved': return !alert.resolved;
      case 'critical': return alert.type === 'critical';
      default: return true;
    }
  });

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true, acknowledged: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllResolved = () => {
    setAlerts(prev => prev.filter(alert => !alert.resolved));
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged && !a.resolved).length;
  const criticalCount = alerts.filter(a => a.type === 'critical' && !a.resolved).length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            System Alerts
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledgedCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAlertsEnabled(!isAlertsEnabled)}
              className={getButtonStateClasses(isAlertsEnabled)}
            >
              {isAlertsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllResolved}
              disabled={alerts.filter(a => a.resolved).length === 0}
            >
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({alerts.length})
          </Button>
          <Button
            variant={filter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unresolved')}
          >
            Unresolved ({alerts.filter(a => !a.resolved).length})
          </Button>
          <Button
            variant={filter === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('critical')}
          >
            Critical ({criticalCount})
          </Button>
        </div>

        {/* Alerts List */}
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600 dark:text-green-400 mb-4" />
                <p className={getEmphasisTextClasses()}>No alerts to display</p>
                <p className={getMutedTextClasses("text-sm")}>
                  {filter === 'all' ? 'System is running smoothly' :
                   filter === 'critical' ? 'No critical issues detected' :
                   'All issues have been resolved'}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const alertType = alert.type as 'critical' | 'warning' | 'success' | 'info';
                const ringColor = getRingColors(alertType);

                return (
                <div
                  key={alert.id}
                  className={cn(
                    getAlertClasses(alertType),
                    alert.resolved && 'opacity-60',
                    !alert.acknowledged && !alert.resolved && `ring-2 ring-offset-2 ${ringColor}`,
                    alert.type === 'critical' && !alert.resolved && 'ring-red-500',
                    alert.type === 'warning' && !alert.acknowledged && 'ring-yellow-500'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{alert.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {alert.component}
                          </Badge>
                          {alert.acknowledged && (
                            <Badge variant="secondary" className="text-xs">
                              Acknowledged
                            </Badge>
                          )}
                          {alert.resolved && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mb-2">{alert.message}</p>
                        <p className="text-xs opacity-75">{formatTimeAgo(alert.timestamp)}</p>
                        
                        {alert.details && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
                              View Details
                            </summary>
                            <pre className="text-xs bg-black/10 p-2 rounded mt-1 overflow-auto">
                              {JSON.stringify(alert.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      {!alert.acknowledged && !alert.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="h-8 w-8 p-0"
                          title="Acknowledge"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {!alert.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          className="h-8 w-8 p-0"
                          title="Mark as Resolved"
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissAlert(alert.id)}
                        className="h-8 w-8 p-0"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        {alerts.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {alerts.filter(a => a.type === 'warning' && !a.resolved).length}
                </p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {alerts.filter(a => a.type === 'info' && !a.resolved).length}
                </p>
                <p className="text-xs text-muted-foreground">Info</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {alerts.filter(a => a.resolved).length}
                </p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
