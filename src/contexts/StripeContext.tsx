import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLIC_KEY } from '@/config/stripe';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SubscriptionData, SubscriptionTier, SubscriptionStatus } from '@/config/stripe';

// Only load Stripe if we have a valid public key
const stripePromise = STRIPE_PUBLIC_KEY && STRIPE_PUBLIC_KEY.trim() !== ''
  ? loadStripe(STRIPE_PUBLIC_KEY)
  : Promise.resolve(null);

interface StripeContextType {
  createCheckoutSession: (priceId: string, billingInterval?: 'monthly' | 'annual') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downgradeSubscription: (targetTier: 'free' | 'pro' | 'max', immediate?: boolean) => Promise<void>;
  createPortalSession: () => Promise<void>;
  getSubscriptionStatus: () => Promise<SubscriptionData | null>;
  isLoading: boolean;
  subscriptionData: SubscriptionData | null;
  refreshSubscription: () => Promise<SubscriptionData | null>;
  forceRefreshSubscription: () => Promise<SubscriptionData | null>;
  lastRefreshTime: Date | null;
}

const StripeContext = createContext<StripeContextType | undefined>(undefined);

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
      console.log('StripeContext: Refreshing subscription data for user:', user.id);

      // Get subscription data from Supabase profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          subscription_tier,
          subscription_status,
          stripe_customer_id,
          stripe_subscription_id,
          subscription_start_date,
          subscription_end_date,
          trial_end_date,
          receipts_used_this_month,
          monthly_reset_date
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('StripeContext: Error fetching subscription data:', error);

        // If profile doesn't exist, create one with default values
        if (error.code === 'PGRST116') {
          console.log('StripeContext: Profile not found, this might be a new user');
          return {
            tier: 'free',
            status: 'active',
            receiptsUsedThisMonth: 0,
          };
        }
        return null;
      }

      if (profile) {
        // Check if user needs subscription initialization
        const needsInitialization = !profile.stripe_customer_id || !profile.stripe_subscription_id;

        if (needsInitialization) {
          console.log('StripeContext: User needs subscription initialization, setting up...');
          try {
            const { data: initData, error: initError } = await supabase.functions.invoke('initialize-user-subscription');

            if (initError) {
              console.error('StripeContext: Failed to initialize subscription:', initError);
            } else {
              console.log('StripeContext: Subscription initialized successfully:', initData);
              // Refresh the profile data after initialization
              const { data: updatedProfile, error: refreshError } = await supabase
                .from('profiles')
                .select(`
                  subscription_tier,
                  subscription_status,
                  stripe_customer_id,
                  stripe_subscription_id,
                  subscription_start_date,
                  subscription_end_date,
                  trial_end_date,
                  receipts_used_this_month,
                  monthly_reset_date
                `)
                .eq('id', user.id)
                .single();

              if (!refreshError && updatedProfile) {
                profile.stripe_customer_id = updatedProfile.stripe_customer_id;
                profile.stripe_subscription_id = updatedProfile.stripe_subscription_id;
                profile.subscription_start_date = updatedProfile.subscription_start_date;
                profile.subscription_end_date = updatedProfile.subscription_end_date;
              }
            }
          } catch (error) {
            console.error('StripeContext: Error during subscription initialization:', error);
          }
        }

        // Check if this is a simulated subscription
        const isSimulated = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                           profile.stripe_subscription_id?.startsWith('test_sub_') ||
                           profile.stripe_customer_id?.startsWith('cus_simulated_');

        const newSubscriptionData = {
          tier: (profile.subscription_tier as SubscriptionTier) || 'free',
          status: (profile.subscription_status as SubscriptionStatus) || 'active',
          stripeCustomerId: profile.stripe_customer_id,
          stripeSubscriptionId: profile.stripe_subscription_id,
          subscriptionStartDate: profile.subscription_start_date,
          subscriptionEndDate: profile.subscription_end_date,
          trialEndDate: profile.trial_end_date,
          receiptsUsedThisMonth: profile.receipts_used_this_month || 0,
          monthlyResetDate: profile.monthly_reset_date,
          simulated: isSimulated,
        };

        console.log('StripeContext: Updated subscription data:', {
          tier: newSubscriptionData.tier,
          status: newSubscriptionData.status,
          stripeSubscriptionId: newSubscriptionData.stripeSubscriptionId
        });

        setSubscriptionData(newSubscriptionData);
        setLastRefreshTime(new Date());
        return newSubscriptionData;
      }
    } catch (error) {
      console.error('StripeContext: Error refreshing subscription:', error);
    }

    return null;
  };

  // Force refresh with cache bypass for webhook failure scenarios
  const forceRefreshSubscription = async (): Promise<SubscriptionData | null> => {
    if (!user) return null;

    console.log('StripeContext: Force refreshing subscription data (bypassing cache)');

    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();

      // Get subscription data from Supabase profiles table with cache bypass
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          subscription_tier,
          subscription_status,
          stripe_customer_id,
          stripe_subscription_id,
          subscription_start_date,
          subscription_end_date,
          trial_end_date,
          receipts_used_this_month,
          monthly_reset_date
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('StripeContext: Error force refreshing subscription data:', error);
        return null;
      }

      if (profile) {
        // Check if this is a simulated subscription
        const isSimulated = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                           profile.stripe_subscription_id?.startsWith('test_sub_') ||
                           profile.stripe_customer_id?.startsWith('cus_simulated_');

        const newSubscriptionData: SubscriptionData = {
          tier: profile.subscription_tier || 'free',
          status: profile.subscription_status || 'active',
          stripeCustomerId: profile.stripe_customer_id,
          stripeSubscriptionId: profile.stripe_subscription_id,
          subscriptionStartDate: profile.subscription_start_date,
          subscriptionEndDate: profile.subscription_end_date,
          trialEndDate: profile.trial_end_date,
          receiptsUsedThisMonth: profile.receipts_used_this_month || 0,
          monthlyResetDate: profile.monthly_reset_date,
          simulated: isSimulated,
        };

        console.log('StripeContext: Force refresh successful:', newSubscriptionData);
        setSubscriptionData(newSubscriptionData);
        setLastRefreshTime(new Date());
        return newSubscriptionData;
      }
    } catch (error) {
      console.error('StripeContext: Error force refreshing subscription:', error);
    }

    return null;
  };

  const getSubscriptionStatus = async (): Promise<SubscriptionData | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_status' },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  };

  const createCheckoutSession = async (priceId: string, billingInterval: 'monthly' | 'annual' = 'monthly') => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }

    // Check if Stripe is properly configured
    if (!STRIPE_PUBLIC_KEY || STRIPE_PUBLIC_KEY.trim() === '') {
      console.error('Stripe public key is not configured');
      toast.error('Payment system is not configured. Please contact support.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, billingInterval },
      });

      if (error) throw error;

      if (data.url) {
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

      toast.success('Subscription will be canceled at the end of the current billing period');
      await refreshSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downgradeSubscription = async (targetTier: 'free' | 'pro' | 'max', immediate: boolean = true) => {
    if (!user) {
      toast.error('Please sign in to manage your subscription');
      return;
    }

    if (!subscriptionData) {
      toast.error('No active subscription found');
      return;
    }

    // Validate downgrade direction
    const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };
    const currentTierLevel = tierHierarchy[subscriptionData.tier];
    const targetTierLevel = tierHierarchy[targetTier];

    if (targetTierLevel >= currentTierLevel) {
      toast.error('You can only downgrade to a lower tier');
      return;
    }

    setIsLoading(true);
    try {
      console.log(`Downgrading from ${subscriptionData.tier} to ${targetTier}, immediate: ${immediate}`);

      // Debug: Check current session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session ? 'exists' : 'null');
      console.log('User ID:', user.id);
      console.log('Access token exists:', !!session?.access_token);

      if (!session?.access_token) {
        console.error('No valid session found, attempting to refresh...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          toast.error('Authentication session expired. Please sign in again.');
          return;
        }
        console.log('Session refreshed successfully');
      }

      // Test authentication first with get_status action
      console.log('Testing authentication with get_status...');
      const { data: statusData, error: statusError } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get_status' },
      });

      if (statusError) {
        console.error('Authentication test failed:', statusError);
        toast.error('Authentication failed. Please try signing out and back in.');
        return;
      }

      console.log('Authentication test successful, proceeding with downgrade...');

      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action: 'downgrade',
          targetTier,
          immediate
        },
      });

      if (error) throw error;

      // Show success message based on the response
      if (data.scheduledChange) {
        toast.success(`Your subscription will be downgraded to ${targetTier} at the end of your current billing period`);
      } else if (data.cancelAtPeriodEnd) {
        toast.success('Your subscription will be canceled at the end of your current billing period');
      } else {
        toast.success(data.message || `Successfully downgraded to ${targetTier}`);
      }

      // Refresh subscription data to reflect changes
      await refreshSubscription();
    } catch (error) {
      console.error('Error downgrading subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to downgrade subscription';
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

      if (data.url) {
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
      downgradeSubscription,
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
