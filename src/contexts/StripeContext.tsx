import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLIC_KEY } from '@/config/stripe';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SubscriptionData, SubscriptionTier, SubscriptionStatus } from '@/config/stripe';

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

interface StripeContextType {
  createCheckoutSession: (priceId: string, billingInterval?: 'monthly' | 'annual') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  createPortalSession: () => Promise<void>;
  getSubscriptionStatus: () => Promise<SubscriptionData | null>;
  isLoading: boolean;
  subscriptionData: SubscriptionData | null;
  refreshSubscription: () => Promise<SubscriptionData | null>;
}

const StripeContext = createContext<StripeContextType | undefined>(undefined);

export const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);

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
        return null;
      }

      if (profile) {
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
        };

        console.log('StripeContext: Updated subscription data:', {
          tier: newSubscriptionData.tier,
          status: newSubscriptionData.status,
          stripeSubscriptionId: newSubscriptionData.stripeSubscriptionId
        });

        setSubscriptionData(newSubscriptionData);
        return newSubscriptionData;
      }
    } catch (error) {
      console.error('StripeContext: Error refreshing subscription:', error);
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
      createPortalSession,
      getSubscriptionStatus,
      isLoading,
      subscriptionData,
      refreshSubscription,
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
