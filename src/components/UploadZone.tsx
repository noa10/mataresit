
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Upload, Loader2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { 
  createReceipt, 
  uploadReceiptImage, 
  processReceiptWithOCR, 
  subscribeToReceiptUpdates 
} from "@/services/receiptService";
import { ProcessingLog, ProcessingStatus } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { PROCESSING_STAGES } from "./upload/ProcessingStages";
import { FilePreview, FilePreviewType } from "./upload/FilePreview";
import { ProcessingTimeline } from "./upload/ProcessingTimeline";
import { ProcessingLogs } from "./upload/ProcessingLogs";
import { ErrorState } from "./upload/ErrorState";
import { useFileUpload } from "@/hooks/useFileUpload";

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
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [processingLogsChannel, setProcessingLogsChannel] = useState<RealtimeChannel | null>(null);
  
  const {
    isDragging,
    isInvalidFile,
    filePreviews,
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
    cleanupPreviews
  } = useFileUpload();
  
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Update UI state based on processing status
  const updateUIForProcessingStatus = (status: ProcessingStatus, errorMsg?: string | null) => {
    if (!status) return;

    // Map processing status to UI state
    switch (status) {
      case "queued":
        setCurrentStage("QUEUED");
        setUploadProgress(5);
        break;
      case "uploading":
        setCurrentStage("FETCH");
        // Don't update progress here as we get more granular progress from the upload function
        break;
      case "uploaded":
        setCurrentStage("START");
        setUploadProgress(30);
        break;
      case "processing_ocr":
        setCurrentStage("OCR");
        setUploadProgress(50);
        break;
      case "processing_ai":
        setCurrentStage("GEMINI");
        setUploadProgress(70);
        break;
      case "complete":
        setCurrentStage("COMPLETE");
        setUploadProgress(100);
        break;
      case "failed_ocr":
      case "failed_ai":
        setCurrentStage("ERROR");
        setError(errorMsg || "Processing failed");
        break;
    }

    if (status !== "uploading") {
      setStageHistory(prev => {
        if (currentStage && !prev.includes(currentStage)) {
          return [...prev, currentStage];
        }
        return prev;
      });
    }
  };
  
  // Handle real-time updates to receipt processing status
  useEffect(() => {
    if (!receiptId) return;

    const channel = subscribeToReceiptUpdates(receiptId, (payload) => {
      const newData = payload.new;
      console.log("Receipt update received:", newData);
      
      if (newData.processing_status) {
        updateUIForProcessingStatus(newData.processing_status as ProcessingStatus, newData.processing_error);
      }

      // Handle completion
      if (newData.processing_status === "complete") {
        toast.success("Receipt processed successfully!");
        
        if (document.getElementById('upload-status')) {
          document.getElementById('upload-status')!.textContent = 'Receipt processed successfully';
        }
        
        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete();
            navigate(`/receipt/${receiptId}`);
          }, 500);
        } else {
          setTimeout(() => {
            navigate(`/receipt/${receiptId}`);
          }, 500);
        }
      }
      
      // Handle errors
      if (newData.processing_status === "failed_ocr" || newData.processing_status === "failed_ai") {
        toast.error(newData.processing_error || "There was an error processing your receipt");
        
        if (document.getElementById('upload-status')) {
          document.getElementById('upload-status')!.textContent = 
            'Upload failed: ' + (newData.processing_error || "Unknown error");
        }
      }
    });
    
    setRealtimeChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [receiptId, navigate, onUploadComplete]);
  
  useEffect(() => {
    if (processLogs.length > 0) {
      const latestLog = processLogs[processLogs.length - 1];
      if (latestLog.step_name) {
        setCurrentStage(latestLog.step_name);
        
        setStageHistory(prev => {
          if (!prev.includes(latestLog.step_name!)) {
            return [...prev, latestLog.step_name!];
          }
          return prev;
        });
        
        const stageIndex = Object.keys(PROCESSING_STAGES).indexOf(latestLog.step_name);
        const totalStages = Object.keys(PROCESSING_STAGES).length - 2;
        if (latestLog.step_name === 'COMPLETE') {
          setUploadProgress(100);
        } else if (latestLog.step_name === 'ERROR') {
        } else if (stageIndex > 0) {
          const newProgress = Math.round((stageIndex / totalStages) * 100);
          setUploadProgress(Math.max(newProgress, uploadProgress));
        }
      }
    }
  }, [processLogs, uploadProgress]);

  useEffect(() => {
    return () => {
      cleanupPreviews();
      // Clean up channels on unmount
      if (realtimeChannel) realtimeChannel.unsubscribe();
      if (processingLogsChannel) processingLogsChannel.unsubscribe();
    };
  }, [cleanupPreviews, realtimeChannel, processingLogsChannel]);
  
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
  
  const setupProcessingLogsSubscription = (receiptId: string) => {
    const channel = supabase.channel(`receipt-logs-${receiptId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'processing_logs',
          filter: `receipt_id=eq.${receiptId}`
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
          
          if (document.getElementById('upload-status') && newLog.status_message) {
            document.getElementById('upload-status')!.textContent = newLog.status_message;
          }
        }
      )
      .subscribe();
    
    setProcessingLogsChannel(channel);
    return channel;
  };

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
    setUploadProgress(5);
    
    try {
      const file = files[0];
      
      const ariaLiveRegion = document.getElementById('upload-status');
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Preparing to upload ${file.name}`;
      }
      
      // Create the receipt record with initial status
      const today = new Date().toISOString().split('T')[0];
      const newReceiptId = await createReceipt({
        merchant: "Processing...",
        date: today,
        total: 0,
        currency: "MYR",
        status: "unreviewed",
        image_url: "",
        user_id: user.id
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });
      
      if (!newReceiptId) {
        throw new Error("Failed to create receipt record");
      }
      
      setReceiptId(newReceiptId);
      
      // Set up subscription to processing logs
      const logsChannel = setupProcessingLogsSubscription(newReceiptId);
      
      // Fetch any existing logs
      const { data: initialLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', newReceiptId)
        .order('created_at', { ascending: true });
      
      if (initialLogs && initialLogs.length > 0) {
        setProcessLogs(initialLogs);
      }
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Uploading ${file.name}`;
      }
      
      // Upload the receipt image with progress tracking
      const imageUrl = await uploadReceiptImage(
        file, 
        user.id, 
        newReceiptId,
        (progress) => setUploadProgress(Math.min(30 + Math.round(progress * 0.2), 50))
      );
      
      if (!imageUrl) {
        throw new Error("Failed to upload image. Please try again later.");
      }
      
      // Update the receipt with the image URL
      const { error: updateError } = await supabase
        .from("receipts")
        .update({ image_url: imageUrl })
        .eq("id", newReceiptId);
        
      if (updateError) {
        console.error("Error updating receipt with image URL:", updateError);
      }
      
      console.log("Image uploaded successfully:", imageUrl);
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = 'Image uploaded successfully, processing with OCR';
      }
      
      try {
        // Process the receipt with OCR
        await processReceiptWithOCR(newReceiptId);
      } catch (ocrError: any) {
        console.error("OCR processing error:", ocrError);
        toast.info("Receipt uploaded, but OCR processing failed. Please edit manually.");
        
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'OCR processing failed. Please edit the receipt manually.';
        }
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
    if (filePreviews.length > 0) {
      const files = filePreviews.map(preview => preview.file);
      processUploadedFiles(files);
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
    setReceiptId(null);
    resetUpload();
    
    // Clean up any existing subscriptions
    if (realtimeChannel) realtimeChannel.unsubscribe();
    if (processingLogsChannel) processingLogsChannel.unsubscribe();
    setRealtimeChannel(null);
    setProcessingLogsChannel(null);
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

        {isUploading && (
          <div className="w-full max-w-md mt-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-right">{uploadProgress}%</p>
          </div>
        )}

        <AnimatePresence>
          {filePreviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <FilePreview
                filePreviews={filePreviews}
                selectedFileIndex={selectedFileIndex}
                setSelectedFileIndex={setSelectedFileIndex}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isUploading && !error && !filePreviews.length && (
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
                {filePreviews.length > 0 ? "Upload Files" : "Select Files"}
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
