
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptProcessingOptions } from "@/components/upload/ReceiptProcessingOptions";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import Navbar from "@/components/Navbar";
import { UsageStatistics } from "@/components/settings/UsageStatistics";
import { InfoCard } from "@/components/settings/InfoCard";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const handleResetDefaults = () => {
    resetSettings();
    toast.info("Settings reset to defaults.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      
      <main className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-6">Customize how your receipts are processed and managed.</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
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
            
            <UsageStatistics />
          </div>
          
          <div className="space-y-6">
            <InfoCard />
          </div>
        </div>
      </main>
    </div>
  );
}
