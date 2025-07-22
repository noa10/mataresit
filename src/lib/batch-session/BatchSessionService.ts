/**
 * Batch Session Service
 * Phase 3: Batch Upload Optimization
 * 
 * High-level service for batch session operations,
 * integrating with authentication, teams, and rate limiting.
 */

import { BatchSessionManager } from './BatchSessionManager';
import { RateLimitingManager } from '../rate-limiting';
import { supabase } from '../supabase';
import {
  BatchSession,
  BatchFile,
  CreateBatchSessionRequest,
  BatchSessionProgress,
  BatchFileUpdate,
  BatchSessionMetrics,
  ProcessingStrategy
} from './types';

export interface BatchSessionServiceConfig {
  enableRateLimiting: boolean;
  enableRealTimeUpdates: boolean;
  defaultStrategy: ProcessingStrategy;
  maxConcurrentSessions: number;
}

export class BatchSessionService {
  private sessionManager: BatchSessionManager;
  private rateLimitingManager?: RateLimitingManager;
  private config: BatchSessionServiceConfig;
  private activeSessions: Map<string, { rateLimiter?: RateLimitingManager }> = new Map();

  constructor(config: BatchSessionServiceConfig) {
    this.config = config;
    this.sessionManager = BatchSessionManager.getInstance({
      defaultProcessingStrategy: config.defaultStrategy,
      enableRealTimeUpdates: config.enableRealTimeUpdates,
      enableMetricsCollection: true,
      defaultMaxConcurrent: 2,
      maxRetryAttempts: 3,
      progressUpdateInterval: 5000,
      sessionTimeoutMs: 3600000
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Create a new batch session with authentication and team context
   */
  async createBatchSession(
    request: CreateBatchSessionRequest,
    userId: string,
    teamId?: string
  ): Promise<BatchSession | null> {
    try {
      // Check if user can create batch sessions
      const canCreate = await this.checkBatchSessionPermissions(userId, teamId);
      if (!canCreate) {
        throw new Error('Insufficient permissions to create batch session');
      }

      // Check concurrent session limits
      const activeSessions = await this.getActiveSessionsCount(userId, teamId);
      if (activeSessions >= this.config.maxConcurrentSessions) {
        throw new Error(`Maximum concurrent sessions limit (${this.config.maxConcurrentSessions}) reached`);
      }

      // Create session with user/team context
      const sessionRequest = {
        ...request,
        // Add user/team context to the session
      };

      // Set user_id and team_id in the database insert
      const sessionData = {
        user_id: userId,
        team_id: teamId,
        session_name: request.sessionName,
        total_files: request.files.length,
        max_concurrent: request.maxConcurrent || 2,
        rate_limit_config: request.rateLimitConfig || {},
        processing_strategy: request.processingStrategy,
        status: 'pending' as const
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

      // Set up rate limiting for this session if enabled
      if (this.config.enableRateLimiting) {
        const rateLimiter = this.createRateLimiterForSession(batchSession);
        this.activeSessions.set(batchSession.id, { rateLimiter });
      }

      return batchSession;
    } catch (error) {
      console.error('Error creating batch session:', error);
      return null;
    }
  }

  /**
   * Start processing a batch session
   */
  async startBatchSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      // Verify ownership
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      const success = await this.sessionManager.startSession(sessionId);
      
      if (success && this.config.enableRateLimiting) {
        // Ensure rate limiter is set up
        if (!this.activeSessions.has(sessionId)) {
          const rateLimiter = this.createRateLimiterForSession(session);
          this.activeSessions.set(sessionId, { rateLimiter });
        }
      }

      return success;
    } catch (error) {
      console.error('Error starting batch session:', error);
      return false;
    }
  }

  /**
   * Pause a batch session
   */
  async pauseBatchSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      return await this.sessionManager.pauseSession(sessionId);
    } catch (error) {
      console.error('Error pausing batch session:', error);
      return false;
    }
  }

  /**
   * Resume a batch session
   */
  async resumeBatchSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      return await this.sessionManager.resumeSession(sessionId);
    } catch (error) {
      console.error('Error resuming batch session:', error);
      return false;
    }
  }

  /**
   * Cancel a batch session
   */
  async cancelBatchSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      const success = await this.sessionManager.cancelSession(sessionId);
      
      if (success) {
        // Clean up rate limiter
        this.activeSessions.delete(sessionId);
      }

      return success;
    } catch (error) {
      console.error('Error cancelling batch session:', error);
      return false;
    }
  }

  /**
   * Get batch session with access control
   */
  async getBatchSession(sessionId: string, userId: string): Promise<BatchSession | null> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return null; // Access denied
      }
      return session;
    } catch (error) {
      console.error('Error getting batch session:', error);
      return null;
    }
  }

  /**
   * Get session files with access control
   */
  async getSessionFiles(sessionId: string, userId: string): Promise<BatchFile[]> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return []; // Access denied
      }
      return await this.sessionManager.getSessionFiles(sessionId);
    } catch (error) {
      console.error('Error getting session files:', error);
      return [];
    }
  }

  /**
   * Update file status with rate limiting integration
   */
  async updateFileStatus(
    update: BatchFileUpdate,
    userId: string
  ): Promise<boolean> {
    try {
      // Get the session to verify access
      const files = await supabase
        .from('batch_upload_files')
        .select('batch_session_id')
        .eq('id', update.fileId)
        .single();

      if (files.error) throw files.error;

      const session = await this.sessionManager.getSession(files.data.batch_session_id);
      if (!session || session.userId !== userId) {
        throw new Error('Access denied');
      }

      // Update file status
      const success = await this.sessionManager.updateFileStatus(update);

      // Update rate limiter if applicable
      if (success && this.config.enableRateLimiting) {
        const sessionData = this.activeSessions.get(session.id);
        if (sessionData?.rateLimiter) {
          if (update.status === 'completed' && update.tokensUsed) {
            await sessionData.rateLimiter.recordSuccess(
              update.fileId,
              update.tokensUsed,
              update.processingDurationMs
            );
          } else if (update.status === 'failed' && update.errorType) {
            const errorType = update.errorType === 'rate_limited' ? 'rate_limit' : 
                            update.errorType === 'timeout' ? 'timeout' : 'server_error';
            await sessionData.rateLimiter.recordError(update.fileId, errorType);
          }
        }
      }

      return success;
    } catch (error) {
      console.error('Error updating file status:', error);
      return false;
    }
  }

  /**
   * Get session progress with access control
   */
  async getSessionProgress(sessionId: string, userId: string): Promise<BatchSessionProgress | null> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return null;
      }
      return await this.sessionManager.getSessionProgress(sessionId);
    } catch (error) {
      console.error('Error getting session progress:', error);
      return null;
    }
  }

  /**
   * Get session metrics with access control
   */
  async getSessionMetrics(sessionId: string, userId: string): Promise<BatchSessionMetrics | null> {
    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return null;
      }
      return await this.sessionManager.getSessionMetrics(sessionId);
    } catch (error) {
      console.error('Error getting session metrics:', error);
      return null;
    }
  }

  /**
   * List user's batch sessions
   */
  async listUserSessions(
    userId: string,
    teamId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<BatchSession[]> {
    return await this.sessionManager.listSessions({
      userId,
      teamId,
      limit,
      offset
    });
  }

  /**
   * Get rate limiter for a session
   */
  getRateLimiterForSession(sessionId: string): RateLimitingManager | null {
    const sessionData = this.activeSessions.get(sessionId);
    return sessionData?.rateLimiter || null;
  }

  /**
   * Request permission for API call with rate limiting
   */
  async requestApiPermission(
    sessionId: string,
    fileId: string,
    estimatedTokens: number
  ): Promise<{ allowed: boolean; delayMs: number; requestId: string }> {
    const sessionData = this.activeSessions.get(sessionId);
    if (!sessionData?.rateLimiter) {
      return { allowed: true, delayMs: 0, requestId: fileId };
    }

    return await sessionData.rateLimiter.acquirePermission(fileId, estimatedTokens);
  }

  private async checkBatchSessionPermissions(userId: string, teamId?: string): Promise<boolean> {
    // Check subscription limits and permissions
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (!profile) return false;

      // Check if user can create batch sessions based on subscription
      const tier = profile.subscription_tier;
      if (tier === 'free') {
        // Free tier might have restrictions
        const activeSessions = await this.getActiveSessionsCount(userId, teamId);
        return activeSessions < 1; // Only 1 concurrent session for free tier
      }

      return true; // Pro and Max tiers can create sessions
    } catch (error) {
      console.error('Error checking batch session permissions:', error);
      return false;
    }
  }

  private async getActiveSessionsCount(userId: string, teamId?: string): Promise<number> {
    try {
      let query = supabase
        .from('batch_upload_sessions')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .in('status', ['pending', 'processing', 'paused']);

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { count, error } = await query;
      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  private createRateLimiterForSession(session: BatchSession): RateLimitingManager {
    return new RateLimitingManager({
      apiProvider: 'gemini',
      strategy: session.processingStrategy,
      quotaLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      },
      enablePersistentTracking: true
    });
  }

  private setupEventListeners(): void {
    this.sessionManager.addEventListener((event) => {
      // Handle session events (logging, notifications, etc.)
      console.log('Batch session event:', event);
      
      // Clean up rate limiter when session completes
      if (event.type === 'session_completed' || event.type === 'session_failed') {
        this.activeSessions.delete(event.sessionId);
      }
    });
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
}
