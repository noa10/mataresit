/**
 * Performance Monitoring Dashboard
 * Phase 3: Batch Upload Optimization - Priority 3.2.2
 * 
 * Comprehensive dashboard combining rate limiting status,
 * API quota usage, and performance metrics monitoring.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { RateLimitStatusDisplay } from './RateLimitStatusDisplay';
import { APIQuotaUsageDisplay } from './APIQuotaUsageDisplay';
import { ProcessingEfficiencyDisplay } from './ProcessingEfficiencyDisplay';
import { cn } from '@/lib/utils';

interface PerformanceMonitoringDashboardProps {
  // Rate limiting data
  rateLimitStatus?: any;
  rateLimitMetrics?: any;
  rateLimitEvents?: any[];
  rateLimitAlerts?: any[];
  
  // Quota usage data
  quotaData?: any;
  quotaAlerts?: any[];

  // Processing efficiency data
  efficiencyData?: any;

  // Performance metrics
  performanceMetrics?: {
    throughput: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    activeRequests: number;
  };
  
  // Control callbacks
  onRefreshRateLimit?: () => void;
  onRefreshQuota?: () => Promise<void>;
  onDismissRateLimitAlert?: (alertId: string) => void;
  onDismissQuotaAlert?: (alertId: string) => void;
  onStrategyRecommendation?: (strategy: string) => void;
  onOptimizationRecommendation?: (recommendation: string) => void;
  
  // Configuration
  apiProvider?: string;
  className?: string;
}

export function PerformanceMonitoringDashboard({
  rateLimitStatus,
  rateLimitMetrics,
  rateLimitEvents = [],
  rateLimitAlerts = [],
  quotaData,
  quotaAlerts = [],
  efficiencyData,
  performanceMetrics,
  onRefreshRateLimit,
  onRefreshQuota,
  onDismissRateLimitAlert,
  onDismissQuotaAlert,
  onStrategyRecommendation,
  onOptimizationRecommendation,
  apiProvider = 'Gemini',
  className
}: PerformanceMonitoringDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Calculate overall system health
  const systemHealth = React.useMemo(() => {
    let healthScore = 100;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    // Check rate limiting status
    if (rateLimitStatus?.isRateLimited) {
      healthScore -= 30;
      issues.push('Rate limiting active');
    }
    if (rateLimitStatus?.consecutiveErrors > 2) {
      healthScore -= 20;
      issues.push('High error rate');
    }

    // Check quota usage
    if (quotaData) {
      const requestsUsage = (quotaData.requests.used / quotaData.requests.limit) * 100;
      const tokensUsage = (quotaData.tokens.used / quotaData.tokens.limit) * 100;
      
      if (requestsUsage > 90 || tokensUsage > 90) {
        healthScore -= 25;
        issues.push('Quota near exhaustion');
      } else if (requestsUsage > 75 || tokensUsage > 75) {
        healthScore -= 15;
        issues.push('High quota usage');
      }
    }

    // Check performance metrics
    if (performanceMetrics) {
      if (performanceMetrics.successRate < 0.8) {
        healthScore -= 20;
        issues.push('Low success rate');
      }
      if (performanceMetrics.errorRate > 0.2) {
        healthScore -= 15;
        issues.push('High error rate');
      }
    }

    // Determine status
    if (healthScore < 60) {
      status = 'critical';
    } else if (healthScore < 80) {
      status = 'warning';
    }

    return { score: Math.max(0, healthScore), status, issues };
  }, [rateLimitStatus, quotaData, performanceMetrics]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        onRefreshRateLimit?.(),
        onRefreshQuota?.()
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const totalAlerts = rateLimitAlerts.length + quotaAlerts.length;

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header with System Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">Performance Monitoring</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {apiProvider}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={cn('text-xs', {
                      'border-green-200 text-green-700 bg-green-50': systemHealth.status === 'healthy',
                      'border-orange-200 text-orange-700 bg-orange-50': systemHealth.status === 'warning',
                      'border-red-200 text-red-700 bg-red-50': systemHealth.status === 'critical'
                    })}
                  >
                    {systemHealth.status === 'healthy' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {systemHealth.status === 'warning' && <Clock className="h-3 w-3 mr-1" />}
                    {systemHealth.status === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {systemHealth.score}% Health
                  </Badge>
                  {totalAlerts > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {totalAlerts} Alert{totalAlerts > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Refresh All
            </Button>
          </div>
        </CardHeader>
        
        {systemHealth.issues.length > 0 && (
          <CardContent className="pt-0">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium mb-2">System Issues</div>
              <div className="space-y-1">
                {systemHealth.issues.map((issue, index) => (
                  <div key={index} className="text-xs flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-orange-500" />
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Monitoring Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="quota">Quota Usage</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Rate Limit Status - Compact */}
            <RateLimitStatusDisplay
              status={rateLimitStatus}
              metrics={rateLimitMetrics}
              events={rateLimitEvents}
              compact={true}
              onRefresh={onRefreshRateLimit}
            />
            
            {/* Quota Usage - Compact */}
            {quotaData && (
              <APIQuotaUsageDisplay
                quotaData={quotaData}
                apiProvider={apiProvider}
                showPredictions={false}
                showRecommendations={false}
                onRefresh={onRefreshQuota}
              />
            )}
          </div>

          {/* Performance Metrics Summary */}
          {performanceMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {performanceMetrics.throughput.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Throughput/min</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(performanceMetrics.successRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {performanceMetrics.averageResponseTime.toFixed(0)}ms
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Response</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {(performanceMetrics.errorRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Error Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {performanceMetrics.activeRequests}
                    </div>
                    <div className="text-xs text-muted-foreground">Active Requests</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rate Limits Tab */}
        <TabsContent value="rate-limits">
          <RateLimitStatusDisplay
            status={rateLimitStatus}
            metrics={rateLimitMetrics}
            events={rateLimitEvents}
            compact={false}
            showAdvanced={true}
            onRefresh={onRefreshRateLimit}
          />
        </TabsContent>

        {/* Quota Usage Tab */}
        <TabsContent value="quota">
          {quotaData ? (
            <APIQuotaUsageDisplay
              quotaData={quotaData}
              apiProvider={apiProvider}
              showPredictions={true}
              showRecommendations={true}
              showHistoricalTrends={true}
              onRefresh={onRefreshQuota}
              onStrategyRecommendation={onStrategyRecommendation}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No quota data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Efficiency Tab */}
        <TabsContent value="efficiency">
          {efficiencyData ? (
            <ProcessingEfficiencyDisplay
              data={efficiencyData}
              showRecommendations={true}
              showTrends={true}
              onOptimizationRecommendation={onOptimizationRecommendation}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center text-muted-foreground">
                  <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No efficiency data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Detailed performance metrics would be implemented here</p>
                <p className="text-xs">Including throughput charts, response time histograms, and error analysis</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
