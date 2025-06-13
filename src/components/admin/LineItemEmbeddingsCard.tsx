import React, { useState } from 'react';
import { RefreshCw, Loader2, InfoIcon, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Alert, AlertDescription } from '../ui/alert';
import { checkLineItemEmbeddings, generateLineItemEmbeddings } from '@/lib/ai-search';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function LineItemEmbeddingsCard() {
  // Line item embedding state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalLineItems, setTotalLineItems] = useState(0);
  const [processedLineItems, setProcessedLineItems] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [embeddingStats, setEmbeddingStats] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  } | null>({
    total: 0,
    withEmbeddings: 0,
    withoutEmbeddings: 0
  });

  // Function to check line item embedding statistics
  const checkEmbeddingStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Checking line item embeddings stats...');

      const result = await checkLineItemEmbeddings();
      console.log('Line item embedding check result:', result);

      setEmbeddingStats({
        total: result.total || 0,
        withEmbeddings: result.withEmbeddings || 0,
        withoutEmbeddings: result.withoutEmbeddings || 0
      });
      setLastUpdated(new Date());
      toast.success('Line item embedding stats refreshed');
    } catch (error) {
      console.error('Error checking line item embedding stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check embedding stats';
      setError(errorMessage);
      toast.error(`Failed to refresh stats: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate embeddings for line items
  const handleGenerateEmbeddings = async (regenerate: boolean = false) => {
    try {
      setIsGeneratingEmbeddings(true);
      setIsRegenerating(regenerate);
      setEmbeddingProgress(0);
      setProcessedLineItems(0);
      setError(null);

      const actionType = regenerate ? 'Regenerating' : 'Generating';
      toast.info(`${actionType} line item embeddings...`);

      // Get current stats to know how many items need processing
      await checkEmbeddingStats();

      // Generate embeddings in batches until all are done
      let totalProcessed = 0;
      const batchSize = 200; // Process in batches of 200 receipts (increased to handle all receipts with missing embeddings)

      // Set the target based on whether we're regenerating all or just missing
      const targetCount = regenerate ?
        embeddingStats?.total || 0 :
        embeddingStats?.withoutEmbeddings || 0;

      setTotalLineItems(targetCount);

      if (targetCount > 0) {
        const result = await generateLineItemEmbeddings(batchSize, regenerate);
        console.log('Generation result:', result);

        if (result.processed > 0) {
          totalProcessed += result.processed;
          setProcessedLineItems(totalProcessed);

          // Update progress percentage
          const progress = Math.min(100, Math.round((totalProcessed / targetCount) * 100));
          setEmbeddingProgress(progress);

          toast.success(`Successfully processed ${result.processed} line items`);
        } else {
          toast.info('No line items needed processing');
        }
      } else {
        toast.info('No line items available for processing');
      }

      // Final check to update stats
      await checkEmbeddingStats();
    } catch (error) {
      console.error('Error generating line item embeddings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate embeddings';
      setError(errorMessage);
      toast.error(`Failed to generate embeddings: ${errorMessage}`);
    } finally {
      setIsGeneratingEmbeddings(false);
      setIsRegenerating(false);
    }
  };

  // Initial check when component mounts
  React.useEffect(() => {
    checkEmbeddingStats();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Line Item Embeddings</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-80">
                <p>Vector embeddings enable semantic search for individual line items on receipts. This allows searching for specific products or services.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Generate vector embeddings for line items to enable semantic search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col xs:flex-row gap-2 xs:justify-between text-sm">
            <div className="whitespace-nowrap">
              <span className="font-medium">Total Line Items:</span> {embeddingStats?.total || 0}
            </div>
            <div className="whitespace-nowrap">
              <span className="font-medium">With Embeddings:</span> {embeddingStats?.withEmbeddings || 0}
            </div>
            <div className="whitespace-nowrap">
              <span className="font-medium">Without Embeddings:</span> {embeddingStats?.withoutEmbeddings || 0}
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${embeddingStats && embeddingStats.total > 0 ? (embeddingStats.withEmbeddings / embeddingStats.total) * 100 : 0}%` }}
            ></div>
          </div>

          {lastUpdated && (
            <div className="text-xs text-muted-foreground">
              Stats last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </div>
          )}

          {isGeneratingEmbeddings && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {isRegenerating ? 'Regenerating embeddings...' : 'Generating embeddings...'}
                </span>
                <span>{processedLineItems} of {totalLineItems}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${embeddingProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkEmbeddingStats()}
              disabled={isGeneratingEmbeddings || isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              Refresh Stats
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      className="text-xs sm:text-sm w-full"
                      size="sm"
                      onClick={() => handleGenerateEmbeddings(true)}
                      disabled={isGeneratingEmbeddings || embeddingStats?.total === 0}
                    >
                      {isGeneratingEmbeddings && isRegenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>Regenerate All</>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    Reprocess all line items with the latest embedding algorithm, even those that already have embeddings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      className="text-xs sm:text-sm w-full"
                      size="sm"
                      onClick={() => handleGenerateEmbeddings(false)}
                      disabled={isGeneratingEmbeddings || (embeddingStats && embeddingStats.withoutEmbeddings === 0)}
                    >
                      {isGeneratingEmbeddings && !isRegenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>Generate Missing</>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    Only generate embeddings for line items that don't have them yet
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
