import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PROCESSING_STAGES } from "./ProcessingStages";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProcessingTimelineProps {
  currentStage: string | null;
  stageHistory: string[];
  uploadProgress: number;
}

export function ProcessingTimeline({ currentStage, stageHistory, uploadProgress }: ProcessingTimelineProps) {
  const orderedStages = ['START', 'FETCH', 'PROCESSING', 'SAVE', 'COMPLETE'];
  
  return (
    <div className="mt-6 pt-4 w-full">
      <div className="flex items-start justify-between relative px-2">
        {/* Progress bar behind the steps */}
        <div className="absolute left-0 top-[20px] w-full h-1 bg-muted -translate-y-1/2">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${uploadProgress}%` }}
            transition={{ duration: 0.2 }}
          />
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
                      className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${stateClass}`}
                      animate={{ scale: isCurrent && !isError ? [1, 1.1, 1] : 1 }}
                      transition={{ duration: 0.5, repeat: isCurrent && !isError ? Infinity : 0, repeatDelay: 1 }}
                    >
                      {isError && (isCurrent || isCompleted) ? (
                        PROCESSING_STAGES.ERROR.icon
                      ) : isCompleted ? (
                        <Check size={18} />
                      ) : isCurrent ? (
                        stageConfig.icon
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-current" />
                      )}
                    </motion.div>
                    <span className="text-xs uppercase font-medium text-center break-words w-full">
                      {stageConfig.name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="px-4 py-3 text-sm max-w-[200px] text-center bg-background border shadow-md">
                  <p>{stageConfig.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
