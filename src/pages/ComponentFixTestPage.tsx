/**
 * Test page to verify the component fixes work correctly
 * Tests both NotificationService.getConnectionState() and BatchUploadZone imports
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { notificationService } from '@/services/notificationService';

// Test both import methods for BatchUploadZone
import BatchUploadZoneDefault from '@/components/BatchUploadZone';
import { BatchUploadZone as BatchUploadZoneNamed } from '@/components/BatchUploadZone';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

export default function ComponentFixTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: 'NotificationService.getConnectionState()', status: 'pending', message: 'Not tested yet' },
    { name: 'BatchUploadZone Named Import', status: 'pending', message: 'Not tested yet' },
    { name: 'BatchUploadZone Default Import', status: 'pending', message: 'Not tested yet' },
    { name: 'Component Rendering Test', status: 'pending', message: 'Not tested yet' }
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const updateTestResult = (index: number, status: TestResult['status'], message: string, details?: any) => {
    setTestResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status, message, details } : result
    ));
  };

  const runTests = async () => {
    setIsRunning(true);
    
    // Test 1: NotificationService.getConnectionState()
    try {
      updateTestResult(0, 'pending', 'Testing getConnectionState() method...');
      const connectionState = notificationService.getConnectionState();
      
      if (connectionState && typeof connectionState === 'object') {
        updateTestResult(0, 'success', 'Method works correctly', {
          status: connectionState.status,
          activeChannels: connectionState.activeChannels,
          registeredSubscriptions: connectionState.registeredSubscriptions,
          pendingSubscriptions: connectionState.pendingSubscriptions,
          reconnectAttempts: connectionState.reconnectAttempts,
          subscriptionsCount: connectionState.subscriptions?.length || 0
        });
      } else {
        updateTestResult(0, 'error', 'Method returned invalid result');
      }
    } catch (error) {
      updateTestResult(0, 'error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test 2: BatchUploadZone Named Import
    try {
      updateTestResult(1, 'pending', 'Testing named import...');
      if (typeof BatchUploadZoneNamed === 'function') {
        updateTestResult(1, 'success', 'Named import { BatchUploadZone } works correctly', {
          componentType: typeof BatchUploadZoneNamed,
          hasName: BatchUploadZoneNamed.name
        });
      } else {
        updateTestResult(1, 'error', 'Named import failed - not a function');
      }
    } catch (error) {
      updateTestResult(1, 'error', `Named import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test 3: BatchUploadZone Default Import
    try {
      updateTestResult(2, 'pending', 'Testing default import...');
      if (typeof BatchUploadZoneDefault === 'function') {
        updateTestResult(2, 'success', 'Default import works correctly', {
          componentType: typeof BatchUploadZoneDefault,
          hasName: BatchUploadZoneDefault.name
        });
      } else {
        updateTestResult(2, 'error', 'Default import failed - not a function');
      }
    } catch (error) {
      updateTestResult(2, 'error', `Default import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test 4: Component Rendering Test
    try {
      updateTestResult(3, 'pending', 'Testing component rendering...');
      // Both imports should reference the same component
      if (BatchUploadZoneDefault === BatchUploadZoneNamed) {
        updateTestResult(3, 'success', 'Both imports reference the same component - exports are consistent');
      } else {
        updateTestResult(3, 'error', 'Imports reference different components - export inconsistency');
      }
    } catch (error) {
      updateTestResult(3, 'error', `Rendering test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      success: 'default' as const,
      error: 'destructive' as const,
      pending: 'secondary' as const
    };
    
    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  // Auto-run tests on component mount
  useEffect(() => {
    runTests();
  }, []);

  const allTestsPassed = testResults.every(result => result.status === 'success');
  const hasErrors = testResults.some(result => result.status === 'error');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Component Fix Verification
          </h1>
          <p className="text-gray-600">
            Testing the fixes for NotificationService and BatchUploadZone components
          </p>
        </div>

        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Component Fix Test Results
              {allTestsPassed && <CheckCircle className="h-5 w-5 text-green-500" />}
              {hasErrors && <XCircle className="h-5 w-5 text-red-500" />}
            </CardTitle>
            <CardDescription>
              Verification that both the duplicate method and missing export issues are resolved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button
                  onClick={runTests}
                  disabled={isRunning}
                  className="flex items-center gap-2"
                >
                  {isRunning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isRunning ? 'Running Tests...' : 'Run Tests Again'}
                </Button>
                
                <div className="text-sm text-gray-600">
                  {testResults.filter(r => r.status === 'success').length} / {testResults.length} tests passed
                </div>
              </div>

              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.name}</span>
                      </div>
                      {getStatusBadge(result.status)}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                    
                    {result.details && (
                      <div className="bg-gray-50 rounded p-2 text-xs">
                        <pre>{JSON.stringify(result.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
