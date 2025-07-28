/**
 * Comprehensive test component for batch upload workflow
 * Tests the complete end-to-end process and identifies error points
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Upload, FileText, Image, FileIcon } from 'lucide-react';
import { useBatchFileUpload } from '@/hooks/useBatchFileUpload';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message: string;
  error?: string;
  timestamp?: Date;
}

export function BatchUploadWorkflowTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [autoTestRun, setAutoTestRun] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize the batch upload hook to test its functionality
  const {
    batchUploads,
    isProcessing,
    isPaused,
    queuedUploads,
    activeUploads,
    completedUploads,
    failedUploads,
    totalProgress,
    addToBatchQueue,
    removeFromBatchQueue,
    clearBatchQueue,
    startBatchProcessing,
    pauseBatchProcessing,
    cancelUpload,
    retryUpload,
    progressMetrics,
    rateLimitStatus
  } = useBatchFileUpload({
    maxConcurrent: 2,
    enableRateLimiting: true,
    enableSessionTracking: true,
    enableProgressTracking: true
  });

  // Auto-run test when component mounts
  useEffect(() => {
    console.log('BatchUploadWorkflowTest component mounted');
    if (!autoTestRun) {
      console.log('Auto-running batch upload workflow test...');
      setAutoTestRun(true);
      setTimeout(() => {
        console.log('Starting auto workflow test...');
        runWorkflowTest();
      }, 2000);
    }
  }, []);

  const updateTestResult = (step: string, status: TestResult['status'], message: string, error?: string) => {
    setTestResults(prev => {
      const existingIndex = prev.findIndex(result => result.step === step);
      const newResult: TestResult = {
        step,
        status,
        message,
        error,
        timestamp: new Date()
      };
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newResult;
        return updated;
      } else {
        return [...prev, newResult];
      }
    });
  };

  const createTestFile = (name: string, type: string, size: number): File => {
    // Create a mock file for testing
    const content = new Array(size).fill('a').join('');
    const blob = new Blob([content], { type });
    return new File([blob], name, { type, lastModified: Date.now() });
  };

  const runWorkflowTest = async () => {
    console.log('🧪 Starting batch upload workflow test');
    setIsRunning(true);
    setTestResults([]);

    try {
      // Step 1: Test hook initialization
      updateTestResult('Hook Initialization', 'running', 'Testing useBatchFileUpload hook initialization...');
      
      if (typeof addToBatchQueue === 'function' && typeof startBatchProcessing === 'function') {
        updateTestResult('Hook Initialization', 'success', 'Hook initialized successfully with all required functions');
      } else {
        updateTestResult('Hook Initialization', 'error', 'Hook missing required functions', 'Missing critical functions');
        return;
      }

      // Step 2: Test file creation and validation
      updateTestResult('File Creation', 'running', 'Creating test files...');
      
      const testFiles = [
        createTestFile('test-receipt-1.jpg', 'image/jpeg', 1024 * 1024), // 1MB JPEG
        createTestFile('test-receipt-2.png', 'image/png', 2 * 1024 * 1024), // 2MB PNG
        createTestFile('test-receipt-3.pdf', 'application/pdf', 500 * 1024), // 500KB PDF
        createTestFile('invalid-file.txt', 'text/plain', 1024), // Invalid file type
        createTestFile('large-file.jpg', 'image/jpeg', 15 * 1024 * 1024) // 15MB - too large
      ];

      updateTestResult('File Creation', 'success', `Created ${testFiles.length} test files for validation`);

      // Step 3: Test file validation
      updateTestResult('File Validation', 'running', 'Testing file type and size validation...');
      
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      const validFiles = testFiles.filter(file => {
        const isValidType = validTypes.includes(file.type);
        const isValidSize = file.size <= maxSize;
        return isValidType && isValidSize;
      });

      if (validFiles.length === 3) { // Should be 3 valid files
        updateTestResult('File Validation', 'success', `Correctly identified ${validFiles.length} valid files out of ${testFiles.length}`);
      } else {
        updateTestResult('File Validation', 'error', `Expected 3 valid files, got ${validFiles.length}`, 'File validation logic error');
      }

      // Step 4: Test adding files to batch queue
      updateTestResult('Add to Queue', 'running', 'Testing addToBatchQueue function...');
      
      try {
        const result = await addToBatchQueue(validFiles);
        if (Array.isArray(result) && result.length > 0) {
          updateTestResult('Add to Queue', 'success', `Successfully added ${result.length} files to batch queue`);
        } else {
          updateTestResult('Add to Queue', 'error', 'addToBatchQueue returned empty or invalid result', JSON.stringify(result));
        }
      } catch (error) {
        updateTestResult('Add to Queue', 'error', 'Failed to add files to queue', error instanceof Error ? error.message : 'Unknown error');
      }

      // Step 5: Test queue state management
      updateTestResult('Queue State', 'running', 'Testing queue state management...');
      
      setTimeout(() => {
        if (batchUploads.length > 0) {
          updateTestResult('Queue State', 'success', `Queue contains ${batchUploads.length} uploads. Queued: ${queuedUploads.length}, Active: ${activeUploads.length}`);
        } else {
          updateTestResult('Queue State', 'error', 'No uploads found in queue after adding files', 'State management issue');
        }

        // Step 6: Test processing controls
        updateTestResult('Processing Controls', 'running', 'Testing batch processing controls...');
        
        if (queuedUploads.length > 0) {
          try {
            startBatchProcessing();
            updateTestResult('Processing Controls', 'success', 'Batch processing started successfully');
            
            // Monitor processing for a few seconds
            setTimeout(() => {
              if (isProcessing) {
                updateTestResult('Processing Monitor', 'success', `Processing active. Progress: ${totalProgress}%`);
                
                // Test pause functionality
                pauseBatchProcessing();
                updateTestResult('Pause Function', isPaused ? 'success' : 'error', isPaused ? 'Successfully paused processing' : 'Failed to pause processing');
              } else {
                updateTestResult('Processing Monitor', 'error', 'Processing not active after start', 'Processing state issue');
              }
            }, 2000);
            
          } catch (error) {
            updateTestResult('Processing Controls', 'error', 'Failed to start processing', error instanceof Error ? error.message : 'Unknown error');
          }
        } else {
          updateTestResult('Processing Controls', 'error', 'No queued uploads to process', 'Queue state issue');
        }
      }, 1000);

    } catch (error) {
      updateTestResult('Test Execution', 'error', 'Test execution failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTimeout(() => setIsRunning(false), 5000);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <AlertCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
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
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Batch Upload Workflow Test
        </CardTitle>
        <CardDescription>
          Comprehensive end-to-end testing of the batch upload functionality to identify error points and workflow issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <Button 
            onClick={runWorkflowTest} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <AlertCircle className="h-4 w-4 animate-pulse" />
                Running Tests...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Run Workflow Test
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setTestResults([])}
            disabled={isRunning}
          >
            Clear Results
          </Button>
        </div>

        {/* Current State Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{batchUploads.length}</div>
            <div className="text-sm text-gray-600">Total Uploads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{queuedUploads.length}</div>
            <div className="text-sm text-gray-600">Queued</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedUploads.length}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failedUploads.length}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Test Results</h3>
          {testResults.length === 0 ? (
            <p className="text-gray-500 italic">No tests run yet. Click "Run Workflow Test" to begin.</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <span className="font-medium">{result.step}</span>
                    <p className="text-sm text-gray-600">{result.message}</p>
                    {result.error && (
                      <p className="text-sm text-red-600 mt-1">Error: {result.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(result.status)}
                  {result.timestamp && (
                    <span className="text-xs text-gray-500">
                      {result.timestamp.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
