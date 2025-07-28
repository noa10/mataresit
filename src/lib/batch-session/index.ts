/**
 * Batch Session Management Library
 * Phase 3: Batch Upload Optimization
 *
 * Exports all batch session management components.
 */

// Import classes for local use
import { BatchSessionService } from './BatchSessionService';

// Core classes
export { BatchSessionManager } from './BatchSessionManager';
export { BatchSessionService } from './BatchSessionService';

// Types and interfaces
export type {
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
  BatchFileStatus,
  ProcessingStrategy
} from './types';

export type {
  BatchSessionServiceConfig
} from './BatchSessionService';

// Utility functions
export const createBatchSessionService = (config: {
  enableRateLimiting?: boolean;
  enableRealTimeUpdates?: boolean;
  defaultStrategy?: ProcessingStrategy;
  maxConcurrentSessions?: number;
}) => {
  return new BatchSessionService({
    enableRateLimiting: config.enableRateLimiting ?? true,
    enableRealTimeUpdates: config.enableRealTimeUpdates ?? true,
    defaultStrategy: config.defaultStrategy ?? 'balanced',
    maxConcurrentSessions: config.maxConcurrentSessions ?? 3
  });
};

export const getProcessingStrategyConfig = (strategy: ProcessingStrategy) => {
  const configs = {
    conservative: {
      maxConcurrent: 1,
      requestsPerMinute: 30,
      tokensPerMinute: 50000,
      description: 'Slower but more reliable processing'
    },
    balanced: {
      maxConcurrent: 2,
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      description: 'Balanced speed and reliability (recommended)'
    },
    aggressive: {
      maxConcurrent: 4,
      requestsPerMinute: 120,
      tokensPerMinute: 200000,
      description: 'Faster processing with higher risk'
    },
    adaptive: {
      maxConcurrent: 3,
      requestsPerMinute: 90,
      tokensPerMinute: 150000,
      description: 'AI-optimized processing that adapts to performance'
    }
  };
  
  return configs[strategy];
};

export const calculateSessionETA = (
  totalFiles: number,
  completedFiles: number,
  failedFiles: number,
  startTime: Date,
  currentTime: Date = new Date()
): number | null => {
  const processedFiles = completedFiles + failedFiles;
  const remainingFiles = totalFiles - processedFiles;
  
  if (remainingFiles <= 0 || processedFiles <= 0) {
    return null;
  }
  
  const elapsedMs = currentTime.getTime() - startTime.getTime();
  const avgTimePerFile = elapsedMs / processedFiles;
  const estimatedRemainingMs = avgTimePerFile * remainingFiles;
  
  return estimatedRemainingMs;
};

export const formatSessionDuration = (durationMs: number): string => {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const getSessionStatusColor = (status: BatchSessionStatus): string => {
  const colors = {
    pending: '#6B7280', // gray
    processing: '#3B82F6', // blue
    completed: '#10B981', // green
    failed: '#EF4444', // red
    cancelled: '#F59E0B', // yellow
    paused: '#8B5CF6' // purple
  };
  
  return colors[status] || colors.pending;
};

export const getSessionStatusIcon = (status: BatchSessionStatus): string => {
  const icons = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
    paused: '⏸️'
  };
  
  return icons[status] || icons.pending;
};

export const validateBatchSessionRequest = (request: CreateBatchSessionRequest): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (!request.files || request.files.length === 0) {
    errors.push('At least one file is required');
  }
  
  if (request.files && request.files.length > 50) {
    errors.push('Maximum 50 files allowed per batch');
  }
  
  if (request.maxConcurrent && (request.maxConcurrent < 1 || request.maxConcurrent > 10)) {
    errors.push('Max concurrent must be between 1 and 10');
  }
  
  if (request.sessionName && request.sessionName.length > 100) {
    errors.push('Session name must be 100 characters or less');
  }
  
  const validStrategies: ProcessingStrategy[] = ['conservative', 'balanced', 'aggressive', 'adaptive'];
  if (!validStrategies.includes(request.processingStrategy)) {
    errors.push('Invalid processing strategy');
  }
  
  // Validate file types and sizes
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  request.files.forEach((file, index) => {
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File ${index + 1} (${file.name}): Invalid file type. Only JPEG, PNG, and PDF are allowed.`);
    }
    
    if (file.size > maxFileSize) {
      errors.push(`File ${index + 1} (${file.name}): File size exceeds 5MB limit.`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

export const estimateBatchProcessingTime = (
  fileCount: number,
  strategy: ProcessingStrategy,
  avgFileSizeBytes: number = 1024 * 1024 // 1MB default
): {
  estimatedMinutes: number;
  estimatedCost: number;
  tokensEstimate: number;
} => {
  const strategyConfig = getProcessingStrategyConfig(strategy);
  
  // Estimate processing time based on strategy and file count
  const baseTimePerFileMs = 30000; // 30 seconds base time per file
  const strategyMultiplier = {
    conservative: 1.5,
    balanced: 1.0,
    aggressive: 0.7,
    adaptive: 0.9
  }[strategy];
  
  const concurrencyFactor = 1 / strategyConfig.maxConcurrent;
  const estimatedTotalMs = fileCount * baseTimePerFileMs * strategyMultiplier * concurrencyFactor;
  const estimatedMinutes = Math.ceil(estimatedTotalMs / (1000 * 60));
  
  // Estimate tokens based on file size (rough approximation)
  const tokensPerMB = 1000; // Rough estimate for image processing
  const avgFileSizeMB = avgFileSizeBytes / (1024 * 1024);
  const tokensEstimate = Math.ceil(fileCount * avgFileSizeMB * tokensPerMB);
  
  // Estimate cost (rough approximation for Gemini API)
  const costPerToken = 0.00001; // $0.01 per 1000 tokens
  const estimatedCost = tokensEstimate * costPerToken;
  
  return {
    estimatedMinutes,
    estimatedCost,
    tokensEstimate
  };
};
