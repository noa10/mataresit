import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Upload, Loader2, XCircle, FileText, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import {
  createReceipt,
  uploadReceiptImage,
  processReceiptWithAI,
  markReceiptUploaded,
  subscribeToReceiptAll
} from "@/services/receiptService";
import { ProcessingLog, ProcessingStatus, Receipt } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { optimizeImageForUpload } from "@/utils/imageUtils";
import { SubscriptionEnforcementService, handleActionResult } from "@/services/subscriptionEnforcementService";

import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { PROCESSING_STAGES } from "./upload/ProcessingStages";

import { EnhancedProcessingTimeline } from "./upload/EnhancedProcessingTimeline";
import { ProcessingLogs } from "./upload/ProcessingLogs";
import { ErrorState } from "./upload/ErrorState";
import { FileAnalyzer } from "./upload/FileAnalyzer";
import { useFileUpload } from "@/hooks/useFileUpload";

import { ProcessingRecommendation, analyzeFile, getProcessingRecommendation } from "@/utils/processingOptimizer";
import { CategorySelector } from "./categories/CategorySelector";
import { Label } from "@/components/ui/label";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";
import { useOpenRouterProgress } from "@/hooks/useOpenRouterProgress";

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageHistory, setStageHistory] = useState<string[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProgressUpdating, setIsProgressUpdating] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [processingRecommendation, setProcessingRecommendation] = useState<ProcessingRecommendation | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Use settings hook instead of local state
  const { settings, updateSettings } = useSettings();
  const { t } = useReceiptsTranslation();

  // OpenRouter progress tracking
  const [openRouterProgress, openRouterActions] = useOpenRouterProgress();

  const {
    isDragging,
    isInvalidFile,
    receiptUploads,
    fileInputRef,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    openFileDialog,
    resetUpload,
  } = useFileUpload();

  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTeam } = useTeam();

  // Memoize userPreferences to prevent infinite re-renders in FileAnalyzer
  const userPreferences = useMemo(() => ({
    preferredModel: settings.selectedModel,
    preferredMethod: 'ai-vision' as const,
  }), [settings.selectedModel]);

  // Smooth progress update function - moved here to avoid temporal dead zone
  const updateProgressSmooth = useCallback((targetProgress: number) => {
    const currentProgress = uploadProgress;
    const difference = targetProgress - currentProgress;

    if (difference <= 0) return; // Don't go backwards

    setIsProgressUpdating(true);

    // Animate progress in small increments for smooth transition
    const steps = Math.max(1, Math.abs(difference));
    const increment = difference / steps;
    const duration = 400; // Total animation duration in ms
    const stepDuration = duration / steps;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const newProgress = Math.min(100, currentProgress + (increment * step));
      setUploadProgress(newProgress);

      if (step >= steps || newProgress >= targetProgress) {
        clearInterval(interval);
        setUploadProgress(targetProgress);
        // Stop the updating indicator after a short delay
        setTimeout(() => setIsProgressUpdating(false), 200);
      }
    }, stepDuration);
  }, [uploadProgress]);

  // Map processing status to UI stages
  const mapStatusToStage = (status: ProcessingStatus): string | null => {
    switch (status) {
      case 'uploading':
        return 'START';
      case 'uploaded':
        return 'FETCH';
      case 'processing':
        return 'PROCESSING';
      case 'failed':
        return 'ERROR';
      case 'complete':
        return 'COMPLETE';
      default:
        return null;
    }
  };

  // Update UI based on processing status
  useEffect(() => {
    if (processingStatus) {
      const stage = mapStatusToStage(processingStatus);
      if (stage) {
        // Only update if the stage is different or adding to history
        if (stage !== currentStage) {
          setCurrentStage(stage);
          // Add to history if not already there
          if (!stageHistory.includes(stage)) {
            setStageHistory(prev => [...prev, stage]);
          }
        }

        // Progress is now handled by log-based updates
        // Keep this for any status-based updates that don't have logs
        if (processingStatus === 'complete' && uploadProgress < 100) {
          updateProgressSmooth(100);
        } else if (processingStatus === 'failed' && uploadProgress < 100) {
          updateProgressSmooth(100);
        }

        // Update ARIA live region for accessibility
        const ariaLiveRegion = document.getElementById('upload-status');
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = `${t('upload.processing')} ${processingStatus.replace('_', ' ')}`;
          if (processingStatus === 'complete') {
            ariaLiveRegion.textContent = String(t('viewer.processedSuccessfully'));
          } else if (processingStatus === 'failed') {
            ariaLiveRegion.textContent = String(t('upload.error'));
          }
        }
      }
    }
  }, [processingStatus, currentStage, stageHistory, t, updateProgressSmooth, uploadProgress]);

  // OPTIMIZATION: Use unified subscription system for receipt status updates during upload
  useEffect(() => {
    if (!receiptId) return;

    const unsubscribe = subscribeToReceiptAll(
      receiptId,
      'upload-zone',
      {
        onReceiptUpdate: (payload) => {
          console.log('📝 Receipt status update during upload:', payload.new);
          // Type guard to ensure payload.new is a Receipt object
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const receipt = payload.new as Receipt;
            const newStatus = receipt.processing_status as ProcessingStatus;
            const newError = receipt.processing_error;

            setProcessingStatus(newStatus);

            if (newError) {
              setError(newError);
              toast.error(String(t('viewer.processingError', { error: newError })));
            } else if (newStatus === 'complete') {
              toast.success(String(t('viewer.processedSuccessfully')));
            } else if (newStatus === 'failed') {
              const errorMsg = String(t('upload.error'));
              setError(errorMsg);
              toast.error(errorMsg);
            }
          }
        }
      },
      {
        statusFilter: ['uploading', 'processing', 'complete', 'failed', 'failed_ocr', 'failed_ai']
      }
    );

    // Clean up unified subscription when component unmounts or receiptId changes
    return unsubscribe;
  }, [receiptId, t]);

  // Effect to manage preview URL for the first file
  useEffect(() => {
    let objectUrl: string | null = null;
    const firstUpload = receiptUploads[0];

    if (firstUpload && firstUpload.file && firstUpload.file.type !== 'application/pdf') {
      objectUrl = URL.createObjectURL(firstUpload.file);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null); // Reset if no file, first file is PDF, or uploads are cleared
    }

    // Cleanup function to revoke the object URL
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null); // Clear state on cleanup too
      }
    };
  }, [receiptUploads]); // Re-run when uploads change

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uploadZoneRef.current) return;

      if (e.key === 'Tab' && document.activeElement === uploadZoneRef.current) {
        uploadZoneRef.current.setAttribute('aria-selected', 'true');
      }

      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === uploadZoneRef.current) {
        e.preventDefault();
        openFileDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFileDialog]);

  // Progress mapping for granular log-based progress updates
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

  // Helper function to add local logs and update progress
  const addLocalLog = (stepName: string, message: string, forceProgress?: number) => {
    const localLog: ProcessingLog = {
      id: `local-${Date.now()}-${Math.random()}`,
      receipt_id: receiptId || 'pending',
      created_at: new Date().toISOString(),
      status_message: message,
      step_name: stepName
    };

    setProcessLogs(prev => [...prev, localLog]);

    // Update progress based on log content if not forced
    if (forceProgress !== undefined) {
      updateProgressSmooth(forceProgress);
    } else {
      updateProgressFromLog(stepName, message);
    }
  };

  // Function to update progress based on log content
  const updateProgressFromLog = (stepName: string, message: string) => {
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
      updateProgressSmooth(stageMap[bestMatch]);
    }
  };

  const processUploadedFiles = async (files: File[]) => {
    if (!user) {
      toast.error(String(t('upload.error')));
      navigate("/auth");
      return;
    }

    setError(null);
    setProcessLogs([]);
    setStageHistory([]);
    setCurrentStage('START');
    setIsUploading(true);
    setUploadProgress(0);
    setIsProgressUpdating(false);
    setStartTime(Date.now());

    // Reset OpenRouter progress for new upload
    openRouterActions.reset();

    try {
      const file = files[0];

      const ariaLiveRegion = document.getElementById('upload-status');
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Preparing ${file.name} for upload`;
      }

      // Add initial logs for immediate feedback
      addLocalLog('START', `Starting upload process for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Add file validation log
      if (file.type.startsWith('image/')) {
        addLocalLog('START', `Detected image file: ${file.type}`);
      } else if (file.type === 'application/pdf') {
        addLocalLog('START', `Detected PDF file: ${file.name}`);
      }

      // Generate processing recommendation with user preferences
      try {
        const fileAnalysis = analyzeFile(file);
        const userPreferences = {
          preferredModel: settings.selectedModel,
        };

        const recommendation = getProcessingRecommendation(fileAnalysis, userPreferences);
        setProcessingRecommendation(recommendation);

        console.log('Generated processing recommendation with user preferences:', {
          recommendedModel: recommendation.recommendedModel,
          userSelectedModel: settings.selectedModel,
          reasoning: recommendation.reasoning
        });

        addLocalLog('START', `Using AI model: ${recommendation.recommendedModel}`);
      } catch (error) {
        console.error('Failed to generate processing recommendation:', error);
        addLocalLog('START', `Using default AI model: ${settings.selectedModel}`);
        // Continue without recommendation - will fall back to user's selected model
      }

      // Using the directly imported optimizeImageForUpload function
      console.log('Using directly imported optimizeImageForUpload function');

      // Optimize the image before uploading
      let fileToUpload = file;

      // Only optimize images, not PDFs, and only if optimization is not disabled
      if (file.type.startsWith("image/") && !settings.skipUploadOptimization) {
        addLocalLog('START', 'Optimizing image for better processing...');
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = `Optimizing image for better processing`;
        }

        try {
          // Use a lower quality for larger files
          const quality = file.size > 3 * 1024 * 1024 ? 70 : 80;
          fileToUpload = await optimizeImageForUpload(file, 1500, quality);
          console.log(`Image optimized: ${file.size} bytes → ${fileToUpload.size} bytes (${Math.round(fileToUpload.size / file.size * 100)}% of original)`);

          const compressionRatio = Math.round(fileToUpload.size / file.size * 100);
          addLocalLog('START', `Image optimized: ${compressionRatio}% of original size (${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB)`);

          if (ariaLiveRegion) {
            ariaLiveRegion.textContent = `Image optimized, uploading ${fileToUpload.name}`;
          }
        } catch (optimizeError) {
          console.error("Image optimization failed, using original file:", optimizeError);
          addLocalLog('START', 'Image optimization failed, using original file');
          // Continue with original file if optimization fails
          if (ariaLiveRegion) {
            ariaLiveRegion.textContent = `Optimization skipped, uploading original file`;
          }
        }
      } else if (file.type.startsWith("image/") && settings.skipUploadOptimization) {
        addLocalLog("START", "Image optimization disabled - preserving original quality");
      } else {
        addLocalLog("START", "PDF file detected, skipping optimization");
      }

      console.log("Starting upload process with bucket: receipt-images");
      addLocalLog('FETCH', 'Starting file upload to cloud storage...');

      setProcessingStatus('uploading');
      const imageUrl = await uploadReceiptImage(fileToUpload, user.id, (progress) => {
        // Add progress logs at key milestones
        if (progress === 25) {
          addLocalLog('FETCH', 'Upload progress: 25% complete');
        } else if (progress === 50) {
          addLocalLog('FETCH', 'Upload progress: 50% complete');
        } else if (progress === 75) {
          addLocalLog('FETCH', 'Upload progress: 75% complete');
        }
      });

      if (!imageUrl) {
        throw new Error("Failed to upload image. Please try again later.");
      }

      console.log("Image uploaded successfully:", imageUrl);
      addLocalLog('FETCH', `File uploaded successfully to: ${imageUrl.split('/').pop()}`);

      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = 'Image uploaded successfully, creating receipt record';
      }

      addLocalLog('SAVE', 'Creating receipt record in database...');
      const today = new Date().toISOString().split('T')[0];
      // Fix line 274 - Remove user_id from the object as it's not in the Receipt type
      // The createReceipt function adds the user_id internally
      const newReceiptId = await createReceipt({
        merchant: "Processing...",
        date: today,
        total: 0,
        currency: "MYR",
        status: "unreviewed",
        image_url: imageUrl,
        // user_id is added by the createReceipt function automatically, remove it here
        processing_status: 'uploading', // Initialize with uploading status
        model_used: settings.selectedModel, // Use settings from the hook
        payment_method: "", // Add required field
        custom_category_id: selectedCategoryId // Include selected category
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      }, { currentTeam });

      if (!newReceiptId) {
        throw new Error("Failed to create receipt record");
      }

      setReceiptId(newReceiptId);
      addLocalLog('SAVE', `Receipt record created with ID: ${newReceiptId.slice(0, 8)}...`);

      // Mark receipt as uploaded
      await markReceiptUploaded(newReceiptId);
      addLocalLog('PROCESSING', `Starting AI processing with ${settings.selectedModel}...`);

      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Processing receipt with AI Vision`;
      }

      const channel = supabase.channel(`receipt-logs-${newReceiptId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'processing_logs',
            filter: `receipt_id=eq.${newReceiptId}`
          },
          (payload) => {
            const newLog = payload.new as ProcessingLog;
            console.log('New upload log received:', newLog);

            setProcessLogs((prev) => {
              if (prev.some(log => log.id === newLog.id)) {
                return prev;
              }
              return [...prev, newLog].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });

            // Update progress based on the received log
            if (newLog.step_name && newLog.status_message) {
              updateProgressFromLog(newLog.step_name, newLog.status_message);
            }

            if (ariaLiveRegion && newLog.status_message) {
              ariaLiveRegion.textContent = newLog.status_message;
            }
          }
        )
        .subscribe();

      const { data: initialLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', newReceiptId)
        .order('created_at', { ascending: true });

      if (initialLogs && initialLogs.length > 0) {
        setProcessLogs(initialLogs);
      }

      try {
        // ENHANCED MODEL SELECTION DEBUG - Track exact values
        console.log('🔍 MODEL SELECTION DEBUG - Raw values:', {
          'settings.selectedModel': settings.selectedModel,
          'settings.selectedModel type': typeof settings.selectedModel,
          'settings.selectedModel length': settings.selectedModel?.length,
          'processingRecommendation?.recommendedModel': processingRecommendation?.recommendedModel,
          'localStorage raw': localStorage.getItem('receiptProcessingSettings'),
          'settings object': settings
        });

        // Determine which model to use - prioritize user's explicit selection with enhanced validation
        let modelToUse: string;
        let prioritySource: string;

        // PRIORITY 1: User's explicit selection (must be non-empty string)
        if (settings.selectedModel && settings.selectedModel.trim().length > 0) {
          modelToUse = settings.selectedModel.trim();
          prioritySource = 'user_selection';
          console.log('✅ Using user selected model:', modelToUse);
        }
        // PRIORITY 2: Processing recommendation
        else if (processingRecommendation?.recommendedModel && processingRecommendation.recommendedModel.trim().length > 0) {
          modelToUse = processingRecommendation.recommendedModel.trim();
          prioritySource = 'recommendation';
          console.log('📋 Using recommended model:', modelToUse);
        }
        // PRIORITY 3: Default fallback
        else {
          modelToUse = 'gemini-2.5-flash-lite';
          prioritySource = 'default';
          console.log('⚠️ Using default model:', modelToUse);
        }

        console.log('🎯 FINAL MODEL SELECTION:', {
          userSelectedModel: settings.selectedModel,
          recommendedModel: processingRecommendation?.recommendedModel,
          finalModelUsed: modelToUse,
          prioritySource: prioritySource,
          isOpenRouterModel: modelToUse.startsWith('openrouter/'),
          modelLength: modelToUse.length
        });

        addLocalLog('PROCESSING', `Using AI model: ${modelToUse} (${prioritySource})`);

        // Check if this is an OpenRouter model for local progress tracking
        const isOpenRouterModel = modelToUse.startsWith('openrouter/');

        if (isOpenRouterModel) {
          console.log('🔄 Using OpenRouter model - enabling local progress tracking');

          // Start OpenRouter progress tracking
          openRouterActions.startProcessing(newReceiptId);

          // Process with OpenRouter progress tracking
          try {
            await processReceiptWithAI(newReceiptId, {
              modelId: modelToUse,
              uploadContext: 'single',
              onProgress: (stepName: string, message: string, progress?: number) => {
                console.log(`OpenRouter Progress: ${stepName} - ${message}${progress ? ` (${progress}%)` : ''}`);
                openRouterActions.addLog(stepName, message, progress);

                // Also add to local logs for UI consistency
                addLocalLog(stepName, message, progress);

                // Update ARIA live region
                if (ariaLiveRegion) {
                  ariaLiveRegion.textContent = message;
                }
              }
            });

            // Complete OpenRouter progress tracking
            openRouterActions.completeProcessing();
            addLocalLog('COMPLETE', 'OpenRouter processing completed successfully');
          } catch (openRouterError: unknown) {
            console.error('OpenRouter processing failed:', openRouterError);
            const errorMessage = openRouterError instanceof Error ? openRouterError.message : 'Unknown error';
            openRouterActions.failProcessing(errorMessage);
            throw openRouterError; // Re-throw to be handled by outer catch
          }
        } else {
          // Standard Edge Function processing
          console.log('🚀 Calling processReceiptWithAI with Edge Function model:', modelToUse);
          await processReceiptWithAI(newReceiptId, {
            modelId: modelToUse,
            uploadContext: 'single'
          });
        }

        addLocalLog('COMPLETE', 'Processing complete - receipt ready for review');

        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'Receipt processed successfully';
        }
      } catch (ocrError: unknown) {
        console.error("Processing error:", ocrError);
        toast.error("Processing failed. Please edit manually or try again.");
        const errorMessage = ocrError instanceof Error ? ocrError.message : 'Unknown error';
        addLocalLog('ERROR', `Processing failed: ${errorMessage}`);
        setCurrentStage('ERROR');

        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'Processing failed. Please edit the receipt manually.';
        }
      }

      setTimeout(() => {
        channel.unsubscribe();
      }, 5000);

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
          if(currentStage !== 'ERROR') navigate(`/receipt/${newReceiptId}`);
        }, 500);
      } else {
        setTimeout(() => {
          if(currentStage !== 'ERROR') navigate(`/receipt/${newReceiptId}`);
        }, 500);
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "There was an error uploading your receipt";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentStage('ERROR');

      if (document.getElementById('upload-status')) {
        document.getElementById('upload-status')!.textContent = 'Upload failed: ' + errorMessage;
      }
    }
  };

  const handleStartUpload = async () => {
    // Use receiptUploads to get the file
    const fileToUpload = receiptUploads[0]?.file;
    if (!fileToUpload) {
      openFileDialog();
      return;
    }

    // ENHANCED SECURITY: Check subscription limits before starting upload
    console.log("Checking subscription limits before upload...");
    const fileSizeMB = fileToUpload.size / (1024 * 1024);
    const enforcementResult = await SubscriptionEnforcementService.canUploadReceipt(fileSizeMB);

    if (!enforcementResult.allowed) {
      console.warn("Upload blocked by subscription limits:", enforcementResult.reason);
      handleActionResult(enforcementResult, "upload this receipt");
      return;
    }

    console.log("Subscription check passed, proceeding with upload");
    processUploadedFiles([fileToUpload]); // Pass as array as function expects it
  };

  const retryUpload = () => {
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setIsProgressUpdating(false);
    setCurrentStage(null);
    setStageHistory([]);
    setProcessLogs([]);
    setProcessingStatus(null);
    setReceiptId(null);
    setStartTime(null);

    // Reset OpenRouter progress
    openRouterActions.reset();

    resetUpload();
  };

  const getBorderStyle = () => {
    if (isInvalidFile) return "border-destructive animate-[shake_0.5s_ease-in-out]";
    if (isDragging) return "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--primary)/15%)]";
    return "border-border bg-background/50";
  };

  return (
    <div className="w-full h-full grid grid-rows-[1fr_auto] gap-2 sm:gap-4 p-2 sm:p-4">
      <div
        className={`relative w-full flex flex-col rounded-md p-3 sm:p-6 border-2 border-dashed transition-all duration-300 ${getBorderStyle()}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        ref={uploadZoneRef}
        tabIndex={0}
        role="button"
        aria-label="Upload receipt files: JPEG, PNG, or PDF (up to 5MB)"
        aria-describedby="upload-zone-description upload-status"
      >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/jpeg,image/png,application/pdf"
        aria-hidden="true"
      />

      <div
        id="upload-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isUploading ? 'Uploading receipt files' : 'Ready to upload receipt files'}
      </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center gap-2 sm:gap-3 flex-shrink-0 py-2 sm:py-4">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={`relative rounded-full p-3 sm:p-4 ${
                isDragging ? "bg-primary/10" : (isUploading ? "bg-secondary/80" : "bg-secondary")
              }`}
            >
              {isUploading ? (
                <Loader2 size={24} className="sm:w-8 sm:h-8 text-primary animate-spin" />
              ) : error ? (
                <XCircle size={24} className="sm:w-8 sm:h-8 text-destructive" />
              ) : isDragging ? (
                <Upload size={24} className="sm:w-8 sm:h-8 text-primary" />
              ) : (
                <Upload size={24} className="sm:w-8 sm:h-8 text-primary" />
              )}
            </motion.div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-medium">
                {isUploading
                  ? currentStage ? PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.name || "Processing..." : "Uploading..."
                  : error
                    ? "Upload Failed"
                    : isDragging
                      ? "Drop Files Here"
                      : "Upload Receipt"}
              </h3>
              <p
                id="upload-zone-description"
                className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto px-2"
              >
                {isUploading
                  ? currentStage === 'ERROR'
                    ? "An error occurred during processing"
                    : currentStage
                      ? PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.description || `Processing your receipt (${uploadProgress}%)`
                      : `Processing your receipt (${uploadProgress}%)`
                  : error
                    ? error
                    : isDragging
                      ? isInvalidFile
                        ? "This file type is not supported"
                        : "Release to start upload"
                      : "Drag & drop your receipt images or PDFs here, or click to browse"
                }
              </p>
            </div>
          </div>

          {/* Content Section - Scrollable */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 overflow-y-auto px-4">

            <AnimatePresence>
              {receiptUploads.length > 0 && !isUploading && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full max-w-2xl space-y-4 flex-shrink-0"
                >
                  {/* File Preview */}
                  <div className="p-4 border rounded-lg bg-secondary/50 flex items-center space-x-4">
                    {receiptUploads[0].file.type === 'application/pdf' ? (
                      <FileText className="w-10 h-10 text-muted-foreground flex-shrink-0" />
                    ) : previewUrl ? (
                      <img src={previewUrl} alt={`Preview of ${receiptUploads[0].file.name}`} className="w-16 h-16 object-cover rounded flex-shrink-0" />
                    ) : (
                      <FileImage className="w-10 h-10 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-grow overflow-hidden">
                      <p className="text-sm font-medium truncate">{receiptUploads[0].file.name}</p>
                      <p className="text-xs text-muted-foreground">{(receiptUploads[0].file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  {/* File Analysis */}
                  <FileAnalyzer
                    file={receiptUploads[0].file}
                    onRecommendationChange={setProcessingRecommendation}
                    showDetails={true}
                    compact={false}
                    userPreferences={userPreferences}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isUploading && !error && !receiptUploads.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-shrink-0"
                >
                  {isInvalidFile
                    ? DropZoneIllustrations.error
                    : isDragging
                      ? DropZoneIllustrations.drag
                      : DropZoneIllustrations.default}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing Timeline and Action Buttons */}
            <div className="w-full flex flex-col items-center gap-4 flex-shrink-0">
              {isUploading ? (
                <EnhancedProcessingTimeline
                  currentStage={currentStage}
                  stageHistory={stageHistory}
                  uploadProgress={uploadProgress}
                  fileSize={receiptUploads[0]?.file?.size}
                  processingMethod="ai-vision"
                  modelId={settings.selectedModel}
                  startTime={startTime}
                  isProgressUpdating={isProgressUpdating}
                />
              ) : error ? (
                <Button
                  onClick={retryUpload}
                  variant="default"
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base"
                  size="default"
                >
                  Try Again
                </Button>
              ) : (
                <Button
                  onClick={handleStartUpload}
                  variant="default"
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base group flex-col sm:flex-row gap-1 sm:gap-0"
                  size="default"
                >
                  <span className="sm:mr-2">
                    {receiptUploads.length > 0 ? "Upload File" : "Select File"}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-primary-foreground transition-colors">
                    JPG, PNG, PDF (up to 5MB)
                  </span>
                </Button>
              )}
            </div>

            {/* Processing Logs - Scrollable when present */}
            {isUploading && (
              <div className="w-full max-w-2xl flex-1 min-h-0 overflow-y-auto">
                <ProcessingLogs
                  processLogs={openRouterProgress.isProcessing ? openRouterProgress.logs : processLogs}
                  currentStage={openRouterProgress.isProcessing ? openRouterProgress.currentStage : currentStage}
                  showDetailedLogs={true}
                  startTime={openRouterProgress.isProcessing ? openRouterProgress.startTime : startTime}
                />
              </div>
            )}

            {currentStage === 'ERROR' && (
              <div className="w-full max-w-2xl flex-shrink-0">
                <ErrorState error={error} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Selection */}
      {!isUploading && receiptUploads.length > 0 && (
        <div className="w-full flex-shrink-0 px-4 pb-4">
          <div className="max-w-md mx-auto space-y-2">
            <Label htmlFor="category-selector">Category (Optional)</Label>
            <CategorySelector
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              placeholder="Select a category..."
              className="w-full"
            />
          </div>
        </div>
      )}


    </div>
  );
}
