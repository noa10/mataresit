import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  FileText,
  Database,
  Webhook,
  Activity,
  TestTube,
  Trash2,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  test_name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  suite_name: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  tests: TestResult[];
}

interface TestResults {
  success: boolean;
  summary: {
    total_suites: number;
    total_tests: number;
    passed: number;
    failed: number;
    skipped: number;
    success_rate: number;
    duration_ms: number;
  };
  test_suites: TestSuite[];
  timestamp: string;
}

export function BillingTestSuite() {
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testConfig, setTestConfig] = useState({
    test_user_id: 'test-user-' + Date.now(),
    include_cleanup: true,
    generate_test_data: true
  });

  const runAllTests = async () => {
    setIsRunning(true);
    setCurrentTest('Initializing test suite...');
    
    try {
      // Generate test data if requested
      if (testConfig.generate_test_data) {
        setCurrentTest('Generating test data...');
        await supabase.functions.invoke('billing-test-suite', {
          body: {
            action: 'generate_test_data',
            test_config: testConfig
          }
        });
      }

      // Run all tests
      setCurrentTest('Running comprehensive test suite...');
      const { data, error } = await supabase.functions.invoke('billing-test-suite', {
        body: {
          action: 'run_all_tests',
          test_config: testConfig
        }
      });

      if (error) {
        throw error;
      }

      setTestResults(data);
      
      if (data.success) {
        toast.success(`All tests completed! ${data.summary.passed}/${data.summary.total_tests} tests passed`);
      } else {
        toast.error(`Tests completed with failures: ${data.summary.failed} failed tests`);
      }

      // Cleanup test data if requested
      if (testConfig.include_cleanup) {
        setCurrentTest('Cleaning up test data...');
        await supabase.functions.invoke('billing-test-suite', {
          body: {
            action: 'cleanup_test_data',
            test_config: testConfig
          }
        });
      }

    } catch (error) {
      console.error('Error running test suite:', error);
      toast.error('Failed to run test suite: ' + error.message);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const runSpecificTest = async (testType: string) => {
    setIsRunning(true);
    setCurrentTest(`Running ${testType} tests...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('billing-test-suite', {
        body: {
          action: testType,
          test_config: testConfig
        }
      });

      if (error) {
        throw error;
      }

      toast.success(`${testType} tests completed successfully`);
      console.log(`${testType} results:`, data);
      
    } catch (error) {
      console.error(`Error running ${testType} tests:`, error);
      toast.error(`Failed to run ${testType} tests: ` + error.message);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'skipped': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'skipped': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const exportResults = () => {
    if (!testResults) return;
    
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-test-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing System Test Suite</h2>
          <p className="text-muted-foreground">
            Comprehensive testing and validation for all billing system components
          </p>
        </div>
        <div className="flex items-center gap-2">
          {testResults && (
            <Button variant="outline" size="sm" onClick={exportResults}>
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          )}
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="min-w-32"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run All Tests
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Configure test parameters and options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-user-id">Test User ID</Label>
              <Input
                id="test-user-id"
                value={testConfig.test_user_id}
                onChange={(e) => setTestConfig(prev => ({ ...prev, test_user_id: e.target.value }))}
                placeholder="test-user-id"
              />
            </div>
            <div className="space-y-2">
              <Label>Test Options</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testConfig.generate_test_data}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, generate_test_data: e.target.checked }))}
                  />
                  <span className="text-sm">Generate test data</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testConfig.include_cleanup}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, include_cleanup: e.target.checked }))}
                  />
                  <span className="text-sm">Cleanup after tests</span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Test Status */}
      {isRunning && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{currentTest}</span>
              <div className="flex items-center gap-2">
                <div className="animate-pulse h-2 w-32 bg-blue-200 rounded"></div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Individual Test Runners */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('test_email_templates')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Templates
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Auto-Renewal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('test_auto_renewal')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Renewal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('test_payment_processing')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Payments
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('test_webhook_processing')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Webhooks
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoring System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('test_monitoring_system')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Monitoring
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              End-to-End Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSpecificTest('validate_billing_workflow')}
              disabled={isRunning}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Workflow
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {testResults.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  Test Results
                </CardTitle>
                <CardDescription>
                  Completed at {new Date(testResults.timestamp).toLocaleString()}
                </CardDescription>
              </div>
              <Badge variant={testResults.success ? 'default' : 'destructive'}>
                {testResults.summary.success_rate}% Success Rate
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{testResults.summary.total_tests}</div>
                <div className="text-sm text-muted-foreground">Total Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{testResults.summary.passed}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{testResults.summary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{testResults.summary.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(testResults.summary.duration_ms / 1000)}s</div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">{testResults.summary.success_rate}%</span>
              </div>
              <Progress value={testResults.summary.success_rate} className="h-2" />
            </div>

            {/* Test Suites */}
            <Tabs defaultValue={testResults.test_suites[0]?.suite_name.toLowerCase().replace(/\s+/g, '_')} className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                {testResults.test_suites.map((suite) => (
                  <TabsTrigger 
                    key={suite.suite_name} 
                    value={suite.suite_name.toLowerCase().replace(/\s+/g, '_')}
                    className="text-xs"
                  >
                    {suite.suite_name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {testResults.test_suites.map((suite) => (
                <TabsContent 
                  key={suite.suite_name} 
                  value={suite.suite_name.toLowerCase().replace(/\s+/g, '_')}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{suite.suite_name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{suite.passed}/{suite.total_tests} passed</Badge>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(suite.duration_ms / 1000)}s
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {suite.tests.map((test, index) => (
                      <div key={index} className={cn("flex items-center justify-between p-3 rounded border", getStatusColor(test.status))}>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.status)}
                          <span className="font-medium">{test.test_name.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {test.duration_ms}ms
                          </span>
                          {test.error && (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
