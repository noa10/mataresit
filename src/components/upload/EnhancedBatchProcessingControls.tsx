/**
 * Enhanced Batch Processing Controls
 * Phase 3: Batch Upload Optimization
 * 
 * Advanced batch processing controls with processing strategy selection,
 * rate limiting status, enhanced progress indicators, and performance metrics.
 */

import React, { useState, useEffect } from "react";
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
  Settings,
  Zap,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Target,
  BarChart3,
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ProcessingStrategy,
  ProgressMetrics,
  ETACalculation,
  ProgressAlert,
  useProgressFormatting
} from "@/lib/progress-tracking";
import { RateLimitStatusDisplay } from "@/components/monitoring/RateLimitStatusDisplay";
import { APIQuotaUsageDisplay } from "@/components/monitoring/APIQuotaUsageDisplay";
import { ProcessingEfficiencyDisplay } from "@/components/monitoring/ProcessingEfficiencyDisplay";
import { useRateLimitMonitoring } from "@/hooks/useRateLimitMonitoring";

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

  // Phase 3: Enhanced features
  processingStrategy?: ProcessingStrategy;
  onProcessingStrategyChange?: (strategy: ProcessingStrategy) => void;
  progressMetrics?: ProgressMetrics | null;
  etaCalculation?: ETACalculation | null;
  progressAlerts?: ProgressAlert[];
  rateLimitStatus?: {
    isRateLimited: boolean;
    requestsRemaining: number;
    tokensRemaining: number;
    backoffMs: number;
  } | null;
  rateLimitMetrics?: any; // AdaptiveMetrics from rate limiting
  rateLimitEvents?: any[]; // RateLimitEvent[] from rate limiting
  rateLimitAlerts?: any[]; // Rate limit specific alerts
  quotaData?: any; // QuotaUsageData from quota monitoring
  quotaAlerts?: any[]; // Quota specific alerts
  efficiencyData?: any; // ProcessingEfficiencyData from efficiency monitoring
  efficiencyRecommendations?: string[]; // Optimization recommendations
  performanceGrade?: { grade: string; score: number }; // Performance grade
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
  processingStrategy = 'balanced',
  onProcessingStrategyChange,
  progressMetrics,
  etaCalculation,
  progressAlerts = [],
  rateLimitStatus,
  rateLimitMetrics,
  rateLimitEvents = [],
  rateLimitAlerts = [],
  quotaData,
  quotaAlerts = [],
  efficiencyData,
  efficiencyRecommendations = [],
  performanceGrade,
  onDismissAlert,
  onDismissRateLimitAlert,
  onDismissQuotaAlert,
  onRefreshQuota,
  onStrategyRecommendation,
  onOptimizationRecommendation,
  enableAdvancedView = false,
  onToggleAdvancedView
}: EnhancedBatchProcessingControlsProps) {
  const [showStrategySelector, setShowStrategySelector] = useState(false);
  
  const {
    formatDuration,
    formatThroughput,
    formatCost,
    formatPercentage,
    getProgressColor,
    getQualityColor
  } = useProgressFormatting();

  // Processing strategy configurations
  const strategyConfigs = {
    conservative: {
      label: 'Conservative',
      description: 'Slower but more reliable processing',
      icon: Target,
      color: 'text-green-600',
      concurrent: 1,
      rateLimit: '30/min'
    },
    balanced: {
      label: 'Balanced',
      description: 'Optimal balance of speed and reliability',
      icon: Activity,
      color: 'text-blue-600',
      concurrent: 2,
      rateLimit: '60/min'
    },
    aggressive: {
      label: 'Aggressive',
      description: 'Faster processing with higher resource usage',
      icon: Zap,
      color: 'text-orange-600',
      concurrent: 4,
      rateLimit: '120/min'
    },
    adaptive: {
      label: 'Adaptive',
      description: 'AI-optimized processing based on performance',
      icon: BarChart3,
      color: 'text-purple-600',
      concurrent: 3,
      rateLimit: '90/min'
    }
  };

  const currentStrategyConfig = strategyConfigs[processingStrategy];

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Batch Processing
              {totalFiles > 0 && (
                <Badge variant="outline" className="ml-2">
                  {completedFiles + failedFiles} / {totalFiles}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Processing Strategy Selector */}
              {onProcessingStrategyChange && !isProcessing && (
                <Select
                  value={processingStrategy}
                  onValueChange={(value) => onProcessingStrategyChange(value as ProcessingStrategy)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(strategyConfigs).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Advanced View Toggle */}
              {onToggleAdvancedView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleAdvancedView}
                  className="h-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Alerts */}
          <AnimatePresence>
            {progressAlerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {progressAlerts.slice(0, 2).map((alert) => (
                  <Alert key={alert.id} variant={alert.severity === 'high' ? 'destructive' : 'default'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-sm">{alert.message}</span>
                      {onDismissAlert && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDismissAlert(alert.id)}
                          className="h-6 px-2"
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

          {/* Main Progress Bar */}
          {totalFiles > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{totalProgress.toFixed(1)}%</span>
              </div>
              <Progress 
                value={totalProgress} 
                className="h-2"
                style={{ 
                  '--progress-background': getProgressColor(totalProgress) 
                } as React.CSSProperties}
              />
            </div>
          )}

          {/* File Status Grid */}
          {totalFiles > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">{completedFiles}</span>
                </div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center justify-center gap-1 text-blue-600">
                  <Loader2 className="h-4 w-4" />
                  <span className="font-semibold">{activeFiles}</span>
                </div>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-950/20">
                <div className="flex items-center justify-center gap-1 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{pendingFiles}</span>
                </div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center justify-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="font-semibold">{failedFiles}</span>
                </div>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          )}

          {/* Enhanced Metrics (Advanced View) */}
          <AnimatePresence>
            {enableAdvancedView && progressMetrics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <Separator />
                
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="text-sm font-semibold">
                      {formatThroughput(progressMetrics.currentThroughput)}
                    </div>
                    <p className="text-xs text-muted-foreground">Throughput</p>
                  </div>
                  <div className="text-center">
                    <div 
                      className="text-sm font-semibold"
                      style={{ color: getQualityColor(progressMetrics.qualityScore) }}
                    >
                      {formatPercentage(progressMetrics.qualityScore)}
                    </div>
                    <p className="text-xs text-muted-foreground">Quality</p>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">
                      {formatCost(progressMetrics.estimatedCost)}
                    </div>
                    <p className="text-xs text-muted-foreground">Est. Cost</p>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">
                      {formatPercentage(progressMetrics.apiSuccessRate)}
                    </div>
                    <p className="text-xs text-muted-foreground">API Success</p>
                  </div>
                </div>

                {/* ETA Information */}
                {etaCalculation && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        ETA: {formatDuration(etaCalculation.estimatedTimeRemainingMs)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {(etaCalculation.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                )}

                {/* Enhanced Rate Limiting Status Display */}
                {rateLimitStatus && (
                  <RateLimitStatusDisplay
                    status={rateLimitStatus}
                    metrics={rateLimitMetrics}
                    events={rateLimitEvents}
                    compact={!enableAdvancedView}
                    showAdvanced={enableAdvancedView}
                    className="w-full"
                    onRefresh={() => {
                      // Refresh will be handled by the monitoring hook
                    }}
                  />
                )}

                {/* Rate Limit Alerts */}
                {rateLimitAlerts.length > 0 && (
                  <div className="space-y-2">
                    {rateLimitAlerts.map((alert: any) => (
                      <Alert key={alert.id} className={`${
                        alert.type === 'error' ? 'border-red-200 bg-red-50' :
                        alert.type === 'warning' ? 'border-orange-200 bg-orange-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <AlertDescription className="flex items-center justify-between">
                          <span className="text-sm">{alert.message}</span>
                          {onDismissRateLimitAlert && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDismissRateLimitAlert(alert.id)}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* API Quota Usage Display */}
                {quotaData && enableAdvancedView && (
                  <APIQuotaUsageDisplay
                    quotaData={quotaData}
                    apiProvider="Gemini"
                    showPredictions={true}
                    showRecommendations={true}
                    onRefresh={onRefreshQuota}
                    onStrategyRecommendation={onStrategyRecommendation}
                    className="w-full"
                  />
                )}

                {/* Quota Alerts */}
                {quotaAlerts.length > 0 && (
                  <div className="space-y-2">
                    {quotaAlerts.map((alert: any) => (
                      <Alert key={alert.id} className={`${
                        alert.type === 'critical' ? 'border-red-200 bg-red-50' :
                        alert.type === 'warning' ? 'border-orange-200 bg-orange-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <AlertDescription className="flex items-center justify-between">
                          <span className="text-sm">{alert.message}</span>
                          {onDismissQuotaAlert && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDismissQuotaAlert(alert.id)}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Processing Efficiency Display */}
                {efficiencyData && enableAdvancedView && (
                  <ProcessingEfficiencyDisplay
                    data={efficiencyData}
                    showRecommendations={true}
                    showTrends={false}
                    onOptimizationRecommendation={onOptimizationRecommendation}
                    className="w-full"
                  />
                )}

                {/* Performance Grade Summary */}
                {performanceGrade && !enableAdvancedView && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Performance Grade</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('font-bold', {
                        'border-green-200 text-green-700 bg-green-50': performanceGrade.grade === 'A',
                        'border-blue-200 text-blue-700 bg-blue-50': performanceGrade.grade === 'B',
                        'border-yellow-200 text-yellow-700 bg-yellow-50': performanceGrade.grade === 'C',
                        'border-orange-200 text-orange-700 bg-orange-50': performanceGrade.grade === 'D',
                        'border-red-200 text-red-700 bg-red-50': performanceGrade.grade === 'F'
                      })}
                    >
                      {performanceGrade.grade} ({performanceGrade.score}/100)
                    </Badge>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div className="flex flex-wrap gap-2">
              {/* Show Review Results button when all processing is complete */}
              {allComplete && onShowReview ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onShowReview}
                  className="h-8"
                >
                  <ClipboardList className="h-3 w-3 mr-2" />
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
                    <Pause className="h-3 w-3 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onStartProcessing}
                    disabled={pendingFiles === 0}
                    className="h-8"
                  >
                    <Play className="h-3 w-3 mr-2" />
                    Start Processing
                  </Button>
                )
              )}

              {/* Retry All Failed button */}
              {failedFiles > 0 && onRetryAllFailed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryAllFailed}
                  className="h-8"
                >
                  <Loader2 className="h-3 w-3 mr-2" />
                  Retry Failed ({failedFiles})
                </Button>
              )}
            </div>

            {/* Clear buttons */}
            <div className="flex gap-2">
              {pendingFiles > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearQueue}
                  className="h-8 text-muted-foreground"
                >
                  Clear Queue
                </Button>
              )}
              {totalFiles > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  className="h-8 text-muted-foreground"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Processing Strategy Info */}
          {!isProcessing && totalFiles > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
              <div className="flex items-center gap-2">
                <currentStrategyConfig.icon className={`h-4 w-4 ${currentStrategyConfig.color}`} />
                <span>
                  <strong>{currentStrategyConfig.label}</strong> - {currentStrategyConfig.description}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {currentStrategyConfig.concurrent} concurrent • {currentStrategyConfig.rateLimit}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
