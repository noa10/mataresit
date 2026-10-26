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
  DollarSign, 
  RefreshCw, 
  Download, 
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
import { useAdminTranslation } from '@/contexts/LanguageContext';

export function EmbeddingMetricsDashboard() {
  const { t } = useAdminTranslation();
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Embedding Metrics Dashboard Error:', error, errorInfo);
        toast.error(t('embeddingMetrics.dashboard.errorToast'));
      }}
    >
      <EmbeddingMetricsDashboardContent />
    </ErrorBoundary>
  );
}

function EmbeddingMetricsDashboardContent() {
  const { t } = useAdminTranslation();
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
          <p className="text-muted-foreground">{t('embeddingMetrics.dashboard.loading')}</p>
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
              <h3 className="font-semibold text-red-800">{t('embeddingMetrics.dashboard.failedToLoad')}</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <Button onClick={refreshData} variant="outline" className="border-red-300 text-red-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('embeddingMetrics.common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExportData = () => {
    if (!summary || !healthStatus) {
      toast.error(t('embeddingMetrics.dashboard.noDataToExport'));
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
    
    toast.success(t('embeddingMetrics.dashboard.exportedSuccess'));
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
          <h1 className="text-3xl font-bold">{t('embeddingMetrics.dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('embeddingMetrics.dashboard.subtitle')}
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
            {t('embeddingMetrics.dashboard.autoRefresh')}
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            {t('embeddingMetrics.dashboard.exportData')}
          </Button>
          <Button
            onClick={refreshData}
            disabled={isRefreshing}
            className="relative"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('embeddingMetrics.common.refresh')}
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
                <strong className="text-yellow-800 dark:text-yellow-200">{t('embeddingMetrics.dashboard.partialDataIssue')}</strong>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">{error}</p>
              </div>
              <Button onClick={refreshData} variant="outline" size="sm" className="border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('embeddingMetrics.common.retry')}
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
                <strong>
                  {t('embeddingMetrics.dashboard.systemStatus', {
                    status: t(`embeddingMetrics.common.${healthStatus.status}`, {
                      defaultValue: healthStatus.status,
                    }).toUpperCase(),
                  })}
                </strong>
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.dashboard.healthScore')}</p>
                <p className="text-2xl font-bold">{summary?.healthScore || 0}/100</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(healthStatus?.status || 'unknown')}>
                  {t(`embeddingMetrics.common.${healthStatus?.status || 'unknown'}`, {
                    defaultValue: healthStatus?.status || 'unknown',
                  })}
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.dashboard.successRate')}</p>
                <p className="text-2xl font-bold">{summary?.successRate.toFixed(1) || 0}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <span>
                {t('embeddingMetrics.dashboard.totalEmbeddings', {
                  count: summary?.totalEmbeddings || 0,
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.dashboard.avgDuration')}</p>
                <p className="text-2xl font-bold">{summary?.avgDuration || 0}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>
                {t(`embeddingMetrics.common.${summary?.performanceTrend || 'stable'}`, {
                  defaultValue: summary?.performanceTrend || 'stable',
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.dashboard.totalCost')}</p>
                <p className="text-2xl font-bold">${summary?.totalCost.toFixed(4) || 0}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <span>{t('embeddingMetrics.dashboard.last7Days')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Queue Status Card */}
        <EmbeddingQueueMetrics showDetailed={false} />
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">{t('embeddingMetrics.dashboard.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="performance">{t('embeddingMetrics.dashboard.tabs.performance')}</TabsTrigger>
          <TabsTrigger value="quality">{t('embeddingMetrics.dashboard.tabs.quality')}</TabsTrigger>
          <TabsTrigger value="costs">{t('embeddingMetrics.dashboard.tabs.costs')}</TabsTrigger>
          <TabsTrigger value="queue">{t('embeddingMetrics.dashboard.tabs.queue')}</TabsTrigger>
          <TabsTrigger value="health">{t('embeddingMetrics.dashboard.tabs.health')}</TabsTrigger>
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
                  {t('embeddingMetrics.dashboard.recentActivity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('embeddingMetrics.dashboard.last24Hours')}</span>
                    <span className="font-mono">
                      {t('embeddingMetrics.dashboard.embeddingsCount', {
                        count: healthStatus?.metrics.raw_metrics_24h || 0,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('embeddingMetrics.dashboard.hourlyStats7d')}</span>
                    <span className="font-mono">
                      {t('embeddingMetrics.dashboard.recordsCount', {
                        count: healthStatus?.metrics.hourly_stats_7d || 0,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('embeddingMetrics.dashboard.dailyStats30d')}</span>
                    <span className="font-mono">
                      {t('embeddingMetrics.dashboard.recordsCount', {
                        count: healthStatus?.metrics.daily_stats_30d || 0,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Errors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('embeddingMetrics.dashboard.topErrorTypes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary?.topErrors.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                      {t('embeddingMetrics.dashboard.noErrors')}
                    </div>
                  ) : (
                    summary?.topErrors.map((error, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">
                          {t(`embeddingMetrics.dashboard.errorTypes.${error.type}`, {
                            defaultValue: error.type.replace('_', ' '),
                          })}
                        </span>
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
