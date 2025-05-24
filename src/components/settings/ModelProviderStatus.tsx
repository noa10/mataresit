import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  Info,
  Zap,
  Brain,
  DollarSign
} from "lucide-react";
import { AVAILABLE_MODELS, getModelsByProvider, ModelProvider } from "@/config/modelProviders";
import { OpenRouterService } from "@/services/openRouterService";

interface ProviderStatus {
  provider: ModelProvider;
  available: boolean;
  testing: boolean;
  error?: string;
  models: number;
  lastChecked?: Date;
}

const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    description: 'Google\'s advanced AI models with excellent vision capabilities',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-800',
    setupUrl: 'https://aistudio.google.com/app/apikey'
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access to multiple AI providers through a unified API',
    icon: '🌐',
    color: 'bg-purple-100 text-purple-800',
    setupUrl: 'https://openrouter.ai/keys'
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude AI models with strong reasoning capabilities',
    icon: '🧠',
    color: 'bg-orange-100 text-orange-800',
    setupUrl: 'https://console.anthropic.com/'
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models with multimodal capabilities',
    icon: '⚡',
    color: 'bg-green-100 text-green-800',
    setupUrl: 'https://platform.openai.com/api-keys'
  }
};

export function ModelProviderStatus() {
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize provider statuses
  useEffect(() => {
    const providers = Object.keys(PROVIDER_INFO) as ModelProvider[];
    const initialStatuses: ProviderStatus[] = providers.map(provider => ({
      provider,
      available: false,
      testing: false,
      models: getModelsByProvider(provider).length
    }));
    
    setProviderStatuses(initialStatuses);
    checkProviderAvailability(initialStatuses);
  }, []);

  // Check provider availability
  const checkProviderAvailability = async (statuses: ProviderStatus[]) => {
    setIsRefreshing(true);
    
    const updatedStatuses = await Promise.all(
      statuses.map(async (status) => {
        const updatedStatus = { ...status, testing: true };
        setProviderStatuses(prev => 
          prev.map(s => s.provider === status.provider ? updatedStatus : s)
        );

        try {
          let available = false;
          let error: string | undefined;

          switch (status.provider) {
            case 'gemini':
              // Check if Gemini API key is available (this would need to be implemented)
              available = true; // Assume available for now
              break;
              
            case 'openrouter':
              // Test OpenRouter connection
              const openRouterService = new OpenRouterService('test-key');
              try {
                // This would need a proper API key to test
                available = false; // Set to false until proper testing is implemented
                error = 'API key required';
              } catch (e) {
                available = false;
                error = 'Connection failed';
              }
              break;
              
            default:
              available = false;
              error = 'Not implemented';
          }

          return {
            ...status,
            available,
            testing: false,
            error,
            lastChecked: new Date()
          };
        } catch (e) {
          return {
            ...status,
            available: false,
            testing: false,
            error: e instanceof Error ? e.message : 'Unknown error',
            lastChecked: new Date()
          };
        }
      })
    );

    setProviderStatuses(updatedStatuses);
    setIsRefreshing(false);
  };

  const refreshStatus = () => {
    checkProviderAvailability(providerStatuses);
  };

  const getStatusIcon = (status: ProviderStatus) => {
    if (status.testing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (status.available) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (status.error) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (status: ProviderStatus) => {
    if (status.testing) {
      return <Badge variant="outline" className="text-blue-600 bg-blue-50">Testing</Badge>;
    }
    if (status.available) {
      return <Badge variant="outline" className="text-green-600 bg-green-50">Available</Badge>;
    }
    return <Badge variant="outline" className="text-red-600 bg-red-50">Unavailable</Badge>;
  };

  const getModelStats = (provider: ModelProvider) => {
    const models = getModelsByProvider(provider);
    const fastModels = models.filter(m => m.performance.speed === 'fast').length;
    const accurateModels = models.filter(m => m.performance.accuracy === 'excellent').length;
    const economicalModels = models.filter(m => m.pricing && m.pricing.inputTokens < 1).length;

    return { fastModels, accurateModels, economicalModels };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Model Providers</h3>
          <p className="text-sm text-muted-foreground">
            Status and availability of different AI model providers
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshStatus}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providerStatuses.map((status) => {
          const info = PROVIDER_INFO[status.provider];
          const stats = getModelStats(status.provider);
          
          return (
            <Card key={status.provider} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <CardTitle className="text-base">{info.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    {getStatusBadge(status)}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Model Count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Available Models:</span>
                  <Badge variant="secondary">{status.models} models</Badge>
                </div>

                {/* Model Statistics */}
                <div className="flex items-center gap-4 text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-green-500" />
                          <span>{stats.fastModels}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Fast models</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Brain className="h-3 w-3 text-purple-500" />
                          <span>{stats.accurateModels}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>High accuracy models</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-500" />
                          <span>{stats.economicalModels}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Economical models (&lt;$1/1M tokens)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Error Message */}
                {status.error && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 rounded-md">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700">
                      <p className="font-medium">Error:</p>
                      <p>{status.error}</p>
                    </div>
                  </div>
                )}

                {/* Last Checked */}
                {status.lastChecked && (
                  <div className="text-xs text-muted-foreground">
                    Last checked: {status.lastChecked.toLocaleTimeString()}
                  </div>
                )}

                {/* Setup Link */}
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={() => window.open(info.setupUrl, '_blank')}
                  >
                    <span>Setup API Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Model Providers</p>
              <p>
                Different AI model providers offer various capabilities, pricing, and performance characteristics. 
                Configure API keys for the providers you want to use. OpenRouter provides access to multiple 
                providers through a single API key.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
