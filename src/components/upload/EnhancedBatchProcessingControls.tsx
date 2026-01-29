/**
 * Enhanced Batch Processing Controls
 * Phase 3: Batch Upload Optimization - Minimalist Redesign
 * 
 * Simplified highly minimalist UI focusing on core utility:
 * - Real-time progress (Thicker prominent bar)
 * - Clear Call to Action (Large Start Button)
 * - Condensed Status Row
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ClipboardList,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ProcessingStrategy,
  ProgressMetrics,
  ETACalculation,
  ProgressAlert,
  useProgressFormatting
} from "@/lib/progress-tracking";
import { TooltipProvider } from "@/components/ui/tooltip";

interface EnhancedBatchProcessingControlsProps {
  // Basic batch processing props
  totalFiles: number;
  pendingFiles: number;
  activeFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalProgress: number;
  isProcessing: boolean;
  isPaused: boolean;

  // Control callbacks
  onStartProcessing: () => void;
  onPauseProcessing: () => void;
  onClearQueue: () => void;
  onClearAll: () => void;
  onRetryAllFailed?: () => void;
  onShowReview?: () => void;
  allComplete?: boolean;

  // Phase 3: Enhanced features (kept for compatibility, but many visual elements removed)
  processingStrategy?: ProcessingStrategy;
  onProcessingStrategyChange?: (strategy: ProcessingStrategy) => void;
  progressMetrics?: ProgressMetrics | null;
  etaCalculation?: ETACalculation | null;
  progressAlerts?: ProgressAlert[];
  rateLimitStatus?: any;
  rateLimitMetrics?: any;
  rateLimitEvents?: any[];
  rateLimitAlerts?: any[];
  quotaData?: any;
  quotaAlerts?: any[];
  efficiencyData?: any;
  efficiencyRecommendations?: string[];
  performanceGrade?: { grade: string; score: number };
  onDismissAlert?: (alertId: string) => void;
  onDismissRateLimitAlert?: (alertId: string) => void;
  onDismissQuotaAlert?: (alertId: string) => void;
  onRefreshQuota?: () => Promise<void>;
  onStrategyRecommendation?: (strategy: ProcessingStrategy) => void;
  onOptimizationRecommendation?: (recommendation: string) => void;
  enableAdvancedView?: boolean;
  onToggleAdvancedView?: () => void;
}

export function EnhancedBatchProcessingControls({
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
  progressAlerts = [],
  onDismissAlert,
  // Props below are kept for interface compatibility but may not be used in the minimalist view
  etaCalculation,
}: EnhancedBatchProcessingControlsProps) {

  const {
    getProgressColor
  } = useProgressFormatting();

  return (
    <TooltipProvider>
      <Card className="w-full border-none shadow-none bg-transparent">
        <CardContent className="p-0 space-y-6">

          {/* Header & Title - Simplified */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Batch Processing
              {totalFiles > 0 && (
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  ({completedFiles + failedFiles} / {totalFiles})
                </span>
              )}
            </h3>

            {/* Minimalist Clear Actions - Only show if not processing */}
            {!isProcessing && (
              <div className="flex gap-2">
                {pendingFiles > 0 && (
                  <Button variant="ghost" size="sm" onClick={onClearQueue} className="text-xs h-7 text-muted-foreground hover:text-foreground">
                    Clear Queue
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs h-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All
                </Button>
              </div>
            )}
          </div>

          {/* Progress Alerts - Kept for critical info */}
          <AnimatePresence>
            {progressAlerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 mb-4"
              >
                {progressAlerts.slice(0, 2).map((alert) => (
                  <Alert key={alert.id} variant={alert.severity === 'high' ? 'destructive' : 'default'} className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between text-xs">
                      <span>{alert.message}</span>
                      {onDismissAlert && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDismissAlert(alert.id)}
                          className="h-5 w-5 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prominent Progress Bar */}
          {totalFiles > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
                <span className="text-2xl font-bold">{totalProgress.toFixed(1)}%</span>
              </div>
              <Progress
                value={totalProgress}
                className="h-4 sm:h-5 rounded-full"
                style={{
                  '--progress-background': getProgressColor(totalProgress)
                } as React.CSSProperties}
              />
              {/* Optional ETA subtext */}
              {isProcessing && etaCalculation && (
                <div className="text-right text-xs text-muted-foreground">
                  ~{(etaCalculation.estimatedTimeRemainingMs / 1000).toFixed(0)}s remaining
                </div>
              )}
            </div>
          )}

          {/* Condensed Status Row */}
          {totalFiles > 0 && (
            <div className="flex items-center justify-start gap-4 sm:gap-8 flex-wrap py-2 border-b border-border/40 pb-4">
              <div className="flex items-center gap-2" title="Completed">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-lg">{completedFiles}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Completed</span>
              </div>

              <div className="flex items-center gap-2" title="Processing">
                <Loader2 className={`h-5 w-5 text-blue-500 ${isProcessing ? 'animate-spin' : ''}`} />
                <span className="font-semibold text-lg">{activeFiles}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Processing</span>
              </div>

              <div className="flex items-center gap-2" title="Pending">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="font-semibold text-lg">{pendingFiles}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Pending</span>
              </div>

              <div className="flex items-center gap-2" title="Failed">
                <XCircle className={`h-5 w-5 ${failedFiles > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                <span className={`font-semibold text-lg ${failedFiles > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{failedFiles}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Failed</span>
              </div>
            </div>
          )}

          {/* Primary Action Button - Large & Centered */}
          <div className="pt-2">
            {allComplete && onShowReview ? (
              <Button
                variant="default"
                size="lg"
                onClick={onShowReview}
                className="w-full h-14 text-lg shadow-lg"
              >
                <ClipboardList className="h-5 w-5 mr-2" />
                Review Results
              </Button>
            ) : isProcessing ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={onPauseProcessing}
                className="w-full h-14 text-lg border-2"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause Processing
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="default"
                  size="lg"
                  onClick={onStartProcessing}
                  disabled={pendingFiles === 0 && failedFiles === 0}
                  className="w-full h-14 text-lg shadow-lg font-bold tracking-wide"
                >
                  <Play className="h-5 w-5 mr-3 fill-current" />
                  {activeFiles > 0 ? "Resume Processing" : "Start Processing"}
                </Button>

                {/* Retry Option if needed, secondary to the big button */}
                {failedFiles > 0 && onRetryAllFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetryAllFailed}
                    className="w-full h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                  >
                    <Loader2 className="h-4 w-4 mr-2" />
                    Retry {failedFiles} Failed Files
                  </Button>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
