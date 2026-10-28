/**
 * Error Patterns Chart Component
 * Displays error distribution, trends, and analysis for embedding generation
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useMemo } from 'react';
import { EmbeddingMetricsChart } from './EmbeddingMetricsChart';
import { 
  transformHourlyStatsToErrorPatterns, 
  generateChartConfig,
  createErrorDistributionData,
  CHART_COLORS 
} from '@/utils/chartUtils';
import { EmbeddingHourlyStats, EmbeddingMetricsSummary } from '@/types/embedding-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  XCircle, 
  Wifi, 
  Clock, 
  Shield,
  CheckCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { useAdminTranslation } from '@/contexts/LanguageContext';

const ERROR_TYPE_KEYS: Record<string, string> = {
  api_limit: 'apiLimit',
  network: 'network',
  validation: 'validation',
  timeout: 'timeout',
  unknown: 'unknown'
};

const ERROR_TYPE_ORDER = ['api_limit', 'network', 'validation', 'timeout', 'unknown'];

interface ErrorPatternsChartProps {
  hourlyStats: EmbeddingHourlyStats[];
  summary?: EmbeddingMetricsSummary | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function ErrorPatternsChart({
  hourlyStats,
  summary,
  isLoading = false,
  error = null,
  onRefresh,
  className = ''
}: ErrorPatternsChartProps) {
  const { t } = useAdminTranslation();

  const getErrorTypeLabel = (type: string) => {
    const key = ERROR_TYPE_KEYS[type.replace(/_errors$/, '')] ?? 'unknown';
    return t(`embeddingMetrics.charts.errorTypes.${key}`);
  };

  // Transform data and calculate metrics
  const { chartConfig, metrics, errorDistribution, errorTrends } = useMemo(() => {
    const labelForType = (type: string) => {
      const key = ERROR_TYPE_KEYS[type.replace(/_errors$/, '')] ?? 'unknown';
      return t(`embeddingMetrics.charts.errorTypes.${key}`);
    };
    const series = transformHourlyStatsToErrorPatterns(hourlyStats).map((item, index) => ({
      ...item,
      name: labelForType(ERROR_TYPE_ORDER[index] ?? 'unknown')
    }));
    const config = {
      ...generateChartConfig('errors', series),
      title: t('embeddingMetrics.charts.common.titleErrors'),
      subtitle: t('embeddingMetrics.charts.common.subtitleErrors')
    };
    const distribution = summary
      ? createErrorDistributionData(summary).map((entry, index) => ({
          ...entry,
          name: labelForType(summary.topErrors[index]?.type ?? 'unknown')
        }))
      : [];
    
    // Calculate error metrics
    const totalErrors = hourlyStats.reduce((sum, stat) => 
      sum + stat.api_limit_errors + stat.network_errors + stat.validation_errors + 
      stat.timeout_errors + stat.unknown_errors, 0
    );
    
    const errorsByType = {
      api_limit: hourlyStats.reduce((sum, stat) => sum + stat.api_limit_errors, 0),
      network: hourlyStats.reduce((sum, stat) => sum + stat.network_errors, 0),
      validation: hourlyStats.reduce((sum, stat) => sum + stat.validation_errors, 0),
      timeout: hourlyStats.reduce((sum, stat) => sum + stat.timeout_errors, 0),
      unknown: hourlyStats.reduce((sum, stat) => sum + stat.unknown_errors, 0)
    };
    
    const totalAttempts = hourlyStats.reduce((sum, stat) => sum + stat.total_attempts, 0);
    const errorRate = totalAttempts > 0 ? (totalErrors / totalAttempts) * 100 : 0;
    
    // Calculate recent trend (last 6 hours vs previous 6 hours)
    const recentStats = hourlyStats.slice(-6);
    const previousStats = hourlyStats.slice(-12, -6);
    
    const recentErrors = recentStats.reduce((sum, stat) => 
      sum + stat.api_limit_errors + stat.network_errors + stat.validation_errors + 
      stat.timeout_errors + stat.unknown_errors, 0
    );
    
    const previousErrors = previousStats.reduce((sum, stat) => 
      sum + stat.api_limit_errors + stat.network_errors + stat.validation_errors + 
      stat.timeout_errors + stat.unknown_errors, 0
    );
    
    const errorTrend = previousErrors > 0 
      ? ((recentErrors - previousErrors) / previousErrors) * 100 
      : 0;
    
    // Most problematic error type
    const mostProblematicError = Object.entries(errorsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Error trends by type
    const trends = Object.keys(errorsByType).map(type => {
      const recentCount = recentStats.reduce((sum, stat) => sum + (stat as any)[`${type}_errors`], 0);
      const previousCount = previousStats.reduce((sum, stat) => sum + (stat as any)[`${type}_errors`], 0);
      const trend = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 0;
      
      return {
        type,
        total: errorsByType[type as keyof typeof errorsByType],
        trend,
        recent: recentCount
      };
    });
    
    return {
      chartConfig: config,
      errorDistribution: distribution,
      errorTrends: trends,
      metrics: {
        totalErrors,
        errorRate: Math.round(errorRate * 100) / 100,
        errorTrend: Math.round(errorTrend * 100) / 100,
        mostProblematicError: mostProblematicError ? {
          type: mostProblematicError[0],
          count: mostProblematicError[1]
        } : null,
        errorsByType,
        avgErrorsPerHour: hourlyStats.length > 0 ? Math.round(totalErrors / hourlyStats.length) : 0
      }
    };
  }, [hourlyStats, summary, t]);

  const getErrorSeverity = (errorRate: number) => {
    if (errorRate <= 1) return { status: 'excellent', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (errorRate <= 5) return { status: 'good', color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
    if (errorRate <= 10) return { status: 'warning', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    return { status: 'critical', color: 'bg-red-100 text-red-800', icon: XCircle };
  };

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'api_limit': return Shield;
      case 'network': return Wifi;
      case 'timeout': return Clock;
      case 'validation': return AlertTriangle;
      default: return XCircle;
    }
  };

  const getErrorColor = (errorType: string) => {
    switch (errorType) {
      case 'api_limit': return CHART_COLORS.error;
      case 'network': return CHART_COLORS.warning;
      case 'timeout': return CHART_COLORS.orange;
      case 'validation': return CHART_COLORS.info;
      default: return CHART_COLORS.gray;
    }
  };

  const errorSeverity = getErrorSeverity(metrics.errorRate);
  const ErrorSeverityIcon = errorSeverity.icon;

  const handleExport = () => {
    const csvData = hourlyStats.map(stat => ({
      timestamp: stat.hour_bucket,
      api_limit_errors: stat.api_limit_errors,
      network_errors: stat.network_errors,
      validation_errors: stat.validation_errors,
      timeout_errors: stat.timeout_errors,
      unknown_errors: stat.unknown_errors,
      total_attempts: stat.total_attempts
    }));

    const csvContent = [
      'Timestamp,API Limit Errors,Network Errors,Validation Errors,Timeout Errors,Unknown Errors,Total Attempts',
      ...csvData.map(row => `${row.timestamp},${row.api_limit_errors},${row.network_errors},${row.validation_errors},${row.timeout_errors},${row.unknown_errors},${row.total_attempts}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embedding-error-patterns-${new Date().toISOString().split('T')[0]}.csv`;
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
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.errorPatterns.errorRate')}</p>
                <p className="text-2xl font-bold">{metrics.errorRate}%</p>
              </div>
              <div className="flex items-center gap-2">
                <ErrorSeverityIcon className="h-6 w-6 text-gray-400" />
                <Badge className={errorSeverity.color}>
                  {t(`embeddingMetrics.charts.status.${errorSeverity.status}`)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('embeddingMetrics.charts.errorPatterns.totalErrors', { count: metrics.totalErrors })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.errorPatterns.errorTrend')}</p>
                <p className="text-2xl font-bold">
                  {metrics.errorTrend > 0 ? '+' : ''}{metrics.errorTrend.toFixed(1)}%
                </p>
              </div>
              <div className="flex items-center gap-1">
                {metrics.errorTrend > 0 ? (
                  <TrendingUp className="h-5 w-5 text-red-500" />
                ) : metrics.errorTrend < 0 ? (
                  <TrendingDown className="h-5 w-5 text-green-500" />
                ) : (
                  <div className="h-5 w-5" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('embeddingMetrics.charts.errorPatterns.recentVsPrevious')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.errorPatterns.topErrorType')}</p>
                <p className="text-lg font-bold capitalize">
                  {metrics.mostProblematicError
                    ? getErrorTypeLabel(metrics.mostProblematicError.type)
                    : t('embeddingMetrics.charts.errorPatterns.none')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {metrics.mostProblematicError?.count || 0}
                </p>
                <p className="text-xs text-muted-foreground">{t('embeddingMetrics.charts.errorPatterns.occurrences')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('embeddingMetrics.charts.errorPatterns.avgErrorsPerHour')}</p>
                <p className="text-2xl font-bold">{metrics.avgErrorsPerHour}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {t('embeddingMetrics.charts.errorPatterns.basedOnHours', { count: hourlyStats.length })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error Patterns Over Time */}
        <EmbeddingMetricsChart
          config={chartConfig}
          isLoading={isLoading}
          error={error}
          onRefresh={onRefresh}
          onExport={handleExport}
        />

        {/* Error Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('embeddingMetrics.charts.errorPatterns.distributionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {errorDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={errorDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {errorDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-gray-500 font-medium">{t('embeddingMetrics.charts.errorPatterns.noErrorsTitle')}</p>
                  <p className="text-gray-400 text-sm">{t('embeddingMetrics.charts.errorPatterns.noErrorsDesc')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Type Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('embeddingMetrics.charts.errorPatterns.analysisTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {errorTrends.map((errorTrend) => {
              const ErrorIcon = getErrorIcon(errorTrend.type);
              const errorColor = getErrorColor(errorTrend.type);
              
              return (
                <div key={errorTrend.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ErrorIcon className="h-5 w-5" style={{ color: errorColor }} />
                    <div>
                      <p className="font-medium capitalize">{t('embeddingMetrics.charts.errorPatterns.typeErrors', { type: getErrorTypeLabel(errorTrend.type) })}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('embeddingMetrics.charts.errorPatterns.trendSummary', {
                          total: errorTrend.total,
                          recent: errorTrend.recent
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      {errorTrend.trend > 0 ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : errorTrend.trend < 0 ? (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      ) : null}
                      <span className={`text-sm font-medium ${
                        errorTrend.trend > 0 ? 'text-red-600' : 
                        errorTrend.trend < 0 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {errorTrend.trend > 0 ? '+' : ''}{errorTrend.trend.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('embeddingMetrics.charts.errorPatterns.recommendationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.errorRate <= 1 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">{t('embeddingMetrics.charts.errorPatterns.excellentRateTitle')}</p>
                  <p className="text-sm text-green-700">
                    {t('embeddingMetrics.charts.errorPatterns.excellentRateDesc', { rate: metrics.errorRate })}
                  </p>
                </div>
              </div>
            )}
            
            {metrics.errorsByType.api_limit > metrics.totalErrors * 0.3 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <Shield className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">{t('embeddingMetrics.charts.errorPatterns.highApiLimitTitle')}</p>
                  <p className="text-sm text-red-700">
                    {t('embeddingMetrics.charts.errorPatterns.highApiLimitDesc')}
                  </p>
                </div>
              </div>
            )}

            {metrics.errorsByType.network > metrics.totalErrors * 0.3 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <Wifi className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{t('embeddingMetrics.charts.errorPatterns.networkIssuesTitle')}</p>
                  <p className="text-sm text-yellow-700">
                    {t('embeddingMetrics.charts.errorPatterns.networkIssuesDesc')}
                  </p>
                </div>
              </div>
            )}

            {metrics.errorsByType.timeout > metrics.totalErrors * 0.2 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">{t('embeddingMetrics.charts.errorPatterns.timeoutTitle')}</p>
                  <p className="text-sm text-orange-700">
                    {t('embeddingMetrics.charts.errorPatterns.timeoutDesc')}
                  </p>
                </div>
              </div>
            )}

            {metrics.totalErrors === 0 && hourlyStats.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">{t('embeddingMetrics.charts.errorPatterns.perfectTitle')}</p>
                  <p className="text-sm text-green-700">
                    {t('embeddingMetrics.charts.errorPatterns.perfectDesc')}
                  </p>
                </div>
              </div>
            )}

            {hourlyStats.length === 0 && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">{t('embeddingMetrics.charts.errorPatterns.noDataTitle')}</p>
                  <p className="text-sm text-gray-700">
                    {t('embeddingMetrics.charts.errorPatterns.noDataDesc')}
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
