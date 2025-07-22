/**
 * Enhanced Progress Tracker
 * Phase 3: Batch Upload Optimization
 * 
 * Provides comprehensive progress tracking with ETA calculations,
 * performance metrics, and real-time updates.
 */

import {
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

export class ProgressTracker {
  private sessionId: string;
  private config: ProgressTrackingConfig;
  private callbacks: ProgressTrackingCallbacks;
  private mode: ProgressTrackingMode;

  // Core tracking data
  private startTime: Date;
  private fileDetails: Map<string, FileProgressDetail> = new Map();
  private throughputHistory: ThroughputDataPoint[] = [];
  private performanceHistory: PerformanceSnapshot[] = [];
  private alerts: ProgressAlert[] = [];

  // Metrics tracking
  private totalApiCalls: number = 0;
  private totalTokensUsed: number = 0;
  private rateLimitHits: number = 0;
  private rateLimitDelayMs: number = 0;

  // Update timers
  private progressUpdateTimer?: NodeJS.Timeout;
  private etaUpdateTimer?: NodeJS.Timeout;
  private throughputUpdateTimer?: NodeJS.Timeout;

  // ETA calculation state
  private lastETACalculation?: ETACalculation;
  private etaAccuracyHistory: number[] = [];

  constructor(sessionId: string, options: ProgressTrackingOptions) {
    this.sessionId = sessionId;
    this.mode = options.mode;
    this.callbacks = options.callbacks;
    this.startTime = new Date();

    // Set default config based on mode
    this.config = this.getDefaultConfig(options.mode);
    
    // Override with provided config
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }

    // Start tracking if real-time updates are enabled
    if (this.config.enableRealTimeUpdates) {
      this.startRealTimeTracking();
    }

    console.log(`📊 Progress tracker initialized for session ${sessionId} in ${options.mode} mode`);
  }

  /**
   * Add or update file progress
   */
  updateFileProgress(fileId: string, update: Partial<FileProgressDetail>): void {
    const existing = this.fileDetails.get(fileId);
    const fileDetail: FileProgressDetail = {
      fileId,
      filename: update.filename || existing?.filename || `file-${fileId}`,
      status: update.status || existing?.status || 'pending',
      progress: update.progress || existing?.progress || 0,
      stage: update.stage || existing?.stage || 'uploading',
      stageProgress: update.stageProgress || existing?.stageProgress || 0,
      apiCalls: update.apiCalls || existing?.apiCalls || 0,
      tokensUsed: update.tokensUsed || existing?.tokensUsed || 0,
      retryCount: update.retryCount || existing?.retryCount || 0,
      rateLimited: update.rateLimited || existing?.rateLimited || false,
      warningMessages: update.warningMessages || existing?.warningMessages || [],
      ...update
    };

    // Set timestamps
    if (update.status === 'processing' && !existing?.startTime) {
      fileDetail.startTime = new Date();
    }
    if ((update.status === 'completed' || update.status === 'failed') && !existing?.endTime) {
      fileDetail.endTime = new Date();
      if (fileDetail.startTime) {
        fileDetail.processingTimeMs = fileDetail.endTime.getTime() - fileDetail.startTime.getTime();
      }
    }

    this.fileDetails.set(fileId, fileDetail);

    // Update global metrics
    if (update.apiCalls) this.totalApiCalls += (update.apiCalls - (existing?.apiCalls || 0));
    if (update.tokensUsed) this.totalTokensUsed += (update.tokensUsed - (existing?.tokensUsed || 0));
    if (update.rateLimited && !existing?.rateLimited) this.rateLimitHits++;

    // Trigger progress update
    this.triggerProgressUpdate();
  }

  /**
   * Record rate limiting event
   */
  recordRateLimitEvent(delayMs: number): void {
    this.rateLimitHits++;
    this.rateLimitDelayMs += delayMs;
    
    // Add throughput data point with rate limiting flag
    this.addThroughputDataPoint(true);
    
    // Check for rate limiting alert
    this.checkRateLimitingAlert();
  }

  /**
   * Get current progress metrics
   */
  getCurrentMetrics(): ProgressMetrics {
    const files = Array.from(this.fileDetails.values());
    const now = new Date();
    const elapsedTimeMs = now.getTime() - this.startTime.getTime();

    // Basic counts
    const totalFiles = files.length;
    const filesCompleted = files.filter(f => f.status === 'completed').length;
    const filesFailed = files.filter(f => f.status === 'failed').length;
    const filesPending = files.filter(f => f.status === 'pending').length;
    const filesProcessing = files.filter(f => f.status === 'processing' || f.status === 'retrying').length;

    // Progress calculation
    const progressPercentage = totalFiles > 0 ? ((filesCompleted + filesFailed) / totalFiles) * 100 : 0;

    // Performance calculations
    const completedFiles = files.filter(f => f.processingTimeMs);
    const averageProcessingTimeMs = completedFiles.length > 0 
      ? completedFiles.reduce((sum, f) => sum + (f.processingTimeMs || 0), 0) / completedFiles.length
      : 0;

    const currentThroughput = this.calculateCurrentThroughput();
    const peakThroughput = Math.max(...this.throughputHistory.map(t => t.throughput), currentThroughput);

    // API metrics
    const apiCallsSuccessful = files.reduce((sum, f) => sum + (f.status === 'completed' ? f.apiCalls : 0), 0);
    const apiCallsFailed = this.totalApiCalls - apiCallsSuccessful;
    const apiSuccessRate = this.totalApiCalls > 0 ? apiCallsSuccessful / this.totalApiCalls : 1;

    // Cost calculations
    const estimatedCost = this.calculateEstimatedCost();
    const costPerFile = totalFiles > 0 ? estimatedCost / totalFiles : 0;
    const tokensPerFile = totalFiles > 0 ? this.totalTokensUsed / totalFiles : 0;
    const apiEfficiency = this.totalApiCalls > 0 ? this.totalTokensUsed / this.totalApiCalls : 0;

    // Quality metrics
    const retryCount = files.reduce((sum, f) => sum + f.retryCount, 0);
    const errorRate = totalFiles > 0 ? filesFailed / totalFiles : 0;
    const qualityScore = this.calculateQualityScore(apiSuccessRate, errorRate, retryCount / totalFiles);

    return {
      totalFiles,
      filesCompleted,
      filesFailed,
      filesPending,
      filesProcessing,
      progressPercentage,
      startTime: this.startTime,
      currentTime: now,
      elapsedTimeMs,
      averageProcessingTimeMs,
      currentThroughput,
      peakThroughput,
      throughputHistory: [...this.throughputHistory],
      rateLimitHits: this.rateLimitHits,
      rateLimitDelayMs: this.rateLimitDelayMs,
      apiCallsTotal: this.totalApiCalls,
      apiCallsSuccessful,
      apiCallsFailed,
      apiSuccessRate,
      totalTokensUsed: this.totalTokensUsed,
      estimatedCost,
      costPerFile,
      tokensPerFile,
      apiEfficiency,
      retryCount,
      errorRate,
      qualityScore
    };
  }

  /**
   * Calculate ETA with multiple methods
   */
  calculateETA(): ETACalculation {
    const metrics = this.getCurrentMetrics();
    const remainingFiles = metrics.filesPending + metrics.filesProcessing;
    
    if (remainingFiles === 0) {
      return {
        estimatedTimeRemainingMs: 0,
        estimatedCompletionTime: new Date(),
        confidence: 1.0,
        method: 'linear',
        factors: {
          currentThroughput: metrics.currentThroughput,
          averageThroughput: metrics.currentThroughput,
          rateLimitingImpact: 0,
          complexityFactor: 1,
          historicalAccuracy: 1
        }
      };
    }

    // Linear method (simple throughput-based)
    const linearETA = this.calculateLinearETA(metrics, remainingFiles);
    
    // Exponential method (considers acceleration/deceleration)
    const exponentialETA = this.calculateExponentialETA(metrics, remainingFiles);
    
    // Adaptive method (considers rate limiting and complexity)
    const adaptiveETA = this.calculateAdaptiveETA(metrics, remainingFiles);

    // Choose best method based on confidence and historical accuracy
    const bestETA = this.selectBestETA([linearETA, exponentialETA, adaptiveETA]);
    
    this.lastETACalculation = bestETA;
    return bestETA;
  }

  /**
   * Get comprehensive progress summary
   */
  getProgressSummary(): BatchProgressSummary {
    const metrics = this.getCurrentMetrics();
    const eta = this.calculateETA();
    
    return {
      sessionId: this.sessionId,
      overallProgress: metrics,
      etaCalculation: eta,
      fileDetails: Array.from(this.fileDetails.values()),
      alerts: [...this.alerts],
      performanceHistory: [...this.performanceHistory],
      lastUpdated: new Date()
    };
  }

  /**
   * Start real-time tracking
   */
  private startRealTimeTracking(): void {
    // Progress updates
    this.progressUpdateTimer = setInterval(() => {
      this.triggerProgressUpdate();
    }, this.config.updateIntervalMs);

    // ETA updates
    this.etaUpdateTimer = setInterval(() => {
      this.triggerETAUpdate();
    }, this.config.etaUpdateIntervalMs);

    // Throughput tracking
    this.throughputUpdateTimer = setInterval(() => {
      this.addThroughputDataPoint(false);
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop real-time tracking
   */
  stopTracking(): void {
    if (this.progressUpdateTimer) clearInterval(this.progressUpdateTimer);
    if (this.etaUpdateTimer) clearInterval(this.etaUpdateTimer);
    if (this.throughputUpdateTimer) clearInterval(this.throughputUpdateTimer);
    
    console.log(`📊 Progress tracking stopped for session ${this.sessionId}`);
  }

  private getDefaultConfig(mode: ProgressTrackingMode): ProgressTrackingConfig {
    const configs = {
      minimal: {
        updateIntervalMs: 30000,
        etaUpdateIntervalMs: 60000,
        throughputWindowMs: 300000,
        enableRealTimeUpdates: false,
        enablePerformanceAlerts: false,
        enableETAOptimization: false,
        enableQualityTracking: false
      },
      basic: {
        updateIntervalMs: 10000,
        etaUpdateIntervalMs: 30000,
        throughputWindowMs: 300000,
        enableRealTimeUpdates: true,
        enablePerformanceAlerts: false,
        enableETAOptimization: true,
        enableQualityTracking: false
      },
      enhanced: {
        updateIntervalMs: 5000,
        etaUpdateIntervalMs: 15000,
        throughputWindowMs: 180000,
        enableRealTimeUpdates: true,
        enablePerformanceAlerts: true,
        enableETAOptimization: true,
        enableQualityTracking: true
      },
      comprehensive: {
        updateIntervalMs: 2000,
        etaUpdateIntervalMs: 10000,
        throughputWindowMs: 120000,
        enableRealTimeUpdates: true,
        enablePerformanceAlerts: true,
        enableETAOptimization: true,
        enableQualityTracking: true
      }
    };

    const baseConfig = configs[mode];
    
    return {
      ...baseConfig,
      alertThresholds: {
        slowProcessingMs: 60000,
        highErrorRate: 0.1,
        lowThroughput: 0.5,
        etaDeviationPercent: 50,
        qualityScoreThreshold: 0.8
      }
    };
  }

  private triggerProgressUpdate(): void {
    if (this.callbacks.onProgressUpdate) {
      const metrics = this.getCurrentMetrics();
      this.callbacks.onProgressUpdate(metrics);
    }
  }

  private triggerETAUpdate(): void {
    if (this.callbacks.onETAUpdate) {
      const eta = this.calculateETA();
      this.callbacks.onETAUpdate(eta);
    }
  }

  private calculateCurrentThroughput(): number {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.throughputWindowMs);
    
    const recentCompletions = Array.from(this.fileDetails.values())
      .filter(f => f.endTime && f.endTime >= windowStart)
      .length;
    
    const windowMinutes = this.config.throughputWindowMs / (1000 * 60);
    return recentCompletions / windowMinutes;
  }

  private addThroughputDataPoint(rateLimited: boolean): void {
    const now = new Date();
    const throughput = this.calculateCurrentThroughput();
    const activeFiles = Array.from(this.fileDetails.values())
      .filter(f => f.status === 'processing' || f.status === 'retrying').length;

    this.throughputHistory.push({
      timestamp: now,
      throughput,
      activeFiles,
      rateLimited
    });

    // Keep only recent history
    const cutoff = new Date(now.getTime() - (this.config.throughputWindowMs * 2));
    this.throughputHistory = this.throughputHistory.filter(t => t.timestamp >= cutoff);
  }

  private calculateEstimatedCost(): number {
    // Rough cost estimation for Gemini API
    const costPerToken = 0.00001; // $0.01 per 1000 tokens
    return this.totalTokensUsed * costPerToken;
  }

  private calculateQualityScore(apiSuccessRate: number, errorRate: number, avgRetryRate: number): number {
    // Weighted quality score (0-1)
    const apiWeight = 0.4;
    const errorWeight = 0.4;
    const retryWeight = 0.2;
    
    const apiScore = apiSuccessRate;
    const errorScore = Math.max(0, 1 - (errorRate * 2)); // Penalize errors heavily
    const retryScore = Math.max(0, 1 - (avgRetryRate * 3)); // Penalize retries
    
    return (apiScore * apiWeight) + (errorScore * errorWeight) + (retryScore * retryWeight);
  }

  private calculateLinearETA(metrics: ProgressMetrics, remainingFiles: number): ETACalculation {
    const throughput = Math.max(metrics.currentThroughput, 0.1); // Avoid division by zero
    const estimatedMinutes = remainingFiles / throughput;
    const estimatedTimeRemainingMs = estimatedMinutes * 60 * 1000;
    
    return {
      estimatedTimeRemainingMs,
      estimatedCompletionTime: new Date(Date.now() + estimatedTimeRemainingMs),
      confidence: Math.min(0.9, metrics.filesCompleted / Math.max(metrics.totalFiles * 0.1, 1)),
      method: 'linear',
      factors: {
        currentThroughput: metrics.currentThroughput,
        averageThroughput: metrics.currentThroughput,
        rateLimitingImpact: 0,
        complexityFactor: 1,
        historicalAccuracy: 0.8
      }
    };
  }

  private calculateExponentialETA(metrics: ProgressMetrics, remainingFiles: number): ETACalculation {
    // Consider throughput trend
    const recentThroughput = this.throughputHistory.slice(-5);
    const trend = recentThroughput.length > 1 ? 
      (recentThroughput[recentThroughput.length - 1].throughput - recentThroughput[0].throughput) / recentThroughput.length : 0;
    
    const adjustedThroughput = Math.max(metrics.currentThroughput + (trend * 2), 0.1);
    const estimatedMinutes = remainingFiles / adjustedThroughput;
    const estimatedTimeRemainingMs = estimatedMinutes * 60 * 1000;
    
    return {
      estimatedTimeRemainingMs,
      estimatedCompletionTime: new Date(Date.now() + estimatedTimeRemainingMs),
      confidence: Math.min(0.85, metrics.filesCompleted / Math.max(metrics.totalFiles * 0.2, 1)),
      method: 'exponential',
      factors: {
        currentThroughput: metrics.currentThroughput,
        averageThroughput: adjustedThroughput,
        rateLimitingImpact: trend < 0 ? Math.abs(trend) : 0,
        complexityFactor: 1,
        historicalAccuracy: 0.75
      }
    };
  }

  private calculateAdaptiveETA(metrics: ProgressMetrics, remainingFiles: number): ETACalculation {
    // Consider rate limiting impact
    const rateLimitImpact = metrics.rateLimitHits > 0 ? 
      (metrics.rateLimitDelayMs / metrics.elapsedTimeMs) * 1.5 : 0;
    
    // Consider complexity (retry rate as proxy)
    const complexityFactor = 1 + (metrics.retryCount / Math.max(metrics.totalFiles, 1));
    
    // Adjust throughput for rate limiting and complexity
    const adjustedThroughput = Math.max(
      metrics.currentThroughput * (1 - rateLimitImpact) / complexityFactor, 
      0.05
    );
    
    const estimatedMinutes = remainingFiles / adjustedThroughput;
    const estimatedTimeRemainingMs = estimatedMinutes * 60 * 1000;
    
    return {
      estimatedTimeRemainingMs,
      estimatedCompletionTime: new Date(Date.now() + estimatedTimeRemainingMs),
      confidence: Math.min(0.95, metrics.filesCompleted / Math.max(metrics.totalFiles * 0.3, 1)),
      method: 'adaptive',
      factors: {
        currentThroughput: metrics.currentThroughput,
        averageThroughput: adjustedThroughput,
        rateLimitingImpact: rateLimitImpact,
        complexityFactor: complexityFactor,
        historicalAccuracy: 0.9
      }
    };
  }

  private selectBestETA(etas: ETACalculation[]): ETACalculation {
    // Select ETA with highest confidence, preferring adaptive method
    return etas.reduce((best, current) => {
      if (current.method === 'adaptive' && current.confidence > 0.7) return current;
      return current.confidence > best.confidence ? current : best;
    });
  }

  private checkRateLimitingAlert(): void {
    const metrics = this.getCurrentMetrics();
    
    if (metrics.rateLimitHits > 5 && metrics.elapsedTimeMs > 60000) {
      const rateLimitRate = metrics.rateLimitHits / (metrics.elapsedTimeMs / 60000); // per minute
      
      if (rateLimitRate > 2) { // More than 2 rate limits per minute
        this.createAlert({
          type: 'rate_limiting',
          severity: 'high',
          message: `High rate limiting frequency detected: ${rateLimitRate.toFixed(1)} hits/min`,
          recommendations: [
            'Consider switching to a more conservative processing strategy',
            'Check API quota limits',
            'Review concurrent request settings'
          ]
        });
      }
    }
  }

  private createAlert(alertData: Omit<ProgressAlert, 'id' | 'timestamp' | 'sessionId' | 'autoResolved'>): void {
    const alert: ProgressAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      sessionId: this.sessionId,
      autoResolved: false,
      metrics: this.getCurrentMetrics(),
      ...alertData
    };
    
    this.alerts.push(alert);
    
    if (this.callbacks.onPerformanceAlert) {
      this.callbacks.onPerformanceAlert(alert);
    }
  }
}
