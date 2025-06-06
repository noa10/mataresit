import { useState, useEffect } from 'react';
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
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { subscriptionData } = useStripe();
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && subscriptionData) {
      fetchSubscriptionLimits();
      fetchUsageData();
    }
  }, [user, subscriptionData]);

  const fetchSubscriptionLimits = async () => {
    if (!subscriptionData) return;

    try {
      const { data, error } = await supabase
        .from('subscription_limits')
        .select('*')
        .eq('tier', subscriptionData.tier)
        .single();

      if (error) throw error;

      setLimits({
        monthlyReceipts: data.monthly_receipts,
        storageLimitMB: data.storage_limit_mb,
        retentionDays: data.retention_days,
        batchUploadLimit: data.batch_upload_limit,
      });
    } catch (error) {
      console.error('Error fetching subscription limits:', error);
      // Fallback to default limits
      const tierLimits = SUBSCRIPTION_TIERS[subscriptionData.tier];
      setLimits({
        monthlyReceipts: tierLimits.monthlyReceipts,
        storageLimitMB: tierLimits.storageLimitMB,
        retentionDays: tierLimits.retentionDays,
        batchUploadLimit: tierLimits.batchUploadLimit,
      });
    }
  };

  const fetchUsageData = async () => {
    if (!user || !limits) return;

    try {
      // Get receipts count for current month
      const { count: receiptsCount, error: receiptsError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      if (receiptsError) throw receiptsError;

      // Calculate storage usage (this is a simplified calculation)
      // In a real implementation, you'd want to track actual file sizes
      const { data: receiptsWithImages, error: storageError } = await supabase
        .from('receipts')
        .select('image_url, thumbnail_url')
        .eq('user_id', user.id)
        .not('image_url', 'is', null);

      if (storageError) throw storageError;

      // Estimate storage usage (rough calculation)
      const estimatedStorageMB = (receiptsWithImages?.length || 0) * 0.5; // Assume 0.5MB per receipt on average

      const receiptsUsed = receiptsCount || 0;
      const receiptsRemaining = limits.monthlyReceipts === -1 
        ? -1 // Unlimited
        : Math.max(0, limits.monthlyReceipts - receiptsUsed);

      const storageRemainingMB = limits.storageLimitMB === -1
        ? -1 // Unlimited
        : Math.max(0, limits.storageLimitMB - estimatedStorageMB);

      setUsage({
        receiptsUsedThisMonth: receiptsUsed,
        receiptsRemaining,
        storageUsedMB: estimatedStorageMB,
        storageRemainingMB,
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  return {
    limits,
    usage,
    isLoading,
    checkCanUpload,
    checkCanUploadBatch,
    getUpgradeMessage,
    getCurrentTier,
    isFeatureAvailable,
    isFeatureAvailableAsync,
    getFeatureLimit,
    refreshUsage: fetchUsageData,
  };
};
