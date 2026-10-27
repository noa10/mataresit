import { useState, useEffect } from "react";
import { Crown, CreditCard, Calendar, TrendingUp, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getSubscriptionInfo } from "@/services/profileService";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

interface SubscriptionInfoProps {
  userId: string;
}

interface SubscriptionData {
  subscription_tier: string;
  subscription_status: string;
  receipts_used_this_month: number;
  monthly_reset_date: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  trial_end_date?: string;
  limits?: {
    monthly_receipts: number;
    storage_limit_mb: number;
    retention_days: number;
    batch_upload_limit: number;
  };
}

const tierColors = {
  free: "bg-gray-100 text-gray-800 border-gray-200",
  pro: "bg-blue-100 text-blue-800 border-blue-200",
  max: "bg-purple-100 text-purple-800 border-purple-200"
};

const tierIcons = {
  free: null,
  pro: <CreditCard className="h-4 w-4" />,
  max: <Crown className="h-4 w-4" />
};

export function SubscriptionInfo({ userId }: SubscriptionInfoProps) {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useProfileTranslation();

  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      try {
        const data = await getSubscriptionInfo(userId);
        setSubscriptionData(data);
      } catch (error) {
        console.error("Error fetching subscription info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionInfo();
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("subscription.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("subscription.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("subscription.unableToLoad")}</p>
        </CardContent>
      </Card>
    );
  }

  const {
    subscription_tier,
    subscription_status,
    receipts_used_this_month,
    monthly_reset_date,
    subscription_start_date,
    subscription_end_date,
    trial_end_date,
    limits
  } = subscriptionData;

  const tierName = subscription_tier?.charAt(0).toUpperCase() + subscription_tier?.slice(1) || 'Free';
  const usagePercentage = limits?.monthly_receipts && limits.monthly_receipts > 0 
    ? Math.min((receipts_used_this_month / limits.monthly_receipts) * 100, 100)
    : 0;

  const isUnlimited = limits?.monthly_receipts === -1;
  const dateLocale = language === 'ms' ? 'ms-MY' : 'en-MY';
  const resetDate = new Date(monthly_reset_date).toLocaleDateString(dateLocale, {
    month: 'short',
    day: 'numeric'
  });
  const statusLabel = t(`subscription.statuses.${subscription_status}`, {
    defaultValue: subscription_status,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t("subscription.title")}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/pricing" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            {t("subscription.managePlan")}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{t("subscription.currentPlan")}</h3>
          </div>
          <Badge
            variant="outline"
            className={`gap-1 ${tierColors[subscription_tier as keyof typeof tierColors] || tierColors.free}`}
          >
            {tierIcons[subscription_tier as keyof typeof tierIcons]}
            {t("subscription.planName", { tier: tierName })}
          </Badge>
        </div>

        {/* Usage Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('subscription.receiptsThisMonth')}</span>
            <span className="font-medium">
              {receipts_used_this_month} {!isUnlimited && `/ ${limits?.monthly_receipts}`}
            </span>
          </div>
          
          {!isUnlimited && limits?.monthly_receipts && (
            <div className="space-y-2">
              <Progress value={usagePercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {t('subscription.resetsOn', { date: resetDate })}
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Plan Features */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t('subscription.planFeatures')}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('subscription.monthlyReceipts')}</span>
              <p className="font-medium">
                {isUnlimited ? t('subscription.unlimited') : limits?.monthly_receipts || t('subscription.na')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('subscription.storage')}</span>
              <p className="font-medium">
                {limits?.storage_limit_mb === -1 
                  ? t('subscription.unlimited')
                  : `${(limits?.storage_limit_mb || 0) / 1024}GB`
                }
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('subscription.dataRetention')}</span>
              <p className="font-medium">
                {limits?.retention_days === -1 
                  ? t('subscription.forever')
                  : t('subscription.days', { count: limits?.retention_days || 0 })
                }
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('subscription.batchUpload')}</span>
              <p className="font-medium">
                {t('subscription.files', { count: limits?.batch_upload_limit || 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Dates */}
        {(subscription_start_date || subscription_end_date || trial_end_date) && (
          <>
            <Separator />
            <div className="space-y-2 text-sm">
              {subscription_start_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('subscription.started')}</span>
                  <span className="font-medium">
                    {new Date(subscription_start_date).toLocaleDateString(dateLocale)}
                  </span>
                </div>
              )}
              {subscription_end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('subscription.renews')}</span>
                  <span className="font-medium">
                    {new Date(subscription_end_date).toLocaleDateString(dateLocale)}
                  </span>
                </div>
              )}
              {trial_end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('subscription.trialEnds')}</span>
                  <span className="font-medium">
                    {new Date(trial_end_date).toLocaleDateString(dateLocale)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('subscription.status')}</span>
          <Badge 
            variant={subscription_status === 'active' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {statusLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
