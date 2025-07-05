import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  TestTube,
  Receipt,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { usePushNotificationContext } from '@/contexts/PushNotificationContext';
import { ReceiptNotificationService } from '@/services/receiptNotificationService';
import { TeamCollaborationNotificationService } from '@/services/teamCollaborationNotificationService';
import { EmailNotificationService } from '@/services/emailNotificationService';
import { notificationService } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';
import { ProcessingStatus } from '@/types/receipt';

export function NotificationTestPanel() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const pushContext = usePushNotificationContext();
  const [isLoading, setIsLoading] = useState(false);
  const [testReceiptId, setTestReceiptId] = useState(() => crypto.randomUUID());
  const [testMerchant, setTestMerchant] = useState('Test Store');
  const [testTotal, setTestTotal] = useState('25.50');
  const [testStatus, setTestStatus] = useState<ProcessingStatus>('complete');

  const handleTestReceiptNotification = async () => {
    if (!user) {
      toast.error('Please log in to test notifications');
      return;
    }

    setIsLoading(true);
    try {
      const testData = {
        receiptId: testReceiptId,
        userId: user.id,
        merchant: testMerchant,
        total: parseFloat(testTotal),
        currency: 'MYR'
      };

      // Call the appropriate notification method based on status
      switch (testStatus) {
        case 'processing':
          await ReceiptNotificationService.notifyReceiptProcessingStarted(testData);
          break;
        case 'complete':
          await ReceiptNotificationService.notifyReceiptProcessingCompleted(testData);
          break;
        case 'failed':
          await ReceiptNotificationService.notifyReceiptProcessingFailed({
            ...testData,
            errorMessage: 'Test error message'
          });
          break;
        default:
          throw new Error(`Unsupported test status: ${testStatus}`);
      }

      toast.success(`Test ${testStatus} notification sent!`);
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error(`Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBatchNotification = async () => {
    if (!user) {
      toast.error('Please log in to test notifications');
      return;
    }

    setIsLoading(true);
    try {
      await ReceiptNotificationService.handleBatchProcessingComplete(
        user.id,
        {
          totalReceipts: 5,
          successfulReceipts: 4,
          failedReceipts: 1
        }
      );
      
      toast.success('Test batch notification sent!');
    } catch (error) {
      console.error('Failed to send test batch notification:', error);
      toast.error('Failed to send test batch notification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPushNotification = async () => {
    if (!pushContext.isSubscribed) {
      toast.error('Push notifications not enabled. Please enable push notifications first.');
      return;
    }

    setIsLoading(true);
    try {
      await pushContext.sendReceiptNotification(
        testStatus === 'complete' ? 'completed' : testStatus === 'failed' ? 'failed' : 'started',
        {
          id: testReceiptId,
          merchant: testMerchant,
          total: parseFloat(testTotal),
          currency: 'MYR'
        }
      );

      toast.success('Test push notification sent!');
    } catch (error) {
      console.error('Failed to send test push notification:', error);
      toast.error(`Failed to send test push notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestInAppNotification = async () => {
    if (!user) {
      toast.error('Please log in to test notifications');
      return;
    }

    setIsLoading(true);
    try {
      await notificationService.createNotification(
        user.id,
        'receipt_processing_completed',
        'Test Receipt Processed',
        `Test receipt from ${testMerchant} has been processed successfully`,
        {
          priority: 'medium',
          actionUrl: `/receipts/${testReceiptId}`,
          relatedEntityType: 'receipt',
          relatedEntityId: testReceiptId,
          metadata: {
            merchant: testMerchant,
            total: parseFloat(testTotal),
            currency: 'MYR'
          }
        }
      );

      toast.success('Test in-app notification created!');
    } catch (error) {
      console.error('Failed to create test in-app notification:', error);
      toast.error(`Failed to create test in-app notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTeamCollaboration = async () => {
    if (!user) {
      toast.error('Please log in to test notifications');
      return;
    }

    if (!currentTeam) {
      toast.error('Please select a team to test team collaboration notifications');
      return;
    }

    setIsLoading(true);
    try {
      const actorName = user.user_metadata?.full_name || user.email || 'Test User';

      // First check if there are other team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', currentTeam.id)
        .eq('status', 'active')
        .neq('user_id', user.id);

      if (membersError) {
        console.error('Error checking team members:', membersError);
        toast.error('Failed to check team members');
        return;
      }

      if (!teamMembers || teamMembers.length === 0) {
        // Create a test notification directly to the current user for testing purposes
        await notificationService.createTeamReceiptNotification(
          user.id,
          testReceiptId,
          'receipt_shared',
          {
            teamId: currentTeam.id,
            actorName: 'Test Team Member',
            merchant: testMerchant,
          }
        );
        toast.success('Test team collaboration notification created (simulated team member)!');
      } else {
        // Send to actual team members
        await TeamCollaborationNotificationService.notifyReceiptShared({
          teamId: currentTeam.id,
          actorUserId: user.id,
          actorName,
          receiptId: testReceiptId,
          merchant: testMerchant,
          total: parseFloat(testTotal),
          currency: 'MYR'
        });
        toast.success(`Test team collaboration notification sent to ${teamMembers.length} team members!`);
      }
    } catch (error) {
      console.error('Failed to send test team collaboration notification:', error);
      toast.error(`Failed to send test team collaboration notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmailNotification = async () => {
    if (!user) {
      toast.error('Please log in to test notifications');
      return;
    }

    setIsLoading(true);
    try {
      // First check if user has email notification preferences enabled
      const { data: preferences, error: prefError } = await supabase.rpc('get_user_notification_preferences', {
        _user_id: user.id
      });

      if (prefError) {
        console.error('Error checking notification preferences:', prefError);
        toast.warning('Could not check email preferences, proceeding with test...');
      } else if (preferences && preferences.length > 0 && !preferences[0].email_enabled) {
        toast.warning('Email notifications are disabled in your preferences. Enable them in settings to receive emails.');
      }

      // Check if send-email Edge Function exists by testing it
      const { data: edgeFunctionTest, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: {
          to: user.email || 'test@example.com',
          subject: 'Test Email Notification',
          html: '<p>This is a test email notification from Mataresit.</p>',
          text: 'This is a test email notification from Mataresit.',
          template_name: 'receipt_processing',
          template_data: {
            recipientName: user.user_metadata?.full_name || user.email || 'Test User',
            receiptId: testReceiptId,
            merchant: testMerchant,
            total: parseFloat(testTotal),
            currency: 'MYR',
            status: testStatus === 'complete' ? 'completed' : testStatus === 'failed' ? 'failed' : 'started',
            actionUrl: `${window.location.origin}/receipts/${testReceiptId}`,
            language: 'en',
          },
          related_entity_type: 'receipt',
          related_entity_id: testReceiptId,
          team_id: currentTeam?.id,
          metadata: {
            notification_type: 'receipt_processing_completed',
            receipt_status: testStatus,
            merchant: testMerchant,
          }
        }
      });

      if (edgeError) {
        console.error('Edge Function error:', edgeError);
        toast.error(`Email service error: ${edgeError.message}. Check if Resend API key is configured in Supabase.`);
      } else {
        console.log('Email sent successfully:', edgeFunctionTest);
        toast.success('Test email notification sent! Check your email inbox.');
      }
    } catch (error) {
      console.error('Failed to send test email notification:', error);
      toast.error(`Failed to send test email notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
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
                Please log in to test notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TestTube className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle>Notification Testing Panel</CardTitle>
            <CardDescription>
              Test different types of notifications to verify the system is working
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Data Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Test Data</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Receipt ID</Label>
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
              <Label className="text-sm">Merchant</Label>
              <Input
                value={testMerchant}
                onChange={(e) => setTestMerchant(e.target.value)}
                placeholder="Test Store"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Total (MYR)</Label>
              <Input
                value={testTotal}
                onChange={(e) => setTestTotal(e.target.value)}
                placeholder="25.50"
                type="number"
                step="0.01"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Processing Status</Label>
            <Select value={testStatus} onValueChange={(value) => setTestStatus(value as ProcessingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Notification Tests */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Tests
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receipt Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                <span className="text-sm font-medium">Receipt Notifications</span>
              </div>
              <Button
                onClick={handleTestReceiptNotification}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                Test Receipt {testStatus} Notification
              </Button>
            </div>

            {/* Batch Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Batch Notifications</span>
              </div>
              <Button
                onClick={handleTestBatchNotification}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Test Batch Complete
              </Button>
            </div>

            {/* Push Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="text-sm font-medium">Push Notifications</span>
                {pushContext.isSubscribed ? (
                  <Badge variant="default" className="text-xs">Enabled</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                )}
              </div>
              <Button
                onClick={handleTestPushNotification}
                disabled={isLoading || !pushContext.isSubscribed}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Test Push Notification
              </Button>
            </div>

            {/* In-App Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">In-App Notifications</span>
              </div>
              <Button
                onClick={handleTestInAppNotification}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Test In-App Notification
              </Button>
            </div>

            {/* Team Collaboration Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Team Collaboration</span>
                {currentTeam ? (
                  <Badge variant="default" className="text-xs">{currentTeam.name}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">No Team</Badge>
                )}
              </div>
              <Button
                onClick={handleTestTeamCollaboration}
                disabled={isLoading || !currentTeam}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Test Team Notification
              </Button>
            </div>

            {/* Email Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm font-medium">Email Notifications</span>
              </div>
              <Button
                onClick={handleTestEmailNotification}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Test Email Notification
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
