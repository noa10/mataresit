/**
 * Enhanced Progress Tracking Library
 * Phase 3: Batch Upload Optimization
 *
 * Exports all progress tracking components and utilities.
 */

// Import classes for local use
import { ProgressTrackingService } from './ProgressTrackingService';

// Core classes
export { ProgressTracker } from './ProgressTracker';
export { ProgressTrackingService } from './ProgressTrackingService';

// React hooks
export {
  useProgressTracking,
  useMultiSessionProgress,
  useProgressAnalytics,
  useETAAccuracy,
  usePerformanceMonitoring,
  useProgressFormatting
} from './hooks';

// Types and interfaces
export type {
  ProgressMetrics,
  ThroughputDataPoint,
  ETACalculation,
  PerformanceSnapshot,
  ProgressEvent,
  ProgressAlert,
  ProgressTrackingConfig,
  FileProgressDetail,
  BatchProgressSummary,
  ProgressTrackingCallbacks,
  ProgressTrackingMode,
  ProgressTrackingOptions
} from './types';

// Utility functions
export const createProgressTrackingService = (config?: {
  enablePersistence?: boolean;
  enableRealTimeUpdates?: boolean;
  enableAnalytics?: boolean;
  updateIntervalMs?: number;
  persistenceIntervalMs?: number;
}) => {
  return ProgressTrackingService.getInstance({
    enablePersistence: config?.enablePersistence ?? true,
    enableRealTimeUpdates: config?.enableRealTimeUpdates ?? true,
    enableAnalytics: config?.enableAnalytics ?? true,
    updateIntervalMs: config?.updateIntervalMs ?? 5000,
    persistenceIntervalMs: config?.persistenceIntervalMs ?? 30000
  });
};

export const calculateProgressPercentage = (
  completed: number,
  failed: number,
  total: number
): number => {
  if (total === 0) return 0;
  return ((completed + failed) / total) * 100;
};

export const calculateThroughput = (
  completedFiles: number,
  elapsedTimeMs: number
): number => {
  if (elapsedTimeMs === 0) return 0;
  const elapsedMinutes = elapsedTimeMs / (1000 * 60);
  return completedFiles / elapsedMinutes;
};

export const estimateRemainingTime = (
  remainingFiles: number,
  currentThroughput: number
): number => {
  if (currentThroughput === 0) return 0;
  const remainingMinutes = remainingFiles / currentThroughput;
  return remainingMinutes * 60 * 1000; // Convert to milliseconds
};

export const calculateQualityScore = (
  successRate: number,
  errorRate: number,
  retryRate: number
): number => {
  // Weighted quality score (0-1)
  const successWeight = 0.5;
  const errorWeight = 0.3;
  const retryWeight = 0.2;
  
  const successScore = successRate;
  const errorScore = Math.max(0, 1 - (errorRate * 2));
  const retryScore = Math.max(0, 1 - (retryRate * 1.5));
  
  return (successScore * successWeight) + (errorScore * errorWeight) + (retryScore * retryWeight);
};

export const formatProgressTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const formatThroughput = (throughputPerMinute: number): string => {
  if (throughputPerMinute < 1) {
    const perHour = throughputPerMinute * 60;
    return `${perHour.toFixed(1)}/hr`;
  } else {
    return `${throughputPerMinute.toFixed(1)}/min`;
  }
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(1)} ${sizes[i]}`;
};

export const formatCurrency = (amount: number): string => {
  if (amount < 0.01) {
    return `$${(amount * 1000).toFixed(2)}k`;
  } else if (amount < 1) {
    return `$${amount.toFixed(4)}`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
};

export const getProgressStatusColor = (
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
): string => {
  const colors = {
    pending: '#6b7280',    // gray
    processing: '#3b82f6', // blue
    completed: '#10b981',  // green
    failed: '#ef4444',     // red
    retrying: '#f59e0b'    // yellow
  };
  return colors[status];
};

export const getQualityScoreColor = (score: number): string => {
  if (score >= 0.9) return '#10b981'; // green
  if (score >= 0.8) return '#84cc16'; // lime
  if (score >= 0.7) return '#eab308'; // yellow
  if (score >= 0.6) return '#f59e0b'; // orange
  return '#ef4444'; // red
};

export const getThroughputTrend = (
  throughputHistory: ThroughputDataPoint[],
  windowSize: number = 5
): 'increasing' | 'decreasing' | 'stable' => {
  if (throughputHistory.length < windowSize) return 'stable';
  
  const recent = throughputHistory.slice(-windowSize);
  const first = recent[0].throughput;
  const last = recent[recent.length - 1].throughput;
  
  const change = (last - first) / Math.max(first, 0.1);
  
  if (change > 0.15) return 'increasing';
  if (change < -0.15) return 'decreasing';
  return 'stable';
};

export const generateProgressInsights = (metrics: ProgressMetrics): string[] => {
  const insights: string[] = [];
  
  // Performance insights
  if (metrics.currentThroughput > metrics.peakThroughput * 0.9) {
    insights.push('Processing at peak efficiency');
  } else if (metrics.currentThroughput < metrics.peakThroughput * 0.5) {
    insights.push('Processing speed has decreased significantly');
  }
  
  // Quality insights
  if (metrics.qualityScore > 0.9) {
    insights.push('Excellent processing quality');
  } else if (metrics.qualityScore < 0.7) {
    insights.push('Processing quality could be improved');
  }
  
  // Cost insights
  if (metrics.apiEfficiency > 1000) {
    insights.push('High API efficiency - good token utilization');
  } else if (metrics.apiEfficiency < 500) {
    insights.push('Low API efficiency - consider optimizing requests');
  }
  
  // Rate limiting insights
  if (metrics.rateLimitHits === 0) {
    insights.push('No rate limiting encountered');
  } else if (metrics.rateLimitHits > 10) {
    insights.push('Frequent rate limiting - consider reducing concurrency');
  }
  
  // Progress insights
  if (metrics.progressPercentage > 75) {
    insights.push('Nearing completion');
  } else if (metrics.progressPercentage < 25 && metrics.elapsedTimeMs > 300000) {
    insights.push('Progress is slower than expected');
  }
  
  return insights;
};

export const validateProgressMetrics = (metrics: ProgressMetrics): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Basic validation
  if (metrics.totalFiles < 0) errors.push('Total files cannot be negative');
  if (metrics.filesCompleted < 0) errors.push('Completed files cannot be negative');
  if (metrics.filesFailed < 0) errors.push('Failed files cannot be negative');
  if (metrics.filesPending < 0) errors.push('Pending files cannot be negative');
  
  // Consistency validation
  const totalProcessed = metrics.filesCompleted + metrics.filesFailed + metrics.filesPending + metrics.filesProcessing;
  if (totalProcessed !== metrics.totalFiles) {
    errors.push('File counts do not add up to total files');
  }
  
  // Range validation
  if (metrics.progressPercentage < 0 || metrics.progressPercentage > 100) {
    errors.push('Progress percentage must be between 0 and 100');
  }
  
  if (metrics.qualityScore < 0 || metrics.qualityScore > 1) {
    errors.push('Quality score must be between 0 and 1');
  }
  
  if (metrics.apiSuccessRate < 0 || metrics.apiSuccessRate > 1) {
    errors.push('API success rate must be between 0 and 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Default configurations for different tracking modes
export const DEFAULT_TRACKING_CONFIGS = {
  minimal: {
    updateIntervalMs: 30000,
    etaUpdateIntervalMs: 60000,
    enableRealTimeUpdates: false,
    enablePerformanceAlerts: false,
    enableETAOptimization: false,
    enableQualityTracking: false
  },
  basic: {
    updateIntervalMs: 10000,
    etaUpdateIntervalMs: 30000,
    enableRealTimeUpdates: true,
    enablePerformanceAlerts: false,
    enableETAOptimization: true,
    enableQualityTracking: false
  },
  enhanced: {
    updateIntervalMs: 5000,
    etaUpdateIntervalMs: 15000,
    enableRealTimeUpdates: true,
    enablePerformanceAlerts: true,
    enableETAOptimization: true,
    enableQualityTracking: true
  },
  comprehensive: {
    updateIntervalMs: 2000,
    etaUpdateIntervalMs: 10000,
    enableRealTimeUpdates: true,
    enablePerformanceAlerts: true,
    enableETAOptimization: true,
    enableQualityTracking: true
  }
};
