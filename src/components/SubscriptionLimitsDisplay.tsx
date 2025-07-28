import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionEnforcementService, type SubscriptionUsageInfo } from '@/services/subscriptionEnforcementService';
import { Link } from 'react-router-dom';
import {
  Upload,
  Database,
  Calendar,
  AlertTriangle,
  Users,
  Layers,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionLimitsDisplayProps {
  showUpgradePrompts?: boolean;
  compact?: boolean;
  className?: string;
}

export default function SubscriptionLimitsDisplay({
  showUpgradePrompts = true,
  compact = false,
  className = ""
}: SubscriptionLimitsDisplayProps) {
  const { limits, usage, isLoading, error, getCurrentTier, refreshUsage, lastFetchTime, dataUpdatedAt } = useSubscription();
  const [realTimeUsage, setRealTimeUsage] = useState<SubscriptionUsageInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);



  const tier = getCurrentTier();

  // Get real-time usage information
  useEffect(() => {
    const fetchRealTimeUsage = async () => {
      try {
        const usageInfo = await SubscriptionEnforcementService.getUsageInfo();
        if (usageInfo) {
          setRealTimeUsage(usageInfo);
        }
      } catch (error) {
        console.error('Error fetching real-time usage:', error);
      }
    };

    fetchRealTimeUsage();
  }, []);



  const handleRefreshUsage = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Use the optimized refresh from the hook
      await refreshUsage();

      // Also refresh real-time usage
      const usageInfo = await SubscriptionEnforcementService.getUsageInfo();
      if (usageInfo) {
        setRealTimeUsage(usageInfo);
      }

      toast.success("Usage information refreshed");
    } catch (error) {
      console.error('Error refreshing usage:', error);
      toast.error("Failed to refresh usage information");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getUsagePercentage = (used: number, total: number) => {
    if (total === -1) return 0; // Unlimited
    return Math.min((used / total) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Usage & Limits
            <Loader2 className="h-4 w-4 animate-spin" />
          </CardTitle>
          <CardDescription>
            Loading your usage statistics...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Skeleton for usage stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>

            {!compact && (
              <div className="pt-2 border-t">
                <Skeleton className="h-4 w-48 mb-2" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Usage & Limits
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshUsage}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load usage statistics: {error}
              <br />
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={handleRefreshUsage}
                disabled={isRefreshing}
              >
                Try refreshing
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Use real-time usage if available, fallback to hook usage
  const currentUsage = realTimeUsage || {
    receipts_this_month: usage?.receiptsUsedThisMonth || 0,
    storage_used_mb: 0, // Estimated
    monthly_receipts_limit: limits?.monthlyReceipts || 50,
    storage_limit_mb: limits?.storageLimitMB || 1024,
    batch_upload_limit: limits?.batchUploadLimit || 5
  };

  const receiptsPercentage = getUsagePercentage(
    currentUsage.receipts_this_month,
    currentUsage.monthly_receipts_limit
  );

  const storagePercentage = getUsagePercentage(
    currentUsage.storage_used_mb,
    currentUsage.storage_limit_mb
  );

  const isNearLimit = receiptsPercentage >= 80 || storagePercentage >= 80;

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Monthly Receipts</span>
          <span className={`text-sm ${getUsageColor(receiptsPercentage)}`}>
            {currentUsage.receipts_this_month}
            {currentUsage.monthly_receipts_limit === -1 
              ? ' / Unlimited' 
              : ` / ${currentUsage.monthly_receipts_limit}`
            }
          </span>
        </div>
        {currentUsage.monthly_receipts_limit !== -1 && (
          <Progress 
            value={receiptsPercentage} 
            className="h-2"
            style={{ 
              background: `linear-gradient(to right, ${getProgressColor(receiptsPercentage)} ${receiptsPercentage}%, #e5e7eb ${receiptsPercentage}%)` 
            }}
          />
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Usage & Limits</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshUsage}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
        <CardDescription>
          Current usage for your {tier.charAt(0).toUpperCase() + tier.slice(1)} plan
          {(dataUpdatedAt || lastFetchTime) && (
            <span className="text-xs text-muted-foreground ml-2">
              • Updated {new Date(dataUpdatedAt || lastFetchTime).toLocaleTimeString()}
              {dataUpdatedAt && (
                <span className="ml-1 text-green-600">
                  (cached)
                </span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Near Limit Warning */}
        {isNearLimit && showUpgradePrompts && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              You're approaching your plan limits. Consider upgrading to avoid interruptions.
              <Link to="/pricing" className="ml-2 underline hover:no-underline">
                View Plans
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Monthly Receipts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Receipts this month
            </span>
            <span className={getUsageColor(receiptsPercentage)}>
              {currentUsage.receipts_this_month}
              {currentUsage.monthly_receipts_limit === -1 
                ? ' / Unlimited' 
                : ` / ${currentUsage.monthly_receipts_limit}`
              }
            </span>
          </div>
          {currentUsage.monthly_receipts_limit !== -1 && (
            <Progress 
              value={receiptsPercentage} 
              className="h-2"
              style={{ 
                background: `linear-gradient(to right, ${getProgressColor(receiptsPercentage)} ${receiptsPercentage}%, #e5e7eb ${receiptsPercentage}%)` 
              }}
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
            <span className={getUsageColor(storagePercentage)}>
              {currentUsage.storage_used_mb.toFixed(1)} MB
              {currentUsage.storage_limit_mb === -1 
                ? ' / Unlimited' 
                : ` / ${(currentUsage.storage_limit_mb / 1024).toFixed(1)} GB`
              }
            </span>
          </div>
          {currentUsage.storage_limit_mb !== -1 && (
            <Progress 
              value={storagePercentage} 
              className="h-2"
              style={{ 
                background: `linear-gradient(to right, ${getProgressColor(storagePercentage)} ${storagePercentage}%, #e5e7eb ${storagePercentage}%)` 
              }}
            />
          )}
        </div>

        {/* Batch Upload Limit */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Batch upload limit
            </span>
            <span className="text-muted-foreground">
              {currentUsage.batch_upload_limit === -1 
                ? 'Unlimited files' 
                : `${currentUsage.batch_upload_limit} files`
              }
            </span>
          </div>
        </div>

        {/* Upgrade Prompt */}
        {showUpgradePrompts && tier === 'free' && (
          <div className="pt-4 border-t">
            <Button asChild className="w-full">
              <Link to="/pricing">
                Upgrade for More Receipts & Storage
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
