import RegenerateEmbeddingsButton from "@/components/admin/RegenerateEmbeddingsButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and perform administrative tasks.
        </p>
      </div>

      <Tabs defaultValue="embeddings">
        <TabsList>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="embeddings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vector Embeddings</CardTitle>
              <CardDescription>
                Manage embeddings for semantic search functionality.
                Regenerate embeddings using improved dimension handling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <h3 className="font-semibold text-amber-800">Important Note</h3>
                <p className="text-amber-700 text-sm mb-2">
                  Regenerating embeddings will reprocess all existing receipt and line item
                  embeddings using the improved dimension handling algorithm. This process
                  may take some time, but will improve search results. This action cannot be
                  undone.
                </p>
                <div className="text-amber-700 text-sm space-y-1">
                  <p className="font-medium">When to regenerate embeddings:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>After updating the embedding algorithm or model</li>
                    <li>If search results are inconsistent or inaccurate</li>
                    <li>When search returns no results for queries that should match</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <RegenerateEmbeddingsButton
                  buttonText="Regenerate All Embeddings (Receipts & Line Items)"
                  variant="default"
                  batchSize={20}
                />
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="font-semibold text-blue-800">For More Control</h3>
                <p className="text-blue-700 text-sm mb-2">
                  If you need more granular control over embedding generation, visit the
                  <a href="/admin/SettingsPage" className="text-blue-600 hover:underline font-medium ml-1">
                    Settings Page
                  </a> where you can:
                </p>
                <ul className="list-disc pl-5 text-blue-700 text-sm">
                  <li>Generate embeddings only for receipts or only for line items</li>
                  <li>Process only items missing embeddings instead of regenerating all</li>
                  <li>View detailed statistics about embedding coverage</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings and parameters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                System settings will be added in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Configure the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Appearance settings will be added in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}