import { useState, useRef, useEffect } from "react";
import { Upload, Check, Loader2, XCircle } from "lucide-react";
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

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<ProcessingLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
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
      
      // Log for debugging
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
            
            // Add new log to the list
            setProcessLogs((prev) => {
              // Check if we already have this log (avoid duplicates)
              if (prev.some(log => log.id === newLog.id)) {
                return prev;
              }
              // Add and sort by created_at
              return [...prev, newLog].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        )
        .subscribe();
      
      // Also fetch initial logs in case some were missed before subscription setup
      const { data: initialLogs } = await supabase
        .from('processing_logs')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });
      
      if (initialLogs && initialLogs.length > 0) {
        setProcessLogs(initialLogs);
      }
      
      // Process the receipt with OCR (if OCR fails, we still have the uploaded receipt)
      try {
        await processReceiptWithOCR(receiptId);
        setUploadProgress(100);
        toast.success("Receipt processed successfully!");
      } catch (ocrError: any) {
        console.error("OCR processing error:", ocrError);
        toast.info("Receipt uploaded, but OCR processing failed. Please edit manually.");
        setUploadProgress(100);
      }
      
      // Clean up subscription
      setTimeout(() => {
        channel.unsubscribe();
      }, 5000); // Unsubscribe after 5 seconds to allow for final logs
      
      // Navigate to the receipt page regardless of OCR success/failure
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
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.message || "There was an error uploading your receipt");
      toast.error(error.message || "There was an error uploading your receipt");
      setIsUploading(false);
      setUploadProgress(0);
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
  };

  // Function to get step color for visual display
  const getStepColor = (step: string | null) => {
    switch (step) {
      case 'START':
        return 'text-blue-500';
      case 'FETCH':
        return 'text-indigo-500';
      case 'OCR':
        return 'text-purple-500';
      case 'EXTRACT':
        return 'text-violet-500';
      case 'GEMINI':
        return 'text-fuchsia-500';
      case 'SAVE':
        return 'text-pink-500';
      case 'COMPLETE':
        return 'text-green-500';
      case 'ERROR':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-xl p-8 border-2 border-dashed transition-all duration-300 ${
          isDragging 
            ? "border-primary bg-primary/5" 
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
        
        <div className="flex flex-col items-center justify-center gap-4 py-4">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20 
            }}
            className={`rounded-full p-5 ${
              isDragging ? "bg-primary/10" : "bg-secondary"
            }`}
          >
            {isUploading ? (
              <Loader2 size={30} className="text-primary animate-spin" />
            ) : error ? (
              <XCircle size={30} className="text-destructive" />
            ) : (
              <Upload size={30} className="text-primary" />
            )}
          </motion.div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">
              {isUploading 
                ? "Uploading..." 
                : error 
                  ? "Upload Failed" 
                  : "Upload Receipt"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {isUploading 
                ? `Processing your receipt (${uploadProgress}%)`
                : error
                  ? error
                  : "Drag & drop your receipt images or PDFs here, or click to browse"
              }
            </p>
          </div>
          
          {isUploading ? (
            <div className="w-full max-w-xs">
              <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              
              {/* Display processing logs */}
              {processLogs.length > 0 && (
                <div className="mt-4">
                  <ScrollArea className="h-[150px] w-full rounded-md border mt-2 bg-background/80 p-2">
                    <div className="space-y-1">
                      {processLogs.map((log, index) => (
                        <div key={log.id || index} className="text-xs flex">
                          <span className={`font-medium mr-2 ${getStepColor(log.step_name)}`}>
                            {log.step_name || 'INFO'}:
                          </span>
                          <span className="text-muted-foreground">{log.status_message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : error ? (
            <Button 
              onClick={retryUpload}
              variant="default" 
              className="mt-2"
            >
              Try Again
            </Button>
          ) : (
            <Button 
              onClick={openFileDialog}
              variant="default" 
              className="mt-2"
            >
              Select Files
            </Button>
          )}
        </div>
      </motion.div>
      
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>Supported formats: JPEG, PNG, PDF</p>
      </div>
    </div>
  );
}
