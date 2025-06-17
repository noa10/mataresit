import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Info,
  Zap,
  Brain,
  DollarSign,
  Key,
  Eye,
  EyeOff,
  Save,
  Settings,
  Clock
} from "lucide-react";
import { AVAILABLE_MODELS, getModelsByProvider, ModelProvider } from "@/config/modelProviders";
import { OpenRouterService } from "@/services/openRouterService";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { testGeminiConnection } from "@/lib/edge-function-utils";

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
    setupUrl: 'https://aistudio.google.com/app/apikey',
    keyRequired: false,
    serverSide: true,
    features: ['Vision', 'Fast Processing', 'High Accuracy']
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access to multiple AI providers through a unified API',
    icon: '🌐',
    color: 'bg-purple-100 text-purple-800',
    setupUrl: 'https://openrouter.ai/keys',
    keyRequired: true,
    serverSide: false,
    features: ['Multiple Providers', 'Free Models', 'Pay-per-use']
  }
};

export function ModelProviderStatus() {
  const { settings, updateSettings } = useSettings();
  const { t } = useSettingsTranslation();
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  // Initialize provider statuses and API keys
  useEffect(() => {
    const providers = Object.keys(PROVIDER_INFO) as ModelProvider[];
    const initialStatuses: ProviderStatus[] = providers.map(provider => ({
      provider,
      available: false,
      testing: false,
      models: getModelsByProvider(provider).length
    }));

    // Initialize API keys from settings
    const initialApiKeys: Record<string, string> = {};
    if (settings.userApiKeys?.openrouter) {
      initialApiKeys.openrouter = settings.userApiKeys.openrouter;
    }
    setApiKeys(initialApiKeys);

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
              // Test Gemini connection via edge function
              try {
                console.log('Testing Gemini connection...');
                const geminiResult = await testGeminiConnection();
                if (geminiResult.success) {
                  available = true;
                  console.log('Gemini connection successful:', geminiResult.message);
                } else {
                  available = false;
                  error = `Gemini connection failed: ${geminiResult.message}`;
                  console.error('Gemini connection failed:', geminiResult.message);
                }
              } catch (e: any) {
                available = false;
                error = `Gemini test error: ${e.message}`;
                console.error('Gemini connection test error:', e);
              }
              break;

            case 'openrouter':
              // Test OpenRouter connection with user's API key
              // Check both saved settings and local state for the API key
              const savedApiKey = settings.userApiKeys?.openrouter;
              const localApiKey = apiKeys[status.provider];
              const openRouterApiKey = localApiKey || savedApiKey;

              console.log('Testing OpenRouter connection...', {
                hasSavedKey: !!savedApiKey,
                hasLocalKey: !!localApiKey,
                usingKey: openRouterApiKey ? 'Yes' : 'No'
              });

              if (openRouterApiKey && openRouterApiKey.trim()) {
                const openRouterService = new OpenRouterService(openRouterApiKey.trim());
                try {
                  // Test with a free vision-capable model
                  const testModelId = 'openrouter/google/gemini-2.0-flash-exp:free';
                  console.log('Testing OpenRouter with model:', testModelId);
                  const connectionOk = await openRouterService.testConnection(testModelId);
                  if (connectionOk) {
                    available = true;
                    console.log('OpenRouter connection successful');
                  } else {
                    available = false;
                    error = 'API key test failed. Please verify your key is valid and has sufficient credits.';
                    console.error('OpenRouter connection test returned false');
                  }
                } catch (e: any) {
                  available = false;
                  error = `Connection test error: ${e.message}`;
                  console.error('OpenRouter connection test error:', e);
                }
              } else {
                available = false;
                error = 'OpenRouter API key not provided. Please enter your API key and save it.';
                console.log('No OpenRouter API key found');
              }
              break;

            default:
              available = false;
              error = `Provider ${status.provider} is not supported`;
              console.warn(`Unsupported provider: ${status.provider}`);
          }

          return {
            ...status,
            available,
            testing: false,
            error,
            lastChecked: new Date()
          };
        } catch (e) {
          console.error(`Error testing provider ${status.provider}:`, e);
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

  // API Key Management Functions
  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const handleSaveApiKey = async (provider: string) => {
    setSavingKeys(prev => ({ ...prev, [provider]: true }));
    try {
      const newApiKeys = {
        ...settings.userApiKeys,
        [provider]: apiKeys[provider]?.trim() || undefined
      };

      await updateSettings({ userApiKeys: newApiKeys });
      toast.success(t("providers.notifications.apiKeySaved", { provider: PROVIDER_INFO[provider as ModelProvider]?.name }));

      // Refresh provider status after saving key
      const updatedStatuses = providerStatuses.map(status =>
        status.provider === provider ? { ...status, testing: false } : status
      );
      checkProviderAvailability(updatedStatuses);
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error(t("providers.notifications.apiKeySaveFailed"));
    } finally {
      setSavingKeys(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleClearApiKey = (provider: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: '' }));
    const newApiKeys = {
      ...settings.userApiKeys,
      [provider]: undefined
    };
    updateSettings({ userApiKeys: newApiKeys });
    toast.success(t("providers.notifications.apiKeyCleared", { provider: PROVIDER_INFO[provider as ModelProvider]?.name }));
  };

  const toggleApiKeyVisibility = (provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const isKeyConfigured = (provider: string) => {
    return !!(settings.userApiKeys as any)?.[provider];
  };

  const hasKeyChanges = (provider: string) => {
    const currentKey = (settings.userApiKeys as any)?.[provider] || '';
    const newKey = apiKeys[provider] || '';
    return currentKey !== newKey;
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
      return <Badge variant="outline" className="text-blue-600 bg-blue-50">{t("providers.status.testing")}</Badge>;
    }
    if (status.available) {
      return <Badge variant="outline" className="text-green-600 bg-green-50">{t("providers.status.available")}</Badge>;
    }
    return <Badge variant="outline" className="text-red-600 bg-red-50">{t("providers.status.unavailable")}</Badge>;
  };

  const getModelStats = (provider: ModelProvider) => {
    const models = getModelsByProvider(provider);
    const fastModels = models.filter(m => m.performance.speed === 'fast').length;
    const accurateModels = models.filter(m => m.performance.accuracy === 'excellent').length;
    const economicalModels = models.filter(m => m.pricing && m.pricing.inputTokens < 1).length;

    return { fastModels, accurateModels, economicalModels };
  };

  // Helper function to format relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{t("providers.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("providers.description")}
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
          {t("providers.actions.refreshStatus")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {providerStatuses.map((status) => {
          const info = PROVIDER_INFO[status.provider];
          const stats = getModelStats(status.provider);
          const configured = isKeyConfigured(status.provider);
          const hasChanges = hasKeyChanges(status.provider);

          return (
            <Card key={status.provider} className={`relative transition-all duration-200 ${
              status.available ? 'border-green-200 bg-green-50/30' :
              configured ? 'border-yellow-200 bg-yellow-50/30' :
              'border-gray-200'
            }`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="text-3xl">{info.icon}</span>
                      {status.available && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{info.name}</CardTitle>
                        {!info.keyRequired && (
                          <Badge variant="secondary" className="text-xs">Server-side</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {info.features.map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusIcon(status)}
                    {getStatusBadge(status)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Model Statistics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("providers.stats.models")}:</span>
                    <Badge variant="secondary">{status.models}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-green-500" />
                            <span className="text-xs">{stats.fastModels}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("providers.tooltips.fastModels")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1">
                            <Brain className="h-3 w-3 text-purple-500" />
                            <span className="text-xs">{stats.accurateModels}</span>
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
                            <span className="text-xs">{stats.economicalModels}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Economical models (&lt;$1/1M tokens)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* API Key Configuration */}
                {info.keyRequired && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${status.provider}-key`} className="text-sm font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Key className="h-3 w-3" />
                        API Key
                      </Label>
                      {configured && (
                        <Badge variant="outline" className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-xs">
                          Configured
                        </Badge>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        id={`${status.provider}-key`}
                        type={showApiKeys[status.provider] ? 'text' : 'password'}
                        value={apiKeys[status.provider] || ''}
                        onChange={(e) => handleApiKeyChange(status.provider, e.target.value)}
                        placeholder="Enter your API key..."
                        className="pr-10 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => toggleApiKeyVisibility(status.provider)}
                      >
                        {showApiKeys[status.provider] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleSaveApiKey(status.provider)}
                        disabled={!hasChanges || savingKeys[status.provider]}
                        size="sm"
                        className="flex items-center gap-1 text-xs"
                      >
                        <Save className="h-3 w-3" />
                        {savingKeys[status.provider] ? 'Saving...' : 'Save'}
                      </Button>

                      {configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearApiKey(status.provider)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Clear
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(info.setupUrl, '_blank')}
                        className="flex items-center gap-1 text-xs ml-auto text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Get Key
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {status.error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <p className="font-medium">Connection Error</p>
                      <p className="text-xs mt-1 text-red-600 dark:text-red-400">{status.error}</p>
                    </div>
                  </div>
                )}

                {/* Status Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {status.lastChecked ? (
                      <span>Checked {getRelativeTime(status.lastChecked)}</span>
                    ) : (
                      <span>Not checked yet</span>
                    )}
                  </div>
                  {!info.keyRequired && (
                    <span className="text-blue-600 dark:text-blue-400">Server-managed</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enhanced Information Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">AI Provider Configuration Guide</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  <strong className="text-blue-900 dark:text-blue-100">Google Gemini:</strong> Configured server-side with environment variables.
                  No API key needed from you - ready to use immediately.
                </p>
                <p>
                  <strong className="text-blue-900 dark:text-blue-100">OpenRouter:</strong> Requires your API key for client-side access.
                  Provides access to multiple AI providers through a single unified API.
                </p>
                <p>
                  <strong className="text-blue-900 dark:text-blue-100">Status Indicators:</strong> Green border = connected and working,
                  Yellow border = configured but not tested, Gray border = needs configuration.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                  <Zap className="h-3 w-3 mr-1" />
                  Fast
                </Badge>
                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                  <Brain className="h-3 w-3 mr-1" />
                  Accurate
                </Badge>
                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                  <DollarSign className="h-3 w-3 mr-1" />
                  Economical
                </Badge>
                <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">Model capability indicators</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
