import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { runComprehensiveSearchTests, SearchParameterTestResult } from '@/lib/search-parameter-tester';

export function SearchParameterTester() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runTests = async () => {
    setIsTesting(true);
    setTestResults(null);

    try {
      const results = await runComprehensiveSearchTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test error:', error);
      setTestResults({
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (test: SearchParameterTestResult) => {
    if (!test.success) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (test.resultCount > 0) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusColor = (test: SearchParameterTestResult) => {
    if (!test.success) {
      return 'bg-red-100 text-red-800';
    }
    if (test.resultCount > 0) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (test: SearchParameterTestResult) => {
    if (!test.success) {
      return 'Error';
    }
    if (test.resultCount > 0) {
      return `${test.resultCount} results`;
    }
    return 'No results';
  };

  const renderTestSection = (title: string, tests: SearchParameterTestResult[]) => (
    <div className="space-y-3">
      <h4 className="font-semibold text-lg">{title}</h4>
      {tests.map((test, index) => (
        <div key={index} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(test)}
              <span className="font-medium">{test.testName}</span>
              <span className="text-xs text-muted-foreground">
                ({test.timing}ms)
              </span>
            </div>
            <Badge className={getStatusColor(test)}>
              {getStatusText(test)}
            </Badge>
          </div>
          
          {test.error && (
            <p className="text-sm text-red-600 mb-2">
              Error: {test.error}
            </p>
          )}
          
          <div className="text-xs text-muted-foreground">
            Parameters: {JSON.stringify(test.parameters)}
          </div>
          
          {test.details && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                View Details
              </summary>
              <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-32">
                {JSON.stringify(test.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Search Parameter Tester
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comprehensive testing of search function parameters to identify the exact cause of zero results.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTests} 
          disabled={isTesting}
          className="w-full"
        >
          {isTesting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Comprehensive Tests...
            </>
          ) : (
            <>
              <Settings className="h-4 w-4 mr-2" />
              Run Search Parameter Tests
            </>
          )}
        </Button>

        {testResults?.error && (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <h3 className="font-semibold text-red-800 mb-2">Test Error</h3>
            <p className="text-red-700">{testResults.error}</p>
          </div>
        )}

        {testResults && !testResults.error && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-blue-800 mb-2">Test Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total Tests:</span>
                  <div className="text-lg font-bold text-blue-600">
                    {testResults.summary.totalTests}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Successful:</span>
                  <div className="text-lg font-bold text-green-600">
                    {testResults.summary.successfulTests}
                  </div>
                </div>
                <div>
                  <span className="font-medium">With Results:</span>
                  <div className="text-lg font-bold text-purple-600">
                    {testResults.summary.testsWithResults}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Avg Time:</span>
                  <div className="text-lg font-bold text-orange-600">
                    {Math.round(testResults.summary.avgTiming)}ms
                  </div>
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div className="space-y-6">
              {renderTestSection('Real Embedding Tests', testResults.realEmbeddingTests)}
              {renderTestSection('Similarity Threshold Tests', testResults.thresholdTests)}
              {renderTestSection('User Filtering Tests', testResults.userFilterTests)}
            </div>

            {/* Key Insights */}
            <div className="border rounded-lg p-4 bg-yellow-50">
              <h3 className="font-semibold text-yellow-800 mb-2">Key Insights</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {testResults.summary.testsWithResults === 0 && (
                  <li>• No tests returned results - this indicates a fundamental issue with search parameters or data</li>
                )}
                {testResults.realEmbeddingTests.some(t => t.success && t.resultCount > 0) && (
                  <li>• Real embedding tests work - the issue may be with query embedding generation</li>
                )}
                {testResults.userFilterTests.some(t => t.testName.includes('No User Filter') && t.resultCount > 0) && (
                  <li>• Search works without user filter - user filtering may be too restrictive</li>
                )}
                {testResults.thresholdTests.some(t => t.resultCount > 0) && (
                  <li>• Some similarity thresholds work - threshold tuning may be needed</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
