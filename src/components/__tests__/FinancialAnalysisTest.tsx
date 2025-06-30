import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalysisResult {
  query: string;
  results: any[];
  metadata: any;
  timestamp: string;
  analysisType?: string;
}

export function FinancialAnalysisTest() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<AnalysisResult[]>([]);

  const financialQueries = [
    'How much did I spend on food this month?',
    'Show me my monthly spending trends',
    'Which merchants do I visit most often?',
    'Find any unusual or anomalous transactions',
    'What are my spending patterns by time of day?',
    'Break down my spending by category',
    'Show me my top 10 merchants by spending',
    'When do I spend the most money during the week?'
  ];

  const executeFinancialAnalysis = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      console.log('Testing financial analysis for query:', searchQuery);

      const { data, error } = await supabase.functions.invoke('unified-search', {
        body: {
          query: searchQuery,
          sources: ['receipt'],
          limit: 20,
          similarityThreshold: 0.1,
          includeMetadata: true
        }
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error(`Analysis failed: ${error.message}`);
        return;
      }

      console.log('Analysis response:', data);

      const result: AnalysisResult = {
        query: searchQuery,
        results: data.results || [],
        metadata: data.searchMetadata || {},
        timestamp: new Date().toISOString(),
        analysisType: data.searchMetadata?.analysisType
      };

      setTestResults(prev => [result, ...prev]);

      // Check if financial analysis was triggered
      if (data.searchMetadata?.llmPreprocessing?.intent === 'financial_analysis') {
        toast.success(`Financial analysis completed! Intent: ${data.searchMetadata.llmPreprocessing.intent}`);
      } else {
        toast.info(`Query processed with intent: ${data.searchMetadata?.llmPreprocessing?.intent || 'unknown'}`);
      }

      // Log analysis metadata
      if (data.searchMetadata?.financialAnalysis) {
        console.log('Financial analysis metadata:', {
          analysisType: data.searchMetadata.analysisType,
          resultsCount: data.results?.length,
          processingTime: data.searchMetadata.searchDuration
        });
      }

    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAnalysis = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }
    await executeFinancialAnalysis(query);
    setQuery('');
  };

  const handlePresetAnalysis = async (presetQuery: string) => {
    await executeFinancialAnalysis(presetQuery);
  };

  const renderAnalysisResults = (results: any[], analysisType?: string) => {
    if (!results || results.length === 0) {
      return <p className="text-muted-foreground text-sm">No results found</p>;
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {results.slice(0, 10).map((result: any, index: number) => (
          <div key={index} className="p-3 border rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {result.sourceType}
                  </Badge>
                  <span className="text-sm font-medium">
                    {result.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(result.similarity * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.description}
                </p>
              </div>
            </div>
            
            {/* Show financial analysis metadata if available */}
            {result.metadata && result.sourceType === 'financial_analysis' && (
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(result.metadata)
                    .filter(([key, value]) => key !== 'analysisType' && value !== null && value !== undefined)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-mono">
                          {typeof value === 'number' ? value.toFixed(2) : String(value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {results.length > 10 && (
          <p className="text-sm text-muted-foreground text-center">
            ... and {results.length - 10} more results
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial Pattern Analysis Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the enhanced financial analysis capabilities (Phase 2.3) with LLM intent detection and RPC function routing
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom Query Input */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your financial analysis query..."
              onKeyDown={(e) => e.key === 'Enter' && handleCustomAnalysis()}
            />
            <Button 
              onClick={handleCustomAnalysis}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>

          {/* Preset Financial Queries */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Test with financial analysis queries:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {financialQueries.map((testQuery) => (
                <Button
                  key={testQuery}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetAnalysis(testQuery)}
                  disabled={isLoading}
                  className="text-left justify-start h-auto p-3"
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
                {result.metadata.llmPreprocessing?.intent && (
                  <Badge variant={result.metadata.llmPreprocessing.intent === 'financial_analysis' ? 'default' : 'secondary'}>
                    {result.metadata.llmPreprocessing.intent}
                  </Badge>
                )}
                {result.analysisType && (
                  <Badge variant="outline">
                    {result.analysisType}
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
                  <strong>Intent:</strong> {result.metadata.llmPreprocessing?.intent || 'N/A'}
                </div>
                <div>
                  <strong>Confidence:</strong> {result.metadata.llmPreprocessing?.confidence?.toFixed(2) || 'N/A'}
                </div>
                {result.metadata.financialAnalysis && (
                  <div>
                    <strong>Analysis:</strong> Financial
                  </div>
                )}
              </div>
              {result.metadata.llmPreprocessing?.expandedQuery && (
                <div className="mt-2">
                  <strong>Expanded Query:</strong> {result.metadata.llmPreprocessing.expandedQuery}
                </div>
              )}
            </div>

            {/* Analysis Results */}
            <div>
              <h3 className="font-medium mb-3">
                {result.metadata.financialAnalysis ? 'Financial Analysis Results' : 'Search Results'}
              </h3>
              {renderAnalysisResults(result.results, result.analysisType)}
            </div>
          </CardContent>
        </Card>
      ))}

      {testResults.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No test results yet. Try one of the preset financial analysis queries or enter your own.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
