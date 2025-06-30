import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { callEdgeFunction, performUnifiedSearch } from '@/lib/edge-function-utils';

interface TestResult {
  method: string;
  query: string;
  success: boolean;
  resultCount: number;
  error?: string;
  timing: number;
  details?: any;
}

export function UnifiedSearchTester() {
  const [query, setQuery] = useState('receipt over $100');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (result: TestResult) => {
    setResults(prev => [result, ...prev]);
  };

  const testUnifiedSearch = async () => {
    setIsLoading(true);
    
    try {
      const startTime = Date.now();
      
      // Test the unified-search Edge Function using the performUnifiedSearch wrapper
      // This ensures proper parameter mapping and consistency
      const response = await performUnifiedSearch(query, {
        sources: ['receipts'], // Use frontend naming (plural) - will be mapped to backend naming
        limit: 10,
        similarityThreshold: 0.2
      });
      
      const timing = Date.now() - startTime;
      
      addResult({
        method: 'Unified Search Edge Function',
        query,
        success: response?.success || false,
        resultCount: response?.results?.length || 0,
        error: response?.error,
        timing,
        details: {
          totalResults: response?.totalResults,
          searchMetadata: response?.searchMetadata,
          pagination: response?.pagination
        }
      });
      
    } catch (error) {
      addResult({
        method: 'Unified Search Edge Function',
        query,
        success: false,
        resultCount: 0,
        error: error instanceof Error ? error.message : String(error),
        timing: 0
      });
    }
    
    setIsLoading(false);
  };

  const testSemanticSearch = async () => {
    setIsLoading(true);
    
    try {
      const startTime = Date.now();
      
      // Test the semantic-search Edge Function (fallback)
      const response = await callEdgeFunction('semantic-search', 'POST', {
        query,
        searchTarget: 'receipts',
        limit: 10,
        offset: 0
      });
      
      const timing = Date.now() - startTime;
      
      addResult({
        method: 'Semantic Search Edge Function (Fallback)',
        query,
        success: response?.success || false,
        resultCount: response?.results?.receipts?.length || 0,
        error: response?.error,
        timing,
        details: response
      });
      
    } catch (error) {
      addResult({
        method: 'Semantic Search Edge Function (Fallback)',
        query,
        success: false,
        resultCount: 0,
        error: error instanceof Error ? error.message : String(error),
        timing: 0
      });
    }
    
    setIsLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Unified Search RLS Fix Tester</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the unified search functionality to verify the RLS bypass fix is working.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search query..."
              className="flex-1"
            />
            <Button 
              onClick={testUnifiedSearch} 
              disabled={isLoading || !query.trim()}
            >
              Test Unified Search
            </Button>
            <Button 
              onClick={testSemanticSearch} 
              disabled={isLoading || !query.trim()}
              variant="outline"
            >
              Test Fallback
            </Button>
            <Button 
              onClick={clearResults} 
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
          </div>
          
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Testing search...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Results</h3>
          {results.map((result, index) => (
            <Card key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{result.method}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? 'Success' : 'Failed'}
                    </Badge>
                    <Badge variant="outline">{result.timing}ms</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Query: "{result.query}"</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Results:</span>
                    <Badge variant={result.resultCount > 0 ? 'default' : 'secondary'}>
                      {result.resultCount} found
                    </Badge>
                  </div>
                  
                  {result.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                  
                  {result.details && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">View Details</summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto text-xs">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Expected Behavior:</h4>
          <ul className="text-sm space-y-1 text-blue-800">
            <li><strong>Before Fix:</strong> Unified Search returns 0 results due to RLS blocking access</li>
            <li><strong>After Fix:</strong> Unified Search returns actual results while maintaining security</li>
            <li><strong>Fallback:</strong> Semantic Search should work in both cases (uses different approach)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
