import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ReceiptUpload } from "@/types/receipt";

export function useFileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isInvalidFile, setIsInvalidFile] = useState(false);
  const [receiptUploads, setReceiptUploads] = useState<ReceiptUpload[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const fileType = file.type;
    return fileType === 'image/jpeg' ||
           fileType === 'image/png' ||
           fileType === 'application/pdf';
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

    console.log('File drop event in useFileUpload:', e.dataTransfer.files);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change in useFileUpload:', e.target.files);

    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    console.log('handleFiles called in useFileUpload with:', files);
    const validFiles = Array.from(files).filter(validateFile);

    console.log('Valid files in useFileUpload:', validFiles);

    if (validFiles.length === 0) {
      console.error('No valid files found in useFileUpload');
      toast.error("Invalid file format. Please upload JPEG, PNG, or PDF files.");
      setIsInvalidFile(true);
      setTimeout(() => setIsInvalidFile(false), 2000);
      return null;
    }

    // Create ReceiptUpload objects for all valid files
    const newUploads: ReceiptUpload[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending', // Initial status
      uploadProgress: 0,
    }));

    setReceiptUploads(prevUploads => [...prevUploads, ...newUploads]);
    setSelectedFileIndex(0);

    return validFiles;
  }, []);

  const openFileDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const resetUpload = useCallback(() => {
    setReceiptUploads([]);
    setSelectedFileIndex(0);
  }, []);

  return {
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
  };
}
