import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Receipt, ArrowRight, Tag, AlertCircle, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';

import { ReceiptWithSimilarity, LineItemSearchResult } from '@/lib/ai-search';

interface SearchResultsProps {
  results: (ReceiptWithSimilarity | LineItemSearchResult)[];
  isLoading: boolean;
  totalResults: number;
  searchQuery?: string;
  onLoadMore?: () => void;
  hasMoreResults?: boolean;
}

export function SearchResults({
  results = [],
  isLoading,
  totalResults,
  searchQuery = '',
  onLoadMore,
  hasMoreResults = false,
}: SearchResultsProps) {
  const navigate = useNavigate();

  // Add debug logging to help diagnose issues
  console.log('SearchResults component received:', {
    totalResults,
    resultsCount: results.length,
    receiptResultsCount: results.filter(r => 'merchant' in r).length,
    lineItemResultsCount: results.filter(r => 'line_item_description' in r).length
  });

  // Enhanced navigation function with validation and error handling
  const handleNavigateToReceipt = (e: React.MouseEvent, id?: string, itemType?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Enhanced validation with better error messages
    if (!id || id.trim() === '') {
      console.error('Cannot navigate to receipt: ID is undefined or empty', { id, itemType });
      toast.error('Unable to view receipt: Receipt ID is missing', {
        description: 'The system could not find the receipt information for this item.'
      });
      return;
    }

    // Validate that the ID looks like a valid UUID or receipt ID
    if (id.length < 10) {
      console.error('Cannot navigate to receipt: ID appears invalid', { id, itemType });
      toast.error('Unable to view receipt: Invalid receipt ID', {
        description: 'The receipt ID appears to be malformed.'
      });
      return;
    }

    try {
      console.log(`Opening receipt in new tab: ${id} (from ${itemType || 'unknown'})`);

      // Open in new window/tab to preserve search context
      openReceiptInNewWindow(id, {
        from: 'search',
        itemType: itemType
      });
    } catch (error) {
      console.error('Error opening receipt:', error);

      // Check if it's a popup blocking error
      if (error instanceof Error && error.message.includes('popup')) {
        toast.error('Popup blocked', {
          description: 'Please allow popups for this site and try again, or check your browser settings.'
        });
      } else {
        toast.error('Navigation failed', {
          description: 'Could not open the receipt page. Please try again.'
        });
      }
    }
  };

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
        <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
          <h3 className="text-base sm:text-lg font-semibold">No results found</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {searchQuery ? (
              <>No receipts or line items matching "{searchQuery}" were found.</>
            ) : (
              <>Try a different search query or check your filters.</>
            )}
          </p>
          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <p>Possible reasons:</p>
            <ul className="list-disc text-left pl-4 sm:pl-6 mt-1 sm:mt-2 space-y-1">
              <li>No receipts have been uploaded yet</li>
              <li>Your search terms don't match any receipts or line items</li>
              <li>Vector embeddings haven't been generated for your data</li>
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
        <p className="text-xs sm:text-sm text-muted-foreground">
          Found {totalResults} result{totalResults !== 1 ? 's' : ''}
          {searchQuery ? ` for "${searchQuery}"` : ''} in Receipts and Line Items
        </p>
      )}

      <div className="space-y-4">
        {results.map((result) => {
          // Check if this is a unified search result or legacy format
          if ('sourceType' in result) {
            // This is a unified search result
            const unifiedResult = result as any; // UnifiedSearchResult type
            const similarityScore = unifiedResult.similarity || 0;
            const formattedScore = (similarityScore * 100).toFixed(0);

            // Check if it's a line item based on sourceType
            if (unifiedResult.sourceType === 'line_item') {
              // This is a line item from unified search
              const metadata = unifiedResult.metadata || {};

              console.log(`Line item card (unified) - ID: ${unifiedResult.sourceId || 'undefined'}, Merchant: ${metadata.merchant || 'Unknown'}, Type: line_item`);

              return (
                <Card
                  key={unifiedResult.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base sm:text-lg line-clamp-1">
                        {metadata.description || unifiedResult.title || 'Unknown Item'}
                      </CardTitle>
                      {similarityScore > 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {formattedScore}% match
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs sm:text-sm">
                      From: {metadata.merchant || metadata.parent_receipt_merchant || 'Unknown Merchant'}
                      {(metadata.date || metadata.parent_receipt_date) && (
                        <span className="ml-2" title={new Date(metadata.date || metadata.parent_receipt_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}>
                          on {new Date(metadata.date || metadata.parent_receipt_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2 px-3 sm:px-6">
                    {(metadata.quantity !== undefined || metadata.amount !== undefined || metadata.line_item_price !== undefined) && (
                      <p className="text-xs sm:text-sm">
                        {metadata.quantity !== undefined && (
                          <span>Qty: {metadata.quantity}</span>
                        )}
                        {metadata.quantity !== undefined &&
                         (metadata.amount !== undefined || metadata.line_item_price !== undefined) && (
                          <span className="mx-1">•</span>
                        )}
                        {(metadata.amount !== undefined || metadata.line_item_price !== undefined) && (
                          <span>Price: {metadata.currency || 'MYR'} {typeof (metadata.amount || metadata.line_item_price) === 'number'
                            ? (metadata.amount || metadata.line_item_price).toFixed(2)
                            : (metadata.amount || metadata.line_item_price)}</span>
                        )}
                      </p>
                    )}

                    {!metadata.receipt_id && (
                      <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        <span>Parent receipt information is missing</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="px-3 sm:px-6 py-2 sm:py-4">
                    {metadata.receipt_id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                        onClick={(e) => handleNavigateToReceipt(e, metadata.receipt_id, 'line_item')}
                      >
                        <Receipt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span>View Parent Receipt</span>
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                        disabled
                      >
                        <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span>Receipt Not Available</span>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            } else {
              // This is a receipt from unified search
              const metadata = unifiedResult.metadata || {};
              const date = metadata.date ? new Date(metadata.date) : null;

              console.log(`Receipt card (unified) - ID: ${unifiedResult.sourceId || 'undefined'}, Merchant: ${metadata.merchant || 'Unknown'}, Type: receipt`);

              return (
                <Card
                  key={unifiedResult.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base sm:text-lg line-clamp-1">
                        {metadata.merchant || unifiedResult.title || 'Unknown Merchant'}
                      </CardTitle>
                      {similarityScore > 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {formattedScore}% match
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs sm:text-sm">
                      {date ? (
                        <span title={date.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}>
                          {date.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                          <span className="hidden sm:inline">
                            ({formatDistanceToNow(date, { addSuffix: true })})
                          </span>
                        </span>
                      ) : (
                        'Unknown date'
                      )}
                      {(metadata.total || metadata.amount) && (
                        <span className="ml-2 font-medium">
                          {typeof (metadata.total || metadata.amount) === 'number'
                            ? `${metadata.currency || 'MYR'} ${(metadata.total || metadata.amount).toFixed(2)}`
                            : (metadata.total || metadata.amount)}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2 px-3 sm:px-6">
                    {metadata.notes ? (
                      <p className="text-xs sm:text-sm line-clamp-2">{metadata.notes}</p>
                    ) : metadata.raw_text ? (
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        {metadata.raw_text.substring(0, 150)}...
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">No additional details</p>
                    )}

                    {metadata.predicted_category && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {metadata.predicted_category}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="px-3 sm:px-6 py-2 sm:py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                      onClick={(e) => handleNavigateToReceipt(e, unifiedResult.sourceId, 'receipt')}
                    >
                      <Receipt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span>View Receipt</span>
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            }
          } else if ('merchant' in result) {
            // This is a receipt
            const receipt = result;
            const date = receipt.date ? new Date(receipt.date) : null;
            const similarityScore = receipt.similarity_score || 0;
            const formattedScore = (similarityScore * 100).toFixed(0);

            // Enhanced logging for debugging
            console.log(`Receipt card - ID: ${receipt.id || 'undefined'}, Merchant: ${receipt.merchant || 'Unknown'}, Type: receipt`);

            return (
              <Card
                key={receipt.id}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base sm:text-lg line-clamp-1">
                      {receipt.merchant || 'Unknown Merchant'}
                    </CardTitle>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {formattedScore}% match
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    {date ? (
                      <span title={date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}>
                        {date.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                        <span className="hidden sm:inline">
                          ({formatDistanceToNow(date, { addSuffix: true })})
                        </span>
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
                <CardContent className="pb-2 px-3 sm:px-6">
                  {receipt.notes ? (
                    <p className="text-xs sm:text-sm line-clamp-2">{receipt.notes}</p>
                  ) : receipt.raw_text ? (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {receipt.raw_text.substring(0, 150)}...
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground">No additional details</p>
                  )}

                  {receipt.predicted_category && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {receipt.predicted_category}
                      </Badge>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="px-3 sm:px-6 py-2 sm:py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                    onClick={(e) => handleNavigateToReceipt(e, receipt.id, 'receipt')}
                  >
                    <Receipt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span>View Receipt</span>
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            );
          } else {
            // This is a line item
            const item = result;
            const receiptDate = item.parent_receipt_date ? new Date(item.parent_receipt_date) : null;
            const similarityScore = item.similarity || 0;
            const formattedScore = (similarityScore * 100).toFixed(0);

            // Extract receipt ID from different possible sources in case it's missing
            let receiptId = item.receipt_id;

            // If receipt_id is missing, try parent_receipt_id first
            if (!receiptId && item.parent_receipt_id) {
              receiptId = item.parent_receipt_id;
              console.log(`Using parent_receipt_id ${receiptId}`);
            }

            // If still missing, try to extract from line_item_id
            if (!receiptId && item.line_item_id) {
              // Line item IDs might be formatted like "receipt_id:line_item_number"
              const parts = item.line_item_id.split(':');
              if (parts.length > 1) {
                receiptId = parts[0];
                console.log(`Extracted receipt ID ${receiptId} from line item ID ${item.line_item_id}`);
              }
            }

            // Finally check if there's a nested receipt object
            if (!receiptId && item.receipt && item.receipt.id) {
              receiptId = item.receipt.id;
              console.log(`Using nested receipt.id ${receiptId}`);
            }

            // Log whether we have a valid receipt ID
            const hasReceiptId = !!receiptId;
            console.log(`Line item card - ID: ${item.line_item_id || 'undefined'}, Has valid receipt ID: ${hasReceiptId}, Receipt ID: ${receiptId || 'undefined'}, Type: line_item`);

            return (
              <Card
                key={item.line_item_id}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base sm:text-lg line-clamp-1">
                      {item.line_item_description || 'Unknown Item'}
                    </CardTitle>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {formattedScore}% match
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    From: {item.parent_receipt_merchant || 'Unknown Merchant'}
                    {receiptDate && (
                      <span className="ml-2" title={receiptDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}>
                        on {receiptDate.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2 px-3 sm:px-6">
                  {(item.line_item_quantity !== undefined || item.line_item_price !== undefined) && (
                    <p className="text-xs sm:text-sm">
                      {item.line_item_quantity !== undefined && (
                        <span>Qty: {item.line_item_quantity}</span>
                      )}
                      {item.line_item_quantity !== undefined &&
                       (item.line_item_price !== undefined || item.line_item_amount !== undefined) && (
                        <span className="mx-1">•</span>
                      )}
                      {(item.line_item_price !== undefined || item.line_item_amount !== undefined) && (
                        <span>Price: ${typeof (item.line_item_price || item.line_item_amount) === 'number'
                          ? (item.line_item_price || item.line_item_amount).toFixed(2)
                          : (item.line_item_price || item.line_item_amount)}</span>
                      )}
                    </p>
                  )}

                  {!hasReceiptId && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      <span>Parent receipt information is missing</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="px-3 sm:px-6 py-2 sm:py-4">
                  {hasReceiptId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                      onClick={(e) => handleNavigateToReceipt(e, receiptId, 'line_item')}
                    >
                      <Receipt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span>View Parent Receipt</span>
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                      disabled
                      title="Parent receipt information is missing"
                    >
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span>Receipt Unavailable</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          }
        })}
      </div>

      {hasMoreResults && onLoadMore && (
        <div className="flex justify-center mt-4 sm:mt-6">
          <Button
            onClick={onLoadMore}
            variant="outline"
            className="text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
          >
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
}
