
import { useState, useRef } from "react";
import { Upload, Check, Loader2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createReceipt, uploadReceiptImage } from "@/services/receiptService";

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      
      // Simulate OCR processing
      setUploadProgress(30);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Upload the image
      setUploadProgress(50);
      const imageUrl = await uploadReceiptImage(file, user.id);
      
      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }
      
      setUploadProgress(70);
      
      // Create a mock receipt record
      const today = new Date().toISOString().split('T')[0];
      const receiptId = await createReceipt({
        merchant: "Unknown Merchant",
        date: today,
        total: 0,
        currency: "USD",
        status: "unreviewed",
        image_url: imageUrl
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });
      
      setUploadProgress(100);
      
      if (receiptId) {
        toast.success("Receipt uploaded successfully!");
        setTimeout(() => {
          navigate(`/receipt/${receiptId}`);
        }, 500);
      } else {
        throw new Error("Failed to create receipt");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("There was an error uploading your receipt");
      setIsUploading(false);
    }
  };
  
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
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
            ) : (
              <Upload size={30} className="text-primary" />
            )}
          </motion.div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">
              {isUploading ? "Uploading..." : "Upload Receipt"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {isUploading 
                ? `Processing your receipt (${uploadProgress}%)`
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
            </div>
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
