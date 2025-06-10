import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, RotateCcw, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBatchFileUpload } from "@/hooks/useBatchFileUpload";
import { useSettings } from "@/hooks/useSettings";
import { UploadQueueItem } from "@/components/upload/UploadQueueItem";
import { BatchProcessingControls } from "@/components/upload/BatchProcessingControls";
import { BatchUploadReview } from "@/components/upload/BatchUploadReview";
import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EnhancedScrollArea } from "@/components/ui/enhanced-scroll-area";
import { toast } from "@/components/ui/use-toast";
import DailyReceiptBrowserModal from "@/components/DailyReceiptBrowserModal";
import imageCompression from "browser-image-compression";
import { optimizeImageForUpload } from "@/utils/imageUtils";

interface BatchUploadZoneProps {
  onUploadComplete?: () => void;
}

export default function BatchUploadZone({
  onUploadComplete
}: BatchUploadZoneProps) {
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef<number>(0);
  const fileQueueRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { settings } = useSettings();

  // State to track if the review UI should be shown
  const [showReview, setShowReview] = useState(false);
  // State to track if all processing is complete
  const [allProcessingComplete, setAllProcessingComplete] = useState(false);
  // State to track if the receipt browser modal should be shown
  const [showReceiptBrowser, setShowReceiptBrowser] = useState(false);
  // State to store the completed receipt IDs for the browser modal
  const [completedReceiptIds, setCompletedReceiptIds] = useState<string[]>([]);
  // State to store the current date for the browser modal
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  // State to track compression status
  const [isCompressing, setIsCompressing] = useState(false);
  // State to track previous file count for auto-scroll
  const [previousFileCount, setPreviousFileCount] = useState(0);
  // State to preserve scroll position during updates
  const [preserveScrollPosition, setPreserveScrollPosition] = useState(false);

  const {
    isDragging,
    isInvalidFile,
    batchUploads,
    isProcessing,
    isPaused,
    queuedUploads,
    activeUploads,
    completedUploads,
    failedUploads,
    totalProgress,
    fileInputRef,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    openFileDialog,
    addToBatchQueue,
    removeFromBatchQueue,
    clearBatchQueue,
    clearAllUploads,
    startBatchProcessing,
    pauseBatchProcessing,
    cancelUpload,
    retryUpload,
    receiptIds,
    progressUpdating
  } = useBatchFileUpload({
    maxConcurrent: settings?.batchUpload?.maxConcurrent || 2,
    autoStart: settings?.batchUpload?.autoStart || false
  });

  // Function to compress images and add files to the queue
  const compressAndAddFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    setIsCompressing(true);
    console.log('Starting optimization for', files.length, 'files');

    const processedFiles: File[] = [];
    const invalidFiles: File[] = [];
    const compressionErrors: { name: string; error: unknown }[] = [];

    // We're now using the direct import from the top of the file
    console.log('Using directly imported optimizeImageForUpload function');

    for (const file of Array.from(files)) {
      const isImage = ['image/jpeg', 'image/png'].includes(file.type);
      const isPdf = file.type === 'application/pdf';

      if (isImage) {
        try {
          console.log(`Optimizing image: ${file.name}, size: ${file.size}, type: ${file.type}`);

          // Use our new optimization function with quality based on file size
          const quality = file.size > 3 * 1024 * 1024 ? 70 : 80;

          // Check if the function exists
          if (typeof optimizeImageForUpload !== 'function') {
            console.error('optimizeImageForUpload is not a function:', optimizeImageForUpload);
            throw new Error('optimizeImageForUpload is not a function');
          }

          const optimizedFile = await optimizeImageForUpload(file, 1500, quality);

          if (!optimizedFile) {
            console.error('Optimization returned null or undefined file');
            throw new Error('Optimization returned null file');
          }

          console.log(`Optimized image: ${file.name}, new size: ${optimizedFile.size} (${Math.round(optimizedFile.size / file.size * 100)}% of original)`);

          // Add to processed files array
          processedFiles.push(optimizedFile);
          console.log(`Added optimized file to processedFiles array, new length: ${processedFiles.length}`);
        } catch (error) {
          console.error(`Error optimizing file ${file.name}:`, error);
          compressionErrors.push({ name: file.name, error });

          // Fall back to browser-image-compression if our optimization fails
          try {
            console.log(`Falling back to browser-image-compression for ${file.name}`);
            const compressionOptions = {
              maxSizeMB: 1, // Max size in MB
              maxWidthOrHeight: 1500, // Max width or height
              useWebWorker: true, // Use web worker for performance
            };

            const compressedFile = await imageCompression(file, compressionOptions);
            console.log(`Fallback compression: ${file.name}, new size: ${compressedFile.size}`);

            // Create a new File object with the original name but compressed data
            const newFile = new File([compressedFile], file.name, {
              type: file.type,
              lastModified: file.lastModified
            });

            processedFiles.push(newFile);
            console.log(`Added fallback compressed file to processedFiles array, new length: ${processedFiles.length}`);
          } catch (fallbackError) {
            console.error(`Fallback compression also failed for ${file.name}:`, fallbackError);
            // Add original file if both optimization methods fail
            processedFiles.push(file);
            console.log(`Added original file to processedFiles array, new length: ${processedFiles.length}`);
          }
        }
      } else if (isPdf) {
        // Keep PDFs as they are
        processedFiles.push(file);
        console.log(`Added PDF file to processedFiles array, new length: ${processedFiles.length}`);
      } else {
        // Track invalid files
        invalidFiles.push(file);
        console.log(`Added invalid file to invalidFiles array, new length: ${invalidFiles.length}`);
      }
    }

    console.log('Optimization finished. Processed:', processedFiles.length, 'Invalid:', invalidFiles.length, 'Errors:', compressionErrors.length);
    setIsCompressing(false);

    // Show toast for invalid files
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid Files Skipped",
        description: `${invalidFiles.length} ${invalidFiles.length === 1 ? 'file was' : 'files were'} not added because they are not supported formats (only JPG, PNG, PDF).`,
        variant: "destructive",
      });
    }

    // Show toast for compression errors (optional)
    if (compressionErrors.length > 0) {
      toast({
        title: "Optimization Issues",
        description: `${compressionErrors.length} ${compressionErrors.length === 1 ? 'image' : 'images'} had optimization issues (fallback methods were used). Check console for details.`,
        variant: "default",
      });
    }

    // Add the processed (optimized or original) files to the batch queue
    console.log(`Ready to add ${processedFiles.length} files to batch queue:`, processedFiles);
    if (processedFiles.length > 0) {
      const result = addToBatchQueue(processedFiles);
      console.log('Result from addToBatchQueue:', result);
    } else {
      console.error('No processed files to add to batch queue');
    }

  }, [addToBatchQueue]);

  // Function to retry all failed uploads
  const retryAllFailed = useCallback(() => {
    if (failedUploads.length === 0) return;

    // Retry each failed upload
    failedUploads.forEach(upload => {
      retryUpload(upload.id);
    });

    toast({
      title: "Retrying Failed Uploads",
      description: `Retrying ${failedUploads.length} failed ${failedUploads.length === 1 ? 'upload' : 'uploads'}.`,
    });

    // Hide review UI when retrying
    setShowReview(false);
  }, [failedUploads, retryUpload]);

  // Function to reset the batch upload zone
  const resetBatchUpload = useCallback(() => {
    clearAllUploads();
    setShowReview(false);
    setAllProcessingComplete(false);
  }, [clearAllUploads]);

  // Check if all processing is complete
  useEffect(() => {
    console.log('Checking if processing is complete:', {
      isProcessing,
      activeUploads: activeUploads.length,
      queuedUploads: queuedUploads.length,
      completedUploads: completedUploads.length,
      failedUploads: failedUploads.length,
      allProcessingComplete
    });

    // If there are no active uploads and no queued uploads, and we have at least one upload (completed or failed)
    if (
      !isProcessing &&
      activeUploads.length === 0 &&
      queuedUploads.length === 0 &&
      (completedUploads.length > 0 || failedUploads.length > 0) &&
      !allProcessingComplete // Only proceed if we haven't already marked as complete
    ) {
      console.log('All processing is complete, showing notification');

      // Set processing complete flag
      setAllProcessingComplete(true);

      // Show a toast notification
      const totalUploads = completedUploads.length + failedUploads.length;
      const successRate = Math.round((completedUploads.length / totalUploads) * 100);

      toast({
        title: "Batch Upload Complete",
        description: `${completedUploads.length} of ${totalUploads} receipts processed successfully (${successRate}%)`,
        variant: failedUploads.length > 0 ? "default" : "default",
      });

      // Extract receipt IDs from completed uploads
      // Fix: Make sure we're using strings as index keys, not ReceiptUpload objects
      const successfulReceiptIds = completedUploads
        .map(uploadId => {
          // Ensure we're using string IDs, not objects
          const id = typeof uploadId === 'string' ? uploadId : null;
          return id ? receiptIds[id] : null;
        })
        .filter(Boolean) as string[];

      // If we have successful uploads, show the receipt browser modal
      if (successfulReceiptIds.length > 0) {
        console.log('Opening receipt browser with IDs:', successfulReceiptIds);
        setCompletedReceiptIds(successfulReceiptIds);
        // We're not automatically showing the browser modal anymore
        // Users will need to click the "Review Results" button first
        // setShowReceiptBrowser(true);
      }

      // Call the onUploadComplete callback if provided
      // This will refresh the data but won't close the modal
      if (onUploadComplete) {
        onUploadComplete();
      }

      // Note: We're not automatically showing the review UI anymore
      // Users will need to click the "Review Results" button
    } else if (
      (isProcessing || activeUploads.length > 0 || queuedUploads.length > 0) &&
      allProcessingComplete
    ) {
      // If processing starts again after being complete, reset the flag
      setAllProcessingComplete(false);
    }
  }, [
    isProcessing,
    activeUploads.length,
    queuedUploads.length,
    completedUploads.length,
    failedUploads.length,
    allProcessingComplete,
    onUploadComplete,
    receiptIds
  ]);

  const getBorderStyle = () => {
    if (isInvalidFile) return "border-destructive animate-[shake_0.5s_ease-in-out]";
    if (isDragging) return "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--primary)/15%)]";
    return "border-border bg-background/50";
  };

  // Auto-scroll to bottom when new files are added (but not during progress updates)
  useEffect(() => {
    if (batchUploads.length > previousFileCount && scrollAreaRef.current && !preserveScrollPosition) {
      // Small delay to ensure the new items are rendered
      setTimeout(() => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          // Smooth scroll to bottom
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 150);
    }
    setPreviousFileCount(batchUploads.length);
  }, [batchUploads.length, previousFileCount, preserveScrollPosition]);

  // Preserve scroll position during progress updates
  useEffect(() => {
    const hasActiveProgress = Object.values(progressUpdating).some(Boolean);
    setPreserveScrollPosition(hasActiveProgress);
  }, [progressUpdating]);

  // Scroll to active uploads when processing starts
  useEffect(() => {
    if (isProcessing && activeUploads.length > 0 && scrollAreaRef.current) {
      setTimeout(() => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          // Find the first active upload element and scroll to it
          const activeUploadElement = scrollContainer.querySelector(`[data-upload-status="uploading"], [data-upload-status="processing"]`);
          if (activeUploadElement) {
            activeUploadElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
      }, 200);
    }
  }, [isProcessing, activeUploads.length]);

  // Keyboard navigation for scroll area
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!scrollAreaRef.current) return;

    const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    switch (e.key) {
      case 'Home':
        e.preventDefault();
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'End':
        e.preventDefault();
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        break;
      case 'PageUp':
        e.preventDefault();
        scrollContainer.scrollBy({ top: -scrollContainer.clientHeight * 0.8, behavior: 'smooth' });
        break;
      case 'PageDown':
        e.preventDefault();
        scrollContainer.scrollBy({ top: scrollContainer.clientHeight * 0.8, behavior: 'smooth' });
        break;
    }
  }, []);

  // Log component state for debugging
  useEffect(() => {
    console.log('BatchUploadZone state:', {
      batchUploads: batchUploads.length,
      isProcessing,
      isPaused,
      queuedUploads: queuedUploads.length,
      activeUploads: activeUploads.length,
      completedUploads: completedUploads.length,
      failedUploads: failedUploads.length
    });
  }, [batchUploads, isProcessing, isPaused, queuedUploads, activeUploads, completedUploads, failedUploads]);

  // Custom file input handler
  const handleFileSelection = () => {
    console.log('Custom file selection handler');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Custom drop handler
  const handleCustomDrop = useCallback((e: React.DragEvent) => {
    console.log('Custom drop handler in BatchUploadZone');
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      console.log('Files dropped:', e.dataTransfer.files);
      console.log('Files length:', e.dataTransfer.files.length);

      // Log each file
      Array.from(e.dataTransfer.files).forEach((file, index) => {
        console.log(`Dropped file ${index + 1}:`, {
          name: file.name,
          type: file.type,
          size: file.size
        });
      });

      // Process the files
      compressAndAddFiles(e.dataTransfer.files);
    } else {
      console.log('No files in drop event');
    }
  }, [compressAndAddFiles]);

  // If showing review UI, render that instead of the upload zone
  if (showReview) {
    return (
      <BatchUploadReview
        completedUploads={batchUploads.filter(upload => upload.status === 'completed')}
        failedUploads={batchUploads.filter(upload => upload.status === 'error')}
        receiptIds={receiptIds}
        onRetry={retryUpload}
        onRetryAll={retryAllFailed}
        onClose={() => setShowReview(false)}
        onReset={resetBatchUpload}
        onViewAllReceipts={() => {
          // Show the receipt browser modal with all completed receipt IDs
          // Extract receipt IDs correctly from the completed uploads
          const successfulReceiptIds = completedUploads
            .map(upload => receiptIds[upload.id])
            .filter(Boolean) as string[];

          console.log('View Uploaded Receipts clicked, IDs:', successfulReceiptIds);

          if (successfulReceiptIds.length > 0) {
            setCompletedReceiptIds(successfulReceiptIds);
            setShowReceiptBrowser(true);
            setShowReview(false); // Hide the review UI
          } else {
            console.error('No successful receipt IDs found');
            toast({
              title: "No Receipts Found",
              description: "Could not find any successfully processed receipts to view.",
              variant: "destructive",
            });
          }
        }}
      />
    );
  }

  return (
    <>
      {/* Receipt Browser Modal */}
      <DailyReceiptBrowserModal
        date={currentDate}
        receiptIds={completedReceiptIds}
        isOpen={showReceiptBrowser}
        onClose={() => {
          console.log('Closing receipt browser modal');
          setShowReceiptBrowser(false);
        }}
      />

      <div
        className={`relative w-full h-full grid grid-rows-[auto_1fr_auto] gap-4 rounded-md p-6 border-2 border-dashed transition-all duration-300 ${getBorderStyle()}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleCustomDrop}
        ref={uploadZoneRef}
        tabIndex={0}
        role="button"
        aria-label="Upload multiple receipt files: JPEG, PNG, or PDF (up to 5MB each)"
        aria-describedby="batch-upload-zone-description batch-upload-status"
      >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => {
          console.log('File input change in BatchUploadZone:', e.target.files);
          compressAndAddFiles(e.target.files);
          if (e.target) {
            e.target.value = '';
          }
        }}
        multiple
        accept="image/jpeg,image/png,application/pdf"
        aria-hidden="true"
      />

      <div
        id="batch-upload-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isCompressing
          ? `Compressing images...`
          : isProcessing
            ? `Processing batch upload: ${completedUploads.length} of ${batchUploads.length} complete`
            : 'Ready to upload multiple receipt files'}
      </div>

      {/* Header Section - Auto height */}
      <div className="flex flex-col items-center text-center gap-3">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{
            scale: isDragging ? 1.1 : 1,
            rotate: isDragging ? [0, -5, 5, -5, 0] : 0
          }}
          whileHover={{ scale: 1.05 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            rotate: { duration: 0.5, ease: "easeInOut" }
          }}
          className={`relative rounded-full p-4 ${
            isDragging ? "bg-primary/10" : "bg-secondary"
          }`}
        >
          {isDragging ? (
            <Upload size={32} className="text-primary" />
          ) : (
            <FileUp size={32} className="text-primary" />
          )}
        </motion.div>

        <div className="space-y-1">
          <h3 className="text-lg font-medium">
            {isDragging
              ? "Drop Files Here"
              : "Batch Upload Receipts"}
          </h3>
          <p
            id="batch-upload-zone-description"
            className="text-sm text-muted-foreground max-w-md mx-auto"
          >
            {isCompressing
              ? "Compressing selected images..."
              : isInvalidFile
                ? "Some files are not supported. Please upload only JPEG, PNG, or PDF files."
                : isDragging
                  ? "Release to add files to the queue"
                  : "Drag & drop multiple receipt files here, or click to browse (up to 5MB each)"}
          </p>
        </div>
      </div>

      {/* Main Content Section - Flexible height with proper scrolling */}
      <div className="flex flex-col items-center gap-4 min-h-0 overflow-y-auto overflow-x-hidden">

        {/* Illustration when empty */}
        <AnimatePresence>
          {batchUploads.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-shrink-0"
            >
              {isInvalidFile
                ? DropZoneIllustrations.error
                : isDragging
                  ? DropZoneIllustrations.drag
                  : DropZoneIllustrations.default}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing controls */}
        <AnimatePresence>
          {batchUploads.length > 0 && (
            <div className="flex-shrink-0">
              <BatchProcessingControls
                totalFiles={batchUploads.length}
                pendingFiles={queuedUploads.length}
                activeFiles={activeUploads.length}
                completedFiles={completedUploads.length}
                failedFiles={failedUploads.length}
                totalProgress={totalProgress}
                isProcessing={isProcessing}
                isPaused={isPaused}
                onStartProcessing={startBatchProcessing}
                onPauseProcessing={pauseBatchProcessing}
                onClearQueue={clearBatchQueue}
                onClearAll={clearAllUploads}
                onRetryAllFailed={failedUploads.length > 0 ? retryAllFailed : undefined}
                onShowReview={() => setShowReview(true)}
                allComplete={allProcessingComplete}
                isProgressUpdating={Object.values(progressUpdating).some(Boolean)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* File queue - Enhanced scrolling with proper height management */}
        <AnimatePresence>
          {batchUploads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full flex-1 min-h-0 flex flex-col max-h-[400px] sm:max-h-[450px] md:max-h-[500px]"
              ref={fileQueueRef}
            >
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h4 className="text-sm font-medium">Files ({batchUploads.length})</h4>
                {failedUploads.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryAllFailed}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry All Failed ({failedUploads.length})
                  </Button>
                )}
              </div>
              <EnhancedScrollArea
                className="flex-1 w-full rounded-md border min-h-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                maxHeight="min(350px, 60vh)"
                showScrollIndicator={true}
                fadeEdges={true}
                ref={scrollAreaRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                role="region"
                aria-label="File upload queue"
              >
                <div className="p-4 space-y-2">
                  {batchUploads.map((upload, index) => (
                    <motion.div
                      key={upload.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <UploadQueueItem
                        upload={upload}
                        receiptId={receiptIds[upload.id]}
                        onRemove={removeFromBatchQueue}
                        onCancel={cancelUpload}
                        onRetry={retryUpload}
                        onViewReceipt={(receiptId) => navigate(`/receipt/${receiptId}`)}
                        isProgressUpdating={progressUpdating[upload.id] || false}
                      />
                    </motion.div>
                  ))}
                </div>
              </EnhancedScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons when no files */}
        {batchUploads.length === 0 && (
          <Button
            onClick={() => {
              console.log('Select Files button clicked');
              handleFileSelection();
            }}
            variant="default"
            className="px-6 py-2 text-base group flex-shrink-0"
            size="lg"
          >
            <span className="mr-2">Select Files</span>
            <span className="text-xs text-muted-foreground group-hover:text-primary-foreground transition-colors">
              JPG, PNG, PDF
            </span>
          </Button>
        )}

        {/* Action buttons when files exist */}
        {batchUploads.length > 0 && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              onClick={() => {
                console.log('Add More Files button clicked');
                handleFileSelection();
              }}
              variant="outline"
              size="sm"
            >
              <FileUp className="h-4 w-4 mr-2" />
              Add More Files
            </Button>

            {/* Manual review button when all processing is complete */}
            {allProcessingComplete && (
              <Button
                onClick={() => {
                  console.log('Review Results button clicked');
                  setShowReview(true);
                }}
                variant="default"
                size="sm"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Review Results
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer Section - Auto height */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap gap-2 justify-center">
          <div className="text-xs px-2 py-1 bg-muted rounded-full">
            Max concurrent: {settings?.batchUpload?.maxConcurrent || 2}
          </div>
          <div className="text-xs px-2 py-1 bg-muted rounded-full">
            Auto-start: {settings?.batchUpload?.autoStart ? "On" : "Off"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Configure batch upload settings in the{" "}
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => navigate("/settings")}
          >
            Settings Page
          </Button>
        </p>
      </div>
    </div>
    </>
  );
}
