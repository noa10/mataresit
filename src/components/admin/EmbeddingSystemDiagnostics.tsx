/**
 * Embedding System Diagnostics
 * Direct database testing without edge functions
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {  CheckCircle,  XCircle,  RefreshCw,  Database,  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface DiagnosticResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

export function EmbeddingSystemDiagnostics() {
  const { t } = useAdminTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runTest = async (testKey: string, testFunction: () => Promise<any>) => {
    setCurrentTest(testKey);
    const startTime = Date.now();
    try {
      const data = await testFunction();
      const duration = Date.now() - startTime;
      addResult({
        test: testKey,
        success: true,
        message: t('diagnostics.embeddingSystem.testCompleted'),
        data,
        duration
      });
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult({
        test: testKey,
        success: false,
        message: t('diagnostics.embeddingSystem.testFailed'),
        error: errorMessage,
        duration
      });
      throw error;
    }
  };

  const testDatabaseConnection = async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { receiptCount: data };
  };

  const testUnifiedEmbeddingsTable = async () => {
    const { data: _data, error, count } = await supabase
      .from('unified_embeddings')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return { embeddingCount: count };
  };

  const testReceiptEmbeddingsTable = async () => {
    const { data: _data2, error, count } = await supabase
      .from('receipt_embeddings')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return { oldEmbeddingCount: count };
  };

  const testDatabaseFunctions = async () => {
    const functions = [
      'get_unified_search_stats',
      'get_embedding_migration_stats',
      'find_receipts_missing_embeddings'
    ];
    const results = [];
    for (const funcName of functions) {
      try {
        const { data, error } = await supabase.rpc(funcName,          funcName === 'find_receipts_missing_embeddings' ? { limit_count: 1 } : {}
        );
        results.push({
          function: funcName,
          exists: !error,
          error: error?.message,
          sampleData: data
        });
      } catch (err) {
        results.push({
          function: funcName,
          exists: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    return results;
  };

  const testSearchCapability = async () => {
    // Test if we can perform a basic search
    try {
      const { data, error } = await supabase.rpc('unified_search', {
        query_embedding: Array(1536).fill(0.1), // Dummy embedding
        similarity_threshold: 0.1,
        match_count: 5
      });
      if (error) throw error;
      return { searchResults: data, searchWorking: true };
    } catch (error) {
      return { searchWorking: false, error: error.message };
    }
  };

  const runBasicDiagnostics = async () => {
    setIsRunning(true);
    clearResults();
    toast.info(t('diagnostics.embeddingSystem.toasts.running'));

    try {
      // Test 1: Database Connection
      await runTest('databaseConnection', testDatabaseConnection);
      // Test 2: Unified Embeddings Table
      await runTest('unifiedEmbeddingsTable', testUnifiedEmbeddingsTable);
      // Test 3: Old Receipt Embeddings Table
      await runTest('receiptEmbeddingsTable', testReceiptEmbeddingsTable);
      // Test 4: Database Functions
      await runTest('databaseFunctions', testDatabaseFunctions);
      // Test 5: Search Capability
      await runTest('searchCapability', testSearchCapability);
      toast.success(t('diagnostics.embeddingSystem.toasts.completed'));
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast.error(t('diagnostics.embeddingSystem.toasts.someFailed'));
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const testMigrationNeeds = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingSystem.toasts.checkingMigration'));

    try {
      await runTest('migrationAnalysis', async () => {
        const { data: migrationStats, error } = await supabase.rpc('get_embedding_migration_stats');
        if (error) throw error;
        return migrationStats;
      });
      toast.success(t('diagnostics.embeddingSystem.toasts.migrationCompleted'));
    } catch (error) {
      toast.error(t('diagnostics.embeddingSystem.toasts.migrationFailed'));
    } finally {
      setIsRunning(false);
    }
  };

  const testEmbeddingGeneration = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingSystem.toasts.testingGeneration'));

    try {
      await runTest('sampleReceiptAnalysis', async () => {
        // Get a sample receipt
        const { data: receipts, error } = await supabase
          .from('receipts')
          .select('id, merchant, fullText, notes')
          .limit(1);
        if (error) throw error;
        if (!receipts || receipts.length === 0) {
          throw new Error(t('diagnostics.embeddingSystem.noReceiptsFound'));
        }
        const receipt = receipts[0];
        // Check if this receipt has embeddings
        const { data: embeddings, error: embError } = await supabase
          .from('unified_embeddings')
          .select('*')
          .eq('source_type', 'receipt')
          .eq('source_id', receipt.id);
        if (embError) throw embError;
        return {
          receipt: {
            id: receipt.id,
            merchant: receipt.merchant,
            hasFullText: !!receipt.fullText,
            hasNotes: !!receipt.notes
          },
          embeddings: embeddings || [],
          embeddingCount: embeddings?.length || 0
        };
      });
      toast.success(t('diagnostics.embeddingSystem.toasts.receiptCompleted'));
    } catch (error) {
      toast.error(t('diagnostics.embeddingSystem.toasts.receiptFailed'));
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ?      <CheckCircle className="h-4 w-4 text-green-500" /> :      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (success: boolean) => {
    return success ?      <Badge variant="default" className="bg-green-500">{t('diagnostics.embeddingSystem.success')}</Badge> :      <Badge variant="destructive">{t('diagnostics.embeddingSystem.failed')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('diagnostics.embeddingSystem.title')}
          </CardTitle>
          <CardDescription>
            {t('diagnostics.embeddingSystem.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button              onClick={runBasicDiagnostics}              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {t('diagnostics.embeddingSystem.runBasic')}
            </Button>
            <Button              onClick={testMigrationNeeds}              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingSystem.checkMigration')}
            </Button>
            <Button              onClick={testEmbeddingGeneration}              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingSystem.testReceiptAnalysis')}
            </Button>
          </div>

          {isRunning && (
            <Alert className="mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {t('diagnostics.embeddingSystem.runningTest', {
                  test: t(`diagnostics.embeddingSystem.tests.${currentTest}`, {
                    defaultValue: currentTest,
                  }),
                })}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('diagnostics.embeddingSystem.resultsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.success)}
                      <span className="font-medium">
                        {t(`diagnostics.embeddingSystem.tests.${result.test}`, {
                          defaultValue: result.test,
                        })}
                      </span>
                    </div>
                    {getStatusBadge(result.success)}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {t(
                      result.success
                        ? 'diagnostics.embeddingSystem.testCompleted'
                        : 'diagnostics.embeddingSystem.testFailed'
                    )}
                    {result.duration && ` (${result.duration}ms)`}
                  </div>
                  {result.error && (
                    <div className="text-sm text-red-600 mb-2">
                      {t('diagnostics.embeddingSystem.error')}: {result.error}
                    </div>
                  )}
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">{t('diagnostics.embeddingSystem.viewDetails')}</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-auto max-h-40">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
