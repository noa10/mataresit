import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Receipt, LucideInfo } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Skeleton } from '../ui/skeleton';
import { getSimilarReceipts } from '../../lib/ai-search';

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

  useEffect(() => {
    if (!receiptId) return;

    const fetchSimilarReceipts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const receipts = await getSimilarReceipts(receiptId, limit);
        setSimilarReceipts(receipts);
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
                    onClick={() => navigate(`/receipts/${receipt.id}`)}
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
