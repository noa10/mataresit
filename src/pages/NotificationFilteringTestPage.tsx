import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationFilteringTester } from '@/utils/notification-filtering-test';
import { usePushNotificationContext, usePushNotificationStatus } from '@/contexts/PushNotificationContext';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration?: number;
}

export function NotificationFilteringTestPage() {
  const { user } = useAuth();
  const pushContext = usePushNotificationContext();
  const pushStatus = usePushNotificationStatus();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    if (!user) {
      toast.error('Please log in to run tests');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    
    try {
      const startTime = Date.now();
      const tester = new NotificationFilteringTester(user.id);
      const results = await tester.runAllTests();
      const duration = Date.now() - startTime;

      // Add duration to results
      const resultsWithDuration = results.map(result => ({
        ...result,
        duration
      }));

      setTestResults(resultsWithDuration);

      const passedCount = results.filter(r => r.passed).length;
      const failedCount = results.filter(r => !r.passed).length;

      if (failedCount === 0) {
        toast.success(`🎉 All ${passedCount} tests passed! (${duration}ms)`);
      } else {
        toast.error(`⚠️ ${failedCount} tests failed, ${passedCount} passed (${duration}ms)`);
      }

    } catch (error) {
      console.error('Test execution error:', error);
      toast.error('Failed to run tests: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  };

  const resetTests = () => {
    setTestResults([]);
  };

  const enablePushNotifications = async () => {
    try {
      const permission = await pushContext.requestPermission();
      if (permission === 'granted') {
        await pushContext.subscribe();
        toast.success('Push notifications enabled successfully!');
      } else {
        toast.error('Push notification permission denied');
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      toast.error('Failed to enable push notifications');
    }
  };

  const getStatusIcon = (passed: boolean) => {
    if (passed) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (passed: boolean) => {
    if (passed) {
      return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    }
  };

  const summary = {
    total: testResults.length,
    passed: testResults.filter(r => r.passed).length,
    failed: testResults.filter(r => !r.passed).length,
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">Authentication Required</CardTitle>
            <CardDescription className="text-orange-700">
              Please log in to access the notification filtering tests.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Notification Filtering Tests</h1>
        <p className="text-gray-600">
          End-to-end testing of notification filtering based on user preferences
        </p>
      </div>

      {/* Push Notification Status */}
      {!pushStatus.isEnabled && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Push Notifications Required
            </CardTitle>
            <CardDescription className="text-orange-700">
              Push notifications must be enabled to test notification filtering properly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-orange-700">
                Current status: <strong>
                  {pushStatus.isBlocked ? 'Blocked' :
                   !pushStatus.isAvailable ? 'Not Available' : 'Disabled'}
                </strong>
              </p>

              {pushStatus.canEnable && (
                <Button
                  onClick={enablePushNotifications}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Enable Push Notifications
                </Button>
              )}

              {pushStatus.isBlocked && (
                <p className="text-xs text-orange-600">
                  Push notifications are blocked in your browser. Please enable them in your browser settings and refresh the page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Controls
          </CardTitle>
          <CardDescription>
            Run comprehensive tests to verify notification filtering functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={runTests}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Button>
            
            <Button
              onClick={resetTests}
              variant="outline"
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Test Summary */}
          {testResults.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Test Summary</h3>
              <div className="flex gap-4 text-sm">
                <span>Total: {summary.total}</span>
                <span className="text-green-600">Passed: {summary.passed}</span>
                <span className="text-red-600">Failed: {summary.failed}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Detailed results for each notification filtering test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.passed)}
                        <h3 className="font-medium text-gray-900">{result.testName}</h3>
                      </div>
                      {getStatusBadge(result.passed)}
                    </div>

                    {result.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}

                    {result.details && (
                      <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                        <strong>Details:</strong>
                        <pre className="mt-1 text-xs overflow-x-auto text-gray-600">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {result.duration && (
                      <div className="mt-2 text-xs text-gray-500">
                        Duration: {result.duration}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Test Information */}
      <Card>
        <CardHeader>
          <CardTitle>Test Information</CardTitle>
          <CardDescription>
            What these tests verify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2 text-gray-900">Processing Started Filtering</h3>
              <p className="text-sm text-gray-600">
                Verifies that <code className="bg-gray-100 px-1 rounded text-gray-800">receipt_processing_started</code> notifications are always filtered out
                and never appear in the notification panel, regardless of user preferences.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-gray-900">Duplicate Notification Prevention</h3>
              <p className="text-sm text-gray-600">
                Verifies that duplicate <code className="bg-gray-100 px-1 rounded text-gray-800">receipt_ready_for_review</code> notifications are no longer created.
                Only <code className="bg-gray-100 px-1 rounded text-gray-800">receipt_processing_completed</code> notifications should be created by the database trigger.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-gray-900">Push Disabled Global Filtering</h3>
              <p className="text-sm text-gray-600">
                Tests that when <code className="bg-gray-100 px-1 rounded text-gray-800">push_enabled</code> is false, all notifications are hidden from
                the notification panel.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-gray-900">Individual Type Filtering</h3>
              <p className="text-sm text-gray-600">
                Verifies that individual notification types can be disabled independently and are
                properly filtered based on user preferences.
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-gray-900">Server-Client Consistency</h3>
              <p className="text-sm text-gray-600">
                Ensures that server-side filtering logic in Edge Functions matches client-side
                filtering logic for consistent behavior.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
