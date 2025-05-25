import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Key, Save, ExternalLink, AlertCircle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

export function ApiKeySettings() {
  const { settings, updateSettings } = useSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState(settings.userApiKeys?.openrouter || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        userApiKeys: {
          ...settings.userApiKeys,
          openrouter: openRouterKey.trim() || undefined
        }
      });
      toast.success('API key saved successfully');
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearApiKey = () => {
    setOpenRouterKey('');
    updateSettings({
      userApiKeys: {
        ...settings.userApiKeys,
        openrouter: undefined
      }
    });
    toast.success('API key cleared');
  };

  const isKeyConfigured = !!settings.userApiKeys?.openrouter;
  const hasChanges = openRouterKey !== (settings.userApiKeys?.openrouter || '');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">API Key Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your API keys to enable additional AI model providers
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Key className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base">OpenRouter API Key</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Access multiple AI providers through OpenRouter's unified API
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isKeyConfigured && (
                <Badge variant="outline" className="text-green-600 bg-green-50">
                  Configured
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('https://openrouter.ai/keys', '_blank')}
                className="flex items-center gap-1"
              >
                Get Key
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openrouter-key">API Key</Label>
            <div className="relative">
              <Input
                id="openrouter-key"
                type={showApiKey ? 'text' : 'password'}
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">About OpenRouter</p>
              <p>
                OpenRouter provides access to multiple AI providers (OpenAI, Anthropic, Google, Meta, etc.) 
                through a single API. Your API key is stored locally and used for direct client-side calls 
                to OpenRouter when you select OpenRouter models.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleSaveApiKey}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save API Key'}
            </Button>
            
            {isKeyConfigured && (
              <Button
                variant="outline"
                onClick={handleClearApiKey}
                className="text-red-600 hover:text-red-700"
              >
                Clear Key
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information about other providers */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-2">Other AI Providers</p>
            <p>
              Gemini models are processed server-side using environment variables configured in the 
              Supabase dashboard. No additional API key configuration is needed for Gemini models.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
