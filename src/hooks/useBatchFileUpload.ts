import { useReducer, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ReceiptUpload, ProcessingStatus } from "@/types/receipt";
import { useFileUpload } from "./useFileUpload";
import {
  createReceipt,
  uploadReceiptImage,
  processReceiptWithOCR,
  markReceiptUploaded
} from "@/services/receiptService";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImageForUpload } from "@/utils/imageUtils";
import { getBatchProcessingOptimization, ProcessingRecommendation } from "@/utils/processingOptimizer";
import { processReceiptWithEnhancedFallback } from "@/services/fallbackProcessingService";
import { SubscriptionEnforcementService, handleActionResult } from "@/services/subscriptionEnforcementService";

interface BatchUploadOptions {
  maxConcurrent?: number;
  autoStart?: boolean;
  useEnhancedFallback?: boolean;
}

// ============================================================================
// STATE MANAGEMENT WITH REDUCER
// ============================================================================

/**
 * Actions for the batch upload state reducer
 */
type BatchUploadAction =
  | { type: 'ADD_FILES'; files: File[]; recommendations: Record<string, ProcessingRecommendation> }
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
  | { type: 'RETRY_UPLOAD'; uploadId: string };

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
  processingRecommendations: {}
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
        }
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

      // Create a new upload with the same file
      const newUpload: ReceiptUpload = {
        id: crypto.randomUUID(),
        file: uploadToRetry.file,
        status: 'pending',
        uploadProgress: 0
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

    default:
      return state;
  }
}

export function useBatchFileUpload(options: BatchUploadOptions = {}) {
  const { maxConcurrent = 2, autoStart = false, useEnhancedFallback = true } = options;

  // Use the base file upload hook for file selection and validation
  const baseUpload = useFileUpload();

  // Use reducer for complex state management
  const [state, dispatch] = useReducer(batchUploadReducer, initialBatchState);
  const processingRef = useRef<boolean>(false);

  const { user } = useAuth();
  const { settings } = useSettings();

  // Destructure state for easier access
  const {
    uploads: batchUploads,
    isProcessing,
    isPaused,
    activeUploads,
    completedUploads,
    failedUploads,
    receiptIds,
    processingRecommendations
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
  const addToBatchQueue = useCallback(async (files: FileList | File[]) => {
    console.log('addToBatchQueue called with files:', files);
    console.log('Files array type:', Object.prototype.toString.call(files));
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

    // Get intelligent batch processing optimization
    const batchOptimization = getBatchProcessingOptimization(validFiles);
    console.log('Batch optimization:', batchOptimization);

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
      recommendations
    });

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
  }, [autoStart]);

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
      // Update status to uploading
      updateUploadStatus(upload.id, 'uploading', 5);

      // Optimize the image before uploading (if it's an image)
      let fileToUpload = upload.file;

      if (upload.file.type.startsWith('image/')) {
        try {
          // Using the directly imported optimizeImageForUpload function
          updateUploadStatus(upload.id, 'uploading', 10);
          console.log(`Optimizing image: ${upload.file.name}, size: ${upload.file.size}`);

          // Use a lower quality for larger files
          const quality = upload.file.size > 3 * 1024 * 1024 ? 70 : 80;

          // Check if the function exists
          if (typeof optimizeImageForUpload !== 'function') {
            console.error('optimizeImageForUpload is not a function in useBatchFileUpload');
            throw new Error('optimizeImageForUpload is not a function');
          }

          fileToUpload = await optimizeImageForUpload(upload.file, 1500, quality);

          if (!fileToUpload) {
            console.error('Optimization returned null or undefined file');
            throw new Error('Optimization returned null file');
          }

          console.log(`Optimized image: ${upload.file.name}, new size: ${fileToUpload.size} (${Math.round(fileToUpload.size / upload.file.size * 100)}% of original)`);
        } catch (optimizeError) {
          console.error(`Error optimizing file ${upload.file.name}:`, optimizeError);
          // Continue with original file if optimization fails
          console.log(`Using original file for ${upload.file.name} due to optimization error`);
        }
      }

      updateUploadStatus(upload.id, 'uploading', 15);

      // Upload the image (optimized or original)
      const imageUrl = await uploadReceiptImage(
        fileToUpload,
        user.id,
        (progress) => {
          // Scale progress to 15-50%
          const scaledProgress = 15 + Math.floor(progress * 0.35);
          updateUploadStatus(upload.id, 'uploading', scaledProgress);
        }
      );

      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      updateUploadStatus(upload.id, 'uploading', 50);

      // Create receipt record
      const today = new Date().toISOString().split('T')[0];
      const newReceiptId = await createReceipt({
        merchant: "Processing...",
        date: today,
        total: 0,
        currency: "MYR",
        status: "unreviewed",
        image_url: imageUrl,
        // user_id is added by the createReceipt function
        processing_status: 'uploading',
        primary_method: settings.processingMethod,
        model_used: settings.selectedModel,
        has_alternative_data: settings.compareWithAlternative,
        payment_method: "" // Add required field
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });

      if (!newReceiptId) {
        throw new Error("Failed to create receipt record");
      }

      // Store the receipt ID for this upload
      dispatch({ type: 'SET_RECEIPT_ID', uploadId: upload.id, receiptId: newReceiptId });

      // Mark as uploaded
      await markReceiptUploaded(newReceiptId);
      updateUploadStatus(upload.id, 'processing', 60);

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

            if (newStatus === 'processing_ocr') {
              updateUploadStatus(upload.id, 'processing', 70);
            } else if (newStatus === 'processing_ai') {
              updateUploadStatus(upload.id, 'processing', 85);
            } else if (newStatus === 'complete') {
              console.log(`Receipt ${newReceiptId} processing complete, updating UI to 100%`);
              updateUploadStatus(upload.id, 'completed', 100);
              statusChannel.unsubscribe();
            } else if (newStatus === 'failed_ocr' || newStatus === 'failed_ai') {
              const errorMsg = newStatus === 'failed_ocr'
                ? "OCR processing failed"
                : "AI analysis failed";

              console.log(`Receipt ${newReceiptId} processing failed: ${errorMsg}`);
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

        const recommendation = processingRecommendations[upload.id];
        let result;

        if (useEnhancedFallback && recommendation) {
          console.log(`Using enhanced fallback processing for ${newReceiptId}:`, {
            method: recommendation.recommendedMethod,
            model: recommendation.recommendedModel,
            riskLevel: recommendation.riskLevel
          });

          result = await processReceiptWithEnhancedFallback(
            newReceiptId,
            recommendation,
            {
              onProgress: (stage, progress) => {
                console.log(`Enhanced processing ${newReceiptId}: ${stage} (${progress}%)`);
              },
              onFallback: (reason, newMethod) => {
                console.log(`Fallback triggered for ${newReceiptId}: ${reason} → ${newMethod}`);
              },
              onRetry: (attempt, maxAttempts) => {
                console.log(`Processing attempt ${attempt}/${maxAttempts} for ${newReceiptId}`);
              }
            }
          );
        } else {
          // Fallback to original processing with AI Vision
          result = await processReceiptWithOCR(newReceiptId, {
            primaryMethod: 'ai-vision', // Force AI Vision
            modelId: recommendation?.recommendedModel || settings.selectedModel,
            compareWithAlternative: settings.compareWithAlternative
          });
        }

        console.log(`Processing result for ${newReceiptId}:`, result ? 'Success' : 'Failed');

        // If we got a successful result, update the status to completed
        // This is a fallback in case the realtime subscription doesn't catch the update
        if (result) {
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
        updateUploadStatus(upload.id, 'error', 0, {
          code: 'PROCESSING_ERROR',
          message: processError.message || "Failed to process receipt"
        });
        statusChannel.unsubscribe();
      }

      return newReceiptId;
    } catch (error: any) {
      console.error("Upload error:", error);
      updateUploadStatus(upload.id, 'error', 0, {
        code: 'UPLOAD_ERROR',
        message: error.message || "Failed to upload receipt"
      });
      return null;
    }
  }, [user, settings, updateUploadStatus]);

  // Process the next batch of files
  const processNextBatch = useCallback(async () => {
    if (!processingRef.current || isPaused) return;

    // Get pending uploads that aren't already being processed
    const pendingUploads = batchUploads.filter(upload =>
      upload.status === 'pending' && !activeUploads.includes(upload.id)
    );

    // If no more pending uploads, we're done
    if (pendingUploads.length === 0) {
      dispatch({ type: 'STOP_PROCESSING' });
      processingRef.current = false;

      // Show completion toast
      const totalCount = batchUploads.length;
      const successCount = completedUploads.length;
      const failureCount = failedUploads.length;

      if (totalCount > 0) {
        if (failureCount === 0) {
          toast.success(`All ${successCount} receipts processed successfully!`);
        } else {
          toast.info(`Batch processing complete: ${successCount} succeeded, ${failureCount} failed`);
        }
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

    // Use the reducer to handle retry logic
    dispatch({ type: 'RETRY_UPLOAD', uploadId });

    toast.info("Upload queued for retry");

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
    receiptIds
  };
}
