import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import { CombinedVectorStatus } from '../../components/search/CombinedVectorStatus';

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

      {/* Vector DB Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Vector Database Status</CardTitle>
          <CardDescription>
            Monitor and troubleshoot vector database and related services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="vector-status">
              <AccordionTrigger className="flex items-center text-sm font-medium">
                <Database className="h-4 w-4 mr-2" />
                Vector Database Status & Connection
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-1">
                  <CombinedVectorStatus />
                </div>
                <div className="mt-4 flex items-center space-x-2">
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
                <div className="text-xs text-muted-foreground mt-4">
                  <p>If vector search is not working, you need to:</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-1">
                    <li>Run the database migration to enable the pgvector extension</li>
                    <li>Set up a <strong>Gemini API key</strong> in your Supabase project environment variables as <code>GEMINI_API_KEY</code></li>
                    <li>Make sure your receipts have embeddings generated</li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

    </div>
  );
}
