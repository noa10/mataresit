import React, { useState } from 'react';
import { RefreshCw, Loader2, InfoIcon, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Alert, AlertDescription } from '../ui/alert';
import { checkReceiptEmbeddings, generateReceiptEmbeddings } from '@/lib/ai-search';
import { formatDistanceToNow } from 'date-fns';
import { ms as msLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAdminTranslation } from '@/contexts/LanguageContext';

export function ReceiptEmbeddingsCard() {
  const { t, language } = useAdminTranslation();
  // Receipt embedding state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [processedReceipts, setProcessedReceipts] = useState(0);
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

  // Function to check receipt embedding statistics
  const checkEmbeddingStats = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Checking receipt embeddings stats...');

      const result = await checkReceiptEmbeddings();
      console.log('Receipt embedding check result:', result);

      setEmbeddingStats({
        total: result.total || 0,
        withEmbeddings: result.withEmbeddings || 0,
        withoutEmbeddings: result.withoutEmbeddings || 0
      });
      setLastUpdated(new Date());
      if (!silent) {
        toast.success(t('embeddingsCard.refreshReceiptSuccess'));
      }
    } catch (error) {
      console.error('Error checking receipt embedding stats:', error);
      const errorMessage = error instanceof Error ? error.message : t('embeddingsCard.checkFailed');
      setError(errorMessage);
      if (!silent) {
        toast.error(t('embeddingsCard.refreshFailed', { error: errorMessage }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to generate embeddings for receipts
  const handleGenerateEmbeddings = async (regenerate: boolean = false) => {
    try {
      setIsGeneratingEmbeddings(true);
      setIsRegenerating(regenerate);
      setEmbeddingProgress(0);
      setProcessedReceipts(0);
      setError(null);

      toast.info(
        regenerate
          ? t('embeddingsCard.regeneratingReceiptToast')
          : t('embeddingsCard.generatingReceiptToast')
      );

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

          toast.success(
            t('embeddingsCard.processedReceipts', { count: result.processed })
          );
        } else {
          toast.info(t('embeddingsCard.noReceiptsNeeded'));
        }
      } else {
        toast.info(t('embeddingsCard.noReceiptsAvailable'));
      }

      // Final check to update stats
      await checkEmbeddingStats();
    } catch (error) {
      console.error('Error generating receipt embeddings:', error);
      const errorMessage = error instanceof Error ? error.message : t('embeddingsCard.generateFailed', { error: '' });
      setError(errorMessage);
      toast.error(t('embeddingsCard.generateFailed', { error: errorMessage }));
    } finally {
      setIsGeneratingEmbeddings(false);
      setIsRegenerating(false);
    }
  };

  // Initial check when component mounts
  React.useEffect(() => {
    checkEmbeddingStats({ silent: true });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('embeddingsCard.receiptTitle')}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-80">
                <p>{t('embeddingsCard.receiptTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          {t('embeddingsCard.receiptDescription')}
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

          <div className="flex flex-col xs:flex-row xs:flex-wrap gap-2 xs:justify-between text-sm">
            <div className="whitespace-nowrap">
              <span className="font-medium">{t('embeddingsCard.totalReceipts')}</span> {embeddingStats?.total || 0}
            </div>
            <div className="whitespace-nowrap">
              <span className="font-medium">{t('embeddingsCard.withEmbeddings')}</span> {embeddingStats?.withEmbeddings || 0}
            </div>
            <div className="whitespace-nowrap">
              <span className="font-medium">{t('embeddingsCard.withoutEmbeddings')}</span> {embeddingStats?.withoutEmbeddings || 0}
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-full bg-ledger-surface-2 h-2">
            <div
              className="bg-ledger-accent h-2 rounded-full"
              style={{ width: `${embeddingStats && embeddingStats.total > 0 ? Math.min(100, (embeddingStats.withEmbeddings / embeddingStats.total) * 100) : 0}%` }}
            ></div>
          </div>

          {lastUpdated && (
            <div className="text-xs text-muted-foreground">
              {t('embeddingsCard.statsUpdated', {
                time: formatDistanceToNow(lastUpdated, {
                  addSuffix: true,
                  locale: language === 'ms' ? msLocale : undefined,
                }),
              })}
            </div>
          )}

          {isGeneratingEmbeddings && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {isRegenerating
                    ? t('embeddingsCard.regenerating')
                    : t('embeddingsCard.generating')}
                </span>
                <span>
                  {t('embeddingsCard.of', {
                    processed: processedReceipts,
                    total: totalReceipts,
                  })}
                </span>
              </div>
              <div className="w-full overflow-hidden rounded-full bg-ledger-surface-2 h-2">
                <div
                  className="bg-ledger-accent h-2 rounded-full"
                  style={{ width: `${embeddingProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={checkEmbeddingStats}
              disabled={isGeneratingEmbeddings || isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              {t('embeddingsCard.refreshStats')}
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
                          {t('embeddingsCard.regenerating')}
                        </>
                      ) : (
                        <>{t('embeddingsCard.regenerateAll')}</>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {t('embeddingsCard.reprocessReceiptsTooltip')}
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
                          {t('embeddingsCard.generating')}
                        </>
                      ) : (
                        <>{t('embeddingsCard.generateMissing')}</>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {t('embeddingsCard.missingReceiptsTooltip')}
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
