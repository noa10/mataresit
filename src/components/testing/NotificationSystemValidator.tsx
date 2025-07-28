import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  TestTube,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotificationContext } from '@/contexts/PushNotificationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { 
  runAllNotificationTests, 
  displayTestResults, 
  testBasicNotification,
  NotificationTestResult 
} from '@/utils/notificationTestUtils';

export function NotificationSystemValidator() {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<NotificationTestResult[]>([]);
  const [lastTestRun, setLastTestRun] = useState<Date | null>(null);

  const pushContext = usePushNotificationContext();
  const notificationContext = useNotifications();

  const runTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runAllNotificationTests(pushContext, notificationContext);
      setTestResults(results);
      setLastTestRun(new Date());
      displayTestResults(results);
    } catch (error) {
      console.error('Error running notification tests:', error);
      toast.error('Failed to run notification tests');
    } finally {
      setIsRunningTests(false);
    }
  };

  const testShowTestNotification = async () => {
    try {
      await pushContext.showTestNotification();
      toast.success('Test notification method called successfully');
    } catch (error) {
      console.error('Test notification failed:', error);
      toast.error(`Test notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testBasicBrowserNotification = async () => {
    try {
      const result = await testBasicNotification();
      if (result.success) {
        toast.success('Basic browser notification displayed');
      } else {
        toast.error(`Basic notification failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Basic notification test failed:', error);
      toast.error('Basic notification test failed');
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"} className="text-xs">
        {success ? "Pass" : "Fail"}
      </Badge>
    );
  };

  const passedTests = testResults.filter(r => r.success).length;
  const totalTests = testResults.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TestTube className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle>Notification System Validator</CardTitle>
            <CardDescription>
              Test and validate the notification system functionality
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Status */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">System Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="text-sm">Push Notifications</span>
              </div>
              <Badge variant={pushContext.isSubscribed ? "default" : "secondary"}>
                {pushContext.isSubscribed ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span className="text-sm">Realtime Connection</span>
              </div>
              <Badge variant={notificationContext.isConnected ? "default" : "secondary"}>
                {notificationContext.isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Browser Permission</span>
              </div>
              <Badge variant={Notification.permission === 'granted' ? "default" : "destructive"}>
                {Notification.permission}
              </Badge>
            </div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Test Actions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={runTests}
              disabled={isRunningTests}
              className="w-full"
              variant="outline"
            >
              {isRunningTests ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Run All Tests
            </Button>

            <Button
              onClick={testShowTestNotification}
              disabled={!pushContext.isSubscribed}
              className="w-full"
              variant="outline"
            >
              <Bell className="h-4 w-4 mr-2" />
              Test Notification Method
            </Button>

            <Button
              onClick={testBasicBrowserNotification}
              disabled={Notification.permission !== 'granted'}
              className="w-full"
              variant="outline"
            >
              <Bell className="h-4 w-4 mr-2" />
              Test Browser Notification
            </Button>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Test Results</h4>
              <div className="flex items-center gap-2">
                <Badge variant={passedTests === totalTests ? "default" : "destructive"}>
                  {passedTests}/{totalTests} Passed
                </Badge>
                {lastTestRun && (
                  <span className="text-xs text-muted-foreground">
                    Last run: {lastTestRun.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.success)}
                    <span className="text-sm">{result.testName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.success)}
                  </div>
                </div>
              ))}
            </div>

            {passedTests !== totalTests && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some tests failed. Check the browser console for detailed error information.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Instructions</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>1. Click "Run All Tests" to validate the notification system</p>
            <p>2. Use "Test Notification Method" to test the showTestNotification function</p>
            <p>3. Use "Test Browser Notification" to test basic browser notification display</p>
            <p>4. Check that realtime notifications work by uploading a receipt</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
