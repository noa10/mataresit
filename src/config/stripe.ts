export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';

export const PRICE_IDS = {
  pro: {
    monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    annual: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual',
  },
  max: {
    monthly: import.meta.env.VITE_STRIPE_MAX_MONTHLY_PRICE_ID || 'price_max_monthly',
    annual: import.meta.env.VITE_STRIPE_MAX_ANNUAL_PRICE_ID || 'price_max_annual',
  }
};

export const FREE_PLAN_ID = 'free';

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    monthlyReceipts: 50,
    storageLimitMB: 1024, // 1GB
    retentionDays: 7,
    batchUploadLimit: 5,
    features: {
      versionControl: false,
      integrations: false,
      customBranding: false,
      prioritySupport: false,
      advancedAnalytics: false,
      apiAccess: false,
      unlimitedUsers: false,
    }
  },
  pro: {
    name: 'Pro',
    monthlyReceipts: 500,
    storageLimitMB: 10240, // 10GB
    retentionDays: 90,
    batchUploadLimit: 50,
    features: {
      versionControl: true,
      integrations: 'basic',
      customBranding: true,
      prioritySupport: 'standard',
      advancedAnalytics: true,
      apiAccess: false,
      unlimitedUsers: false,
      maxUsers: 5,
    }
  },
  max: {
    name: 'Max',
    monthlyReceipts: -1, // unlimited
    storageLimitMB: -1, // unlimited
    retentionDays: 365,
    batchUploadLimit: 100,
    features: {
      versionControl: true,
      integrations: 'advanced',
      customBranding: true,
      prioritySupport: 'priority',
      advancedAnalytics: true,
      apiAccess: true,
      unlimitedUsers: true,
      maxUsers: -1, // unlimited
    }
  }
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';

export interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  trialEndDate?: string;
  receiptsUsedThisMonth: number;
  monthlyResetDate?: string;
  simulated?: boolean;
}
