import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { checkLineItemEmbeddings, generateLineItemEmbeddings } from '@/lib/ai-search';

export function LineItemEmbeddingsCard() {
  // Line item embedding state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalLineItems, setTotalLineItems] = useState(0);
  const [processedLineItems, setProcessedLineItems] = useState(0);
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
      console.log('Checking line item embeddings stats...');

      const result = await checkLineItemEmbeddings();
      console.log('Line item embedding check result:', result);

      setEmbeddingStats({
        total: result.total || 0,
        withEmbeddings: result.withEmbeddings || 0,
        withoutEmbeddings: result.withoutEmbeddings || 0
      });
    } catch (error) {
      console.error('Error checking line item embedding stats:', error);
    }
  };

  // Function to generate embeddings for line items
  const handleGenerateEmbeddings = async () => {
    try {
      setIsGeneratingEmbeddings(true);
      setEmbeddingProgress(0);
      setProcessedLineItems(0);

      // Get current stats to know how many items need processing
      await checkEmbeddingStats();

      // Generate embeddings in batches until all are done
      let totalProcessed = 0;
      const batchSize = 50; // Process in batches of 50

      if (embeddingStats && embeddingStats.withoutEmbeddings > 0) {
        setTotalLineItems(embeddingStats.withoutEmbeddings);

        while (totalProcessed < embeddingStats.withoutEmbeddings) {
          try {
            const result = await generateLineItemEmbeddings(batchSize);
            console.log('Generation batch result:', result);

            if (result.processed > 0) {
              totalProcessed += result.processed;
              setProcessedLineItems(totalProcessed);

              // Update progress percentage
              const progress = Math.min(100, Math.round((totalProcessed / embeddingStats.withoutEmbeddings) * 100));
              setEmbeddingProgress(progress);

              // If no more items need processing, we're done
              if (result.withoutEmbeddings === 0) {
                break;
              }
            } else {
              // If nothing was processed in this batch, likely all items are done
              console.log('No more line items to process');
              break;
            }
          } catch (batchError) {
            console.error('Error in embedding generation batch:', batchError);
          }
        }
      }

      // Final check to update stats
      await checkEmbeddingStats();
    } catch (error) {
      console.error('Error generating line item embeddings:', error);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  // Initial check when component mounts
  React.useEffect(() => {
    checkEmbeddingStats();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line Item Embeddings</CardTitle>
        <CardDescription>
          Generate vector embeddings for line items to enable semantic search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <div>
              <span className="font-medium">Total Line Items:</span> {embeddingStats?.total || 0}
            </div>
            <div>
              <span className="font-medium">With Embeddings:</span> {embeddingStats?.withEmbeddings || 0}
            </div>
            <div>
              <span className="font-medium">Without Embeddings:</span> {embeddingStats?.withoutEmbeddings || 0}
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${embeddingStats && embeddingStats.total > 0 ? (embeddingStats.withEmbeddings / embeddingStats.total) * 100 : 0}%` }}
            ></div>
          </div>

          {isGeneratingEmbeddings && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating embeddings...</span>
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

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={checkEmbeddingStats}
              disabled={isGeneratingEmbeddings}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Refresh Stats
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateEmbeddings}
              disabled={isGeneratingEmbeddings || (embeddingStats && embeddingStats.withoutEmbeddings === 0)}
            >
              {isGeneratingEmbeddings ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Missing Embeddings</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
