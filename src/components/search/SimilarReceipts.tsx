import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Receipt, LucideInfo } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Skeleton } from '../ui/skeleton';
import { getSimilarReceipts } from '../../lib/ai-search';
import { toast } from 'sonner';

interface SimilarReceiptsProps {
  receiptId: string;
  limit?: number;
  className?: string;
}

export function SimilarReceipts({
  receiptId,
  limit = 3,
  className = ''
}: SimilarReceiptsProps) {
  const navigate = useNavigate();
  const [similarReceipts, setSimilarReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced navigation function with validation and error handling
  const handleNavigateToReceipt = (e: React.MouseEvent, id: string | undefined) => {
    // Stop event propagation to prevent any parent handlers from interfering
    e.stopPropagation();

    // Enhanced validation with better error messages
    if (!id || id.trim() === '') {
      console.error('Cannot navigate to receipt: ID is undefined or empty', { id });
      toast.error('Error: Receipt ID is missing');
      return;
    }

    // Validate that the ID looks like a valid UUID or receipt ID
    if (id.length < 10) {
      console.error('Cannot navigate to receipt: ID appears invalid', { id });
      toast.error('Error: Invalid receipt ID');
      return;
    }

    console.log('Navigating to similar receipt with ID:', id);

    try {
      // Use navigate function with explicit pathname and state
      navigate(`/receipt/${id}`, {
        state: {
          from: 'similar-receipts',
          itemType: 'receipt'
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('Failed to navigate to receipt details');
    }
  };

  useEffect(() => {
    if (!receiptId) {
      console.log('No receipt ID provided, skipping similar receipts fetch');
      return;
    }

    const fetchSimilarReceipts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`Fetching similar receipts for ID: ${receiptId} with limit: ${limit}`);
        const receipts = await getSimilarReceipts(receiptId, limit);

        // Debug log the received receipt IDs
        console.log('SimilarReceipts received:', receipts.map(r => ({
          id: r.id || 'undefined',
          merchant: r.merchant || 'Unknown',
          similarity: r.similarity_score || 0
        })));

        if (!receipts || receipts.length === 0) {
          console.log('No similar receipts found');
        }

        setSimilarReceipts(receipts || []);
      } catch (err) {
        console.error('Error fetching similar receipts:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch similar receipts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarReceipts();
  }, [receiptId, limit]);

  if (isLoading) {
    return (
      <Card className={`border ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg">Similar Receipts</CardTitle>
          <CardDescription>Loading similar receipts...</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="space-y-4">
            {Array.from({ length: limit }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg">Similar Receipts</CardTitle>
          <CardDescription className="text-red-500">Error: {error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (similarReceipts.length === 0) {
    return (
      <Card className={`border ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg">Similar Receipts</CardTitle>
          <CardDescription>No similar receipts found</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 text-center">
          <LucideInfo className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            We couldn't find any receipts similar to this one.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            This may be because vector embeddings haven't been generated for your receipts.
            Visit the AI Search page to generate embeddings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Similar Receipts</CardTitle>
        <CardDescription>Based on merchant similarity</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-4">
          {similarReceipts.map((receipt) => {
            const date = receipt.date ? new Date(receipt.date) : null;

            // Debug log each receipt's ID as it's rendered
            console.log(`Rendering similar receipt: ID=${receipt.id || 'undefined'}, Merchant=${receipt.merchant || 'Unknown'}`);

            return (
              <div
                key={receipt.id}
                className="flex items-start space-x-3 pb-3 border-b last:border-0 last:pb-0"
              >
                <div className="bg-muted rounded-md h-10 w-10 flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-sm line-clamp-1">
                    {receipt.merchant || 'Unknown Merchant'}
                  </h4>
                  <div className="text-xs text-muted-foreground">
                    {date ? (
                      <span title={date.toLocaleDateString()}>
                        {date.toLocaleDateString()}
                      </span>
                    ) : (
                      'Unknown date'
                    )}
                    {receipt.total && (
                      <span className="ml-2 font-medium">
                        {typeof receipt.total === 'number'
                          ? `$${receipt.total.toFixed(2)}`
                          : receipt.total}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={(e) => handleNavigateToReceipt(e, receipt.id)}
                  >
                    View Receipt
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
