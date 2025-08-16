import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { BatchUploadSettings } from "@/components/upload/BatchUploadSettings";

import { ModelProviderStatus } from "@/components/settings/ModelProviderStatus";
import ApiKeyManagement from "@/components/dashboard/ApiKeyManagement";
import { useSettings } from "@/hooks/useSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useSettingsTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import SubscriptionLimitsDisplay from "@/components/SubscriptionLimitsDisplay";
import { CategoryManager } from "@/components/categories/CategoryManager";
import { CompactSubscriptionLimitError } from "@/components/SubscriptionLimitError";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Key, Zap, ArrowRight, Bell, Palette, CreditCard } from "lucide-react";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { ThemePreferences } from "@/components/settings/ThemePreferences";
import { BillingPreferences } from "@/components/settings/BillingPreferences";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const UsageStatsPanel = () => {
  const { t } = useSettingsTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('usage.title')}</CardTitle>
        <CardDescription>{t('usage.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <SubscriptionLimitsDisplay showUpgradePrompts={true} />
      </CardContent>
    </Card>
  );
};

// API Access Upgrade Prompt Component
const ApiAccessUpgradePrompt = () => {
  const { t } = useSettingsTranslation();
  const { getCurrentTier } = useSubscription();
  const currentTier = getCurrentTier();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Key className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('apiKeys.title')}
              <Crown className="h-4 w-4 text-purple-500" />
            </CardTitle>
            <CardDescription>
              {t('apiKeys.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 relative overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-full -translate-y-10 translate-x-10 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-100 rounded-full translate-y-8 -translate-x-8 opacity-50"></div>
          <div className="flex items-start gap-3">
            <Crown className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-purple-900 mb-2">
                {t('apiKeys.upgrade.title', { defaultValue: 'Max Plan Required' })}
              </h4>
              <p className="text-sm text-purple-700 mb-3">
                {t('apiKeys.upgrade.description', {
                  defaultValue: 'API key management is available exclusively for Max plan subscribers. Create and manage API keys to integrate with external applications and services.'
                })}
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>{t('apiKeys.upgrade.features.unlimitedKeys', { defaultValue: 'Create unlimited API keys' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>{t('apiKeys.upgrade.features.fullAccess', { defaultValue: 'Full API access to all endpoints' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>{t('apiKeys.upgrade.features.analytics', { defaultValue: 'Advanced usage analytics' })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>{t('apiKeys.upgrade.features.support', { defaultValue: 'Priority support for integrations' })}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="flex-1">
                  <Link to="/pricing">
                    <Crown className="h-4 w-4 mr-2" />
                    {t('apiKeys.upgrade.actions.upgrade', { defaultValue: 'Upgrade to Max Plan' })}
                  </Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link to="/api-reference">
                    {t('apiKeys.upgrade.actions.viewDocs', { defaultValue: 'View API Documentation' })}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Current Plan Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                {t('apiKeys.upgrade.currentPlan', {
                  defaultValue: 'Current Plan: {{tier}}',
                  tier: currentTier.charAt(0).toUpperCase() + currentTier.slice(1)
                })}
              </span>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pricing" className="text-purple-600 hover:text-purple-700">
                {t('apiKeys.upgrade.actions.compare', { defaultValue: 'Compare Plans' })}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isFeatureAvailable } = useSubscription();
  const { t } = useSettingsTranslation();
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('processing');

  // Check if user has access to API features
  const hasApiAccess = isFeatureAvailable('api_access');

  // Handle URL parameters
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const simulatedParam = searchParams.get('simulated');

    if (tabParam) {
      setActiveTab(tabParam);
    }

    if (simulatedParam === 'true') {
      toast.info('You are viewing simulated billing information. Upgrade to a paid plan to access the full Stripe billing portal.');
    }
  }, [searchParams]);

  const handleResetConfirm = () => {
    resetSettings();
    toast.info(t('messages.resetToast'));
    setIsResetAlertOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('description')}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full mb-8 max-w-5xl grid-cols-8">
              <TabsTrigger value="processing">{t('tabs.processing')}</TabsTrigger>
              <TabsTrigger value="categories">{t('tabs.categories')}</TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="h-4 w-4 mr-1" />
                {t('tabs.billing')}
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-1" />
                {t('tabs.notifications')}
              </TabsTrigger>
              <TabsTrigger value="theme">
                <Palette className="h-4 w-4 mr-1" />
                {t('tabs.theme')}
              </TabsTrigger>
              <TabsTrigger value="providers">{t('tabs.providers')}</TabsTrigger>
              <TabsTrigger
                value="api-keys"
                className={`relative ${!hasApiAccess ? 'text-purple-600 data-[state=active]:text-purple-700' : ''}`}
              >
                {t('tabs.apiKeys')}
                {!hasApiAccess && (
                  <Crown className="h-3 w-3 ml-1 text-purple-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="usage">{t('tabs.usage')}</TabsTrigger>
            </TabsList>

          <TabsContent value="processing">
            <Card>
              <CardHeader>
                <CardTitle>{t('processing.title')}</CardTitle>
                <CardDescription>
                  {t('processing.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>
                    {t('processing.aiVisionDescription')}
                  </p>
                  <p>
                    {t('processing.aiModelConfigDescription')}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t('processing.aiModelConfig')}</h3>
                  <ReceiptProcessingOptions
                    defaultModel={settings.selectedModel}
                    defaultBatchModel={settings.batchModel}
                    showBatchModelSelection={true}
                    onModelChange={(model) => updateSettings({ selectedModel: model })}
                    onBatchModelChange={(model) => updateSettings({ batchModel: model })}
                  />
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t('processing.batchProcessingConfig')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('processing.batchProcessingDescription')}
                  </p>

                  <BatchUploadSettings
                    maxConcurrent={settings?.batchUpload?.maxConcurrent || 2}
                    autoStart={settings?.batchUpload?.autoStart || false}
                    timeoutSeconds={settings?.batchUpload?.timeoutSeconds || 120}
                    maxRetries={settings?.batchUpload?.maxRetries || 2}
                    preserveImageQuality={settings?.skipUploadOptimization || true}
                    onMaxConcurrentChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false, timeoutSeconds: 120, maxRetries: 2 }),
                          maxConcurrent: value
                        }
                      })
                    }
                    onAutoStartChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false, timeoutSeconds: 120, maxRetries: 2 }),
                          autoStart: value
                        }
                      })
                    }
                    onTimeoutChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false, timeoutSeconds: 120, maxRetries: 2 }),
                          timeoutSeconds: value
                        }
                      })
                    }
                    onMaxRetriesChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false, timeoutSeconds: 120, maxRetries: 2 }),
                          maxRetries: value
                        }
                      })
                    }
                    onPreserveImageQualityChange={(value) =>
                      updateSettings({ skipUploadOptimization: value })
                    }
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">{t('actions.reset')}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('messages.resetConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('messages.resetDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetConfirm}>{t('messages.continue')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="billing">
            <BillingPreferences />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationPreferences />
          </TabsContent>

          <TabsContent value="theme">
            <ThemePreferences />
          </TabsContent>

          <TabsContent value="providers" className="space-y-6">
            <ModelProviderStatus />
          </TabsContent>

          <TabsContent value="api-keys">
            {hasApiAccess ? (
              <ApiKeyManagement />
            ) : (
              <ApiAccessUpgradePrompt />
            )}
          </TabsContent>

          <TabsContent value="usage">
            <UsageStatsPanel />
          </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}