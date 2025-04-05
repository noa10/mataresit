import { useState, useRef, useEffect } from "react";
import { Upload, Check, Loader2, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
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

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

// Note: This component is designed to be placed inside a Modal/Dialog Content area.
// The modal trigger and container should be handled by the parent component.
export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageHistory, setStageHistory] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
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
    
    const validFiles = Array.from(files).filter(file => {
      const fileType = file.type;
      return fileType === 'image/jpeg' || 
             fileType === 'image/png' || 
             fileType === 'application/pdf';
    });
    
    if (validFiles.length === 0) {
      toast.error("Invalid file format. Please upload JPEG, PNG, or PDF files.");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // For now, just process the first file
      const file = validFiles[0];
      
      console.log("Starting upload process with bucket: receipt-images");
      
      // Upload the image
      setUploadProgress(30);
      const imageUrl = await uploadReceiptImage(file, user.id);
      
      if (!imageUrl) {
        throw new Error("Failed to upload image. Please try again later.");
      }
      
      console.log("Image uploaded successfully:", imageUrl);
      setUploadProgress(50);
      
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
      } catch (ocrError: any) {
        console.error("OCR processing error:", ocrError);
        toast.info("Receipt uploaded, but OCR processing failed. Please edit manually.");
        setUploadProgress(100);
        setCurrentStage('ERROR');
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
    }
  };
  
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const retryUpload = () => {
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStage(null);
    setStageHistory([]);
    setProcessLogs([]);
  };

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

  return (
    // Removed the outer container div (w-full max-w-3xl mx-auto)
    // Removed the outer motion.div
    // Adjusted padding and container for modal context
    <div 
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-md p-6 border-2 border-dashed transition-all duration-300 ${ 
        isDragging 
          ? "border-primary bg-primary/10" 
          : "border-border bg-background/50" 
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/jpeg,image/png,application/pdf"
      />
      
      <div className="flex flex-col items-center justify-center text-center gap-4 flex-grow">
        {/* Top section (Icon & Text) - Adjusted gap */}
        <div className="flex flex-col items-center gap-3">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`rounded-full p-6 ${
              isDragging ? "bg-primary/10" : "bg-secondary"
            }`}
          >
            {isUploading ? (
              <Loader2 size={36} className="text-primary animate-spin" />
            ) : error ? (
              <XCircle size={36} className="text-destructive" />
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
                  : "Upload Receipt"}
            </h3>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              {isUploading 
                ? currentStage === 'ERROR'
                  ? "An error occurred during processing"
                  : currentStage
                    ? PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.description || `Processing your receipt (${uploadProgress}%)`
                    : `Processing your receipt (${uploadProgress}%)`
                : error
                  ? error
                  : "Drag & drop your receipt images or PDFs here, or click to browse"
              }
            </p>
          </div>
        </div>

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
              className="mt-4 px-6 py-2 text-base"
              size="lg"
            >
              Select Files
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
      {/* Removed the final 'Supported formats' text div */}
    </div>
  );
}
