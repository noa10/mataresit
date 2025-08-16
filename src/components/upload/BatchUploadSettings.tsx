import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Upload, Clock, RotateCcw } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface BatchUploadSettingsProps {
  maxConcurrent: number;
  autoStart: boolean;
  timeoutSeconds: number;
  maxRetries: number;
  preserveImageQuality: boolean;
  onMaxConcurrentChange: (value: number) => void;
  onAutoStartChange: (value: boolean) => void;
  onTimeoutChange: (value: number) => void;
  onMaxRetriesChange: (value: number) => void;
  onPreserveImageQualityChange: (value: boolean) => void;
}

export function BatchUploadSettings({
  maxConcurrent,
  autoStart,
  timeoutSeconds,
  maxRetries,
  preserveImageQuality,
  onMaxConcurrentChange,
  onAutoStartChange,
  onTimeoutChange,
  onMaxRetriesChange,
  onPreserveImageQualityChange,
}: BatchUploadSettingsProps) {
  const [concurrentValue, setConcurrentValue] = useState(maxConcurrent);
  const [timeoutValue, setTimeoutValue] = useState(timeoutSeconds);
  const [retriesValue, setRetriesValue] = useState(maxRetries);

  const { limits, getCurrentTier } = useSubscription();
  const currentTier = getCurrentTier();

  // Update the local state when props change
  useEffect(() => {
    setConcurrentValue(maxConcurrent);
  }, [maxConcurrent]);

  useEffect(() => {
    setTimeoutValue(timeoutSeconds);
  }, [timeoutSeconds]);

  useEffect(() => {
    setRetriesValue(maxRetries);
  }, [maxRetries]);

  // Handle slider changes
  const handleConcurrentChange = (value: number[]) => {
    const newValue = value[0];
    setConcurrentValue(newValue);
    onMaxConcurrentChange(newValue);
  };

  const handleTimeoutChange = (value: number[]) => {
    const newValue = value[0];
    setTimeoutValue(newValue);
    onTimeoutChange(newValue);
  };

  const handleRetriesChange = (value: number[]) => {
    const newValue = value[0];
    setRetriesValue(newValue);
    onMaxRetriesChange(newValue);
  };

  // Get tier badge color
  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-700';
      case 'pro': return 'bg-blue-100 text-blue-700';
      case 'max': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Limits Display */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Batch Upload Limits
            </CardTitle>
            <Badge variant="outline" className={getTierBadgeColor(currentTier)}>
              {currentTier.toUpperCase()} Plan
            </Badge>
          </div>
          <CardDescription>
            Your current subscription allows batch uploads with the following limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max batch size:</span>
              <Badge variant="secondary">{limits?.batchUploadLimit || 5} receipts</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Concurrent uploads:</span>
              <Badge variant="secondary">Up to {concurrentValue}</Badge>
            </div>
          </div>
          {currentTier === 'free' && (
            <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded border border-blue-200">
              💡 Upgrade to Pro or Max plan for larger batch uploads and more concurrent processing
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concurrent Upload Settings */}
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
          onValueChange={handleConcurrentChange}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Processing multiple receipts at once can speed up batch uploads but may use more resources.
        </p>
      </div>

      {/* Processing Timeout Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="timeout-setting" className="text-sm font-medium">
              Processing Timeout
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Maximum time to wait for each receipt to process before timing out.
                    Longer timeouts allow for more complex receipts but may slow down batch processing.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">{timeoutValue}s</span>
        </div>
        <Slider
          id="timeout-setting"
          min={30}
          max={300}
          step={30}
          value={[timeoutValue]}
          onValueChange={handleTimeoutChange}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Timeout range: 30 seconds (fast) to 5 minutes (thorough processing)
        </p>
      </div>

      {/* Retry Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="retry-setting" className="text-sm font-medium">
              Maximum Retries
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <RotateCcw className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Number of times to retry processing a failed receipt before marking it as failed.
                    More retries increase success rate but may slow down batch processing.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">{retriesValue}</span>
        </div>
        <Slider
          id="retry-setting"
          min={0}
          max={5}
          step={1}
          value={[retriesValue]}
          onValueChange={handleRetriesChange}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          0 = No retries, 5 = Maximum resilience
        </p>
      </div>

      {/* Auto-Start Setting */}
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

      {/* Image Quality Preservation Setting */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="preserve-quality" className="text-sm font-medium">
              Preserve Original Image Quality
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    When enabled, images will be uploaded without compression to preserve maximum quality for reports and analysis.
                    This may result in larger file sizes and longer upload times.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            Skip image compression during batch uploads for maximum quality
          </p>
        </div>
        <Switch
          id="preserve-quality"
          checked={preserveImageQuality}
          onCheckedChange={onPreserveImageQualityChange}
        />
      </div>
    </div>
  );
}
