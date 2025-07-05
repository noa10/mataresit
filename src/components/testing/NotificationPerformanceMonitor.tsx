import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Zap,
  Database,
  Mail,
  Bell,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  threshold: {
    good: number;
    warning: number;
  };
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    database: 'healthy' | 'degraded' | 'critical';
    notifications: 'healthy' | 'degraded' | 'critical';
    email: 'healthy' | 'degraded' | 'critical';
    push: 'healthy' | 'degraded' | 'critical';
  };
}

export function NotificationPerformanceMonitor() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    components: {
      database: 'healthy',
      notifications: 'healthy',
      email: 'healthy',
      push: 'healthy'
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchPerformanceMetrics = async () => {
    setIsLoading(true);
    try {
      // Test database performance
      const dbStart = Date.now();
      const { data: notifications, error: dbError } = await supabase
        .from('notifications')
        .select('id, created_at')
        .limit(10);
      const dbDuration = Date.now() - dbStart;

      // Test notification creation performance
      const notifStart = Date.now();
      const { data: testNotif, error: notifError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: user?.id,
          type: 'system_test',
          title: 'Performance Test',
          message: 'This is a performance test notification',
          priority: 'low',
          metadata: { test: true, timestamp: Date.now() }
        })
        .select('id')
        .single();
      const notifDuration = Date.now() - notifStart;

      // Clean up test notification
      if (testNotif) {
        await supabase.from('notifications').delete().eq('id', testNotif.id);
      }

      // Test email service performance
      const emailStart = Date.now();
      const { data: emailTest, error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'test@example.com',
          subject: 'Performance Test',
          text: 'This is a performance test email',
          template_name: 'performance_test',
          metadata: { test: true, dry_run: true }
        }
      });
      const emailDuration = Date.now() - emailStart;

      // Test push notification service performance
      const pushStart = Date.now();
      const { data: pushTest, error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user?.id,
          notificationType: 'system_test',
          payload: {
            title: 'Performance Test',
            body: 'This is a performance test push notification'
          },
          dryRun: true
        }
      });
      const pushDuration = Date.now() - pushStart;

      // Calculate notification queue size
      const { count: queueSize } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      // Calculate recent notification volume
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentNotifications } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      // Calculate email delivery success rate
      const { data: emailDeliveries } = await supabase
        .from('email_deliveries')
        .select('status')
        .gte('created_at', oneHourAgo);

      const emailSuccessRate = emailDeliveries?.length 
        ? (emailDeliveries.filter(d => d.status === 'sent').length / emailDeliveries.length) * 100
        : 100;

      const newMetrics: PerformanceMetric[] = [
        {
          name: 'Database Query Time',
          value: dbDuration,
          unit: 'ms',
          status: dbDuration < 100 ? 'good' : dbDuration < 500 ? 'warning' : 'critical',
          threshold: { good: 100, warning: 500 }
        },
        {
          name: 'Notification Creation Time',
          value: notifDuration,
          unit: 'ms',
          status: notifDuration < 200 ? 'good' : notifDuration < 1000 ? 'warning' : 'critical',
          threshold: { good: 200, warning: 1000 }
        },
        {
          name: 'Email Service Response Time',
          value: emailDuration,
          unit: 'ms',
          status: emailDuration < 1000 ? 'good' : emailDuration < 3000 ? 'warning' : 'critical',
          threshold: { good: 1000, warning: 3000 }
        },
        {
          name: 'Push Service Response Time',
          value: pushDuration,
          unit: 'ms',
          status: pushDuration < 500 ? 'good' : pushDuration < 2000 ? 'warning' : 'critical',
          threshold: { good: 500, warning: 2000 }
        },
        {
          name: 'Unread Notification Queue',
          value: queueSize || 0,
          unit: 'items',
          status: (queueSize || 0) < 100 ? 'good' : (queueSize || 0) < 500 ? 'warning' : 'critical',
          threshold: { good: 100, warning: 500 }
        },
        {
          name: 'Notifications per Hour',
          value: recentNotifications || 0,
          unit: 'notifications',
          status: (recentNotifications || 0) < 1000 ? 'good' : (recentNotifications || 0) < 5000 ? 'warning' : 'critical',
          threshold: { good: 1000, warning: 5000 }
        },
        {
          name: 'Email Delivery Success Rate',
          value: emailSuccessRate,
          unit: '%',
          status: emailSuccessRate > 95 ? 'good' : emailSuccessRate > 85 ? 'warning' : 'critical',
          threshold: { good: 95, warning: 85 }
        }
      ];

      setMetrics(newMetrics);

      // Calculate system health
      const newSystemHealth: SystemHealth = {
        overall: 'healthy',
        components: {
          database: dbError || dbDuration > 500 ? 'critical' : dbDuration > 100 ? 'degraded' : 'healthy',
          notifications: notifError || notifDuration > 1000 ? 'critical' : notifDuration > 200 ? 'degraded' : 'healthy',
          email: emailError || emailDuration > 3000 ? 'critical' : emailDuration > 1000 ? 'degraded' : 'healthy',
          push: pushError || pushDuration > 2000 ? 'critical' : pushDuration > 500 ? 'degraded' : 'healthy'
        }
      };

      // Determine overall health
      const componentStatuses = Object.values(newSystemHealth.components);
      if (componentStatuses.includes('critical')) {
        newSystemHealth.overall = 'critical';
      } else if (componentStatuses.includes('degraded')) {
        newSystemHealth.overall = 'degraded';
      }

      setSystemHealth(newSystemHealth);
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPerformanceMetrics();
      
      // Set up periodic refresh
      const interval = setInterval(fetchPerformanceMetrics, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'push':
        return <Bell className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (!user) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-orange-900">Authentication Required</CardTitle>
              <CardDescription className="text-orange-700">
                Please log in to view performance metrics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Notification System Performance</CardTitle>
                <CardDescription>
                  Real-time monitoring of notification system health and performance
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <Button
                onClick={fetchPerformanceMetrics}
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Overall Health */}
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(systemHealth.overall)}`}>
                {getStatusIcon(systemHealth.overall)}
                <span className="font-medium capitalize">{systemHealth.overall}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">Overall</div>
            </div>

            {/* Component Health */}
            {Object.entries(systemHealth.components).map(([component, status]) => (
              <div key={component} className="text-center">
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(status)}`}>
                  {getComponentIcon(component)}
                  <span className="font-medium capitalize">{status}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1 capitalize">{component}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((metric) => (
              <div key={metric.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.name}</span>
                  <Badge className={getStatusColor(metric.status)}>
                    {getStatusIcon(metric.status)}
                    <span className="ml-1 capitalize">{metric.status}</span>
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {metric.value.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">{metric.unit}</span>
                  </div>
                  
                  {/* Progress bar for metrics with thresholds */}
                  {metric.threshold && (
                    <div className="space-y-1">
                      <Progress 
                        value={Math.min((metric.value / metric.threshold.warning) * 100, 100)}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0</span>
                        <span className="text-yellow-600">{metric.threshold.warning}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.filter(m => m.status !== 'good').map((metric) => (
              <div key={metric.name} className="flex items-start gap-3 p-3 border rounded-lg">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                  metric.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <div>
                  <div className="font-medium">{metric.name}</div>
                  <div className="text-sm text-gray-600">
                    {metric.status === 'critical' 
                      ? `Critical: ${metric.value}${metric.unit} exceeds acceptable limits. Immediate attention required.`
                      : `Warning: ${metric.value}${metric.unit} is above optimal range. Consider optimization.`
                    }
                  </div>
                </div>
              </div>
            ))}
            
            {metrics.every(m => m.status === 'good') && (
              <div className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-900">All Systems Optimal</div>
                  <div className="text-sm text-green-700">
                    All performance metrics are within acceptable ranges.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
