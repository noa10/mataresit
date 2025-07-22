/**
 * Enhanced Progress Tracking Types
 * Phase 3: Batch Upload Optimization
 */

export interface ProgressMetrics {
  // Basic progress
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesPending: number;
  filesProcessing: number;
  progressPercentage: number;

  // Time tracking
  startTime: Date;
  currentTime: Date;
  elapsedTimeMs: number;
  estimatedTimeRemainingMs?: number;
  estimatedCompletionTime?: Date;

  // Performance metrics
  averageProcessingTimeMs: number;
  currentThroughput: number; // files per minute
  peakThroughput: number;
  throughputHistory: ThroughputDataPoint[];

  // Rate limiting metrics
  rateLimitHits: number;
  rateLimitDelayMs: number;
  apiCallsTotal: number;
  apiCallsSuccessful: number;
  apiCallsFailed: number;
  apiSuccessRate: number;

  // Cost and efficiency
  totalTokensUsed: number;
  estimatedCost: number;
  costPerFile: number;
  tokensPerFile: number;
  apiEfficiency: number; // tokens per API call

  // Quality metrics
  retryCount: number;
  errorRate: number;
  qualityScore: number; // Overall processing quality (0-1)
}

export interface ThroughputDataPoint {
  timestamp: Date;
  throughput: number; // files per minute
  activeFiles: number;
  rateLimited: boolean;
}

export interface ETACalculation {
  estimatedTimeRemainingMs: number;
  estimatedCompletionTime: Date;
  confidence: number; // 0-1, how confident we are in the estimate
  method: 'linear' | 'exponential' | 'adaptive' | 'ml_based';
  factors: {
    currentThroughput: number;
    averageThroughput: number;
    rateLimitingImpact: number;
    complexityFactor: number;
    historicalAccuracy: number;
  };
}

export interface PerformanceSnapshot {
  timestamp: Date;
  sessionId: string;
  metrics: ProgressMetrics;
  etaCalculation: ETACalculation;
  rateLimitStatus: {
    isRateLimited: boolean;
    requestsRemaining: number;
    tokensRemaining: number;
    backoffMs: number;
  };
  systemHealth: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    errorRate: number;
  };
}

export interface ProgressEvent {
  type: 'progress_update' | 'eta_update' | 'throughput_change' | 'rate_limit_change' | 
        'performance_alert' | 'milestone_reached' | 'quality_change';
  sessionId: string;
  timestamp: Date;
  data: any;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export interface ProgressAlert {
  id: string;
  type: 'slow_processing' | 'high_error_rate' | 'rate_limiting' | 'quality_degradation' | 
        'eta_deviation' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  sessionId: string;
  metrics: Partial<ProgressMetrics>;
  recommendations: string[];
  autoResolved: boolean;
}

export interface ProgressTrackingConfig {
  updateIntervalMs: number;
  etaUpdateIntervalMs: number;
  throughputWindowMs: number;
  alertThresholds: {
    slowProcessingMs: number;
    highErrorRate: number;
    lowThroughput: number;
    etaDeviationPercent: number;
    qualityScoreThreshold: number;
  };
  enableRealTimeUpdates: boolean;
  enablePerformanceAlerts: boolean;
  enableETAOptimization: boolean;
  enableQualityTracking: boolean;
}

export interface FileProgressDetail {
  fileId: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  startTime?: Date;
  endTime?: Date;
  processingTimeMs?: number;
  progress: number; // 0-100
  stage: 'uploading' | 'processing' | 'embedding' | 'storing' | 'completed';
  stageProgress: number; // 0-100 for current stage
  
  // Performance data
  apiCalls: number;
  tokensUsed: number;
  retryCount: number;
  rateLimited: boolean;
  
  // Quality data
  qualityScore?: number;
  errorMessage?: string;
  warningMessages: string[];
}

export interface BatchProgressSummary {
  sessionId: string;
  sessionName?: string;
  overallProgress: ProgressMetrics;
  etaCalculation: ETACalculation;
  fileDetails: FileProgressDetail[];
  alerts: ProgressAlert[];
  performanceHistory: PerformanceSnapshot[];
  lastUpdated: Date;
}

export interface ProgressTrackingCallbacks {
  onProgressUpdate?: (metrics: ProgressMetrics) => void;
  onETAUpdate?: (eta: ETACalculation) => void;
  onPerformanceAlert?: (alert: ProgressAlert) => void;
  onMilestoneReached?: (milestone: string, metrics: ProgressMetrics) => void;
  onQualityChange?: (qualityScore: number, previousScore: number) => void;
  onThroughputChange?: (throughput: number, trend: 'increasing' | 'decreasing' | 'stable') => void;
}

export type ProgressTrackingMode = 'basic' | 'enhanced' | 'comprehensive' | 'minimal';

export interface ProgressTrackingOptions {
  mode: ProgressTrackingMode;
  config: Partial<ProgressTrackingConfig>;
  callbacks: ProgressTrackingCallbacks;
  enablePersistence: boolean;
  enableAnalytics: boolean;
}
