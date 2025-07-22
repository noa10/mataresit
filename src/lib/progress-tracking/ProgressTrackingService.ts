/**
 * Progress Tracking Service
 * Phase 3: Batch Upload Optimization
 * 
 * Integrates enhanced progress tracking with batch session management
 * and provides real-time updates and analytics.
 */

import { ProgressTracker } from './ProgressTracker';
import { BatchSessionService } from '../batch-session';
import { supabase } from '../supabase';
import {
  ProgressMetrics,
  ETACalculation,
  ProgressAlert,
  BatchProgressSummary,
  ProgressTrackingOptions,
  ProgressTrackingCallbacks,
  FileProgressDetail,
  PerformanceSnapshot
} from './types';

export interface ProgressTrackingServiceConfig {
  enablePersistence: boolean;
  enableRealTimeUpdates: boolean;
  enableAnalytics: boolean;
  updateIntervalMs: number;
  persistenceIntervalMs: number;
}

export class ProgressTrackingService {
  private static instance: ProgressTrackingService;
  private trackers: Map<string, ProgressTracker> = new Map();
  private batchSessionService?: BatchSessionService;
  private config: ProgressTrackingServiceConfig;
  private persistenceTimer?: NodeJS.Timeout;
  private eventListeners: ((event: any) => void)[] = [];

  private constructor(config: ProgressTrackingServiceConfig) {
    this.config = config;
    
    if (config.enablePersistence) {
      this.startPersistenceTimer();
    }
  }

  static getInstance(config?: ProgressTrackingServiceConfig): ProgressTrackingService {
    if (!ProgressTrackingService.instance) {
      const defaultConfig: ProgressTrackingServiceConfig = {
        enablePersistence: true,
        enableRealTimeUpdates: true,
        enableAnalytics: true,
        updateIntervalMs: 5000,
        persistenceIntervalMs: 30000
      };
      
      ProgressTrackingService.instance = new ProgressTrackingService(config || defaultConfig);
    }
    return ProgressTrackingService.instance;
  }

  /**
   * Set batch session service for integration
   */
  setBatchSessionService(service: BatchSessionService): void {
    this.batchSessionService = service;
  }

  /**
   * Start tracking progress for a batch session
   */
  startTracking(
    sessionId: string, 
    options: ProgressTrackingOptions
  ): ProgressTracker {
    // Create enhanced callbacks that integrate with batch session service
    const enhancedCallbacks: ProgressTrackingCallbacks = {
      ...options.callbacks,
      onProgressUpdate: (metrics: ProgressMetrics) => {
        // Update batch session in database
        this.updateBatchSessionMetrics(sessionId, metrics);
        
        // Emit real-time event
        this.emitProgressEvent('progress_update', sessionId, metrics);
        
        // Call original callback
        if (options.callbacks.onProgressUpdate) {
          options.callbacks.onProgressUpdate(metrics);
        }
      },
      onETAUpdate: (eta: ETACalculation) => {
        // Update ETA in batch session
        this.updateBatchSessionETA(sessionId, eta);
        
        // Emit real-time event
        this.emitProgressEvent('eta_update', sessionId, eta);
        
        // Call original callback
        if (options.callbacks.onETAUpdate) {
          options.callbacks.onETAUpdate(eta);
        }
      },
      onPerformanceAlert: (alert: ProgressAlert) => {
        // Store alert in database
        this.storePerformanceAlert(alert);
        
        // Emit real-time event
        this.emitProgressEvent('performance_alert', sessionId, alert);
        
        // Call original callback
        if (options.callbacks.onPerformanceAlert) {
          options.callbacks.onPerformanceAlert(alert);
        }
      }
    };

    const tracker = new ProgressTracker(sessionId, {
      ...options,
      callbacks: enhancedCallbacks
    });

    this.trackers.set(sessionId, tracker);
    
    console.log(`📊 Started progress tracking for session ${sessionId}`);
    return tracker;
  }

  /**
   * Stop tracking progress for a session
   */
  stopTracking(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.stopTracking();
      this.trackers.delete(sessionId);
      console.log(`📊 Stopped progress tracking for session ${sessionId}`);
    }
  }

  /**
   * Get progress tracker for a session
   */
  getTracker(sessionId: string): ProgressTracker | undefined {
    return this.trackers.get(sessionId);
  }

  /**
   * Update file progress across all relevant trackers
   */
  updateFileProgress(
    sessionId: string, 
    fileId: string, 
    update: Partial<FileProgressDetail>
  ): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.updateFileProgress(fileId, update);
    }
  }

  /**
   * Record rate limiting event
   */
  recordRateLimitEvent(sessionId: string, delayMs: number): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.recordRateLimitEvent(delayMs);
    }
  }

  /**
   * Get current metrics for a session
   */
  getCurrentMetrics(sessionId: string): ProgressMetrics | null {
    const tracker = this.trackers.get(sessionId);
    return tracker ? tracker.getCurrentMetrics() : null;
  }

  /**
   * Get ETA calculation for a session
   */
  getETACalculation(sessionId: string): ETACalculation | null {
    const tracker = this.trackers.get(sessionId);
    return tracker ? tracker.calculateETA() : null;
  }

  /**
   * Get comprehensive progress summary
   */
  getProgressSummary(sessionId: string): BatchProgressSummary | null {
    const tracker = this.trackers.get(sessionId);
    return tracker ? tracker.getProgressSummary() : null;
  }

  /**
   * Get progress summaries for multiple sessions
   */
  getMultipleProgressSummaries(sessionIds: string[]): BatchProgressSummary[] {
    return sessionIds
      .map(id => this.getProgressSummary(id))
      .filter(summary => summary !== null) as BatchProgressSummary[];
  }

  /**
   * Get analytics data for a session
   */
  async getSessionAnalytics(sessionId: string): Promise<{
    performanceHistory: PerformanceSnapshot[];
    throughputTrends: any[];
    qualityMetrics: any;
    costAnalysis: any;
  } | null> {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) return null;

    const summary = tracker.getProgressSummary();
    const metrics = tracker.getCurrentMetrics();

    return {
      performanceHistory: summary.performanceHistory,
      throughputTrends: this.analyzeThroughputTrends(metrics.throughputHistory),
      qualityMetrics: {
        overallQuality: metrics.qualityScore,
        apiSuccessRate: metrics.apiSuccessRate,
        errorRate: metrics.errorRate,
        retryRate: metrics.retryCount / Math.max(metrics.totalFiles, 1)
      },
      costAnalysis: {
        totalCost: metrics.estimatedCost,
        costPerFile: metrics.costPerFile,
        tokensPerFile: metrics.tokensPerFile,
        apiEfficiency: metrics.apiEfficiency
      }
    };
  }

  /**
   * Add event listener for real-time updates
   */
  addEventListener(listener: (event: any) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: any) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get all active tracking sessions
   */
  getActiveTrackingSessions(): string[] {
    return Array.from(this.trackers.keys());
  }

  /**
   * Clean up completed or stale tracking sessions
   */
  cleanupStaleTrackers(maxAgeMs: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const staleTrackers: string[] = [];

    for (const [sessionId, tracker] of this.trackers) {
      const metrics = tracker.getCurrentMetrics();
      const age = now - metrics.startTime.getTime();
      
      if (age > maxAgeMs && (metrics.progressPercentage >= 100 || metrics.filesPending === 0)) {
        staleTrackers.push(sessionId);
      }
    }

    staleTrackers.forEach(sessionId => {
      this.stopTracking(sessionId);
    });

    if (staleTrackers.length > 0) {
      console.log(`🧹 Cleaned up ${staleTrackers.length} stale progress trackers`);
    }
  }

  private async updateBatchSessionMetrics(sessionId: string, metrics: ProgressMetrics): Promise<void> {
    if (!this.batchSessionService || !this.config.enablePersistence) return;

    try {
      // Update batch session with current metrics
      await supabase
        .from('batch_upload_sessions')
        .update({
          files_completed: metrics.filesCompleted,
          files_failed: metrics.filesFailed,
          files_pending: metrics.filesPending,
          total_processing_time_ms: metrics.elapsedTimeMs,
          total_api_calls: metrics.apiCallsTotal,
          total_tokens_used: metrics.totalTokensUsed,
          rate_limit_hits: metrics.rateLimitHits,
          avg_file_processing_time_ms: metrics.averageProcessingTimeMs,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating batch session metrics:', error);
    }
  }

  private async updateBatchSessionETA(sessionId: string, eta: ETACalculation): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      await supabase
        .from('batch_upload_sessions')
        .update({
          estimated_completion_at: eta.estimatedCompletionTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating batch session ETA:', error);
    }
  }

  private async storePerformanceAlert(alert: ProgressAlert): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      // Store alert in a dedicated table (would need to create this table)
      // For now, just log it
      console.warn('Performance Alert:', alert);
    } catch (error) {
      console.error('Error storing performance alert:', error);
    }
  }

  private emitProgressEvent(type: string, sessionId: string, data: any): void {
    if (!this.config.enableRealTimeUpdates) return;

    const event = {
      type,
      sessionId,
      timestamp: new Date(),
      data
    };

    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in progress event listener:', error);
      }
    });
  }

  private analyzeThroughputTrends(throughputHistory: any[]): any[] {
    if (throughputHistory.length < 2) return [];

    const trends = [];
    for (let i = 1; i < throughputHistory.length; i++) {
      const current = throughputHistory[i];
      const previous = throughputHistory[i - 1];
      
      trends.push({
        timestamp: current.timestamp,
        throughput: current.throughput,
        change: current.throughput - previous.throughput,
        trend: current.throughput > previous.throughput ? 'increasing' : 
               current.throughput < previous.throughput ? 'decreasing' : 'stable'
      });
    }

    return trends;
  }

  private startPersistenceTimer(): void {
    this.persistenceTimer = setInterval(() => {
      // Persist metrics for all active trackers
      for (const [sessionId, tracker] of this.trackers) {
        const metrics = tracker.getCurrentMetrics();
        this.updateBatchSessionMetrics(sessionId, metrics);
      }
    }, this.config.persistenceIntervalMs);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop all trackers
    for (const sessionId of this.trackers.keys()) {
      this.stopTracking(sessionId);
    }

    // Clear persistence timer
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    // Clear event listeners
    this.eventListeners = [];

    console.log('📊 Progress tracking service destroyed');
  }
}
