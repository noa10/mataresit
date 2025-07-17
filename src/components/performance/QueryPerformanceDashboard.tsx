/**
 * Query Performance Dashboard
 * Real-time monitoring and visualization of optimized query processing performance
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Clock, 
  Database, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Trash2,
  Play,
  Pause
} from 'lucide-react';
import { useOptimizedQueryPerformance } from '@/hooks/useOptimizedQueryPerformance';

export function QueryPerformanceDashboard() {
  const {
    metrics,
    isLoading,
    error,
    refreshMetrics,
    clearCaches,
    exportMetrics,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    alerts,
    dismissAlert
  } = useOptimizedQueryPerformance();

  const [activeTab, setActiveTab] = useState('overview');

  const handleExportMetrics = () => {
    const data = exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCacheColor = (hitRate: number) => {
    if (hitRate >= 80) return 'text-green-600';
    if (hitRate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Query Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and optimize search query processing performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshMetrics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={clearCaches}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Caches
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Performance Alert</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(index)}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="caching">Caching</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(metrics.averageProcessingTime, { good: 50, warning: 100 })}`}>
                  {metrics.averageProcessingTime.toFixed(1)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: &lt; 50ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getCacheColor(metrics.cacheHitRate)}`}>
                  {metrics.cacheHitRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: &gt; 80%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Queries/Minute</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.queriesPerMinute}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current load
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.totalQueries.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Since last reset
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Recent performance improvements and optimizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Processing Time</span>
                  <div className="flex items-center">
                    {metrics.trends.processingTimeImproving ? (
                      <TrendingDown className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <Badge variant={metrics.trends.processingTimeImproving ? 'default' : 'destructive'}>
                      {metrics.trends.processingTimeImproving ? 'Improving' : 'Degrading'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Efficiency</span>
                  <div className="flex items-center">
                    {metrics.trends.cacheEfficiencyImproving ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <Badge variant={metrics.trends.cacheEfficiencyImproving ? 'default' : 'destructive'}>
                      {metrics.trends.cacheEfficiencyImproving ? 'Improving' : 'Degrading'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Query Complexity</span>
                  <div className="flex items-center">
                    {metrics.trends.queryComplexityIncreasing ? (
                      <TrendingUp className="h-4 w-4 text-yellow-600 mr-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-600 mr-2" />
                    )}
                    <Badge variant={metrics.trends.queryComplexityIncreasing ? 'secondary' : 'default'}>
                      {metrics.trends.queryComplexityIncreasing ? 'Increasing' : 'Stable'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Processing Time Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Time Breakdown</CardTitle>
              <CardDescription>
                Time spent in different processing stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Query Parsing</span>
                    <span className="text-sm text-muted-foreground">{metrics.parseTime.toFixed(1)}ms</span>
                  </div>
                  <Progress value={(metrics.parseTime / metrics.averageProcessingTime) * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Intent Detection</span>
                    <span className="text-sm text-muted-foreground">{metrics.intentTime.toFixed(1)}ms</span>
                  </div>
                  <Progress value={(metrics.intentTime / metrics.averageProcessingTime) * 100} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Parameter Generation</span>
                    <span className="text-sm text-muted-foreground">{metrics.parameterTime.toFixed(1)}ms</span>
                  </div>
                  <Progress value={(metrics.parameterTime / metrics.averageProcessingTime) * 100} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Median Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.medianProcessingTime.toFixed(1)}ms
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">95th Percentile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.p95ProcessingTime.toFixed(1)}ms
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Slow Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.slowQueries.length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="caching" className="space-y-4">
          {/* Cache Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>
                Query processing cache statistics and efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Cache Hit Rate</h4>
                  <div className="text-3xl font-bold mb-2">{metrics.cacheHitRate.toFixed(1)}%</div>
                  <Progress value={metrics.cacheHitRate} className="mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Target: 80%+ for optimal performance
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Cache Size</h4>
                  <div className="text-3xl font-bold mb-2">{metrics.cacheSize}</div>
                  <p className="text-xs text-muted-foreground">
                    Cached query results
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {/* Intent Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Intent Distribution</CardTitle>
              <CardDescription>
                Distribution of detected query intents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(metrics.intentDistribution).map(([intent, count]) => (
                  <div key={intent} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{intent}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(metrics.intentDistribution))) * 100}%`
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
