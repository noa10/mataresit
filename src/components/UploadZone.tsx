import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Upload, Loader2, XCircle, AlertCircle, FileText, FileImage, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  createReceipt, 
  uploadReceiptImage, 
  processReceiptWithOCR, 
  markReceiptUploaded,
  fixProcessingStatus 
} from "@/services/receiptService";
import { ProcessingLog, ProcessingStatus, ReceiptUpload } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";

import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { PROCESSING_STAGES } from "./upload/ProcessingStages";
import { ProcessingTimeline } from "./upload/ProcessingTimeline";
import { ProcessingLogs } from "./upload/ProcessingLogs";
import { ErrorState } from "./upload/ErrorState";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ReceiptProcessingOptions } from "./upload/ReceiptProcessingOptions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [showOptions, setShowOptions] = useState(false);

  // Use settings hook instead of local state
  const { settings } = useSettings();
  
  const {
    isDragging,
    isInvalidFile,
    receiptUploads,
    selectedFileIndex,
    fileInputRef,
    setSelectedFileIndex,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    handleFiles,
    openFileDialog,
    resetUpload,
  } = useFileUpload();
  
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Map processing status to UI stages
  const mapStatusToStage = (status: ProcessingStatus): string | null => {
    switch (status) {
      case 'uploading':
        return 'START';
      case 'uploaded':
        return 'FETCH';
      case 'processing_ocr':
        return 'OCR';
      case 'processing_ai':
        return 'GEMINI';
      case 'failed_ocr':
      case 'failed_ai':
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

        // Update progress based on stage
        switch (processingStatus) {
          case 'uploading':
            setUploadProgress(30);
            break;
          case 'uploaded':
            setUploadProgress(50);
            break;
          case 'processing_ocr':
            setUploadProgress(70);
            break;
          case 'processing_ai':
            setUploadProgress(85);
            break;
          case 'complete':
            setUploadProgress(100);
            break;
          case 'failed_ocr':
          case 'failed_ai':
            setUploadProgress(100);
            break;
        }

        // Update ARIA live region for accessibility
        const ariaLiveRegion = document.getElementById('upload-status');
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = `Receipt processing ${processingStatus.replace('_', ' ')}`;
          if (processingStatus === 'complete') {
            ariaLiveRegion.textContent = 'Receipt processed successfully';
          } else if (processingStatus === 'failed_ocr' || processingStatus === 'failed_ai') {
            ariaLiveRegion.textContent = `Receipt processing failed: ${processingStatus}`;
          }
        }
      }
    }
  }, [processingStatus, currentStage, stageHistory]);

  // Subscribe to receipt processing status updates
  useEffect(() => {
    if (!receiptId) return;

    const statusChannel = supabase.channel(`receipt-status-${receiptId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `id=eq.${receiptId}`
        },
        (payload) => {
          console.log('Receipt status update:', payload.new);
          const newStatus = payload.new.processing_status as ProcessingStatus;
          const newError = payload.new.processing_error;
          
          setProcessingStatus(newStatus);
          
          if (newError) {
            setError(newError);
            toast.error(`Processing error: ${newError}`);
          } else if (newStatus === 'complete') {
            toast.success("Receipt processed successfully!");
          } else if (newStatus === 'failed_ocr' || newStatus === 'failed_ai') {
            const errorMsg = newStatus === 'failed_ocr' 
              ? "OCR processing failed. Please edit manually."
              : "AI analysis failed. Please edit manually.";
            setError(errorMsg);
            toast.error(errorMsg);
          }
        }
      )
      .subscribe();

    // Clean up subscription when component unmounts or receiptId changes
    return () => {
      statusChannel.unsubscribe();
    };
  }, [receiptId]);

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
  
  const processUploadedFiles = async (files: File[]) => {
    if (!user) {
      toast.error("Please login first");
      navigate("/auth");
      return;
    }

    setError(null);
    setProcessLogs([]);
    setStageHistory([]);
    setCurrentStage('QUEUED');
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const file = files[0];
      
      const ariaLiveRegion = document.getElementById('upload-status');
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Uploading ${file.name}`;
      }
      
      console.log("Starting upload process with bucket: receipt-images");
      
      setUploadProgress(30);
      setProcessingStatus('uploading');
      const imageUrl = await uploadReceiptImage(file, user.id, (progress) => {
        // Update progress percentage based on upload progress
        const scaledProgress = Math.floor(progress * 0.5); // Scale to 0-50%
        setUploadProgress(scaledProgress);
      });
      
      if (!imageUrl) {
        throw new Error("Failed to upload image. Please try again later.");
      }
      
      console.log("Image uploaded successfully:", imageUrl);
      setUploadProgress(50);
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = 'Image uploaded successfully, creating receipt record';
      }
      
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
        primary_method: settings.processingMethod, // Use settings from the hook
        model_used: settings.selectedModel, // Use settings from the hook
        has_alternative_data: settings.compareWithAlternative, // Use settings from the hook
        payment_method: "" // Add required field
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });
      
      if (!newReceiptId) {
        throw new Error("Failed to create receipt record");
      }
      
      setReceiptId(newReceiptId);
      setUploadProgress(60);
      
      // Mark receipt as uploaded
      await markReceiptUploaded(newReceiptId);
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Processing receipt with ${settings.processingMethod === 'ocr-ai' ? 'OCR + AI' : 'AI Vision'}`;
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
        // Process with settings from the hook
        await processReceiptWithOCR(newReceiptId, {
          primaryMethod: settings.processingMethod,
          modelId: settings.selectedModel,
          compareWithAlternative: settings.compareWithAlternative
        });
        setUploadProgress(100);
        
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'Receipt processed successfully';
        }
      } catch (ocrError: any) {
        console.error("Processing error:", ocrError);
        toast.info("Receipt uploaded, but processing failed. Please edit manually.");
        setUploadProgress(100);
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
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.message || "There was an error uploading your receipt");
      toast.error(error.message || "There was an error uploading your receipt");
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentStage('ERROR');
      
      if (document.getElementById('upload-status')) {
        document.getElementById('upload-status')!.textContent = 'Upload failed: ' + (error.message || "Unknown error");
      }
    }
  };

  const handleStartUpload = () => {
    // Use receiptUploads to get the file
    const fileToUpload = receiptUploads[0]?.file;
    if (fileToUpload) {
      processUploadedFiles([fileToUpload]); // Pass as array as function expects it
    } else {
      openFileDialog();
    }
  };
  
  const retryUpload = () => {
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStage(null);
    setStageHistory([]);
    setProcessLogs([]);
    setProcessingStatus(null);
    setReceiptId(null);
    resetUpload();
  };

  const getBorderStyle = () => {
    if (isInvalidFile) return "border-destructive animate-[shake_0.5s_ease-in-out]";
    if (isDragging) return "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--primary)/15%)]";
    return "border-border bg-background/50";
  };

  return (
    <div 
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-md p-6 border-2 border-dashed transition-all duration-300 ${getBorderStyle()}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={uploadZoneRef}
      tabIndex={0}
      role="button"
      aria-label="Upload receipt files: JPEG, PNG, or PDF"
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
      
      <div className="flex flex-col items-center justify-center text-center gap-4 flex-grow">
        <div className="flex flex-col items-center gap-3">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`relative rounded-full p-6 ${
              isDragging ? "bg-primary/10" : (isUploading ? "bg-secondary/80" : "bg-secondary")
            }`}
          >
            {isUploading ? (
              <Loader2 size={36} className="text-primary animate-spin" />
            ) : error ? (
              <XCircle size={36} className="text-destructive" />
            ) : isDragging ? (
              <Upload size={36} className="text-primary" />
            ) : (
              <Upload size={36} className="text-primary" />
            )}
          </motion.div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">
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
              className="text-base text-muted-foreground max-w-md mx-auto"
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

        <AnimatePresence>
          {receiptUploads.length > 0 && !isUploading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-md mt-4 p-4 border rounded-lg bg-secondary/50 flex items-center space-x-4"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isUploading && !error && !receiptUploads.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="my-4"
            >
              {isInvalidFile 
                ? DropZoneIllustrations.error 
                : isDragging 
                  ? DropZoneIllustrations.drag 
                  : DropZoneIllustrations.default}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing options removed - now managed in settings page */}

        <div className="w-full flex justify-center items-center mt-4">
          {isUploading ? (
            <ProcessingTimeline 
              currentStage={currentStage} 
              stageHistory={stageHistory} 
              uploadProgress={uploadProgress} 
            />
          ) : error ? (
            <Button 
              onClick={retryUpload}
              variant="default" 
              className="mt-4 px-6 py-2 text-base"
              size="lg"
            >
              Try Again
            </Button>
          ) : (
            <Button 
              onClick={handleStartUpload}
              variant="default" 
              className="mt-4 px-6 py-2 text-base group"
              size="lg"
            >
              <span className="mr-2">
                {receiptUploads.length > 0 ? "Upload File" : "Select File"}
              </span>
              <span className="text-xs text-muted-foreground group-hover:text-primary-foreground transition-colors">
                JPG, PNG, PDF
              </span>
            </Button>
          )}
        </div>

        <div className="w-full max-w-2xl mt-auto">
          {isUploading && processLogs.length > 0 && (
            <ProcessingLogs processLogs={processLogs} currentStage={currentStage} />
          )}
          
          {currentStage === 'ERROR' && <ErrorState error={error} />}
        </div>
      </div>
    </div>
  );
}
