/**
 * Embedding Performance Charts
 * Interactive charts for visualizing embedding performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Clock, Zap, Target, AlertTriangle } from 'lucide-react';
import { EmbeddingHourlyStats, EmbeddingDailyStats, EmbeddingMetricsSummary } from '@/types/embedding-metrics';
import { SuccessRateChart } from './charts/SuccessRateChart';
import { PerformanceDurationChart } from './charts/PerformanceDurationChart';
import { ApiUsageChart } from './charts/ApiUsageChart';
import { ErrorPatternsChart } from './charts/ErrorPatternsChart';
import { generateMockHourlyStats, generateMockDailyStats, generateMockSummary } from '@/utils/chartUtils';

interface EmbeddingPerformanceChartsProps {
  hourlyStats: EmbeddingHourlyStats[];
  dailyStats: EmbeddingDailyStats[];
  summary?: EmbeddingMetricsSummary | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function EmbeddingPerformanceCharts({
  hourlyStats,
  dailyStats,
  summary,
  isLoading = false,
  onRefresh
}: EmbeddingPerformanceChartsProps) {
  const [activeTab, setActiveTab] = useState('success-rate');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Use mock data for demonstration when no real data is available
  const displayHourlyStats = hourlyStats.length > 0 ? hourlyStats : generateMockHourlyStats(24);
  const displayDailyStats = dailyStats.length > 0 ? dailyStats : generateMockDailyStats(7);
  const displaySummary = summary || generateMockSummary();

  // Calculate some basic stats for display
  const totalHourlyAttempts = displayHourlyStats.reduce((sum, stat) => sum + stat.total_attempts, 0);
  const totalDailyAttempts = displayDailyStats.reduce((sum, stat) => sum + stat.total_attempts, 0);
  const avgSuccessRate = displayDailyStats.length > 0
    ? displayDailyStats.reduce((sum, stat) => sum + stat.success_rate, 0) / displayDailyStats.length
    : 0;
  const avgDuration = displayDailyStats.length > 0
    ? displayDailyStats.reduce((sum, stat) => sum + stat.avg_duration_ms, 0) / displayDailyStats.length
    : 0;

  const isUsingMockData = hourlyStats.length === 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {/* Demo Data Notice */}
      {isUsingMockData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <p className="text-blue-800 font-medium">Demo Mode</p>
            </div>
            <p className="text-blue-700 text-sm mt-1">
              Displaying sample data for demonstration. Real metrics will appear once embedding generation begins.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hourly Records</p>
                <p className="text-2xl font-bold">{displayHourlyStats.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalHourlyAttempts} total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Records</p>
                <p className="text-2xl font-bold">{displayDailyStats.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalDailyAttempts} total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Success Rate</p>
                <p className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{avgDuration.toFixed(0)}ms</p>
              </div>
              <Zap className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Processing time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="success-rate" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Success Rate
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="api-usage" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            API Usage
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="success-rate" className="space-y-4">
          <SuccessRateChart
            hourlyStats={displayHourlyStats}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceDurationChart
            hourlyStats={displayHourlyStats}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="api-usage" className="space-y-4">
          <ApiUsageChart
            hourlyStats={displayHourlyStats}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <ErrorPatternsChart
            hourlyStats={displayHourlyStats}
            summary={displaySummary}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
