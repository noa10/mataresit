/**
 * Progress Tracking React Hooks
 * Phase 3: Batch Upload Optimization
 * 
 * React hooks for integrating enhanced progress tracking with UI components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressTrackingService } from './ProgressTrackingService';
import {
  ProgressMetrics,
  ETACalculation,
  ProgressAlert,
  BatchProgressSummary,
  FileProgressDetail,
  ProgressTrackingOptions,
  ProgressTrackingMode
} from './types';

/**
 * Hook for tracking progress of a batch session
 */
export function useProgressTracking(
  sessionId: string | null,
  options: Partial<ProgressTrackingOptions> = {}
) {
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const [eta, setETA] = useState<ETACalculation | null>(null);
  const [alerts, setAlerts] = useState<ProgressAlert[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  
  const serviceRef = useRef<ProgressTrackingService>();
  const trackerRef = useRef<any>();

  // Initialize service
  useEffect(() => {
    serviceRef.current = ProgressTrackingService.getInstance();
  }, []);

  // Start/stop tracking based on sessionId
  useEffect(() => {
    if (!sessionId || !serviceRef.current) {
      if (trackerRef.current) {
        serviceRef.current.stopTracking(sessionId!);
        trackerRef.current = null;
        setIsTracking(false);
      }
      return;
    }

    const trackingOptions: ProgressTrackingOptions = {
      mode: options.mode || 'enhanced',
      config: options.config || {},
      callbacks: {
        onProgressUpdate: (newMetrics: ProgressMetrics) => {
          setMetrics(newMetrics);
          if (options.callbacks?.onProgressUpdate) {
            options.callbacks.onProgressUpdate(newMetrics);
          }
        },
        onETAUpdate: (newETA: ETACalculation) => {
          setETA(newETA);
          if (options.callbacks?.onETAUpdate) {
            options.callbacks.onETAUpdate(newETA);
          }
        },
        onPerformanceAlert: (alert: ProgressAlert) => {
          setAlerts(prev => [...prev, alert]);
          if (options.callbacks?.onPerformanceAlert) {
            options.callbacks.onPerformanceAlert(alert);
          }
        },
        ...options.callbacks
      },
      enablePersistence: options.enablePersistence ?? true,
      enableAnalytics: options.enableAnalytics ?? true
    };

    trackerRef.current = serviceRef.current.startTracking(sessionId, trackingOptions);
    setIsTracking(true);

    return () => {
      if (serviceRef.current && sessionId) {
        serviceRef.current.stopTracking(sessionId);
        setIsTracking(false);
      }
    };
  }, [sessionId]);

  const updateFileProgress = useCallback((fileId: string, update: Partial<FileProgressDetail>) => {
    if (sessionId && serviceRef.current) {
      serviceRef.current.updateFileProgress(sessionId, fileId, update);
    }
  }, [sessionId]);

  const recordRateLimitEvent = useCallback((delayMs: number) => {
    if (sessionId && serviceRef.current) {
      serviceRef.current.recordRateLimitEvent(sessionId, delayMs);
    }
  }, [sessionId]);

  const getProgressSummary = useCallback((): BatchProgressSummary | null => {
    if (sessionId && serviceRef.current) {
      return serviceRef.current.getProgressSummary(sessionId);
    }
    return null;
  }, [sessionId]);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  return {
    metrics,
    eta,
    alerts,
    isTracking,
    updateFileProgress,
    recordRateLimitEvent,
    getProgressSummary,
    dismissAlert
  };
}

/**
 * Hook for real-time progress updates across multiple sessions
 */
export function useMultiSessionProgress(sessionIds: string[]) {
  const [progressData, setProgressData] = useState<Record<string, ProgressMetrics>>({});
  const [etaData, setETAData] = useState<Record<string, ETACalculation>>({});
  const serviceRef = useRef<ProgressTrackingService>();

  useEffect(() => {
    serviceRef.current = ProgressTrackingService.getInstance();
  }, []);

  useEffect(() => {
    if (!serviceRef.current || sessionIds.length === 0) return;

    const updateInterval = setInterval(() => {
      const newProgressData: Record<string, ProgressMetrics> = {};
      const newETAData: Record<string, ETACalculation> = {};

      sessionIds.forEach(sessionId => {
        const metrics = serviceRef.current!.getCurrentMetrics(sessionId);
        const eta = serviceRef.current!.getETACalculation(sessionId);
        
        if (metrics) newProgressData[sessionId] = metrics;
        if (eta) newETAData[sessionId] = eta;
      });

      setProgressData(newProgressData);
      setETAData(newETAData);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(updateInterval);
  }, [sessionIds]);

  return {
    progressData,
    etaData,
    totalSessions: sessionIds.length,
    activeSessions: Object.keys(progressData).length
  };
}

/**
 * Hook for progress analytics and insights
 */
export function useProgressAnalytics(sessionId: string | null) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef<ProgressTrackingService>();

  useEffect(() => {
    serviceRef.current = ProgressTrackingService.getInstance();
  }, []);

  const refreshAnalytics = useCallback(async () => {
    if (!sessionId || !serviceRef.current) return;

    setLoading(true);
    try {
      const analyticsData = await serviceRef.current.getSessionAnalytics(sessionId);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching progress analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refreshAnalytics();
  }, [refreshAnalytics]);

  return {
    analytics,
    loading,
    refreshAnalytics
  };
}

/**
 * Hook for ETA accuracy tracking and improvement
 */
export function useETAAccuracy(sessionId: string | null) {
  const [etaHistory, setETAHistory] = useState<Array<{
    timestamp: Date;
    eta: ETACalculation;
    actualCompletion?: Date;
    accuracy?: number;
  }>>([]);
  
  const [averageAccuracy, setAverageAccuracy] = useState<number | null>(null);

  const recordETA = useCallback((eta: ETACalculation) => {
    setETAHistory(prev => [...prev, {
      timestamp: new Date(),
      eta
    }]);
  }, []);

  const recordActualCompletion = useCallback((completionTime: Date) => {
    setETAHistory(prev => {
      const updated = [...prev];
      const lastETA = updated[updated.length - 1];
      
      if (lastETA && !lastETA.actualCompletion) {
        const predictedTime = lastETA.eta.estimatedCompletionTime.getTime();
        const actualTime = completionTime.getTime();
        const accuracy = 1 - Math.abs(predictedTime - actualTime) / Math.max(predictedTime, actualTime);
        
        lastETA.actualCompletion = completionTime;
        lastETA.accuracy = Math.max(0, Math.min(1, accuracy));
      }
      
      return updated;
    });
  }, []);

  useEffect(() => {
    const accuracyValues = etaHistory
      .filter(entry => entry.accuracy !== undefined)
      .map(entry => entry.accuracy!);
    
    if (accuracyValues.length > 0) {
      const avg = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
      setAverageAccuracy(avg);
    }
  }, [etaHistory]);

  return {
    etaHistory,
    averageAccuracy,
    recordETA,
    recordActualCompletion,
    totalPredictions: etaHistory.length,
    accuratePredictions: etaHistory.filter(e => e.accuracy && e.accuracy > 0.8).length
  };
}

/**
 * Hook for performance monitoring and alerts
 */
export function usePerformanceMonitoring(sessionId: string | null) {
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    throughputTrend: 'increasing' | 'decreasing' | 'stable';
    qualityScore: number;
    rateLimitFrequency: number;
    errorRate: number;
    efficiency: number;
  } | null>(null);

  const [recommendations, setRecommendations] = useState<string[]>([]);
  const serviceRef = useRef<ProgressTrackingService>();

  useEffect(() => {
    serviceRef.current = ProgressTrackingService.getInstance();
  }, []);

  useEffect(() => {
    if (!sessionId || !serviceRef.current) return;

    const updateInterval = setInterval(() => {
      const metrics = serviceRef.current!.getCurrentMetrics(sessionId);
      if (!metrics) return;

      // Calculate throughput trend
      const recentThroughput = metrics.throughputHistory.slice(-5);
      let throughputTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      
      if (recentThroughput.length >= 2) {
        const first = recentThroughput[0].throughput;
        const last = recentThroughput[recentThroughput.length - 1].throughput;
        const change = (last - first) / Math.max(first, 0.1);
        
        if (change > 0.1) throughputTrend = 'increasing';
        else if (change < -0.1) throughputTrend = 'decreasing';
      }

      // Calculate rate limit frequency (per hour)
      const rateLimitFrequency = metrics.elapsedTimeMs > 0 ? 
        (metrics.rateLimitHits / (metrics.elapsedTimeMs / 3600000)) : 0;

      setPerformanceMetrics({
        throughputTrend,
        qualityScore: metrics.qualityScore,
        rateLimitFrequency,
        errorRate: metrics.errorRate,
        efficiency: metrics.apiEfficiency
      });

      // Generate recommendations
      const newRecommendations: string[] = [];
      
      if (metrics.qualityScore < 0.8) {
        newRecommendations.push('Consider switching to a more conservative processing strategy');
      }
      
      if (rateLimitFrequency > 5) {
        newRecommendations.push('High rate limiting detected - reduce concurrent requests');
      }
      
      if (metrics.errorRate > 0.1) {
        newRecommendations.push('High error rate detected - check file quality and network connectivity');
      }
      
      if (throughputTrend === 'decreasing' && metrics.progressPercentage < 50) {
        newRecommendations.push('Processing speed is declining - consider optimizing or pausing');
      }

      setRecommendations(newRecommendations);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  return {
    performanceMetrics,
    recommendations,
    isHealthy: performanceMetrics ? 
      performanceMetrics.qualityScore > 0.8 && 
      performanceMetrics.errorRate < 0.1 && 
      performanceMetrics.rateLimitFrequency < 3 : null
  };
}

/**
 * Utility hook for formatting progress data for display
 */
export function useProgressFormatting() {
  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const formatThroughput = useCallback((throughput: number): string => {
    if (throughput < 1) {
      return `${(throughput * 60).toFixed(1)} files/hour`;
    } else {
      return `${throughput.toFixed(1)} files/min`;
    }
  }, []);

  const formatCost = useCallback((cost: number): string => {
    if (cost < 0.01) {
      return `$${(cost * 1000).toFixed(2)}k`;
    } else {
      return `$${cost.toFixed(4)}`;
    }
  }, []);

  const formatPercentage = useCallback((value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  }, []);

  const getProgressColor = useCallback((percentage: number): string => {
    if (percentage < 25) return '#ef4444'; // red
    if (percentage < 50) return '#f59e0b'; // yellow
    if (percentage < 75) return '#3b82f6'; // blue
    return '#10b981'; // green
  }, []);

  const getQualityColor = useCallback((score: number): string => {
    if (score < 0.6) return '#ef4444'; // red
    if (score < 0.8) return '#f59e0b'; // yellow
    return '#10b981'; // green
  }, []);

  return {
    formatDuration,
    formatThroughput,
    formatCost,
    formatPercentage,
    getProgressColor,
    getQualityColor
  };
}
