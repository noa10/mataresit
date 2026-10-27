import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Clock, 
  Users, 
  Receipt, 
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Moon,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePushNotificationContext, usePushNotificationStatus } from '@/contexts/PushNotificationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { getPushNotificationPreferenceKey, NOTIFICATION_CATEGORIES } from '@/types/notifications';
import { useSettingsTranslation } from '@/contexts/LanguageContext';
import { NotificationSetupGuide } from '@/components/notifications/NotificationSetupGuide';
import { NotificationTestPanel } from '@/components/notifications/NotificationTestPanel';

const CATEGORY_I18N_KEYS: Record<string, string> = {
  RECEIPT_PROCESSING: 'receiptProcessing',
  TEAM_COLLABORATION: 'teamCollaboration',
  CLAIMS_AND_BILLING: 'claimsAndBilling',
  SYSTEM: 'system',
  GAMIFICATION: 'gamification',
};

const NOTIFICATION_TYPE_I18N_KEYS: Record<string, string> = {
  receipt_processing_started: 'receiptProcessingStarted',
  receipt_processing_completed: 'receiptProcessingCompleted',
  receipt_processing_failed: 'receiptProcessingFailed',
  receipt_ready_for_review: 'receiptReadyForReview',
  receipt_batch_completed: 'receiptBatchCompleted',
  receipt_batch_failed: 'receiptBatchFailed',
  team_invitation_sent: 'teamInvitationSent',
  team_invitation_accepted: 'teamInvitationAccepted',
  team_member_joined: 'teamMemberJoined',
  team_member_left: 'teamMemberLeft',
  team_member_removed: 'teamMemberRemoved',
  team_member_role_changed: 'teamMemberRoleChanged',
  receipt_shared: 'receiptShared',
  receipt_comment_added: 'receiptCommentAdded',
  receipt_edited_by_team_member: 'receiptEditedByTeamMember',
  receipt_approved_by_team: 'receiptApprovedByTeam',
  receipt_flagged_for_review: 'receiptFlaggedForReview',
  claim_submitted: 'claimSubmitted',
  claim_approved: 'claimApproved',
  claim_rejected: 'claimRejected',
  claim_review_requested: 'claimReviewRequested',
  team_settings_updated: 'teamSettingsUpdated',
  gamification_streak_reminder: 'gamificationStreakReminder',
};

export function NotificationPreferences() {
  const { t } = useSettingsTranslation();
  const { preferences, preferencesLoading: isLoading, updatePreferences } = useNotifications();
  const pushContext = usePushNotificationContext();
  const pushStatus = usePushNotificationStatus();
  
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(!pushStatus.isEnabled && pushStatus.isAvailable);

  // Update local preferences when global preferences change
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleSave = async () => {
    if (!localPreferences) return;

    setIsSaving(true);
    try {
      await updatePreferences(localPreferences);
      toast.success(t('notifications.saved') || 'Notification preferences saved');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error(t('notifications.saveError') || 'Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const updateLocalPreference = (key: string, value: any) => {
    setLocalPreferences(prev => prev ? { ...prev, [key]: value } : null);
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled && !pushStatus.isEnabled) {
      // Enable push notifications
      const permission = await pushContext.requestPermission();
      if (permission === 'granted') {
        await pushContext.subscribe();
        updateLocalPreference('push_enabled', true);
        updateLocalPreference('browser_permission_granted', true);
      }
    } else if (!enabled && pushStatus.isEnabled) {
      // Disable push notifications
      await pushContext.unsubscribe();
      updateLocalPreference('push_enabled', false);
    } else {
      // Just update the preference
      updateLocalPreference('push_enabled', enabled);
    }
  };

  const handleTestNotification = async () => {
    try {
      await pushContext.showTestNotification();
      toast.success(t('notifications.push.testSent'));
    } catch (error) {
      toast.error(t('notifications.push.testFailed'));
    }
  };

  if (isLoading || !localPreferences) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup Guide */}
      {showSetupGuide && (
        <NotificationSetupGuide
          onComplete={() => setShowSetupGuide(false)}
          onDismiss={() => setShowSetupGuide(false)}
        />
      )}

      {/* Push Notification Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ledger-accent-soft rounded-lg">
              <Smartphone className="h-5 w-5 text-ledger-accent" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('notifications.push.title') || 'Push Notifications'}
                {pushStatus.isEnabled && <CheckCircle className="h-4 w-4 text-green-500" />}
              </CardTitle>
              <CardDescription>
                {t('notifications.push.description') || 'Get instant notifications in your browser'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Browser Support Check */}
          {!pushStatus.isAvailable && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('notifications.push.unsupported')}
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Status */}
          {pushStatus.isBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('notifications.push.blocked')}
              </AlertDescription>
            </Alert>
          )}

          {/* Main Push Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {t('notifications.push.enabled') || 'Enable push notifications'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('notifications.push.closedDescription')}
              </p>
            </div>
            <Switch
              checked={localPreferences.push_enabled && pushStatus.isEnabled}
              onCheckedChange={handlePushToggle}
              disabled={pushStatus.isBlocked || !pushStatus.isAvailable}
            />
          </div>

          {/* Push Notification Status Info */}
          {!localPreferences.push_enabled && pushStatus.isAvailable && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('notifications.push.disabledNotice')}
              </AlertDescription>
            </Alert>
          )}

          {/* Test Notification Button */}
          {pushStatus.isEnabled && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                disabled={!pushStatus.isEnabled}
              >
                <Bell className="h-4 w-4 mr-2" />
                {t('notifications.push.sendTest')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Mail className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>{t('notifications.email.title') || 'Email Notifications'}</CardTitle>
              <CardDescription>
                {t('notifications.email.description') || 'Receive notifications via email'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('notifications.email.enabled')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('notifications.email.enabledDescription')}
              </p>
            </div>
            <Switch
              checked={localPreferences.email_enabled}
              onCheckedChange={(checked) => updateLocalPreference('email_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      {Object.entries(NOTIFICATION_CATEGORIES).map(([categoryKey, category]) => (
        <Card key={categoryKey}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ledger-accent-soft rounded-lg">
                {categoryKey === 'RECEIPT_PROCESSING' && <Receipt className="h-5 w-5 text-ledger-accent" />}
                {categoryKey === 'TEAM_COLLABORATION' && <Users className="h-5 w-5 text-ledger-accent" />}
                {categoryKey === 'CLAIMS_AND_BILLING' && <Settings className="h-5 w-5 text-ledger-accent" />}
                {categoryKey === 'SYSTEM' && <Info className="h-5 w-5 text-ledger-accent" />}
                {categoryKey === 'GAMIFICATION' && <Bell className="h-5 w-5 text-ledger-accent" />}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {t(`notifications.categories.${CATEGORY_I18N_KEYS[categoryKey] ?? categoryKey}`)}
                </CardTitle>
                <CardDescription>
                  {t(`notifications.categories.${CATEGORY_I18N_KEYS[categoryKey] ?? categoryKey}Description`)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email preferences for this category */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('notifications.email.title')}
              </h4>
              <div className="grid gap-3">
                {category.types.map((notificationType) => {
                  const emailKey = notificationType === 'gamification_streak_reminder'
                    ? null
                    : `email_${notificationType}` as keyof typeof localPreferences;
                  const pushKey = getPushNotificationPreferenceKey(notificationType);
                  
                  return (
                    <div key={notificationType} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          {t(`notifications.types.${NOTIFICATION_TYPE_I18N_KEYS[notificationType] ?? notificationType}`)}
                        </Label>
                        <div className="flex gap-2">
                          {emailKey && (
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={localPreferences[emailKey] as boolean || false}
                                onCheckedChange={(checked) => updateLocalPreference(emailKey, checked)}
                                disabled={!localPreferences.email_enabled}
                                size="sm"
                              />
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          {pushKey && (
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={localPreferences[pushKey] as boolean || false}
                                onCheckedChange={(checked) => updateLocalPreference(pushKey, checked)}
                                disabled={pushStatus.isBlocked || !pushStatus.isAvailable}
                                size="sm"
                              />
                              <Smartphone className={cn(
                                "h-3 w-3",
                                !localPreferences.push_enabled || !pushStatus.isEnabled
                                  ? "text-muted-foreground/50"
                                  : "text-muted-foreground"
                              )} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ledger-accent-soft rounded-lg">
              <Moon className="h-5 w-5 text-ledger-accent" />
            </div>
            <div>
              <CardTitle>{t('notifications.quietHours.title')}</CardTitle>
              <CardDescription>
                {t('notifications.quietHours.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('notifications.quietHours.enabled')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('notifications.quietHours.enabledDescription')}
              </p>
            </div>
            <Switch
              checked={localPreferences.quiet_hours_enabled}
              onCheckedChange={(checked) => updateLocalPreference('quiet_hours_enabled', checked)}
            />
          </div>

          {localPreferences.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('notifications.quietHours.startTime')}</Label>
                <Input
                  type="time"
                  value={localPreferences.quiet_hours_start || '22:00'}
                  onChange={(e) => updateLocalPreference('quiet_hours_start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('notifications.quietHours.endTime')}</Label>
                <Input
                  type="time"
                  value={localPreferences.quiet_hours_end || '08:00'}
                  onChange={(e) => updateLocalPreference('quiet_hours_end', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('notifications.quietHours.timezone')}
            </Label>
            <Select
              value={localPreferences.timezone || 'Asia/Kuala_Lumpur'}
              onValueChange={(value) => updateLocalPreference('timezone', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kuala_Lumpur">
                  {t('notifications.categories.timezoneMalaysia', { defaultValue: 'Malaysia (UTC+8)' })}{" "}
                  <Badge variant="secondary" className="ml-2">{t('notifications.quietHours.default')}</Badge>
                </SelectItem>
                <SelectItem value="Asia/Singapore">{t('notifications.categories.timezoneSingapore', { defaultValue: 'Singapore (UTC+8)' })}</SelectItem>
                <SelectItem value="Asia/Jakarta">{t('notifications.categories.timezoneJakarta', { defaultValue: 'Jakarta (UTC+7)' })}</SelectItem>
                <SelectItem value="Asia/Bangkok">{t('notifications.categories.timezoneBangkok', { defaultValue: 'Bangkok (UTC+7)' })}</SelectItem>
                <SelectItem value="UTC">UTC (UTC+0)</SelectItem>
                <SelectItem value="America/New_York">{t('notifications.categories.timezoneNewYork', { defaultValue: 'New York (UTC-5)' })}</SelectItem>
                <SelectItem value="Europe/London">{t('notifications.categories.timezoneLondon', { defaultValue: 'London (UTC+0)' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="min-w-[120px]"
        >
          {isSaving ? t('billingPreferences.saving') : t('billingPreferences.save')}
        </Button>
      </div>

      {/* Test Panel (only show in development or for testing) */}
      {process.env.NODE_ENV === 'development' && (
        <NotificationTestPanel />
      )}
    </div>
  );
}