/**
 * API Usage Chart Component
 * Displays API calls, token usage, and rate limiting metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useMemo } from 'react';
import { EmbeddingMetricsChart } from './EmbeddingMetricsChart';
import { 
  transformHourlyStatsToApiUsage, 
  generateChartConfig,
  createUploadContextData,
  CHART_COLORS 
} from '@/utils/chartUtils';
import { EmbeddingHourlyStats } from '@/types/embedding-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  Activity, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Clock,
  Shield
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface ApiUsageChartProps {
  hourlyStats: EmbeddingHourlyStats[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function ApiUsageChart({
  hourlyStats,
  isLoading = false,
  error = null,
  onRefresh,
  className = ''
}: ApiUsageChartProps) {
  const { t, language } = useAdminTranslation();
  const numberLocale = language === 'ms' ? 'ms-MY' : 'en-MY';

  // Transform data and calculate metrics
  const { chartConfig, metrics, uploadContextData } = useMemo(() => {
    const series = transformHourlyStatsToApiUsage(hourlyStats).map((item, index) => ({
      ...item,
      name: index === 0
        ? t('embeddingMetrics.charts.common.seriesApiCalls')
        : t('embeddingMetrics.charts.common.seriesTokensUsed')
    }));
    const config = {
      ...generateChartConfig('api-usage', series),
      title: t('embeddingMetrics.charts.common.titleApiUsage'),
      subtitle: t('embeddingMetrics.charts.common.subtitleApiUsage')
    };
    const contextData = createUploadContextData(hourlyStats).map((item, index) => ({
      ...item,
      name: index === 0
        ? t('embeddingMetrics.charts.common.seriesSingleUpload')
        : t('embeddingMetrics.charts.common.seriesBatchUpload')
    }));
    
    // Calculate API usage metrics
    const totalApiCalls = hourlyStats.reduce((sum, stat) => sum + stat.total_api_calls, 0);
    const totalTokens = hourlyStats.reduce((sum, stat) => sum + stat.total_tokens_used, 0);
    const totalRateLimited = hourlyStats.reduce((sum, stat) => sum + stat.rate_limited_count, 0);
    const totalAttempts = hourlyStats.reduce((sum, stat) => sum + stat.total_attempts, 0);
    
    // Calculate averages
    const avgApiCallsPerHour = hourlyStats.length > 0 ? totalApiCalls / hourlyStats.length : 0;
    const avgTokensPerHour = hourlyStats.length > 0 ? totalTokens / hourlyStats.length : 0;
    const avgTokensPerCall = totalApiCalls > 0 ? totalTokens / totalApiCalls : 0;
    const rateLimitedPercentage = totalAttempts > 0 ? (totalRateLimited / totalAttempts) * 100 : 0;
    
    // Calculate recent trend (last 6 hours vs previous 6 hours)
    const recentStats = hourlyStats.slice(-6);
    const previousStats = hourlyStats.slice(-12, -6);
    
    const recentApiCalls = recentStats.reduce((sum, stat) => sum + stat.total_api_calls, 0);
    const previousApiCalls = previousStats.reduce((sum, stat) => sum + stat.total_api_calls, 0);
    
    const apiCallsTrend = previousApiCalls > 0 
      ? ((recentApiCalls - previousApiCalls) / previousApiCalls) * 100 
      : 0;
    
    const recentTokens = recentStats.reduce((sum, stat) => sum + stat.total_tokens_used, 0);
    const previousTokens = previousStats.reduce((sum, stat) => sum + stat.total_tokens_used, 0);
    
    const tokensTrend = previousTokens > 0 
      ? ((recentTokens - previousTokens) / previousTokens) * 100 
      : 0;
    
    // Efficiency metrics
    const apiCallsPerAttempt = totalAttempts > 0 ? totalApiCalls / totalAttempts : 0;
    const tokensPerAttempt = totalAttempts > 0 ? totalTokens / totalAttempts : 0;
    
    // Rate limiting analysis
    const peakRateLimitedHour = Math.max(...hourlyStats.map(stat => stat.rate_limited_count));
    const rateLimitingTrend = hourlyStats.slice(-3).reduce((sum, stat) => sum + stat.rate_limited_count, 0);
    
    return {
      chartConfig: config,
      uploadContextData: contextData,
      metrics: {
        totalApiCalls,
        totalTokens,
        totalRateLimited,
        avgApiCallsPerHour: Math.round(avgApiCallsPerHour),
        avgTokensPerHour: Math.round(avgTokensPerHour),
        avgTokensPerCall: Math.round(avgTokensPerCall),
        rateLimitedPercentage: Math.round(rateLimitedPercentage * 100) / 100,
        apiCallsTrend: Math.round(apiCallsTrend * 100) / 100,
        tokensTrend: Math.round(tokensTrend * 100) / 100,
        apiCallsPerAttempt: Math.round(apiCallsPerAttempt * 100) / 100,
        tokensPerAttempt: Math.round(tokensPerAttempt),
        peakRateLimitedHour,
        rateLimitingTrend,
        efficiencyScore: Math.max(0, 100 - rateLimitedPercentage * 2) // Penalize rate limiting
      }
    };
  }, [hourlyStats, t]);

  const getEfficiencyStatus = (score: number) => {
    if (score >= 95) return { status: 'excellent', color: 'bg-green-100 text-green-800', icon: Zap };
    if (score >= 85) return { status: 'good', color: 'bg-blue-100 text-blue-800', icon: Zap };
    if (score >= 70) return { status: 'fair', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    return { status: 'poor', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
  };

  const getTrendStatus = (change: number, metric: string) => {
    if (Math.abs(change) < 5) return { icon: Activity, color: 'text-gray-500', text: t('embeddingMetrics.charts.common.trendStable') };
    if (change > 0) return { icon: TrendingUp, color: 'text-blue-500', text: `+${change.toFixed(1)}%` };
    return { icon: TrendingDown, color: 'text-green-500', text: `${change.toFixed(1)}%` };
  };

  const efficiencyStatus = getEfficiencyStatus(metrics.efficiencyScore);
  const apiTrendStatus = getTrendStatus(metrics.apiCallsTrend, 'API calls');
  const tokenTrendStatus = getTrendStatus(metrics.tokensTrend, 'tokens');
  const EfficiencyIcon = efficiencyStatus.icon;
  const ApiTrendIcon = apiTrendStatus.icon;
  const TokenTrendIcon = tokenTrendStatus.icon;

  const handleExport = () => {
    const csvData = hourlyStats.map(stat => ({
      timestamp: stat.hour_bucket,
      total_api_calls: stat.total_api_calls,
      total_tokens_used: stat.total_tokens_used,
      rate_limited_count: stat.rate_limited_count,
      total_attempts: stat.total_attempts
    }));

    const csvContent = [
      'Timestamp,API Calls,Tokens Used,Rate Limited,Total Attempts',
      ...csvData.map(row => `${row.timestamp},${row.total_api_calls},${row.total_tokens_used},${row.rate_limited_count},${row.total_attempts}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embedding-api-usage-${new Date().toISOString().split('T')[0]}.csv`;
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.apiUsage.totalCalls')}</p>
                <p className="text-2xl font-bold">{metrics.totalApiCalls.toLocaleString(numberLocale)}</p>
              </div>
              <div className="flex items-center gap-1">
                <ApiTrendIcon className={`h-5 w-5 ${apiTrendStatus.color}`} />
                <span className={`text-sm font-medium ${apiTrendStatus.color}`}>
                  {apiTrendStatus.text}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('embeddingMetrics.charts.apiUsage.perHourAverage', { count: metrics.avgApiCallsPerHour.toLocaleString(numberLocale) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.apiUsage.totalTokens')}</p>
                <p className="text-2xl font-bold">{metrics.totalTokens.toLocaleString(numberLocale)}</p>
              </div>
              <div className="flex items-center gap-1">
                <TokenTrendIcon className={`h-5 w-5 ${tokenTrendStatus.color}`} />
                <span className={`text-sm font-medium ${tokenTrendStatus.color}`}>
                  {tokenTrendStatus.text}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('embeddingMetrics.charts.apiUsage.tokensPerCallAverage', { count: metrics.avgTokensPerCall.toLocaleString(numberLocale) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.apiUsage.rateLimited')}</p>
                <p className="text-2xl font-bold">{metrics.rateLimitedPercentage}%</p>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-gray-400" />
                <Badge className={metrics.rateLimitedPercentage > 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                  {metrics.rateLimitedPercentage > 5
                    ? t('embeddingMetrics.charts.apiUsage.high')
                    : t('embeddingMetrics.charts.apiUsage.low')}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('embeddingMetrics.charts.apiUsage.totalOccurrences', { count: metrics.totalRateLimited.toLocaleString(numberLocale) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.apiUsage.efficiencyScore')}</p>
                <p className="text-2xl font-bold">{metrics.efficiencyScore.toFixed(0)}/100</p>
              </div>
              <div className="flex items-center gap-2">
                <EfficiencyIcon className="h-6 w-6 text-gray-400" />
                <Badge className={efficiencyStatus.color}>
                  {t(`embeddingMetrics.charts.status.${efficiencyStatus.status}`)}
                </Badge>
              </div>
            </div>
            <div className="mt-2">
              <Progress value={metrics.efficiencyScore} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* API Usage Chart */}
        <div className="lg:col-span-2">
          <EmbeddingMetricsChart
            config={chartConfig}
            isLoading={isLoading}
            error={error}
            onRefresh={onRefresh}
            onExport={handleExport}
          />
        </div>

        {/* Upload Context Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('embeddingMetrics.charts.apiUsage.uploadContextDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={uploadContextData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {uploadContextData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {uploadContextData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm">{entry.name}</span>
                  </div>
                  <span className="text-sm font-medium">{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('embeddingMetrics.charts.apiUsage.efficiencyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.callsPerAttempt')}</span>
                <span className="text-lg font-bold">{metrics.apiCallsPerAttempt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.tokensPerAttempt')}</span>
                <span className="text-lg font-bold">{metrics.tokensPerAttempt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.tokensPerCall')}</span>
                <span className="text-lg font-bold">{metrics.avgTokensPerCall}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('embeddingMetrics.charts.apiUsage.rateLimitingTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.peakRateLimited')}</span>
                <span className="text-lg font-bold">{metrics.peakRateLimitedHour}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.recentTrend3h')}</span>
                <span className="text-lg font-bold">{metrics.rateLimitingTrend}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('embeddingMetrics.charts.apiUsage.overallRate')}</span>
                <span className={`text-lg font-bold ${metrics.rateLimitedPercentage > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.rateLimitedPercentage}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Usage Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('embeddingMetrics.charts.apiUsage.insightsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.rateLimitedPercentage > 10 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">{t('embeddingMetrics.charts.apiUsage.highRateTitle')}</p>
                  <p className="text-sm text-red-700">
                    {t('embeddingMetrics.charts.apiUsage.highRateDesc', { rate: metrics.rateLimitedPercentage })}
                  </p>
                </div>
              </div>
            )}
            
            {metrics.apiCallsPerAttempt > 2 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{t('embeddingMetrics.charts.apiUsage.efficiencyConcernTitle')}</p>
                  <p className="text-sm text-yellow-700">
                    {t('embeddingMetrics.charts.apiUsage.efficiencyConcernDesc', { count: metrics.apiCallsPerAttempt })}
                  </p>
                </div>
              </div>
            )}

            {metrics.efficiencyScore >= 95 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">{t('embeddingMetrics.charts.apiUsage.excellentEfficiencyTitle')}</p>
                  <p className="text-sm text-green-700">
                    {t('embeddingMetrics.charts.apiUsage.excellentEfficiencyDesc')}
                  </p>
                </div>
              </div>
            )}

            {hourlyStats.length === 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Activity className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">{t('embeddingMetrics.charts.apiUsage.noDataTitle')}</p>
                  <p className="text-sm text-gray-700">
                    {t('embeddingMetrics.charts.apiUsage.noDataDesc')}
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
