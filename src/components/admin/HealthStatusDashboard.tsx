/**
 * Health Status Dashboard
 * Comprehensive health monitoring dashboard for embedding metrics system
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 4
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  Database,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Server,
  Wifi,
  HardDrive
} from 'lucide-react';
import { embeddingHealthService, SystemHealthStatus, AggregationStatus, PerformanceMetrics } from '@/services/embeddingHealthService';
import { cn } from '@/lib/utils';
import {
  getStatusColors,
  getStatusBadgeClasses,
  getMutedTextClasses,
  getEmphasisTextClasses
} from '@/lib/darkModeUtils';

interface HealthStatusDashboardProps {
  className?: string;
}

export function HealthStatusDashboard({ className }: HealthStatusDashboardProps) {
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [aggregationStatus, setAggregationStatus] = useState<AggregationStatus | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Auto-refresh interval (30 seconds)
  const refreshInterval = 30000;

  const fetchHealthData = async () => {
    try {
      setIsRefreshing(true);
      
      const [health, aggregation, performance] = await Promise.all([
        embeddingHealthService.performHealthCheck(),
        embeddingHealthService.getAggregationStatus(),
        embeddingHealthService.getPerformanceMetrics()
      ]);

      setHealthStatus(health);
      setAggregationStatus(aggregation);
      setPerformanceMetrics(performance);
      setLastRefresh(new Date());
      
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    // Set up auto-refresh
    const interval = setInterval(fetchHealthData, refreshInterval);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    const statusType = status as 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown';
    const colors = getStatusColors(statusType);

    switch (status) {
      case 'healthy': return <CheckCircle className={cn("h-5 w-5", colors.icon)} />;
      case 'warning': case 'degraded': return <AlertTriangle className={cn("h-5 w-5", colors.icon)} />;
      case 'critical': return <XCircle className={cn("h-5 w-5", colors.icon)} />;
      default: return <Activity className={cn("h-5 w-5", colors.icon)} />;
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'database': return <Database className="h-4 w-4" />;
      case 'embedding_tables': return <HardDrive className="h-4 w-4" />;
      case 'aggregation_functions': return <Zap className="h-4 w-4" />;
      case 'cache_system': return <Server className="h-4 w-4" />;
      case 'error_handler': return <Shield className="h-4 w-4" />;
      case 'recent_data': return <Activity className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getAggregationStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-spin" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      default: return <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Loading health status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {healthStatus && getStatusIcon(healthStatus.overallStatus)}
              System Health Status
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={healthStatus ? getStatusBadgeClasses(healthStatus.overallStatus as 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown') : getStatusBadgeClasses('unknown')}>
                {healthStatus?.overallStatus.toUpperCase() || 'UNKNOWN'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHealthData}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Health Score */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Health Score</span>
                <span className="text-2xl font-bold">{healthStatus?.healthScore || 0}/100</span>
              </div>
              <Progress value={healthStatus?.healthScore || 0} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Overall system health rating
              </p>
            </div>

            {/* Uptime */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Uptime</span>
                <span className="text-2xl font-bold">{healthStatus?.uptime.percentage.toFixed(1) || 0}%</span>
              </div>
              <Progress value={healthStatus?.uptime.percentage || 0} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {healthStatus?.uptime.duration || 'No data'}
              </p>
            </div>

            {/* Last Check */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Last Check</span>
                <span className="text-lg font-bold">
                  {lastRefresh ? formatTimeAgo(lastRefresh.toISOString()) : 'Never'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Auto-refresh every {refreshInterval / 1000}s
              </div>
            </div>
          </div>

          {/* Issues and Recommendations */}
          {healthStatus && (healthStatus.issues.length > 0 || healthStatus.recommendations.length > 0) && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {healthStatus.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Issues Detected
                  </h4>
                  <ul className="space-y-1">
                    {healthStatus.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-800/50">
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {healthStatus.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {healthStatus.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800/50">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Status Tabs */}
      <Tabs defaultValue="components" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="components">System Components</TabsTrigger>
          <TabsTrigger value="aggregation">Aggregation Status</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        {/* System Components */}
        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {healthStatus?.components.map((component, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getComponentIcon(component.component)}
                      <span className="font-medium capitalize">
                        {component.component.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(component.status)}
                      <Badge className={getStatusBadgeClasses(component.status as 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown')}>
                        {component.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{component.message}</p>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Response: {formatDuration(component.responseTime)}</span>
                    <span>{formatTimeAgo(component.timestamp)}</span>
                  </div>

                  {component.details && Object.keys(component.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors">View Details</summary>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 p-2 rounded mt-1 overflow-auto border border-gray-200 dark:border-gray-700">
                        {JSON.stringify(component.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Aggregation Status */}
        <TabsContent value="aggregation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hourly Aggregation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hourly Aggregation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {aggregationStatus && getAggregationStatusIcon(aggregationStatus.hourlyAggregation.status)}
                    <Badge className={aggregationStatus ? getStatusBadgeClasses(
                      aggregationStatus.hourlyAggregation.status === 'completed' ? 'healthy' :
                      aggregationStatus.hourlyAggregation.status === 'running' ? 'warning' : 'critical'
                    ) : getStatusBadgeClasses('unknown')}>
                      {aggregationStatus?.hourlyAggregation.status.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.hourlyAggregation.lastRun || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{formatDuration(aggregationStatus?.hourlyAggregation.duration || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records</span>
                    <span>{aggregationStatus?.hourlyAggregation.recordsProcessed?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.hourlyAggregation.nextScheduled || null)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Aggregation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Daily Aggregation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {aggregationStatus && getAggregationStatusIcon(aggregationStatus.dailyAggregation.status)}
                    <Badge className={aggregationStatus ? getStatusBadgeClasses(
                      aggregationStatus.dailyAggregation.status === 'completed' ? 'healthy' :
                      aggregationStatus.dailyAggregation.status === 'running' ? 'warning' : 'critical'
                    ) : getStatusBadgeClasses('unknown')}>
                      {aggregationStatus?.dailyAggregation.status.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.dailyAggregation.lastRun || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{formatDuration(aggregationStatus?.dailyAggregation.duration || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records</span>
                    <span>{aggregationStatus?.dailyAggregation.recordsProcessed?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.dailyAggregation.nextScheduled || null)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cleanup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Data Cleanup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {aggregationStatus && getAggregationStatusIcon(aggregationStatus.cleanup.status)}
                    <Badge className={aggregationStatus ? getStatusBadgeClasses(
                      aggregationStatus.cleanup.status === 'completed' ? 'healthy' :
                      aggregationStatus.cleanup.status === 'running' ? 'warning' : 'critical'
                    ) : getStatusBadgeClasses('unknown')}>
                      {aggregationStatus?.cleanup.status.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.cleanup.lastRun || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records Removed</span>
                    <span>{aggregationStatus?.cleanup.recordsRemoved?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Run</span>
                    <span>{formatTimeAgo(aggregationStatus?.cleanup.nextScheduled || null)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Metrics */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">API Response Time</p>
                    <p className="text-2xl font-bold">
                      {performanceMetrics?.apiResponseTime !== undefined 
                        ? performanceMetrics.apiResponseTime >= 0 
                          ? `${performanceMetrics.apiResponseTime}ms`
                          : 'Error'
                        : 'N/A'
                      }
                    </p>
                  </div>
                  <Wifi className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                    <p className="text-2xl font-bold">{performanceMetrics?.cacheHitRate.toFixed(1) || 0}%</p>
                  </div>
                  <Server className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold">{performanceMetrics?.errorRate.toFixed(1) || 0}%</p>
                  </div>
                  <Shield className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
