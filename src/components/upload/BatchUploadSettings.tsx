import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface BatchUploadSettingsProps {
  maxConcurrent: number;
  autoStart: boolean;
  onMaxConcurrentChange: (value: number) => void;
  onAutoStartChange: (value: boolean) => void;
}

export function BatchUploadSettings({
  maxConcurrent,
  autoStart,
  onMaxConcurrentChange,
  onAutoStartChange,
}: BatchUploadSettingsProps) {
  const [concurrentValue, setConcurrentValue] = useState(maxConcurrent);

  // Update the local state when props change
  useEffect(() => {
    setConcurrentValue(maxConcurrent);
  }, [maxConcurrent]);

  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    const newValue = value[0];
    setConcurrentValue(newValue);
    onMaxConcurrentChange(newValue);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-concurrent" className="text-sm font-medium">
              Maximum Concurrent Uploads
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Controls how many receipts can be processed simultaneously. 
                    Higher values may speed up batch uploads but could use more system resources.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">{concurrentValue}</span>
        </div>
        <Slider
          id="max-concurrent"
          min={1}
          max={5}
          step={1}
          value={[concurrentValue]}
          onValueChange={handleSliderChange}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Processing multiple receipts at once can speed up batch uploads but may use more resources.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-start" className="text-sm font-medium">
              Auto-Start Processing
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    When enabled, receipt processing will start automatically as soon as files are added to the queue.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically start processing when files are added
          </p>
        </div>
        <Switch
          id="auto-start"
          checked={autoStart}
          onCheckedChange={onAutoStartChange}
        />
      </div>
    </div>
  );
}
