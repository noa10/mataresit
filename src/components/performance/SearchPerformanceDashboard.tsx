/**
 * Search Performance Dashboard
 * Real-time visualization of search performance metrics and analytics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  Database, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { useSearchPerformance } from '@/hooks/useSearchPerformance';
import { toast } from 'sonner';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  trend, 
  status = 'good', 
  icon, 
  description 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <Card className={`${getStatusColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="flex items-center space-x-1">
                <p className="text-2xl font-bold">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                {unit && <span className="text-sm text-gray-500">{unit}</span>}
                {getTrendIcon()}
              </div>
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface AlertCardProps {
  alert: {
    type: 'warning' | 'critical' | 'info';
    message: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: string;
  };
  onDismiss: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onDismiss }) => {
  const getAlertIcon = () => {
    switch (alert.type) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getAlertVariant = () => {
    switch (alert.type) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'default';
    }
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-2">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          {getAlertIcon()}
          <div>
            <AlertTitle className="text-sm font-medium">
              {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Alert
            </AlertTitle>
            <AlertDescription className="text-sm">
              {alert.message}
            </AlertDescription>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>
    </Alert>
  );
};

export const SearchPerformanceDashboard: React.FC = () => {
  const {
    cacheMetrics,
    performanceSummary,
    activeAlerts,
    loading,
    error,
    refreshMetrics,
    clearCache,
    invalidateCache,
    setMonitoringEnabled,
    dismissAlert,
    clearAllAlerts,
    getOptimizationSuggestions
  } = useSearchPerformance();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [monitoringEnabled, setMonitoringEnabledState] = useState(true);

  // Handle monitoring toggle
  const handleMonitoringToggle = (enabled: boolean) => {
    setMonitoringEnabledState(enabled);
    setMonitoringEnabled(enabled);
    toast.info(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  };

  // Get performance status
  const getPerformanceStatus = () => {
    const avgQueryTime = performanceSummary.averageQueryTime;
    const cacheHitRate = performanceSummary.cacheHitRate;
    
    if (avgQueryTime > 2000 || cacheHitRate < 50) return 'critical';
    if (avgQueryTime > 500 || cacheHitRate < 70) return 'warning';
    return 'good';
  };

  // Get cache efficiency status
  const getCacheEfficiencyStatus = () => {
    const efficiency = cacheMetrics.cacheEfficiency;
    if (efficiency < 50) return 'critical';
    if (efficiency < 70) return 'warning';
    return 'good';
  };

  // Get optimization suggestions
  const optimizationSuggestions = getOptimizationSuggestions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Search Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of search performance and cache efficiency
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={monitoringEnabled ? "default" : "secondary"}>
            {monitoringEnabled ? "Monitoring Active" : "Monitoring Disabled"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMonitoringToggle(!monitoringEnabled)}
          >
            {monitoringEnabled ? "Disable" : "Enable"} Monitoring
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Average Query Time"
          value={Math.round(performanceSummary.averageQueryTime)}
          unit="ms"
          status={getPerformanceStatus()}
          trend={performanceSummary.trends.queryTimeImproving ? 'down' : 'up'}
          icon={<Clock className="h-5 w-5" />}
          description="Lower is better"
        />
        
        <MetricCard
          title="Cache Hit Rate"
          value={Math.round(performanceSummary.cacheHitRate)}
          unit="%"
          status={getCacheEfficiencyStatus()}
          trend={performanceSummary.trends.cacheEfficiencyImproving ? 'up' : 'down'}
          icon={<Database className="h-5 w-5" />}
          description="Target: >70%"
        />
        
        <MetricCard
          title="Total Queries"
          value={performanceSummary.totalQueries}
          status="good"
          icon={<Activity className="h-5 w-5" />}
          description="Since monitoring started"
        />
        
        <MetricCard
          title="Average Results"
          value={Math.round(performanceSummary.averageResultCount * 10) / 10}
          status={performanceSummary.averageResultCount > 3 ? 'good' : 'warning'}
          trend={performanceSummary.trends.resultQualityImproving ? 'up' : 'down'}
          icon={<Target className="h-5 w-5" />}
          description="Results per query"
        />
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cache">Cache Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Issues</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Performance Trends
                </CardTitle>
                <CardDescription>
                  Recent performance improvements and trends
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Query Time</span>
                  <Badge variant={performanceSummary.trends.queryTimeImproving ? "default" : "secondary"}>
                    {performanceSummary.trends.queryTimeImproving ? "Improving" : "Stable"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Result Quality</span>
                  <Badge variant={performanceSummary.trends.resultQualityImproving ? "default" : "secondary"}>
                    {performanceSummary.trends.resultQualityImproving ? "Improving" : "Stable"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Efficiency</span>
                  <Badge variant={performanceSummary.trends.cacheEfficiencyImproving ? "default" : "secondary"}>
                    {performanceSummary.trends.cacheEfficiencyImproving ? "Improving" : "Stable"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Overall system performance status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Status</span>
                  <Badge variant={getPerformanceStatus() === 'good' ? "default" : "destructive"}>
                    {getPerformanceStatus() === 'good' ? "Healthy" : "Needs Attention"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Performance Score</span>
                    <span>{Math.round((100 - Math.min(performanceSummary.averageQueryTime / 10, 100)) * (performanceSummary.cacheHitRate / 100))}%</span>
                  </div>
                  <Progress 
                    value={Math.round((100 - Math.min(performanceSummary.averageQueryTime / 10, 100)) * (performanceSummary.cacheHitRate / 100))} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cache Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
                <CardDescription>Detailed cache performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Cache Hits</p>
                    <p className="text-2xl font-bold text-green-600">{cacheMetrics.hits}</p>
                  </div>
                  <div>
                    <p className="font-medium">Cache Misses</p>
                    <p className="text-2xl font-bold text-red-600">{cacheMetrics.misses}</p>
                  </div>
                  <div>
                    <p className="font-medium">Evictions</p>
                    <p className="text-2xl font-bold text-yellow-600">{cacheMetrics.evictions}</p>
                  </div>
                  <div>
                    <p className="font-medium">Compressions</p>
                    <p className="text-2xl font-bold text-blue-600">{cacheMetrics.compressions}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>{Math.round(cacheMetrics.memoryUsage * 100) / 100} MB</span>
                  </div>
                  <Progress value={Math.min(cacheMetrics.memoryUsage * 2, 100)} className="h-2" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cache Entries</span>
                  <span>{cacheMetrics.entryCount}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cache Management */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
                <CardDescription>Tools for managing search cache</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={clearCache}
                    className="w-full"
                  >
                    Clear All Cache
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => invalidateCache('receipt')}
                    className="w-full"
                  >
                    Clear Receipt Cache
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => invalidateCache('business')}
                    className="w-full"
                  >
                    Clear Business Cache
                  </Button>
                </div>
                <div className="text-xs text-gray-500">
                  <p>Cache will automatically rebuild as searches are performed.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Active Alerts ({activeAlerts.length})
                </span>
                {activeAlerts.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearAllAlerts}>
                    Clear All
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Recent performance alerts and issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts. System is performing well!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.map((alert, index) => (
                    <AlertCard
                      key={index}
                      alert={alert}
                      onDismiss={() => dismissAlert(index)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Optimization Suggestions
              </CardTitle>
              <CardDescription>
                Recommendations to improve search performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optimizationSuggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                      {index + 1}
                    </div>
                    <p className="text-sm text-blue-800">{suggestion}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchPerformanceDashboard;
