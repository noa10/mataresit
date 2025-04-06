
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FilePreviewType } from "@/components/upload/FilePreview";

export function useFileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isInvalidFile, setIsInvalidFile] = useState(false);
  const [filePreviews, setFilePreviews] = useState<FilePreviewType[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const handleFiles = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter(validateFile);
    
    if (validFiles.length === 0) {
      toast.error("Invalid file format. Please upload JPEG, PNG, or PDF files.");
      setIsInvalidFile(true);
      setTimeout(() => setIsInvalidFile(false), 2000);
      return null;
    }
    
    // Create previews for all valid files
    const newFilePreviews = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: createFilePreview(file)
    }));
    
    setFilePreviews(newFilePreviews);
    setSelectedFileIndex(0);
    
    return validFiles;
  }, []);
  
  const openFileDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  const resetUpload = useCallback(() => {
    setFilePreviews([]);
    setSelectedFileIndex(0);
  }, []);
  
  // Clean up previews when component unmounts
  const cleanupPreviews = () => {
    filePreviews.forEach(filePreview => {
      if (filePreview.preview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview.preview);
      }
    });
  };
  
  return {
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
  };
}
