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
    icon: '🔍',
    color: 'bg-ledger-accent-soft text-ledger-accent',
    setupUrl: 'https://aistudio.google.com/app/apikey',
    keyRequired: false,
    keyOptional: true,
    serverSide: true,
    features: ['vision', 'fastProcessing', 'highAccuracy'],
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🌐',
    color: 'bg-ledger-amber-soft text-ledger-amber',
    setupUrl: 'https://openrouter.ai/keys',
    keyRequired: true,
    keyOptional: false,
    serverSide: false,
    features: ['multipleProviders', 'freeModels', 'payPerUse'],
  },
  groq: {
    name: 'Groq',
    icon: '⚙️',
    color: 'bg-emerald-100 text-emerald-800',
    setupUrl: 'https://console.groq.com/keys',
    keyRequired: true,
    keyOptional: false,
    serverSide: false,
    features: ['vision', 'lowLatency', 'openAiCompatible'],
  }
};

export function ModelProviderStatus() {
  const { settings, updateSettings } = useSettings();
  const { t, language } = useSettingsTranslation();
  const tString = (key: string, options?: Record<string, unknown>) => String(t(key, options));
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  const testGeminiApiKey = async (apiKey: string) => {
    const modelConfig = AVAILABLE_MODELS['gemini-2.5-flash-lite']
      || Object.values(AVAILABLE_MODELS).find((model) => model.provider === 'gemini');
    if (!modelConfig) {
      return {
        success: false,
        message: tString("providersExtra.errors.noGeminiModel"),
      };
    }

    const response = await fetch(`${modelConfig.endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Hello, respond with "OK".' }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: tString("providersExtra.errors.geminiApiError", {
          status: response.status,
          detail: errorText,
        }),
      };
    }

    const data = await response.json();
    const hasCandidates = Array.isArray(data?.candidates) && data.candidates.length > 0;
    return {
      success: hasCandidates,
      message: hasCandidates
        ? tString("providersExtra.errors.keyTestSuccess")
        : tString("providersExtra.errors.geminiNoCandidates"),
    };
  };

  const testGroqApiKey = async (apiKey: string) => {
    const modelConfig = AVAILABLE_MODELS['groq/qwen/qwen3.8-27b']
      || Object.values(AVAILABLE_MODELS).find((model) => model.provider === 'groq');
    if (!modelConfig) {
      return {
        success: false,
        message: tString("providersExtra.errors.noGroqModel"),
      };
    }

    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.id.replace(/^groq\//, ''),
        messages: [{ role: 'user', content: 'Respond with OK only.' }],
        max_tokens: 8,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: tString("providersExtra.errors.groqApiError", {
          status: response.status,
          detail: errorText,
        }),
      };
    }

    const data = await response.json();
    const hasChoices = Array.isArray(data?.choices) && data.choices.length > 0;
    return {
      success: hasChoices,
      message: hasChoices
        ? tString("providersExtra.errors.groqKeyTestSuccess")
        : tString("providersExtra.errors.groqNoChoices"),
    };
  };

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
    if (settings.userApiKeys?.gemini) {
      initialApiKeys.gemini = settings.userApiKeys.gemini;
    }
    if (settings.userApiKeys?.groq) {
      initialApiKeys.groq = settings.userApiKeys.groq;
    }
    setApiKeys(initialApiKeys);

    setProviderStatuses(initialStatuses);
    checkProviderAvailability(initialStatuses);
    // Re-check when the language changes so provider error messages are not
    // left in the previous language.
  }, [language]);

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
              // Test Gemini connection (client-side if key provided, otherwise edge function)
              try {
                const savedApiKey = settings.userApiKeys?.gemini;
                const localApiKey = apiKeys[status.provider];
                const geminiApiKey = localApiKey || savedApiKey;
                console.log('Testing Gemini connection...', {
                  hasSavedKey: !!savedApiKey,
                  hasLocalKey: !!localApiKey,
                  usingClientKey: !!geminiApiKey
                });

                const geminiResult = geminiApiKey
                  ? await testGeminiApiKey(geminiApiKey.trim())
                  : await testGeminiConnection();
                if (geminiResult.success) {
                  available = true;
                  console.log('Gemini connection successful:', geminiResult.message);
                } else {
                  available = false;
                  error = tString("providersExtra.errors.geminiConnectionFailed", {
                    detail: geminiResult.message,
                  });
                  console.error('Gemini connection failed:', geminiResult.message);
                }
              } catch (e: any) {
                available = false;
                error = tString("providersExtra.errors.geminiTestError", {
                  detail: e.message,
                });
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
                  // Test with a registered vision-capable model
                  const testModelId = 'openrouter/google/gemma-4-26b-a4b-it';
                  console.log('Testing OpenRouter with model:', testModelId);

                  // Use detailed connection test for better error messages
                  const result = await openRouterService.testConnectionDetailed(testModelId);

                  if (result.success) {
                    available = true;
                    console.log('OpenRouter connection successful');

                    // Log account status if available
                    if (result.accountStatus) {
                      console.log('OpenRouter account status:', {
                        credits: result.accountStatus.credits,
                        hasPaymentMethod: result.accountStatus.hasPaymentMethod,
                        isVerified: result.accountStatus.isVerified
                      });
                    }
                  } else {
                    available = false;

                    // Use detailed error message if available
                    if (result.error) {
                      const err = result.error;
                      console.error('OpenRouter connection failed:', {
                        type: err.type,
                        message: err.message,
                        action: err.action
                      });

                      // Provide specific error message based on error type
                      switch (err.type) {
                        case 'no_credits':
                          error = tString("providersExtra.errors.openRouterPaymentRequired");
                          break;
                        case 'invalid_key':
                          error = tString("providersExtra.errors.invalidKey");
                          break;
                        case 'rate_limit':
                          error = tString("providersExtra.errors.rateLimit");
                          break;
                        case 'model_unavailable':
                          error = tString("providersExtra.errors.modelUnavailable");
                          break;
                        case 'network':
                          error = tString("providersExtra.errors.networkError");
                          break;
                        default:
                          error = err.message || tString("providersExtra.errors.apiKeyTestFailed");
                      }
                    } else {
                      error = tString("providersExtra.errors.openRouterTestFailed");
                    }
                    console.error('OpenRouter connection test returned false');
                  }
                } catch (e: any) {
                  available = false;
                  error = tString("providersExtra.errors.connectionTestError", {
                    detail: e.message,
                  });
                  console.error('OpenRouter connection test error:', e);
                }
              } else {
                available = false;
                error = tString("providersExtra.errors.openRouterKeyMissing");
                console.log('No OpenRouter API key found');
              }
              break;

            case 'groq':
              // Test Groq connection with user's API key
              {
                const savedApiKey = settings.userApiKeys?.groq;
                const localApiKey = apiKeys[status.provider];
                const groqApiKey = localApiKey || savedApiKey;

                if (groqApiKey && groqApiKey.trim()) {
                  try {
                    const groqResult = await testGroqApiKey(groqApiKey.trim());
                    if (groqResult.success) {
                      available = true;
                    } else {
                      available = false;
                      error = tString("providersExtra.errors.groqConnectionFailed", {
                        detail: groqResult.message,
                      });
                    }
                  } catch (e: any) {
                    available = false;
                    error = tString("providersExtra.errors.groqTestError", {
                      detail: e.message,
                    });
                  }
                } else {
                  available = false;
                  error = tString("providersExtra.errors.groqKeyMissing");
                }
              }
              break;

            default:
              available = false;
              error = tString("providersExtra.errors.unsupportedProvider", {
                provider: status.provider,
              });
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
            error: e instanceof Error ? e.message : tString("providersExtra.errors.unknownError"),
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
      toast.success(tString("providers.notifications.apiKeySaved", { provider: PROVIDER_INFO[provider as ModelProvider]?.name }));

      // Refresh provider status after saving key
      const updatedStatuses = providerStatuses.map(status =>
        status.provider === provider ? { ...status, testing: false } : status
      );
      checkProviderAvailability(updatedStatuses);
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error(tString("providers.notifications.apiKeySaveFailed"));
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
    toast.success(tString("providers.notifications.apiKeyCleared", { provider: PROVIDER_INFO[provider as ModelProvider]?.name }));
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
      return <RefreshCw className="h-4 w-4 animate-spin text-ledger-accent" />;
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
      return (
        <Badge variant="outline" className="text-ledger-accent bg-ledger-accent-soft">
          {tString("providers.status.testing")}
        </Badge>
      );
    }
    if (status.available) {
      return (
        <Badge variant="outline" className="text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40">
          {tString("providers.status.available")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40">
        {tString("providers.status.unavailable")}
      </Badge>
    );
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

    if (diffInSeconds < 60) return tString("providersExtra.justNow");
    if (diffInSeconds < 3600)
      return tString("providersExtra.minutesAgo", {
        count: Math.floor(diffInSeconds / 60),
      });
    if (diffInSeconds < 86400)
      return tString("providersExtra.hoursAgo", {
        count: Math.floor(diffInSeconds / 3600),
      });
    return date.toLocaleDateString(language === 'ms' ? 'ms-MY' : 'en-MY');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{tString("providers.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {tString("providers.description")}
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
          {tString("providers.actions.refreshStatus")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {providerStatuses.map((status) => {
          const info = PROVIDER_INFO[status.provider];
          const stats = getModelStats(status.provider);
          const configured = isKeyConfigured(status.provider);
          const hasChanges = hasKeyChanges(status.provider);
          const usesClientKey = info.keyRequired || (status.provider === 'gemini' && configured);
          const showApiKeySection = info.keyRequired || info.keyOptional;

          return (
            <Card key={status.provider} className={`relative transition-all duration-200 ${status.available ? 'border-green-200 bg-green-50/30 dark:border-green-900/60 dark:bg-green-950/30' :
              configured ? 'border-yellow-200 bg-yellow-50/30 dark:border-amber-900/60 dark:bg-amber-950/25' :
                'border-ledger-line bg-ledger-surface-2'
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
                        <Badge variant="secondary" className="text-xs">
                          {usesClientKey
                            ? tString("providersExtra.clientSide")
                            : tString("providersExtra.serverSide")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tString(`providersExtra.providers.${status.provider}.description`)}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {tString(`providersExtra.providers.${status.provider}.requirements`)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {info.features.map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tString(`providersExtra.features.${feature}`)}
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
                    <span className="text-muted-foreground">{tString("providers.stats.models")}:</span>
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
                          <p>{tString("providers.tooltips.fastModels")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1">
                            <Brain className="h-3 w-3 text-ledger-accent" />
                            <span className="text-xs">{stats.accurateModels}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{tString("providersExtra.highAccuracy")}</p>
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
                          <p>{tString("providersExtra.economical")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* API Key Configuration */}
                {showApiKeySection && (
                  <div className="space-y-3 p-3 bg-ledger-surface-2 rounded-lg border border-ledger-line">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${status.provider}-key`} className="text-sm font-medium flex items-center gap-2 text-ledger-ink">
                        <Key className="h-3 w-3" />
                        {info.keyOptional
                          ? tString("providersExtra.apiKeyOptional")
                          : tString("providersExtra.apiKey")}
                      </Label>
                      {configured && (
                        <Badge variant="outline" className="text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-xs">
                          {tString("providersExtra.configured")}
                        </Badge>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        id={`${status.provider}-key`}
                        type={showApiKeys[status.provider] ? 'text' : 'password'}
                        value={apiKeys[status.provider] || ''}
                        onChange={(e) => handleApiKeyChange(status.provider, e.target.value)}
                        placeholder={info.keyOptional
                          ? tString("providersExtra.enterKeyOptional")
                          : tString("providersExtra.enterKey")}
                        className="pr-10 text-sm bg-ledger-surface border-ledger-line-strong text-ledger-ink"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-ledger-muted hover:text-ledger-ink"
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
                        {savingKeys[status.provider]
                          ? tString("providersExtra.saving")
                          : tString("providersExtra.save")}
                      </Button>

                      {configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearApiKey(status.provider)}
                          className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200 text-xs border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          {tString("providersExtra.clear")}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(info.setupUrl, '_blank')}
                        className="flex items-center gap-1 text-xs ml-auto text-ledger-muted hover:text-ledger-ink"
                      >
                        {tString("providersExtra.getKey")}
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {status.error && (
                  <div className="flex flex-col gap-2 p-3 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-300 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-700 dark:text-red-200">
                        <p className="font-medium">{tString("providersExtra.connectionError")}</p>
                        <p className="text-xs mt-1 text-red-600 dark:text-red-300">{status.error}</p>
                      </div>
                    </div>

                    {/* Special guidance for OpenRouter credit issues */}
                    {status.provider === 'openrouter' && status.error.includes('payment method') && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded text-xs">
                        <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                          {tString("providersExtra.quickFix")}
                        </p>
                        <ul className="text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                          <li>
                            {tString("providersExtra.quickFixPayment")}
                          </li>
                          <li>
                            {tString("providersExtra.quickFixCredits")}
                          </li>
                          <li>{tString("providersExtra.quickFixGemini")}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {status.lastChecked ? (
                      <span>
                        {tString("providersExtra.checked", {
                          time: getRelativeTime(status.lastChecked),
                        })}
                      </span>
                    ) : (
                      <span>{tString("providersExtra.notChecked")}</span>
                    )}
                  </div>
                  {!info.keyRequired && !configured && (
                    <span className="text-ledger-accent">
                      {tString("providersExtra.serverManaged")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enhanced Information Card */}
      <Card className="bg-ledger-surface-2 border-ledger-line">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-ledger-accent-soft rounded-lg">
              <Info className="h-5 w-5 text-ledger-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-ledger-ink mb-2">
                {tString("providersExtra.guideTitle")}
              </h4>
              <div className="text-sm text-ledger-ink-2 space-y-2">
                <p>
                  <strong className="text-ledger-ink">Google Gemini:</strong>{" "}
                  {tString("providersExtra.guideGemini")}
                </p>
                <p>
                  <strong className="text-ledger-ink">OpenRouter:</strong>{" "}
                  {tString("providersExtra.guideOpenRouter")}
                </p>
                <p>
                  <strong className="text-ledger-ink">
                    {tString("providersExtra.statusIndicators")}:
                  </strong>{" "}
                  {tString("providersExtra.guideStatus")}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs border-ledger-accent/30 text-ledger-accent">
                  <Zap className="h-3 w-3 mr-1" />
                  {tString("providersExtra.fast")}
                </Badge>
                <Badge variant="outline" className="text-xs border-ledger-accent/30 text-ledger-accent">
                  <Brain className="h-3 w-3 mr-1" />
                  {tString("providersExtra.accurate")}
                </Badge>
                <Badge variant="outline" className="text-xs border-ledger-accent/30 text-ledger-accent">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {tString("providersExtra.economicalBadge")}
                </Badge>
                <span className="text-xs text-ledger-muted ml-2">
                  {tString("providersExtra.capabilityIndicators")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
