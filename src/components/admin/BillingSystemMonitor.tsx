import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail,
  CreditCard,
  Users,
  Server,
  RefreshCw,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface BillingHealthMetrics {
  overall_health: 'healthy' | 'warning' | 'critical';
  payment_processing: {
    success_rate: number;
    failed_payments_24h: number;
    retry_queue_depth: number;
    average_processing_time: number;
  };
  email_delivery: {
    delivery_rate: number;
    failed_deliveries_24h: number;
    scheduled_emails_pending: number;
    average_delivery_time: number;
  };
  subscription_health: {
    active_subscriptions: number;
    grace_period_subscriptions: number;
    failed_renewals_24h: number;
    churn_rate_7d: number;
  };
  system_performance: {
    webhook_processing_rate: number;
    database_query_time: number;
    function_error_rate: number;
    api_response_time: number;
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>;
}

export function BillingSystemMonitor() {
  const [metrics, setMetrics] = useState<BillingHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeframe, setTimeframe] = useState('24h');

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, timeframe]);

  const loadMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('billing-monitor', {
        body: {
          action: 'get_health_metrics',
          timeframe,
          include_details: true
        }
      });

      if (error) {
        throw error;
      }

      setMetrics(data.metrics);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading billing metrics:', error);
      toast.error('Failed to load billing system metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerHealthCheck = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('billing-monitor', {
        body: {
          action: 'trigger_health_check'
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Health check completed');
      await loadMetrics();
    } catch (error) {
      console.error('Error triggering health check:', error);
      toast.error('Failed to trigger health check');
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase.functions.invoke('billing-monitor', {
        body: {
          action: 'acknowledge_alert',
          alert_id: alertId,
          acknowledged_by: 'admin' // TODO: Get actual user ID
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Alert acknowledged');
      await loadMetrics();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (value: number, threshold: number, reverse = false) => {
    const isGood = reverse ? value < threshold : value > threshold;
    if (isGood) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value === threshold) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  if (isLoading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing System Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and alerting for billing system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Auto Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerHealthCheck}
            disabled={isLoading}
          >
            <Activity className="h-4 w-4" />
            Health Check
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      {metrics && (
        <Alert className={cn("border-l-4", getHealthColor(metrics.overall_health))}>
          <div className="flex items-center gap-2">
            {getHealthIcon(metrics.overall_health)}
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  System Status: {metrics.overall_health.charAt(0).toUpperCase() + metrics.overall_health.slice(1)}
                </span>
                {lastUpdated && (
                  <span className="text-sm text-muted-foreground">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Payment Processing */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Processing</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metrics.payment_processing.success_rate}%</span>
                  {getTrendIcon(metrics.payment_processing.success_rate, 95)}
                </div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <Progress value={metrics.payment_processing.success_rate} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {metrics.payment_processing.failed_payments_24h} failures (24h)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Delivery */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Delivery</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metrics.email_delivery.delivery_rate}%</span>
                  {getTrendIcon(metrics.email_delivery.delivery_rate, 95)}
                </div>
                <p className="text-xs text-muted-foreground">Delivery Rate</p>
                <Progress value={metrics.email_delivery.delivery_rate} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {metrics.email_delivery.scheduled_emails_pending} pending
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Health */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metrics.subscription_health.active_subscriptions}</span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground">Active Subscriptions</p>
                <div className="text-xs text-muted-foreground">
                  {metrics.subscription_health.grace_period_subscriptions} in grace period
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.subscription_health.churn_rate_7d}% churn rate (7d)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Performance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Performance</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{Math.round(metrics.system_performance.api_response_time)}ms</span>
                  {getTrendIcon(metrics.system_performance.api_response_time, 1000, true)}
                </div>
                <p className="text-xs text-muted-foreground">API Response Time</p>
                <div className="text-xs text-muted-foreground">
                  {metrics.system_performance.function_error_rate}% error rate
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(metrics.system_performance.database_query_time)}ms DB queries
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Section */}
      {metrics && metrics.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Active Alerts ({metrics.alerts.length})
            </CardTitle>
            <CardDescription>
              Current system alerts requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.alerts.map((alert) => (
                <div key={alert.id} className={cn("flex items-center justify-between p-3 rounded border", getSeverityColor(alert.severity))}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{alert.type.replace(/_/g, ' ').toUpperCase()}</span>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Metrics Tabs */}
      {metrics && (
        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Processing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Success Rate</p>
                    <p className="text-2xl font-bold">{metrics.payment_processing.success_rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Failed Payments (24h)</p>
                    <p className="text-2xl font-bold">{metrics.payment_processing.failed_payments_24h}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Retry Queue Depth</p>
                    <p className="text-2xl font-bold">{metrics.payment_processing.retry_queue_depth}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Avg Processing Time</p>
                    <p className="text-2xl font-bold">{Math.round(metrics.payment_processing.average_processing_time)}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Delivery Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Delivery Rate</p>
                    <p className="text-2xl font-bold">{metrics.email_delivery.delivery_rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Failed Deliveries (24h)</p>
                    <p className="text-2xl font-bold">{metrics.email_delivery.failed_deliveries_24h}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Scheduled Emails Pending</p>
                    <p className="text-2xl font-bold">{metrics.email_delivery.scheduled_emails_pending}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Avg Delivery Time</p>
                    <p className="text-2xl font-bold">{Math.round(metrics.email_delivery.average_delivery_time)}m</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Health Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Active Subscriptions</p>
                    <p className="text-2xl font-bold">{metrics.subscription_health.active_subscriptions}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Grace Period Subscriptions</p>
                    <p className="text-2xl font-bold">{metrics.subscription_health.grace_period_subscriptions}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Failed Renewals (24h)</p>
                    <p className="text-2xl font-bold">{metrics.subscription_health.failed_renewals_24h}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Churn Rate (7d)</p>
                    <p className="text-2xl font-bold">{metrics.subscription_health.churn_rate_7d}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Performance Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Webhook Processing Rate</p>
                    <p className="text-2xl font-bold">{metrics.system_performance.webhook_processing_rate}/min</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Database Query Time</p>
                    <p className="text-2xl font-bold">{Math.round(metrics.system_performance.database_query_time)}ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Function Error Rate</p>
                    <p className="text-2xl font-bold">{metrics.system_performance.function_error_rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">API Response Time</p>
                    <p className="text-2xl font-bold">{Math.round(metrics.system_performance.api_response_time)}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
