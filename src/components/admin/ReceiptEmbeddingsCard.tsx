import React, { useState } from 'react';
import { RefreshCw, Loader2, InfoIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { checkReceiptEmbeddings, generateReceiptEmbeddings } from '@/lib/ai-search';
import { formatDistanceToNow } from 'date-fns';

export function ReceiptEmbeddingsCard() {
  // Receipt embedding state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [processedReceipts, setProcessedReceipts] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [embeddingStats, setEmbeddingStats] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  } | null>({
    total: 0,
    withEmbeddings: 0,
    withoutEmbeddings: 0
  });

  // Function to check receipt embedding statistics
  const checkEmbeddingStats = async () => {
    try {
      console.log('Checking receipt embeddings stats...');

      const result = await checkReceiptEmbeddings();
      console.log('Receipt embedding check result:', result);

      setEmbeddingStats({
        total: result.total || 0,
        withEmbeddings: result.withEmbeddings || 0,
        withoutEmbeddings: result.withoutEmbeddings || 0
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error checking receipt embedding stats:', error);
    }
  };

  // Function to generate embeddings for receipts
  const handleGenerateEmbeddings = async (regenerate: boolean = false) => {
    try {
      setIsGeneratingEmbeddings(true);
      setIsRegenerating(regenerate);
      setEmbeddingProgress(0);
      setProcessedReceipts(0);

      // Get current stats to know how many items need processing
      await checkEmbeddingStats();

      // Generate embeddings in batches until all are done
      let totalProcessed = 0;
      const batchSize = 10; // Process in batches of 10 (receipts need more resources per item)

      // Set the target based on whether we're regenerating all or just missing
      const targetCount = regenerate ?
        embeddingStats?.total || 0 :
        embeddingStats?.withoutEmbeddings || 0;

      setTotalReceipts(targetCount);

      if (targetCount > 0) {
        const result = await generateReceiptEmbeddings(batchSize, regenerate);
        console.log('Receipt embedding generation result:', result);

        if (result.processed > 0) {
          totalProcessed += result.processed;
          setProcessedReceipts(totalProcessed);

          // Update progress percentage
          const progress = Math.min(100, Math.round((totalProcessed / targetCount) * 100));
          setEmbeddingProgress(progress);
        }
      }

      // Final check to update stats
      await checkEmbeddingStats();
    } catch (error) {
      console.error('Error generating receipt embeddings:', error);
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
          <span>Receipt Embeddings</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-80">
                <p>Vector embeddings enable semantic search for receipts. They convert text into numerical vectors that capture meaning.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Generate vector embeddings for receipts to enable semantic search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col xs:flex-row gap-2 xs:justify-between text-sm">
            <div className="whitespace-nowrap">
              <span className="font-medium">Total Receipts:</span> {embeddingStats?.total || 0}
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
                <span>{processedReceipts} of {totalReceipts}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${embeddingProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={checkEmbeddingStats}
              disabled={isGeneratingEmbeddings}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh Stats
            </Button>

            <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="secondary"
                        className="text-xs sm:text-sm text-center w-full"
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
                          <>Regenerate All Receipts</>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Reprocess all receipts with the latest embedding algorithm, even those that already have embeddings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="default"
                        className="text-xs sm:text-sm text-center w-full"
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
                          <>Generate Missing Embeddings</>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Only generate embeddings for receipts that don't have them yet
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
