import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ReceiptUpload, ProcessingStatus } from "@/types/receipt";
import { useFileUpload } from "./useFileUpload";
import {
  createReceipt,
  uploadReceiptImage,
  processReceiptWithOCR,
  markReceiptUploaded
} from "@/services/receiptService";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImageForUpload } from "@/utils/imageUtils";

interface BatchUploadOptions {
  maxConcurrent?: number;
  autoStart?: boolean;
}

export function useBatchFileUpload(options: BatchUploadOptions = {}) {
  const { maxConcurrent = 2, autoStart = false } = options;

  // Use the base file upload hook for file selection and validation
  const baseUpload = useFileUpload();

  // Batch upload specific state
  const [batchUploads, setBatchUploads] = useState<ReceiptUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeUploads, setActiveUploads] = useState<string[]>([]);
  const [completedUploads, setCompletedUploads] = useState<string[]>([]);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);
  const [receiptIds, setReceiptIds] = useState<Record<string, string>>({});
  const processingRef = useRef<boolean>(false);

  const { user } = useAuth();
  const { settings } = useSettings();

  // Computed properties
  const queuedUploads = batchUploads.filter(upload =>
    upload.status === 'pending' && !activeUploads.includes(upload.id)
  );

  const currentlyActiveUploads = batchUploads.filter(upload =>
    activeUploads.includes(upload.id)
  );

  const currentlyCompletedUploads = batchUploads.filter(upload =>
    completedUploads.includes(upload.id)
  );

  const currentlyFailedUploads = batchUploads.filter(upload =>
    failedUploads.includes(upload.id)
  );

  // Total progress calculation
  const calculateTotalProgress = useCallback(() => {
    if (batchUploads.length === 0) return 0;

    const totalProgress = batchUploads.reduce((sum, upload) => {
      // If the upload is completed, always count it as 100%
      if (upload.status === 'completed') {
        return sum + 100;
      }
      // If the upload is in error state, count it as 0%
      if (upload.status === 'error') {
        return sum + 0;
      }
      // Otherwise use the upload progress
      return sum + (upload.uploadProgress || 0);
    }, 0);

    return Math.round(totalProgress / batchUploads.length);
  }, [batchUploads]);

  // Add files to the batch queue
  const addToBatchQueue = useCallback((files: FileList | File[]) => {
    console.log('addToBatchQueue called with files:', files);
    console.log('Files array type:', Object.prototype.toString.call(files));
    console.log('Files length:', files.length);

    // Ensure we have an array to work with
    let filesArray: File[];
    if (files instanceof FileList) {
      filesArray = Array.from(files);
    } else if (Array.isArray(files)) {
      filesArray = files;
    } else {
      console.error("Invalid files parameter type:", typeof files);
      toast.error("Invalid files format. Please try again.");
      return [];
    }

    console.log('Converted files to array with length:', filesArray.length);

    // Filter for valid file types
    const validFiles = filesArray.filter(file => {
      if (!file) {
        console.error("Null or undefined file found in array");
        return false;
      }

      const fileType = file.type;
      console.log(`Checking file: ${file.name}, type: ${fileType}`);

      const isValid = fileType === 'image/jpeg' ||
                      fileType === 'image/png' ||
                      fileType === 'application/pdf';

      if (!isValid) {
        console.warn(`Invalid file type: ${fileType} for file: ${file.name}`);
      }

      return isValid;
    });

    if (validFiles.length === 0) {
      console.error("No valid files found in selection");
      toast.error("No valid files selected. Please upload JPEG, PNG, or PDF files.");
      return [];
    }

    console.log('Valid files for batch upload:', validFiles.length);
    validFiles.forEach((file, index) => {
      console.log(`Valid file ${index + 1}: ${file.name}, type: ${file.type}, size: ${file.size}`);
    });

    // Create ReceiptUpload objects for all valid files
    const newUploads: ReceiptUpload[] = validFiles.map(file => {
      const id = crypto.randomUUID();
      console.log(`Creating upload object for file: ${file.name} with ID: ${id}`);

      return {
        id,
        file,
        status: 'pending',
        uploadProgress: 0,
      };
    });

    console.log('Created new uploads:', newUploads.length);

    // Update state with new uploads
    setBatchUploads(prevUploads => {
      const updatedUploads = [...prevUploads, ...newUploads];
      console.log('Updated batch uploads array length:', updatedUploads.length);
      return updatedUploads;
    });

    // If autoStart is enabled, start processing
    if (autoStart && !processingRef.current) {
      console.log('Auto-start enabled, scheduling batch processing');
      setTimeout(() => {
        startBatchProcessing();
      }, 100);
    }

    return newUploads;
  }, [autoStart]);

  // Remove a file from the batch queue
  const removeFromBatchQueue = useCallback((uploadId: string) => {
    setBatchUploads(prevUploads =>
      prevUploads.filter(upload => upload.id !== uploadId)
    );
  }, []);

  // Clear all pending uploads
  const clearBatchQueue = useCallback(() => {
    // Only remove pending uploads, keep active/completed/failed
    setBatchUploads(prevUploads =>
      prevUploads.filter(upload =>
        upload.status !== 'pending' || activeUploads.includes(upload.id)
      )
    );
  }, [activeUploads]);

  // Clear all uploads (including completed and failed)
  const clearAllUploads = useCallback(() => {
    if (isProcessing && !isPaused) {
      toast.error("Cannot clear uploads while processing. Please pause first.");
      return;
    }

    setBatchUploads([]);
    setActiveUploads([]);
    setCompletedUploads([]);
    setFailedUploads([]);
    setReceiptIds({});
  }, [isProcessing, isPaused]);

  // Update a single upload's status and progress
  const updateUploadStatus = useCallback((
    uploadId: string,
    status: ReceiptUpload['status'],
    progress: number,
    error?: { code: string; message: string } | null
  ) => {
    // First check if this upload already has the target status to avoid duplicate updates
    let shouldUpdate = true;

    setBatchUploads(prevUploads => {
      // Check if this upload already has the target status
      const existingUpload = prevUploads.find(u => u.id === uploadId);
      if (existingUpload && existingUpload.status === status && existingUpload.uploadProgress === progress) {
        shouldUpdate = false;
        return prevUploads; // No change needed
      }

      // Otherwise update the upload
      return prevUploads.map(upload =>
        upload.id === uploadId
          ? { ...upload, status, uploadProgress: progress, error }
          : upload
      );
    });

    // Only update tracking arrays if we're actually changing the status
    if (shouldUpdate) {
      // Update tracking arrays based on status
      if (status === 'completed') {
        setCompletedUploads(prev => {
          if (prev.includes(uploadId)) return prev;
          return [...prev, uploadId];
        });
        setActiveUploads(prev => prev.filter(id => id !== uploadId));
      } else if (status === 'error') {
        setFailedUploads(prev => {
          if (prev.includes(uploadId)) return prev;
          return [...prev, uploadId];
        });
        setActiveUploads(prev => prev.filter(id => id !== uploadId));
      }
    }
  }, []);

  // Process a single file
  const processFile = useCallback(async (upload: ReceiptUpload) => {
    if (!user) {
      updateUploadStatus(upload.id, 'error', 0, {
        code: 'AUTH_ERROR',
        message: 'You must be logged in to upload receipts'
      });
      return null;
    }

    try {
      // Update status to uploading
      updateUploadStatus(upload.id, 'uploading', 5);

      // Optimize the image before uploading (if it's an image)
      let fileToUpload = upload.file;

      if (upload.file.type.startsWith('image/')) {
        try {
          // Using the directly imported optimizeImageForUpload function
          updateUploadStatus(upload.id, 'uploading', 10);
          console.log(`Optimizing image: ${upload.file.name}, size: ${upload.file.size}`);

          // Use a lower quality for larger files
          const quality = upload.file.size > 3 * 1024 * 1024 ? 70 : 80;

          // Check if the function exists
          if (typeof optimizeImageForUpload !== 'function') {
            console.error('optimizeImageForUpload is not a function in useBatchFileUpload');
            throw new Error('optimizeImageForUpload is not a function');
          }

          fileToUpload = await optimizeImageForUpload(upload.file, 1500, quality);

          if (!fileToUpload) {
            console.error('Optimization returned null or undefined file');
            throw new Error('Optimization returned null file');
          }

          console.log(`Optimized image: ${upload.file.name}, new size: ${fileToUpload.size} (${Math.round(fileToUpload.size / upload.file.size * 100)}% of original)`);
        } catch (optimizeError) {
          console.error(`Error optimizing file ${upload.file.name}:`, optimizeError);
          // Continue with original file if optimization fails
          console.log(`Using original file for ${upload.file.name} due to optimization error`);
        }
      }

      updateUploadStatus(upload.id, 'uploading', 15);

      // Upload the image (optimized or original)
      const imageUrl = await uploadReceiptImage(
        fileToUpload,
        user.id,
        (progress) => {
          // Scale progress to 15-50%
          const scaledProgress = 15 + Math.floor(progress * 0.35);
          updateUploadStatus(upload.id, 'uploading', scaledProgress);
        }
      );

      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      updateUploadStatus(upload.id, 'uploading', 50);

      // Create receipt record
      const today = new Date().toISOString().split('T')[0];
      const newReceiptId = await createReceipt({
        merchant: "Processing...",
        date: today,
        total: 0,
        currency: "MYR",
        status: "unreviewed",
        image_url: imageUrl,
        // user_id is added by the createReceipt function
        processing_status: 'uploading',
        primary_method: settings.processingMethod,
        model_used: settings.selectedModel,
        has_alternative_data: settings.compareWithAlternative,
        payment_method: "" // Add required field
      }, [], {
        merchant: 0,
        date: 0,
        total: 0
      });

      if (!newReceiptId) {
        throw new Error("Failed to create receipt record");
      }

      // Store the receipt ID for this upload
      setReceiptIds(prev => ({ ...prev, [upload.id]: newReceiptId }));

      // Mark as uploaded
      await markReceiptUploaded(newReceiptId);
      updateUploadStatus(upload.id, 'processing', 60);

      // Subscribe to status updates for this receipt
      const statusChannel = supabase.channel(`receipt-status-${newReceiptId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'receipts',
            filter: `id=eq.${newReceiptId}`
          },
          (payload) => {
            const newStatus = payload.new.processing_status as ProcessingStatus;
            const newError = payload.new.processing_error;

            // Update progress based on processing status
            console.log(`Receipt ${newReceiptId} status updated to ${newStatus}`);

            if (newStatus === 'processing_ocr') {
              updateUploadStatus(upload.id, 'processing', 70);
            } else if (newStatus === 'processing_ai') {
              updateUploadStatus(upload.id, 'processing', 85);
            } else if (newStatus === 'complete') {
              console.log(`Receipt ${newReceiptId} processing complete, updating UI to 100%`);
              updateUploadStatus(upload.id, 'completed', 100);
              statusChannel.unsubscribe();
            } else if (newStatus === 'failed_ocr' || newStatus === 'failed_ai') {
              const errorMsg = newStatus === 'failed_ocr'
                ? "OCR processing failed"
                : "AI analysis failed";

              console.log(`Receipt ${newReceiptId} processing failed: ${errorMsg}`);
              updateUploadStatus(upload.id, 'error', 0, {
                code: newStatus,
                message: newError || errorMsg
              });
              statusChannel.unsubscribe();
            }
          }
        )
        .subscribe();

      // Process the receipt
      try {
        console.log(`Processing receipt ${newReceiptId} with OCR...`);
        const result = await processReceiptWithOCR(newReceiptId, {
          primaryMethod: settings.processingMethod,
          modelId: settings.selectedModel,
          compareWithAlternative: settings.compareWithAlternative
        });
        console.log(`OCR processing result for ${newReceiptId}:`, result ? 'Success' : 'Failed');

        // If we got a successful result, update the status to completed
        // This is a fallback in case the realtime subscription doesn't catch the update
        if (result) {
          // Force update to completed status immediately
          updateUploadStatus(upload.id, 'completed', 100);
          statusChannel.unsubscribe();

          // Also check after a short delay in case the first update didn't take effect
          setTimeout(() => {
            // Check if this upload is still in processing status
            const currentUpload = batchUploads.find(u => u.id === upload.id);
            if (currentUpload && currentUpload.status === 'processing') {
              console.log(`Manually completing upload ${upload.id} after successful processing`);
              updateUploadStatus(upload.id, 'completed', 100);
              statusChannel.unsubscribe();
            }
          }, 2000);
        }
      } catch (processError: any) {
        console.error("Processing error:", processError);
        updateUploadStatus(upload.id, 'error', 0, {
          code: 'PROCESSING_ERROR',
          message: processError.message || "Failed to process receipt"
        });
        statusChannel.unsubscribe();
      }

      return newReceiptId;
    } catch (error: any) {
      console.error("Upload error:", error);
      updateUploadStatus(upload.id, 'error', 0, {
        code: 'UPLOAD_ERROR',
        message: error.message || "Failed to upload receipt"
      });
      return null;
    }
  }, [user, settings, updateUploadStatus]);

  // Process the next batch of files
  const processNextBatch = useCallback(async () => {
    if (!processingRef.current || isPaused) return;

    // Get pending uploads that aren't already being processed
    const pendingUploads = batchUploads.filter(upload =>
      upload.status === 'pending' && !activeUploads.includes(upload.id)
    );

    // If no more pending uploads, we're done
    if (pendingUploads.length === 0) {
      setIsProcessing(false);
      processingRef.current = false;

      // Show completion toast
      const totalCount = batchUploads.length;
      const successCount = completedUploads.length;
      const failureCount = failedUploads.length;

      if (totalCount > 0) {
        if (failureCount === 0) {
          toast.success(`All ${successCount} receipts processed successfully!`);
        } else {
          toast.info(`Batch processing complete: ${successCount} succeeded, ${failureCount} failed`);
        }
      }

      return;
    }

    // Calculate how many new uploads we can start
    const currentActive = activeUploads.length;
    const slotsAvailable = maxConcurrent - currentActive;

    if (slotsAvailable <= 0) return;

    // Get the next batch of uploads to process
    const nextBatch = pendingUploads.slice(0, slotsAvailable);

    // Mark these as active
    const newActiveIds = nextBatch.map(upload => upload.id);
    setActiveUploads(prev => [...prev, ...newActiveIds]);

    // Process each file in parallel
    nextBatch.forEach(upload => {
      processFile(upload).catch(error => {
        console.error(`Error processing file ${upload.id}:`, error);
      });
    });
  }, [batchUploads, activeUploads, isPaused, maxConcurrent, completedUploads, failedUploads, processFile]);

  // Start batch processing
  const startBatchProcessing = useCallback(() => {
    console.log('startBatchProcessing called');
    if (processingRef.current && !isPaused) {
      toast.info("Batch processing is already running");
      return;
    }

    // If paused, just resume
    if (isPaused) {
      setIsPaused(false);
      toast.info("Resuming batch processing");
      return;
    }

    // Check if there are any pending uploads
    const pendingUploads = batchUploads.filter(upload => upload.status === 'pending');

    console.log('Pending uploads:', pendingUploads.length);

    if (pendingUploads.length === 0) {
      console.log('No pending uploads found');
      toast.info("No files to process. Add files to the queue first.");
      return;
    }

    // Start processing
    setIsProcessing(true);
    processingRef.current = true;
    setIsPaused(false);

    toast.info(`Starting batch processing of ${pendingUploads.length} files`);

    // Kick off the first batch
    processNextBatch();
  }, [batchUploads, isPaused, processNextBatch]);

  // Pause batch processing
  const pauseBatchProcessing = useCallback(() => {
    if (!processingRef.current) {
      toast.info("No active batch processing to pause");
      return;
    }

    setIsPaused(true);
    toast.info("Batch processing paused. Currently active uploads will complete.");
  }, []);

  // Cancel a specific upload
  const cancelUpload = useCallback(async (uploadId: string) => {
    const upload = batchUploads.find(u => u.id === uploadId);

    if (!upload) {
      console.error(`Upload with ID ${uploadId} not found`);
      return;
    }

    // If it's already completed or failed, we can't cancel it
    if (upload.status === 'completed' || upload.status === 'error') {
      toast.info(`Cannot cancel upload that is already ${upload.status}`);
      return;
    }

    // If it's active, mark it as failed
    if (activeUploads.includes(uploadId)) {
      updateUploadStatus(uploadId, 'error', 0, {
        code: 'CANCELLED',
        message: 'Upload cancelled by user'
      });

      // If we have a receipt ID, update its status
      const receiptId = receiptIds[uploadId];
      if (receiptId) {
        // Update the receipt status to failed
        try {
          const { error } = await supabase
            .from('receipts')
            .update({
              processing_status: 'failed_ocr',
              processing_error: 'Cancelled by user'
            })
            .eq('id', receiptId);

          if (error) {
            console.error(`Failed to update receipt ${receiptId} status:`, error);
          } else {
            console.log(`Updated receipt ${receiptId} status to failed_ocr`);
          }
        } catch (error) {
          console.error(`Exception updating receipt ${receiptId} status:`, error);
        }
      }
    } else {
      // If it's pending, just remove it from the queue
      removeFromBatchQueue(uploadId);
    }
  }, [batchUploads, activeUploads, receiptIds, removeFromBatchQueue, updateUploadStatus]);

  // Retry a failed upload
  const retryUpload = useCallback((uploadId: string) => {
    const upload = batchUploads.find(u => u.id === uploadId);

    if (!upload) {
      console.error(`Upload with ID ${uploadId} not found`);
      return;
    }

    // Only retry failed uploads
    if (upload.status !== 'error') {
      toast.info(`Can only retry failed uploads`);
      return;
    }

    // Create a new upload with the same file
    const newUpload: ReceiptUpload = {
      id: crypto.randomUUID(),
      file: upload.file,
      status: 'pending',
      uploadProgress: 0
    };

    // Add the new upload to the queue
    setBatchUploads(prev => [...prev, newUpload]);

    // Remove the failed upload
    removeFromBatchQueue(uploadId);
    setFailedUploads(prev => prev.filter(id => id !== uploadId));

    toast.info("Upload queued for retry");

    // If processing is active, the new upload will be picked up automatically
    if (!isProcessing && autoStart) {
      setTimeout(() => {
        startBatchProcessing();
      }, 100);
    }
  }, [batchUploads, removeFromBatchQueue, isProcessing, autoStart, startBatchProcessing]);

  // Log when batchUploads changes
  useEffect(() => {
    console.log('batchUploads state changed:', batchUploads);
    console.log('batchUploads length:', batchUploads.length);
    console.log('activeUploads:', activeUploads);
    console.log('completedUploads:', completedUploads);
    console.log('failedUploads:', failedUploads);
    console.log('isProcessing:', isProcessing);
    console.log('isPaused:', isPaused);

    // Log detailed progress information
    if (batchUploads.length > 0) {
      console.log('Upload progress details:', {
        totalProgress: calculateTotalProgress(),
        completed: completedUploads.length,
        failed: failedUploads.length,
        active: activeUploads.length,
        pending: batchUploads.filter(u => u.status === 'pending').length,
        uploadStatuses: batchUploads.map(u => ({ id: u.id, status: u.status, progress: u.uploadProgress }))
      });

      // Log each upload in detail
      batchUploads.forEach((upload, index) => {
        console.log(`Upload ${index + 1}:`, {
          id: upload.id,
          fileName: upload.file?.name,
          fileType: upload.file?.type,
          fileSize: upload.file?.size,
          status: upload.status,
          progress: upload.uploadProgress,
          error: upload.error
        });
      });
    }
  }, [batchUploads, calculateTotalProgress, completedUploads, failedUploads, activeUploads, isProcessing, isPaused]);

  // Effect to process next batch when active uploads change
  useEffect(() => {
    if (processingRef.current && !isPaused) {
      // Use a small timeout to avoid potential race conditions
      const timer = setTimeout(() => {
        processNextBatch();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [activeUploads, completedUploads, failedUploads, isPaused, processNextBatch]);

  // Handle file drop and selection using the base hook
  const handleFiles = useCallback((files: FileList | File[]) => {
    console.log('handleFiles called in useBatchFileUpload with:', files);
    console.log('Files type:', Object.prototype.toString.call(files));
    console.log('Files length:', files.length);

    // Ensure we have an array to work with
    let filesArray: File[];
    if (files instanceof FileList) {
      filesArray = Array.from(files);
    } else if (Array.isArray(files)) {
      filesArray = files;
    } else {
      console.error("Invalid files parameter type:", typeof files);
      toast.error("Invalid files format. Please try again.");
      return;
    }

    console.log('Converted files to array with length:', filesArray.length);

    // Instead of using baseUpload.handleFiles, directly validate and add files
    const validFiles = filesArray.filter(file => {
      if (!file) {
        console.error("Null or undefined file found in array");
        return false;
      }

      const fileType = file.type;
      console.log(`Checking file: ${file.name}, type: ${fileType}`);

      const isValid = fileType === 'image/jpeg' ||
                      fileType === 'image/png' ||
                      fileType === 'application/pdf';

      if (!isValid) {
        console.warn(`Invalid file type: ${fileType} for file: ${file.name}`);
      }

      return isValid;
    });

    console.log('Valid files in useBatchFileUpload handleFiles:', validFiles.length);
    validFiles.forEach((file, index) => {
      console.log(`Valid file ${index + 1}: ${file.name}, type: ${file.type}, size: ${file.size}`);
    });

    if (validFiles && validFiles.length > 0) {
      // Add to our batch queue
      const result = addToBatchQueue(validFiles);
      console.log('Result from addToBatchQueue in handleFiles:', result);

      // Reset the base hook's uploads to avoid duplication
      baseUpload.resetUpload();
    } else {
      console.error('No valid files found in useBatchFileUpload handleFiles');
      toast.error("No valid files selected. Please upload JPEG, PNG, or PDF files.");
    }
  }, [baseUpload, addToBatchQueue]);

  return {
    // Base file upload properties and methods
    ...baseUpload,
    handleFiles,

    // Batch-specific state
    batchUploads,
    isProcessing,
    isPaused,
    queuedUploads,
    activeUploads: currentlyActiveUploads,
    completedUploads: currentlyCompletedUploads,
    failedUploads: currentlyFailedUploads,
    totalProgress: calculateTotalProgress(),

    // Batch-specific methods
    addToBatchQueue,
    removeFromBatchQueue,
    clearBatchQueue,
    clearAllUploads,
    startBatchProcessing,
    pauseBatchProcessing,
    cancelUpload,
    retryUpload,

    // Receipt IDs for navigation
    receiptIds
  };
}
