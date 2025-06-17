import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { BatchUploadSettings } from "@/components/upload/BatchUploadSettings";

import { ModelProviderStatus } from "@/components/settings/ModelProviderStatus";
import { useSettings } from "@/hooks/useSettings";
import { useSettingsTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import SubscriptionLimitsDisplay from "@/components/SubscriptionLimitsDisplay";
import { CategoryManager } from "@/components/categories/CategoryManager";
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

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { t } = useSettingsTranslation();
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);

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

          <Tabs defaultValue="processing" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8 max-w-lg">
              <TabsTrigger value="processing">{t('tabs.processing')}</TabsTrigger>
              <TabsTrigger value="categories">{t('tabs.categories')}</TabsTrigger>
              <TabsTrigger value="providers">{t('tabs.providers')}</TabsTrigger>
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
            <Card>
              <CardHeader>
                <CardTitle>{t('categories.title')}</CardTitle>
                <CardDescription>
                  {t('categories.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers" className="space-y-6">
            <ModelProviderStatus />
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