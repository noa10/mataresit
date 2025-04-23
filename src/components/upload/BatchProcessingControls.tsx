import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2
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
  onClearAll
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Batch Upload Status</h3>

          <div className="flex items-center space-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-1">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs">{totalFiles}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total files</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-1">
                    <Loader2 className={`w-4 h-4 text-primary ${activeFiles > 0 ? 'animate-spin' : ''}`} />
                    <span className="text-xs">{activeFiles}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Processing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs">{completedFiles}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Completed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-1">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-xs">{failedFiles}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Failed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
        <div className="flex justify-between">
          <div className="space-x-2">
            {/* Start/Pause button */}
            {isProcessing ? (
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
            )}
          </div>

          <div className="space-x-2">
            {/* Clear queue button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onClearQueue}
              disabled={pendingFiles === 0}
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
              disabled={isProcessing && !isPaused}
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
