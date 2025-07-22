/**
 * Enhanced Upload Queue Item
 * Phase 3: Batch Upload Optimization
 * 
 * Enhanced upload queue item with detailed progress tracking,
 * stage indicators, performance metrics, and rate limiting status.
 */

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
  ExternalLink,
  Clock,
  Zap,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReceiptUpload } from "@/types/receipt";
import { FileProgressDetail, useProgressFormatting } from "@/lib/progress-tracking";
import { Link } from "react-router-dom";

interface EnhancedUploadQueueItemProps {
  upload: ReceiptUpload;
  receiptId?: string;
  onRemove?: (uploadId: string) => void;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onViewReceipt?: (receiptId: string) => void;
  isProgressUpdating?: boolean;
  
  // Phase 3: Enhanced progress tracking
  fileProgressDetail?: FileProgressDetail;
  showDetailedProgress?: boolean;
  rateLimited?: boolean;
  estimatedCost?: number;
  processingTimeMs?: number;
}

export function EnhancedUploadQueueItem({
  upload,
  receiptId,
  onRemove,
  onCancel,
  onRetry,
  onViewReceipt,
  isProgressUpdating = false,
  fileProgressDetail,
  showDetailedProgress = false,
  rateLimited = false,
  estimatedCost,
  processingTimeMs
}: EnhancedUploadQueueItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const { formatDuration, formatCost, formatFileSize } = useProgressFormatting();

  // Format file size
  const formatFileSizeLocal = (sizeInBytes: number): string => {
    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  // Get status color and icon
  const getStatusInfo = () => {
    switch (upload.status) {
      case 'completed':
        return {
          color: 'text-green-600',
          bgColor: 'border-green-500/30 bg-green-500/5',
          icon: CheckCircle2,
          label: 'Completed'
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'border-destructive/30 bg-destructive/5',
          icon: XCircle,
          label: 'Failed'
        };
      case 'processing':
        return {
          color: 'text-blue-600',
          bgColor: 'border-blue-500/30 bg-blue-500/5',
          icon: Loader2,
          label: 'Processing'
        };
      case 'uploading':
        return {
          color: 'text-orange-600',
          bgColor: 'border-orange-500/30 bg-orange-500/5',
          icon: Loader2,
          label: 'Uploading'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'border-border bg-background/50',
          icon: Clock,
          label: 'Pending'
        };
    }
  };

  // Get stage progress information
  const getStageInfo = () => {
    if (!fileProgressDetail) return null;
    
    const stageLabels = {
      uploading: 'Uploading to cloud storage',
      processing: 'AI processing and analysis',
      embedding: 'Generating embeddings',
      storing: 'Storing receipt data',
      completed: 'Processing complete'
    };
    
    return {
      label: stageLabels[fileProgressDetail.stage] || fileProgressDetail.stage,
      progress: fileProgressDetail.stageProgress
    };
  };

  const statusInfo = getStatusInfo();
  const stageInfo = getStageInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`w-full p-3 border rounded-lg ${statusInfo.bgColor} transition-all duration-200 ${
          isHovered ? 'shadow-md' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-upload-status={upload.status}
        data-upload-id={upload.id}
      >
        <div className="flex items-start space-x-3">
          {/* File icon or preview */}
          <div className="flex-shrink-0 relative">
            {upload.file.type === 'application/pdf' ? (
              <FileText className="w-8 h-8 text-muted-foreground" />
            ) : (
              <FileImage className="w-8 h-8 text-muted-foreground" />
            )}
            
            {/* Rate limited indicator */}
            {rateLimited && (
              <div className="absolute -top-1 -right-1">
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rate limited - processing delayed</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* File info and progress */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* File name and status */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={upload.file.name}>
                  {upload.file.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSizeLocal(upload.file.size)}</span>
                  {processingTimeMs && (
                    <>
                      <span>•</span>
                      <span>{formatDuration(processingTimeMs)}</span>
                    </>
                  )}
                  {estimatedCost && (
                    <>
                      <span>•</span>
                      <span>{formatCost(estimatedCost)}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${statusInfo.color} border-current`}>
                  <StatusIcon className={`w-3 h-3 mr-1 ${upload.status === 'processing' || upload.status === 'uploading' ? 'animate-spin' : ''}`} />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            {/* Progress bar */}
            {(upload.status === 'uploading' || upload.status === 'processing') && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{stageInfo?.label || 'Processing...'}</span>
                  <span>{upload.progress}%</span>
                </div>
                <Progress 
                  value={upload.progress} 
                  className="h-1.5"
                />
                
                {/* Stage progress (if available) */}
                {showDetailedProgress && stageInfo && stageInfo.progress > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Stage progress</span>
                      <span>{stageInfo.progress}%</span>
                    </div>
                    <Progress 
                      value={stageInfo.progress} 
                      className="h-1"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Enhanced progress details */}
            {showDetailedProgress && fileProgressDetail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1"
              >
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>API calls: {fileProgressDetail.apiCalls}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>Tokens: {fileProgressDetail.tokensUsed}</span>
                </div>
                {fileProgressDetail.retryCount > 0 && (
                  <div className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    <span>Retries: {fileProgressDetail.retryCount}</span>
                  </div>
                )}
                {fileProgressDetail.qualityScore && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Quality: {(fileProgressDetail.qualityScore * 100).toFixed(0)}%</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Error message */}
            {upload.status === 'error' && upload.error && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                {upload.error.message}
              </div>
            )}

            {/* Warning messages */}
            {fileProgressDetail?.warningMessages && fileProgressDetail.warningMessages.length > 0 && (
              <div className="space-y-1">
                {fileProgressDetail.warningMessages.map((warning, index) => (
                  <div key={index} className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-1 rounded">
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {upload.status === 'completed' && receiptId && onViewReceipt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewReceipt(receiptId)}
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View receipt</p>
                </TooltipContent>
              </Tooltip>
            )}

            {upload.status === 'error' && onRetry && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRetry(upload.id)}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry upload</p>
                </TooltipContent>
              </Tooltip>
            )}

            {(upload.status === 'processing' || upload.status === 'uploading') && onCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(upload.id)}
                    className="h-8 w-8 p-0"
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel upload</p>
                </TooltipContent>
              </Tooltip>
            )}

            {(upload.status === 'pending' || upload.status === 'error') && onRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(upload.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove from queue</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Details toggle for enhanced view */}
            {showDetailedProgress && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    className="h-8 w-8 p-0"
                  >
                    <Activity className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle details</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
