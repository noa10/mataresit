
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProcessingLog } from "@/types/receipt";
import { PROCESSING_STAGES } from "./ProcessingStages";
import { CheckCircle, AlertCircle, Info, Loader2, ChevronDown, ChevronUp, Clock, Zap, Database, Brain, Upload, Save } from "lucide-react";
import { formatDuration } from "@/utils/timeEstimation";

interface ProcessingLogsProps {
  processLogs: ProcessingLog[];
  currentStage: string | null;
  showDetailedLogs?: boolean;
  startTime?: number;
}

export function ProcessingLogs({
  processLogs,
  currentStage,
  showDetailedLogs = false,
  startTime
}: ProcessingLogsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const getStepColor = (step: string | null) => {
    if (!step) return 'text-gray-500';
    const stageInfo = PROCESSING_STAGES[step as keyof typeof PROCESSING_STAGES];
    if (stageInfo) return stageInfo.color.split(' ')[0];
    return 'text-gray-500';
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={14} className="text-yellow-500" />;
      case 'info':
      default:
        return <Info size={14} className="text-blue-500" />;
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'START':
        return <Upload size={14} className="text-blue-500" />;
      case 'FETCH':
        return <Database size={14} className="text-indigo-500" />;
      case 'OCR':
        return <Zap size={14} className="text-purple-500" />;
      case 'GEMINI':
        return <Brain size={14} className="text-violet-500" />;
      case 'SAVE':
        return <Save size={14} className="text-green-500" />;
      default:
        return <Info size={14} className="text-gray-500" />;
    }
  };

  if (processLogs.length === 0 && !showDetailedLogs) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-6 border rounded-md bg-background/50"
    >
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStage && getStageIcon(currentStage)}
            <h4 className="text-base font-medium">Processing Details</h4>
            {currentStage && (
              <Badge variant="outline" className={`px-3 py-1 text-sm ${getStepColor(currentStage)}`}>
                {PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.name || currentStage}
              </Badge>
            )}
            {startTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{formatDuration(elapsedTime)}</span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="h-[180px] w-full p-4">
              <div className="space-y-2">
                <AnimatePresence>
                  {processLogs.map((log, index) => (
                    <motion.div
                      key={log.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.02 }}
                      className="text-sm flex items-start gap-2"
                    >
                      {getLogIcon('info')}
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium mr-2 ${getStepColor(log.step_name)}`}>
                          {log.step_name || 'INFO'}:
                        </span>
                        <span className="text-muted-foreground break-all">{log.status_message}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {processLogs.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-4">
                    Processing logs will appear here...
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
