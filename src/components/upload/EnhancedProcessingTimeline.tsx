import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Zap, Turtle, Activity } from "lucide-react";
import { PROCESSING_STAGES } from "./ProcessingStages";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { 
  calculateInitialEstimate, 
  updateTimeEstimate, 
  formatDuration, 
  getProcessingSpeed,
  ProcessingMetrics,
  ProcessingTimeEstimate 
} from "@/utils/timeEstimation";

interface EnhancedProcessingTimelineProps {
  currentStage: string | null;
  stageHistory: string[];
  uploadProgress: number;
  fileSize?: number;
  processingMethod?: 'ai-vision';
  modelId?: string;
  startTime?: number;
  isProgressUpdating?: boolean; // New prop to indicate when progress is actively updating
}

export function EnhancedProcessingTimeline({
  currentStage,
  stageHistory,
  uploadProgress,
  fileSize = 1024 * 1024, // Default 1MB
  processingMethod = 'ai-vision',
  modelId = 'gemini-2.5-flash-lite',
  startTime,
  isProgressUpdating = false
}: EnhancedProcessingTimelineProps) {
  const orderedStages = ['START', 'FETCH', 'PROCESSING', 'SAVE', 'COMPLETE'];
  const [timeEstimate, setTimeEstimate] = useState<ProcessingTimeEstimate | null>(null);
  const [stageStartTimes, setStageStartTimes] = useState<Record<string, number>>({});
  const [stageCompletionTimes, setStageCompletionTimes] = useState<Record<string, number>>({});

  // Initialize time estimate when processing starts
  useEffect(() => {
    if (currentStage && !timeEstimate && startTime) {
      const estimate = calculateInitialEstimate(fileSize, processingMethod, modelId);
      setTimeEstimate(estimate);
    }
  }, [currentStage, timeEstimate, fileSize, processingMethod, modelId, startTime]);

  // Track stage start times
  useEffect(() => {
    if (currentStage && !stageStartTimes[currentStage]) {
      setStageStartTimes(prev => ({
        ...prev,
        [currentStage]: Date.now()
      }));
    }
  }, [currentStage, stageStartTimes]);

  // Track stage completion times and update estimates
  useEffect(() => {
    const newCompletions: Record<string, number> = {};
    let hasNewCompletions = false;

    stageHistory.forEach(stage => {
      if (!stageCompletionTimes[stage] && stageStartTimes[stage]) {
        newCompletions[stage] = Date.now();
        hasNewCompletions = true;
      }
    });

    if (hasNewCompletions) {
      const updatedCompletionTimes = { ...stageCompletionTimes, ...newCompletions };
      setStageCompletionTimes(updatedCompletionTimes);

      // Update time estimate with actual performance data
      if (startTime && timeEstimate) {
        const metrics: ProcessingMetrics = {
          startTime,
          stageStartTimes,
          stageCompletionTimes: updatedCompletionTimes,
          fileSize,
          processingMethod,
          modelId
        };

        const updatedEstimate = updateTimeEstimate(metrics, currentStage || '', stageHistory);
        setTimeEstimate(updatedEstimate);
      }
    }
  }, [stageHistory, stageCompletionTimes, stageStartTimes, startTime, timeEstimate, fileSize, processingMethod, modelId, currentStage]);

  // Calculate processing speed
  const processingSpeed = startTime ? getProcessingSpeed(
    stageHistory.length,
    orderedStages.length,
    Date.now() - startTime
  ) : { speed: 'normal' as const, description: 'Starting...' };

  // Get speed icon and color
  const getSpeedIndicator = () => {
    switch (processingSpeed.speed) {
      case 'fast':
        return { icon: <Zap className="h-3 w-3" />, color: 'text-green-500', bgColor: 'bg-green-100' };
      case 'slow':
        return { icon: <Turtle className="h-3 w-3" />, color: 'text-amber-500', bgColor: 'bg-amber-100' };
      default:
        return { icon: <Activity className="h-3 w-3" />, color: 'text-blue-500', bgColor: 'bg-blue-100' };
    }
  };

  const speedIndicator = getSpeedIndicator();

  return (
    <div className="mt-6 pt-4 w-full space-y-6">
      {/* Time estimation and speed indicator */}
      {timeEstimate && startTime && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {timeEstimate.estimatedTimeRemaining > 1000 
                ? `${formatDuration(timeEstimate.estimatedTimeRemaining)} remaining`
                : 'Almost done'
              }
            </span>
            {timeEstimate.confidence !== 'medium' && (
              <Badge variant="outline" className="text-xs">
                {timeEstimate.confidence} confidence
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${speedIndicator.bgColor}`}>
              {speedIndicator.icon}
              <span className={`text-xs font-medium ${speedIndicator.color}`}>
                {processingSpeed.description}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Current stage and progress indicator */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground font-medium">
          {currentStage ? PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.name : 'Processing'}
        </span>
        <motion.span
          className={`font-semibold ${isProgressUpdating ? 'text-primary' : 'text-primary'}`}
          key={Math.round(uploadProgress)}
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
          {Math.round(uploadProgress)}%
        </motion.span>
      </div>

      {/* Enhanced stage timeline with prominent progress bar */}
      <div className="flex items-start justify-between relative px-2">
        {/* Enhanced progress bar behind the steps */}
        <div className="absolute left-0 top-[20px] w-full h-2 bg-muted rounded-full -translate-y-1/2">
          <motion.div
            className={`h-full rounded-full shadow-sm transition-all duration-300 ${
              isProgressUpdating
                ? 'bg-gradient-to-r from-primary via-blue-500 to-primary/80 shadow-blue-200'
                : 'bg-gradient-to-r from-primary to-primary/80'
            }`}
            initial={{ width: "0%" }}
            animate={{
              width: `${uploadProgress}%`,
              boxShadow: isProgressUpdating
                ? '0 0 8px rgba(59, 130, 246, 0.4)'
                : '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              boxShadow: { duration: 0.3 }
            }}
          />
          {/* Pulse effect when updating */}
          {isProgressUpdating && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/30 to-primary/10 rounded-full"
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
        
        {/* Steps */}
        {orderedStages.map((stage, idx) => {
          const stageConfig = PROCESSING_STAGES[stage as keyof typeof PROCESSING_STAGES];

          // Skip if stage config is not found
          if (!stageConfig) {
            console.warn(`Stage config not found for: ${stage}`);
            return null;
          }

          const isCurrent = currentStage === stage;
          const isCompleted = stageHistory.includes(stage) || 
                             currentStage === 'COMPLETE' || 
                             orderedStages.indexOf(currentStage || '') > idx;
          const isError = currentStage === 'ERROR';
          
          // Calculate stage duration if completed
          const stageDuration = stageStartTimes[stage] && stageCompletionTimes[stage] 
            ? stageCompletionTimes[stage] - stageStartTimes[stage]
            : null;
          
          let stateClass = "bg-muted text-muted-foreground border-muted";
          if (isCompleted && !isError) stateClass = "bg-primary text-primary-foreground border-primary";
          else if (isCurrent && !isError) stateClass = `bg-background ${stageConfig.color}`;
          else if (isError && (isCurrent || isCompleted)) stateClass = `bg-destructive/20 ${PROCESSING_STAGES.ERROR.color}`;
          
          return (
            <TooltipProvider key={stage}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="z-10 flex flex-col items-center gap-2 flex-1 min-w-0 px-1">
                    <motion.div
                      className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-sm ${stateClass}`}
                      animate={{
                        scale: isCurrent && !isError ? [1, 1.1, 1] : 1,
                        rotate: isCurrent && !isError ? [0, 5, -5, 0] : 0,
                        boxShadow: isCurrent && !isError
                          ? ['0 0 0 rgba(59, 130, 246, 0)', '0 0 8px rgba(59, 130, 246, 0.3)', '0 0 0 rgba(59, 130, 246, 0)']
                          : '0 0 0 rgba(59, 130, 246, 0)'
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: isCurrent && !isError ? Infinity : 0,
                        repeatDelay: 1,
                        boxShadow: {
                          duration: 2,
                          repeat: isCurrent && !isError ? Infinity : 0,
                          ease: "easeInOut"
                        }
                      }}
                    >
                      {isError && (isCurrent || isCompleted) ? (
                        PROCESSING_STAGES.ERROR.icon
                      ) : isCompleted ? (
                        <Check size={20} />
                      ) : isCurrent ? (
                        stageConfig.icon
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-current" />
                      )}
                    </motion.div>
                    <span className="text-xs uppercase font-medium text-center break-words w-full">
                      {stageConfig.name}
                    </span>
                    {stageDuration && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(stageDuration)}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="px-4 py-3 text-sm max-w-[250px] text-center bg-background border shadow-md">
                  <div className="space-y-1">
                    <p className="font-medium">{stageConfig.name}</p>
                    <p>{stageConfig.description}</p>
                    {timeEstimate?.averageTimePerStage[stage] && (
                      <p className="text-xs text-muted-foreground">
                        Estimated: {formatDuration(timeEstimate.averageTimePerStage[stage])}
                      </p>
                    )}
                    {stageDuration && (
                      <p className="text-xs text-green-600">
                        Completed in: {formatDuration(stageDuration)}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
