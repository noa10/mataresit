
import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Check, Loader2, XCircle, AlertCircle, Image, FileText, File } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createReceipt, uploadReceiptImage, processReceiptWithOCR } from "@/services/receiptService";
import { ProcessingLog } from "@/types/receipt";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Define processing stages with their details
const PROCESSING_STAGES = {
  QUEUED: {
    name: "Queued",
    description: "Receipt is queued for processing",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-400 border-blue-400"
  },
  START: {
    name: "Started",
    description: "Processing has started",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-blue-500 border-blue-500"
  },
  FETCH: {
    name: "Fetching",
    description: "Fetching receipt image",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-indigo-500 border-indigo-500"
  },
  OCR: {
    name: "OCR",
    description: "Performing OCR on receipt",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-purple-500 border-purple-500"
  },
  EXTRACT: {
    name: "Extracting",
    description: "Extracting data from OCR results",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-violet-500 border-violet-500"
  },
  GEMINI: {
    name: "Analyzing",
    description: "Analyzing receipt with AI",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-fuchsia-500 border-fuchsia-500"
  },
  SAVE: {
    name: "Saving",
    description: "Saving processed data",
    icon: <Loader2 size={16} className="animate-spin" />,
    color: "text-pink-500 border-pink-500"
  },
  COMPLETE: {
    name: "Complete",
    description: "Processing complete",
    icon: <Check size={16} />,
    color: "text-green-500 border-green-500"
  },
  ERROR: {
    name: "Error",
    description: "An error occurred during processing",
    icon: <XCircle size={16} />,
    color: "text-red-500 border-red-500"
  }
};

// SVG illustrations for drop zone states
const DropZoneIllustrations = {
  default: (
    <motion.div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <motion.path 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          d="M40 28V52" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
        <motion.path 
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          d="M28 40H52" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
      </svg>
      <motion.span 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-sm text-muted-foreground"
      >
        Add receipts
      </motion.span>
    </motion.div>
  ),
  drag: (
    <motion.div 
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
      className="flex flex-col items-center gap-2"
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" />
        <path d="M40 28V52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 40H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">Drop files here</span>
    </motion.div>
  ),
  error: (
    <motion.div 
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 0.95, 1.05, 1] }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-2 text-destructive"
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="56" height="56" rx="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="40" cy="40" r="16" stroke="currentColor" strokeWidth="2" />
        <path d="M34 34L46 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 34L34 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">Invalid file type</span>
    </motion.div>
  )
};

// File type icon selector
const getFileTypeIcon = (type: string) => {
  if (type.startsWith('image/')) {
    return <Image size={24} className="text-blue-500" />;
  } else if (type === 'application/pdf') {
    return <FileText size={24} className="text-red-500" />;
  }
  return <File size={24} className="text-gray-500" />;
};

interface FilePreview {
  id: string;
  file: File;
  preview: string;
}

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

// Note: This component is designed to be placed inside a Modal/Dialog Content area.
// The modal trigger and container should be handled by the parent component.
export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isInvalidFile, setIsInvalidFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageHistory, setStageHistory] = useState<string[]>([]);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Effect to update current stage when new logs come in
  useEffect(() => {
    if (processLogs.length > 0) {
      const latestLog = processLogs[processLogs.length - 1];
      if (latestLog.step_name) {
        setCurrentStage(latestLog.step_name);
        
        // Update stage history (don't add duplicates)
        setStageHistory(prev => {
          if (!prev.includes(latestLog.step_name!)) {
            return [...prev, latestLog.step_name!];
          }
          return prev;
        });
        
        // Set progress based on stage
        const stageIndex = Object.keys(PROCESSING_STAGES).indexOf(latestLog.step_name);
        const totalStages = Object.keys(PROCESSING_STAGES).length - 2; // Exclude ERROR and QUEUED
        if (latestLog.step_name === 'COMPLETE') {
          setUploadProgress(100);
        } else if (latestLog.step_name === 'ERROR') {
          // Keep current progress but show error state
        } else if (stageIndex > 0) {
          const newProgress = Math.round((stageIndex / totalStages) * 100);
          setUploadProgress(Math.max(newProgress, uploadProgress));
        }
      }
    }
  }, [processLogs]);

  // Clean up file previews when component unmounts
  useEffect(() => {
    return () => {
      filePreviews.forEach(filePreview => {
        if (filePreview.preview.startsWith('blob:')) {
          URL.revokeObjectURL(filePreview.preview);
        }
      });
    };
  }, [filePreviews]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uploadZoneRef.current) return;
      
      // Focus the upload zone when the user presses Tab
      if (e.key === 'Tab' && document.activeElement === uploadZoneRef.current) {
        uploadZoneRef.current.setAttribute('aria-selected', 'true');
      }
      
      // Trigger file input when user presses Enter or Space on the upload zone
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === uploadZoneRef.current) {
        e.preventDefault();
        openFileDialog();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
      
      // Check if files are valid
      const isValid = Array.from(e.dataTransfer.items).every(item => {
        const { type } = item;
        return type === 'image/jpeg' || type === 'image/png' || type === 'application/pdf';
      });
      
      setIsInvalidFile(!isValid);
    }
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
      setIsInvalidFile(false);
    }
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    setIsInvalidFile(false);
    dragCounterRef.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, []);
  
  const validateFile = (file: File): boolean => {
    const fileType = file.type;
    return fileType === 'image/jpeg' || 
           fileType === 'image/png' || 
           fileType === 'application/pdf';
  };
  
  const createFilePreview = (file: File): string => {
    if (file.type === 'application/pdf') {
      // For PDFs, we could use a generic PDF icon or fetch the first page
      return './placeholder.svg';
    }
    return URL.createObjectURL(file);
  };
  
  const handleFiles = async (files: FileList) => {
    if (!user) {
      toast.error("Please login first");
      navigate("/auth");
      return;
    }

    setError(null);
    setProcessLogs([]);
    setStageHistory([]);
    setCurrentStage('QUEUED');
    
    const validFiles = Array.from(files).filter(validateFile);
    
    if (validFiles.length === 0) {
      toast.error("Invalid file format. Please upload JPEG, PNG, or PDF files.");
      setIsInvalidFile(true);
      setTimeout(() => setIsInvalidFile(false), 2000);
      return;
    }
    
    // Create previews for all valid files
    const newFilePreviews = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: createFilePreview(file)
    }));
    
    setFilePreviews(newFilePreviews);
    setSelectedFileIndex(0);
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // Process each file sequentially
      // For now, just process the first file as the API might not support batch processing
      const file = validFiles[0];
      
      // Update ARIA live region for screen readers
      const ariaLiveRegion = document.getElementById('upload-status');
      if (ariaLiveRegion) {
        ariaLiveRegion.textContent = `Uploading ${file.name}`;
      }
      
      console.log("Starting upload process with bucket: receipt-images");
      
      // Upload the image
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
      
      // Create a receipt record with placeholder data
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

      // Subscribe to logs for this receipt
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
            
            // Update ARIA live region for processing updates
            if (ariaLiveRegion && newLog.status_message) {
              ariaLiveRegion.textContent = newLog.status_message;
            }
          }
        )
        .subscribe();
      
      // Also fetch initial logs
      const { data: initialLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });
      
      if (initialLogs && initialLogs.length > 0) {
        setProcessLogs(initialLogs);
      }
      
      // Process the receipt with OCR
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
      
      // Clean up subscription
      setTimeout(() => {
        channel.unsubscribe();
      }, 5000); 
      
      // Navigate or call callback on completion
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
  
  const openFileDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  const retryUpload = useCallback(() => {
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStage(null);
    setStageHistory([]);
    setProcessLogs([]);
    setFilePreviews([]);
  }, []);

  const getStepColor = (step: string | null) => {
    if (!step) return 'text-gray-500';
    const stageInfo = PROCESSING_STAGES[step as keyof typeof PROCESSING_STAGES];
    if (stageInfo) return stageInfo.color.split(' ')[0];
    return 'text-gray-500';
  };

  const renderProcessingTimeline = () => {
    const orderedStages = ['START', 'FETCH', 'OCR', 'EXTRACT', 'GEMINI', 'SAVE', 'COMPLETE'];
    return (
      <div className="mt-6 pt-4 w-full">
        <div className="flex items-start justify-between relative px-2">
          {/* Progress bar behind the steps */}
          <div className="absolute left-0 top-[20px] w-full h-1 bg-muted -translate-y-1/2">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          
          {/* Steps */}
          {orderedStages.map((stage, idx) => {
            const stageConfig = PROCESSING_STAGES[stage as keyof typeof PROCESSING_STAGES];
            const isCurrent = currentStage === stage;
            const isCompleted = stageHistory.includes(stage) || 
                               currentStage === 'COMPLETE' || 
                               orderedStages.indexOf(currentStage || '') > idx;
            const isError = currentStage === 'ERROR';
            
            let stateClass = "bg-muted text-muted-foreground border-muted";
            if (isCompleted && !isError) stateClass = "bg-primary text-primary-foreground border-primary";
            else if (isCurrent && !isError) stateClass = `bg-background ${stageConfig.color}`;
            else if (isError && (isCurrent || isCompleted)) stateClass = `bg-destructive/20 ${PROCESSING_STAGES.ERROR.color}`;
            
            return (
              <TooltipProvider key={stage}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="z-10 flex flex-col items-center gap-2 flex-1 min-w-0 px-1">
                      <motion.div 
                        className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${stateClass}`}
                        animate={{ scale: isCurrent && !isError ? [1, 1.1, 1] : 1 }}
                        transition={{ duration: 0.5, repeat: isCurrent && !isError ? Infinity : 0, repeatDelay: 1 }}
                      >
                        {isError && (isCurrent || isCompleted) ? (
                          PROCESSING_STAGES.ERROR.icon
                        ) : isCompleted ? (
                          <Check size={18} />
                        ) : isCurrent ? (
                          stageConfig.icon
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-current" />
                        )}
                      </motion.div>
                      <span className="text-xs uppercase font-medium text-center break-words w-full">
                        {stageConfig.name}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="px-4 py-3 text-sm max-w-[200px] text-center bg-background border shadow-md">
                    <p>{stageConfig.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    );
  };

  const renderErrorState = () => {
    if (!error) return null;
    return (
      <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-md text-sm w-full">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Processing Error</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderFilePreview = () => {
    if (filePreviews.length === 0) return null;
    const selectedFile = filePreviews[selectedFileIndex];
    
    return (
      <div className="mt-4 w-full">
        <div className="relative aspect-[3/4] max-w-[200px] mx-auto rounded-lg overflow-hidden border border-border">
          {selectedFile.file.type === 'application/pdf' ? (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <FileText size={48} className="text-primary/50" />
              <span className="absolute bottom-2 text-xs text-muted-foreground">{selectedFile.file.name}</span>
            </div>
          ) : (
            <img 
              src={selectedFile.preview} 
              alt={selectedFile.file.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>
        
        {filePreviews.length > 1 && (
          <div className="mt-3 flex justify-center gap-2 overflow-x-auto px-2 max-w-full">
            {filePreviews.map((preview, index) => (
              <button
                key={preview.id}
                className={`relative min-w-12 w-12 h-12 border-2 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                  index === selectedFileIndex ? 'border-primary' : 'border-border'
                }`}
                onClick={() => setSelectedFileIndex(index)}
                aria-label={`Select file ${index + 1}: ${preview.file.name}`}
              >
                {preview.file.type === 'application/pdf' ? (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center">
                    <FileText size={16} className="text-primary/70" />
                  </div>
                ) : (
                  <img 
                    src={preview.preview} 
                    alt={`Thumbnail ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
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
      
      {/* ARIA live region for accessibility */}
      <div 
        id="upload-status" 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {isUploading ? 'Uploading receipt files' : 'Ready to upload receipt files'}
      </div>
      
      <div className="flex flex-col items-center justify-center text-center gap-4 flex-grow">
        {/* Top section (Icon & Text) */}
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

        {/* File Previews (if any) */}
        <AnimatePresence>
          {filePreviews.length > 0 && isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              {renderFilePreview()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SVG Illustrations for various states */}
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

        {/* Middle section (Timeline or Buttons) */}
        <div className="w-full flex justify-center items-center mt-4">
          {isUploading ? (
            renderProcessingTimeline()
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
              onClick={openFileDialog}
              variant="default" 
              className="mt-4 px-6 py-2 text-base group"
              size="lg"
            >
              <span className="mr-2">Select Files</span>
              <span className="text-xs text-muted-foreground group-hover:text-primary-foreground transition-colors">
                JPG, PNG, PDF
              </span>
            </Button>
          )}
        </div>

        {/* Bottom section (Logs / Error Details) */} 
        <div className="w-full max-w-2xl mt-auto">
          {isUploading && processLogs.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-base font-medium">Processing Log</h4>
                {currentStage && (
                  <Badge variant="outline" className={`px-3 py-1 text-sm ${getStepColor(currentStage)}`}>
                    {PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.name || currentStage}
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-[180px] w-full rounded-md border mt-3 bg-background/80 p-4">
                <div className="space-y-2">
                  {processLogs.map((log, index) => (
                    <div key={log.id || index} className="text-sm flex items-start">
                      <span className={`font-medium mr-2 ${getStepColor(log.step_name)}`}>
                        {log.step_name || 'INFO'}:
                      </span>
                      <span className="text-muted-foreground break-all">{log.status_message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {currentStage === 'ERROR' && renderErrorState()}
        </div>
      </div>
    </div>
  );
}

