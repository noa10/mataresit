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
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  allComplete = false
}: BatchProcessingControlsProps) {
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

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {isProcessing
                ? isPaused
                  ? "Paused"
                  : "Processing..."
                : pendingFiles > 0
                  ? "Ready to process"
                  : "Complete"}
            </span>
            <span className="text-xs font-medium">
              {completedFiles}/{totalFiles} ({Math.round(totalProgress)}%)
            </span>
          </div>
          <Progress
            value={totalProgress}
            className="h-2"
            aria-label={`Batch progress: ${totalProgress}%`}
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {/* Show Review Results button when all processing is complete */}
            {allComplete && onShowReview ? (
              <Button
                variant="default"
                size="sm"
                onClick={onShowReview}
                className="h-8"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Review Results
              </Button>
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
                  <Pause className="h-4 w-4 mr-2" />
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
                  <Play className="h-4 w-4 mr-2" />
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
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
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
              <Trash2 className="h-4 w-4 mr-2" />
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
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
