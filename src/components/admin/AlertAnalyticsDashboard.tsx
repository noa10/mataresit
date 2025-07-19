/**
 * Alert Analytics Dashboard
 * Comprehensive analytics and reporting for alert system performance
 * Task 5: Develop Configurable Alert Rules Interface - Analytics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Bell,
  Target,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertEngine } from '@/hooks/useAlertEngine';
import { useAlertEscalation } from '@/hooks/useAlertEscalation';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { AlertSeverity } from '@/types/alerting';

interface AlertAnalyticsDashboardProps {
  teamId?: string;
  className?: string;
}

interface AnalyticsData {
  alertTrends: Array<{
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  }>;
  severityDistribution: Array<{
    severity: AlertSeverity;
    count: number;
    percentage: number;
  }>;
  responseTimeMetrics: Array<{
    severity: AlertSeverity;
    avgResponseTime: number;
    avgResolutionTime: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    deliveryRate: number;
    avgDeliveryTime: number;
    failureRate: number;
  }>;
  escalationMetrics: Array<{
    level: number;
    count: number;
    avgTime: number;
  }>;
  topAlertSources: Array<{
    source: string;
    count: number;
    severity: AlertSeverity;
  }>;
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6'
};

export function AlertAnalyticsDashboard({ teamId, className }: AlertAnalyticsDashboardProps) {
  // Hooks
  const { alertStatistics, isEngineHealthy } = useAlertEngine({ teamId, autoRefresh: true });
  const { escalationStatistics, getRoutingStatistics } = useAlertEscalation({ teamId });
  const { channels } = useNotificationChannels({ teamId });

  // State
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('volume');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Load analytics data
  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      // Generate mock analytics data
      // In a real implementation, this would fetch from analytics APIs
      const mockData: AnalyticsData = {
        alertTrends: generateMockTrendData(timeRange),
        severityDistribution: [
          { severity: 'critical', count: 12, percentage: 8 },
          { severity: 'high', count: 28, percentage: 19 },
          { severity: 'medium', count: 45, percentage: 30 },
          { severity: 'low', count: 38, percentage: 25 },
          { severity: 'info', count: 27, percentage: 18 }
        ],
        responseTimeMetrics: [
          { severity: 'critical', avgResponseTime: 3.2, avgResolutionTime: 15.5 },
          { severity: 'high', avgResponseTime: 8.7, avgResolutionTime: 32.1 },
          { severity: 'medium', avgResponseTime: 25.3, avgResolutionTime: 78.4 },
          { severity: 'low', avgResponseTime: 45.8, avgResolutionTime: 156.2 },
          { severity: 'info', avgResponseTime: 120.5, avgResolutionTime: 480.0 }
        ],
        channelPerformance: [
          { channel: 'Email', deliveryRate: 98.5, avgDeliveryTime: 2.3, failureRate: 1.5 },
          { channel: 'Slack', deliveryRate: 99.2, avgDeliveryTime: 0.8, failureRate: 0.8 },
          { channel: 'SMS', deliveryRate: 97.1, avgDeliveryTime: 1.2, failureRate: 2.9 },
          { channel: 'Webhook', deliveryRate: 95.8, avgDeliveryTime: 0.5, failureRate: 4.2 },
          { channel: 'Push', deliveryRate: 99.8, avgDeliveryTime: 0.3, failureRate: 0.2 }
        ],
        escalationMetrics: [
          { level: 1, count: 45, avgTime: 15.2 },
          { level: 2, count: 23, avgTime: 32.8 },
          { level: 3, count: 12, avgTime: 58.5 },
          { level: 4, count: 5, avgTime: 95.3 },
          { level: 5, count: 2, avgTime: 145.7 }
        ],
        topAlertSources: [
          { source: 'embedding_metrics', count: 45, severity: 'medium' },
          { source: 'performance_metrics', count: 38, severity: 'high' },
          { source: 'system_health', count: 32, severity: 'critical' },
          { source: 'notification_metrics', count: 28, severity: 'low' }
        ]
      };

      setAnalyticsData(mockData);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock trend data
  const generateMockTrendData = (range: string) => {
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const critical = Math.floor(Math.random() * 5);
      const high = Math.floor(Math.random() * 10);
      const medium = Math.floor(Math.random() * 15);
      const low = Math.floor(Math.random() * 12);
      const info = Math.floor(Math.random() * 8);
      
      data.push({
        date: date.toISOString().split('T')[0],
        critical,
        high,
        medium,
        low,
        info,
        total: critical + high + medium + low + info
      });
    }
    
    return data;
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, teamId]);

  // Calculate key metrics
  const keyMetrics = React.useMemo(() => {
    if (!analyticsData || !alertStatistics) return null;

    const totalAlerts = analyticsData.severityDistribution.reduce((sum, item) => sum + item.count, 0);
    const criticalAlerts = analyticsData.severityDistribution.find(item => item.severity === 'critical')?.count || 0;
    const avgResponseTime = analyticsData.responseTimeMetrics.reduce((sum, item) => sum + item.avgResponseTime, 0) / analyticsData.responseTimeMetrics.length;
    const avgDeliveryRate = analyticsData.channelPerformance.reduce((sum, item) => sum + item.deliveryRate, 0) / analyticsData.channelPerformance.length;

    return {
      totalAlerts,
      criticalAlerts,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      avgDeliveryRate: Math.round(avgDeliveryRate * 10) / 10,
      escalationRate: escalationStatistics ? (escalationStatistics.activeEscalations / totalAlerts * 100) : 0
    };
  }, [analyticsData, alertStatistics, escalationStatistics]);

  if (!analyticsData || !keyMetrics) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading Analytics</h3>
            <p className="text-muted-foreground">Gathering alert system performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and trends for your alert system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalyticsData}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      <Alert className={cn(
        isEngineHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      )}>
        <div className="flex items-center gap-2">
          {isEngineHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={cn(
            isEngineHealthy ? 'text-green-800' : 'text-red-800'
          )}>
            Alert system is {isEngineHealthy ? 'healthy and operational' : 'experiencing issues'}
            {lastRefresh && (
              <span className="ml-2 text-xs">
                (Last updated: {lastRefresh.toLocaleTimeString()})
              </span>
            )}
          </AlertDescription>
        </div>
      </Alert>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{keyMetrics.totalAlerts}</p>
                <p className="text-xs text-muted-foreground">Last {timeRange}</p>
              </div>
              <Bell className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-600">{keyMetrics.criticalAlerts}</p>
                <p className="text-xs text-muted-foreground">Needs attention</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{keyMetrics.avgResponseTime}m</p>
                <p className="text-xs text-muted-foreground">Time to acknowledge</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold">{keyMetrics.avgDeliveryRate}%</p>
                <p className="text-xs text-muted-foreground">Notification success</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Escalation Rate</p>
                <p className="text-2xl font-bold">{Math.round(keyMetrics.escalationRate)}%</p>
                <p className="text-xs text-muted-foreground">Alerts escalated</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Alert Trends</TabsTrigger>
          <TabsTrigger value="severity">Severity Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="channels">Channel Analytics</TabsTrigger>
          <TabsTrigger value="escalation">Escalation Metrics</TabsTrigger>
        </TabsList>

        {/* Alert Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Volume Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analyticsData.alertTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stackId="1"
                    stroke={SEVERITY_COLORS.critical}
                    fill={SEVERITY_COLORS.critical}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    stackId="1"
                    stroke={SEVERITY_COLORS.high}
                    fill={SEVERITY_COLORS.high}
                  />
                  <Area
                    type="monotone"
                    dataKey="medium"
                    stackId="1"
                    stroke={SEVERITY_COLORS.medium}
                    fill={SEVERITY_COLORS.medium}
                  />
                  <Area
                    type="monotone"
                    dataKey="low"
                    stackId="1"
                    stroke={SEVERITY_COLORS.low}
                    fill={SEVERITY_COLORS.low}
                  />
                  <Area
                    type="monotone"
                    dataKey="info"
                    stackId="1"
                    stroke={SEVERITY_COLORS.info}
                    fill={SEVERITY_COLORS.info}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Severity Analysis Tab */}
        <TabsContent value="severity" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ severity, percentage }) => `${severity}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analyticsData.severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.severity]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response & Resolution Times</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.responseTimeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgResponseTime" fill="#8884d8" name="Avg Response Time (min)" />
                    <Bar dataKey="avgResolutionTime" fill="#82ca9d" name="Avg Resolution Time (min)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Alert Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.topAlertSources.map((source, index) => (
                  <div key={source.source} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold text-muted-foreground">#{index + 1}</div>
                      <div>
                        <p className="font-medium">{source.source}</p>
                        <p className="text-sm text-muted-foreground">{source.count} alerts</p>
                      </div>
                    </div>
                    <Badge variant={getSeverityVariant(source.severity)}>
                      {source.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Analytics Tab */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analyticsData.channelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="deliveryRate" fill="#22c55e" name="Delivery Rate (%)" />
                  <Bar dataKey="avgDeliveryTime" fill="#3b82f6" name="Avg Delivery Time (s)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escalation Metrics Tab */}
        <TabsContent value="escalation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Escalation Level Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analyticsData.escalationMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#f97316" name="Escalation Count" />
                  <Bar dataKey="avgTime" fill="#8b5cf6" name="Avg Time to Escalate (min)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function for severity badge variants
function getSeverityVariant(severity: AlertSeverity) {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    case 'info': return 'outline';
    default: return 'secondary';
  }
}
