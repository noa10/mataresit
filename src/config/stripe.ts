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
    monthlyReceipts: 25,
    storageLimitMB: 100,
    retentionDays: 7,
    batchUploadLimit: 1,
  },
  pro: {
    name: 'Pro',
    monthlyReceipts: 200,
    storageLimitMB: 2048,
    retentionDays: 90,
    batchUploadLimit: 5,
  },
  max: {
    name: 'Max',
    monthlyReceipts: -1, // unlimited
    storageLimitMB: 10240,
    retentionDays: 365,
    batchUploadLimit: 20,
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
}
