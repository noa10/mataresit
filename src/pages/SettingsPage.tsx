import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { BatchUploadSettings } from "@/components/upload/BatchUploadSettings";
import { ApiKeySettings } from "@/components/settings/ApiKeySettings";
import { ModelProviderStatus } from "@/components/settings/ModelProviderStatus";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Separator } from "@/components/ui/separator";
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

const UsageStatsPanelPlaceholder = () => (
  <Card>
    <CardHeader>
      <CardTitle>Usage Statistics</CardTitle>
      <CardDescription>View statistics about your receipt processing methods.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">Usage statistics will be available here soon.</p>
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
      <Navbar />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Tabs defaultValue="processing" className="max-w-3xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="providers">AI Providers</TabsTrigger>
            <TabsTrigger value="usage">Usage Statistics</TabsTrigger>
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
                    Choose your preferred method for extracting data from receipts.
                    <strong>'AI Vision' is now the recommended default method</strong> and uses advanced AI models directly for interpretation with support for larger images (up to 5MB).
                    'OCR + AI Enhancement' uses traditional OCR followed by AI for refinement and works well for simpler receipts.
                  </p>
                  <p>
                    Enabling 'Compare with Alternative' runs both methods for comparison but increases processing time.
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

          <TabsContent value="providers" className="space-y-6">
            <ApiKeySettings />
            <ModelProviderStatus />
          </TabsContent>

          <TabsContent value="usage">
            <UsageStatsPanelPlaceholder />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}