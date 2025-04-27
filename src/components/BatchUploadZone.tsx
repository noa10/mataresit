import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, Clock, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBatchFileUpload } from "@/hooks/useBatchFileUpload";
import { useSettings } from "@/hooks/useSettings";
import { UploadQueueItem } from "@/components/upload/UploadQueueItem";
import { BatchProcessingControls } from "@/components/upload/BatchProcessingControls";
import { BatchUploadReview } from "@/components/upload/BatchUploadReview";
import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";

interface BatchUploadZoneProps {
  onUploadComplete?: () => void;
}

export default function BatchUploadZone({
  onUploadComplete
}: BatchUploadZoneProps) {
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef<number>(0);
  const navigate = useNavigate();
  const { settings } = useSettings();

  // State to track if the review UI should be shown
  const [showReview, setShowReview] = useState(false);
  // State to track if all processing is complete
  const [allProcessingComplete, setAllProcessingComplete] = useState(false);

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
    receiptIds
  } = useBatchFileUpload({
    maxConcurrent: settings?.batchUpload?.maxConcurrent || 2,
    autoStart: settings?.batchUpload?.autoStart || false
  });

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
    // If there are no active uploads and no queued uploads, and we have at least one upload (completed or failed)
    if (
      !isProcessing &&
      activeUploads.length === 0 &&
      queuedUploads.length === 0 &&
      (completedUploads.length > 0 || failedUploads.length > 0)
    ) {
      // Set processing complete flag
      setAllProcessingComplete(true);

      // If we have any completed uploads, show the review UI
      if (completedUploads.length > 0 || failedUploads.length > 0) {
        // Small delay to ensure all UI updates are complete
        setTimeout(() => {
          setShowReview(true);

          // Show a toast notification
          const totalUploads = completedUploads.length + failedUploads.length;
          const successRate = Math.round((completedUploads.length / totalUploads) * 100);

          toast({
            title: "Batch Upload Complete",
            description: `${completedUploads.length} of ${totalUploads} receipts processed successfully (${successRate}%)`,
            variant: failedUploads.length > 0 ? "default" : "default",
          });

          // Call the onUploadComplete callback if provided
          if (onUploadComplete) {
            onUploadComplete();
          }
        }, 500);
      }
    }
  }, [
    isProcessing,
    activeUploads.length,
    queuedUploads.length,
    completedUploads.length,
    failedUploads.length,
    onUploadComplete
  ]);

  const getBorderStyle = () => {
    if (isInvalidFile) return "border-destructive animate-[shake_0.5s_ease-in-out]";
    if (isDragging) return "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(var(--primary)/15%)]";
    return "border-border bg-background/50";
  };

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
  const handleCustomDrop = (e: React.DragEvent) => {
    console.log('Custom drop handler in BatchUploadZone');
    e.preventDefault();
    e.stopPropagation();

    // No need to call setIsDragging as it's handled by the hook
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      console.log('Files dropped:', e.dataTransfer.files);

      // Check for invalid files
      const files = e.dataTransfer.files;
      const invalidFiles = Array.from(files).filter(file =>
        !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
      );

      if (invalidFiles.length > 0) {
        toast({
          title: "Invalid Files",
          description: `${invalidFiles.length} ${invalidFiles.length === 1 ? 'file was' : 'files were'} not added because they are not supported formats.`,
          variant: "destructive",
        });
      }

      // Directly add files to batch queue
      addToBatchQueue(e.dataTransfer.files);
    }
  };

  // If showing review UI, render that instead of the upload zone
  if (showReview) {
    return (
      <BatchUploadReview
        completedUploads={completedUploads}
        failedUploads={failedUploads}
        receiptIds={receiptIds}
        onRetry={retryUpload}
        onRetryAll={retryAllFailed}
        onClose={() => setShowReview(false)}
        onReset={resetBatchUpload}
      />
    );
  }

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-auto rounded-md p-6 border-2 border-dashed transition-all duration-300 ${getBorderStyle()}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleCustomDrop}
      ref={uploadZoneRef}
      tabIndex={0}
      role="button"
      aria-label="Upload multiple receipt files: JPEG, PNG, or PDF"
      aria-describedby="batch-upload-zone-description batch-upload-status"
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => {
          console.log('File input change in BatchUploadZone:', e.target.files);
          if (e.target.files && e.target.files.length > 0) {
            // Check for invalid files
            const files = e.target.files;
            const invalidFiles = Array.from(files).filter(file =>
              !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
            );

            if (invalidFiles.length > 0) {
              toast({
                title: "Invalid Files",
                description: `${invalidFiles.length} ${invalidFiles.length === 1 ? 'file was' : 'files were'} not added because they are not supported formats.`,
                variant: "destructive",
              });
            }

            // Directly add files to batch queue
            addToBatchQueue(e.target.files);
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
        {isProcessing
          ? `Processing batch upload: ${completedUploads.length} of ${batchUploads.length} complete`
          : 'Ready to upload multiple receipt files'}
      </div>

      <div className="flex flex-col items-center justify-center text-center gap-4 flex-grow">
        {/* Header section */}
        <div className="flex flex-col items-center gap-3">
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
            className={`relative rounded-full p-6 ${
              isDragging ? "bg-primary/10" : "bg-secondary"
            }`}
          >
            {isDragging ? (
              <Upload size={36} className="text-primary" />
            ) : (
              <FileUp size={36} className="text-primary" />
            )}
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-medium">
              {isDragging
                ? "Drop Files Here"
                : "Batch Upload Receipts"}
            </h3>
            <p
              id="batch-upload-zone-description"
              className="text-base text-muted-foreground max-w-md mx-auto"
            >
              {isInvalidFile
                ? "Some files are not supported. Please upload only JPEG, PNG, or PDF files."
                : isDragging
                  ? "Release to add files to the queue"
                  : "Drag & drop multiple receipt files here, or click to browse"}
            </p>
          </div>
        </div>

        {/* Illustration when empty */}
        <AnimatePresence>
          {batchUploads.length === 0 && (
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

        {/* Processing controls */}
        <AnimatePresence>
          {batchUploads.length > 0 && (
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
            />
          )}
        </AnimatePresence>

        {/* File queue */}
        <AnimatePresence>
          {batchUploads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mt-4"
            >
              <div className="flex justify-between items-center mb-2">
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
              <ScrollArea className="h-[300px] w-full rounded-md border">
                <div className="p-4 space-y-2">
                  {batchUploads.map(upload => (
                    <UploadQueueItem
                      key={upload.id}
                      upload={upload}
                      receiptId={receiptIds[upload.id]}
                      onRemove={removeFromBatchQueue}
                      onCancel={cancelUpload}
                      onRetry={retryUpload}
                      onViewReceipt={(receiptId) => navigate(`/receipts/${receiptId}`)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add files button */}
        {batchUploads.length === 0 && (
          <Button
            onClick={() => {
              console.log('Select Files button clicked');
              handleFileSelection();
            }}
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

        {/* Add more files button when queue exists */}
        {batchUploads.length > 0 && (
          <Button
            onClick={() => {
              console.log('Add More Files button clicked');
              handleFileSelection();
            }}
            variant="outline"
            className="mt-2"
            size="sm"
          >
            <FileUp className="h-4 w-4 mr-2" />
            Add More Files
          </Button>
        )}

        {/* Current settings and link to settings page */}
        <div className="w-full max-w-md mt-4 mb-4">
          <div className="flex flex-wrap gap-2 justify-center mb-2">
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
    </div>
  );
}
