/**
 * Performance Duration Chart Component
 * Displays embedding generation duration trends and performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useMemo } from 'react';
import { EmbeddingMetricsChart } from './EmbeddingMetricsChart';
import { 
  transformHourlyStatsToDuration, 
  generateChartConfig 
} from '@/utils/chartUtils';
import { EmbeddingHourlyStats } from '@/types/embedding-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface PerformanceDurationChartProps {
  hourlyStats: EmbeddingHourlyStats[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function PerformanceDurationChart({
  hourlyStats,
  isLoading = false,
  error = null,
  onRefresh,
  className = ''
}: PerformanceDurationChartProps) {
  const { t } = useAdminTranslation();

  // Transform data and calculate metrics
  const { chartConfig, metrics } = useMemo(() => {
    const series = transformHourlyStatsToDuration(hourlyStats).map((item, index) => ({
      ...item,
      name: index === 0
        ? t('embeddingMetrics.charts.common.seriesAverageDuration')
        : t('embeddingMetrics.charts.common.seriesP95Duration')
    }));
    const config = {
      ...generateChartConfig('duration', series),
      title: t('embeddingMetrics.charts.common.titleDuration'),
      subtitle: t('embeddingMetrics.charts.common.subtitleDuration')
    };
    
    // Calculate performance metrics
    const durations = hourlyStats.map(stat => stat.avg_duration_ms).filter(d => d > 0);
    const p95Durations = hourlyStats.map(stat => stat.p95_duration_ms).filter(d => d > 0);
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    const avgP95Duration = p95Durations.length > 0 
      ? p95Durations.reduce((sum, d) => sum + d, 0) / p95Durations.length 
      : 0;
    
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minP95Duration = p95Durations.length > 0 ? Math.min(...p95Durations) : 0;
    const maxP95Duration = p95Durations.length > 0 ? Math.max(...p95Durations) : 0;
    
    // Calculate recent trend (last 6 hours vs previous 6 hours)
    const recentStats = hourlyStats.slice(-6);
    const previousStats = hourlyStats.slice(-12, -6);
    
    const recentAvgDuration = recentStats.length > 0
      ? recentStats.reduce((sum, stat) => sum + stat.avg_duration_ms, 0) / recentStats.length
      : 0;
    
    const previousAvgDuration = previousStats.length > 0
      ? previousStats.reduce((sum, stat) => sum + stat.avg_duration_ms, 0) / previousStats.length
      : 0;
    
    const trendChange = previousAvgDuration > 0 
      ? ((recentAvgDuration - previousAvgDuration) / previousAvgDuration) * 100 
      : 0;
    
    // Performance targets
    const targetAvgDuration = 3000; // 3 seconds
    const targetP95Duration = 8000; // 8 seconds
    
    return {
      chartConfig: config,
      metrics: {
        avgDuration: Math.round(avgDuration),
        avgP95Duration: Math.round(avgP95Duration),
        minDuration: Math.round(minDuration),
        maxDuration: Math.round(maxDuration),
        minP95Duration: Math.round(minP95Duration),
        maxP95Duration: Math.round(maxP95Duration),
        recentAvgDuration: Math.round(recentAvgDuration),
        trendChange: Math.round(trendChange * 100) / 100,
        targetAvgDuration,
        targetP95Duration,
        avgPerformanceScore: Math.max(0, 100 - Math.max(0, (avgDuration - targetAvgDuration) / targetAvgDuration * 100)),
        p95PerformanceScore: Math.max(0, 100 - Math.max(0, (avgP95Duration - targetP95Duration) / targetP95Duration * 100))
      }
    };
  }, [hourlyStats, t]);

  const getPerformanceStatus = (duration: number, target: number) => {
    const ratio = duration / target;
    if (ratio <= 0.8) return { status: 'excellent', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (ratio <= 1.0) return { status: 'good', color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
    if (ratio <= 1.5) return { status: 'fair', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    return { status: 'poor', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
  };

  const getTrendStatus = (change: number) => {
    if (Math.abs(change) < 5) return { icon: Clock, color: 'text-gray-500', text: t('embeddingMetrics.charts.common.trendStable') };
    if (change < 0) return { icon: TrendingDown, color: 'text-green-500', text: t('embeddingMetrics.charts.duration.faster', { change: Math.abs(change).toFixed(1) }) };
    return { icon: TrendingUp, color: 'text-red-500', text: t('embeddingMetrics.charts.duration.slower', { change: change.toFixed(1) }) };
  };

  const avgStatus = getPerformanceStatus(metrics.avgDuration, metrics.targetAvgDuration);
  const p95Status = getPerformanceStatus(metrics.avgP95Duration, metrics.targetP95Duration);
  const trendStatus = getTrendStatus(metrics.trendChange);
  const TrendIcon = trendStatus.icon;
  const AvgStatusIcon = avgStatus.icon;
  const P95StatusIcon = p95Status.icon;

  const handleExport = () => {
    const csvData = hourlyStats.map(stat => ({
      timestamp: stat.hour_bucket,
      avg_duration_ms: stat.avg_duration_ms,
      p95_duration_ms: stat.p95_duration_ms,
      total_attempts: stat.total_attempts
    }));

    const csvContent = [
      'Timestamp,Average Duration (ms),P95 Duration (ms),Total Attempts',
      ...csvData.map(row => `${row.timestamp},${row.avg_duration_ms},${row.p95_duration_ms},${row.total_attempts}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embedding-performance-duration-${new Date().toISOString().split('T')[0]}.csv`;
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.duration.averageDuration')}</p>
                <p className="text-2xl font-bold">{metrics.avgDuration}ms</p>
              </div>
              <div className="flex items-center gap-2">
                <AvgStatusIcon className="h-6 w-6 text-gray-400" />
                <Badge className={avgStatus.color}>
                  {t(`embeddingMetrics.charts.status.${avgStatus.status}`)}
                </Badge>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t('embeddingMetrics.charts.duration.vsTarget', { target: metrics.targetAvgDuration })}</span>
                <span>{metrics.avgPerformanceScore.toFixed(0)}%</span>
              </div>
              <Progress value={metrics.avgPerformanceScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.duration.p95Duration')}</p>
                <p className="text-2xl font-bold">{metrics.avgP95Duration}ms</p>
              </div>
              <div className="flex items-center gap-2">
                <P95StatusIcon className="h-6 w-6 text-gray-400" />
                <Badge className={p95Status.color}>
                  {t(`embeddingMetrics.charts.status.${p95Status.status}`)}
                </Badge>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t('embeddingMetrics.charts.duration.vsTarget', { target: metrics.targetP95Duration })}</span>
                <span>{metrics.p95PerformanceScore.toFixed(0)}%</span>
              </div>
              <Progress value={metrics.p95PerformanceScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.duration.recentTrend')}</p>
                <p className="text-2xl font-bold">{metrics.recentAvgDuration}ms</p>
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.duration.durationRange')}</p>
                <p className="text-lg font-bold">
                  {metrics.minDuration} - {metrics.maxDuration}ms
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('embeddingMetrics.charts.duration.minMaxAvg')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('embeddingMetrics.charts.duration.p95Range', { min: metrics.minP95Duration, max: metrics.maxP95Duration })}
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

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('embeddingMetrics.charts.duration.insightsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.avgDuration <= metrics.targetAvgDuration && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">{t('embeddingMetrics.charts.duration.excellentTitle')}</p>
                  <p className="text-sm text-green-700">
                    {t('embeddingMetrics.charts.duration.excellentDesc', {
                      duration: metrics.avgDuration,
                      target: metrics.targetAvgDuration
                    })}
                  </p>
                </div>
              </div>
            )}
            
            {metrics.avgDuration > metrics.targetAvgDuration * 1.5 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">{t('embeddingMetrics.charts.duration.issueTitle')}</p>
                  <p className="text-sm text-red-700">
                    {t('embeddingMetrics.charts.duration.issueDesc', { duration: metrics.avgDuration })}
                  </p>
                </div>
              </div>
            )}

            {metrics.avgP95Duration > metrics.targetP95Duration && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{t('embeddingMetrics.charts.duration.p95AboveTitle')}</p>
                  <p className="text-sm text-yellow-700">
                    {t('embeddingMetrics.charts.duration.p95AboveDesc', {
                      duration: metrics.avgP95Duration,
                      target: metrics.targetP95Duration
                    })}
                  </p>
                </div>
              </div>
            )}

            {Math.abs(metrics.trendChange) > 20 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <TrendIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">{t('embeddingMetrics.charts.duration.significantTitle')}</p>
                  <p className="text-sm text-blue-700">
                    {t('embeddingMetrics.charts.duration.significantDesc', {
                      direction: metrics.trendChange > 0
                        ? t('embeddingMetrics.charts.duration.degraded')
                        : t('embeddingMetrics.charts.duration.improved'),
                      change: Math.abs(metrics.trendChange).toFixed(1)
                    })}
                    {metrics.trendChange > 0 && ` ${t('embeddingMetrics.charts.duration.monitor')}`}
                  </p>
                </div>
              </div>
            )}

            {hourlyStats.length === 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">{t('embeddingMetrics.charts.duration.noDataTitle')}</p>
                  <p className="text-sm text-gray-700">
                    {t('embeddingMetrics.charts.duration.noDataDesc')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('embeddingMetrics.charts.duration.targetsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.duration.avgTarget')}</span>
                <span className="text-sm text-muted-foreground">{metrics.targetAvgDuration}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">{t('embeddingMetrics.charts.duration.currentAverage')}</span>
                <span className={`text-sm font-medium ${metrics.avgDuration <= metrics.targetAvgDuration ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.avgDuration}ms
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.duration.p95Target')}</span>
                <span className="text-sm text-muted-foreground">{metrics.targetP95Duration}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">{t('embeddingMetrics.charts.duration.currentP95')}</span>
                <span className={`text-sm font-medium ${metrics.avgP95Duration <= metrics.targetP95Duration ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.avgP95Duration}ms
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
