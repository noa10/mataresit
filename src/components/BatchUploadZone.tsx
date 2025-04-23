import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBatchFileUpload } from "@/hooks/useBatchFileUpload";
import { UploadQueueItem } from "@/components/upload/UploadQueueItem";
import { BatchProcessingControls } from "@/components/upload/BatchProcessingControls";
import { DropZoneIllustrations } from "./upload/DropZoneIllustrations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchUploadZoneProps {
  onUploadComplete?: () => void;
  maxConcurrent?: number;
  autoStart?: boolean;
}

export default function BatchUploadZone({
  onUploadComplete,
  maxConcurrent = 2,
  autoStart = false
}: BatchUploadZoneProps) {
  const [showOptions, setShowOptions] = useState(false);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef<number>(0);
  const navigate = useNavigate();

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
  } = useBatchFileUpload({ maxConcurrent, autoStart });

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
      // Directly add files to batch queue
      addToBatchQueue(e.dataTransfer.files);
    }
  };

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
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
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
              <h4 className="text-sm font-medium mb-2 text-left">Files ({batchUploads.length})</h4>
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

        {/* Processing options */}
        <Collapsible
          open={showOptions}
          onOpenChange={setShowOptions}
          className="w-full max-w-md mt-4 mb-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Advanced Options</h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                {showOptions ? "Hide Options" : "Show Options"}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Maximum concurrent uploads: {maxConcurrent}
                </label>
                <p className="text-xs text-muted-foreground">
                  Processing multiple receipts at once can speed up batch uploads but may use more resources.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-start"
                  checked={autoStart}
                  readOnly
                  className="rounded border-gray-300"
                />
                <label htmlFor="auto-start" className="text-sm">
                  Automatically start processing when files are added
                </label>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
