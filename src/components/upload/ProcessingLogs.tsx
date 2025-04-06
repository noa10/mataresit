
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ProcessingLog } from "@/types/receipt";
import { PROCESSING_STAGES } from "./ProcessingStages";

interface ProcessingLogsProps {
  processLogs: ProcessingLog[];
  currentStage: string | null;
}

export function ProcessingLogs({ processLogs, currentStage }: ProcessingLogsProps) {
  const getStepColor = (step: string | null) => {
    if (!step) return 'text-gray-500';
    const stageInfo = PROCESSING_STAGES[step as keyof typeof PROCESSING_STAGES];
    if (stageInfo) return stageInfo.color.split(' ')[0];
    return 'text-gray-500';
  };

  if (processLogs.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-base font-medium">Processing Log</h4>
        {currentStage && (
          <Badge variant="outline" className={`px-3 py-1 text-sm ${getStepColor(currentStage)}`}>
            {PROCESSING_STAGES[currentStage as keyof typeof PROCESSING_STAGES]?.name || currentStage}
          </Badge>
        )}
      </div>
      <ScrollArea className="h-[180px] w-full rounded-md border mt-3 bg-background/80 p-4">
        <div className="space-y-2">
          {processLogs.map((log, index) => (
            <div key={log.id || index} className="text-sm flex items-start">
              <span className={`font-medium mr-2 ${getStepColor(log.step_name)}`}>
                {log.step_name || 'INFO'}:
              </span>
              <span className="text-muted-foreground break-all">{log.status_message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
