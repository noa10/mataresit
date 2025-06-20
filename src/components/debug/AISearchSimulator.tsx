import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { semanticSearch } from '@/lib/ai-search';
import { callEdgeFunction } from '@/lib/edge-function-utils';

interface SimulationResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timing?: number;
}

export function AISearchSimulator() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('restaurant receipts over $50');
  const [results, setResults] = useState<SimulationResult[]>([]);

  const addResult = (result: SimulationResult) => {
    setResults(prev => [...prev, result]);
  };

  const simulateAISearch = async () => {
    setIsSimulating(true);
    setResults([]);

    try {
      const startTime = Date.now();

      // Step 1: Test direct Edge Function call
      addResult({
        step: 'Direct Edge Function Test',
        status: 'success',
        message: 'Testing semantic-search Edge Function directly...',
        timing: 0
      });

      try {
        const edgeFunctionStart = Date.now();
        const edgeResult = await callEdgeFunction('semantic-search', 'POST', {
          query: searchQuery,
          contentType: 'full_text',
          limit: 10,
          offset: 0,
          searchTarget: 'receipts'
        });
        const edgeFunctionTime = Date.now() - edgeFunctionStart;

        addResult({
          step: 'Edge Function Call',
          status: edgeResult?.success ? 'success' : 'error',
          message: edgeResult?.success 
            ? `Edge function returned ${edgeResult?.results?.receipts?.length || 0} receipts`
            : `Edge function failed: ${edgeResult?.error || 'Unknown error'}`,
          details: {
            success: edgeResult?.success,
            resultCount: edgeResult?.results?.receipts?.length || 0,
            searchParams: edgeResult?.searchParams,
            error: edgeResult?.error
          },
          timing: edgeFunctionTime
        });
      } catch (edgeError) {
        addResult({
          step: 'Edge Function Call',
          status: 'error',
          message: `Edge function error: ${edgeError instanceof Error ? edgeError.message : String(edgeError)}`,
          details: edgeError
        });
      }

      // Step 2: Test AI search function (what the chat actually uses)
      addResult({
        step: 'AI Search Function Test',
        status: 'success',
        message: 'Testing semanticSearch function (used by AI chat)...',
        timing: 0
      });

      try {
        const aiSearchStart = Date.now();
        const aiResult = await semanticSearch({
          query: searchQuery,
          isNaturalLanguage: true,
          limit: 10,
          offset: 0,
          searchTarget: 'all'
        });
        const aiSearchTime = Date.now() - aiSearchStart;

        addResult({
          step: 'AI Search Function',
          status: (aiResult?.results?.length || 0) > 0 ? 'success' : 'warning',
          message: `AI search returned ${aiResult?.results?.length || 0} total results (${aiResult?.receipts?.length || 0} receipts, ${aiResult?.lineItems?.length || 0} line items)`,
          details: {
            totalResults: aiResult?.results?.length || 0,
            receipts: aiResult?.receipts?.length || 0,
            lineItems: aiResult?.lineItems?.length || 0,
            searchParams: aiResult?.searchParams,
            sampleResults: aiResult?.results?.slice(0, 3)
          },
          timing: aiSearchTime
        });
      } catch (aiError) {
        addResult({
          step: 'AI Search Function',
          status: 'error',
          message: `AI search error: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
          details: aiError
        });
      }

      // Step 3: Test with different search targets
      const searchTargets = ['receipts', 'line_items', 'all'];
      for (const target of searchTargets) {
        try {
          const targetStart = Date.now();
          const targetResult = await semanticSearch({
            query: searchQuery,
            searchTarget: target as any,
            limit: 5,
            offset: 0
          });
          const targetTime = Date.now() - targetStart;

          addResult({
            step: `Search Target: ${target}`,
            status: (targetResult?.results?.length || 0) > 0 ? 'success' : 'warning',
            message: `Target '${target}' returned ${targetResult?.results?.length || 0} results`,
            details: {
              target,
              resultCount: targetResult?.results?.length || 0,
              receipts: targetResult?.receipts?.length || 0,
              lineItems: targetResult?.lineItems?.length || 0
            },
            timing: targetTime
          });
        } catch (targetError) {
          addResult({
            step: `Search Target: ${target}`,
            status: 'error',
            message: `Target '${target}' failed: ${targetError instanceof Error ? targetError.message : String(targetError)}`,
            details: targetError
          });
        }
      }

      const totalTime = Date.now() - startTime;
      addResult({
        step: 'Simulation Complete',
        status: 'success',
        message: `Total simulation time: ${totalTime}ms`,
        timing: totalTime
      });

    } catch (error) {
      addResult({
        step: 'Simulation Error',
        status: 'error',
        message: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const getStatusIcon = (status: SimulationResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: SimulationResult['status']) => {
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
          <MessageSquare className="h-5 w-5" />
          AI Search Simulator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Simulate exactly what the AI chat search does to identify issues.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter search query (e.g., 'restaurant receipts over $50')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isSimulating}
          />
          <Button 
            onClick={simulateAISearch} 
            disabled={isSimulating || !searchQuery.trim()}
          >
            {isSimulating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Simulate AI Search
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Simulation Results:</h3>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.step}</span>
                    {result.timing !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        ({result.timing}ms)
                      </span>
                    )}
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
                    <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-40">
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
