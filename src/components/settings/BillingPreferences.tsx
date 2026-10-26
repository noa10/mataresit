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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Calendar, 
  Mail, 
  Settings, 
  Clock, 
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  History,
  Bell,
  Globe,
  Moon,
  RefreshCw,
  Crown,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useStripe } from '@/contexts/StripeContext';
import { supabase } from '@/integrations/supabase/client';
import { useSettingsTranslation } from '@/contexts/LanguageContext';
import { EmailDeliveryStats } from './EmailDeliveryStats';

interface BillingPreferencesData {
  auto_renewal_enabled: boolean;
  auto_renewal_frequency: 'monthly' | 'annual';
  billing_email_enabled: boolean;
  reminder_days_before_renewal: number[];
  payment_failure_notifications: boolean;
  grace_period_notifications: boolean;
  max_payment_retry_attempts: number;
  retry_interval_hours: number;
  grace_period_days: number;
  preferred_language: 'en' | 'ms';
  timezone: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  description: string;
  invoice_url?: string;
}

interface SubscriptionHealth {
  subscription_tier: string;
  subscription_status: string;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    expires_at?: string;
  }>;
  recommendations: Array<{
    type: string;
    message: string;
  }>;
  next_actions: string[];
}

export function BillingPreferences() {
  const { t } = useSettingsTranslation();
  const { user } = useAuth();
  const { subscriptionData, createPortalSession, isLoading: stripeLoading } = useStripe();

  // Check if this is a simulated subscription
  const isSimulatedSubscription = subscriptionData?.simulated === true;
  
  const [preferences, setPreferences] = useState<BillingPreferencesData>({
    auto_renewal_enabled: true,
    auto_renewal_frequency: 'monthly',
    billing_email_enabled: true,
    reminder_days_before_renewal: [7, 3, 1],
    payment_failure_notifications: true,
    grace_period_notifications: true,
    max_payment_retry_attempts: 3,
    retry_interval_hours: 24,
    grace_period_days: 7,
    preferred_language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });
  
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [subscriptionHealth, setSubscriptionHealth] = useState<SubscriptionHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('auto-renewal');

  // Load billing preferences
  useEffect(() => {
    loadBillingPreferences();
    loadPaymentHistory();
    checkSubscriptionHealth();
  }, [user]);

  const loadBillingPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_billing_preferences', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error loading billing preferences:', error);
        toast.error(t('billingPreferences.loadFailed'));
        return;
      }

      if (data && data.length > 0) {
        const prefs = data[0];
        setPreferences({
          auto_renewal_enabled: prefs.auto_renewal_enabled,
          auto_renewal_frequency: prefs.auto_renewal_frequency,
          billing_email_enabled: prefs.billing_email_enabled,
          reminder_days_before_renewal: prefs.reminder_days_before_renewal,
          payment_failure_notifications: prefs.payment_failure_notifications,
          grace_period_notifications: prefs.grace_period_notifications,
          max_payment_retry_attempts: prefs.max_payment_retry_attempts,
          retry_interval_hours: prefs.retry_interval_hours,
          grace_period_days: prefs.grace_period_days,
          preferred_language: prefs.preferred_language,
          timezone: prefs.timezone,
          quiet_hours_start: prefs.quiet_hours_start,
          quiet_hours_end: prefs.quiet_hours_end
        });
      }
    } catch (error) {
      console.error('Error loading billing preferences:', error);
      toast.error(t('billingPreferences.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    if (!user) return;

    try {
      // Get payment history from billing audit trail
      const { data, error } = await supabase
        .from('billing_audit_trail')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['payment_succeeded', 'payment_failed', 'subscription_created'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading payment history:', error);
        return;
      }

      const history: PaymentHistory[] = data?.map(record => ({
        id: record.id,
        amount: record.new_values?.amount_paid || 0,
        currency: record.new_values?.currency || 'usd',
        status: record.event_type === 'payment_succeeded' ? 'succeeded' : 'failed',
        created_at: record.created_at,
        description: record.event_description,
        invoice_url: record.new_values?.invoice_url
      })) || [];

      setPaymentHistory(history);
    } catch (error) {
      console.error('Error loading payment history:', error);
    }
  };

  const checkSubscriptionHealth = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('billing-auto-renewal', {
        body: {
          action: 'check_subscription_health',
          userId: user.id
        }
      });

      if (error) {
        console.error('Error checking subscription health:', error);
        return;
      }

      setSubscriptionHealth(data.health);
    } catch (error) {
      console.error('Error checking subscription health:', error);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('email-scheduler', {
        body: {
          action: 'update_email_preferences',
          userId: user.id,
          preferences
        }
      });

      if (error) {
        throw error;
      }

      toast.success(t('billingPreferences.saved'));
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error(t('billingPreferences.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = (key: keyof BillingPreferencesData, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100); // Convert from cents
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-ledger-accent bg-ledger-accent-soft border-ledger-accent/30';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('billingPreferences.title')}</h2>
        <p className="text-muted-foreground">
          {t('billingPreferences.description')}
        </p>
      </div>

      {/* Simulated Subscription Alert */}
      {isSimulatedSubscription && (
        <Alert className="mb-6 border-ledger-accent/30 bg-ledger-accent-soft">
          <Info className="h-4 w-4 text-ledger-accent" />
          <AlertDescription className="text-ledger-ink-2">
            <div className="space-y-2">
              <p className="font-medium">{t('billingPreferences.demoTitle')}</p>
              <p className="text-sm">
                {t('billingPreferences.demoDescription')}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="auto-renewal" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('billingPreferences.tabs.autoRenewal')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('billingPreferences.tabs.notifications')}
          </TabsTrigger>
          <TabsTrigger value="payment-methods" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('billingPreferences.tabs.payment')}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('billingPreferences.tabs.history')}
          </TabsTrigger>
        </TabsList>

        {/* Auto-Renewal Settings */}
        <TabsContent value="auto-renewal" className="space-y-6">
          {/* Subscription Health Status */}
          {subscriptionHealth && subscriptionHealth.issues.length > 0 && (
            <Alert className={cn("border-l-4", getSeverityColor(subscriptionHealth.issues[0].severity))}>
              <div className="flex items-center gap-2">
                {getSeverityIcon(subscriptionHealth.issues[0].severity)}
                <AlertDescription>
                  <div className="space-y-2">
                    {subscriptionHealth.issues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="font-medium">{issue.message}</span>
                        {issue.expires_at && (
                          <Badge variant="outline" className="text-xs">
                            {t('billingPreferences.health.expires', { date: formatDate(issue.expires_at) })}
                          </Badge>
                        )}
                      </div>
                    ))}
                    {subscriptionHealth.next_actions.length > 0 && (
                      <div className="mt-3 pt-2 border-t">
                        <p className="text-sm font-medium mb-1">{t('billingPreferences.health.recommended')}</p>
                        <ul className="text-sm space-y-1">
                          {subscriptionHealth.next_actions.map((action, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Current Subscription Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {subscriptionData?.tier === 'max' ? (
                    <Crown className="h-5 w-5 text-ledger-amber" />
                  ) : subscriptionData?.tier === 'pro' ? (
                    <Zap className="h-5 w-5 text-ledger-accent" />
                  ) : (
                    <Shield className="h-5 w-5 text-gray-600" />
                  )}
                  <CardTitle>{t('billingPreferences.current.title')}</CardTitle>
                </div>
                <Badge variant={subscriptionData?.status === 'active' ? 'default' : 'secondary'}>
                  {subscriptionData?.tier?.charAt(0).toUpperCase() + subscriptionData?.tier?.slice(1) || t('billingPreferences.current.freePlan')}
                </Badge>
              </div>
              <CardDescription>
                {t('billingPreferences.current.status', {
                  status: subscriptionData?.status
                    ? t(`billingPreferences.current.statuses.${subscriptionData.status}`, {
                        defaultValue: subscriptionData.status,
                      })
                    : t('billingPreferences.current.freePlan'),
                })} •
                {subscriptionData?.next_billing_date && (
                  <span> {t('billingPreferences.current.nextBilling', { date: formatDate(subscriptionData.next_billing_date) })}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionData?.tier !== 'free' && (
                <>
                  {/* Auto-renewal toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-renewal">{t('billingPreferences.current.autoRenewal')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('billingPreferences.current.autoRenewalDescription')}
                      </p>
                    </div>
                    <Switch
                      id="auto-renewal"
                      checked={preferences.auto_renewal_enabled}
                      onCheckedChange={(checked) => updatePreference('auto_renewal_enabled', checked)}
                    />
                  </div>

                  <Separator />

                  {/* Renewal frequency */}
                  <div className="space-y-2">
                    <Label>{t('billingPreferences.current.billingFrequency')}</Label>
                    <Select
                      value={preferences.auto_renewal_frequency}
                      onValueChange={(value: 'monthly' | 'annual') => updatePreference('auto_renewal_frequency', value)}
                      disabled={!preferences.auto_renewal_enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{t('billingPreferences.current.monthly')}</SelectItem>
                        <SelectItem value="annual">{t('billingPreferences.current.annual')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Grace period settings */}
                  <div className="space-y-2">
                    <Label>{t('billingPreferences.current.gracePeriod')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('billingPreferences.current.gracePeriodDescription')}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={preferences.grace_period_days}
                        onChange={(e) => updatePreference('grace_period_days', parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">{t('billingPreferences.current.days')}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Payment retry settings */}
                  <div className="space-y-4">
                    <div>
                      <Label>{t('billingPreferences.current.retryAttempts')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('billingPreferences.current.retryAttemptsDescription')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={preferences.max_payment_retry_attempts}
                          onChange={(e) => updatePreference('max_payment_retry_attempts', parseInt(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">{t('billingPreferences.current.attempts')}</span>
                      </div>
                    </div>

                    <div>
                      <Label>{t('billingPreferences.current.retryInterval')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('billingPreferences.current.retryIntervalDescription')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          min="1"
                          max="72"
                          value={preferences.retry_interval_hours}
                          onChange={(e) => updatePreference('retry_interval_hours', parseInt(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">{t('billingPreferences.current.hours')}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Manage subscription button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={createPortalSession}
                  disabled={stripeLoading}
                  className="w-full"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('billingPreferences.current.manage')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t('billingPreferences.email.title')}
              </CardTitle>
              <CardDescription>
                {t('billingPreferences.email.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Master email toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="billing-emails">{t('billingPreferences.email.billingEnabled')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('billingPreferences.email.billingEnabledDescription')}
                  </p>
                </div>
                <Switch
                  id="billing-emails"
                  checked={preferences.billing_email_enabled}
                  onCheckedChange={(checked) => updatePreference('billing_email_enabled', checked)}
                />
              </div>

              <Separator />

              {/* Specific notification types */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('billingPreferences.email.paymentFailure')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('billingPreferences.email.paymentFailureDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.payment_failure_notifications}
                    onCheckedChange={(checked) => updatePreference('payment_failure_notifications', checked)}
                    disabled={!preferences.billing_email_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('billingPreferences.email.gracePeriod')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('billingPreferences.email.gracePeriodDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={preferences.grace_period_notifications}
                    onCheckedChange={(checked) => updatePreference('grace_period_notifications', checked)}
                    disabled={!preferences.billing_email_enabled}
                  />
                </div>
              </div>

              <Separator />

              {/* Reminder timing */}
              <div className="space-y-4">
                <div>
                  <Label>{t('billingPreferences.email.reminderSchedule')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('billingPreferences.email.reminderScheduleDescription')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[1, 3, 7, 14].map((days) => (
                    <div key={days} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`reminder-${days}`}
                        checked={preferences.reminder_days_before_renewal.includes(days)}
                        onChange={(e) => {
                          const currentDays = preferences.reminder_days_before_renewal;
                          if (e.target.checked) {
                            updatePreference('reminder_days_before_renewal', [...currentDays, days].sort((a, b) => b - a));
                          } else {
                            updatePreference('reminder_days_before_renewal', currentDays.filter(d => d !== days));
                          }
                        }}
                        disabled={!preferences.billing_email_enabled}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`reminder-${days}`} className="text-sm">
                        {days === 1
                          ? t('billingPreferences.email.dayBefore', { count: days })
                          : t('billingPreferences.email.daysBefore', { count: days })}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Language and timezone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('billingPreferences.email.language')}</Label>
                  <Select
                    value={preferences.preferred_language}
                    onValueChange={(value: 'en' | 'ms') => updatePreference('preferred_language', value)}
                    disabled={!preferences.billing_email_enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('general.language.options.en')}</SelectItem>
                      <SelectItem value="ms">{t('general.language.options.ms')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('billingPreferences.email.timezone')}</Label>
                  <Select
                    value={preferences.timezone}
                    onValueChange={(value) => updatePreference('timezone', value)}
                    disabled={!preferences.billing_email_enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Asia/Kuala_Lumpur">{t('billingPreferences.timezones.malaysia')}</SelectItem>
                      <SelectItem value="Asia/Singapore">{t('billingPreferences.timezones.singapore')}</SelectItem>
                      <SelectItem value="America/New_York">{t('billingPreferences.timezones.eastern')}</SelectItem>
                      <SelectItem value="America/Los_Angeles">{t('billingPreferences.timezones.pacific')}</SelectItem>
                      <SelectItem value="Europe/London">{t('billingPreferences.timezones.london')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Quiet hours */}
              <div className="space-y-4">
                <div>
                  <Label>{t('billingPreferences.email.quietHours')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('billingPreferences.email.quietHoursDescription')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">{t('billingPreferences.email.startTime')}</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={preferences.quiet_hours_start || '22:00'}
                      onChange={(e) => updatePreference('quiet_hours_start', e.target.value)}
                      disabled={!preferences.billing_email_enabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">{t('billingPreferences.email.endTime')}</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={preferences.quiet_hours_end || '08:00'}
                      onChange={(e) => updatePreference('quiet_hours_end', e.target.value)}
                      disabled={!preferences.billing_email_enabled}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Delivery Statistics */}
          <EmailDeliveryStats />
        </TabsContent>

        {/* Payment Methods */}
        <TabsContent value="payment-methods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('billingPreferences.payment.title')}
              </CardTitle>
              <CardDescription>
                {t('billingPreferences.payment.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionData?.tier !== 'free' ? (
                <>
                  {/* Current payment method */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {t('billingPreferences.payment.cardEnding', {
                            brand: subscriptionData?.payment_method_brand || t('billingPreferences.payment.card'),
                            last4: subscriptionData?.payment_method_last_four || '****',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('billingPreferences.payment.primary')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{t('billingPreferences.payment.active')}</Badge>
                  </div>

                  {/* Manage payment methods */}
                  <div className="pt-4 border-t">
                    <Button
                      onClick={createPortalSession}
                      disabled={stripeLoading}
                      className="w-full"
                      variant="outline"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {t('billingPreferences.payment.manage')}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {t('billingPreferences.payment.manageHint')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('billingPreferences.payment.noMethods')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('billingPreferences.payment.noMethodsDescription')}
                  </p>
                  <Button asChild>
                    <a href="/pricing">{t('billingPreferences.payment.viewPlans')}</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle>{t('billingPreferences.payment.billingInfo')}</CardTitle>
              <CardDescription>
                {t('billingPreferences.payment.billingInfoDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t('billingPreferences.payment.billingManaged')}
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    {t('billingPreferences.history.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('billingPreferences.history.description')}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadPaymentHistory();
                    toast.success(t('billingPreferences.history.refreshed'));
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('billingPreferences.history.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentHistory.length > 0 ? (
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          payment.status === 'succeeded' ? 'bg-green-500' : 'bg-red-500'
                        )} />
                        <div>
                          <p className="font-medium">{payment.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(payment.amount, payment.currency)}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant={payment.status === 'succeeded' ? 'default' : 'destructive'}>
                            {t(`billingPreferences.paymentStatuses.${payment.status}`, {
                              defaultValue: payment.status,
                            })}
                          </Badge>
                          {payment.invoice_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('billingPreferences.history.emptyTitle')}</h3>
                  <p className="text-muted-foreground">
                    {t('billingPreferences.history.emptyDescription')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Download invoices */}
          {subscriptionData?.tier !== 'free' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('billingPreferences.history.invoices')}</CardTitle>
                <CardDescription>
                  {t('billingPreferences.history.invoicesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={createPortalSession}
                  disabled={stripeLoading}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('billingPreferences.history.viewAll')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Save button */}
        <div className="flex justify-end pt-6 border-t">
          <Button
            onClick={savePreferences}
            disabled={isSaving}
            className="min-w-32"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('billingPreferences.saving')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('billingPreferences.save')}
              </>
            )}
          </Button>
        </div>
      </Tabs>
    </div>
  );
}
