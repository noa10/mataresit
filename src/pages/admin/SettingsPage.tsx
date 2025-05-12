import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { LineItemEmbeddingsCard } from '@/components/admin/LineItemEmbeddingsCard';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          System configuration and settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Advanced settings coming soon</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-2">
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
            <div className="text-xs text-muted-foreground mt-2">
              <p>Important API Configuration:</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Set up a <strong>Gemini API key</strong> in your Supabase project environment variables as <code>GEMINI_API_KEY</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Item Embeddings Card */}
      <LineItemEmbeddingsCard />

    </div>
  );
}
