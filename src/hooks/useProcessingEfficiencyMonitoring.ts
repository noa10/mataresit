/**
 * Processing Efficiency Monitoring Hook
 * Phase 3: Batch Upload Optimization - Priority 3.2.3
 * 
 * Provides comprehensive processing efficiency monitoring with:
 * - Throughput rates and processing speed analytics
 * - Success rates and error analysis
 * - Processing time analytics and optimization insights
 * - Performance trend tracking and recommendations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProgressMetrics, FileProgressDetail } from '@/lib/progress-tracking';

interface ProcessingEfficiencyData {
  // Throughput metrics
  currentThroughput: number; // files per minute
  peakThroughput: number;
  averageThroughput: number;
  throughputTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Success and error metrics
  successRate: number; // 0-1
  errorRate: number; // 0-1
  retryRate: number; // 0-1
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalRetries: number;
  
  // Processing time analytics
  averageProcessingTime: number; // milliseconds
  medianProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  processingTimeVariance: number;
  
  // API efficiency metrics
  apiCallsPerFile: number;
  tokensPerFile: number;
  costPerFile: number;
  apiEfficiency: number; // tokens per API call
  
  // Quality metrics
  qualityScore: number; // 0-1
  qualityTrend: 'improving' | 'declining' | 'stable';
  
  // Historical data
  throughputHistory?: { timestamp: Date; throughput: number }[];
  processingTimeHistory?: { timestamp: Date; processingTime: number }[];
  
  // Session info
  sessionDuration: number; // milliseconds
  estimatedTimeRemaining?: number;
}

interface ProcessingEfficiencyConfig {
  updateInterval?: number; // milliseconds
  enableHistoricalTracking?: boolean;
  historicalDataPoints?: number;
  enableTrendAnalysis?: boolean;
}

interface UseProcessingEfficiencyMonitoringReturn {
  // Current data
  efficiencyData: ProcessingEfficiencyData | null;
  
  // State flags
  isMonitoring: boolean;
  lastUpdated: Date | null;
  
  // Control functions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  updateMetrics: (metrics: ProgressMetrics, fileDetails: Record<string, FileProgressDetail>) => void;
  
  // Analytics
  getOptimizationRecommendations: () => string[];
  getPerformanceGrade: () => { grade: string; score: number };
  
  // Configuration
  updateConfig: (config: Partial<ProcessingEfficiencyConfig>) => void;
}

const DEFAULT_CONFIG: ProcessingEfficiencyConfig = {
  updateInterval: 5000, // 5 seconds
  enableHistoricalTracking: true,
  historicalDataPoints: 100,
  enableTrendAnalysis: true
};

export function useProcessingEfficiencyMonitoring(
  initialConfig: Partial<ProcessingEfficiencyConfig> = {}
): UseProcessingEfficiencyMonitoringReturn {
  const [config, setConfig] = useState<ProcessingEfficiencyConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  
  const [efficiencyData, setEfficiencyData] = useState<ProcessingEfficiencyData | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Historical data storage
  const [throughputHistory, setThroughputHistory] = useState<{ timestamp: Date; throughput: number }[]>([]);
  const [processingTimeHistory, setProcessingTimeHistory] = useState<{ timestamp: Date; processingTime: number }[]>([]);
  const [previousMetrics, setPreviousMetrics] = useState<ProcessingEfficiencyData | null>(null);

  // Calculate processing time statistics
  const calculateProcessingTimeStats = useCallback((fileDetails: Record<string, FileProgressDetail>) => {
    const completedFiles = Object.values(fileDetails).filter(f => 
      f.status === 'completed' && f.processingTimeMs && f.processingTimeMs > 0
    );
    
    if (completedFiles.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        variance: 0
      };
    }

    const times = completedFiles.map(f => f.processingTimeMs!).sort((a, b) => a - b);
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const median = times.length % 2 === 0 
      ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
      : times[Math.floor(times.length / 2)];
    const min = times[0];
    const max = times[times.length - 1];
    
    // Calculate variance
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;

    return { average, median, min, max, variance };
  }, []);

  // Calculate throughput trend
  const calculateThroughputTrend = useCallback((currentThroughput: number): 'increasing' | 'decreasing' | 'stable' => {
    if (throughputHistory.length < 3) return 'stable';
    
    const recentHistory = throughputHistory.slice(-5);
    const trend = recentHistory.reduce((acc, point, index) => {
      if (index === 0) return acc;
      const prev = recentHistory[index - 1];
      return acc + (point.throughput - prev.throughput);
    }, 0);

    const threshold = 0.1; // 0.1 files/min threshold
    if (trend > threshold) return 'increasing';
    if (trend < -threshold) return 'decreasing';
    return 'stable';
  }, [throughputHistory]);

  // Calculate quality trend
  const calculateQualityTrend = useCallback((currentQuality: number): 'improving' | 'declining' | 'stable' => {
    if (!previousMetrics) return 'stable';
    
    const diff = currentQuality - previousMetrics.qualityScore;
    const threshold = 0.05; // 5% threshold
    
    if (diff > threshold) return 'improving';
    if (diff < -threshold) return 'declining';
    return 'stable';
  }, [previousMetrics]);

  // Update metrics based on progress data
  const updateMetrics = useCallback((metrics: ProgressMetrics, fileDetails: Record<string, FileProgressDetail>) => {
    const now = new Date();
    
    // Calculate processing time statistics
    const timeStats = calculateProcessingTimeStats(fileDetails);
    
    // Calculate success/error metrics
    const totalProcessed = metrics.filesCompleted + metrics.filesFailed;
    const successRate = totalProcessed > 0 ? metrics.filesCompleted / totalProcessed : 1;
    const errorRate = totalProcessed > 0 ? metrics.filesFailed / totalProcessed : 0;
    
    // Calculate retry rate
    const totalRetries = Object.values(fileDetails).reduce((sum, f) => sum + (f.retryCount || 0), 0);
    const retryRate = totalProcessed > 0 ? totalRetries / totalProcessed : 0;
    
    // Calculate API efficiency metrics
    const apiCallsPerFile = totalProcessed > 0 ? metrics.apiCallsTotal / totalProcessed : 0;
    const tokensPerFile = totalProcessed > 0 ? metrics.totalTokensUsed / totalProcessed : 0;
    const costPerFile = metrics.costPerFile || 0;
    const apiEfficiency = metrics.apiCallsTotal > 0 ? metrics.totalTokensUsed / metrics.apiCallsTotal : 0;
    
    // Calculate session duration
    const sessionDuration = metrics.elapsedTimeMs;
    
    // Calculate throughput trend
    const throughputTrend = calculateThroughputTrend(metrics.currentThroughput);
    
    // Calculate quality trend
    const qualityTrend = calculateQualityTrend(metrics.qualityScore);

    const newEfficiencyData: ProcessingEfficiencyData = {
      // Throughput metrics
      currentThroughput: metrics.currentThroughput,
      peakThroughput: metrics.peakThroughput,
      averageThroughput: throughputHistory.length > 0 
        ? throughputHistory.reduce((sum, h) => sum + h.throughput, 0) / throughputHistory.length
        : metrics.currentThroughput,
      throughputTrend,
      
      // Success and error metrics
      successRate,
      errorRate,
      retryRate,
      totalProcessed,
      totalSuccessful: metrics.filesCompleted,
      totalFailed: metrics.filesFailed,
      totalRetries,
      
      // Processing time analytics
      averageProcessingTime: timeStats.average,
      medianProcessingTime: timeStats.median,
      minProcessingTime: timeStats.min,
      maxProcessingTime: timeStats.max,
      processingTimeVariance: timeStats.variance,
      
      // API efficiency metrics
      apiCallsPerFile,
      tokensPerFile,
      costPerFile,
      apiEfficiency,
      
      // Quality metrics
      qualityScore: metrics.qualityScore,
      qualityTrend,
      
      // Historical data
      throughputHistory: config.enableHistoricalTracking ? [...throughputHistory] : undefined,
      processingTimeHistory: config.enableHistoricalTracking ? [...processingTimeHistory] : undefined,
      
      // Session info
      sessionDuration,
      estimatedTimeRemaining: metrics.estimatedTimeRemainingMs
    };

    // Update historical data if enabled
    if (config.enableHistoricalTracking) {
      // Update throughput history
      setThroughputHistory(prev => {
        const newHistory = [...prev, { timestamp: now, throughput: metrics.currentThroughput }];
        return newHistory.length > config.historicalDataPoints! 
          ? newHistory.slice(-config.historicalDataPoints!) 
          : newHistory;
      });

      // Update processing time history
      if (timeStats.average > 0) {
        setProcessingTimeHistory(prev => {
          const newHistory = [...prev, { timestamp: now, processingTime: timeStats.average }];
          return newHistory.length > config.historicalDataPoints! 
            ? newHistory.slice(-config.historicalDataPoints!) 
            : newHistory;
        });
      }
    }

    setEfficiencyData(newEfficiencyData);
    setPreviousMetrics(efficiencyData);
    setLastUpdated(now);
  }, [calculateProcessingTimeStats, calculateThroughputTrend, calculateQualityTrend, throughputHistory, config, efficiencyData]);

  // Get optimization recommendations
  const getOptimizationRecommendations = useCallback((): string[] => {
    if (!efficiencyData) return [];

    const recommendations: string[] = [];

    // Throughput recommendations
    if (efficiencyData.currentThroughput < 0.5) {
      recommendations.push('Increase concurrent processing to improve throughput');
    }
    if (efficiencyData.throughputTrend === 'decreasing') {
      recommendations.push('Investigate throughput decline - check for rate limiting or resource constraints');
    }

    // Success rate recommendations
    if (efficiencyData.successRate < 0.9) {
      recommendations.push('Improve error handling and retry logic to increase success rate');
    }
    if (efficiencyData.retryRate > 0.2) {
      recommendations.push('Reduce retry rate by addressing common failure causes');
    }

    // Processing time recommendations
    if (efficiencyData.processingTimeVariance > 10000) {
      recommendations.push('Optimize for consistent processing times to improve predictability');
    }
    if (efficiencyData.averageProcessingTime > 60000) {
      recommendations.push('Consider optimizing processing pipeline to reduce average processing time');
    }

    // API efficiency recommendations
    if (efficiencyData.apiEfficiency < 500) {
      recommendations.push('Optimize API usage to increase tokens per API call');
    }
    if (efficiencyData.apiCallsPerFile > 2) {
      recommendations.push('Reduce API calls per file to improve efficiency');
    }

    // Quality recommendations
    if (efficiencyData.qualityScore < 0.8) {
      recommendations.push('Review and improve processing quality metrics');
    }
    if (efficiencyData.qualityTrend === 'declining') {
      recommendations.push('Address declining quality trend before it impacts results');
    }

    return recommendations;
  }, [efficiencyData]);

  // Get performance grade
  const getPerformanceGrade = useCallback((): { grade: string; score: number } => {
    if (!efficiencyData) return { grade: 'N/A', score: 0 };

    let score = 0;

    // Throughput (30% weight)
    const throughputScore = Math.min(100, (efficiencyData.currentThroughput / 2) * 100);
    score += throughputScore * 0.3;

    // Success rate (25% weight)
    score += efficiencyData.successRate * 100 * 0.25;

    // Processing time consistency (20% weight)
    const consistencyScore = Math.max(0, 100 - (efficiencyData.processingTimeVariance / 1000));
    score += consistencyScore * 0.2;

    // API efficiency (15% weight)
    const efficiencyScore = Math.min(100, (efficiencyData.apiEfficiency / 1000) * 100);
    score += efficiencyScore * 0.15;

    // Quality (10% weight)
    score += efficiencyData.qualityScore * 100 * 0.1;

    const finalScore = Math.round(score);
    let grade: string;

    if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 60) grade = 'D';
    else grade = 'F';

    return { grade, score: finalScore };
  }, [efficiencyData]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ProcessingEfficiencyConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    // Current data
    efficiencyData,
    
    // State flags
    isMonitoring,
    lastUpdated,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    updateMetrics,
    
    // Analytics
    getOptimizationRecommendations,
    getPerformanceGrade,
    
    // Configuration
    updateConfig
  };
}
