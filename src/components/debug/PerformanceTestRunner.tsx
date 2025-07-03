/**
 * Performance Test Runner Component
 * UI for running and displaying performance test results
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { PerformanceTestSuite, PerformanceMetrics } from '@/utils/performanceTestSuite';

interface TestResult {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageDuration: number;
    under3Seconds: boolean;
  };
  metrics: PerformanceMetrics[];
  recommendations: string[];
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  totalTestTime: number;
}

export function PerformanceTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestResult | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);

    try {
      const testSuite = new PerformanceTestSuite();
      
      // Simulate progress updates
      const tests = [
        'RPC Function Performance',
        'React Query Cache Performance', 
        'Data Accuracy Validation',
        'Realistic Data Volume Test'
      ];

      for (let i = 0; i < tests.length; i++) {
        setCurrentTest(tests[i]);
        setProgress((i / tests.length) * 100);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Run actual tests
      const testResults = await testSuite.runCompleteTestSuite();
      
      setProgress(100);
      setResults(testResults);
      setCurrentTest('Complete');

    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getPerformanceBadge = (duration: number) => {
    if (duration < 1000) return <Badge className="bg-green-500">Excellent</Badge>;
    if (duration < 2000) return <Badge className="bg-blue-500">Good</Badge>;
    if (duration < 3000) return <Badge className="bg-yellow-500">Acceptable</Badge>;
    return <Badge variant="destructive">Needs Optimization</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Test Runner Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Test Suite
          </CardTitle>
          <CardDescription>
            Validate usage statistics loading performance and data accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Running Tests...' : 'Run Performance Tests'}
            </Button>
            
            {isRunning && (
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Running: {currentTest}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Test Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {results.summary.passedTests}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {results.summary.failedTests}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {results.summary.averageDuration.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {results.summary.under3Seconds ? '✅' : '❌'}
                  </div>
                  <div className="text-sm text-muted-foreground">Under 3s</div>
                </div>
              </div>

              {/* Performance Status */}
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Overall Performance:</span>
                  {getPerformanceBadge(results.summary.averageDuration)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Target: Under 3 seconds | Achieved: {results.summary.averageDuration.toFixed(2)}ms
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Individual Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.metrics.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(metric.success)}
                      <div>
                        <div className="font-medium">{metric.testName}</div>
                        {metric.error && (
                          <div className="text-sm text-red-600">{metric.error}</div>
                        )}
                        {metric.metadata && (
                          <div className="text-xs text-muted-foreground">
                            {Object.entries(metric.metadata).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-sm">{metric.duration}ms</div>
                        {metric.cacheHit !== undefined && (
                          <Badge variant={metric.cacheHit ? "default" : "secondary"} className="text-xs">
                            {metric.cacheHit ? 'Cache Hit' : 'Fresh'}
                          </Badge>
                        )}
                      </div>
                      {getPerformanceBadge(metric.duration)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Validation Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Data Validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(results.validation.isValid)}
                  <span className="font-medium">
                    Data Accuracy: {results.validation.isValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>

                {results.validation.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-1">Validation Errors:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {results.validation.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {results.validation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium mb-1">Validation Warnings:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {results.validation.warnings.map((warning, index) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.recommendations.map((recommendation, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <div className="text-sm">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Test Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Test Time:</span>
                  <span className="ml-2 font-mono">{results.totalTestTime}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tests Run:</span>
                  <span className="ml-2 font-mono">{results.summary.totalTests}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="ml-2 font-mono">
                    {((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Performance Target:</span>
                  <span className="ml-2 font-mono">
                    {results.summary.under3Seconds ? 'Met' : 'Not Met'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
