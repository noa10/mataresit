import React, { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { checkReceiptEmbeddings, generateReceiptEmbeddings } from '@/lib/ai-search';

export function ReceiptEmbeddingsCard() {
  // Receipt embedding state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [processedReceipts, setProcessedReceipts] = useState(0);
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
        <CardTitle>Receipt Embeddings</CardTitle>
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
              <Button
                variant="secondary"
                className="text-xs sm:text-sm text-center"
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

              <Button
                variant="default"
                className="text-xs sm:text-sm text-center"
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
