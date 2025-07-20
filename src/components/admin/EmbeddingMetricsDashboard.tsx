/**
 * Embedding Metrics Dashboard
 * Comprehensive monitoring dashboard for embedding performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DollarSign,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  PieChart,
  Clock,
  Target
} from 'lucide-react';
import { useEmbeddingMetrics } from '@/hooks/useEmbeddingMetrics';
import { EmbeddingHealthIndicator } from './EmbeddingHealthIndicator';
import { EmbeddingPerformanceCharts } from './EmbeddingPerformanceCharts';
import { EmbeddingCostAnalysis } from './EmbeddingCostAnalysis';
import { EmbeddingQualityMetrics } from './EmbeddingQualityMetrics';
import { EmbeddingAggregationControls } from './EmbeddingAggregationControls';
import { EmbeddingRealTimeStatus } from './EmbeddingRealTimeStatus';
import { EmbeddingConnectionMonitor } from './EmbeddingConnectionMonitor';
import { HealthStatusDashboard } from './HealthStatusDashboard';
import { SystemAlertsPanel } from './SystemAlertsPanel';
import { HealthStatusIndicator } from './HealthStatusIndicator';
import { EmbeddingQueueManagement } from './EmbeddingQueueManagement';
import { EmbeddingQueueMetrics } from './EmbeddingQueueMetrics';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { toast } from 'sonner';
import { getAutoRefreshClasses } from '@/lib/darkModeUtils';

export function EmbeddingMetricsDashboard() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Embedding Metrics Dashboard Error:', error, errorInfo);
        toast.error('Dashboard encountered an error. Please refresh the page.');
      }}
    >
      <EmbeddingMetricsDashboardContent />
    </ErrorBoundary>
  );
}

function EmbeddingMetricsDashboardContent() {
  const {
    healthStatus,
    summary,
    hourlyStats,
    dailyStats,
    costBreakdown,
    qualityMetrics,
    isLoading,
    isRefreshing,
    error,
    refreshData,
    triggerAggregation,
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    isRealTimeConnected,
    realTimeStatus,
    lastUpdateTime,
    enableRealTime,
    setEnableRealTime
  } = useEmbeddingMetrics();

  const [activeTab, setActiveTab] = useState('overview');

  // Show loading state while initial data is being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading embedding metrics...</p>
        </div>
      </div>
    );
  }

  // Show error state only if there's a critical error AND no data at all
  if (error && !summary && !healthStatus && !hourlyStats.length && !dailyStats.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="border-red-200 bg-red-50 max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto" />
            <div>
              <h3 className="font-semibold text-red-800">Failed to Load Dashboard</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <Button onClick={refreshData} variant="outline" className="border-red-300 text-red-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExportData = () => {
    if (!summary || !healthStatus) {
      toast.error('No data available to export');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      healthStatus,
      summary,
      hourlyStats,
      dailyStats,
      costBreakdown,
      qualityMetrics
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embedding-metrics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Metrics data exported successfully');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Remove duplicate loading check - already handled above

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Embedding Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of embedding generation performance and quality
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HealthStatusIndicator />
          <EmbeddingRealTimeStatus
            isConnected={isRealTimeConnected}
            status={realTimeStatus}
            lastUpdateTime={lastUpdateTime}
            enableRealTime={enableRealTime}
            onToggleRealTime={setEnableRealTime}
          />
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={getAutoRefreshClasses(autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button
            onClick={refreshData}
            disabled={isRefreshing}
            className="relative"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Partial Error Alert */}
      {error && (summary || healthStatus || hourlyStats.length > 0) && (
        <Alert variant="default" className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-yellow-800 dark:text-yellow-200">Partial Data Load Issue</strong>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">{error}</p>
              </div>
              <Button onClick={refreshData} variant="outline" size="sm" className="border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Health Status Alert */}
      {healthStatus && healthStatus.status !== 'healthy' && (
        <Alert variant={healthStatus.status === 'error' ? 'destructive' : 'default'}>
          {getStatusIcon(healthStatus.status)}
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>System Status: {healthStatus.status.toUpperCase()}</strong>
                {healthStatus.issues.length > 0 && (
                  <ul className="mt-1 text-sm">
                    {healthStatus.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                )}
              </div>
              <EmbeddingAggregationControls onTrigger={triggerAggregation} />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">{summary?.healthScore || 0}/100</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(healthStatus?.status || 'unknown')}>
                  {healthStatus?.status || 'unknown'}
                </Badge>
                <EmbeddingHealthIndicator status={healthStatus?.status || 'unknown'} />
              </div>
            </div>
            <Progress value={summary?.healthScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{summary?.successRate.toFixed(1) || 0}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <span>{summary?.totalEmbeddings || 0} total embeddings</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{summary?.avgDuration || 0}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>{summary?.performanceTrend || 'stable'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${summary?.totalCost.toFixed(4) || 0}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <span>Last 7 days</span>
            </div>
          </CardContent>
        </Card>

        {/* Queue Status Card */}
        <EmbeddingQueueMetrics showDetailed={false} />
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Queue Metrics Overview */}
          <EmbeddingQueueMetrics showDetailed={true} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Last 24 hours</span>
                    <span className="font-mono">{healthStatus?.metrics.raw_metrics_24h || 0} embeddings</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Hourly stats (7d)</span>
                    <span className="font-mono">{healthStatus?.metrics.hourly_stats_7d || 0} records</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Daily stats (30d)</span>
                    <span className="font-mono">{healthStatus?.metrics.daily_stats_30d || 0} records</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Errors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Top Error Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary?.topErrors.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                      No errors detected
                    </div>
                  ) : (
                    summary?.topErrors.map((error, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{error.type.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{error.count}</span>
                          <Badge variant="outline">{error.percentage.toFixed(1)}%</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <EmbeddingPerformanceCharts
            hourlyStats={hourlyStats}
            dailyStats={dailyStats}
            summary={summary}
            isLoading={isRefreshing}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <EmbeddingQualityMetrics 
            qualityMetrics={qualityMetrics}
            isLoading={isRefreshing}
          />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <EmbeddingCostAnalysis
            costBreakdown={costBreakdown}
            isLoading={isRefreshing}
          />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <EmbeddingQueueManagement />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {/* Health Status Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <HealthStatusDashboard />
            </div>
            <div>
              <SystemAlertsPanel />
            </div>
          </div>

          {/* Connection Monitor */}
          <EmbeddingConnectionMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
