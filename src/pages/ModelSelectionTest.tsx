import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/hooks/useSettings';
import { processReceiptWithAI } from '@/services/receiptService';
import { toast } from 'sonner';

export function ModelSelectionTest() {
  const { settings, updateSettings } = useSettings();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Test receipt ID (you can replace this with any existing receipt ID)
  const TEST_RECEIPT_ID = '4ac838dc-bb4a-4401-8f0b-bb1d9a674eac';

  const testModels = [
    'gemini-2.0-flash-lite',
    'openrouter/mistralai/mistral-small-3.2-24b-instruct:free',
    'openrouter/google/gemma-3-27b-it:free'
  ];

  const runModelTest = async (modelId: string) => {
    setIsLoading(true);
    try {
      console.log(`🧪 Testing model: ${modelId}`);
      
      // Update settings to use this model
      await updateSettings({ selectedModel: modelId });
      
      // Wait a bit for settings to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if settings were actually updated
      const currentSettings = JSON.parse(localStorage.getItem('receiptProcessingSettings') || '{}');
      console.log('📋 Current settings after update:', currentSettings);
      
      // Test the model selection flow without actually processing
      const testResult = {
        modelId,
        timestamp: new Date().toISOString(),
        settingsSelectedModel: settings.selectedModel,
        localStorageSelectedModel: currentSettings.selectedModel,
        settingsMatch: settings.selectedModel === modelId,
        localStorageMatch: currentSettings.selectedModel === modelId
      };
      
      console.log('🧪 Test result:', testResult);
      setTestResults(prev => [...prev, testResult]);
      
      toast.success(`Test completed for ${modelId}`);
    } catch (error) {
      console.error('Test failed:', error);
      toast.error(`Test failed for ${modelId}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const checkCurrentState = () => {
    const localStorageSettings = JSON.parse(localStorage.getItem('receiptProcessingSettings') || '{}');
    
    console.log('🔍 CURRENT STATE CHECK:');
    console.log('Settings hook selectedModel:', settings.selectedModel);
    console.log('LocalStorage selectedModel:', localStorageSettings.selectedModel);
    console.log('Settings object:', settings);
    console.log('LocalStorage raw:', localStorage.getItem('receiptProcessingSettings'));
    
    toast.info('Check console for current state details');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Model Selection Debug Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Current Settings</h3>
              <div className="text-sm space-y-1">
                <p><strong>Selected Model:</strong> {settings.selectedModel}</p>
                <p><strong>Type:</strong> {typeof settings.selectedModel}</p>
                <p><strong>Length:</strong> {settings.selectedModel?.length}</p>
                <p><strong>Is OpenRouter:</strong> {settings.selectedModel?.startsWith('openrouter/') ? 'Yes' : 'No'}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Actions</h3>
              <div className="space-y-2">
                <Button onClick={checkCurrentState} variant="outline" size="sm">
                  Check Current State
                </Button>
                <Button onClick={clearResults} variant="outline" size="sm">
                  Clear Results
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Test Models</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {testModels.map(modelId => (
                <Button
                  key={modelId}
                  onClick={() => runModelTest(modelId)}
                  disabled={isLoading}
                  variant={settings.selectedModel === modelId ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                >
                  {modelId.length > 30 ? modelId.substring(0, 30) + '...' : modelId}
                </Button>
              ))}
            </div>
          </div>

          {testResults.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Test Results</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <Card key={index} className="p-3">
                    <div className="text-sm space-y-1">
                      <p><strong>Model:</strong> {result.modelId}</p>
                      <p><strong>Time:</strong> {new Date(result.timestamp).toLocaleTimeString()}</p>
                      <p><strong>Settings Match:</strong> 
                        <span className={result.settingsMatch ? 'text-green-600' : 'text-red-600'}>
                          {result.settingsMatch ? ' ✅' : ' ❌'}
                        </span>
                      </p>
                      <p><strong>LocalStorage Match:</strong> 
                        <span className={result.localStorageMatch ? 'text-green-600' : 'text-red-600'}>
                          {result.localStorageMatch ? ' ✅' : ' ❌'}
                        </span>
                      </p>
                      <details className="text-xs">
                        <summary>Details</summary>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
