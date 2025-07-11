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
import { NOTIFICATION_CATEGORIES } from '@/types/notifications';
import { useSettingsTranslation } from '@/contexts/LanguageContext';
import { NotificationSetupGuide } from '@/components/notifications/NotificationSetupGuide';
import { NotificationTestPanel } from '@/components/notifications/NotificationTestPanel';

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
      toast.success('Test notification sent');
    } catch (error) {
      toast.error('Failed to send test notification');
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-600" />
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
                Push notifications are not supported in your browser or are not available.
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Status */}
          {pushStatus.isBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Push notifications are blocked. Please enable them in your browser settings.
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
                Receive notifications even when the app is closed
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
                Push notifications are disabled. You can still configure your preferences below,
                but you won't receive push notifications until you enable them above.
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
                Send Test Notification
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
              <Label className="text-sm font-medium">Enable email notifications</Label>
              <p className="text-xs text-muted-foreground">
                Master switch for all email notifications
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
              <div className="p-2 bg-purple-100 rounded-lg">
                {categoryKey === 'RECEIPT_PROCESSING' && <Receipt className="h-5 w-5 text-purple-600" />}
                {categoryKey === 'TEAM_COLLABORATION' && <Users className="h-5 w-5 text-purple-600" />}
                {categoryKey === 'CLAIMS_AND_BILLING' && <Settings className="h-5 w-5 text-purple-600" />}
                {categoryKey === 'SYSTEM' && <Info className="h-5 w-5 text-purple-600" />}
              </div>
              <div>
                <CardTitle className="text-lg">{category.label}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email preferences for this category */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Notifications
              </h4>
              <div className="grid gap-3">
                {category.types.map((notificationType) => {
                  const emailKey = `email_${notificationType}` as keyof typeof localPreferences;
                  const pushKey = `push_${notificationType}` as keyof typeof localPreferences;
                  
                  return (
                    <div key={notificationType} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          {getNotificationTypeLabel(notificationType)}
                        </Label>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={localPreferences[emailKey] as boolean || false}
                              onCheckedChange={(checked) => updateLocalPreference(emailKey, checked)}
                              disabled={!localPreferences.email_enabled}
                              size="sm"
                            />
                            <Mail className="h-3 w-3 text-muted-foreground" />
                          </div>
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
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Moon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>
                Disable notifications during specific hours
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Enable quiet hours</Label>
              <p className="text-xs text-muted-foreground">
                Notifications will be silenced during these hours
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
                <Label className="text-sm">Start time</Label>
                <Input
                  type="time"
                  value={localPreferences.quiet_hours_start || '22:00'}
                  onChange={(e) => updateLocalPreference('quiet_hours_start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">End time</Label>
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
              Timezone
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
                  Malaysia (UTC+8) <Badge variant="secondary" className="ml-2">Default</Badge>
                </SelectItem>
                <SelectItem value="Asia/Singapore">Singapore (UTC+8)</SelectItem>
                <SelectItem value="Asia/Jakarta">Jakarta (UTC+7)</SelectItem>
                <SelectItem value="Asia/Bangkok">Bangkok (UTC+7)</SelectItem>
                <SelectItem value="UTC">UTC (UTC+0)</SelectItem>
                <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
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
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Test Panel (only show in development or for testing) */}
      {process.env.NODE_ENV === 'development' && (
        <NotificationTestPanel />
      )}
    </div>
  );
}

// Helper function to get user-friendly notification type labels
function getNotificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    // Receipt processing
    'receipt_processing_started': 'Processing started',
    'receipt_processing_completed': 'Processing completed',
    'receipt_processing_failed': 'Processing failed',
    'receipt_ready_for_review': 'Ready for review',
    'receipt_batch_completed': 'Batch completed',
    'receipt_batch_failed': 'Batch failed',
    
    // Team collaboration
    'team_invitation_sent': 'Team invitations',
    'team_invitation_accepted': 'Invitation accepted',
    'team_member_joined': 'Member joined',
    'team_member_left': 'Member left',
    'team_member_role_changed': 'Role changed',
    'receipt_shared': 'Receipt shared',
    'receipt_comment_added': 'Comments added',
    'receipt_edited_by_team_member': 'Receipt edited',
    'receipt_approved_by_team': 'Receipt approved',
    'receipt_flagged_for_review': 'Flagged for review',
    
    // Claims and billing
    'claim_submitted': 'Claim submitted',
    'claim_approved': 'Claim approved',
    'claim_rejected': 'Claim rejected',
    'claim_review_requested': 'Review requested',
    
    // System
    'team_settings_updated': 'Settings updated',
  };
  
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
