import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Zap, Brain, DollarSign, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AVAILABLE_MODELS, getModelsByProvider, getModelsByCapability, ModelProvider } from "@/config/modelProviders";

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
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude AI models',
    icon: '🧠',
    color: 'bg-orange-100 text-orange-800'
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models',
    icon: '⚡',
    color: 'bg-green-100 text-green-800'
  }
};

interface ReceiptProcessingOptionsProps {
  onMethodChange: (method: 'ocr-ai' | 'ai-vision') => void;
  onModelChange: (modelId: string) => void;
  onCompareChange: (compare: boolean) => void;
  defaultMethod?: 'ocr-ai' | 'ai-vision';
  defaultModel?: string;
  defaultCompare?: boolean;
}

export function ReceiptProcessingOptions({
  onMethodChange,
  onModelChange,
  onCompareChange,
  defaultMethod = 'ai-vision',
  defaultModel = 'gemini-2.0-flash-lite',
  defaultCompare = false
}: ReceiptProcessingOptionsProps) {
  const [method, setMethod] = useState<'ocr-ai' | 'ai-vision'>(defaultMethod);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [compare, setCompare] = useState<boolean>(defaultCompare);

  // Filter models based on the selected method
  const availableModels = getModelsByCapability(method === 'ocr-ai' ? 'text' : 'vision');

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

  return (
    <div className="space-y-4 p-4 border rounded-md bg-background/50">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="processing-method">Processing Method</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    <strong>AI Vision (Recommended):</strong> The image is processed directly by an AI model with vision capabilities. This is now the default method and works well with larger images (up to 5MB).
                    <br /><br />
                    <strong>OCR + AI:</strong> Text is extracted from the image first, then enhanced with AI. Good for simpler receipts or when AI Vision encounters issues.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">Choose how your receipt should be processed (AI Vision is recommended and set as default)</p>
        </div>
      </div>

      <Select
        value={method}
        onValueChange={(value: 'ocr-ai' | 'ai-vision') => {
          setMethod(value);
          onMethodChange(value);

          // Reset model to a default that supports the selected method
          // Default to Gemini 2.0 Flash Lite as it supports both text and vision
          const defaultForMethod = 'gemini-2.0-flash-lite';
          setSelectedModel(defaultForMethod);
          onModelChange(defaultForMethod);
        }}
      >
        <SelectTrigger id="processing-method">
          <SelectValue placeholder="Select a processing method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ai-vision">AI Vision (Recommended)</SelectItem>
          <SelectItem value="ocr-ai">OCR + AI</SelectItem>
        </SelectContent>
      </Select>

      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-model">AI Model</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Select the AI model that will process your receipt data.
                  Different models have different capabilities and accuracy.
                  All models now support larger images (up to 5MB) for better processing.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">Select the AI model to use</p>
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

      <div className="flex items-center space-x-2 pt-2">
        <Switch
          id="compare-methods"
          checked={compare}
          onCheckedChange={(checked) => {
            setCompare(checked);
            onCompareChange(checked);
          }}
        />
        <div className="grid gap-1.5 leading-none">
          <div className="flex items-center gap-2">
            <Label htmlFor="compare-methods">Compare with alternative method</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    When enabled, we'll also process your receipt using the alternative method
                    (OCR + AI if you selected AI Vision, or AI Vision if you selected OCR + AI)
                    and highlight any discrepancies between the two methods.
                    <br /><br />
                    Note: This will increase processing time but can improve accuracy.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">
            Process with both AI Vision and OCR + AI methods to improve accuracy
          </p>
        </div>
      </div>
    </div>
  );
}