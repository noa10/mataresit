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
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  auditEmbeddings,
  migrateEmbeddings,
  fixEmbeddingContent,
  processMissingEmbeddingsBatch
} from '@/lib/edge-function-utils';
import { EmbeddingRepairService, type EmbeddingAuditResult, type EmbeddingRepairProgress } from '@/lib/embedding-repair-service';
import { useAdminTranslation } from '@/contexts/LanguageContext';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

export function EmbeddingRepairTest() {
  const { t } = useAdminTranslation();
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

  const runTest = async (testKey: string, testFunction: () => Promise<any>) => {
    setCurrentTest(testKey);
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      updateTestResult(testKey, {
        success: true,
        message: t('diagnostics.embeddingRepair.success'),
        data: result,
        duration
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      updateTestResult(testKey, {
        success: false,
        message: t('diagnostics.embeddingRepair.failed'),
        error: errorMessage,
        duration
      });
      
      throw error;
    }
  };

  const testLabel = (testKey: string) =>
    t(`diagnostics.embeddingRepair.tests.${testKey}.name`, { defaultValue: testKey });

  const runAuditTest = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingRepair.toasts.startingAudit'));

    try {
      const result = await runTest('audit', async () => {
        const response = await auditEmbeddings();
        if (!response.success) {
          throw new Error(
            response.error || t('diagnostics.embeddingRepair.errors.auditFailed')
          );
        }
        return response;
      });

      setAuditData(result.audit);
      toast.success(t('diagnostics.embeddingRepair.toasts.auditCompleted'));
      
    } catch (error) {
      console.error('Audit test failed:', error);
      toast.error(
        t('diagnostics.embeddingRepair.toasts.auditFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runMigrationTest = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingRepair.toasts.testingMigration'));

    try {
      await runTest('migration', async () => {
        const response = await migrateEmbeddings();
        if (!response.success) {
          throw new Error(
            response.error || t('diagnostics.embeddingRepair.errors.migrationFailed')
          );
        }
        return response;
      });

      toast.success(t('diagnostics.embeddingRepair.toasts.migrationCompleted'));
      
    } catch (error) {
      console.error('Migration test failed:', error);
      toast.error(
        t('diagnostics.embeddingRepair.toasts.migrationFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runContentFixTest = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingRepair.toasts.testingContentFix'));

    try {
      await runTest('content_fix', async () => {
        const response = await fixEmbeddingContent();
        if (!response.success) {
          throw new Error(
            response.error || t('diagnostics.embeddingRepair.errors.contentFixFailed')
          );
        }
        return response;
      });

      toast.success(t('diagnostics.embeddingRepair.toasts.contentFixCompleted'));
      
    } catch (error) {
      console.error('Content fix test failed:', error);
      toast.error(
        t('diagnostics.embeddingRepair.toasts.contentFixFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runBatchGenerationTest = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingRepair.toasts.testingBatch'));

    try {
      await runTest('batch_generation', async () => {
        const response = await processMissingEmbeddingsBatch(5); // Small batch for testing
        if (!response.success) {
          throw new Error(
            response.error || t('diagnostics.embeddingRepair.errors.batchFailed')
          );
        }
        return response;
      });

      toast.success(t('diagnostics.embeddingRepair.toasts.batchCompleted'));
      
    } catch (error) {
      console.error('Batch generation test failed:', error);
      toast.error(
        t('diagnostics.embeddingRepair.toasts.batchFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runFullRepairTest = async () => {
    setIsRunning(true);
    toast.info(t('diagnostics.embeddingRepair.toasts.runningFull'));

    try {
      const repairService = new EmbeddingRepairService((progress) => {
        setRepairProgress(progress);
      });

      const result = await runTest('full_repair', async () => {
        return await repairService.repairEmbeddings();
      });

      toast.success(
        t('diagnostics.embeddingRepair.toasts.fullCompleted', {
          summary: result.summary,
        })
      );
      
    } catch (error) {
      console.error('Full repair test failed:', error);
      toast.error(
        t('diagnostics.embeddingRepair.toasts.fullFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
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
      
      toast.success(t('diagnostics.embeddingRepair.toasts.allCompleted'));
    } catch (error) {
      toast.error(t('diagnostics.embeddingRepair.toasts.suiteFailed'));
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
    if (!result) return <Badge variant="secondary">{t('diagnostics.embeddingRepair.notRun')}</Badge>;
    if (result.success)
      return (
        <Badge variant="default" className="bg-green-500">
          {t('diagnostics.embeddingRepair.success')}
        </Badge>
      );
    return <Badge variant="destructive">{t('diagnostics.embeddingRepair.failed')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('diagnostics.embeddingRepair.title')}
          </CardTitle>
          <CardDescription>
            {t('diagnostics.embeddingRepair.description')}
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
              {t('diagnostics.embeddingRepair.runAll')}
            </Button>
            <Button 
              onClick={runAuditTest} 
              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingRepair.testAudit')}
            </Button>
            <Button 
              onClick={runMigrationTest} 
              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingRepair.testMigration')}
            </Button>
            <Button 
              onClick={runContentFixTest} 
              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingRepair.testContentFix')}
            </Button>
            <Button 
              onClick={runBatchGenerationTest} 
              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingRepair.testBatchGeneration')}
            </Button>
            <Button 
              onClick={runFullRepairTest} 
              disabled={isRunning}
              variant="outline"
            >
              {t('diagnostics.embeddingRepair.testFullRepair')}
            </Button>
          </div>

          {isRunning && (
            <Alert className="mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {t('diagnostics.embeddingRepair.runningTest', {
                  test: testLabel(currentTest),
                })}
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
          <TabsTrigger value="audit">{t('diagnostics.embeddingRepair.auditResults')}</TabsTrigger>
          <TabsTrigger value="tests">{t('diagnostics.embeddingRepair.testResults')}</TabsTrigger>
          <TabsTrigger value="details">{t('diagnostics.embeddingRepair.details')}</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {auditData ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('diagnostics.embeddingRepair.totalReceipts')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditData.totalReceipts}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('diagnostics.embeddingRepair.withUnified')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{auditData.receiptsWithUnifiedEmbeddings}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('diagnostics.embeddingRepair.missingEmbeddings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{auditData.receiptsMissingEmbeddings}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('diagnostics.embeddingRepair.migrationNeeded')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {auditData.migrationNeeded ? (
                      <Badge variant="destructive">{t('diagnostics.embeddingRepair.yes')}</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">{t('diagnostics.embeddingRepair.no')}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('diagnostics.embeddingRepair.auditHint')}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-4">
            {[
              { key: 'audit' },
              { key: 'migration' },
              { key: 'content_fix' },
              { key: 'batch_generation' },
              { key: 'full_repair' }
            ].map(test => {
              const result = testResults[test.key];
              return (
                <Card key={test.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {getStatusIcon(result)}
                        {t(`diagnostics.embeddingRepair.tests.${test.key}.name`)}
                      </CardTitle>
                      {getStatusBadge(result)}
                    </div>
                    <CardDescription>
                      {t(`diagnostics.embeddingRepair.tests.${test.key}.description`)}
                    </CardDescription>
                  </CardHeader>
                  {result && (
                    <CardContent>
                      <div className="text-sm">
                        <div className="font-medium">
                          {t(
                            result.success
                              ? 'diagnostics.embeddingRepair.success'
                              : 'diagnostics.embeddingRepair.failed'
                          )}
                        </div>
                        {result.duration && (
                          <div className="text-gray-500">
                            {t('diagnostics.embeddingRepair.duration', {
                              duration: result.duration,
                            })}
                          </div>
                        )}
                        {result.error && (
                          <div className="text-red-500 mt-1">
                            {t('diagnostics.embeddingRepair.error')}: {result.error}
                          </div>
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
                  {testLabel(testName)}
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
