/**
 * Performance Charts Component
 * Real-time charts for search performance visualization
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Clock, Database, Activity, TrendingUp } from 'lucide-react';
import { useSearchPerformance } from '@/hooks/useSearchPerformance';

interface ChartDataPoint {
  timestamp: string;
  queryTime: number;
  cacheHitRate: number;
  resultCount: number;
  queries: number;
}

interface PerformanceChartsProps {
  className?: string;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ className }) => {
  const { performanceSummary, cacheMetrics } = useSearchPerformance();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  // Simulate real-time data updates
  useEffect(() => {
    const updateChartData = () => {
      const now = new Date();
      const newDataPoint: ChartDataPoint = {
        timestamp: now.toLocaleTimeString(),
        queryTime: performanceSummary.averageQueryTime,
        cacheHitRate: performanceSummary.cacheHitRate,
        resultCount: performanceSummary.averageResultCount,
        queries: performanceSummary.totalQueries
      };

      setChartData(prev => {
        const updated = [...prev, newDataPoint];
        // Keep only last 50 data points for performance
        return updated.slice(-50);
      });
    };

    // Initial data point
    updateChartData();

    // Update every 30 seconds
    const interval = setInterval(updateChartData, 30000);
    return () => clearInterval(interval);
  }, [performanceSummary]);

  // Cache distribution data for pie chart
  const cacheDistributionData = useMemo(() => [
    { name: 'Cache Hits', value: cacheMetrics.hits, color: '#10b981' },
    { name: 'Cache Misses', value: cacheMetrics.misses, color: '#ef4444' },
    { name: 'Evictions', value: cacheMetrics.evictions, color: '#f59e0b' }
  ], [cacheMetrics]);

  // Performance trend data
  const performanceTrendData = useMemo(() => {
    return chartData.map((point, index) => ({
      ...point,
      index: index + 1,
      efficiency: Math.round((100 - Math.min(point.queryTime / 10, 100)) * (point.cacheHitRate / 100))
    }));
  }, [chartData]);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${entry.value}${entry.dataKey === 'queryTime' ? 'ms' : entry.dataKey === 'cacheHitRate' ? '%' : ''}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Analytics</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">Live Data</Badge>
          <div className="flex border rounded-lg">
            {(['1h', '6h', '24h'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="cache">Cache Analytics</TabsTrigger>
          <TabsTrigger value="distribution">Query Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Query Time Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Clock className="h-4 w-4 mr-2" />
                  Query Response Time
                </CardTitle>
                <CardDescription>Average search query response time over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="queryTime" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cache Hit Rate Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Database className="h-4 w-4 mr-2" />
                  Cache Hit Rate
                </CardTitle>
                <CardDescription>Cache efficiency percentage over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="cacheHitRate" 
                      stroke="#10b981" 
                      fill="#10b981"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Query Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Activity className="h-4 w-4 mr-2" />
                  Query Volume
                </CardTitle>
                <CardDescription>Number of search queries over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="queries" 
                      fill="#8b5cf6"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Efficiency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Performance Efficiency
                </CardTitle>
                <CardDescription>Combined performance score (speed + cache efficiency)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cache Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Distribution</CardTitle>
                <CardDescription>Breakdown of cache hits, misses, and evictions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={cacheDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {cacheDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cache Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
                <CardDescription>Detailed cache performance statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{cacheMetrics.hits}</p>
                    <p className="text-sm text-green-700">Cache Hits</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{cacheMetrics.misses}</p>
                    <p className="text-sm text-red-700">Cache Misses</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{cacheMetrics.evictions}</p>
                    <p className="text-sm text-yellow-700">Evictions</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{cacheMetrics.compressions}</p>
                    <p className="text-sm text-blue-700">Compressions</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cache Efficiency</span>
                    <span className="font-medium">{Math.round(cacheMetrics.cacheEfficiency)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${cacheMetrics.cacheEfficiency}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span className="font-medium">{Math.round(cacheMetrics.memoryUsage * 100) / 100} MB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(cacheMetrics.memoryUsage * 2, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Result Distribution</CardTitle>
              <CardDescription>Distribution of search result counts over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="resultCount" 
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceCharts;
