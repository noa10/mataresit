import { useReducer, useRef, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ReceiptUpload, ProcessingStatus, ProcessingLog } from "@/types/receipt";
import { useFileUpload } from "./useFileUpload";
import {
  createReceipt,
  uploadReceiptImage,
  processReceiptWithAI,
  markReceiptUploaded
} from "@/services/receiptService";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImageForUpload } from "@/utils/imageUtils";
import { getBatchProcessingOptimization, ProcessingRecommendation } from "@/utils/processingOptimizer";

import { ReceiptNotificationService } from "@/services/receiptNotificationService";
import { SubscriptionEnforcementService, handleActionResult } from "@/services/subscriptionEnforcementService";

// Phase 3: Batch Upload Optimization - Import new systems
import {
  BatchSessionService,
  createBatchSessionService,
  ProcessingStrategy,
  BatchSession,
  BatchSessionProgress,
  BatchSessionMetrics,
  validateBatchSessionRequest,
  estimateBatchProcessingTime,
  getProcessingStrategyConfig
} from "@/lib/batch-session";
import {
  RateLimitingManager,
  createRateLimitingManager,
  getDefaultQuotaLimits,
  estimateTokensFromImageSize
} from "@/lib/rate-limiting";
import {
  ProgressTrackingService,
  ProgressMetrics,
  ETACalculation,
  ProgressAlert,
  FileProgressDetail,
  createProgressTrackingService
} from "@/lib/progress-tracking";

interface BatchUploadOptions {
  maxConcurrent?: number;
  autoStart?: boolean;
  useEnhancedFallback?: boolean;
  // Phase 3: Enhanced batch upload options
  processingStrategy?: ProcessingStrategy;
  enableRateLimiting?: boolean;
  enableSessionTracking?: boolean;
  sessionName?: string;
  enableRealTimeUpdates?: boolean;
  // Phase 3: Enhanced progress tracking options
  enableProgressTracking?: boolean;
  progressTrackingMode?: 'minimal' | 'basic' | 'enhanced' | 'comprehensive';
  enableETACalculation?: boolean;
  enablePerformanceAlerts?: boolean;
  enableQualityTracking?: boolean;
}

// Progress mapping for granular log-based progress updates (same as single upload)
const LOG_PROGRESS_MAP: Record<string, Record<string, number>> = {
  'START': {
    'Starting upload process': 5,
    'Detected image file': 8,
    'Detected PDF file': 8,
    'Optimizing image': 12,
    'Image optimized': 18,
    'Image optimization failed': 15,
    'PDF file detected': 15
  },
  'FETCH': {
    'Starting file upload': 20,
    'Upload progress: 25%': 25,
    'Upload progress: 50%': 35,
    'Upload progress: 75%': 45,
    'File uploaded successfully': 50
  },
  'SAVE': {
    'Creating receipt record': 55,
    'Receipt record created': 60
  },
  'PROCESSING': {
    'Starting AI processing': 65,
    'Analyzing receipt content': 70,
    'Extracting merchant information': 72,
    'Processing line items': 75,
    'Calculating totals': 78,
    'Finalizing results': 82,
    'Validating extracted data': 85,
    'Saving processed data': 88,
    'Generating confidence scores': 92,
    'Processing completed': 95
  },
  'GEMINI': {
    'Starting AI analysis': 68,
    'Processing with Gemini': 72,
    'Extracting text content': 76,
    'Analyzing receipt structure': 80,
    'Identifying key fields': 84,
    'Processing complete': 88
  },
  'COMPLETE': {
    'Processing complete': 100
  },
  'ERROR': {
    'Processing failed': 100
  }
};

// ============================================================================
// STATE MANAGEMENT WITH REDUCER
// ============================================================================

/**
 * Actions for the batch upload state reducer
 */
type BatchUploadAction =
  | { type: 'ADD_FILES'; files: File[]; recommendations: Record<string, ProcessingRecommendation>; categoryId?: string | null }
  | { type: 'REMOVE_UPLOAD'; uploadId: string }
  | { type: 'CLEAR_PENDING' }
  | { type: 'CLEAR_ALL' }
  | { type: 'START_PROCESSING' }
  | { type: 'PAUSE_PROCESSING' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'UPLOAD_STARTED'; uploadId: string }
  | { type: 'UPLOAD_PROGRESS'; uploadId: string; progress: number; status?: ReceiptUpload['status'] }
  | { type: 'UPLOAD_COMPLETED'; uploadId: string }
  | { type: 'UPLOAD_FAILED'; uploadId: string; error: { code: string; message: string } }
  | { type: 'SET_RECEIPT_ID'; uploadId: string; receiptId: string }
  | { type: 'RETRY_UPLOAD'; uploadId: string }
  | { type: 'SET_PROGRESS_UPDATING'; uploadId: string; isUpdating: boolean }
  // Phase 3: Enhanced batch session actions
  | { type: 'SET_BATCH_SESSION'; session: BatchSession | null }
  | { type: 'UPDATE_SESSION_PROGRESS'; progress: BatchSessionProgress }
  | { type: 'UPDATE_SESSION_METRICS'; metrics: BatchSessionMetrics }
  | { type: 'SET_PROCESSING_STRATEGY'; strategy: ProcessingStrategy }
  | { type: 'UPDATE_RATE_LIMIT_STATUS'; status: BatchUploadState['rateLimitStatus'] }
  // Phase 3: Enhanced progress tracking actions
  | { type: 'UPDATE_PROGRESS_METRICS'; metrics: ProgressMetrics }
  | { type: 'UPDATE_ETA_CALCULATION'; eta: ETACalculation }
  | { type: 'ADD_PROGRESS_ALERT'; alert: ProgressAlert }
  | { type: 'DISMISS_PROGRESS_ALERT'; alertId: string }
  | { type: 'UPDATE_FILE_PROGRESS'; fileId: string; progress: FileProgressDetail };

/**
 * State shape for batch upload management
 */
interface BatchUploadState {
  uploads: ReceiptUpload[];
  isProcessing: boolean;
  isPaused: boolean;
  activeUploads: string[];
  completedUploads: string[];
  failedUploads: string[];
  receiptIds: Record<string, string>;
  processingRecommendations: Record<string, ProcessingRecommendation>;
  progressUpdating: Record<string, boolean>; // Track which uploads are actively updating progress
  batchId: string | null; // Unique identifier for the current batch
  // Phase 3: Enhanced batch session state
  batchSession: BatchSession | null;
  sessionProgress: BatchSessionProgress | null;
  sessionMetrics: BatchSessionMetrics | null;
  processingStrategy: ProcessingStrategy;
  rateLimitStatus: {
    isRateLimited: boolean;
    requestsRemaining: number;
    tokensRemaining: number;
    backoffMs: number;
  } | null;
  // Phase 3: Enhanced progress tracking state
  progressMetrics: ProgressMetrics | null;
  etaCalculation: ETACalculation | null;
  progressAlerts: ProgressAlert[];
  fileProgressDetails: Record<string, FileProgressDetail>;
  progressTrackingEnabled: boolean;
}

/**
 * Initial state for the batch upload reducer
 */
const initialBatchState: BatchUploadState = {
  uploads: [],
  isProcessing: false,
  isPaused: false,
  activeUploads: [],
  completedUploads: [],
  failedUploads: [],
  receiptIds: {},
  processingRecommendations: {},
  progressUpdating: {},
  batchId: null,
  // Phase 3: Enhanced batch session state
  batchSession: null,
  sessionProgress: null,
  sessionMetrics: null,
  processingStrategy: 'balanced',
  rateLimitStatus: null,
  // Phase 3: Enhanced progress tracking state
  progressMetrics: null,
  etaCalculation: null,
  progressAlerts: [],
  fileProgressDetails: {},
  progressTrackingEnabled: false
};

/**
 * Reducer function for managing batch upload state transitions
 */
function batchUploadReducer(state: BatchUploadState, action: BatchUploadAction): BatchUploadState {
  switch (action.type) {
    case 'ADD_FILES': {
      // Create new upload objects using the IDs from recommendations
      const recommendationIds = Object.keys(action.recommendations);
      const newUploads: ReceiptUpload[] = action.files.map((file, index) => ({
        id: recommendationIds[index],
        file,
        status: 'pending',
        uploadProgress: 0,
        categoryId: action.categoryId,
      }));

      // Sort uploads by priority based on recommendations
      const allUploads = [...state.uploads, ...newUploads];
      const sortedUploads = allUploads.sort((a, b) => {
        const aRecommendation = action.recommendations[a.id] || state.processingRecommendations[a.id];
        const bRecommendation = action.recommendations[b.id] || state.processingRecommendations[b.id];

        if (!aRecommendation || !bRecommendation) return 0;

        const aPriority = aRecommendation.riskLevel === 'low' ? 1 :
                        aRecommendation.riskLevel === 'medium' ? 2 : 3;
        const bPriority = bRecommendation.riskLevel === 'low' ? 1 :
                        bRecommendation.riskLevel === 'medium' ? 2 : 3;

        return aPriority - bPriority;
      });

      return {
        ...state,
        uploads: sortedUploads,
        processingRecommendations: {
          ...state.processingRecommendations,
          ...action.recommendations
        },
        // Generate a new batch ID if this is the first batch or if starting a new batch
        batchId: state.batchId || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      };
    }

    case 'REMOVE_UPLOAD': {
      return {
        ...state,
        uploads: state.uploads.filter(upload => upload.id !== action.uploadId),
        activeUploads: state.activeUploads.filter(id => id !== action.uploadId),
        completedUploads: state.completedUploads.filter(id => id !== action.uploadId),
        failedUploads: state.failedUploads.filter(id => id !== action.uploadId),
        receiptIds: Object.fromEntries(
          Object.entries(state.receiptIds).filter(([uploadId]) => uploadId !== action.uploadId)
        ),
        processingRecommendations: Object.fromEntries(
          Object.entries(state.processingRecommendations).filter(([uploadId]) => uploadId !== action.uploadId)
        )
      };
    }

    case 'CLEAR_PENDING': {
      // Only remove pending uploads, keep active/completed/failed
      const uploadsToKeep = state.uploads.filter(upload =>
        upload.status !== 'pending' || state.activeUploads.includes(upload.id)
      );

      return {
        ...state,
        uploads: uploadsToKeep
      };
    }

    case 'CLEAR_ALL': {
      return {
        ...initialBatchState
      };
    }

    case 'START_PROCESSING': {
      return {
        ...state,
        isProcessing: true,
        isPaused: false
      };
    }

    case 'PAUSE_PROCESSING': {
      return {
        ...state,
        isPaused: true
      };
    }

    case 'STOP_PROCESSING': {
      return {
        ...state,
        isProcessing: false,
        isPaused: false
      };
    }

    case 'UPLOAD_STARTED': {
      return {
        ...state,
        activeUploads: state.activeUploads.includes(action.uploadId)
          ? state.activeUploads
          : [...state.activeUploads, action.uploadId],
        uploads: state.uploads.map(upload =>
          upload.id === action.uploadId
            ? { ...upload, status: 'uploading' as const }
            : upload
        )
      };
    }

    case 'UPLOAD_PROGRESS': {
      return {
        ...state,
        uploads: state.uploads.map(upload =>
          upload.id === action.uploadId
            ? {
                ...upload,
                uploadProgress: action.progress,
                status: action.status || upload.status
              }
            : upload
        )
      };
    }

    case 'UPLOAD_COMPLETED': {
      return {
        ...state,
        uploads: state.uploads.map(upload =>
          upload.id === action.uploadId
            ? { ...upload, status: 'completed' as const, uploadProgress: 100 }
            : upload
        ),
        activeUploads: state.activeUploads.filter(id => id !== action.uploadId),
        completedUploads: state.completedUploads.includes(action.uploadId)
          ? state.completedUploads
          : [...state.completedUploads, action.uploadId]
      };
    }

    case 'UPLOAD_FAILED': {
      return {
        ...state,
        uploads: state.uploads.map(upload =>
          upload.id === action.uploadId
            ? { ...upload, status: 'error' as const, uploadProgress: 0, error: action.error }
            : upload
        ),
        activeUploads: state.activeUploads.filter(id => id !== action.uploadId),
        failedUploads: state.failedUploads.includes(action.uploadId)
          ? state.failedUploads
          : [...state.failedUploads, action.uploadId]
      };
    }

    case 'SET_RECEIPT_ID': {
      return {
        ...state,
        receiptIds: {
          ...state.receiptIds,
          [action.uploadId]: action.receiptId
        }
      };
    }

    case 'RETRY_UPLOAD': {
      const uploadToRetry = state.uploads.find(u => u.id === action.uploadId);
      if (!uploadToRetry || uploadToRetry.status !== 'error') {
        return state;
      }

      // Create a new upload with the same file and incremented retry count
      const newUpload: ReceiptUpload = {
        id: crypto.randomUUID(),
        file: uploadToRetry.file,
        status: 'pending',
        uploadProgress: 0,
        retryCount: (uploadToRetry.retryCount || 0) + 1,
        categoryId: uploadToRetry.categoryId // Preserve category
      };

      return {
        ...state,
        uploads: [...state.uploads.filter(u => u.id !== action.uploadId), newUpload],
        failedUploads: state.failedUploads.filter(id => id !== action.uploadId),
        // Copy the processing recommendation to the new upload
        processingRecommendations: {
          ...state.processingRecommendations,
          [newUpload.id]: state.processingRecommendations[action.uploadId]
        }
      };
    }

    case 'SET_PROGRESS_UPDATING': {
      return {
        ...state,
        progressUpdating: {
          ...state.progressUpdating,
          [action.uploadId]: action.isUpdating
        }
      };
    }

    // Phase 3: Enhanced batch session action handlers
    case 'SET_BATCH_SESSION': {
      return {
        ...state,
        batchSession: action.session
      };
    }

    case 'UPDATE_SESSION_PROGRESS': {
      return {
        ...state,
        sessionProgress: action.progress
      };
    }

    case 'UPDATE_SESSION_METRICS': {
      return {
        ...state,
        sessionMetrics: action.metrics
      };
    }

    case 'SET_PROCESSING_STRATEGY': {
      return {
        ...state,
        processingStrategy: action.strategy
      };
    }

    case 'UPDATE_RATE_LIMIT_STATUS': {
      return {
        ...state,
        rateLimitStatus: action.status
      };
    }

    // Phase 3: Enhanced progress tracking action handlers
    case 'UPDATE_PROGRESS_METRICS': {
      return {
        ...state,
        progressMetrics: action.metrics
      };
    }

    case 'UPDATE_ETA_CALCULATION': {
      return {
        ...state,
        etaCalculation: action.eta
      };
    }

    case 'ADD_PROGRESS_ALERT': {
      return {
        ...state,
        progressAlerts: [...state.progressAlerts, action.alert]
      };
    }

    case 'DISMISS_PROGRESS_ALERT': {
      return {
        ...state,
        progressAlerts: state.progressAlerts.filter(alert => alert.id !== action.alertId)
      };
    }

    case 'UPDATE_FILE_PROGRESS': {
      return {
        ...state,
        fileProgressDetails: {
          ...state.fileProgressDetails,
          [action.fileId]: action.progress
        }
      };
    }

    default:
      return state;
  }
}

export function useBatchFileUpload(options: BatchUploadOptions = {}) {
  const {
    maxConcurrent = 2,
    autoStart = false,
    processingStrategy = 'balanced',
    enableRateLimiting = true,
    enableSessionTracking = true,
    sessionName,
    enableRealTimeUpdates = true,
    // Phase 3: Enhanced progress tracking options
    enableProgressTracking = true,
    progressTrackingMode = 'enhanced',
    enableETACalculation = true,
    enablePerformanceAlerts = true,
    enableQualityTracking = true
  } = options;

  // Use the base file upload hook for file selection and validation
  const baseUpload = useFileUpload();

  // Use reducer for complex state management
  const [state, dispatch] = useReducer(batchUploadReducer, {
    ...initialBatchState,
    processingStrategy
  });
  const processingRef = useRef<boolean>(false);

  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { settings } = useSettings();

  // Phase 3: Initialize batch session service and rate limiting
  const [batchSessionService] = useState(() =>
    enableSessionTracking ? createBatchSessionService({
      enableRateLimiting,
      enableRealTimeUpdates,
      defaultStrategy: processingStrategy,
      maxConcurrentSessions: 3
    }) : null
  );

  const [rateLimitingManager] = useState(() =>
    enableRateLimiting ? createRateLimitingManager({
      apiProvider: 'gemini',
      strategy: processingStrategy,
      quotaLimits: getDefaultQuotaLimits('gemini'),
      enablePersistentTracking: true
    }) : null
  );

  // Phase 3: Initialize progress tracking service
  const [progressTrackingService] = useState(() =>
    enableProgressTracking ? createProgressTrackingService({
      enablePersistence: enableSessionTracking,
      enableRealTimeUpdates,
      enableAnalytics: enableQualityTracking,
      updateIntervalMs: progressTrackingMode === 'comprehensive' ? 2000 : 5000,
      persistenceIntervalMs: 30000
    }) : null
  );

  // Destructure state for easier access
  const {
    uploads: batchUploads,
    isProcessing,
    isPaused,
    activeUploads,
    completedUploads,
    failedUploads,
    receiptIds,
    processingRecommendations,
    progressUpdating,
    batchId,
    // Phase 3: Enhanced batch session state
    batchSession,
    sessionProgress,
    sessionMetrics,
    processingStrategy: currentProcessingStrategy,
    rateLimitStatus,
    // Phase 3: Enhanced progress tracking state
    progressMetrics,
    etaCalculation,
    progressAlerts,
    fileProgressDetails,
    progressTrackingEnabled
  } = state;

  // Computed properties
  const queuedUploads = batchUploads.filter(upload =>
    upload.status === 'pending' && !activeUploads.includes(upload.id)
  );

  const currentlyActiveUploads = batchUploads.filter(upload =>
    activeUploads.includes(upload.id)
  );

  const currentlyCompletedUploads = batchUploads.filter(upload =>
    completedUploads.includes(upload.id)
  );

  const currentlyFailedUploads = batchUploads.filter(upload =>
    failedUploads.includes(upload.id)
  );

  // Phase 3: Batch session management functions
  const createBatchSession = useCallback(async (files: File[]) => {
    if (!batchSessionService || !user) return null;

    try {
      const validation = validateBatchSessionRequest({
        files,
        processingStrategy: currentProcessingStrategy,
        sessionName,
        maxConcurrent
      });

      if (!validation.valid) {
        validation.errors.forEach(error => toast.error(error));
        return null;
      }

      const session = await batchSessionService.createBatchSession(
        {
          files,
          processingStrategy: currentProcessingStrategy,
          sessionName,
          maxConcurrent
        },
        user.id,
        currentTeam?.id
      );

      if (session) {
        dispatch({ type: 'SET_BATCH_SESSION', session });
        console.log('✅ Batch session created:', session.id);
      }

      return session;
    } catch (error) {
      console.error('❌ Failed to create batch session:', error);
      toast.error('Failed to create batch session');
      return null;
    }
  }, [batchSessionService, user, currentTeam, currentProcessingStrategy, sessionName, maxConcurrent]);

  const updateProcessingStrategy = useCallback((strategy: ProcessingStrategy) => {
    dispatch({ type: 'SET_PROCESSING_STRATEGY', strategy });

    // Update rate limiting manager if available
    if (rateLimitingManager) {
      rateLimitingManager.updateStrategy(strategy);
    }

    console.log('📊 Processing strategy updated to:', strategy);
  }, [rateLimitingManager]);

  const requestApiPermission = useCallback(async (uploadId: string, estimatedTokens: number) => {
    if (!rateLimitingManager || !batchSession) {
      return { allowed: true, delayMs: 0, requestId: uploadId };
    }

    try {
      const permission = await batchSessionService?.requestApiPermission(
        batchSession.id,
        uploadId,
        estimatedTokens
      );

      if (permission && !permission.allowed) {
        // Update rate limit status in state
        const status = await rateLimitingManager.getStatus();
        dispatch({
          type: 'UPDATE_RATE_LIMIT_STATUS',
          status: {
            isRateLimited: status.isRateLimited,
            requestsRemaining: status.requestsRemaining,
            tokensRemaining: status.tokensRemaining,
            backoffMs: status.backoffMs
          }
        });
      }

      return permission || { allowed: true, delayMs: 0, requestId: uploadId };
    } catch (error) {
      console.error('❌ Error requesting API permission:', error);
      return { allowed: true, delayMs: 0, requestId: uploadId };
    }
  }, [rateLimitingManager, batchSession, batchSessionService]);

  // Smooth progress update function for individual uploads
  const updateProgressSmooth = useCallback((uploadId: string, targetProgress: number) => {
    const upload = batchUploads.find(u => u.id === uploadId);
    if (!upload) return;

    const currentProgress = upload.uploadProgress;
    const difference = targetProgress - currentProgress;

    if (difference <= 0) return; // Don't go backwards

    dispatch({ type: 'SET_PROGRESS_UPDATING', uploadId, isUpdating: true });

    // Animate progress in small increments for smooth transition
    const steps = Math.max(1, Math.abs(difference));
    const increment = difference / steps;
    const duration = 400; // Total animation duration in ms
    const stepDuration = duration / steps;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const newProgress = Math.min(100, currentProgress + (increment * step));
      dispatch({ type: 'UPLOAD_PROGRESS', uploadId, progress: newProgress });

      if (step >= steps || newProgress >= targetProgress) {
        clearInterval(interval);
        dispatch({ type: 'UPLOAD_PROGRESS', uploadId, progress: targetProgress });
        // Stop the updating indicator after a short delay
        setTimeout(() => {
          dispatch({ type: 'SET_PROGRESS_UPDATING', uploadId, isUpdating: false });
        }, 200);
      }
    }, stepDuration);
  }, [batchUploads]);

  // Function to update progress based on log content
  const updateProgressFromLog = useCallback((uploadId: string, stepName: string, message: string) => {
    const stageMap = LOG_PROGRESS_MAP[stepName];
    if (!stageMap) return;

    // Find the best matching message
    let bestMatch = '';
    let bestScore = 0;

    Object.keys(stageMap).forEach(logKey => {
      if (message.toLowerCase().includes(logKey.toLowerCase())) {
        const score = logKey.length; // Longer matches are more specific
        if (score > bestScore) {
          bestMatch = logKey;
          bestScore = score;
        }
      }
    });

    if (bestMatch && stageMap[bestMatch]) {
      updateProgressSmooth(uploadId, stageMap[bestMatch]);
    }
  }, [updateProgressSmooth]);

  // Helper function to add local logs and update progress for individual uploads
  const addLocalLog = useCallback((uploadId: string, stepName: string, message: string, forceProgress?: number) => {
    // For batch uploads, we don't store local logs in state, but we still update progress
    if (forceProgress !== undefined) {
      updateProgressSmooth(uploadId, forceProgress);
    } else {
      updateProgressFromLog(uploadId, stepName, message);
    }
  }, [updateProgressSmooth, updateProgressFromLog]);

  // Total progress calculation
  const calculateTotalProgress = useCallback(() => {
    if (batchUploads.length === 0) return 0;

    const totalProgress = batchUploads.reduce((sum, upload) => {
      // If the upload is completed, always count it as 100%
      if (upload.status === 'completed') {
        return sum + 100;
      }
      // If the upload is in error state, count it as 0%
      if (upload.status === 'error') {
        return sum + 0;
      }
      // Otherwise use the upload progress
      return sum + (upload.uploadProgress || 0);
    }, 0);

    return Math.round(totalProgress / batchUploads.length);
  }, [batchUploads]);

  // Add files to the batch queue
  const addToBatchQueue = useCallback(async (files: FileList | File[], categoryId?: string | null) => {
    console.log('addToBatchQueue called with files:', files);
    console.log('Files array type:', Object.prototype.toString.call(files));
    console.log('Files length:', files.length);
    console.log('Category ID:', categoryId);

    // Ensure we have an array to work with
    let filesArray: File[];
    if (files instanceof FileList) {
      filesArray = Array.from(files);
    } else if (Array.isArray(files)) {
      filesArray = files;
    } else {
      console.error("Invalid files parameter type:", typeof files);
      toast.error("Invalid files format. Please try again.");
      return [];
    }

    console.log('Converted files to array with length:', filesArray.length);

    // ENHANCED SECURITY: Check subscription limits before adding to batch queue
    console.log("Checking subscription limits for batch upload...");
    const averageFileSizeMB = filesArray.reduce((sum, file) => sum + file.size, 0) / filesArray.length / (1024 * 1024);
    const enforcementResult = await SubscriptionEnforcementService.canUploadBatch(filesArray.length, averageFileSizeMB);

    if (!enforcementResult.allowed) {
      console.warn("Batch upload blocked by subscription limits:", enforcementResult.reason);
      handleActionResult(enforcementResult, "upload this batch");
      return [];
    }

    console.log("Subscription check passed, proceeding with batch upload");

    // Filter for valid file types
    const validFiles = filesArray.filter(file => {
      if (!file) {
        console.error("Null or undefined file found in array");
        return false;
      }

      const fileType = file.type;
      console.log(`Checking file: ${file.name}, type: ${fileType}`);

      const isValid = fileType === 'image/jpeg' ||
                      fileType === 'image/png' ||
                      fileType === 'application/pdf';

      if (!isValid) {
        console.warn(`Invalid file type: ${fileType} for file: ${file.name}`);
      }

      return isValid;
    });

    if (validFiles.length === 0) {
      console.error("No valid files found in selection");
      toast.error("No valid files selected. Please upload JPEG, PNG, or PDF files.");
      return [];
    }

    console.log('Valid files for batch upload:', validFiles.length);
    validFiles.forEach((file, index) => {
      console.log(`Valid file ${index + 1}: ${file.name}, type: ${file.type}, size: ${file.size}`);
    });

    // Get intelligent batch processing optimization with user preferences
    const userPreferences = {
      preferredModel: settings.selectedModel,
    };

    const batchOptimization = getBatchProcessingOptimization(validFiles, userPreferences);
    console.log('Batch optimization with user preferences:', {
      ...batchOptimization,
      userPreferences
    });

    // Create recommendations map for the reducer
    const recommendations: Record<string, ProcessingRecommendation> = {};
    const fileIds: string[] = [];

    validFiles.forEach((file, index) => {
      const id = crypto.randomUUID();
      const recommendation = batchOptimization.recommendations[index];

      console.log(`Creating upload object for file: ${file.name} with ID: ${id}`, {
        recommendation: recommendation.recommendedMethod,
        model: recommendation.recommendedModel,
        riskLevel: recommendation.riskLevel
      });

      recommendations[id] = recommendation;
      fileIds.push(id);
    });

    console.log('Created recommendations for new uploads:', Object.keys(recommendations).length);
    console.log('Batch strategy:', batchOptimization.batchStrategy);

    // Dispatch action to add files with recommendations
    dispatch({
      type: 'ADD_FILES',
      files: validFiles,
      recommendations,
      categoryId
    });

    // Phase 3: Create batch session if session tracking is enabled
    if (enableSessionTracking && !batchSession) {
      console.log('🚀 Creating batch session for tracking...');
      const session = await createBatchSession(validFiles);

      if (session) {
        // Show processing time and cost estimates
        const estimates = estimateBatchProcessingTime(
          validFiles.length,
          currentProcessingStrategy,
          validFiles.reduce((sum, file) => sum + file.size, 0) / validFiles.length
        );

        console.log('📊 Batch processing estimates:', estimates);
        toast.info(
          `Batch session created! Estimated time: ${estimates.estimatedMinutes} min, ` +
          `Cost: $${estimates.estimatedCost.toFixed(4)}`
        );
      }
    }

    // If autoStart is enabled, start processing
    if (autoStart && !processingRef.current) {
      console.log('Auto-start enabled, scheduling batch processing');
      setTimeout(() => {
        startBatchProcessing();
      }, 100);
    }

    // Return the files that were added (for compatibility)
    return validFiles.map((file, index) => ({
      id: fileIds[index],
      file,
      status: 'pending' as const,
      uploadProgress: 0,
    }));
  }, [autoStart, enableSessionTracking, batchSession, createBatchSession, currentProcessingStrategy]);

  // Remove a file from the batch queue
  const removeFromBatchQueue = useCallback((uploadId: string) => {
    dispatch({ type: 'REMOVE_UPLOAD', uploadId });
  }, []);

  // Clear all pending uploads
  const clearBatchQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING' });
  }, []);

  // Clear all uploads (including completed and failed)
  const clearAllUploads = useCallback(() => {
    if (isProcessing && !isPaused) {
      toast.error("Cannot clear uploads while processing. Please pause first.");
      return;
    }

    dispatch({ type: 'CLEAR_ALL' });
  }, [isProcessing, isPaused]);

  // Update a single upload's status and progress
  const updateUploadStatus = useCallback((
    uploadId: string,
    status: ReceiptUpload['status'],
    progress: number,
    error?: { code: string; message: string } | null
  ) => {
    // Check if this upload already has the target status to avoid duplicate updates
    const existingUpload = batchUploads.find(u => u.id === uploadId);
    if (existingUpload && existingUpload.status === status && existingUpload.uploadProgress === progress) {
      return; // No change needed
    }

    // Dispatch appropriate action based on status
    if (status === 'uploading' || status === 'processing') {
      if (status === 'uploading' && !activeUploads.includes(uploadId)) {
        dispatch({ type: 'UPLOAD_STARTED', uploadId });
      }
      dispatch({ type: 'UPLOAD_PROGRESS', uploadId, progress, status });
    } else if (status === 'completed') {
      dispatch({ type: 'UPLOAD_COMPLETED', uploadId });
    } else if (status === 'error' && error) {
      dispatch({ type: 'UPLOAD_FAILED', uploadId, error });
    } else {
      // For other status changes, use the progress action
      dispatch({ type: 'UPLOAD_PROGRESS', uploadId, progress, status });
    }
  }, [batchUploads, activeUploads]);

  // Process a single file
  const processFile = useCallback(async (upload: ReceiptUpload) => {
    if (!user) {
      updateUploadStatus(upload.id, 'error', 0, {
        code: 'AUTH_ERROR',
        message: 'You must be logged in to upload receipts'
      });
      return null;
    }

    try {
      // Phase 3: Request API permission with rate limiting
      if (enableRateLimiting) {
        const estimatedTokens = estimateTokensFromImageSize(upload.file.size);
        const permission = await requestApiPermission(upload.id, estimatedTokens);

        if (!permission.allowed) {
          console.log(`⏳ Rate limited for upload ${upload.id}, waiting ${permission.delayMs}ms`);
          addLocalLog(upload.id, 'START', `Rate limited - waiting ${Math.round(permission.delayMs / 1000)}s before processing`);

          // Limit maximum delay to prevent excessive waiting
          const maxDelay = 60000; // 1 minute maximum
          const actualDelay = Math.min(permission.delayMs, maxDelay);

          // Wait for the required delay
          await new Promise(resolve => setTimeout(resolve, actualDelay));

          // Try again after delay with better error handling
          try {
            const retryPermission = await requestApiPermission(upload.id, estimatedTokens);
            if (!retryPermission.allowed) {
              // Instead of failing immediately, mark for retry later
              addLocalLog(upload.id, 'RATE_LIMITED', 'Still rate limited after delay, will retry later');
              updateUploadStatus(upload.id, 'error', 0, {
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded. Please try again later or reduce concurrent uploads.'
              });
              return null;
            }
          } catch (retryError) {
            console.error('Error during rate limit retry:', retryError);
            addLocalLog(upload.id, 'ERROR', `Rate limiting error: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
            updateUploadStatus(upload.id, 'error', 0, {
              code: 'RATE_LIMIT_ERROR',
              message: 'Rate limiting system error. Please try again.'
            });
            return null;
          }
        }
      }

      // Add initial logs and update progress
      addLocalLog(upload.id, 'START', `Starting upload process for ${upload.file.name} (${(upload.file.size / 1024 / 1024).toFixed(2)} MB)`);
      updateUploadStatus(upload.id, 'uploading', 0);

      // Add file validation log
      if (upload.file.type.startsWith('image/')) {
        addLocalLog(upload.id, 'START', `Detected image file: ${upload.file.type}`);
      } else if (upload.file.type === 'application/pdf') {
        addLocalLog(upload.id, 'START', `Detected PDF file: ${upload.file.name}`);
      }

      // Optimize the image before uploading (if it's an image and optimization is enabled)
      let fileToUpload = upload.file;

      if (upload.file.type.startsWith('image/') && !settings.skipUploadOptimization) {
        try {
          // Using the directly imported optimizeImageForUpload function
          addLocalLog(upload.id, 'START', 'Optimizing image for better processing...');
          console.log(`Optimizing image: ${upload.file.name}, size: ${upload.file.size}`);

          // Use a lower quality for larger files
          const quality = upload.file.size > 3 * 1024 * 1024 ? 70 : 80;

          // Robust optimization with fallback
          try {
            if (typeof optimizeImageForUpload !== 'function') {
              console.warn('optimizeImageForUpload is not available, using original file');
              fileToUpload = upload.file;
            } else {
              fileToUpload = await optimizeImageForUpload(upload.file, 1500, quality);

              if (!fileToUpload) {
                console.warn('Optimization returned null, using original file');
                fileToUpload = upload.file;
              }
            }
          } catch (optimizationError) {
            console.warn('Optimization failed, using original file:', optimizationError);
            fileToUpload = upload.file;
          }

          const compressionRatio = Math.round(fileToUpload.size / upload.file.size * 100);
          addLocalLog(upload.id, 'START', `Image optimized: ${compressionRatio}% of original size (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`Optimized image: ${upload.file.name}, new size: ${fileToUpload.size} (${compressionRatio}% of original)`);
        } catch (optimizeError) {
          console.error(`Error optimizing file ${upload.file.name}:`, optimizeError);
          addLocalLog(upload.id, 'START', 'Image optimization failed, using original file');
          // Continue with original file if optimization fails
          console.log(`Using original file for ${upload.file.name} due to optimization error`);
        }
      } else if (upload.file.type.startsWith('image/') && settings.skipUploadOptimization) {
        addLocalLog(upload.id, 'START', 'Image optimization disabled - preserving original quality');
      } else {
        addLocalLog(upload.id, 'START', 'PDF file detected, skipping optimization');
      }

      addLocalLog(upload.id, 'FETCH', 'Starting file upload to cloud storage...');

      // Upload the image (optimized or original) with retry logic
      let imageUrl: string | null = null;
      let uploadAttempts = 0;
      const maxUploadAttempts = 3;

      while (!imageUrl && uploadAttempts < maxUploadAttempts) {
        uploadAttempts++;
        try {
          addLocalLog(upload.id, 'FETCH', `Upload attempt ${uploadAttempts}/${maxUploadAttempts}`);

          imageUrl = await uploadReceiptImage(
            fileToUpload,
            user.id,
            (progress) => {
              // Update upload progress
              updateUploadStatus(upload.id, 'uploading', Math.round(progress * 0.4)); // Upload is 40% of total progress

              // Add progress logs at key milestones
              if (progress === 25) {
                addLocalLog(upload.id, 'FETCH', 'Upload progress: 25% complete');
              } else if (progress === 50) {
                addLocalLog(upload.id, 'FETCH', 'Upload progress: 50% complete');
              } else if (progress === 75) {
                addLocalLog(upload.id, 'FETCH', 'Upload progress: 75% complete');
              }
            }
          );

          if (!imageUrl && uploadAttempts < maxUploadAttempts) {
            addLocalLog(upload.id, 'FETCH', `Upload attempt ${uploadAttempts} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts)); // Exponential backoff
          }
        } catch (uploadError) {
          addLocalLog(upload.id, 'FETCH', `Upload attempt ${uploadAttempts} failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          if (uploadAttempts >= maxUploadAttempts) {
            throw uploadError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts)); // Exponential backoff
        }
      }

      if (!imageUrl) {
        throw new Error("Failed to upload image after multiple attempts");
      }

      addLocalLog(upload.id, 'FETCH', `File uploaded successfully to: ${imageUrl.split('/').pop()}`);

      addLocalLog(upload.id, 'SAVE', 'Creating receipt record in database...');

      // Create receipt record with retry logic
      let newReceiptId: string | null = null;
      let createAttempts = 0;
      const maxCreateAttempts = 3;

      while (!newReceiptId && createAttempts < maxCreateAttempts) {
        createAttempts++;
        try {
          const today = new Date().toISOString().split('T')[0];
          newReceiptId = await createReceipt({
            merchant: "Processing...",
            date: today,
            total: 0,
            currency: "MYR",
            status: "unreviewed",
            image_url: imageUrl,
            // user_id is added by the createReceipt function
            processing_status: 'uploading',
            model_used: settings.selectedModel,
            payment_method: "", // Add required field
            custom_category_id: upload.categoryId || null // Include category from upload
          }, [], {
            merchant: 0,
            date: 0,
            total: 0
          }, { currentTeam });

          if (!newReceiptId && createAttempts < maxCreateAttempts) {
            addLocalLog(upload.id, 'SAVE', `Receipt creation attempt ${createAttempts} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * createAttempts));
          }
        } catch (createError) {
          addLocalLog(upload.id, 'SAVE', `Receipt creation attempt ${createAttempts} failed: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
          if (createAttempts >= maxCreateAttempts) {
            throw createError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * createAttempts));
        }
      }

      if (!newReceiptId) {
        throw new Error("Failed to create receipt record after multiple attempts");
      }

      // Store the receipt ID for this upload
      dispatch({ type: 'SET_RECEIPT_ID', uploadId: upload.id, receiptId: newReceiptId });
      addLocalLog(upload.id, 'SAVE', `Receipt record created with ID: ${newReceiptId.slice(0, 8)}...`);

      // Mark as uploaded
      await markReceiptUploaded(newReceiptId);
      addLocalLog(upload.id, 'PROCESSING', `Starting AI processing with ${settings.selectedModel}...`);
      updateUploadStatus(upload.id, 'processing', 60);

      // Phase 3: Update progress tracking when processing starts
      if (progressTrackingService && batchSession) {
        progressTrackingService.updateFileProgress(batchSession.id, upload.id, {
          status: 'processing',
          stage: 'processing',
          progress: 60,
          stageProgress: 0,
          startTime: new Date()
        });
      }

      // Subscribe to status updates for this receipt
      const statusChannel = supabase.channel(`receipt-status-${newReceiptId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'receipts',
            filter: `id=eq.${newReceiptId}`
          },
          (payload) => {
            const newStatus = payload.new.processing_status as ProcessingStatus;
            const newError = payload.new.processing_error;

            // Update progress based on processing status
            console.log(`Receipt ${newReceiptId} status updated to ${newStatus}`);

            if (newStatus === 'processing') {
              updateUploadStatus(upload.id, 'processing', 70);
            } else if (newStatus === 'complete') {
              console.log(`Receipt ${newReceiptId} processing complete, updating UI to 100%`);
              addLocalLog(upload.id, 'COMPLETE', 'Processing complete - receipt ready for review');
              updateUploadStatus(upload.id, 'completed', 100);
              statusChannel.unsubscribe();
            } else if (newStatus === 'failed') {
              const errorMsg = "AI processing failed";

              console.log(`Receipt ${newReceiptId} processing failed: ${errorMsg}`);
              addLocalLog(upload.id, 'ERROR', `Processing failed: ${errorMsg}`);
              updateUploadStatus(upload.id, 'error', 0, {
                code: newStatus,
                message: newError || errorMsg
              });
              statusChannel.unsubscribe();
            }
          }
        )
        .subscribe();

      // Process the receipt with enhanced fallback if available
      try {
        console.log(`Processing receipt ${newReceiptId}...`);

        // Add a small delay for batch uploads to avoid potential race conditions
        // This helps ensure AI model state consistency between requests
        await new Promise(resolve => setTimeout(resolve, 100));

        const recommendation = processingRecommendations[upload.id];
        let result: any;

        // Process with AI Vision
        result = await processReceiptWithAI(newReceiptId, {
          modelId: recommendation?.recommendedModel || settings.selectedModel,
          uploadContext: 'batch'
        });

        console.log(`Processing result for ${newReceiptId}:`, result ? 'Success' : 'Failed');

        // If we got a successful result, update the status to completed
        // This is a fallback in case the realtime subscription doesn't catch the update
        if (result) {
          // Phase 3: Record successful API call for rate limiting
          if (enableRateLimiting && batchSessionService && batchSession) {
            const actualTokens = estimateTokensFromImageSize(upload.file.size);
            const processingTime = Date.now() - (upload.processingStartedAt?.getTime() || Date.now());

            await batchSessionService.updateFileStatus({
              fileId: upload.id,
              status: 'completed',
              receiptId: newReceiptId,
              processingDurationMs: processingTime,
              apiCallsMade: 1,
              tokensUsed: actualTokens,
              rateLimited: false
            }, user.id);
          }

          // Phase 3: Update progress tracking for successful completion
          if (progressTrackingService && batchSession) {
            const processingTime = Date.now() - (upload.processingStartedAt?.getTime() || Date.now());
            const actualTokens = estimateTokensFromImageSize(upload.file.size);

            progressTrackingService.updateFileProgress(batchSession.id, upload.id, {
              status: 'completed',
              stage: 'completed',
              progress: 100,
              stageProgress: 100,
              endTime: new Date(),
              processingTimeMs: processingTime,
              apiCalls: 1,
              tokensUsed: actualTokens,
              qualityScore: 0.95 // High quality score for successful processing
            });
          }

          // Force update to completed status immediately
          updateUploadStatus(upload.id, 'completed', 100);
          statusChannel.unsubscribe();

          // Also check after a short delay in case the first update didn't take effect
          setTimeout(() => {
            // Check if this upload is still in processing status
            const currentUpload = batchUploads.find(u => u.id === upload.id);
            if (currentUpload && currentUpload.status === 'processing') {
              console.log(`Manually completing upload ${upload.id} after successful processing`);
              updateUploadStatus(upload.id, 'completed', 100);
              statusChannel.unsubscribe();
            }
          }, 2000);
        }
      } catch (processError: any) {
        console.error("Processing error:", processError);
        addLocalLog(upload.id, 'ERROR', `Processing failed: ${processError.message || "Failed to process receipt"}`);

        // Phase 3: Record failed API call for rate limiting
        if (enableRateLimiting && batchSessionService && batchSession) {
          const errorType = processError.message?.includes('rate limit') ? 'rate_limited' : 'processing_failed';
          await batchSessionService.updateFileStatus({
            fileId: upload.id,
            status: 'failed',
            errorType,
            errorMessage: processError.message || "Failed to process receipt",
            rateLimited: errorType === 'rate_limited'
          }, user.id);
        }

        // Phase 3: Update progress tracking for failed processing
        if (progressTrackingService && batchSession) {
          const isRateLimited = processError.message?.includes('rate limit');

          progressTrackingService.updateFileProgress(batchSession.id, upload.id, {
            status: 'failed',
            stage: 'completed',
            progress: 0,
            stageProgress: 0,
            endTime: new Date(),
            errorMessage: processError.message || "Failed to process receipt",
            rateLimited: isRateLimited,
            qualityScore: 0.1 // Low quality score for failed processing
          });

          // Record rate limiting event if applicable
          if (isRateLimited) {
            progressTrackingService.recordRateLimitEvent(batchSession.id, 5000); // Assume 5s delay
          }
        }

        updateUploadStatus(upload.id, 'error', 0, {
          code: 'PROCESSING_ERROR',
          message: processError.message || "Failed to process receipt"
        });
        statusChannel.unsubscribe();
      }

      return newReceiptId;
    } catch (error: any) {
      console.error("Upload error:", error);
      addLocalLog(upload.id, 'ERROR', `Upload failed: ${error.message || "Failed to upload receipt"}`);

      // Phase 3: Record failed upload for rate limiting
      if (enableRateLimiting && batchSessionService && batchSession) {
        await batchSessionService.updateFileStatus({
          fileId: upload.id,
          status: 'failed',
          errorType: 'upload_failed',
          errorMessage: error.message || "Failed to upload receipt"
        }, user.id);
      }

      updateUploadStatus(upload.id, 'error', 0, {
        code: 'UPLOAD_ERROR',
        message: error.message || "Failed to upload receipt"
      });
      return null;
    }
  }, [user, settings, updateUploadStatus, enableRateLimiting, batchSessionService, batchSession, requestApiPermission, addLocalLog]);

  // Process the next batch of files
  const processNextBatch = useCallback(async () => {
    if (!processingRef.current || isPaused) return;

    // Safety check to prevent infinite loops
    const totalUploads = batchUploads.length;
    if (totalUploads === 0) {
      console.log('No uploads to process');
      return;
    }

    // Get pending uploads that aren't already being processed
    const pendingUploads = batchUploads.filter(upload =>
      upload.status === 'pending' && !activeUploads.includes(upload.id)
    );

    // Additional safety check for stuck uploads
    const stuckUploads = batchUploads.filter(upload =>
      upload.status === 'uploading' && !activeUploads.includes(upload.id)
    );

    if (stuckUploads.length > 0) {
      console.warn(`Found ${stuckUploads.length} stuck uploads, resetting to pending`);
      stuckUploads.forEach(upload => {
        updateUploadStatus(upload.id, 'pending', 0);
      });
    }

    // If no more pending uploads AND no active uploads, we're done
    if (pendingUploads.length === 0 && activeUploads.length === 0) {
      console.log('🎉 Batch processing complete - all uploads finished');
      dispatch({ type: 'STOP_PROCESSING' });
      processingRef.current = false;

      // Show completion toast
      const totalCount = batchUploads.length;
      const successCount = completedUploads.length;
      const failureCount = failedUploads.length;

      console.log('📊 Batch completion stats:', {
        total: totalCount,
        successful: successCount,
        failed: failureCount,
        batchUploads: batchUploads.map(u => ({ id: u.id, status: u.status }))
      });

      if (totalCount > 0) {
        if (failureCount === 0) {
          toast.success(`All ${successCount} receipts processed successfully!`);
        } else {
          toast.info(`Batch processing complete: ${successCount} succeeded, ${failureCount} failed`);
        }

        // Send batch completion notification
        try {
          if (user?.id) {
            console.log('📤 Sending batch completion notification...');
            await ReceiptNotificationService.handleBatchProcessingComplete(
              user.id,
              {
                totalReceipts: totalCount,
                successfulReceipts: successCount,
                failedReceipts: failureCount,
                batchId: batchId || undefined
              }
            );
            console.log("✅ Batch completion notification sent successfully");
          } else {
            console.warn("Cannot send batch completion notification: user ID not available");
          }
        } catch (notificationError) {
          console.error("❌ Failed to send batch completion notification:", notificationError);
          // Non-critical, continue
        }
      } else {
        console.log('ℹ️ No uploads to report for batch completion');
      }

      return;
    }

    // Calculate how many new uploads we can start
    const currentActive = activeUploads.length;
    const slotsAvailable = maxConcurrent - currentActive;

    if (slotsAvailable <= 0) return;

    // Get the next batch of uploads to process
    const nextBatch = pendingUploads.slice(0, slotsAvailable);

    // Mark these as active by dispatching UPLOAD_STARTED for each
    nextBatch.forEach(upload => {
      dispatch({ type: 'UPLOAD_STARTED', uploadId: upload.id });
    });

    // Process each file in parallel
    nextBatch.forEach(upload => {
      processFile(upload).catch(error => {
        console.error(`Error processing file ${upload.id}:`, error);
      });
    });
  }, [batchUploads, activeUploads, isPaused, maxConcurrent, completedUploads, failedUploads, processFile]);

  // Start batch processing
  const startBatchProcessing = useCallback(async () => {
    console.log('startBatchProcessing called');
    if (processingRef.current && !isPaused) {
      toast.info("Batch processing is already running");
      return;
    }

    // If paused, just resume
    if (isPaused) {
      dispatch({ type: 'START_PROCESSING' });
      toast.info("Resuming batch processing");
      return;
    }

    // Check if there are any pending uploads
    const pendingUploads = batchUploads.filter(upload => upload.status === 'pending');

    console.log('Pending uploads:', pendingUploads.length);

    if (pendingUploads.length === 0) {
      console.log('No pending uploads found');
      toast.info("No files to process. Add files to the queue first.");
      return;
    }

    // ENHANCED SECURITY: Final check before starting batch processing
    console.log("Final subscription check before starting batch processing...");
    const averageFileSizeMB = pendingUploads.reduce((sum, upload) => sum + upload.file.size, 0) / pendingUploads.length / (1024 * 1024);
    const enforcementResult = await SubscriptionEnforcementService.canUploadBatch(pendingUploads.length, averageFileSizeMB);

    if (!enforcementResult.allowed) {
      console.warn("Batch processing blocked by subscription limits:", enforcementResult.reason);
      handleActionResult(enforcementResult, "start batch processing");
      return;
    }

    console.log("Final subscription check passed, starting batch processing");

    // Start processing
    dispatch({ type: 'START_PROCESSING' });
    processingRef.current = true;

    // Phase 3: Initialize progress tracking for this batch session
    if (progressTrackingService && batchSession) {
      const progressTracker = progressTrackingService.startTracking(batchSession.id, {
        mode: progressTrackingMode,
        config: {
          enableRealTimeUpdates,
          enablePerformanceAlerts,
          enableETAOptimization: enableETACalculation,
          enableQualityTracking
        },
        callbacks: {
          onProgressUpdate: (metrics: ProgressMetrics) => {
            dispatch({ type: 'UPDATE_PROGRESS_METRICS', metrics });
          },
          onETAUpdate: (eta: ETACalculation) => {
            dispatch({ type: 'UPDATE_ETA_CALCULATION', eta });
          },
          onPerformanceAlert: (alert: ProgressAlert) => {
            dispatch({ type: 'ADD_PROGRESS_ALERT', alert });
          }
        },
        enablePersistence: enableSessionTracking,
        enableAnalytics: enableQualityTracking
      });

      // Initialize file progress details for all pending uploads
      pendingUploads.forEach(upload => {
        const fileDetail: FileProgressDetail = {
          fileId: upload.id,
          filename: upload.file.name,
          status: 'pending',
          progress: 0,
          stage: 'uploading',
          stageProgress: 0,
          apiCalls: 0,
          tokensUsed: 0,
          retryCount: 0,
          rateLimited: false,
          warningMessages: []
        };

        dispatch({ type: 'UPDATE_FILE_PROGRESS', fileId: upload.id, progress: fileDetail });
      });

      // Mark progress tracking as enabled
      dispatch({ type: 'UPDATE_PROGRESS_METRICS', metrics: {
        totalFiles: pendingUploads.length,
        filesCompleted: 0,
        filesFailed: 0,
        filesPending: pendingUploads.length,
        filesProcessing: 0,
        progressPercentage: 0,
        startTime: new Date(),
        currentTime: new Date(),
        elapsedTimeMs: 0,
        averageProcessingTimeMs: 0,
        currentThroughput: 0,
        peakThroughput: 0,
        throughputHistory: [],
        rateLimitHits: 0,
        rateLimitDelayMs: 0,
        apiCallsTotal: 0,
        apiCallsSuccessful: 0,
        apiCallsFailed: 0,
        apiSuccessRate: 1,
        totalTokensUsed: 0,
        estimatedCost: 0,
        costPerFile: 0,
        tokensPerFile: 0,
        apiEfficiency: 0,
        retryCount: 0,
        errorRate: 0,
        qualityScore: 1
      } as ProgressMetrics });
    }

    toast.info(`Starting batch processing of ${pendingUploads.length} files`);

    // Kick off the first batch
    processNextBatch();
  }, [batchUploads, isPaused, processNextBatch]);

  // Pause batch processing
  const pauseBatchProcessing = useCallback(() => {
    if (!processingRef.current) {
      toast.info("No active batch processing to pause");
      return;
    }

    dispatch({ type: 'PAUSE_PROCESSING' });
    toast.info("Batch processing paused. Currently active uploads will complete.");
  }, []);

  // Cancel a specific upload
  const cancelUpload = useCallback(async (uploadId: string) => {
    const upload = batchUploads.find(u => u.id === uploadId);

    if (!upload) {
      console.error(`Upload with ID ${uploadId} not found`);
      return;
    }

    // If it's already completed or failed, we can't cancel it
    if (upload.status === 'completed' || upload.status === 'error') {
      toast.info(`Cannot cancel upload that is already ${upload.status}`);
      return;
    }

    // If it's active, mark it as failed
    if (activeUploads.includes(uploadId)) {
      updateUploadStatus(uploadId, 'error', 0, {
        code: 'CANCELLED',
        message: 'Upload cancelled by user'
      });

      // If we have a receipt ID, update its status
      const receiptId = receiptIds[uploadId];
      if (receiptId) {
        // Update the receipt status to failed
        try {
          const { error } = await supabase
            .from('receipts')
            .update({
              processing_status: 'failed_ocr',
              processing_error: 'Cancelled by user'
            })
            .eq('id', receiptId);

          if (error) {
            console.error(`Failed to update receipt ${receiptId} status:`, error);
          } else {
            console.log(`Updated receipt ${receiptId} status to failed_ocr`);
          }
        } catch (error) {
          console.error(`Exception updating receipt ${receiptId} status:`, error);
        }
      }
    } else {
      // If it's pending, just remove it from the queue
      removeFromBatchQueue(uploadId);
    }
  }, [batchUploads, activeUploads, receiptIds, removeFromBatchQueue, updateUploadStatus]);

  // Retry a failed upload
  const retryUpload = useCallback((uploadId: string) => {
    const upload = batchUploads.find(u => u.id === uploadId);

    if (!upload) {
      console.error(`Upload with ID ${uploadId} not found`);
      return;
    }

    // Only retry failed uploads
    if (upload.status !== 'error') {
      toast.info(`Can only retry failed uploads`);
      return;
    }

    // Check retry count to prevent infinite retries
    const retryCount = upload.retryCount || 0;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      toast.error(`Maximum retry attempts (${maxRetries}) reached for this upload`);
      return;
    }

    // Use the reducer to handle retry logic
    dispatch({ type: 'RETRY_UPLOAD', uploadId });

    toast.info(`Upload queued for retry (attempt ${retryCount + 1}/${maxRetries})`);

    // If processing is active, the new upload will be picked up automatically
    if (!isProcessing && autoStart) {
      setTimeout(() => {
        startBatchProcessing();
      }, 100);
    }
  }, [batchUploads, isProcessing, autoStart, startBatchProcessing]);

  // Log when batchUploads changes
  useEffect(() => {
    console.log('batchUploads state changed:', batchUploads);
    console.log('batchUploads length:', batchUploads.length);
    console.log('activeUploads:', activeUploads);
    console.log('completedUploads:', completedUploads);
    console.log('failedUploads:', failedUploads);
    console.log('isProcessing:', isProcessing);
    console.log('isPaused:', isPaused);

    // Log detailed progress information
    if (batchUploads.length > 0) {
      console.log('Upload progress details:', {
        totalProgress: calculateTotalProgress(),
        completed: completedUploads.length,
        failed: failedUploads.length,
        active: activeUploads.length,
        pending: batchUploads.filter(u => u.status === 'pending').length,
        uploadStatuses: batchUploads.map(u => ({ id: u.id, status: u.status, progress: u.uploadProgress }))
      });

      // Log each upload in detail
      batchUploads.forEach((upload, index) => {
        console.log(`Upload ${index + 1}:`, {
          id: upload.id,
          fileName: upload.file?.name,
          fileType: upload.file?.type,
          fileSize: upload.file?.size,
          status: upload.status,
          progress: upload.uploadProgress,
          error: upload.error
        });
      });
    }
  }, [batchUploads, calculateTotalProgress, completedUploads, failedUploads, activeUploads, isProcessing, isPaused]);

  // Effect to process next batch when active uploads change
  useEffect(() => {
    if (processingRef.current && !isPaused) {
      // Use a small timeout to avoid potential race conditions
      const timer = setTimeout(() => {
        processNextBatch();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeUploads, completedUploads, failedUploads, isPaused, processNextBatch]);

  // Subscribe to real-time processing logs for progress updates
  useEffect(() => {
    if (!user?.id || batchUploads.length === 0) return;

    const receiptIdsToWatch = Object.values(receiptIds).filter(Boolean);
    if (receiptIdsToWatch.length === 0) return;

    console.log('Setting up real-time log subscription for batch uploads:', receiptIdsToWatch);

    const subscription = supabase
      .channel('batch-processing-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processing_logs',
          filter: `receipt_id=in.(${receiptIdsToWatch.join(',')})`
        },
        (payload) => {
          const newLog = payload.new as ProcessingLog;
          console.log('New batch upload log received:', newLog);

          // Find the upload ID for this receipt
          const uploadId = Object.keys(receiptIds).find(id => receiptIds[id] === newLog.receipt_id);

          if (uploadId && newLog.step_name && newLog.status_message) {
            // Update progress based on the received log
            updateProgressFromLog(uploadId, newLog.step_name, newLog.status_message);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up batch processing logs subscription');
      subscription.unsubscribe();
    };
  }, [user?.id, receiptIds, updateProgressFromLog]);

  // Phase 3: Monitor batch session progress and metrics
  useEffect(() => {
    if (!batchSession || !batchSessionService || !user) return;

    const updateSessionData = async () => {
      try {
        const [progress, metrics] = await Promise.all([
          batchSessionService.getSessionProgress(batchSession.id, user.id),
          batchSessionService.getSessionMetrics(batchSession.id, user.id)
        ]);

        if (progress) {
          dispatch({ type: 'UPDATE_SESSION_PROGRESS', progress });
        }

        if (metrics) {
          dispatch({ type: 'UPDATE_SESSION_METRICS', metrics });
        }
      } catch (error) {
        console.error('❌ Error updating session data:', error);
      }
    };

    // Update immediately
    updateSessionData();

    // Set up periodic updates if real-time updates are enabled
    let interval: NodeJS.Timeout | null = null;
    if (enableRealTimeUpdates && isProcessing) {
      interval = setInterval(updateSessionData, 5000); // Update every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [batchSession, batchSessionService, user, enableRealTimeUpdates, isProcessing]);

  // Phase 3: Monitor rate limiting status
  useEffect(() => {
    if (!rateLimitingManager || !isProcessing) return;

    const updateRateLimitStatus = async () => {
      try {
        const status = await rateLimitingManager.getStatus();
        dispatch({
          type: 'UPDATE_RATE_LIMIT_STATUS',
          status: {
            isRateLimited: status.isRateLimited,
            requestsRemaining: status.requestsRemaining,
            tokensRemaining: status.tokensRemaining,
            backoffMs: status.backoffMs
          }
        });
      } catch (error) {
        console.error('❌ Error updating rate limit status:', error);
      }
    };

    // Update immediately
    updateRateLimitStatus();

    // Set up periodic updates
    const interval = setInterval(updateRateLimitStatus, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [rateLimitingManager, isProcessing]);

  // Handle file drop and selection using the base hook
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    console.log('handleFiles called in useBatchFileUpload with:', files);
    console.log('Files type:', Object.prototype.toString.call(files));
    console.log('Files length:', files.length);

    // Ensure we have an array to work with
    let filesArray: File[];
    if (files instanceof FileList) {
      filesArray = Array.from(files);
    } else if (Array.isArray(files)) {
      filesArray = files;
    } else {
      console.error("Invalid files parameter type:", typeof files);
      toast.error("Invalid files format. Please try again.");
      return;
    }

    console.log('Converted files to array with length:', filesArray.length);

    // Instead of using baseUpload.handleFiles, directly validate and add files
    const validFiles = filesArray.filter(file => {
      if (!file) {
        console.error("Null or undefined file found in array");
        return false;
      }

      const fileType = file.type;
      console.log(`Checking file: ${file.name}, type: ${fileType}`);

      const isValid = fileType === 'image/jpeg' ||
                      fileType === 'image/png' ||
                      fileType === 'application/pdf';

      if (!isValid) {
        console.warn(`Invalid file type: ${fileType} for file: ${file.name}`);
      }

      return isValid;
    });

    console.log('Valid files in useBatchFileUpload handleFiles:', validFiles.length);
    validFiles.forEach((file, index) => {
      console.log(`Valid file ${index + 1}: ${file.name}, type: ${file.type}, size: ${file.size}`);
    });

    if (validFiles && validFiles.length > 0) {
      // Add to our batch queue (now async with subscription enforcement)
      const result = await addToBatchQueue(validFiles);
      console.log('Result from addToBatchQueue in handleFiles:', result);

      // Reset the base hook's uploads to avoid duplication
      baseUpload.resetUpload();
    } else {
      console.error('No valid files found in useBatchFileUpload handleFiles');
      toast.error("No valid files selected. Please upload JPEG, PNG, or PDF files.");
    }
  }, [baseUpload, addToBatchQueue]);

  return {
    // Base file upload properties and methods
    ...baseUpload,
    handleFiles,

    // Batch-specific state
    batchUploads,
    isProcessing,
    isPaused,
    queuedUploads,
    activeUploads: currentlyActiveUploads,
    completedUploads: currentlyCompletedUploads,
    failedUploads: currentlyFailedUploads,
    totalProgress: calculateTotalProgress(),

    // Batch-specific methods
    addToBatchQueue,
    removeFromBatchQueue,
    clearBatchQueue,
    clearAllUploads,
    startBatchProcessing,
    pauseBatchProcessing,
    cancelUpload,
    retryUpload,

    // Receipt IDs for navigation
    receiptIds,

    // Progress updating state
    progressUpdating,

    // Phase 3: Enhanced batch session properties
    batchSession,
    sessionProgress,
    sessionMetrics,
    processingStrategy: currentProcessingStrategy,
    rateLimitStatus,

    // Phase 3: Enhanced batch session methods
    updateProcessingStrategy,
    createBatchSession,
    requestApiPermission,

    // Phase 3: Configuration and status
    enableRateLimiting,
    enableSessionTracking,
    enableRealTimeUpdates,
    rateLimitingManager,

    // Phase 3: Utility functions
    getProcessingStrategyConfig: () => getProcessingStrategyConfig(currentProcessingStrategy),
    estimateBatchProcessingTime: (files: File[]) =>
      estimateBatchProcessingTime(
        files.length,
        currentProcessingStrategy,
        files.reduce((sum, file) => sum + file.size, 0) / files.length
      ),

    // Phase 3: Enhanced progress tracking properties
    progressMetrics,
    etaCalculation,
    progressAlerts,
    fileProgressDetails,
    progressTrackingEnabled,

    // Phase 3: Enhanced progress tracking methods
    dismissProgressAlert: (alertId: string) => {
      dispatch({ type: 'DISMISS_PROGRESS_ALERT', alertId });
    },
    getProgressSummary: () => {
      return progressTrackingService && batchSession ?
        progressTrackingService.getProgressSummary(batchSession.id) : null;
    },
    getSessionAnalytics: async () => {
      return progressTrackingService && batchSession ?
        await progressTrackingService.getSessionAnalytics(batchSession.id) : null;
    }
  };
}
