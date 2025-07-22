// Production Monitoring Dashboard Component
// Real-time monitoring dashboard for production metrics and system health

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  DollarSign,
  Gauge,
  Server,
  TrendingUp,
  Users,
  Zap,
  RefreshCw
} from 'lucide-react';

interface MetricData {
  value: number;
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface SystemHealth {
  overall: MetricData;
  embedding: MetricData;
  workers: MetricData;
  database: MetricData;
  api: MetricData;
}

interface EmbeddingMetrics {
  successRate: MetricData;
  processingRate: MetricData;
  queueDepth: MetricData;
  avgProcessingTime: MetricData;
  errorRate: MetricData;
}

interface WorkerMetrics {
  activeWorkers: MetricData;
  cpuUsage: MetricData;
  memoryUsage: MetricData;
  jobsPerMinute: MetricData;
  healthScore: MetricData;
}

interface ApiMetrics {
  quotaUsage: { [provider: string]: MetricData };
  requestRate: MetricData;
  responseTime: MetricData;
  errorRate: MetricData;
  costPerHour: MetricData;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

export const ProductionMonitoringDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [embeddingMetrics, setEmbeddingMetrics] = useState<EmbeddingMetrics | null>(null);
  const [workerMetrics, setWorkerMetrics] = useState<WorkerMetrics | null>(null);
  const [apiMetrics, setApiMetrics] = useState<ApiMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch metrics from Prometheus/API
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch system health
      const healthResponse = await fetch('/api/monitoring/health');
      const healthData = await healthResponse.json();
      setSystemHealth(healthData);

      // Fetch embedding metrics
      const embeddingResponse = await fetch('/api/monitoring/embedding');
      const embeddingData = await embeddingResponse.json();
      setEmbeddingMetrics(embeddingData);

      // Fetch worker metrics
      const workerResponse = await fetch('/api/monitoring/workers');
      const workerData = await workerResponse.json();
      setWorkerMetrics(workerData);

      // Fetch API metrics
      const apiResponse = await fetch('/api/monitoring/api');
      const apiData = await apiResponse.json();
      setApiMetrics(apiData);

      // Fetch alerts
      const alertsResponse = await fetch('/api/monitoring/alerts');
      const alertsData = await alertsResponse.json();
      setAlerts(alertsData);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefresh]);

  // Get status color based on metric status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  // Format metric value
  const formatMetricValue = (value: number, type: string) => {
    switch (type) {
      case 'percentage': return `${value.toFixed(1)}%`;
      case 'rate': return `${value.toFixed(1)}/min`;
      case 'time': return `${value.toFixed(2)}s`;
      case 'currency': return `$${value.toFixed(2)}`;
      case 'count': return Math.round(value).toString();
      default: return value.toFixed(2);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged).length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged).length} critical alerts require attention
          </AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Gauge className="h-5 w-5" />
                <span className="font-medium">Overall</span>
                {getStatusIcon(systemHealth.overall.status)}
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatMetricValue(systemHealth.overall.value, 'percentage')}
                </div>
                <Progress value={systemHealth.overall.value} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span className="font-medium">Embedding</span>
                {getStatusIcon(systemHealth.embedding.status)}
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatMetricValue(systemHealth.embedding.value, 'percentage')}
                </div>
                <Progress value={systemHealth.embedding.value} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span className="font-medium">Workers</span>
                {getStatusIcon(systemHealth.workers.status)}
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatMetricValue(systemHealth.workers.value, 'count')}
                </div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span className="font-medium">Database</span>
                {getStatusIcon(systemHealth.database.status)}
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatMetricValue(systemHealth.database.value, 'time')}
                </div>
                <div className="text-sm text-gray-500">Avg Query Time</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span className="font-medium">API</span>
                {getStatusIcon(systemHealth.api.status)}
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatMetricValue(systemHealth.api.value, 'percentage')}
                </div>
                <div className="text-sm text-gray-500">Success Rate</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="embedding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="embedding">Embedding</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="api">API & Costs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Embedding Metrics */}
        <TabsContent value="embedding" className="space-y-4">
          {embeddingMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Success Rate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(embeddingMetrics.successRate.value, 'percentage')}
                  </div>
                  <Progress value={embeddingMetrics.successRate.value} className="mt-2" />
                  <div className={`text-sm mt-2 ${getStatusColor(embeddingMetrics.successRate.status)}`}>
                    {embeddingMetrics.successRate.status.toUpperCase()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Processing Rate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(embeddingMetrics.processingRate.value, 'rate')}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Jobs per minute</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Queue Depth</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(embeddingMetrics.queueDepth.value, 'count')}
                  </div>
                  <div className={`text-sm mt-2 ${getStatusColor(embeddingMetrics.queueDepth.status)}`}>
                    {embeddingMetrics.queueDepth.status.toUpperCase()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Avg Processing Time</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(embeddingMetrics.avgProcessingTime.value, 'time')}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Per job</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Error Rate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(embeddingMetrics.errorRate.value, 'percentage')}
                  </div>
                  <div className={`text-sm mt-2 ${getStatusColor(embeddingMetrics.errorRate.status)}`}>
                    {embeddingMetrics.errorRate.status.toUpperCase()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Worker Metrics */}
        <TabsContent value="workers" className="space-y-4">
          {workerMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Workers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(workerMetrics.activeWorkers.value, 'count')}
                  </div>
                  <div className={`text-sm mt-2 ${getStatusColor(workerMetrics.activeWorkers.status)}`}>
                    {workerMetrics.activeWorkers.status.toUpperCase()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CPU Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(workerMetrics.cpuUsage.value, 'percentage')}
                  </div>
                  <Progress value={workerMetrics.cpuUsage.value} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(workerMetrics.memoryUsage.value, 'percentage')}
                  </div>
                  <Progress value={workerMetrics.memoryUsage.value} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Jobs per Minute</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(workerMetrics.jobsPerMinute.value, 'rate')}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Health Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(workerMetrics.healthScore.value, 'percentage')}
                  </div>
                  <Progress value={workerMetrics.healthScore.value} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* API & Cost Metrics */}
        <TabsContent value="api" className="space-y-4">
          {apiMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Cost per Hour</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(apiMetrics.costPerHour.value, 'currency')}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Current rate</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Request Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(apiMetrics.requestRate.value, 'rate')}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">Requests per minute</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMetricValue(apiMetrics.responseTime.value, 'time')}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">95th percentile</div>
                </CardContent>
              </Card>

              {/* API Quota Usage */}
              {Object.entries(apiMetrics.quotaUsage).map(([provider, metric]) => (
                <Card key={provider}>
                  <CardHeader>
                    <CardTitle>{provider} Quota</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatMetricValue(metric.value, 'percentage')}
                    </div>
                    <Progress value={metric.value} className="mt-2" />
                    <div className={`text-sm mt-2 ${getStatusColor(metric.status)}`}>
                      {metric.status.toUpperCase()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Active Alerts</h3>
                  <p className="text-gray-600">All systems are operating normally</p>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.severity === 'critical' ? 'border-l-red-500' :
                  alert.severity === 'warning' ? 'border-l-yellow-500' :
                  'border-l-blue-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(alert.severity)}
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-gray-600">{alert.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' :
                          alert.severity === 'warning' ? 'secondary' :
                          'default'
                        }>
                          {alert.severity}
                        </Badge>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
