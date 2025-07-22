/**
 * Batch Session Management Types
 * Phase 3: Batch Upload Optimization
 */

export type BatchSessionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type BatchFileStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'skipped';
export type ProcessingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'adaptive';

export interface BatchSession {
  id: string;
  userId: string;
  teamId?: string;
  sessionName?: string;
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesPending: number;
  maxConcurrent: number;
  rateLimitConfig: Record<string, any>;
  processingStrategy: ProcessingStrategy;
  status: BatchSessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;
  totalProcessingTimeMs: number;
  totalApiCalls: number;
  totalTokensUsed: number;
  rateLimitHits: number;
  avgFileProcessingTimeMs?: number;
  errorMessage?: string;
  lastErrorAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchFile {
  id: string;
  batchSessionId: string;
  receiptId?: string;
  originalFilename: string;
  fileSizeBytes?: number;
  fileType?: string;
  uploadOrder?: number;
  status: BatchFileStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingDurationMs?: number;
  apiCallsMade: number;
  tokensUsed: number;
  rateLimited: boolean;
  retryCount: number;
  errorType?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBatchSessionRequest {
  sessionName?: string;
  files: File[];
  processingStrategy: ProcessingStrategy;
  maxConcurrent?: number;
  rateLimitConfig?: Record<string, any>;
  categoryId?: string;
}

export interface BatchSessionProgress {
  sessionId: string;
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesPending: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  currentThroughput: number; // files per minute
  averageProcessingTime: number; // ms per file
  status: BatchSessionStatus;
}

export interface BatchFileUpdate {
  fileId: string;
  status: BatchFileStatus;
  receiptId?: string;
  processingDurationMs?: number;
  apiCallsMade?: number;
  tokensUsed?: number;
  rateLimited?: boolean;
  errorType?: string;
  errorMessage?: string;
}

export interface BatchSessionMetrics {
  sessionId: string;
  totalProcessingTime: number;
  averageFileTime: number;
  successRate: number;
  errorRate: number;
  rateLimitHitRate: number;
  throughput: number;
  costEstimate: number;
  apiEfficiency: number;
}

export interface BatchSessionFilter {
  userId?: string;
  teamId?: string;
  status?: BatchSessionStatus[];
  processingStrategy?: ProcessingStrategy[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export interface BatchSessionEvent {
  type: 'session_created' | 'session_started' | 'session_paused' | 'session_resumed' | 
        'session_completed' | 'session_failed' | 'file_started' | 'file_completed' | 
        'file_failed' | 'progress_updated';
  sessionId: string;
  fileId?: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface BatchSessionConfig {
  defaultMaxConcurrent: number;
  defaultProcessingStrategy: ProcessingStrategy;
  maxRetryAttempts: number;
  progressUpdateInterval: number; // ms
  sessionTimeoutMs: number;
  enableRealTimeUpdates: boolean;
  enableMetricsCollection: boolean;
}
