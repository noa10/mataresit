import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Upload, Loader2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { createReceipt, uploadReceiptImage, processReceiptWithOCR } from "@/services/receiptService";
import { ProcessingLog } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";

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
    };
  }, []);
  
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
      const imageUrl = await uploadReceiptImage(file, user.id);
      
      if (!imageUrl) {
        throw new Error("Failed to upload image. Please try again later.");
      }
      
      console.log("Image uploaded successfully:", imageUrl);
      setUploadProgress(50);
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = 'Image uploaded successfully, creating receipt record';
      }
      
      const today = new Date().toISOString().split('T')[0];
      const receiptId = await createReceipt({
        merchant: "Processing...",
        date: today,
        total: 0,
        currency: "MYR",
        status: "unreviewed",
        image_url: imageUrl,
        user_id: user.id
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });
      
      if (!receiptId) {
        throw new Error("Failed to create receipt record");
      }
      
      setUploadProgress(70);
      
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = 'Processing receipt with OCR';
      }

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
            
            if (ariaLiveRegion && newLog.status_message) {
              ariaLiveRegion.textContent = newLog.status_message;
            }
          }
        )
        .subscribe();
      
      const { data: initialLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });
      
      if (initialLogs && initialLogs.length > 0) {
        setProcessLogs(initialLogs);
      }
      
      try {
        await processReceiptWithOCR(receiptId);
        setUploadProgress(100);
        toast.success("Receipt processed successfully!");
        
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'Receipt processed successfully';
        }
      } catch (ocrError: any) {
        console.error("OCR processing error:", ocrError);
        toast.info("Receipt uploaded, but OCR processing failed. Please edit manually.");
        setUploadProgress(100);
        setCurrentStage('ERROR');
        
        if (ariaLiveRegion) {
          ariaLiveRegion.textContent = 'OCR processing failed. Please edit the receipt manually.';
        }
      }
      
      setTimeout(() => {
        channel.unsubscribe();
      }, 5000); 
      
      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
          if(currentStage !== 'ERROR') navigate(`/receipt/${receiptId}`);
        }, 500);
      } else {
        setTimeout(() => {
          if(currentStage !== 'ERROR') navigate(`/receipt/${receiptId}`);
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
