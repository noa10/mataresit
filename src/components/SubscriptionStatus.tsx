import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { useStripe } from '@/contexts/StripeContext';
import { Link } from 'react-router-dom';
import {
  Crown,
  Zap,
  Upload,
  Database,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Users,
  GitBranch,
  Puzzle,
  Palette,
  Headphones,
  CheckCircle,
  X
} from 'lucide-react';
import SubscriptionStatusRefresh from '@/components/SubscriptionStatusRefresh';

export const SubscriptionStatus: React.FC = () => {
  const { limits, usage, isLoading, getCurrentTier, getUpgradeMessage, isFeatureAvailable, getFeatureLimit } = useSubscription();
  const { subscriptionData, createPortalSession, isLoading: stripeLoading } = useStripe();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tier = getCurrentTier();
  const upgradeMessage = getUpgradeMessage();

  const getTierIcon = () => {
    switch (tier) {
      case 'pro':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'max':
        return <Crown className="h-5 w-5 text-purple-500" />;
      default:
        return <Upload className="h-5 w-5 text-green-500" />;
    }
  };

  const getTierColor = () => {
    switch (tier) {
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'max':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getUsagePercentage = (used: number, total: number) => {
    if (total === -1) return 0; // Unlimited
    return Math.min((used / total) * 100, 100);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getTierIcon()}
              <CardTitle>Current Plan</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getTierColor()}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Badge>
              <SubscriptionStatusRefresh
                showStatusBadge={false}
                size="sm"
                variant="outline"
              />
            </div>
          </div>
          <CardDescription>
            {subscriptionData?.status === 'active' ? 'Active subscription' : 'Free plan'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage Statistics */}
          {limits && usage && (
            <div className="space-y-4">
              {/* Receipts Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Receipts this month
                  </span>
                  <span>
                    {usage.receiptsUsedThisMonth}
                    {limits.monthlyReceipts !== -1 && ` / ${limits.monthlyReceipts}`}
                  </span>
                </div>
                {limits.monthlyReceipts !== -1 && (
                  <Progress 
                    value={getUsagePercentage(usage.receiptsUsedThisMonth, limits.monthlyReceipts)}
                    className="h-2"
                  />
                )}
              </div>

              {/* Storage Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Storage used
                  </span>
                  <span>
                    {usage.storageUsedMB.toFixed(1)} MB
                    {limits.storageLimitMB !== -1 && ` / ${limits.storageLimitMB} MB`}
                  </span>
                </div>
                {limits.storageLimitMB !== -1 && (
                  <Progress 
                    value={getUsagePercentage(usage.storageUsedMB, limits.storageLimitMB)}
                    className="h-2"
                  />
                )}
              </div>

              {/* Retention Period */}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data retention
                </span>
                <span>{limits.retentionDays} days</span>
              </div>
            </div>
          )}

          {/* Plan Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Plan Features</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Users */}
              <div className="flex items-center gap-2">
                {isFeatureAvailable('unlimited_users') ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <Users className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={isFeatureAvailable('unlimited_users') ? 'text-foreground' : 'text-muted-foreground'}>
                  {isFeatureAvailable('unlimited_users') ? 'Unlimited users' : `${getFeatureLimit('max_users')} user${getFeatureLimit('max_users') === 1 ? '' : 's'}`}
                </span>
              </div>

              {/* Version Control */}
              <div className="flex items-center gap-2">
                {isFeatureAvailable('version_control') ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <X className="h-3 w-3 text-red-500" />
                )}
                <span className={isFeatureAvailable('version_control') ? 'text-foreground' : 'text-muted-foreground'}>
                  Version control
                </span>
              </div>

              {/* Integrations */}
              <div className="flex items-center gap-2">
                {isFeatureAvailable('integrations') ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <X className="h-3 w-3 text-red-500" />
                )}
                <span className={isFeatureAvailable('integrations') ? 'text-foreground' : 'text-muted-foreground'}>
                  {isFeatureAvailable('integrations') ? `${getFeatureLimit('integrations_level')} integrations` : 'No integrations'}
                </span>
              </div>

              {/* Custom Branding */}
              <div className="flex items-center gap-2">
                {isFeatureAvailable('custom_branding') ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <X className="h-3 w-3 text-red-500" />
                )}
                <span className={isFeatureAvailable('custom_branding') ? 'text-foreground' : 'text-muted-foreground'}>
                  Custom branding
                </span>
              </div>

              {/* Support Level */}
              <div className="flex items-center gap-2 col-span-2">
                <Headphones className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {getFeatureLimit('support_level')} support
                </span>
              </div>
            </div>
          </div>

          {/* Upgrade Message */}
          {upgradeMessage && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-orange-800">{upgradeMessage}</p>
                <Button size="sm" asChild>
                  <Link to="/pricing">Upgrade Plan</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Subscription Management */}
          {subscriptionData?.status === 'active' && subscriptionData.tier !== 'free' && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Manage Subscription</p>
                  <p className="text-xs text-muted-foreground">
                    Update billing, view invoices, or cancel
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={createPortalSession}
                  disabled={stripeLoading}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Billing Portal
                </Button>
              </div>
            </div>
          )}

          {/* Upgrade CTA for Free Users */}
          {tier === 'free' && (
            <div className="pt-4 border-t">
              <Button asChild className="w-full">
                <Link to="/pricing">Upgrade to Pro</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
