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
import { useSettingsTranslation } from '@/contexts/LanguageContext';

export function NotificationTestPanel() {
  const { t, language } = useSettingsTranslation();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const pushContext = usePushNotificationContext();
  const [isLoading, setIsLoading] = useState(false);
  const [testReceiptId, setTestReceiptId] = useState(() => crypto.randomUUID());
  const [testMerchant, setTestMerchant] = useState(() => t('notifications.testPanel.merchantPlaceholder'));
  const [testTotal, setTestTotal] = useState('25.50');
  const [testStatus, setTestStatus] = useState<ProcessingStatus>('complete');

  const handleTestReceiptNotification = async () => {
    if (!user) {
      toast.error(t('notifications.testPanel.toasts.loginRequired'));
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
            errorMessage: t('notifications.testPanel.testErrorMessage')
          });
          break;
        default:
          throw new Error(`Unsupported test status: ${testStatus}`);
      }

      toast.success(
        t('notifications.testPanel.toasts.testSent', { status: testStatus })
      );
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error(
        t('notifications.testPanel.toasts.testFailed', {
          error:
            error instanceof Error
              ? error.message
              : t('notifications.testPanel.toasts.unknownError'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestBatchNotification = async () => {
    if (!user) {
      toast.error(t('notifications.testPanel.toasts.loginRequired'));
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
      
      toast.success(t('notifications.testPanel.toasts.batchSent'));
    } catch (error) {
      console.error('Failed to send test batch notification:', error);
      toast.error(t('notifications.testPanel.toasts.batchFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPushNotification = async () => {
    if (!pushContext.isSubscribed) {
      toast.error(t('notifications.testPanel.toasts.pushDisabled'));
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

      toast.success(t('notifications.testPanel.toasts.pushSent'));
    } catch (error) {
      console.error('Failed to send test push notification:', error);
      toast.error(
        t('notifications.testPanel.toasts.pushFailed', {
          error:
            error instanceof Error
              ? error.message
              : t('notifications.testPanel.toasts.unknownError'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestInAppNotification = async () => {
    if (!user) {
      toast.error(t('notifications.testPanel.toasts.loginRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await notificationService.createNotification(
        user.id,
        'receipt_processing_completed',
        t('notifications.testPanel.testReceiptTitle'),
        t('notifications.testPanel.testReceiptBody', { merchant: testMerchant }),
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

      toast.success(t('notifications.testPanel.toasts.inAppSent'));
    } catch (error) {
      console.error('Failed to create test in-app notification:', error);
      toast.error(
        t('notifications.testPanel.toasts.inAppFailed', {
          error:
            error instanceof Error
              ? error.message
              : t('notifications.testPanel.toasts.unknownError'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTeamCollaboration = async () => {
    if (!user) {
      toast.error(t('notifications.testPanel.toasts.loginRequired'));
      return;
    }

    if (!currentTeam) {
      toast.error(t('notifications.testPanel.toasts.teamSelect'));
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
        .neq('user_id', user.id);

      if (membersError) {
        console.error('Error checking team members:', membersError);
        toast.error(t('notifications.testPanel.toasts.teamCheckFailed'));
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
        toast.success(t('notifications.testPanel.toasts.teamSimulated'));
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
        toast.success(
          t('notifications.testPanel.toasts.teamSent', {
            count: teamMembers.length,
          })
        );
      }
    } catch (error) {
      console.error('Failed to send test team collaboration notification:', error);
      toast.error(
        t('notifications.testPanel.toasts.teamFailed', {
          error:
            error instanceof Error
              ? error.message
              : t('notifications.testPanel.toasts.unknownError'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEmailNotification = async () => {
    if (!user) {
      toast.error(t('notifications.testPanel.toasts.loginRequired'));
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
        toast.warning(t('notifications.testPanel.toasts.emailPrefsCheckFailed'));
      } else if (preferences && preferences.length > 0 && !preferences[0].email_enabled) {
        toast.warning(t('notifications.testPanel.toasts.emailDisabled'));
      }

      // Check if send-email Edge Function exists by testing it
      const { data: edgeFunctionTest, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: {
          to: user.email || 'test@example.com',
          subject: t('notifications.testPanel.emailSubject'),
          html: t('notifications.testPanel.emailHtml'),
          text: t('notifications.testPanel.emailText'),
          template_name: 'receipt_processing',
          template_data: {
            recipientName: user.user_metadata?.full_name || user.email || 'Test User',
            receiptId: testReceiptId,
            merchant: testMerchant,
            total: parseFloat(testTotal),
            currency: 'MYR',
            status: testStatus === 'complete' ? 'completed' : testStatus === 'failed' ? 'failed' : 'started',
            actionUrl: `${window.location.origin}/receipts/${testReceiptId}`,
            language,
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
        toast.error(
          t('notifications.testPanel.toasts.emailServiceError', {
            message: edgeError.message,
          })
        );
      } else {
        console.log('Email sent successfully:', edgeFunctionTest);
        toast.success(t('notifications.testPanel.toasts.emailSent'));
      }
    } catch (error) {
      console.error('Failed to send test email notification:', error);
      toast.error(
        t('notifications.testPanel.toasts.emailFailed', {
          error:
            error instanceof Error
              ? error.message
              : t('notifications.testPanel.toasts.unknownError'),
        })
      );
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
              <CardTitle className="text-orange-900">
                {t('notifications.testPanel.authRequired')}
              </CardTitle>
              <CardDescription className="text-orange-700">
                {t('notifications.testPanel.authDescription')}
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
            <CardTitle>{t('notifications.testPanel.title')}</CardTitle>
            <CardDescription>
              {t('notifications.testPanel.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Data Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">{t('notifications.testPanel.testData')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('notifications.testPanel.receiptId')}</Label>
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
                  {t('notifications.testPanel.generateUuid')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{t('notifications.testPanel.merchant')}</Label>
              <Input
                value={testMerchant}
                onChange={(e) => setTestMerchant(e.target.value)}
                placeholder={t('notifications.testPanel.merchantPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{t('notifications.testPanel.totalMyr')}</Label>
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
            <Label className="text-sm">{t('notifications.testPanel.processingStatus')}</Label>
            <Select value={testStatus} onValueChange={(value) => setTestStatus(value as ProcessingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="processing">
                  {t('notifications.testPanel.statusProcessing')}
                </SelectItem>
                <SelectItem value="complete">
                  {t('notifications.testPanel.statusComplete')}
                </SelectItem>
                <SelectItem value="failed">
                  {t('notifications.testPanel.statusFailed')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Notification Tests */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('notifications.testPanel.notificationTests')}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receipt Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.receiptNotifications')}
                </span>
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
                {t('notifications.testPanel.testReceipt', { status: testStatus })}
              </Button>
            </div>

            {/* Batch Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.batchNotifications')}
                </span>
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
                {t('notifications.testPanel.testBatch')}
              </Button>
            </div>

            {/* Push Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.pushNotifications')}
                </span>
                {pushContext.isSubscribed ? (
                  <Badge variant="default" className="text-xs">
                    {t('notifications.testPanel.enabled')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t('notifications.testPanel.disabled')}
                  </Badge>
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
                {t('notifications.testPanel.testPush')}
              </Button>
            </div>

            {/* In-App Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.inAppNotifications')}
                </span>
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
                {t('notifications.testPanel.testInApp')}
              </Button>
            </div>

            {/* Team Collaboration Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.teamCollaboration')}
                </span>
                {currentTeam ? (
                  <Badge variant="default" className="text-xs">{currentTeam.name}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t('notifications.testPanel.noTeam')}
                  </Badge>
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
                {t('notifications.testPanel.testTeam')}
              </Button>
            </div>

            {/* Email Notification Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notifications.testPanel.emailNotifications')}
                </span>
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
                {t('notifications.testPanel.testEmail')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
