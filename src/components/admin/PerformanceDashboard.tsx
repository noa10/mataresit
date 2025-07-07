// OPTIMIZATION: Real-time Performance Dashboard for Admin
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Shield,
  Database,
  Network,
  RefreshCw,
  Download
} from 'lucide-react';
import { performanceMonitor } from '@/services/realTimePerformanceMonitor';
import { useNotifications } from '@/contexts/NotificationContext';
import { getReceiptSubscriptionStats, getReceiptSubscriptionHealth } from '@/services/receiptService';
import { notificationService } from '@/services/notificationService';

interface DashboardData {
  performance: any;
  notifications: any;
  receipts: any;
  receiptHealth: any;
  alerts: any[];
  summary: any;
}

export function PerformanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { getRateLimitingStats, resetRateLimiting } = useNotifications();

  // Update data periodically
  useEffect(() => {
    const updateData = () => {
      try {
        const performance = performanceMonitor.getCurrentMetrics();
        const notifications = notificationService.getConnectionState();
        const receipts = getReceiptSubscriptionStats();
        const receiptHealth = getReceiptSubscriptionHealth();
        const alerts = performanceMonitor.getActiveAlerts();
        const summary = performanceMonitor.getPerformanceSummary();
        const rateLimiting = getRateLimitingStats();

        setData({
          performance,
          notifications: { ...notifications, rateLimiting },
          receipts,
          receiptHealth,
          alerts,
          summary
        });
      } catch (error) {
        console.error('Error updating dashboard data:', error);
      }
    };

    updateData(); // Initial load

    if (autoRefresh) {
      const interval = setInterval(updateData, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, getRateLimitingStats]);

  const startMonitoring = () => {
    performanceMonitor.startMonitoring();
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
  };

  const exportData = () => {
    if (!data) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      performance: data.performance,
      notifications: data.notifications,
      receipts: data.receipts,
      receiptHealth: data.receiptHealth,
      alerts: data.alerts,
      summary: data.summary,
      metricsHistory: performanceMonitor.getMetricsHistory()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">Real-time monitoring of notification and subscription systems</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          {isMonitoring ? (
            <Button variant="destructive" onClick={stopMonitoring}>
              Stop Monitoring
            </Button>
          ) : (
            <Button onClick={startMonitoring}>
              Start Monitoring
            </Button>
          )}
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance Score</p>
                <p className="text-2xl font-bold">{data.summary.score}/100</p>
              </div>
              <Badge className={getStatusColor(data.summary.status)}>
                {data.summary.status}
              </Badge>
            </div>
            <Progress value={data.summary.score} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                <p className="text-2xl font-bold">{data.performance?.system.connectionCount || 0}</p>
              </div>
              <Network className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{data.alerts.length}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${data.alerts.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receipt Health</p>
                <p className="text-2xl font-bold">{data.receiptHealth.healthScore}%</p>
              </div>
              <Database className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Notification System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Active Subscriptions</span>
                  <span className="font-mono">{data.notifications.activeChannels}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registered Subscriptions</span>
                  <span className="font-mono">{data.notifications.registeredSubscriptions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Subscriptions</span>
                  <span className="font-mono">{data.notifications.pendingSubscriptions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reconnect Attempts</span>
                  <span className="font-mono">{data.notifications.reconnectAttempts}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Rate Limiting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Processed</span>
                  <span className="font-mono">{data.notifications.rateLimiting?.performance.processed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Blocked</span>
                  <span className="font-mono">{data.notifications.rateLimiting?.performance.blocked || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Block Rate</span>
                  <span className="font-mono">{data.notifications.rateLimiting?.performance.blockRate?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Circuit Breaker</span>
                  <Badge className={data.notifications.rateLimiting?.circuitBreaker.isOpen ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                    {data.notifications.rateLimiting?.circuitBreaker.isOpen ? 'Open' : 'Closed'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Receipt Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Legacy Subscriptions</span>
                  <span className="font-mono">{data.receipts.legacy.activeSubscriptions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unified Subscriptions</span>
                  <span className="font-mono">{data.receipts.unified.activeSubscriptions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Callbacks</span>
                  <span className="font-mono">{data.receipts.total.totalCallbacks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Efficiency Ratio</span>
                  <span className="font-mono">
                    {data.receipts.total.activeSubscriptions > 0 ? 
                      (data.receipts.total.totalCallbacks / data.receipts.total.activeSubscriptions).toFixed(2) : 
                      '0.00'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Health Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Health Score</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{data.receiptHealth.healthScore}%</span>
                    <Progress value={data.receiptHealth.healthScore} className="w-20" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Issues</span>
                  <span className="font-mono">{data.receiptHealth.issues.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recommendations</span>
                  <span className="font-mono">{data.receiptHealth.recommendations.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.receiptHealth.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues & Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.receiptHealth.issues.map((issue: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <span className="text-sm">{issue}</span>
                    </div>
                  ))}
                </div>
                {data.receiptHealth.recommendations.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium">Recommendations:</h4>
                    {data.receiptHealth.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Performance Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {data.alerts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    No active alerts
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.alerts.map((alert: any) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 border rounded">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">{alert.category}</Badge>
                          </div>
                          <p className="text-sm">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => performanceMonitor.resolveAlert(alert.id)}
                        >
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Connections</span>
                  <span className="font-mono">{data.performance?.system.connectionCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-mono">{data.performance?.system.errorRate?.toFixed(2) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span className="font-mono">
                    {data.performance?.system.uptime ? 
                      Math.floor(data.performance.system.uptime / 1000 / 60) + 'm' : 
                      '0m'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={resetRateLimiting}
                  className="w-full"
                >
                  Reset Rate Limiting Stats
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Refresh Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
