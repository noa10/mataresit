import { LineItemEmbeddingsCard } from '@/components/admin/LineItemEmbeddingsCard';
import { ReceiptEmbeddingsCard } from '@/components/admin/ReceiptEmbeddingsCard';
import { StripeTestingCard } from '@/components/admin/StripeTestingCard';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage system embeddings and configuration
        </p>
      </div>

      {/* Embeddings Management Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Embedding Management</h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage vector embeddings for semantic search functionality.
            Embeddings enable intelligent search across receipts and line items.
          </p>
        </div>

        {/* Embeddings Cards - Responsive Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Receipt Embeddings Card */}
          <div className="w-full">
            <ReceiptEmbeddingsCard />
          </div>

          {/* Line Item Embeddings Card */}
          <div className="w-full">
            <LineItemEmbeddingsCard />
          </div>
        </div>
      </div>

      {/* Stripe Testing Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Stripe Integration Testing</h2>
          <p className="text-sm text-muted-foreground">
            Test and validate Stripe payment integration functionality including checkout sessions and webhooks.
          </p>
        </div>

        <StripeTestingCard />
      </div>
    </div>
  );
}
