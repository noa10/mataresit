import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Receipt, ArrowRight, Tag, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';

interface SearchResultsProps {
  results: any[];
  isLoading: boolean;
  totalResults: number;
  searchQuery?: string;
  onLoadMore?: () => void;
  hasMoreResults?: boolean;
}

export function SearchResults({
  results,
  isLoading,
  totalResults,
  searchQuery = '',
  onLoadMore,
  hasMoreResults = false,
}: SearchResultsProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border rounded-lg overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-2/4 mt-2" />
            </CardHeader>
            <CardContent className="pb-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-8 w-1/4" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="border rounded-lg overflow-hidden bg-muted/30">
        <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No results found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery ? (
              <>No receipts matching "{searchQuery}" were found.</>
            ) : (
              <>Try a different search query or check your filters.</>
            )}
          </p>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Possible reasons:</p>
            <ul className="list-disc text-left pl-6 mt-2 space-y-1">
              <li>No receipts have been uploaded yet</li>
              <li>Your search terms don't match any receipts</li>
              <li>Vector embeddings haven't been generated for your receipts</li>
              <li>The search service might be experiencing issues</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {results.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Found {totalResults} result{totalResults !== 1 ? 's' : ''}
          {searchQuery ? ` for "${searchQuery}"` : ''}
        </p>
      )}

      <div className="space-y-4">
        {results.map((receipt) => {
          const date = receipt.date ? new Date(receipt.date) : null;
          const similarityScore = receipt.similarity_score || 0;
          const formattedScore = (similarityScore * 100).toFixed(0);

          return (
            <Card
              key={receipt.id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg line-clamp-1">
                    {receipt.merchant || 'Unknown Merchant'}
                  </CardTitle>
                  {similarityScore > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {formattedScore}% match
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {date ? (
                    <span title={date.toLocaleDateString()}>
                      {date.toLocaleDateString()} ({formatDistanceToNow(date, { addSuffix: true })})
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
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                {receipt.notes ? (
                  <p className="text-sm line-clamp-2">{receipt.notes}</p>
                ) : receipt.raw_text ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {receipt.raw_text.substring(0, 150)}...
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional details</p>
                )}

                {receipt.predicted_category && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary">
                      <Tag className="h-3 w-3 mr-1" />
                      {receipt.predicted_category}
                    </Badge>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/receipt/${receipt.id}`)}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  View Receipt
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {hasMoreResults && onLoadMore && (
        <div className="flex justify-center mt-6">
          <Button onClick={onLoadMore} variant="outline">
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
}
