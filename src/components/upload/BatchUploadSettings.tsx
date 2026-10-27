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
import { useSettingsTranslation } from "@/contexts/LanguageContext";

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
  const { t } = useSettingsTranslation();
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
              {t('batchSettings.limitsTitle')}
            </CardTitle>
            <Badge variant="outline" className={getTierBadgeColor(currentTier)}>
              {t('batchSettings.plan', { tier: currentTier.toUpperCase() })}
            </Badge>
          </div>
          <CardDescription>
            {t('batchSettings.limitsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('batchSettings.maxBatchSize')}</span>
              <Badge variant="secondary">
                {t('batchSettings.receipts', { count: limits?.batchUploadLimit || 5 })}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('batchSettings.concurrent')}</span>
              <Badge variant="secondary">
                {t('batchSettings.upTo', { count: concurrentValue })}
              </Badge>
            </div>
          </div>
          {currentTier === 'free' && (
            <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded border border-blue-200">
              {t('batchSettings.upgradeHint')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concurrent Upload Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-concurrent" className="text-sm font-medium">
              {t('batchSettings.maxConcurrent')}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t('batchSettings.maxConcurrentTooltip')}</p>
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
          {t('batchSettings.maxConcurrentDescription')}
        </p>
      </div>

      {/* Processing Timeout Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="timeout-setting" className="text-sm font-medium">
              {t('batchSettings.timeout')}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t('batchSettings.timeoutTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm font-medium">
            {t('batchSettings.seconds', { count: timeoutValue })}
          </span>
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
          {t('batchSettings.timeoutDescription')}
        </p>
      </div>

      {/* Retry Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="retry-setting" className="text-sm font-medium">
              {t('batchSettings.retries')}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <RotateCcw className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t('batchSettings.retriesTooltip')}</p>
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
          {t('batchSettings.retriesDescription')}
        </p>
      </div>

      {/* Auto-Start Setting */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-start" className="text-sm font-medium">
              {t('batchSettings.autoStart')}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t('batchSettings.autoStartTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('batchSettings.autoStartDescription')}
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
              {t('batchSettings.preserveQuality')}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t('batchSettings.preserveQualityTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('batchSettings.preserveQualityDescription')}
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
