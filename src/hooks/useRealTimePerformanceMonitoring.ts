/**
 * Real-Time Performance Monitoring Hook
 * Provides live performance metrics and monitoring capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PerformanceMetric {
  metric_name: string;
  metric_type: string;
  total_count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  percentile_50: number;
  percentile_95: number;
  percentile_99: number;
}

interface PerformanceAlert {
  alert_type: string;
  alert_message: string;
  metric_name: string;
  current_value: number;
  threshold_value: number;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

interface DashboardData {
  dashboard: Array<{
    metric_name: string;
    metric_type: string;
    total_measurements: number;
    avg_value: number;
    min_value: number;
    max_value: number;
    std_deviation: number;
    metric_unit: string;
    last_measurement: string;
  }>;
  alerts: PerformanceAlert[];
  summary: PerformanceMetric[];
  healthScore: number;
  lastUpdated: string;
}

interface TrendDataPoint {
  time_bucket: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count_values: number;
}

interface UseRealTimePerformanceMonitoringReturn {
  // Current data
  dashboardData: DashboardData | null;
  trends: Record<string, TrendDataPoint[]>;
  alerts: PerformanceAlert[];
  healthScore: number;
  
  // State
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // Actions
  refreshData: () => Promise<void>;
  getTrends: (metricName: string, timeRange?: string) => Promise<TrendDataPoint[]>;
  logMetric: (metricData: {
    metric_name: string;
    metric_type: string;
    metric_value: number;
    metric_unit: string;
    context?: any;
  }) => Promise<void>;
  clearAlerts: () => void;
  
  // Real-time controls
  startRealTimeMonitoring: () => void;
  stopRealTimeMonitoring: () => void;
  setRefreshInterval: (intervalMs: number) => void;
}

export function useRealTimePerformanceMonitoring(): UseRealTimePerformanceMonitoringReturn {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendDataPoint[]>>({});
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [healthScore, setHealthScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshInterval, setRefreshIntervalState] = useState(30000); // 30 seconds
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  /**
   * Call the performance monitor Edge Function
   */
  const callPerformanceMonitor = useCallback(async (action: string, params: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke('performance-monitor', {
        body: { action, ...params }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Performance monitor call failed');
      }

      return data.data;
    } catch (err) {
      console.error('Performance monitor error:', err);
      throw err;
    }
  }, []);

  /**
   * Refresh dashboard data
   */
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await callPerformanceMonitor('get_dashboard');
      
      setDashboardData(data);
      setAlerts(data.alerts || []);
      setHealthScore(data.healthScore || 0);
      setIsConnected(true);

      // Show critical alerts as toasts
      const criticalAlerts = (data.alerts || []).filter((alert: PerformanceAlert) => alert.severity === 'critical');
      criticalAlerts.forEach((alert: PerformanceAlert) => {
        toast.error(`Critical Alert: ${alert.alert_message}`, {
          description: `${alert.metric_name}: ${alert.current_value} (threshold: ${alert.threshold_value})`,
          duration: 10000
        });
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh performance data';
      setError(errorMessage);
      setIsConnected(false);
      console.error('Failed to refresh performance data:', err);
    } finally {
      setLoading(false);
    }
  }, [callPerformanceMonitor]);

  /**
   * Get performance trends for a specific metric
   */
  const getTrends = useCallback(async (
    metricName: string, 
    timeRange: string = '24h'
  ): Promise<TrendDataPoint[]> => {
    try {
      const hoursBack = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24;
      const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      const trendData = await callPerformanceMonitor('get_trends', {
        metric_name: metricName,
        start_date: startDate
      });

      // Update trends cache
      setTrends(prev => ({
        ...prev,
        [metricName]: trendData
      }));

      return trendData;
    } catch (err) {
      console.error(`Failed to get trends for ${metricName}:`, err);
      return [];
    }
  }, [callPerformanceMonitor]);

  /**
   * Log a performance metric
   */
  const logMetric = useCallback(async (metricData: {
    metric_name: string;
    metric_type: string;
    metric_value: number;
    metric_unit: string;
    context?: any;
  }) => {
    try {
      await callPerformanceMonitor('log_metric', {
        metric_data: metricData
      });

      console.log(`📊 Logged performance metric: ${metricData.metric_name} = ${metricData.metric_value}${metricData.metric_unit}`);
    } catch (err) {
      console.error('Failed to log performance metric:', err);
    }
  }, [callPerformanceMonitor]);

  /**
   * Clear alerts
   */
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    toast.info('Performance alerts cleared');
  }, []);

  /**
   * Start real-time monitoring
   */
  const startRealTimeMonitoring = useCallback(() => {
    if (isMonitoringRef.current) return;

    console.log(`🔄 Starting real-time performance monitoring (${refreshInterval}ms interval)`);
    isMonitoringRef.current = true;

    // Initial data load
    refreshData();

    // Set up interval for regular updates
    intervalRef.current = setInterval(() => {
      if (isMonitoringRef.current) {
        refreshData();
      }
    }, refreshInterval);

    toast.info('Real-time performance monitoring started');
  }, [refreshData, refreshInterval]);

  /**
   * Stop real-time monitoring
   */
  const stopRealTimeMonitoring = useCallback(() => {
    if (!isMonitoringRef.current) return;

    console.log('⏹️ Stopping real-time performance monitoring');
    isMonitoringRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsConnected(false);
    toast.info('Real-time performance monitoring stopped');
  }, []);

  /**
   * Set refresh interval
   */
  const setRefreshInterval = useCallback((intervalMs: number) => {
    setRefreshIntervalState(intervalMs);
    
    // Restart monitoring with new interval if currently active
    if (isMonitoringRef.current) {
      stopRealTimeMonitoring();
      setTimeout(() => startRealTimeMonitoring(), 100);
    }
    
    console.log(`⏱️ Performance monitoring interval set to ${intervalMs}ms`);
  }, [startRealTimeMonitoring, stopRealTimeMonitoring]);

  /**
   * Auto-start monitoring on mount
   */
  useEffect(() => {
    startRealTimeMonitoring();

    // Cleanup on unmount
    return () => {
      stopRealTimeMonitoring();
    };
  }, [startRealTimeMonitoring, stopRealTimeMonitoring]);

  /**
   * Load initial trends for key metrics
   */
  useEffect(() => {
    const loadInitialTrends = async () => {
      const keyMetrics = ['search_query_time', 'search_cache_hit', 'search_result_count'];
      
      for (const metric of keyMetrics) {
        try {
          await getTrends(metric, '6h');
        } catch (err) {
          console.warn(`Failed to load initial trends for ${metric}:`, err);
        }
      }
    };

    if (dashboardData) {
      loadInitialTrends();
    }
  }, [dashboardData, getTrends]);

  /**
   * Monitor health score changes
   */
  useEffect(() => {
    if (healthScore > 0) {
      if (healthScore < 50) {
        toast.warning(`Performance health score is low: ${healthScore}%`, {
          description: 'Consider reviewing system performance',
          duration: 5000
        });
      } else if (healthScore > 90) {
        // Only show success toast occasionally to avoid spam
        if (Math.random() < 0.1) {
          toast.success(`Excellent performance: ${healthScore}% health score`);
        }
      }
    }
  }, [healthScore]);

  return {
    // Current data
    dashboardData,
    trends,
    alerts,
    healthScore,
    
    // State
    loading,
    error,
    isConnected,
    
    // Actions
    refreshData,
    getTrends,
    logMetric,
    clearAlerts,
    
    // Real-time controls
    startRealTimeMonitoring,
    stopRealTimeMonitoring,
    setRefreshInterval
  };
}

export default useRealTimePerformanceMonitoring;
