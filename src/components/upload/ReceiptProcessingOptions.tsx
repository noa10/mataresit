import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Zap, Brain, DollarSign, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AVAILABLE_MODELS, getModelsByProvider, getModelsByCapability, ModelProvider } from "@/config/modelProviders";
import { useSettings } from "@/hooks/useSettings";

// Provider information
const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    description: 'Google\'s advanced AI models',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-800'
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access to multiple AI providers',
    icon: '🌐',
    color: 'bg-purple-100 text-purple-800'
  }
};

interface ReceiptProcessingOptionsProps {
  onModelChange: (modelId: string) => void;
  onBatchModelChange?: (modelId: string) => void;
  defaultModel?: string;
  defaultBatchModel?: string;
  showBatchModelSelection?: boolean;
}

export function ReceiptProcessingOptions({
  onModelChange,
  onBatchModelChange,
  defaultModel = 'gemini-2.5-flash-lite',
  defaultBatchModel,
  showBatchModelSelection = false
}: ReceiptProcessingOptionsProps) {
  const { settings, updateSettings } = useSettings();
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [selectedBatchModel, setSelectedBatchModel] = useState<string>(
    defaultBatchModel || defaultModel
  );

  // Always use vision models since we're exclusively using AI Vision
  const availableModels = getModelsByCapability('vision');

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<ModelProvider, typeof availableModels>);

  // Get performance badge color
  const getPerformanceBadgeColor = (speed: string, accuracy: string) => {
    if (accuracy === 'excellent') return 'bg-purple-100 text-purple-700';
    if (speed === 'fast') return 'bg-green-100 text-green-700';
    return 'bg-blue-100 text-blue-700';
  };

  // Get pricing badge
  const getPricingBadge = (pricing?: { inputTokens: number; outputTokens: number }) => {
    if (!pricing || (pricing.inputTokens === 0 && pricing.outputTokens === 0)) {
      return <Badge variant="outline" className="text-xs bg-green-100 text-green-700">FREE</Badge>;
    }
    const avgCost = (pricing.inputTokens + pricing.outputTokens) / 2;
    if (avgCost < 1) return <Badge variant="outline" className="text-xs bg-green-100 text-green-700">$</Badge>;
    if (avgCost < 5) return <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700">$$</Badge>;
    return <Badge variant="outline" className="text-xs bg-red-100 text-red-700">$$$</Badge>;
  };

  // Update parent when model changes
  useEffect(() => {
    onModelChange(selectedModel);
  }, [selectedModel, onModelChange]);

  // Update parent when batch model changes
  useEffect(() => {
    if (onBatchModelChange) {
      onBatchModelChange(selectedBatchModel);
    }
  }, [selectedBatchModel, onBatchModelChange]);

  const handleBatchModelChange = (modelId: string) => {
    setSelectedBatchModel(modelId);
  };

  return (
    <div className="space-y-4 p-4 border rounded-md bg-background/50">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-model">AI Vision Processing</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    <strong>AI Vision:</strong> Your receipts are processed directly by advanced AI models with vision capabilities. This method provides superior accuracy and supports larger images (up to 5MB).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">Select which AI model to use for processing your receipts</p>
        </div>
      </div>



      <Select
        value={selectedModel}
        onValueChange={(value) => {
          setSelectedModel(value);
          onModelChange(value);
        }}
      >
        <SelectTrigger id="ai-model">
          <SelectValue placeholder="Select an AI model">
            {selectedModel && AVAILABLE_MODELS[selectedModel] && (
              <div className="flex items-center gap-2">
                <span>{AVAILABLE_MODELS[selectedModel].name}</span>
                <div className="flex items-center gap-1">
                  {getPricingBadge(AVAILABLE_MODELS[selectedModel].pricing)}
                  <Badge
                    variant="outline"
                    className={`text-xs ${getPerformanceBadgeColor(
                      AVAILABLE_MODELS[selectedModel].performance.speed,
                      AVAILABLE_MODELS[selectedModel].performance.accuracy
                    )}`}
                  >
                    {AVAILABLE_MODELS[selectedModel].performance.speed === 'fast' ? '⚡' :
                     AVAILABLE_MODELS[selectedModel].performance.accuracy === 'excellent' ? '🎯' : '⏱️'}
                  </Badge>
                </div>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-96">
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <div key={provider}>
              {/* Provider Header */}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <span>{PROVIDER_INFO[provider as ModelProvider]?.icon}</span>
                  <span>{PROVIDER_INFO[provider as ModelProvider]?.name}</span>
                  <Badge variant="outline" className={`text-xs ${PROVIDER_INFO[provider as ModelProvider]?.color}`}>
                    {models.length}
                  </Badge>
                </div>
              </div>

              {/* Models for this provider */}
              {models.map(model => (
                <TooltipProvider key={model.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value={model.id} className="py-2">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{model.name}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {getPricingBadge(model.pricing)}
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getPerformanceBadgeColor(model.performance.speed, model.performance.accuracy)}`}
                                >
                                  {model.performance.speed === 'fast' ? '⚡' : model.performance.accuracy === 'excellent' ? '🎯' : '⏱️'}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {model.description.length > 50 ? `${model.description.substring(0, 50)}...` : model.description}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">{model.name}</p>
                        <p className="text-sm">{model.description}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">Speed: {model.performance.speed}</Badge>
                          <Badge variant="outline">Accuracy: {model.performance.accuracy}</Badge>
                        </div>
                        {model.pricing && (
                          <p className="text-xs text-muted-foreground">
                            Cost: ${model.pricing.inputTokens}/1M input tokens, ${model.pricing.outputTokens}/1M output tokens
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Supports: {model.supportsText ? 'Text' : ''}{model.supportsText && model.supportsVision ? ' + ' : ''}{model.supportsVision ? 'Vision' : ''}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {/* Batch Model Selection (if enabled) */}
      {showBatchModelSelection && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="batch-ai-model">Batch Processing Model</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Choose a different AI model specifically for batch processing.
                        Faster models can improve batch processing speed.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Optionally use a different model for batch uploads
              </p>
            </div>
          </div>

          <Select
            value={selectedBatchModel}
            onValueChange={handleBatchModelChange}
          >
            <SelectTrigger id="batch-ai-model">
              <SelectValue placeholder="Select batch processing model">
                {selectedBatchModel && AVAILABLE_MODELS[selectedBatchModel] && (
                  <div className="flex items-center gap-2">
                    <span>{AVAILABLE_MODELS[selectedBatchModel].name}</span>
                    <div className="flex items-center gap-1">
                      {getPricingBadge(AVAILABLE_MODELS[selectedBatchModel].pricing)}
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPerformanceBadgeColor(
                          AVAILABLE_MODELS[selectedBatchModel].performance.speed,
                          AVAILABLE_MODELS[selectedBatchModel].performance.accuracy
                        )}`}
                      >
                        {AVAILABLE_MODELS[selectedBatchModel].performance.speed === 'fast' ? '⚡' :
                         AVAILABLE_MODELS[selectedBatchModel].performance.accuracy === 'excellent' ? '🎯' : '⏱️'}
                      </Badge>
                    </div>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-96">
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <div key={provider}>
                  {/* Provider Header */}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span>{PROVIDER_INFO[provider as ModelProvider]?.icon}</span>
                      <span>{PROVIDER_INFO[provider as ModelProvider]?.name}</span>
                      <Badge variant="outline" className={`text-xs ${PROVIDER_INFO[provider as ModelProvider]?.color}`}>
                        {models.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Models for this provider */}
                  {models.map(model => (
                    <SelectItem key={model.id} value={model.id} className="py-2">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{model.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {getPricingBadge(model.pricing)}
                              <Badge
                                variant="outline"
                                className={`text-xs ${getPerformanceBadgeColor(model.performance.speed, model.performance.accuracy)}`}
                              >
                                {model.performance.speed === 'fast' ? '⚡' : model.performance.accuracy === 'excellent' ? '🎯' : '⏱️'}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {model.description.length > 50 ? `${model.description.substring(0, 50)}...` : model.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Image Quality Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Preserve Original Image Quality</label>
            <p className="text-xs text-muted-foreground">
              Skip image compression during upload for maximum quality in reports
            </p>
          </div>
          <Switch
            checked={settings.skipUploadOptimization}
            onCheckedChange={(checked) => 
              updateSettings({ skipUploadOptimization: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}