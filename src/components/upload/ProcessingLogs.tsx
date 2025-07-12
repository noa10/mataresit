
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [displayedLogs, setDisplayedLogs] = useState<ProcessingLog[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Stream logs with animation delays
  useEffect(() => {
    if (!isStreaming || processLogs.length === 0) {
      setDisplayedLogs(processLogs);
      return;
    }

    // If we have new logs, stream them in progressively
    if (processLogs.length > displayedLogs.length) {
      const newLogs = processLogs.slice(displayedLogs.length);

      // For performance, if there are many logs, reduce the delay
      const delay = newLogs.length > 5 ? 50 : 150;

      newLogs.forEach((log, index) => {
        setTimeout(() => {
          setDisplayedLogs(prev => [...prev, log]);
          // Auto-scroll after a short delay to allow animation to start
          setTimeout(scrollToBottom, 100);
        }, index * delay);
      });
    } else {
      // If logs were reset or changed, update immediately
      setDisplayedLogs(processLogs);
    }
  }, [processLogs, displayedLogs.length, isStreaming, scrollToBottom]);

  // Update elapsed time every second
  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Auto-expand when logs start streaming
  useEffect(() => {
    if (processLogs.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [processLogs.length, isExpanded]);

  // Stop streaming when processing is complete
  useEffect(() => {
    if (currentStage === 'COMPLETE' || currentStage === 'ERROR') {
      // Add a small delay to ensure all logs are displayed
      setTimeout(() => {
        setIsStreaming(false);
        setDisplayedLogs(processLogs);
      }, 500);
    }
  }, [currentStage, processLogs]);

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
      case 'AI':
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
            {isStreaming && displayedLogs.length > 0 && (
              <Badge variant="secondary" className="px-2 py-1 text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Live
              </Badge>
            )}
            {startTime && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{formatDuration(elapsedTime)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{displayedLogs.length} logs</span>
              {isStreaming && displayedLogs.length < processLogs.length && (
                <span className="text-primary">
                  +{processLogs.length - displayedLogs.length} pending
                </span>
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
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea ref={scrollAreaRef} className="h-[180px] w-full p-4">
              <div ref={logContainerRef} className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {displayedLogs.map((log, index) => (
                    <motion.div
                      key={log.id || `fallback-${log.created_at}-${index}-${log.status_message.slice(0, 10)}`}
                      initial={{
                        opacity: 0,
                        y: 20,
                        scale: 0.95
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1
                      }}
                      exit={{
                        opacity: 0,
                        y: -10,
                        scale: 0.95
                      }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut"
                      }}
                      className="text-sm flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/50 hover:bg-background/80 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getLogIcon('info')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium text-xs uppercase tracking-wide ${getStepColor(log.step_name)}`}>
                            {log.step_name || 'INFO'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                        <span className="text-muted-foreground break-words leading-relaxed">
                          {log.status_message}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {displayedLogs.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground text-xs py-8 flex flex-col items-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Waiting for processing logs...</span>
                  </motion.div>
                )}

                {/* Streaming indicator */}
                {isStreaming && displayedLogs.length > 0 && displayedLogs.length < processLogs.length && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Streaming logs...</span>
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
