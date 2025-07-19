/**
 * Success Rate Chart Component
 * Displays embedding generation success rate trends over time
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useMemo } from 'react';
import { EmbeddingMetricsChart } from './EmbeddingMetricsChart';
import { 
  transformHourlyStatsToSuccessRate, 
  generateChartConfig,
  CHART_COLORS 
} from '@/utils/chartUtils';
import { EmbeddingHourlyStats } from '@/types/embedding-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';

interface SuccessRateChartProps {
  hourlyStats: EmbeddingHourlyStats[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function SuccessRateChart({
  hourlyStats,
  isLoading = false,
  error = null,
  onRefresh,
  className = ''
}: SuccessRateChartProps) {
  // Transform data and generate chart config
  const { chartConfig, metrics } = useMemo(() => {
    const series = transformHourlyStatsToSuccessRate(hourlyStats);
    const config = generateChartConfig('success-rate', series);
    
    // Calculate summary metrics
    const totalAttempts = hourlyStats.reduce((sum, stat) => sum + stat.total_attempts, 0);
    const totalSuccessful = hourlyStats.reduce((sum, stat) => sum + stat.successful_attempts, 0);
    const overallSuccessRate = totalAttempts > 0 ? (totalSuccessful / totalAttempts) * 100 : 0;
    
    // Calculate recent trend (last 6 hours vs previous 6 hours)
    const recentStats = hourlyStats.slice(-6);
    const previousStats = hourlyStats.slice(-12, -6);
    
    const recentSuccessRate = recentStats.length > 0 
      ? recentStats.reduce((sum, stat) => {
          const rate = stat.total_attempts > 0 ? (stat.successful_attempts / stat.total_attempts) * 100 : 0;
          return sum + rate;
        }, 0) / recentStats.length
      : 0;
    
    const previousSuccessRate = previousStats.length > 0
      ? previousStats.reduce((sum, stat) => {
          const rate = stat.total_attempts > 0 ? (stat.successful_attempts / stat.total_attempts) * 100 : 0;
          return sum + rate;
        }, 0) / previousStats.length
      : 0;
    
    const trendChange = recentSuccessRate - previousSuccessRate;
    
    // Find lowest and highest success rates
    const successRates = hourlyStats.map(stat => 
      stat.total_attempts > 0 ? (stat.successful_attempts / stat.total_attempts) * 100 : 0
    );
    const lowestRate = Math.min(...successRates);
    const highestRate = Math.max(...successRates);
    
    return {
      chartConfig: config,
      metrics: {
        overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
        recentSuccessRate: Math.round(recentSuccessRate * 100) / 100,
        trendChange: Math.round(trendChange * 100) / 100,
        lowestRate: Math.round(lowestRate * 100) / 100,
        highestRate: Math.round(highestRate * 100) / 100,
        totalAttempts,
        totalSuccessful
      }
    };
  }, [hourlyStats]);

  const getSuccessRateStatus = (rate: number) => {
    if (rate >= 95) return { status: 'excellent', color: 'bg-green-100 text-green-800', icon: Target };
    if (rate >= 90) return { status: 'good', color: 'bg-blue-100 text-blue-800', icon: Target };
    if (rate >= 80) return { status: 'fair', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    return { status: 'poor', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
  };

  const getTrendStatus = (change: number) => {
    if (Math.abs(change) < 1) return { icon: TrendingUp, color: 'text-gray-500', text: 'Stable' };
    if (change > 0) return { icon: TrendingUp, color: 'text-green-500', text: `+${change.toFixed(1)}%` };
    return { icon: TrendingDown, color: 'text-red-500', text: `${change.toFixed(1)}%` };
  };

  const successRateStatus = getSuccessRateStatus(metrics.overallSuccessRate);
  const trendStatus = getTrendStatus(metrics.trendChange);
  const TrendIcon = trendStatus.icon;
  const StatusIcon = successRateStatus.icon;

  const handleExport = () => {
    const csvData = hourlyStats.map(stat => ({
      timestamp: stat.hour_bucket,
      total_attempts: stat.total_attempts,
      successful_attempts: stat.successful_attempts,
      success_rate: stat.total_attempts > 0 ? (stat.successful_attempts / stat.total_attempts) * 100 : 0
    }));

    const csvContent = [
      'Timestamp,Total Attempts,Successful Attempts,Success Rate (%)',
      ...csvData.map(row => `${row.timestamp},${row.total_attempts},${row.successful_attempts},${row.success_rate.toFixed(2)}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embedding-success-rate-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Success Rate</p>
                <p className="text-2xl font-bold">{metrics.overallSuccessRate}%</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon className="h-6 w-6 text-gray-400" />
                <Badge className={successRateStatus.color}>
                  {successRateStatus.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Trend</p>
                <p className="text-2xl font-bold">{metrics.recentSuccessRate}%</p>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon className={`h-5 w-5 ${trendStatus.color}`} />
                <span className={`text-sm font-medium ${trendStatus.color}`}>
                  {trendStatus.text}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Range</p>
                <p className="text-lg font-bold">
                  {metrics.lowestRate}% - {metrics.highestRate}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Min - Max</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Attempts</p>
                <p className="text-2xl font-bold">{metrics.totalAttempts.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-600 font-medium">
                  {metrics.totalSuccessful.toLocaleString()} successful
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <EmbeddingMetricsChart
        config={chartConfig}
        isLoading={isLoading}
        error={error}
        onRefresh={onRefresh}
        onExport={handleExport}
        className="col-span-full"
      />

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Success Rate Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.overallSuccessRate >= 95 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Target className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Excellent Performance</p>
                  <p className="text-sm text-green-700">
                    Your embedding generation is performing exceptionally well with a {metrics.overallSuccessRate}% success rate.
                  </p>
                </div>
              </div>
            )}
            
            {metrics.overallSuccessRate < 90 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Room for Improvement</p>
                  <p className="text-sm text-yellow-700">
                    Success rate of {metrics.overallSuccessRate}% indicates potential issues. Consider reviewing error patterns and API limits.
                  </p>
                </div>
              </div>
            )}

            {Math.abs(metrics.trendChange) > 5 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <TrendIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Significant Trend Change</p>
                  <p className="text-sm text-blue-700">
                    Success rate has {metrics.trendChange > 0 ? 'improved' : 'declined'} by {Math.abs(metrics.trendChange).toFixed(1)}% recently.
                    {metrics.trendChange < 0 && ' Monitor for potential issues.'}
                  </p>
                </div>
              </div>
            )}

            {hourlyStats.length === 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">No Data Available</p>
                  <p className="text-sm text-gray-700">
                    No embedding metrics data is available yet. Data will appear once embedding generation begins.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
