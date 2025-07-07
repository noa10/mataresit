import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Bell,
  Users,
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { notificationService } from '@/services/notificationService';
import { performanceMonitor } from '@/services/realTimePerformanceMonitor';
import { getReceiptSubscriptionStats } from '@/services/receiptService';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
  details?: any;
  timestamp: Date;
}

interface RealTimeTest {
  id: string;
  name: string;
  description: string;
  testFunction: () => Promise<void>;
  expectedBehavior: string;
}

export function RealTimeNotificationTester() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refreshNotifications,
    reconnect,
    getRateLimitingStats,
    resetRateLimiting
  } = useNotifications();

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [crossTabTestActive, setCrossTabTestActive] = useState(false);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const initialNotificationCount = useRef<number>(0);
  const testStartTime = useRef<number>(0);

  // Initialize test state
  useEffect(() => {
    initialNotificationCount.current = notifications.length;
  }, []);

  // Update performance data periodically
  useEffect(() => {
    const updatePerformanceData = () => {
      try {
        const current = performanceMonitor.getCurrentMetrics();
        const summary = performanceMonitor.getPerformanceSummary();
        const alerts = performanceMonitor.getActiveAlerts();
        const rateLimiting = getRateLimitingStats();
        const receipts = getReceiptSubscriptionStats();
        const notifications = notificationService.getConnectionState();

        setPerformanceData({
          current,
          summary,
          alerts,
          rateLimiting,
          receipts,
          notifications
        });
      } catch (error) {
        console.error('Error updating performance data:', error);
      }
    };

    updatePerformanceData(); // Initial load

    const interval = setInterval(updatePerformanceData, 2000);
    return () => clearInterval(interval);
  }, [getRateLimitingStats]);

  const startPerformanceMonitoring = () => {
    performanceMonitor.startMonitoring();
    setIsMonitoring(true);
    toast.success('Performance monitoring started');
  };

  const stopPerformanceMonitoring = () => {
    performanceMonitor.stopMonitoring();
    setIsMonitoring(false);
    toast.info('Performance monitoring stopped');
  };

  const realTimeTests: RealTimeTest[] = [
    {
      id: 'connection-status',
      name: 'Real-time Connection Status',
      description: 'Verify real-time connection is established and working',
      expectedBehavior: 'Connection status should be "connected" and stable',
      testFunction: async () => {
        if (!isConnected) {
          throw new Error('Real-time connection is not established');
        }
        
        // Test connection stability by waiting 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!isConnected) {
          throw new Error('Connection became unstable during test');
        }
      }
    },
    {
      id: 'new-notification-delivery',
      name: 'New Notification Delivery',
      description: 'Test instant delivery of new notifications',
      expectedBehavior: 'New notifications should appear within 2 seconds',
      testFunction: async () => {
        const initialCount = notifications.length;
        const testTitle = `Real-time Test ${Date.now()}`;
        
        // Create a test notification
        await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          testTitle,
          'This is a real-time delivery test notification',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { test: true, timestamp: Date.now() }
          }
        );

        // Wait for real-time delivery (max 5 seconds)
        let attempts = 0;
        const maxAttempts = 25; // 5 seconds with 200ms intervals
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const newNotification = notifications.find(n => n.title === testTitle);
          if (newNotification) {
            // Success! Clean up the test notification
            await deleteNotification(newNotification.id);
            return;
          }
          
          attempts++;
        }
        
        throw new Error('New notification was not delivered within 5 seconds');
      }
    },
    {
      id: 'status-update-sync',
      name: 'Status Update Synchronization',
      description: 'Test real-time synchronization of notification status changes',
      expectedBehavior: 'Status changes should sync instantly across the application',
      testFunction: async () => {
        // Create a test notification first
        const testTitle = `Status Test ${Date.now()}`;
        const notificationId = await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          testTitle,
          'This is a status update test notification',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { test: true }
          }
        );

        // Wait for it to appear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const testNotification = notifications.find(n => n.title === testTitle);
        if (!testNotification) {
          throw new Error('Test notification was not created');
        }

        // Mark as read and verify real-time update
        await markAsRead(testNotification.id);
        
        // Wait for real-time update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updatedNotification = notifications.find(n => n.id === testNotification.id);
        if (!updatedNotification?.read_at) {
          throw new Error('Read status was not updated in real-time');
        }

        // Clean up
        await deleteNotification(testNotification.id);
      }
    },
    {
      id: 'unread-count-sync',
      name: 'Unread Count Synchronization',
      description: 'Test real-time unread count updates',
      expectedBehavior: 'Unread count should update instantly when notifications are marked as read',
      testFunction: async () => {
        const initialUnreadCount = unreadCount;
        
        // Create a test notification
        const testTitle = `Unread Count Test ${Date.now()}`;
        await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          testTitle,
          'This is an unread count test notification',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { test: true }
          }
        );

        // Wait for it to appear and verify count increased
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (unreadCount <= initialUnreadCount) {
          throw new Error('Unread count did not increase after new notification');
        }

        const testNotification = notifications.find(n => n.title === testTitle);
        if (!testNotification) {
          throw new Error('Test notification was not found');
        }

        // Mark as read and verify count decreased
        await markAsRead(testNotification.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (unreadCount >= initialUnreadCount + 1) {
          throw new Error('Unread count did not decrease after marking as read');
        }

        // Clean up
        await deleteNotification(testNotification.id);
      }
    },
    {
      id: 'bulk-operations',
      name: 'Bulk Operations Real-time Sync',
      description: 'Test real-time synchronization of bulk operations',
      expectedBehavior: 'Bulk operations should sync instantly',
      testFunction: async () => {
        // Create multiple test notifications
        const testIds: string[] = [];
        for (let i = 0; i < 3; i++) {
          const id = await notificationService.createNotification(
            user!.id,
            'receipt_processing_completed',
            `Bulk Test ${i + 1} - ${Date.now()}`,
            `This is bulk test notification ${i + 1}`,
            {
              teamId: currentTeam?.id,
              priority: 'medium',
              metadata: { test: true, bulkTest: true }
            }
          );
          testIds.push(id);
        }

        // Wait for them to appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mark all as read
        await markAllAsRead();
        
        // Wait for real-time update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify all test notifications are marked as read
        const testNotifications = notifications.filter(n => 
          n.metadata?.bulkTest && testIds.includes(n.id)
        );
        
        const unreadTestNotifications = testNotifications.filter(n => !n.read_at);
        if (unreadTestNotifications.length > 0) {
          throw new Error(`${unreadTestNotifications.length} notifications were not marked as read`);
        }

        // Clean up
        for (const id of testIds) {
          await deleteNotification(id);
        }
      }
    },
    {
      id: 'connection-recovery',
      name: 'Connection Recovery',
      description: 'Test automatic reconnection after connection loss',
      expectedBehavior: 'System should automatically reconnect and sync state',
      testFunction: async () => {
        if (!isConnected) {
          throw new Error('Not connected at start of test');
        }

        // Trigger reconnection
        reconnect();
        
        // Wait for reconnection (max 10 seconds)
        let attempts = 0;
        const maxAttempts = 50; // 10 seconds with 200ms intervals
        
        while (attempts < maxAttempts && !isConnected) {
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        if (!isConnected) {
          throw new Error('Failed to reconnect within 10 seconds');
        }

        // Test that notifications still work after reconnection
        const testTitle = `Reconnection Test ${Date.now()}`;
        await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          testTitle,
          'This tests notifications after reconnection',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { test: true }
          }
        );

        // Wait for delivery
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const testNotification = notifications.find(n => n.title === testTitle);
        if (!testNotification) {
          throw new Error('Notifications not working after reconnection');
        }

        // Clean up
        await deleteNotification(testNotification.id);
      }
    }
  ];

  const runTest = async (test: RealTimeTest): Promise<TestResult> => {
    const startTime = Date.now();
    setCurrentTest(test.id);

    try {
      await test.testFunction();
      const duration = Date.now() - startTime;
      
      return {
        id: test.id,
        name: test.name,
        status: 'passed',
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        id: test.id,
        name: test.name,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    } finally {
      setCurrentTest(null);
    }
  };

  const runAllTests = async () => {
    if (!user) {
      toast.error('Please log in to run tests');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    testStartTime.current = Date.now();

    try {
      const results: TestResult[] = [];
      
      for (const test of realTimeTests) {
        const result = await runTest(test);
        results.push(result);
        setTestResults([...results]);
        
        // Short delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const passedTests = results.filter(r => r.status === 'passed').length;
      const totalTests = results.length;
      
      if (passedTests === totalTests) {
        toast.success(`All ${totalTests} real-time tests passed! 🎉`);
      } else {
        toast.error(`${totalTests - passedTests} of ${totalTests} tests failed`);
      }
    } catch (error) {
      toast.error('Test suite failed to complete');
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      passed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const passedTests = testResults.filter(r => r.status === 'passed').length;
  const failedTests = testResults.filter(r => r.status === 'failed').length;
  const totalTests = realTimeTests.length;
  const completedTests = testResults.length;
  const successRate = completedTests > 0 ? (passedTests / completedTests) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Real-time Notification System Tester</CardTitle>
                <CardDescription>
                  Comprehensive testing of real-time notification delivery, synchronization, and cross-tab functionality
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
              <div className="text-sm text-muted-foreground">Total Notifications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
              <div className="text-sm text-muted-foreground">Unread Count</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {isConnected ? 'ON' : 'OFF'}
              </div>
              <div className="text-sm text-muted-foreground">Real-time Connection</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {currentTeam ? 'YES' : 'NO'}
              </div>
              <div className="text-sm text-muted-foreground">Team Context</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{passedTests}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{failedTests}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{completedTests}/{totalTests}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{successRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
            <Progress value={successRate} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={runAllTests}
              disabled={isRunning || !user || !isConnected}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Button>

            <Button
              onClick={refreshNotifications}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Notifications
            </Button>

            <Button
              onClick={reconnect}
              disabled={isConnected}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Wifi className="h-4 w-4" />
              Reconnect
            </Button>

            <Button
              onClick={() => setCrossTabTestActive(!crossTabTestActive)}
              variant={crossTabTestActive ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {crossTabTestActive ? 'Stop Cross-tab Test' : 'Start Cross-tab Test'}
            </Button>
          </div>

          {!user && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Please log in to run real-time tests</span>
              </div>
            </div>
          )}

          {!isConnected && user && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm">Real-time connection is not established. Some tests may fail.</span>
              </div>
            </div>
          )}

          {crossTabTestActive && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Users className="h-4 w-4" />
                <span className="text-sm">
                  Cross-tab test active: Open this page in another tab and perform notification actions to test synchronization
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Cases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Real-time Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {realTimeTests.map((test, index) => {
              const result = testResults.find(r => r.id === test.id);
              const isCurrentTest = currentTest === test.id;

              return (
                <div
                  key={test.id}
                  className={`p-4 border rounded-lg ${
                    isCurrentTest ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        <h4 className="font-medium">{test.name}</h4>
                        {result && getStatusBadge(result.status)}
                        {isCurrentTest && (
                          <Badge variant="secondary">
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                            Running
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {test.description}
                      </p>

                      <p className="text-xs text-blue-600 mb-2">
                        <strong>Expected:</strong> {test.expectedBehavior}
                      </p>

                      {result && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Duration: {result.duration}ms</span>
                          <span>Time: {result.timestamp.toLocaleTimeString()}</span>
                        </div>
                      )}

                      {result?.error && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {result ? getStatusIcon(result.status) : getStatusIcon('pending')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cross-tab Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cross-tab Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>To test cross-tab synchronization:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Click "Start Cross-tab Test" above</li>
              <li>Open this application in another browser tab or window</li>
              <li>In one tab, create a test notification using the notification test panel</li>
              <li>Verify the notification appears instantly in both tabs</li>
              <li>Mark the notification as read in one tab</li>
              <li>Verify the read status updates instantly in the other tab</li>
              <li>Test archive and delete operations across tabs</li>
              <li>Verify unread counts stay synchronized</li>
            </ol>
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">
                  <strong>Success criteria:</strong> All notification state changes should appear instantly in both tabs without manual refresh
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
