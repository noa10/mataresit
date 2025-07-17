/**
 * React Hook for Monitoring Optimized Query Processing Performance
 * Tracks metrics, cache performance, and provides optimization insights
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { optimizedQueryProcessor } from '@/lib/optimized-query-processor';
import { getNormalizationStats } from '@/lib/query-normalization-optimizer';
import { getIntentDetectionStats } from '@/lib/optimized-intent-detector';

interface QueryPerformanceMetrics {
  // Processing times
  averageProcessingTime: number;
  medianProcessingTime: number;
  p95ProcessingTime: number;
  
  // Cache performance
  cacheHitRate: number;
  cacheSize: number;
  
  // Query analysis
  totalQueries: number;
  queriesPerMinute: number;
  
  // Component breakdown
  parseTime: number;
  intentTime: number;
  parameterTime: number;
  
  // Optimization insights
  slowQueries: Array<{
    query: string;
    processingTime: number;
    timestamp: number;
  }>;
  
  // Intent distribution
  intentDistribution: Record<string, number>;
  
  // Performance trends
  trends: {
    processingTimeImproving: boolean;
    cacheEfficiencyImproving: boolean;
    queryComplexityIncreasing: boolean;
  };
}

interface UseOptimizedQueryPerformanceReturn {
  metrics: QueryPerformanceMetrics;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshMetrics: () => void;
  clearCaches: () => void;
  exportMetrics: () => string;
  
  // Real-time monitoring
  startMonitoring: () => void;
  stopMonitoring: () => void;
  isMonitoring: boolean;
  
  // Performance alerts
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
  }>;
  
  dismissAlert: (index: number) => void;
}

export function useOptimizedQueryPerformance(): UseOptimizedQueryPerformanceReturn {
  const [metrics, setMetrics] = useState<QueryPerformanceMetrics>({
    averageProcessingTime: 0,
    medianProcessingTime: 0,
    p95ProcessingTime: 0,
    cacheHitRate: 0,
    cacheSize: 0,
    totalQueries: 0,
    queriesPerMinute: 0,
    parseTime: 0,
    intentTime: 0,
    parameterTime: 0,
    slowQueries: [],
    intentDistribution: {},
    trends: {
      processingTimeImproving: false,
      cacheEfficiencyImproving: false,
      queryComplexityIncreasing: false
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
  }>>([]);

  const monitoringInterval = useRef<NodeJS.Timeout | null>(null);
  const performanceHistory = useRef<Array<{
    timestamp: number;
    processingTime: number;
    cacheHit: boolean;
    queryLength: number;
  }>>([]);

  /**
   * Collect performance metrics from all optimized components
   */
  const collectMetrics = useCallback(async (): Promise<QueryPerformanceMetrics> => {
    try {
      // Get cache statistics
      const cacheStats = optimizedQueryProcessor.getCacheStats();
      const normalizationStats = getNormalizationStats();
      const intentStats = getIntentDetectionStats();

      // Calculate processing time statistics
      const history = performanceHistory.current;
      const processingTimes = history.map(h => h.processingTime);
      
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      const sortedTimes = [...processingTimes].sort((a, b) => a - b);
      const medianProcessingTime = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;

      const p95ProcessingTime = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
        : 0;

      // Calculate queries per minute
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentQueries = history.filter(h => h.timestamp > oneMinuteAgo);
      const queriesPerMinute = recentQueries.length;

      // Identify slow queries (> 100ms)
      const slowQueries = history
        .filter(h => h.processingTime > 100)
        .slice(-10) // Last 10 slow queries
        .map(h => ({
          query: 'Query details not stored for privacy',
          processingTime: h.processingTime,
          timestamp: h.timestamp
        }));

      // Calculate trends
      const trends = calculateTrends(history);

      return {
        averageProcessingTime,
        medianProcessingTime,
        p95ProcessingTime,
        cacheHitRate: cacheStats.hitRate,
        cacheSize: cacheStats.size,
        totalQueries: cacheStats.totalRequests,
        queriesPerMinute,
        parseTime: averageProcessingTime * 0.4, // Estimated breakdown
        intentTime: averageProcessingTime * 0.2,
        parameterTime: averageProcessingTime * 0.4,
        slowQueries,
        intentDistribution: intentStats.intentDistribution,
        trends
      };
    } catch (err) {
      console.error('Error collecting performance metrics:', err);
      throw err;
    }
  }, []);

  /**
   * Calculate performance trends
   */
  const calculateTrends = useCallback((history: typeof performanceHistory.current) => {
    if (history.length < 20) {
      return {
        processingTimeImproving: false,
        cacheEfficiencyImproving: false,
        queryComplexityIncreasing: false
      };
    }

    const midPoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midPoint);
    const secondHalf = history.slice(midPoint);

    const firstHalfAvgTime = firstHalf.reduce((sum, h) => sum + h.processingTime, 0) / firstHalf.length;
    const secondHalfAvgTime = secondHalf.reduce((sum, h) => sum + h.processingTime, 0) / secondHalf.length;

    const firstHalfCacheRate = firstHalf.filter(h => h.cacheHit).length / firstHalf.length;
    const secondHalfCacheRate = secondHalf.filter(h => h.cacheHit).length / secondHalf.length;

    const firstHalfAvgLength = firstHalf.reduce((sum, h) => sum + h.queryLength, 0) / firstHalf.length;
    const secondHalfAvgLength = secondHalf.reduce((sum, h) => sum + h.queryLength, 0) / secondHalf.length;

    return {
      processingTimeImproving: secondHalfAvgTime < firstHalfAvgTime,
      cacheEfficiencyImproving: secondHalfCacheRate > firstHalfCacheRate,
      queryComplexityIncreasing: secondHalfAvgLength > firstHalfAvgLength
    };
  }, []);

  /**
   * Refresh metrics
   */
  const refreshMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newMetrics = await collectMetrics();
      setMetrics(newMetrics);

      // Check for performance alerts
      checkPerformanceAlerts(newMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect metrics');
    } finally {
      setIsLoading(false);
    }
  }, [collectMetrics]);

  /**
   * Check for performance alerts
   */
  const checkPerformanceAlerts = useCallback((metrics: QueryPerformanceMetrics) => {
    const newAlerts: typeof alerts = [];

    // Slow processing time alert
    if (metrics.averageProcessingTime > 100) {
      newAlerts.push({
        type: 'warning',
        message: `Average processing time is high: ${metrics.averageProcessingTime.toFixed(2)}ms`,
        timestamp: Date.now()
      });
    }

    // Low cache hit rate alert
    if (metrics.cacheHitRate < 60) {
      newAlerts.push({
        type: 'warning',
        message: `Cache hit rate is low: ${metrics.cacheHitRate.toFixed(1)}%`,
        timestamp: Date.now()
      });
    }

    // High query volume alert
    if (metrics.queriesPerMinute > 30) {
      newAlerts.push({
        type: 'info',
        message: `High query volume: ${metrics.queriesPerMinute} queries/minute`,
        timestamp: Date.now()
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts].slice(-10)); // Keep last 10 alerts
    }
  }, []);

  /**
   * Record query performance data
   */
  const recordQueryPerformance = useCallback((
    processingTime: number,
    cacheHit: boolean,
    queryLength: number
  ) => {
    performanceHistory.current.push({
      timestamp: Date.now(),
      processingTime,
      cacheHit,
      queryLength
    });

    // Keep only last 1000 entries
    if (performanceHistory.current.length > 1000) {
      performanceHistory.current = performanceHistory.current.slice(-1000);
    }
  }, []);

  /**
   * Start real-time monitoring
   */
  const startMonitoring = useCallback(() => {
    if (monitoringInterval.current) return;

    setIsMonitoring(true);
    monitoringInterval.current = setInterval(() => {
      refreshMetrics();
    }, 5000); // Refresh every 5 seconds
  }, [refreshMetrics]);

  /**
   * Stop real-time monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (monitoringInterval.current) {
      clearInterval(monitoringInterval.current);
      monitoringInterval.current = null;
    }
    setIsMonitoring(false);
  }, []);

  /**
   * Clear all caches
   */
  const clearCaches = useCallback(() => {
    optimizedQueryProcessor.clearCache();
    performanceHistory.current = [];
    setAlerts([]);
    refreshMetrics();
  }, [refreshMetrics]);

  /**
   * Export metrics as JSON
   */
  const exportMetrics = useCallback(() => {
    const exportData = {
      metrics,
      performanceHistory: performanceHistory.current,
      alerts,
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(exportData, null, 2);
  }, [metrics, alerts]);

  /**
   * Dismiss alert
   */
  const dismissAlert = useCallback((index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Initial metrics load
  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // Expose recordQueryPerformance globally for integration
  useEffect(() => {
    (window as any).recordQueryPerformance = recordQueryPerformance;
    return () => {
      delete (window as any).recordQueryPerformance;
    };
  }, [recordQueryPerformance]);

  return {
    metrics,
    isLoading,
    error,
    refreshMetrics,
    clearCaches,
    exportMetrics,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    alerts,
    dismissAlert
  };
}
