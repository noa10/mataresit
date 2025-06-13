import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { BatchUploadSettings } from "@/components/upload/BatchUploadSettings";

import { ModelProviderStatus } from "@/components/settings/ModelProviderStatus";
import { useSettings } from "@/hooks/useSettings";
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

const UsageStatsPanel = () => (
  <Card>
    <CardHeader>
      <CardTitle>Your Current Usage</CardTitle>
      <CardDescription>Track your subscription limits and usage in real-time</CardDescription>
    </CardHeader>
    <CardContent>
      <SubscriptionLimitsDisplay showUpgradePrompts={true} />
    </CardContent>
  </Card>
);

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);

  const handleResetConfirm = () => {
    resetSettings();
    toast.info("Settings reset to defaults.");
    setIsResetAlertOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure your receipt processing preferences and AI model providers
            </p>
          </div>

          <Tabs defaultValue="processing" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8 max-w-lg">
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="providers">AI Providers</TabsTrigger>
              <TabsTrigger value="usage">Usage Stats</TabsTrigger>
            </TabsList>

          <TabsContent value="processing">
            <Card>
              <CardHeader>
                <CardTitle>Processing Settings</CardTitle>
                <CardDescription>
                  Configure how your receipts are processed after upload. Changes are saved automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>
                    We now exclusively use <strong>AI Vision</strong> for receipt processing, which provides superior accuracy with support for larger images (up to 5MB). This advanced method processes your receipts directly using AI models with vision capabilities.
                  </p>
                  <p>
                    You can still enable 'Compare with Alternative' to also process receipts using OCR + AI for comparison, which can help improve accuracy but increases processing time.
                  </p>
                </div>

                <ReceiptProcessingOptions
                  defaultMethod={settings.processingMethod}
                  defaultModel={settings.selectedModel}
                  defaultCompare={settings.compareWithAlternative}
                  onMethodChange={(method) => updateSettings({ processingMethod: method })}
                  onModelChange={(model) => updateSettings({ selectedModel: model })}
                  onCompareChange={(compare) => updateSettings({ compareWithAlternative: compare })}
                />

                <Separator className="my-6" />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Batch Upload Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure how multiple receipts are processed when using batch upload.
                  </p>

                  <BatchUploadSettings
                    maxConcurrent={settings?.batchUpload?.maxConcurrent || 2}
                    autoStart={settings?.batchUpload?.autoStart || false}
                    onMaxConcurrentChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false }),
                          maxConcurrent: value
                        }
                      })
                    }
                    onAutoStartChange={(value) =>
                      updateSettings({
                        batchUpload: {
                          ...(settings?.batchUpload || { maxConcurrent: 2, autoStart: false }),
                          autoStart: value
                        }
                      })
                    }
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Reset to Defaults</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will reset all processing settings to their default values.
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetConfirm}>Continue</AlertDialogAction>
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
                <CardTitle>Category Management</CardTitle>
                <CardDescription>
                  Create and manage custom categories to organize your receipts
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