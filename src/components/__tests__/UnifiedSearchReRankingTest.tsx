import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TestResult {
  query: string;
  results: any[];
  metadata: any;
  timestamp: string;
}

export function UnifiedSearchReRankingTest() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const testQueries = [
    'McDonald\'s receipts',
    'expensive purchases',
    'food and dining',
    'recent transactions',
    'business expenses'
  ];

  const executeSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      console.log('Testing unified search with re-ranking for query:', searchQuery);

      const { data, error } = await supabase.functions.invoke('unified-search', {
        body: {
          query: searchQuery,
          sources: ['receipt', 'business_directory', 'custom_category'],
          limit: 10,
          similarityThreshold: 0.1,
          includeMetadata: true
        }
      });

      if (error) {
        console.error('Search error:', error);
        toast.error(`Search failed: ${error.message}`);
        return;
      }

      console.log('Search response:', data);

      const result: TestResult = {
        query: searchQuery,
        results: data.results || [],
        metadata: data.searchMetadata || {},
        timestamp: new Date().toISOString()
      };

      setTestResults(prev => [result, ...prev]);

      // Log re-ranking information
      if (data.searchMetadata?.reRanking) {
        const reRanking = data.searchMetadata.reRanking;
        console.log('Re-ranking applied:', {
          applied: reRanking.applied,
          modelUsed: reRanking.modelUsed,
          processingTime: reRanking.processingTime,
          candidatesCount: reRanking.candidatesCount,
          confidenceLevel: reRanking.confidenceLevel
        });
        
        toast.success(`Search completed with re-ranking (${reRanking.confidenceLevel} confidence)`);
      } else {
        toast.success('Search completed without re-ranking');
      }

      // Log LLM preprocessing information
      if (data.searchMetadata?.llmPreprocessing) {
        const preprocessing = data.searchMetadata.llmPreprocessing;
        console.log('LLM preprocessing:', {
          intent: preprocessing.intent,
          expandedQuery: preprocessing.expandedQuery,
          confidence: preprocessing.confidence,
          entities: preprocessing.entities
        });
      }

    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    await executeSearch(query);
    setQuery('');
  };

  const handlePresetSearch = async (presetQuery: string) => {
    await executeSearch(presetQuery);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Unified Search Re-ranking Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the enhanced unified search with LLM preprocessing and re-ranking layer
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom Query Input */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSearch()}
            />
            <Button 
              onClick={handleCustomSearch}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Preset Queries */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Test with preset queries:</p>
            <div className="flex flex-wrap gap-2">
              {testQueries.map((testQuery) => (
                <Button
                  key={testQuery}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetSearch(testQuery)}
                  disabled={isLoading}
                >
                  {testQuery}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.map((result, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Query: "{result.query}"</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {result.results.length} results
                </Badge>
                {result.metadata.reRanking?.applied && (
                  <Badge variant="secondary">
                    Re-ranked ({result.metadata.reRanking.confidenceLevel})
                  </Badge>
                )}
                {result.metadata.llmPreprocessing && (
                  <Badge variant="outline">
                    LLM: {result.metadata.llmPreprocessing.intent}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(result.timestamp).toLocaleString()}
            </p>
          </CardHeader>
          <CardContent>
            {/* Metadata Summary */}
            <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <strong>Duration:</strong> {result.metadata.searchDuration}ms
                </div>
                <div>
                  <strong>Model:</strong> {result.metadata.modelUsed || 'N/A'}
                </div>
                {result.metadata.llmPreprocessing && (
                  <div>
                    <strong>Expanded:</strong> {result.metadata.llmPreprocessing.expandedQuery}
                  </div>
                )}
                {result.metadata.reRanking && (
                  <div>
                    <strong>Re-ranking:</strong> {result.metadata.reRanking.processingTime}ms
                  </div>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="space-y-2">
              {result.results.slice(0, 5).map((searchResult: any, resultIndex: number) => (
                <div key={resultIndex} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {searchResult.sourceType}
                        </Badge>
                        <span className="text-sm font-medium">
                          {searchResult.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(searchResult.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {searchResult.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {result.results.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... and {result.results.length - 5} more results
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {testResults.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No test results yet. Try searching with one of the preset queries or enter your own.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
