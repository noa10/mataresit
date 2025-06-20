/**
 * Embedding System Diagnostics
 * Direct database testing without edge functions
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Search,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface DiagnosticResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

export function EmbeddingSystemDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setCurrentTest(testName);
    const startTime = Date.now();
    
    try {
      const data = await testFunction();
      const duration = Date.now() - startTime;
      
      addResult({
        test: testName,
        success: true,
        message: 'Test completed successfully',
        data,
        duration
      });
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      addResult({
        test: testName,
        success: false,
        message: 'Test failed',
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
    const { data, error, count } = await supabase
      .from('unified_embeddings')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return { embeddingCount: count };
  };

  const testReceiptEmbeddingsTable = async () => {
    const { data, error, count } = await supabase
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
        const { data, error } = await supabase.rpc(funcName, 
          funcName === 'find_receipts_missing_embeddings' ? { limit_count: 1 } : {}
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
    toast.info('Running embedding system diagnostics...');

    try {
      // Test 1: Database Connection
      await runTest('Database Connection', testDatabaseConnection);
      
      // Test 2: Unified Embeddings Table
      await runTest('Unified Embeddings Table', testUnifiedEmbeddingsTable);
      
      // Test 3: Old Receipt Embeddings Table
      await runTest('Receipt Embeddings Table', testReceiptEmbeddingsTable);
      
      // Test 4: Database Functions
      await runTest('Database Functions', testDatabaseFunctions);
      
      // Test 5: Search Capability
      await runTest('Search Capability', testSearchCapability);
      
      toast.success('Diagnostics completed successfully');
      
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast.error('Some diagnostic tests failed - check results for details');
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const testMigrationNeeds = async () => {
    setIsRunning(true);
    toast.info('Checking migration requirements...');

    try {
      await runTest('Migration Analysis', async () => {
        const { data: migrationStats, error } = await supabase.rpc('get_embedding_migration_stats');
        
        if (error) throw error;
        return migrationStats;
      });
      
      toast.success('Migration analysis completed');
    } catch (error) {
      toast.error('Migration analysis failed');
    } finally {
      setIsRunning(false);
    }
  };

  const testEmbeddingGeneration = async () => {
    setIsRunning(true);
    toast.info('Testing embedding generation...');

    try {
      await runTest('Sample Receipt Analysis', async () => {
        // Get a sample receipt
        const { data: receipts, error } = await supabase
          .from('receipts')
          .select('id, merchant, fullText, notes')
          .limit(1);
        
        if (error) throw error;
        if (!receipts || receipts.length === 0) {
          throw new Error('No receipts found to test with');
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
      
      toast.success('Receipt analysis completed');
    } catch (error) {
      toast.error('Receipt analysis failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (success: boolean) => {
    return success ? 
      <Badge variant="default" className="bg-green-500">Success</Badge> : 
      <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Embedding System Diagnostics
          </CardTitle>
          <CardDescription>
            Direct database testing to verify embedding system health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              onClick={runBasicDiagnostics} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              Run Basic Diagnostics
            </Button>
            <Button 
              onClick={testMigrationNeeds} 
              disabled={isRunning}
              variant="outline"
            >
              Check Migration Needs
            </Button>
            <Button 
              onClick={testEmbeddingGeneration} 
              disabled={isRunning}
              variant="outline"
            >
              Test Receipt Analysis
            </Button>
          </div>

          {isRunning && (
            <Alert className="mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Running test: {currentTest}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.success)}
                      <span className="font-medium">{result.test}</span>
                    </div>
                    {getStatusBadge(result.success)}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {result.message}
                    {result.duration && ` (${result.duration}ms)`}
                  </div>
                  
                  {result.error && (
                    <div className="text-sm text-red-600 mb-2">
                      Error: {result.error}
                    </div>
                  )}
                  
                  {result.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">View Details</summary>
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
