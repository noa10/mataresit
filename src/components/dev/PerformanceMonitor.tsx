/**
 * Performance Monitor Dashboard
 * 
 * Real-time performance monitoring for the formatting pipeline.
 * Tracks rendering times, memory usage, and component performance.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  Database, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { 
  useMemoryMonitoring, 
  getCacheStats, 
  clearAllCaches 
} from '@/hooks/useFormattingPerformance';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  threshold: number;
  description: string;
}

interface ComponentPerformance {
  name: string;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  totalRenderTime: number;
}

export function PerformanceMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [performanceData, setPerformanceData] = useState<ComponentPerformance[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const memoryInfo = useMemoryMonitoring();

  // Simulate performance data collection
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      // Collect performance data from various sources
      const cacheStats = getCacheStats();
      
      // Update metrics
      const newMetrics: PerformanceMetric[] = [
        {
          name: 'Parse Time',
          value: Math.random() * 100 + 50, // Simulated
          unit: 'ms',
          status: 'good',
          threshold: 200,
          description: 'Time to parse markdown and generate components'
        },
        {
          name: 'Render Time',
          value: Math.random() * 50 + 20, // Simulated
          unit: 'ms',
          status: 'good',
          threshold: 100,
          description: 'Time to render components to DOM'
        },
        {
          name: 'Cache Hit Rate',
          value: cacheStats.size > 0 ? 85 + Math.random() * 10 : 0,
          unit: '%',
          status: 'good',
          threshold: 80,
          description: 'Percentage of requests served from cache'
        },
        {
          name: 'Memory Usage',
          value: memoryInfo ? (memoryInfo.usedJSHeapSize / 1024 / 1024) : 0,
          unit: 'MB',
          status: 'good',
          threshold: 100,
          description: 'JavaScript heap memory usage'
        },
        {
          name: 'Component Count',
          value: cacheStats.entries.reduce((sum, entry) => sum + entry.componentCount, 0),
          unit: 'items',
          status: 'good',
          threshold: 1000,
          description: 'Total number of cached components'
        }
      ];

      // Update status based on thresholds
      newMetrics.forEach(metric => {
        if (metric.value > metric.threshold * 1.5) {
          metric.status = 'critical';
        } else if (metric.value > metric.threshold) {
          metric.status = 'warning';
        } else {
          metric.status = 'good';
        }
      });

      setMetrics(newMetrics);

      // Simulate component performance data
      const components: ComponentPerformance[] = [
        {
          name: 'DataTableComponent',
          renderCount: Math.floor(Math.random() * 50) + 10,
          averageRenderTime: Math.random() * 30 + 10,
          lastRenderTime: Math.random() * 50 + 5,
          totalRenderTime: Math.random() * 1000 + 200
        },
        {
          name: 'SectionHeaderComponent',
          renderCount: Math.floor(Math.random() * 30) + 5,
          averageRenderTime: Math.random() * 10 + 2,
          lastRenderTime: Math.random() * 15 + 1,
          totalRenderTime: Math.random() * 300 + 50
        },
        {
          name: 'VirtualizedDataTable',
          renderCount: Math.floor(Math.random() * 20) + 3,
          averageRenderTime: Math.random() * 40 + 15,
          lastRenderTime: Math.random() * 60 + 10,
          totalRenderTime: Math.random() * 800 + 150
        },
        {
          name: 'OptimizedChatMessage',
          renderCount: Math.floor(Math.random() * 100) + 20,
          averageRenderTime: Math.random() * 25 + 8,
          lastRenderTime: Math.random() * 35 + 5,
          totalRenderTime: Math.random() * 2000 + 400
        }
      ];

      setPerformanceData(components);
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, memoryInfo]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const overallHealth = useMemo(() => {
    if (metrics.length === 0) return 'unknown';
    
    const criticalCount = metrics.filter(m => m.status === 'critical').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'good';
  }, [metrics]);

  const cacheStats = getCacheStats();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Monitor</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of formatting pipeline performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={getStatusColor(overallHealth)}
          >
            {getStatusIcon(overallHealth)}
            <span className="ml-1 capitalize">{overallHealth}</span>
          </Badge>
          
          <Button
            variant={isMonitoring ? "destructive" : "default"}
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {metric.name}
                  </CardTitle>
                  {getStatusIcon(metric.status)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metric.value.toFixed(1)} {metric.unit}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.description}
                  </p>
                  <Progress 
                    value={(metric.value / metric.threshold) * 100} 
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Component Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {performanceData.map((component, index) => (
                    <div key={index} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{component.name}</h4>
                        <Badge variant="outline">
                          {component.renderCount} renders
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Average:</span>
                          <div className="font-medium">
                            {component.averageRenderTime.toFixed(1)}ms
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last:</span>
                          <div className="font-medium">
                            {component.lastRenderTime.toFixed(1)}ms
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <div className="font-medium">
                            {component.totalRenderTime.toFixed(1)}ms
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Cache Statistics
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllCaches}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Cache Size:</span>
                    <div className="text-2xl font-bold">{cacheStats.size}</div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total Components:</span>
                    <div className="text-2xl font-bold">
                      {cacheStats.entries.reduce((sum, entry) => sum + entry.componentCount, 0)}
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {cacheStats.entries.map((entry, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs">{entry.key}</span>
                          <Badge variant="secondary">
                            {entry.componentCount} components
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Cached: {new Date(entry.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memoryInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Used Heap:</span>
                      <div className="text-xl font-bold">
                        {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Heap:</span>
                      <div className="text-xl font-bold">
                        {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Heap Limit:</span>
                      <div className="text-xl font-bold">
                        {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                  </div>
                  
                  <Progress 
                    value={(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}
                    className="mt-4"
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  Memory monitoring not available in this browser
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
