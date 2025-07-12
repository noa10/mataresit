import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ClipboardList,
  ArrowRight,
  Zap,
  Turtle,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration } from "@/utils/timeEstimation";

interface BatchProcessingControlsProps {
  totalFiles: number;
  pendingFiles: number;
  activeFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalProgress: number;
  isProcessing: boolean;
  isPaused: boolean;
  onStartProcessing: () => void;
  onPauseProcessing: () => void;
  onClearQueue: () => void;
  onClearAll: () => void;
  onRetryAllFailed?: () => void;
  onShowReview?: () => void;
  allComplete?: boolean;
  startTime?: number;
  averageFileSize?: number;
  processingMethod?: 'ai-vision';
  isProgressUpdating?: boolean; // New prop to indicate when progress is actively updating
}

export function BatchProcessingControls({
  totalFiles,
  pendingFiles,
  activeFiles,
  completedFiles,
  failedFiles,
  totalProgress,
  isProcessing,
  isPaused,
  onStartProcessing,
  onPauseProcessing,
  onClearQueue,
  onClearAll,
  onRetryAllFailed,
  onShowReview,
  allComplete = false,
  startTime,
  averageFileSize = 1024 * 1024, // Default 1MB
  processingMethod = 'ai-vision',
  isProgressUpdating = false
}: BatchProcessingControlsProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  // Update elapsed time and estimate remaining time
  useEffect(() => {
    if (!startTime || !isProcessing) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Calculate estimated time remaining
      if (completedFiles > 0) {
        const averageTimePerFile = elapsed / completedFiles;
        const remaining = averageTimePerFile * pendingFiles;
        setEstimatedTimeRemaining(remaining);
      } else {
        // Initial estimate based on file size and method
        const baseTimePerFile = processingMethod === 'ai-vision' ? 25000 : 20000; // ms
        const sizeMultiplier = averageFileSize > 2 * 1024 * 1024 ? 1.5 : 1.0;
        const estimatedTimePerFile = baseTimePerFile * sizeMultiplier;
        setEstimatedTimeRemaining(estimatedTimePerFile * pendingFiles);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isProcessing, completedFiles, pendingFiles, averageFileSize, processingMethod]);

  // Calculate processing speed
  const getProcessingSpeed = () => {
    if (!startTime || completedFiles === 0) return { speed: 'normal', icon: Activity, color: 'text-blue-500' };

    const averageTimePerFile = elapsedTime / completedFiles;

    if (averageTimePerFile < 15000) { // Less than 15 seconds per file
      return { speed: 'fast', icon: Zap, color: 'text-green-500' };
    } else if (averageTimePerFile > 35000) { // More than 35 seconds per file
      return { speed: 'slow', icon: Turtle, color: 'text-amber-500' };
    } else {
      return { speed: 'normal', icon: Activity, color: 'text-blue-500' };
    }
  };

  const speedInfo = getProcessingSpeed();

  // No files to display
  if (totalFiles === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="w-full p-4 border rounded-lg bg-background shadow-sm"
    >
      <div className="flex flex-col space-y-4">
        {/* Status summary */}
        <div className="flex flex-col space-y-2">
          <h3 className="text-sm font-medium">Batch Upload Status</h3>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              <Upload className="w-4 h-4 mr-1" />
              <span className="text-xs font-medium">Total: {totalFiles}</span>
            </div>

            {pendingFiles > 0 && (
              <div className="flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">Queued: {pendingFiles}</span>
              </div>
            )}

            {activeFiles > 0 && (
              <div className="flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                <span className="text-xs font-medium">Processing: {activeFiles}</span>
              </div>
            )}

            {completedFiles > 0 && (
              <div className="flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">Completed: {completedFiles}</span>
              </div>
            )}

            {failedFiles > 0 && (
              <div className="flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700">
                <XCircle className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">Failed: {failedFiles}</span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Progress bar with time estimation */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isProcessing
                  ? isPaused
                    ? "Paused"
                    : "Processing..."
                  : pendingFiles > 0
                    ? "Ready to process"
                    : "Complete"}
              </span>

              {/* Live indicator when progress is updating */}
              {isProgressUpdating && (
                <Badge variant="secondary" className="px-2 py-1 text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Live
                </Badge>
              )}

              {isProcessing && !isPaused && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <speedInfo.icon className={`h-3 w-3 ${speedInfo.color}`} />
                        <Badge variant="outline" className="text-xs">
                          {speedInfo.speed}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Processing speed: {speedInfo.speed}</p>
                      {completedFiles > 0 && (
                        <p>Average: {formatDuration(elapsedTime / completedFiles)} per file</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <motion.span
              className={`text-xs font-medium ${
                isProgressUpdating ? 'text-primary' : 'text-muted-foreground'
              }`}
              key={Math.round(totalProgress)}
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
              {completedFiles}/{totalFiles} ({Math.round(totalProgress)}%)
            </motion.span>
          </div>

          {/* Time information */}
          {startTime && isProcessing && !isPaused && (
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Elapsed: {formatDuration(elapsedTime)}</span>
              </div>
              {estimatedTimeRemaining > 0 && pendingFiles > 0 && (
                <div className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  <span>~{formatDuration(estimatedTimeRemaining)} remaining</span>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <Progress
              value={totalProgress}
              className={`h-3 transition-all duration-300 ${
                isProgressUpdating
                  ? 'shadow-sm shadow-primary/30'
                  : ''
              }`}
              aria-label={`Batch progress: ${totalProgress}%`}
            />
            {/* Pulse effect when updating */}
            {isProgressUpdating && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full"
                animate={{
                  opacity: [0.3, 0.7, 0.3],
                  scale: [1, 1.02, 1]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {/* Show Review Results button when all processing is complete */}
            {allComplete && onShowReview ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onShowReview}
                  className="h-8"
                >
                  <ClipboardList className="h-3 w-3 mr-2" />
                  Review Results
                </Button>
              </>
            ) : (
              /* Start/Pause button */
              isProcessing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPauseProcessing}
                  disabled={activeFiles === 0 && pendingFiles === 0}
                  className="h-8"
                >
                  <Pause className="h-3 w-3 mr-2" />
                  Pause
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    console.log('Start Processing button clicked');
                    onStartProcessing();
                  }}
                  disabled={pendingFiles === 0}
                  className="h-8"
                >
                  <Play className="h-3 w-3 mr-2" />
                  {isPaused ? "Resume" : "Start Processing"}
                </Button>
              )
            )}

            {/* Retry all failed button */}
            {failedFiles > 0 && onRetryAllFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryAllFailed}
                className="h-8"
              >
                <XCircle className="h-3 w-3 mr-2 text-destructive" />
                Retry Failed ({failedFiles})
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Clear queue button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onClearQueue}
              disabled={pendingFiles === 0 || allComplete}
              className="h-8"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Clear Queue
            </Button>

            {/* Clear all button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={(isProcessing && !isPaused) && !allComplete}
              className="h-8"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
