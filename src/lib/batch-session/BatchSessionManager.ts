/**
 * Batch Session Manager
 * Phase 3: Batch Upload Optimization
 * 
 * Manages batch upload sessions with comprehensive tracking,
 * progress monitoring, and lifecycle management.
 */

import { supabase } from '../supabase';
import {
  BatchSession,
  BatchFile,
  CreateBatchSessionRequest,
  BatchSessionProgress,
  BatchFileUpdate,
  BatchSessionMetrics,
  BatchSessionFilter,
  BatchSessionEvent,
  BatchSessionConfig,
  BatchSessionStatus,
  ProcessingStrategy
} from './types';

export class BatchSessionManager {
  private static instance: BatchSessionManager;
  private config: BatchSessionConfig;
  private eventListeners: ((event: BatchSessionEvent) => void)[] = [];
  private progressUpdateTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor(config: BatchSessionConfig) {
    this.config = config;
  }

  static getInstance(config?: BatchSessionConfig): BatchSessionManager {
    if (!BatchSessionManager.instance) {
      const defaultConfig: BatchSessionConfig = {
        defaultMaxConcurrent: 2,
        defaultProcessingStrategy: 'balanced',
        maxRetryAttempts: 3,
        progressUpdateInterval: 5000, // 5 seconds
        sessionTimeoutMs: 3600000, // 1 hour
        enableRealTimeUpdates: true,
        enableMetricsCollection: true
      };
      BatchSessionManager.instance = new BatchSessionManager(config || defaultConfig);
    }
    return BatchSessionManager.instance;
  }

  /**
   * Create a new batch upload session
   */
  async createSession(request: CreateBatchSessionRequest): Promise<BatchSession | null> {
    try {
      const sessionData = {
        session_name: request.sessionName,
        total_files: request.files.length,
        max_concurrent: request.maxConcurrent || this.config.defaultMaxConcurrent,
        rate_limit_config: request.rateLimitConfig || {},
        processing_strategy: request.processingStrategy,
        status: 'pending' as BatchSessionStatus
      };

      const { data: session, error } = await supabase
        .from('batch_upload_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;

      // Create batch file records
      const batchFiles = request.files.map((file, index) => ({
        batch_session_id: session.id,
        original_filename: file.name,
        file_size_bytes: file.size,
        file_type: file.type,
        upload_order: index + 1,
        status: 'pending' as const
      }));

      const { error: filesError } = await supabase
        .from('batch_upload_files')
        .insert(batchFiles);

      if (filesError) throw filesError;

      const batchSession = this.mapToBatchSession(session);

      // Emit session created event
      this.emitEvent({
        type: 'session_created',
        sessionId: batchSession.id,
        timestamp: new Date(),
        data: { totalFiles: batchSession.totalFiles, strategy: batchSession.processingStrategy }
      });

      return batchSession;
    } catch (error) {
      console.error('Error creating batch session:', error);
      return null;
    }
  }

  /**
   * Get batch session by ID
   */
  async getSession(sessionId: string): Promise<BatchSession | null> {
    try {
      const { data, error } = await supabase
        .from('batch_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return this.mapToBatchSession(data);
    } catch (error) {
      console.error('Error fetching batch session:', error);
      return null;
    }
  }

  /**
   * Get batch files for a session
   */
  async getSessionFiles(sessionId: string): Promise<BatchFile[]> {
    try {
      const { data, error } = await supabase
        .from('batch_upload_files')
        .select('*')
        .eq('batch_session_id', sessionId)
        .order('upload_order', { ascending: true });

      if (error) throw error;
      return data.map(this.mapToBatchFile);
    } catch (error) {
      console.error('Error fetching batch files:', error);
      return [];
    }
  }

  /**
   * Start processing a batch session
   */
  async startSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('batch_upload_sessions')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Start progress monitoring
      if (this.config.enableRealTimeUpdates) {
        this.startProgressMonitoring(sessionId);
      }

      this.emitEvent({
        type: 'session_started',
        sessionId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error starting batch session:', error);
      return false;
    }
  }

  /**
   * Pause a batch session
   */
  async pauseSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('batch_upload_sessions')
        .update({ status: 'paused' })
        .eq('id', sessionId);

      if (error) throw error;

      // Stop progress monitoring
      this.stopProgressMonitoring(sessionId);

      this.emitEvent({
        type: 'session_paused',
        sessionId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error pausing batch session:', error);
      return false;
    }
  }

  /**
   * Resume a paused batch session
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('batch_upload_sessions')
        .update({ status: 'processing' })
        .eq('id', sessionId);

      if (error) throw error;

      // Restart progress monitoring
      if (this.config.enableRealTimeUpdates) {
        this.startProgressMonitoring(sessionId);
      }

      this.emitEvent({
        type: 'session_resumed',
        sessionId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error resuming batch session:', error);
      return false;
    }
  }

  /**
   * Cancel a batch session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('batch_upload_sessions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Stop progress monitoring
      this.stopProgressMonitoring(sessionId);

      return true;
    } catch (error) {
      console.error('Error cancelling batch session:', error);
      return false;
    }
  }

  /**
   * Update batch file status
   */
  async updateFileStatus(update: BatchFileUpdate): Promise<boolean> {
    try {
      const updateData: any = {
        status: update.status,
        updated_at: new Date().toISOString()
      };

      if (update.receiptId) updateData.receipt_id = update.receiptId;
      if (update.processingDurationMs) updateData.processing_duration_ms = update.processingDurationMs;
      if (update.apiCallsMade) updateData.api_calls_made = update.apiCallsMade;
      if (update.tokensUsed) updateData.tokens_used = update.tokensUsed;
      if (update.rateLimited !== undefined) updateData.rate_limited = update.rateLimited;
      if (update.errorType) updateData.error_type = update.errorType;
      if (update.errorMessage) updateData.error_message = update.errorMessage;

      // Set processing timestamps
      if (update.status === 'processing') {
        updateData.processing_started_at = new Date().toISOString();
      } else if (update.status === 'completed' || update.status === 'failed') {
        updateData.processing_completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('batch_upload_files')
        .update(updateData)
        .eq('id', update.fileId);

      if (error) throw error;

      // Emit file event
      this.emitEvent({
        type: update.status === 'completed' ? 'file_completed' : 
              update.status === 'failed' ? 'file_failed' : 'file_started',
        sessionId: '', // Will be filled by the trigger
        fileId: update.fileId,
        timestamp: new Date(),
        data: update
      });

      return true;
    } catch (error) {
      console.error('Error updating file status:', error);
      return false;
    }
  }

  /**
   * Get session progress
   */
  async getSessionProgress(sessionId: string): Promise<BatchSessionProgress | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      const currentThroughput = this.calculateThroughput(session);
      const estimatedTimeRemaining = this.calculateETA(session, currentThroughput);

      return {
        sessionId: session.id,
        totalFiles: session.totalFiles,
        filesCompleted: session.filesCompleted,
        filesFailed: session.filesFailed,
        filesPending: session.filesPending,
        progressPercentage: (session.filesCompleted + session.filesFailed) / session.totalFiles * 100,
        estimatedTimeRemaining,
        currentThroughput,
        averageProcessingTime: session.avgFileProcessingTimeMs || 0,
        status: session.status
      };
    } catch (error) {
      console.error('Error getting session progress:', error);
      return null;
    }
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(sessionId: string): Promise<BatchSessionMetrics | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      const successRate = session.totalFiles > 0 ? session.filesCompleted / session.totalFiles : 0;
      const errorRate = session.totalFiles > 0 ? session.filesFailed / session.totalFiles : 0;
      const rateLimitHitRate = session.totalApiCalls > 0 ? session.rateLimitHits / session.totalApiCalls : 0;
      const throughput = this.calculateThroughput(session);
      const costEstimate = this.estimateCost(session.totalTokensUsed);
      const apiEfficiency = session.totalApiCalls > 0 ? session.totalTokensUsed / session.totalApiCalls : 0;

      return {
        sessionId: session.id,
        totalProcessingTime: session.totalProcessingTimeMs,
        averageFileTime: session.avgFileProcessingTimeMs || 0,
        successRate,
        errorRate,
        rateLimitHitRate,
        throughput,
        costEstimate,
        apiEfficiency
      };
    } catch (error) {
      console.error('Error getting session metrics:', error);
      return null;
    }
  }

  /**
   * List batch sessions with filtering
   */
  async listSessions(filter: BatchSessionFilter = {}): Promise<BatchSession[]> {
    try {
      let query = supabase
        .from('batch_upload_sessions')
        .select('*');

      if (filter.userId) query = query.eq('user_id', filter.userId);
      if (filter.teamId) query = query.eq('team_id', filter.teamId);
      if (filter.status) query = query.in('status', filter.status);
      if (filter.processingStrategy) query = query.in('processing_strategy', filter.processingStrategy);
      if (filter.dateRange) {
        query = query
          .gte('created_at', filter.dateRange.start.toISOString())
          .lte('created_at', filter.dateRange.end.toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .limit(filter.limit || 50);

      if (filter.offset) query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);

      const { data, error } = await query;
      if (error) throw error;

      return data.map(this.mapToBatchSession);
    } catch (error) {
      console.error('Error listing batch sessions:', error);
      return [];
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: BatchSessionEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: BatchSessionEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private mapToBatchSession(data: any): BatchSession {
    return {
      id: data.id,
      userId: data.user_id,
      teamId: data.team_id,
      sessionName: data.session_name,
      totalFiles: data.total_files,
      filesCompleted: data.files_completed,
      filesFailed: data.files_failed,
      filesPending: data.files_pending,
      maxConcurrent: data.max_concurrent,
      rateLimitConfig: data.rate_limit_config,
      processingStrategy: data.processing_strategy,
      status: data.status,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      estimatedCompletionAt: data.estimated_completion_at ? new Date(data.estimated_completion_at) : undefined,
      totalProcessingTimeMs: data.total_processing_time_ms,
      totalApiCalls: data.total_api_calls,
      totalTokensUsed: data.total_tokens_used,
      rateLimitHits: data.rate_limit_hits,
      avgFileProcessingTimeMs: data.avg_file_processing_time_ms,
      errorMessage: data.error_message,
      lastErrorAt: data.last_error_at ? new Date(data.last_error_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToBatchFile(data: any): BatchFile {
    return {
      id: data.id,
      batchSessionId: data.batch_session_id,
      receiptId: data.receipt_id,
      originalFilename: data.original_filename,
      fileSizeBytes: data.file_size_bytes,
      fileType: data.file_type,
      uploadOrder: data.upload_order,
      status: data.status,
      processingStartedAt: data.processing_started_at ? new Date(data.processing_started_at) : undefined,
      processingCompletedAt: data.processing_completed_at ? new Date(data.processing_completed_at) : undefined,
      processingDurationMs: data.processing_duration_ms,
      apiCallsMade: data.api_calls_made,
      tokensUsed: data.tokens_used,
      rateLimited: data.rate_limited,
      retryCount: data.retry_count,
      errorType: data.error_type,
      errorMessage: data.error_message,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private calculateThroughput(session: BatchSession): number {
    if (!session.startedAt) return 0;
    
    const elapsedMs = Date.now() - session.startedAt.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    
    return elapsedMinutes > 0 ? (session.filesCompleted + session.filesFailed) / elapsedMinutes : 0;
  }

  private calculateETA(session: BatchSession, throughput: number): number | undefined {
    if (throughput <= 0 || session.filesPending <= 0) return undefined;
    
    const remainingMinutes = session.filesPending / throughput;
    return remainingMinutes * 60 * 1000; // Convert to milliseconds
  }

  private estimateCost(totalTokens: number): number {
    // Rough cost estimation for Gemini API (adjust based on actual pricing)
    const costPerToken = 0.00001; // $0.01 per 1000 tokens
    return totalTokens * costPerToken;
  }

  private startProgressMonitoring(sessionId: string): void {
    const timer = setInterval(async () => {
      const progress = await this.getSessionProgress(sessionId);
      if (progress) {
        this.emitEvent({
          type: 'progress_updated',
          sessionId,
          timestamp: new Date(),
          data: progress
        });
      }
    }, this.config.progressUpdateInterval);

    this.progressUpdateTimers.set(sessionId, timer);
  }

  private stopProgressMonitoring(sessionId: string): void {
    const timer = this.progressUpdateTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.progressUpdateTimers.delete(sessionId);
    }
  }

  private emitEvent(event: BatchSessionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in batch session event listener:', error);
      }
    });
  }
}
