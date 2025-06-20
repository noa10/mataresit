/**
 * Embedding Repair System Test Component
 * Tests the comprehensive embedding audit and repair functionality
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Search,
  TrendingUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  auditEmbeddings,
  migrateEmbeddings,
  fixEmbeddingContent,
  generateMissingEmbeddings,
  processMissingEmbeddingsBatch
} from '@/lib/edge-function-utils';
import { EmbeddingRepairService, type EmbeddingAuditResult, type EmbeddingRepairProgress } from '@/lib/embedding-repair-service';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

export function EmbeddingRepairTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [auditData, setAuditData] = useState<EmbeddingAuditResult | null>(null);
  const [repairProgress, setRepairProgress] = useState<EmbeddingRepairProgress | null>(null);
  const [activeTab, setActiveTab] = useState('audit');

  const updateTestResult = (testName: string, result: TestResult) => {
    setTestResults(prev => ({
      ...prev,
      [testName]: result
    }));
  };

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setCurrentTest(testName);
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      updateTestResult(testName, {
        success: true,
        message: 'Test completed successfully',
        data: result,
        duration
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      updateTestResult(testName, {
        success: false,
        message: 'Test failed',
        error: errorMessage,
        duration
      });
      
      throw error;
    }
  };

  const runAuditTest = async () => {
    setIsRunning(true);
    toast.info('Starting embedding audit...');

    try {
      const result = await runTest('audit', async () => {
        const response = await auditEmbeddings();
        if (!response.success) {
          throw new Error(response.error || 'Audit failed');
        }
        return response;
      });

      setAuditData(result.audit);
      toast.success('Embedding audit completed successfully');
      
    } catch (error) {
      console.error('Audit test failed:', error);
      toast.error(`Audit failed: ${error.message}`);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runMigrationTest = async () => {
    setIsRunning(true);
    toast.info('Testing embedding migration...');

    try {
      await runTest('migration', async () => {
        const response = await migrateEmbeddings();
        if (!response.success) {
          throw new Error(response.error || 'Migration failed');
        }
        return response;
      });

      toast.success('Migration test completed');
      
    } catch (error) {
      console.error('Migration test failed:', error);
      toast.error(`Migration failed: ${error.message}`);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runContentFixTest = async () => {
    setIsRunning(true);
    toast.info('Testing content fix...');

    try {
      await runTest('content_fix', async () => {
        const response = await fixEmbeddingContent();
        if (!response.success) {
          throw new Error(response.error || 'Content fix failed');
        }
        return response;
      });

      toast.success('Content fix test completed');
      
    } catch (error) {
      console.error('Content fix test failed:', error);
      toast.error(`Content fix failed: ${error.message}`);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runBatchGenerationTest = async () => {
    setIsRunning(true);
    toast.info('Testing batch embedding generation...');

    try {
      await runTest('batch_generation', async () => {
        const response = await processMissingEmbeddingsBatch(5); // Small batch for testing
        if (!response.success) {
          throw new Error(response.error || 'Batch generation failed');
        }
        return response;
      });

      toast.success('Batch generation test completed');
      
    } catch (error) {
      console.error('Batch generation test failed:', error);
      toast.error(`Batch generation failed: ${error.message}`);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runFullRepairTest = async () => {
    setIsRunning(true);
    toast.info('Running full embedding repair process...');

    try {
      const repairService = new EmbeddingRepairService((progress) => {
        setRepairProgress(progress);
      });

      const result = await runTest('full_repair', async () => {
        return await repairService.repairEmbeddings();
      });

      toast.success(`Full repair completed: ${result.summary}`);
      
    } catch (error) {
      console.error('Full repair test failed:', error);
      toast.error(`Full repair failed: ${error.message}`);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
      setRepairProgress(null);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    
    try {
      await runAuditTest();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between tests
      
      await runMigrationTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runContentFixTest();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await runBatchGenerationTest();
      
      toast.success('All embedding repair tests completed!');
    } catch (error) {
      toast.error('Test suite failed - check individual test results');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (result?: TestResult) => {
    if (!result) return <AlertCircle className="h-4 w-4 text-gray-400" />;
    if (result.success) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (result?: TestResult) => {
    if (!result) return <Badge variant="secondary">Not Run</Badge>;
    if (result.success) return <Badge variant="default" className="bg-green-500">Success</Badge>;
    return <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Embedding Repair System Test
          </CardTitle>
          <CardDescription>
            Test the comprehensive embedding audit, migration, and repair functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              Run All Tests
            </Button>
            <Button 
              onClick={runAuditTest} 
              disabled={isRunning}
              variant="outline"
            >
              Test Audit
            </Button>
            <Button 
              onClick={runMigrationTest} 
              disabled={isRunning}
              variant="outline"
            >
              Test Migration
            </Button>
            <Button 
              onClick={runContentFixTest} 
              disabled={isRunning}
              variant="outline"
            >
              Test Content Fix
            </Button>
            <Button 
              onClick={runBatchGenerationTest} 
              disabled={isRunning}
              variant="outline"
            >
              Test Batch Generation
            </Button>
            <Button 
              onClick={runFullRepairTest} 
              disabled={isRunning}
              variant="outline"
            >
              Test Full Repair
            </Button>
          </div>

          {isRunning && (
            <Alert className="mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Running test: {currentTest}
                {repairProgress && (
                  <div className="mt-2">
                    <div className="text-sm font-medium">{repairProgress.message}</div>
                    <Progress value={repairProgress.progress} className="mt-1" />
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit">Audit Results</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {auditData ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditData.totalReceipts}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">With Unified Embeddings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{auditData.receiptsWithUnifiedEmbeddings}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Missing Embeddings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{auditData.receiptsMissingEmbeddings}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Migration Needed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {auditData.migrationNeeded ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">No</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Run the audit test to see embedding statistics
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-4">
            {[
              { key: 'audit', name: 'Embedding Audit', description: 'Analyze current embedding state' },
              { key: 'migration', name: 'Embedding Migration', description: 'Migrate old embeddings to unified format' },
              { key: 'content_fix', name: 'Content Fix', description: 'Repair embeddings with missing content' },
              { key: 'batch_generation', name: 'Batch Generation', description: 'Generate missing embeddings in batches' },
              { key: 'full_repair', name: 'Full Repair', description: 'Complete repair process' }
            ].map(test => {
              const result = testResults[test.key];
              return (
                <Card key={test.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {getStatusIcon(result)}
                        {test.name}
                      </CardTitle>
                      {getStatusBadge(result)}
                    </div>
                    <CardDescription>{test.description}</CardDescription>
                  </CardHeader>
                  {result && (
                    <CardContent>
                      <div className="text-sm">
                        <div className="font-medium">{result.message}</div>
                        {result.duration && (
                          <div className="text-gray-500">Duration: {result.duration}ms</div>
                        )}
                        {result.error && (
                          <div className="text-red-500 mt-1">Error: {result.error}</div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {Object.entries(testResults).map(([testName, result]) => (
            <Card key={testName}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getStatusIcon(result)}
                  {testName.replace('_', ' ').toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(result.data || result.error, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
