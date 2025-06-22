import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  FileImage,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  RotateCcw,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ReceiptUpload } from "@/types/receipt";
import { Link } from "react-router-dom";

interface UploadQueueItemProps {
  upload: ReceiptUpload;
  receiptId?: string;
  onRemove?: (uploadId: string) => void;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onViewReceipt?: (receiptId: string) => void;
  isProgressUpdating?: boolean; // New prop to indicate when progress is actively updating
}

export function UploadQueueItem({
  upload,
  receiptId,
  onRemove,
  onCancel,
  onRetry,
  onViewReceipt,
  isProgressUpdating = false
}: UploadQueueItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Format file size
  const formatFileSize = (sizeInBytes: number): string => {
    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (upload.status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (upload.status) {
      case 'pending':
        return "Queued";
      case 'uploading':
        return upload.uploadProgress < 50
          ? `Uploading (${upload.uploadProgress}%)`
          : "Processing image";
      case 'processing':
        return `Processing (${upload.uploadProgress}%)`;
      case 'completed':
        return "Completed";
      case 'error':
        return upload.error?.message || "Failed";
      default:
        return "Unknown";
    }
  };

  // Get action buttons based on status
  const getActionButtons = () => {
    if (upload.status === 'pending' && onRemove) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(upload.id)}
          className="h-7 w-7"
          aria-label="Remove from queue"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      );
    }

    if ((upload.status === 'uploading' || upload.status === 'processing') && onCancel) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCancel(upload.id)}
          className="h-7 w-7"
          aria-label="Cancel upload"
        >
          <XCircle className="h-3 w-3" />
        </Button>
      );
    }

    if (upload.status === 'error' && onRetry) {
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRetry(upload.id)}
          className="h-7 w-7"
          aria-label="Retry upload"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      );
    }

    if (upload.status === 'completed' && receiptId) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="View receipt"
          onClick={() => onViewReceipt && onViewReceipt(receiptId)}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`w-full p-3 border rounded-lg ${
        upload.status === 'error'
          ? 'border-destructive/30 bg-destructive/5'
          : upload.status === 'completed'
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-border bg-background/50'
      } flex items-center space-x-3`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-upload-status={upload.status}
      data-upload-id={upload.id}
    >
      {/* File icon or preview */}
      <div className="flex-shrink-0">
        {upload.file.type === 'application/pdf' ? (
          <FileText className="w-8 h-8 text-muted-foreground" />
        ) : (
          <FileImage className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      {/* File info and progress */}
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-center">
          {upload.status === 'completed' && receiptId && onViewReceipt ? (
            <button
              className="text-sm font-medium truncate text-primary hover:underline text-left"
              title={`View receipt details for ${upload.file.name}`}
              onClick={() => onViewReceipt(receiptId)}
            >
              {upload.file.name}
            </button>
          ) : (
            <p className="text-sm font-medium truncate" title={upload.file.name}>
              {upload.file.name}
            </p>
          )}
          <div className="flex items-center space-x-1 ml-2">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {getStatusText()}
            </span>
          </div>
        </div>

        <div className="flex items-center text-xs text-muted-foreground mt-1">
          <span>{formatFileSize(upload.file.size)}</span>
        </div>

        {/* Enhanced Progress bar for uploading/processing */}
        {(upload.status === 'uploading' || upload.status === 'processing') && (
          <div className="mt-2">
            <Progress
              value={upload.uploadProgress}
              className={`h-1 transition-all duration-300 ${
                isProgressUpdating
                  ? 'shadow-sm shadow-primary/30'
                  : ''
              }`}
              aria-label={`Upload progress: ${upload.uploadProgress}%`}
            />
            {/* Progress percentage with animation */}
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {upload.status === 'uploading' ? 'Uploading...' : 'Processing...'}
              </span>
              <motion.span
                className={`text-xs font-medium ${
                  isProgressUpdating ? 'text-primary' : 'text-muted-foreground'
                }`}
                key={Math.round(upload.uploadProgress)}
                initial={{ scale: 1.1, opacity: 0.8 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  color: isProgressUpdating ? '#3b82f6' : undefined
                }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut"
                }}
              >
                {Math.round(upload.uploadProgress)}%
              </motion.span>
            </div>
          </div>
        )}

        {/* Error message */}
        {upload.status === 'error' && upload.error && (
          <p className="text-xs text-destructive mt-1 truncate" title={upload.error.message}>
            {upload.error.message}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0">
        {getActionButtons()}
      </div>
    </motion.div>
  );
}
