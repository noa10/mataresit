import { useState } from 'react';
import { toast } from 'sonner';
import { LineItemEmbeddingsCard } from '@/components/admin/LineItemEmbeddingsCard';
import { ReceiptEmbeddingsCard } from '@/components/admin/ReceiptEmbeddingsCard';
import { StripeTestingCard } from '@/components/admin/StripeTestingCard';
import { ModelProviderStatus } from '@/components/settings/ModelProviderStatus';
import { BatchUploadSettings } from '@/components/upload/BatchUploadSettings';
import { ReceiptProcessingOptions } from '@/components/upload/ReceiptProcessingOptions';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { useAdminTranslation } from '@/contexts/LanguageContext';

export default function AdminSettingsPage() {
  const { t } = useAdminTranslation();
  const { settings, updateSettings, resetSettings } = useSettings();
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t('settingsPage.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('settingsPage.description')}
        </p>
      </div>

      {/* AI Processing Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">
            {t('settingsPage.aiProcessing')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('settingsPage.aiProcessingDescription')}
          </p>
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-4 sm:p-6">
          <ReceiptProcessingOptions
            defaultModel={settings.selectedModel}
            showBatchModelSelection={false}
            onModelChange={(model) =>
              updateSettings({ selectedModel: model, batchModel: model })
            }
          />

          <div className="space-y-4 border-t pt-5">
            <h3 className="text-sm font-semibold">
              {t('settingsPage.batchProcessing')}
            </h3>
            <BatchUploadSettings
              maxConcurrent={settings?.batchUpload?.maxConcurrent || 2}
              autoStart={settings?.batchUpload?.autoStart || false}
              timeoutSeconds={settings?.batchUpload?.timeoutSeconds || 120}
              maxRetries={settings?.batchUpload?.maxRetries || 2}
              preserveImageQuality={settings?.skipUploadOptimization || true}
              onMaxConcurrentChange={(value) =>
                updateSettings({
                  batchUpload: {
                    ...(settings?.batchUpload || {
                      maxConcurrent: 2,
                      autoStart: false,
                      timeoutSeconds: 120,
                      maxRetries: 2,
                    }),
                    maxConcurrent: value,
                  },
                })
              }
              onAutoStartChange={(value) =>
                updateSettings({
                  batchUpload: {
                    ...(settings?.batchUpload || {
                      maxConcurrent: 2,
                      autoStart: false,
                      timeoutSeconds: 120,
                      maxRetries: 2,
                    }),
                    autoStart: value,
                  },
                })
              }
              onTimeoutChange={(value) =>
                updateSettings({
                  batchUpload: {
                    ...(settings?.batchUpload || {
                      maxConcurrent: 2,
                      autoStart: false,
                      timeoutSeconds: 120,
                      maxRetries: 2,
                    }),
                    timeoutSeconds: value,
                  },
                })
              }
              onMaxRetriesChange={(value) =>
                updateSettings({
                  batchUpload: {
                    ...(settings?.batchUpload || {
                      maxConcurrent: 2,
                      autoStart: false,
                      timeoutSeconds: 120,
                      maxRetries: 2,
                    }),
                    maxRetries: value,
                  },
                })
              }
              onPreserveImageQualityChange={(value) =>
                updateSettings({ skipUploadOptimization: value })
              }
            />
          </div>

          <div className="flex justify-end border-t pt-4">
            <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline">{t('settingsPage.resetDefaults')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settingsPage.resetTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settingsPage.resetDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settingsPage.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      resetSettings();
                      toast.info(t('settingsPage.resetToast'));
                      setIsResetAlertOpen(false);
                    }}
                  >
                    {t('settingsPage.continue')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* AI Providers Section */}
      <div className="space-y-6">
        <ModelProviderStatus />
      </div>

      {/* Embeddings Management Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">
            {t('settingsPage.embeddings')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('settingsPage.embeddingsDescription')}
          </p>
        </div>

        {/* Embeddings Cards - Responsive Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Receipt Embeddings Card */}
          <div className="w-full min-w-0">
            <ReceiptEmbeddingsCard />
          </div>

          {/* Line Item Embeddings Card */}
          <div className="w-full min-w-0">
            <LineItemEmbeddingsCard />
          </div>
        </div>
      </div>

      {/* Stripe Testing Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">
            {t('settingsPage.stripe')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('settingsPage.stripeDescription')}
          </p>
        </div>

        <StripeTestingCard />
      </div>
    </div>
  );
}
