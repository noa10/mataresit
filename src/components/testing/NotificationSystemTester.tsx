import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Bell,
  Mail,
  Users,
  Receipt,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { ReceiptNotificationService } from '@/services/receiptNotificationService';
import { TeamCollaborationNotificationService } from '@/services/teamCollaborationNotificationService';
import { EmailNotificationService } from '@/services/emailNotificationService';
import { notificationService } from '@/services/notificationService';

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
  details?: any;
  timestamp: Date;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  testFunction: () => Promise<void>;
  dependencies?: string[];
}

export function NotificationSystemTester() {
  const { user } = useAuth();
  const { currentTeam, teams } = useTeam();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testReceiptId, setTestReceiptId] = useState(() => crypto.randomUUID());
  const [testMerchant, setTestMerchant] = useState('Test Store');
  const [testTotal, setTestTotal] = useState('25.50');
  const [testEmail, setTestEmail] = useState(user?.email || '');

  const testScenarios: TestScenario[] = [
    // Receipt Processing Tests
    {
      id: 'receipt-processing-started',
      name: 'Receipt Processing Started',
      description: 'Test receipt processing started notification',
      category: 'receipt-processing',
      testFunction: async () => {
        await ReceiptNotificationService.notifyReceiptProcessingStarted({
          receiptId: testReceiptId,
          userId: user!.id,
          merchant: testMerchant,
          total: parseFloat(testTotal),
          currency: 'MYR',
          teamId: currentTeam?.id
        });
      }
    },
    {
      id: 'receipt-processing-completed',
      name: 'Receipt Completed',
      description: 'Test receipt processing completed notification',
      category: 'receipt-processing',
      testFunction: async () => {
        await ReceiptNotificationService.notifyReceiptProcessingCompleted({
          receiptId: testReceiptId,
          userId: user!.id,
          merchant: testMerchant,
          total: parseFloat(testTotal),
          currency: 'MYR',
          teamId: currentTeam?.id
        });
      }
    },
    {
      id: 'receipt-processing-failed',
      name: 'Receipt Processing Failed',
      description: 'Test receipt processing failed notification',
      category: 'receipt-processing',
      testFunction: async () => {
        await ReceiptNotificationService.notifyReceiptProcessingFailed({
          receiptId: testReceiptId,
          userId: user!.id,
          merchant: testMerchant,
          errorMessage: 'Test error: Unable to process receipt image',
          teamId: currentTeam?.id
        });
      }
    },
    {
      id: 'batch-processing-completed',
      name: 'Batch Processing Completed',
      description: 'Test batch processing completed notification',
      category: 'batch-processing',
      testFunction: async () => {
        await ReceiptNotificationService.handleBatchProcessingComplete(
          user!.id,
          {
            totalReceipts: 5,
            successfulReceipts: 4,
            failedReceipts: 1
          },
          currentTeam?.id
        );
      }
    },
    // Team Collaboration Tests
    {
      id: 'receipt-shared',
      name: 'Receipt Shared',
      description: 'Test receipt sharing notification',
      category: 'team-collaboration',
      testFunction: async () => {
        if (!currentTeam) throw new Error('No team selected');
        await TeamCollaborationNotificationService.handleReceiptShared(
          testReceiptId,
          currentTeam.id,
          user!.id,
          user!.user_metadata?.full_name || user!.email || 'Test User'
        );
      }
    },
    {
      id: 'receipt-commented',
      name: 'Receipt Comment Added',
      description: 'Test receipt comment notification',
      category: 'team-collaboration',
      testFunction: async () => {
        if (!currentTeam) throw new Error('No team selected');
        await TeamCollaborationNotificationService.handleReceiptCommentAdded(
          testReceiptId,
          currentTeam.id,
          user!.id,
          user!.user_metadata?.full_name || user!.email || 'Test User',
          'This is a test comment for notification testing.'
        );
      }
    },
    // Email Notification Tests
    {
      id: 'email-receipt-completed',
      name: 'Email Receipt Completed',
      description: 'Test email notification for receipt completion',
      category: 'email-notifications',
      testFunction: async () => {
        await EmailNotificationService.sendReceiptProcessingEmail(
          user!.id,
          {
            receiptId: testReceiptId,
            merchant: testMerchant,
            total: parseFloat(testTotal),
            currency: 'MYR',
            status: 'completed'
          },
          currentTeam?.id
        );
      }
    },
    {
      id: 'email-batch-completed',
      name: 'Email Batch Completed',
      description: 'Test email notification for batch completion',
      category: 'email-notifications',
      testFunction: async () => {
        await EmailNotificationService.sendBatchProcessingEmail(
          user!.id,
          {
            totalReceipts: 5,
            successfulReceipts: 4,
            failedReceipts: 1
          },
          currentTeam?.id
        );
      }
    },
    // Push Notification Tests
    {
      id: 'push-notification-test',
      name: 'Push Notification Test',
      description: 'Test browser push notification',
      category: 'push-notifications',
      testFunction: async () => {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: user!.id,
            notificationType: 'receipt_processing_completed',
            payload: {
              title: 'Test Push Notification',
              body: `Receipt from ${testMerchant} processed successfully`,
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
              data: {
                receiptId: testReceiptId,
                url: `/receipts/${testReceiptId}`
              }
            },
            respectPreferences: false // Force send for testing
          }
        });

        if (error) throw error;
      }
    },
    // Database Trigger Tests
    {
      id: 'database-trigger-test',
      name: 'Database Trigger Test',
      description: 'Test database triggers for automatic notifications',
      category: 'database-triggers',
      testFunction: async () => {
        // Create a test receipt to trigger notifications
        const { data, error } = await supabase
          .from('receipts')
          .insert({
            user_id: user!.id,
            team_id: currentTeam?.id,
            merchant: testMerchant,
            total: parseFloat(testTotal),
            currency: 'MYR',
            processing_status: 'uploading',
            date: new Date().toISOString().split('T')[0]
          })
          .select('id')
          .single();

        if (error) throw error;

        // Update status to trigger notification
        const { error: updateError } = await supabase
          .from('receipts')
          .update({ processing_status: 'complete' })
          .eq('id', data.id);

        if (updateError) throw updateError;

        // Clean up test receipt
        await supabase.from('receipts').delete().eq('id', data.id);
      }
    },
    // Performance Tests
    {
      id: 'notification-performance',
      name: 'Notification Performance',
      description: 'Test notification system performance under load',
      category: 'performance',
      testFunction: async () => {
        const startTime = Date.now();
        const promises = [];

        // Create 10 concurrent notifications
        for (let i = 0; i < 10; i++) {
          promises.push(
            notificationService.createNotification(
              user!.id,
              'receipt_processing_completed',
              `Performance Test ${i + 1}`,
              `This is performance test notification ${i + 1}`,
              {
                teamId: currentTeam?.id,
                priority: 'medium',
                metadata: { testId: `perf-test-${i}` }
              }
            )
          );
        }

        await Promise.all(promises);
        const duration = Date.now() - startTime;

        if (duration > 5000) {
          throw new Error(`Performance test took ${duration}ms (expected < 5000ms)`);
        }
      }
    },
    // Notification Filtering Tests
    {
      id: 'test-processing-started-filtering',
      name: 'Processing Started Always Hidden',
      description: 'Verify receipt_processing_started notifications are always filtered out',
      category: 'notification-filtering',
      testFunction: async () => {
        // Create a processing_started notification
        await notificationService.createNotification(
          user!.id,
          'receipt_processing_started',
          'Test Processing Started',
          'This notification should never appear in the panel',
          {
            teamId: currentTeam?.id,
            priority: 'low',
            metadata: { testId: 'filter-test-processing-started' }
          }
        );

        // Wait a moment for the notification to be created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if it appears in the notification panel (it shouldn't)
        const { data: notifications } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user!.id)
          .eq('type', 'receipt_processing_started')
          .eq('title', 'Test Processing Started');

        if (notifications && notifications.length > 0) {
          // Clean up the test notification
          await supabase
            .from('notifications')
            .delete()
            .eq('id', notifications[0].id);

          throw new Error('receipt_processing_started notification was created but should be filtered out from display');
        }
      }
    },
    {
      id: 'test-push-disabled-filtering',
      name: 'Push Disabled Global Filtering',
      description: 'Test that when push_enabled is false, all notifications are hidden',
      category: 'notification-filtering',
      testFunction: async () => {
        // Get current preferences
        const currentPrefs = await notificationService.getUserNotificationPreferences();

        // Temporarily disable push notifications
        await notificationService.updateNotificationPreferences({
          ...currentPrefs,
          push_enabled: false
        });

        // Create a test notification
        const testNotificationId = await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          'Test Push Disabled Filtering',
          'This notification should be hidden when push is disabled',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { testId: 'filter-test-push-disabled' }
          }
        );

        // Wait for notification to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test client-side filtering
        const { shouldShowNotificationWithPreferences } = await import('@/types/notifications');
        const { data: notification } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', testNotificationId)
          .single();

        const shouldShow = shouldShowNotificationWithPreferences(notification, {
          ...currentPrefs,
          push_enabled: false
        });

        // Restore original preferences
        await notificationService.updateNotificationPreferences(currentPrefs);

        // Clean up test notification
        await supabase.from('notifications').delete().eq('id', testNotificationId);

        if (shouldShow) {
          throw new Error('Notification should be hidden when push_enabled is false');
        }
      }
    },
    {
      id: 'test-individual-type-filtering',
      name: 'Individual Type Filtering',
      description: 'Test filtering of individual notification types based on preferences',
      category: 'notification-filtering',
      testFunction: async () => {
        // Get current preferences
        const currentPrefs = await notificationService.getUserNotificationPreferences();

        // Disable receipt_processing_completed notifications
        await notificationService.updateNotificationPreferences({
          ...currentPrefs,
          push_receipt_processing_completed: false
        });

        // Create a test notification of this type
        const testNotificationId = await notificationService.createNotification(
          user!.id,
          'receipt_processing_completed',
          'Test Individual Type Filtering',
          'This notification should be hidden when its type is disabled',
          {
            teamId: currentTeam?.id,
            priority: 'medium',
            metadata: { testId: 'filter-test-individual-type' }
          }
        );

        // Wait for notification to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test client-side filtering
        const { shouldShowNotificationWithPreferences } = await import('@/types/notifications');
        const { data: notification } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', testNotificationId)
          .single();

        const shouldShow = shouldShowNotificationWithPreferences(notification, {
          ...currentPrefs,
          push_receipt_processing_completed: false
        });

        // Restore original preferences
        await notificationService.updateNotificationPreferences(currentPrefs);

        // Clean up test notification
        await supabase.from('notifications').delete().eq('id', testNotificationId);

        if (shouldShow) {
          throw new Error('Notification should be hidden when its specific type is disabled');
        }
      }
    },
    {
      id: 'test-server-client-consistency',
      name: 'Server-Client Filtering Consistency',
      description: 'Verify server-side and client-side filtering produce consistent results',
      category: 'notification-filtering',
      testFunction: async () => {
        const preferences = await notificationService.getUserNotificationPreferences();

        // Test various notification types
        const testTypes = [
          'receipt_processing_completed',
          'receipt_processing_failed',
          'receipt_batch_completed',
          'team_invitation_received'
        ];

        for (const notificationType of testTypes) {
          // Create test notification
          const testNotificationId = await notificationService.createNotification(
            user!.id,
            notificationType as any,
            `Test ${notificationType}`,
            `Testing consistency for ${notificationType}`,
            {
              teamId: currentTeam?.id,
              priority: 'medium',
              metadata: { testId: `consistency-test-${notificationType}` }
            }
          );

          // Get the notification
          const { data: notification } = await supabase
            .from('notifications')
            .select('*')
            .eq('id', testNotificationId)
            .single();

          // Test client-side filtering
          const { shouldShowNotificationWithPreferences } = await import('@/types/notifications');
          const clientResult = shouldShowNotificationWithPreferences(notification, preferences);

          // Test server-side filtering by calling the helper
          const { data: serverResult } = await supabase.functions.invoke('test-notification-filtering', {
            body: {
              notificationType,
              userId: user!.id
            }
          });

          // Clean up test notification
          await supabase.from('notifications').delete().eq('id', testNotificationId);

          if (clientResult !== serverResult?.inAppEnabled) {
            throw new Error(`Filtering inconsistency for ${notificationType}: client=${clientResult}, server=${serverResult?.inAppEnabled}`);
          }
        }
      }
    }
  ];

  const categories = [
    { value: 'all', label: 'All Tests' },
    { value: 'receipt-processing', label: 'Receipt Processing' },
    { value: 'batch-processing', label: 'Batch Processing' },
    { value: 'team-collaboration', label: 'Team Collaboration' },
    { value: 'email-notifications', label: 'Email Notifications' },
    { value: 'push-notifications', label: 'Push Notifications' },
    { value: 'database-triggers', label: 'Database Triggers' },
    { value: 'notification-filtering', label: 'Notification Filtering' },
    { value: 'performance', label: 'Performance' }
  ];

  const runTest = async (scenario: TestScenario) => {
    const startTime = Date.now();
    
    setTestResults(prev => prev.map(result => 
      result.id === scenario.id 
        ? { ...result, status: 'running', timestamp: new Date() }
        : result
    ));

    try {
      await scenario.testFunction();
      const duration = Date.now() - startTime;
      
      setTestResults(prev => prev.map(result => 
        result.id === scenario.id 
          ? { 
              ...result, 
              status: 'passed', 
              duration,
              error: undefined,
              timestamp: new Date()
            }
          : result
      ));

      toast.success(`✅ ${scenario.name} passed (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      setTestResults(prev => prev.map(result => 
        result.id === scenario.id 
          ? { 
              ...result, 
              status: 'failed', 
              duration,
              error: error.message,
              timestamp: new Date()
            }
          : result
      ));

      toast.error(`❌ ${scenario.name} failed: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    const filteredScenarios = selectedCategory === 'all' 
      ? testScenarios 
      : testScenarios.filter(s => s.category === selectedCategory);

    for (const scenario of filteredScenarios) {
      await runTest(scenario);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsRunning(false);
  };

  const resetTests = () => {
    setTestResults(testScenarios.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      status: 'pending' as const,
      timestamp: new Date()
    })));
  };

  const exportResults = () => {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'passed').length,
        failed: testResults.filter(r => r.status === 'failed').length,
        pending: testResults.filter(r => r.status === 'pending').length
      },
      results: testResults
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initialize test results
  useEffect(() => {
    resetTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const filteredResults = selectedCategory === 'all' 
    ? testResults 
    : testResults.filter(r => r.category === selectedCategory);

  const summary = {
    total: filteredResults.length,
    passed: filteredResults.filter(r => r.status === 'passed').length,
    failed: filteredResults.filter(r => r.status === 'failed').length,
    pending: filteredResults.filter(r => r.status === 'pending').length
  };

  if (!user) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-orange-900">Authentication Required</CardTitle>
              <CardDescription className="text-orange-700">
                Please log in to run notification system tests
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TestTube className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Notification System Tester</CardTitle>
              <CardDescription>
                Comprehensive testing suite for the notification system
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Receipt ID</Label>
              <Input
                value={testReceiptId}
                onChange={(e) => setTestReceiptId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTestReceiptId(crypto.randomUUID())}
                  className="text-xs"
                >
                  Generate New UUID
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Merchant</Label>
              <Input
                value={testMerchant}
                onChange={(e) => setTestMerchant(e.target.value)}
                placeholder="Test Store"
              />
            </div>
            <div className="space-y-2">
              <Label>Total (MYR)</Label>
              <Input
                value={testTotal}
                onChange={(e) => setTestTotal(e.target.value)}
                placeholder="25.50"
                type="number"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                type="email"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Test Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={runAllTests}
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
              
              <Button
                onClick={exportResults}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Test Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
              <div className="text-sm text-gray-600">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{summary.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredResults.map((result) => {
                const scenario = testScenarios.find(s => s.id === result.id);
                return (
                  <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <div className="font-medium">{result.name}</div>
                        <div className="text-sm text-gray-600">{scenario?.description}</div>
                        {result.error && (
                          <div className="text-sm text-red-600 mt-1">{result.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.duration && (
                        <span className="text-xs text-gray-500">{result.duration}ms</span>
                      )}
                      {getStatusBadge(result.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runTest(scenario!)}
                        disabled={isRunning || result.status === 'running'}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
