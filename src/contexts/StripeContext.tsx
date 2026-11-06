import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLIC_KEY } from '@/config/stripe';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SubscriptionData, SubscriptionTier, SubscriptionStatus } from '@/config/stripe';

type PaidTier = Exclude<SubscriptionTier, 'free'>;
type BillingInterval = 'monthly' | 'annual';

// Only load Stripe if we have a valid public key
const stripePromise = STRIPE_PUBLIC_KEY && STRIPE_PUBLIC_KEY.trim() !== ''
  ? loadStripe(STRIPE_PUBLIC_KEY)
  : Promise.resolve(null);

interface StripeContextType {
  createCheckoutSession: (priceId: string, billingInterval?: BillingInterval) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  downgradeSubscription: (targetTier: SubscriptionTier, immediate?: boolean, billingInterval?: BillingInterval) => Promise<void>;
  upgradeSubscription: (targetTier: PaidTier, billingInterval: BillingInterval) => Promise<void>;
  createPortalSession: () => Promise<void>;
  getSubscriptionStatus: () => Promise<SubscriptionData | null>;
  isLoading: boolean;
  subscriptionData: SubscriptionData | null;
  refreshSubscription: () => Promise<SubscriptionData | null>;
  forceRefreshSubscription: () => Promise<SubscriptionData | null>;
  lastRefreshTime: Date | null;
}

const StripeContext = createContext<StripeContextType | undefined>(undefined);

const PROFILE_SUBSCRIPTION_COLUMNS = `
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_start_date,
  subscription_end_date,
  trial_end_date,
  billing_interval,
  cancel_at_period_end,
  receipts_used_this_month,
  monthly_reset_date,
  next_billing_date,
  payment_method_brand,
  payment_method_last_four
`;

interface ProfileSubscriptionRow {
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  trial_end_date: string | null;
  billing_interval: string | null;
  cancel_at_period_end: boolean | null;
  receipts_used_this_month: number | null;
  monthly_reset_date: string | null;
  next_billing_date: string | null;
  payment_method_brand: string | null;
  payment_method_last_four: string | null;
}

/**
 * `billing_interval` is NULL until a profile has been reconciled from Stripe,
 * so a paid subscriber is never silently reported as monthly. A paid tier with
 * an unknown interval reports the conservative default and can be reconciled by
 * the webhook without the UI having lied first.
 */
function resolveBillingInterval(
  profile: ProfileSubscriptionRow,
): 'monthly' | 'annual' {
  return profile.billing_interval === 'annual' ? 'annual' : 'monthly';
}

function toSubscriptionData(profile: ProfileSubscriptionRow): SubscriptionData {
  return {
    tier: (profile.subscription_tier as SubscriptionTier) || 'free',
    status: (profile.subscription_status as SubscriptionStatus) || 'active',
    stripeCustomerId: profile.stripe_customer_id ?? undefined,
    stripeSubscriptionId: profile.stripe_subscription_id ?? undefined,
    subscriptionStartDate: profile.subscription_start_date ?? undefined,
    subscriptionEndDate: profile.subscription_end_date ?? undefined,
    trialEndDate: profile.trial_end_date ?? undefined,
    billingInterval: resolveBillingInterval(profile),
    billingIntervalReconciled: profile.billing_interval !== null,
    cancelAtPeriodEnd: Boolean(profile.cancel_at_period_end),
    receiptsUsedThisMonth: profile.receipts_used_this_month || 0,
    monthlyResetDate: profile.monthly_reset_date ?? undefined,
    next_billing_date: profile.next_billing_date ?? undefined,
    payment_method_brand: profile.payment_method_brand ?? undefined,
    payment_method_last_four: profile.payment_method_last_four ?? undefined,
  };
}

export const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setSubscriptionData(null);
    }
  }, [user]);

  const refreshSubscription = async (): Promise<SubscriptionData | null> => {
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(PROFILE_SUBSCRIPTION_COLUMNS)
        .eq('id', user.id)
        .single()
        .overrideTypes<ProfileSubscriptionRow, { merge: false }>();

      if (error) {
        if (error.code === 'PGRST116') {
          const fallback: SubscriptionData = {
            tier: 'free',
            status: 'active',
            receiptsUsedThisMonth: 0,
          };
          setSubscriptionData(fallback);
          return fallback;
        }
        console.error('StripeContext: Error fetching subscription data:', error);
        return null;
      }

      if (!profile) return null;

      const newSubscriptionData = toSubscriptionData(profile);
      setSubscriptionData(newSubscriptionData);
      setLastRefreshTime(new Date());
      return newSubscriptionData;
    } catch (error) {
      console.error('StripeContext: Error refreshing subscription:', error);
      return null;
    }
  };

  // Force refresh with cache bypass for webhook failure scenarios
  const forceRefreshSubscription = async (): Promise<SubscriptionData | null> => {
    if (!user) return null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(PROFILE_SUBSCRIPTION_COLUMNS)
        .eq('id', user.id)
        .single()
        .overrideTypes<ProfileSubscriptionRow, { merge: false }>();

      if (error || !profile) {
        console.error('StripeContext: Error force refreshing subscription data:', error);
        return null;
      }

      const newSubscriptionData = toSubscriptionData(profile);
      setSubscriptionData(newSubscriptionData);
      setLastRefreshTime(new Date());
      return newSubscriptionData;
    } catch (error) {
      console.error('StripeContext: Error force refreshing subscription:', error);
      return null;
    }
  };

  const getSubscriptionStatus = async (): Promise<SubscriptionData | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_status' },
      });

      if (error) throw error;
      return data as SubscriptionData;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  };

  const createCheckoutSession = async (
    priceId: string,
    billingInterval: BillingInterval = 'monthly',
  ) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }

    if (!STRIPE_PUBLIC_KEY || STRIPE_PUBLIC_KEY.trim() === '') {
      toast.error('Payment system is not configured. Please contact support.');
      return;
    }

    if (!priceId) {
      toast.error('This plan is not configured yet. Please contact support.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, billingInterval },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to create checkout session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel' },
      });

      if (error) throw error;

      toast.success(
        data?.effectiveDate
          ? `Subscription will be canceled on ${new Date(data.effectiveDate).toLocaleDateString()}.`
          : 'Subscription will be canceled at the end of the current billing period',
      );
      await refreshSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resumeSubscription = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'resume' },
      });

      if (error) throw error;

      toast.success(data?.message || 'Subscription resumed');
      await refreshSubscription();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      toast.error('Failed to resume subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downgradeSubscription = async (
    targetTier: SubscriptionTier,
    immediate: boolean = false,
    billingInterval?: BillingInterval,
  ) => {
    if (!user) {
      const message = 'Please sign in to manage your subscription';
      toast.error(message);
      throw new Error(message);
    }

    if (!subscriptionData) {
      const message = 'No active subscription found';
      toast.error(message);
      throw new Error(message);
    }

    const tierHierarchy = { free: 0, pro: 1, max: 2 };
    if (tierHierarchy[targetTier] >= tierHierarchy[subscriptionData.tier]) {
      const message = 'You can only downgrade to a lower tier';
      toast.error(message);
      throw new Error(message);
    }

    if (targetTier !== 'free' && !immediate && subscriptionData.cancelAtPeriodEnd) {
      const message = 'Resume your subscription before scheduling a plan change';
      toast.error(message);
      throw new Error(message);
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action: 'change_plan',
          targetTier,
          immediate,
          billingInterval,
        },
      });

      if (error) throw error;

      if (data?.scheduledChange) {
        toast.success(
          `Your plan will change to ${targetTier} on ${new Date(data.effectiveDate).toLocaleDateString()}`,
        );
      } else if (data?.cancelAtPeriodEnd) {
        toast.success(
          `Your subscription will be canceled on ${new Date(data.effectiveDate).toLocaleDateString()}`,
        );
      } else {
        toast.success(data?.message || `Successfully changed to ${targetTier}`);
      }

      await refreshSubscription();
    } catch (error) {
      console.error('Error downgrading subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to downgrade subscription';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeSubscription = async (
    targetTier: PaidTier,
    billingInterval: BillingInterval,
  ) => {
    if (!user) {
      toast.error('Please sign in to manage your subscription');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action: 'change_plan',
          targetTier,
          billingInterval,
          immediate: true,
        },
      });

      if (error) throw error;

      toast.success(data?.message || `Successfully changed to ${targetTier}`);
      await refreshSubscription();
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to change subscription';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const createPortalSession = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'create_portal_session' },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error('Failed to open billing portal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StripeContext.Provider value={{
      createCheckoutSession,
      cancelSubscription,
      resumeSubscription,
      downgradeSubscription,
      upgradeSubscription,
      createPortalSession,
      getSubscriptionStatus,
      isLoading,
      subscriptionData,
      refreshSubscription,
      forceRefreshSubscription,
      lastRefreshTime,
    }}>
      {children}
    </StripeContext.Provider>
  );
};

export const useStripe = () => {
  const context = useContext(StripeContext);
  if (context === undefined) {
    throw new Error('useStripe must be used within a StripeProvider');
  }
  return context;
};
