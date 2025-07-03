import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useStripe } from '@/contexts/StripeContext';
import { supabase } from '@/integrations/supabase/client';
import { SUBSCRIPTION_TIERS } from '@/config/stripe';
import type { SubscriptionTier } from '@/config/stripe';
import { SubscriptionEnforcementService } from '@/services/subscriptionEnforcementService';

interface SubscriptionLimits {
  monthlyReceipts: number;
  storageLimitMB: number;
  retentionDays: number;
  batchUploadLimit: number;
}

interface SubscriptionUsage {
  receiptsUsedThisMonth: number;
  receiptsRemaining: number;
  storageUsedMB: number;
  storageRemainingMB: number;
  // Additional stats from optimized function
  totalReceipts?: number;
  receiptsWithImages?: number;
  recentActivity?: {
    receiptsLast7Days: number;
    totalAmountLast7Days: number;
  };
  usagePercentages?: {
    receipts: number;
    storage: number;
  };
  lastUpdated?: string;
}

interface OptimizedUsageStats {
  receipts_used_this_month: number;
  receipts_remaining: number;
  storage_used_mb: number;
  storage_remaining_mb: number;
  subscription_tier: string;
  subscription_status: string;
  monthly_reset_date: string;
  limits: {
    monthly_receipts: number;
    storage_limit_mb: number;
    batch_upload_limit: number;
  };
  total_receipts: number;
  receipts_with_images: number;
  recent_activity: {
    receipts_last_7_days: number;
    total_amount_last_7_days: number;
  };
  usage_percentages: {
    receipts: number;
    storage: number;
  };
  last_updated: string;
  calculation_method: string;
  error?: string;
}

// React Query keys for caching
export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  usage: (userId: string) => [...subscriptionQueryKeys.all, 'usage', userId] as const,
  limits: (tier: string) => [...subscriptionQueryKeys.all, 'limits', tier] as const,
};

// Fetch function for React Query
const fetchOptimizedUsageStats = async (): Promise<OptimizedUsageStats> => {
  console.log('Fetching optimized usage stats via React Query...');
  const startTime = Date.now();

  const { data, error } = await supabase.rpc('get_my_usage_stats_optimized');

  const fetchTime = Date.now() - startTime;
  console.log(`Usage stats fetched in ${fetchTime}ms`);

  if (error) {
    console.error('RPC Error:', error);
    throw new Error(error.message || 'Failed to fetch usage statistics');
  }

  if (!data) {
    throw new Error('No data returned from usage stats function');
  }

  const stats = data as OptimizedUsageStats;

  // Check for errors in the response
  if (stats.error) {
    console.error('Usage stats error:', stats.error);
    throw new Error(stats.error);
  }

  return stats;
};

export const useSubscription = () => {
  const { user } = useAuth();
  const { subscriptionData } = useStripe();
  const queryClient = useQueryClient();

  // Legacy state for backward compatibility
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);

  // React Query for usage statistics with advanced caching
  const {
    data: usageStats,
    isLoading,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: subscriptionQueryKeys.usage(user?.id || ''),
    queryFn: fetchOptimizedUsageStats,
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Refetch on component mount
  });

  // Convert React Query error to string
  const error = queryError ? (queryError as Error).message : null;

  // Update legacy state when React Query data changes
  useEffect(() => {
    if (usageStats) {
      // Set limits from the response
      setLimits({
        monthlyReceipts: usageStats.limits.monthly_receipts,
        storageLimitMB: usageStats.limits.storage_limit_mb,
        retentionDays: 365, // Default value, not returned by RPC
        batchUploadLimit: usageStats.limits.batch_upload_limit,
      });

      // Set usage data with additional stats
      setUsage({
        receiptsUsedThisMonth: usageStats.receipts_used_this_month,
        receiptsRemaining: usageStats.receipts_remaining,
        storageUsedMB: usageStats.storage_used_mb,
        storageRemainingMB: usageStats.storage_remaining_mb,
        totalReceipts: usageStats.total_receipts,
        receiptsWithImages: usageStats.receipts_with_images,
        recentActivity: usageStats.recent_activity,
        usagePercentages: usageStats.usage_percentages,
        lastUpdated: usageStats.last_updated,
      });

      console.log('Usage stats updated from React Query cache');
    } else if (error && subscriptionData) {
      // Fallback to default limits if we have subscription data but query failed
      const tierLimits = SUBSCRIPTION_TIERS[subscriptionData.tier];
      setLimits({
        monthlyReceipts: tierLimits.monthlyReceipts,
        storageLimitMB: tierLimits.storageLimitMB,
        retentionDays: tierLimits.retentionDays,
        batchUploadLimit: tierLimits.batchUploadLimit,
      });
    }
  }, [usageStats, error, subscriptionData]);

  const checkCanUpload = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use the enhanced enforcement service
      const result = await SubscriptionEnforcementService.canUploadReceipt();
      return result.allowed;
    } catch (error) {
      console.error('Error checking upload limit:', error);
      return false;
    }
  };

  const checkCanUploadBatch = async (batchSize: number, averageFileSizeMB: number = 0.5): Promise<boolean> => {
    if (!user) return false;

    try {
      const result = await SubscriptionEnforcementService.canUploadBatch(batchSize, averageFileSizeMB);
      return result.allowed;
    } catch (error) {
      console.error('Error checking batch upload limit:', error);
      return false;
    }
  };

  const getUpgradeMessage = (): string | null => {
    if (!limits || !usage) return null;

    if (usage.receiptsRemaining === 0) {
      return "You've reached your monthly receipt limit. Upgrade to process more receipts.";
    }

    if (usage.storageRemainingMB !== -1 && usage.storageRemainingMB < 10) {
      return "You're running low on storage space. Upgrade for more storage.";
    }

    return null;
  };

  const getCurrentTier = (): SubscriptionTier => {
    return subscriptionData?.tier || 'free';
  };

  const isFeatureAvailable = (feature: string): boolean => {
    const tier = getCurrentTier();
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    switch (feature) {
      case 'batch_upload':
        return tier !== 'free';
      case 'advanced_analytics':
        return tier === 'pro' || tier === 'max';
      case 'api_access':
        return tier === 'max';
      case 'priority_support':
        return tier === 'pro' || tier === 'max';
      case 'unlimited_receipts':
        return tier === 'max';
      case 'version_control':
        return tierConfig.features.versionControl;
      case 'integrations':
        return tierConfig.features.integrations !== false;
      case 'custom_branding':
        return tierConfig.features.customBranding;
      case 'unlimited_users':
        return tierConfig.features.unlimitedUsers;
      default:
        return true;
    }
  };

  const isFeatureAvailableAsync = async (feature: string): Promise<boolean> => {
    try {
      const result = await SubscriptionEnforcementService.isFeatureAvailable(feature);
      return result.allowed;
    } catch (error) {
      console.error('Error checking feature availability:', error);
      // Fallback to synchronous check
      return isFeatureAvailable(feature);
    }
  };

  const getFeatureLimit = (feature: string): number | string => {
    const tier = getCurrentTier();
    const tierConfig = SUBSCRIPTION_TIERS[tier];

    switch (feature) {
      case 'max_users':
        return tierConfig.features.maxUsers || 1;
      case 'integrations_level':
        return tierConfig.features.integrations || 'none';
      case 'support_level':
        return tierConfig.features.prioritySupport || 'basic';
      default:
        return 'unlimited';
    }
  };

  // Cache invalidation functions
  const invalidateUsageCache = useCallback(() => {
    if (user) {
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.usage(user.id)
      });
    }
  }, [user, queryClient]);

  const refreshUsage = useCallback(async () => {
    if (user) {
      console.log('Refreshing usage stats via React Query...');
      await queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.usage(user.id)
      });
      return refetch();
    }
  }, [user, queryClient, refetch]);

  // Invalidate cache when receipts are uploaded (for external use)
  const invalidateOnReceiptUpload = useCallback(() => {
    invalidateUsageCache();
    // Also invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  }, [invalidateUsageCache, queryClient]);

  return {
    // Legacy API for backward compatibility
    limits,
    usage,
    isLoading,
    error,

    // Enhanced React Query features
    usageStats, // Raw React Query data
    dataUpdatedAt, // When data was last updated
    lastFetchTime: dataUpdatedAt, // Alias for backward compatibility

    // Functions
    checkCanUpload,
    checkCanUploadBatch,
    getUpgradeMessage,
    getCurrentTier,
    isFeatureAvailable,
    isFeatureAvailableAsync,
    getFeatureLimit,
    refreshUsage,

    // Cache management
    invalidateUsageCache,
    invalidateOnReceiptUpload,

    // React Query utilities
    refetch,
    queryClient,
  };
};
