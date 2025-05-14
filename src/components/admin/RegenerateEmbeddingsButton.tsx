import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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

interface RegenerateEmbeddingsButtonProps {
  buttonText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  batchSize?: number;
}

export default function RegenerateEmbeddingsButton({
  buttonText = 'Regenerate All Embeddings (Receipts & Line Items)',
  variant = 'default',
  size = 'default',
  className = '',
  batchSize = 20
}: RegenerateEmbeddingsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [result, setResult] = useState<null | {
    success: boolean;
    receiptsProcessed: number;
    lineItemsProcessed: number;
    message: string;
  }>(null);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    setIsLoading(true);
    setResult(null);
    setIsDialogOpen(false);

    try {
      const response = await fetch('/api/admin/regenerate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchSize }),
      });

      const data = await response.json();

      setResult(data);

      toast({
        title: data.success ? 'Success' : 'Error',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error regenerating embeddings:', error);

      toast({
        title: 'Error',
        description: 'Failed to regenerate embeddings. See console for details.',
        variant: 'destructive',
      });

      setResult({
        success: false,
        receiptsProcessed: 0,
        lineItemsProcessed: 0,
        message: error.message || 'Unknown error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              buttonText
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate All Embeddings</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                Are you sure you want to regenerate all embeddings? This will:
              </p>
              <ul className="list-disc pl-5 mb-4 space-y-1 text-sm">
                <li>Reprocess <strong>all</strong> receipts and line items with the improved dimension handling algorithm</li>
                <li>Take significant time to complete (several minutes to hours depending on data size)</li>
                <li>Temporarily impact search functionality during processing</li>
                <li>Cannot be undone once started</li>
              </ul>
              <p className="text-sm font-medium">
                This action is recommended after algorithm updates to ensure consistent search results.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>
              Yes, Regenerate All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading && (
        <div className="mt-4 p-4 rounded-md bg-blue-50 text-blue-800">
          <p className="font-semibold">Regeneration In Progress</p>
          <p className="text-sm mt-1">
            This process may take several minutes to hours depending on your data size.
            You can continue using the application while this runs in the background.
          </p>
          <div className="mt-3 flex items-center">
            <Loader className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="font-semibold">{result.success ? 'Regeneration Complete' : 'Regeneration Failed'}</p>
          <p>{result.message}</p>
          {result.success && (
            <div className="mt-2">
              <p>Receipts processed: {result.receiptsProcessed}</p>
              <p>Line items processed: {result.lineItemsProcessed}</p>
              <p className="text-xs mt-2">
                All embeddings now use the improved dimension handling algorithm.
                Search results should be more accurate.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}