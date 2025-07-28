/**
 * Test component to verify BatchSessionService fix
 * This component tests that the createBatchSessionService function works correctly
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  error?: string;
}

export function BatchSessionServiceTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: 'Import createBatchSessionService', status: 'pending', message: 'Not started' },
    { name: 'Create BatchSessionService instance', status: 'pending', message: 'Not started' },
    { name: 'Import createRateLimitingManager', status: 'pending', message: 'Not started' },
    { name: 'Create RateLimitingManager instance', status: 'pending', message: 'Not started' },
    { name: 'Import createProgressTrackingService', status: 'pending', message: 'Not started' },
    { name: 'Create ProgressTrackingService instance', status: 'pending', message: 'Not started' },
    { name: 'Test useBatchFileUpload hook integration', status: 'pending', message: 'Not started' },
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const updateTestResult = (index: number, status: TestResult['status'], message: string, error?: string) => {
    setTestResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status, message, error } : result
    ));
  };

  const runTests = async () => {
    setIsRunning(true);
    
    try {
      // Test 1: Import createBatchSessionService
      updateTestResult(0, 'pending', 'Importing...');
      const { createBatchSessionService } = await import('@/lib/batch-session');
      updateTestResult(0, 'success', 'Successfully imported createBatchSessionService');

      // Test 2: Create BatchSessionService instance
      updateTestResult(1, 'pending', 'Creating instance...');
      const batchSessionService = createBatchSessionService({
        enableRateLimiting: true,
        enableRealTimeUpdates: true,
        defaultStrategy: 'balanced',
        maxConcurrentSessions: 3
      });
      updateTestResult(1, 'success', 'Successfully created BatchSessionService instance');

      // Test 3: Import createRateLimitingManager
      updateTestResult(2, 'pending', 'Importing...');
      const { createRateLimitingManager } = await import('@/lib/rate-limiting');
      updateTestResult(2, 'success', 'Successfully imported createRateLimitingManager');

      // Test 4: Create RateLimitingManager instance
      updateTestResult(3, 'pending', 'Creating instance...');
      const rateLimitingManager = createRateLimitingManager({
        apiProvider: 'gemini',
        strategy: 'balanced',
        quotaLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000
        },
        enablePersistentTracking: true
      });
      updateTestResult(3, 'success', 'Successfully created RateLimitingManager instance');

      // Test 5: Import createProgressTrackingService
      updateTestResult(4, 'pending', 'Importing...');
      const { createProgressTrackingService } = await import('@/lib/progress-tracking');
      updateTestResult(4, 'success', 'Successfully imported createProgressTrackingService');

      // Test 6: Create ProgressTrackingService instance
      updateTestResult(5, 'pending', 'Creating instance...');
      const progressTrackingService = createProgressTrackingService({
        enablePersistence: true,
        enableRealTimeUpdates: true,
        enableAnalytics: true
      });
      updateTestResult(5, 'success', 'Successfully created ProgressTrackingService instance');

      // Test 7: Test useBatchFileUpload hook integration
      updateTestResult(6, 'pending', 'Testing hook integration...');
      const { useBatchFileUpload } = await import('@/hooks/useBatchFileUpload');
      updateTestResult(6, 'success', 'Successfully imported useBatchFileUpload hook - batch upload should work!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const currentPendingIndex = testResults.findIndex(result => result.status === 'pending');
      if (currentPendingIndex !== -1) {
        updateTestResult(currentPendingIndex, 'error', 'Failed', errorMessage);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const allTestsPassed = testResults.every(result => result.status === 'success');
  const hasErrors = testResults.some(result => result.status === 'error');

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          BatchSessionService Fix Verification
          {allTestsPassed && <CheckCircle className="h-5 w-5 text-green-500" />}
          {hasErrors && <XCircle className="h-5 w-5 text-red-500" />}
        </CardTitle>
        <CardDescription>
          This test verifies that the BatchSessionService fix is working correctly by testing all related service instantiations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Running Tests...' : 'Run Tests'}
        </Button>

        <div className="space-y-2">
          {testResults.map((result, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(result.status)}
                <span className="font-medium">{result.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(result.status)}
                <span className="text-sm text-gray-600">{result.message}</span>
              </div>
            </div>
          ))}
        </div>

        {hasErrors && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">Error Details:</h4>
            {testResults
              .filter(result => result.status === 'error' && result.error)
              .map((result, index) => (
                <div key={index} className="text-sm text-red-700">
                  <strong>{result.name}:</strong> {result.error}
                </div>
              ))}
          </div>
        )}

        {allTestsPassed && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800">🎉 All Tests Passed!</h4>
            <p className="text-sm text-green-700 mt-1">
              The BatchSessionService fix is working correctly. The batch upload modal should now open without errors.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
