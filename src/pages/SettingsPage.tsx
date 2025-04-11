import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const handleResetDefaults = () => {
    resetSettings();
    toast.info("Settings reset to defaults.");
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Processing Settings</CardTitle>
          <CardDescription>
            Configure how your receipts are processed after upload. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReceiptProcessingOptions
            defaultMethod={settings.processingMethod}
            defaultModel={settings.selectedModel}
            defaultCompare={settings.compareWithAlternative}
            onMethodChange={(method) => updateSettings({ processingMethod: method })}
            onModelChange={(model) => updateSettings({ selectedModel: model })}
            onCompareChange={(compare) => updateSettings({ compareWithAlternative: compare })}
          />
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleResetDefaults}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 