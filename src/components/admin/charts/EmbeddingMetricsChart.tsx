/**
 * Embedding Metrics Chart Component
 * Reusable chart component for displaying various embedding metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 3
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Maximize2, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { ChartConfig, ChartSeries, formatTooltipContent } from '@/utils/chartUtils';

interface EmbeddingMetricsChartProps {
  config: ChartConfig;
  data?: any[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onExport?: () => void;
  onExpand?: () => void;
  className?: string;
}

// Custom tooltip component
const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.dataKey}:</span>
          <span className="font-medium text-gray-900">
            {formatTooltipContent(entry.value, entry.dataKey, entry)[0]}
          </span>
        </div>
      ))}
    </div>
  );
};

// Calculate trend direction
const calculateTrend = (data: any[], valueKey: string): 'up' | 'down' | 'stable' => {
  if (!data || data.length < 2) return 'stable';
  
  const recent = data.slice(-3);
  const older = data.slice(-6, -3);
  
  if (recent.length === 0 || older.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, item) => sum + (item[valueKey] || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, item) => sum + (item[valueKey] || 0), 0) / older.length;
  
  const change = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
};

export function EmbeddingMetricsChart({
  config,
  data = [],
  isLoading = false,
  error = null,
  onRefresh,
  onExport,
  onExpand,
  className = ''
}: EmbeddingMetricsChartProps) {
  // Transform series data to recharts format
  const chartData = useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
    // Get all unique timestamps
    const timestamps = new Set<string>();
    config.series.forEach(series => {
      series.data.forEach(point => timestamps.add(point.timestamp));
    });
    
    // Create combined data points
    return Array.from(timestamps).sort().map(timestamp => {
      const dataPoint: any = { timestamp };
      
      config.series.forEach(series => {
        const point = series.data.find(p => p.timestamp === timestamp);
        if (point) {
          dataPoint[series.name] = point.value;
          dataPoint[`${series.name}_label`] = point.label;
          dataPoint[`${series.name}_category`] = point.category;
        }
      });
      
      return dataPoint;
    });
  }, [config.series]);

  // Calculate trend for primary series
  const primarySeries = config.series[0];
  const trend = primarySeries ? calculateTrend(chartData, primarySeries.name) : 'stable';

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading chart data...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-red-500 font-medium">Failed to load chart data</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} className="mt-3">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-center">
          <div>
            <p className="text-gray-500 font-medium">No data available</p>
            <p className="text-gray-400 text-sm mt-1">Chart will appear when data is available</p>
          </div>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (config.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={config.height || 300}>
            <LineChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                stroke="#666"
              />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              {config.showLegend && <Legend />}
              {config.series.map((series, index) => (
                <Line
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ fill: series.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: series.color, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={config.height || 300}>
            <AreaChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                stroke="#666"
              />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              {config.showLegend && <Legend />}
              {config.series.map((series, index) => (
                <Area
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stackId={index === 0 ? "1" : undefined}
                  stroke={series.color}
                  fill={series.color}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={config.height || 300}>
            <BarChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                stroke="#666"
              />
              <YAxis stroke="#666" />
              <Tooltip content={<CustomTooltip />} />
              {config.showLegend && <Legend />}
              {config.series.map((series, index) => (
                <Bar
                  key={series.name}
                  dataKey={series.name}
                  fill={series.color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = config.series[0]?.data.map(point => ({
          name: point.label,
          value: point.value,
          color: point.color || config.series[0].color
        })) || [];

        return (
          <ResponsiveContainer width="100%" height={config.height || 300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type: {config.chartType}</div>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {config.title}
              {getTrendIcon()}
            </CardTitle>
            {config.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getTrendColor()}>
              {trend === 'stable' ? 'Stable' : trend === 'up' ? 'Trending Up' : 'Trending Down'}
            </Badge>
            <div className="flex items-center gap-1">
              {onRefresh && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              {onExport && (
                <Button variant="ghost" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {onExpand && (
                <Button variant="ghost" size="sm" onClick={onExpand}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
