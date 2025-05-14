import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { LineItemEmbeddingsCard } from '@/components/admin/LineItemEmbeddingsCard';
import { ReceiptEmbeddingsCard } from '@/components/admin/ReceiptEmbeddingsCard';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          System configuration and settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Advanced settings coming soon</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 sm:h-64">
          <p className="text-muted-foreground">Advanced settings features will be implemented in the future</p>
        </CardContent>
      </Card>

      {/* Edge Function Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Edge Functions</CardTitle>
          <CardDescription>Test Supabase Edge Function connectivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-thumbnails', {
                    method: 'OPTIONS',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  })
                  .then(response => {
                    console.log('CORS Test Response:', response);
                    alert(`CORS Test ${response.ok ? 'Passed!' : 'Failed!'} Status: ${response.status}`);
                  })
                  .catch(error => {
                    console.error('CORS Test Error:', error);
                    alert(`CORS Test Failed: ${error.message}`);
                  });
                }}
              >
                Test Edge Function CORS
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 overflow-x-auto">
              <p>Important API Configuration:</p>
              <ul className="list-disc pl-4 mt-1 space-y-1 pr-2">
                <li>Set up a <strong>Gemini API key</strong> in your Supabase project environment variables as <code>GEMINI_API_KEY</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Embeddings Action */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle>Global Embedding Management</CardTitle>
          <CardDescription>
            Need to regenerate all embeddings at once? Use the global regeneration tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For a single-click solution to regenerate all embeddings with the improved dimension handling algorithm,
              visit the main settings page. This is recommended after algorithm updates or when search results are inconsistent.
            </p>
            <Button asChild variant="default">
              <a href="/admin/settings">Go to Global Embedding Management</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Embeddings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Receipt Embeddings Card */}
        <ReceiptEmbeddingsCard />

        {/* Line Item Embeddings Card */}
        <LineItemEmbeddingsCard />
      </div>

    </div>
  );
}
