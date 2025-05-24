import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Model registry matching backend
const AVAILABLE_MODELS = {
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    supportsText: true,
    supportsVision: true,
    description: 'Fast model with good accuracy'
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    supportsText: true,
    supportsVision: true,
    description: 'More accurate but slower than Flash'
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    supportsText: true,
    supportsVision: true,
    description: 'Newest fast model, supports text & vision'
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
  const availableModels = Object.values(AVAILABLE_MODELS).filter(model =>
    method === 'ocr-ai' ? model.supportsText : model.supportsVision
  );

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
          // Default to the new flash model as it supports both text and vision
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
          <SelectValue placeholder="Select an AI model" />
        </SelectTrigger>
        <SelectContent>
          {availableModels.map(model => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
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