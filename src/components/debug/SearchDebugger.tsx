import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Database, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { runDatabaseReadinessTest, testDatabaseFunction, testUserEmbeddingsAndSearch } from '@/lib/test-database-functions';
import { useAuth } from '@/contexts/AuthContext';

interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export function SearchDebugger() {
  const [isDebugging, setIsDebugging] = useState(false);
  const [results, setResults] = useState<DebugResult[]>([]);
  const { user, session } = useAuth();

  const addResult = (result: DebugResult) => {
    setResults(prev => [...prev, result]);
  };

  const runSearchDebug = async () => {
    setIsDebugging(true);
    setResults([]);

    try {
      // Step 1: Check authentication
      addResult({
        step: 'Authentication Check',
        status: session ? 'success' : 'error',
        message: session ? `User authenticated: ${user?.email}` : 'No active session',
        details: { userId: user?.id, email: user?.email }
      });

      if (!session) {
        setIsDebugging(false);
        return;
      }

      // Step 2: Check unified_embeddings table
      const { data: embeddingCount, error: countError } = await supabase
        .from('unified_embeddings')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        addResult({
          step: 'Embeddings Table Check',
          status: 'error',
          message: `Error accessing unified_embeddings: ${countError.message}`,
          details: countError
        });
      } else {
        addResult({
          step: 'Embeddings Table Check',
          status: 'success',
          message: `Found ${embeddingCount?.length || 0} total embeddings`,
          details: { totalEmbeddings: embeddingCount?.length || 0 }
        });
      }

      // Step 3: Check user-specific embeddings
      const { data: userEmbeddings, error: userEmbError } = await supabase
        .from('unified_embeddings')
        .select('source_type, content_type, source_id')
        .eq('user_id', user!.id);

      if (userEmbError) {
        addResult({
          step: 'User Embeddings Check',
          status: 'error',
          message: `Error querying user embeddings: ${userEmbError.message}`,
          details: userEmbError
        });
      } else {
        const userEmbeddingCount = userEmbeddings?.length || 0;
        addResult({
          step: 'User Embeddings Check',
          status: userEmbeddingCount > 0 ? 'success' : 'warning',
          message: `Found ${userEmbeddingCount} embeddings for current user`,
          details: { 
            userEmbeddings: userEmbeddingCount,
            sampleEmbeddings: userEmbeddings?.slice(0, 3)
          }
        });
      }

      // Step 4: Check user receipts
      const { data: userReceipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, merchant, date, user_id')
        .eq('user_id', user!.id);

      if (receiptsError) {
        addResult({
          step: 'User Receipts Check',
          status: 'error',
          message: `Error querying receipts: ${receiptsError.message}`,
          details: receiptsError
        });
      } else {
        const receiptCount = userReceipts?.length || 0;
        addResult({
          step: 'User Receipts Check',
          status: receiptCount > 0 ? 'success' : 'warning',
          message: `Found ${receiptCount} receipts for current user`,
          details: { 
            userReceipts: receiptCount,
            sampleReceipts: userReceipts?.slice(0, 3)
          }
        });
      }

      // Step 5: Test unified_search function with user filter
      const testEmbedding = new Array(1536).fill(0.1);
      const searchResult = await testDatabaseFunction('unified_search', {
        query_embedding: testEmbedding,
        source_types: ['receipt'],
        content_types: null,
        similarity_threshold: 0.1,
        match_count: 10,
        user_filter: user!.id,
        team_filter: null,
        language_filter: null
      });

      addResult({
        step: 'Search Function Test (with user filter)',
        status: searchResult.testPassed ? 'success' : 'error',
        message: searchResult.testPassed 
          ? `Search returned ${searchResult.result?.length || 0} results`
          : `Search failed: ${searchResult.error}`,
        details: searchResult
      });

      // Step 6: Test unified_search function without user filter
      const noFilterResult = await testDatabaseFunction('unified_search', {
        query_embedding: testEmbedding,
        source_types: ['receipt'],
        content_types: null,
        similarity_threshold: 0.1,
        match_count: 10,
        user_filter: null,
        team_filter: null,
        language_filter: null
      });

      addResult({
        step: 'Search Function Test (no user filter)',
        status: noFilterResult.testPassed ? 'success' : 'error',
        message: noFilterResult.testPassed 
          ? `Search returned ${noFilterResult.result?.length || 0} results`
          : `Search failed: ${noFilterResult.error}`,
        details: noFilterResult
      });

      // Step 7: Run user embeddings and search test
      const userSearchTest = await testUserEmbeddingsAndSearch();
      addResult({
        step: 'User Embeddings & Search Test',
        status: userSearchTest.error ? 'error' : 'success',
        message: userSearchTest.error
          ? `Test failed: ${userSearchTest.error}`
          : `User embeddings: ${userSearchTest.userEmbeddingsCount}, Search tests completed`,
        details: userSearchTest
      });

      // Step 8: Run comprehensive database test
      const dbTest = await runDatabaseReadinessTest();
      addResult({
        step: 'Database Readiness Test',
        status: dbTest.ready ? 'success' : 'warning',
        message: dbTest.ready
          ? 'All database functions are ready'
          : `Issues found: ${dbTest.issues.join(', ')}`,
        details: dbTest
      });

    } catch (error) {
      addResult({
        step: 'Debug Process',
        status: 'error',
        message: `Debug process failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const getStatusIcon = (status: DebugResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: DebugResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Functionality Debugger
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          This tool helps diagnose why the AI chat search is returning zero results.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runSearchDebug} 
          disabled={isDebugging}
          className="w-full"
        >
          {isDebugging ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Debug Tests...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Run Search Debug
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Debug Results:</h3>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.step}</span>
                  </div>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {result.message}
                </p>
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View Details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
