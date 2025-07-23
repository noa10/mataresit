import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from "https://esm.sh/stripe@14.21.0";

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, userId, subscriptionId } = await req.json();

    console.log('Billing auto-renewal request:', { action, userId, subscriptionId });

    switch (action) {
      case 'process_upcoming_renewals':
        return await processUpcomingRenewals();
      
      case 'handle_payment_retry':
        return await handlePaymentRetry(subscriptionId);
      
      case 'process_grace_period_expiry':
        return await processGracePeriodExpiry();
      
      case 'update_auto_renewal_settings':
        return await updateAutoRenewalSettings(userId, await req.json());
      
      case 'check_subscription_health':
        return await checkSubscriptionHealth(userId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Error in billing auto-renewal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Process upcoming renewals and schedule reminder emails
 */
async function processUpcomingRenewals() {
  console.log('Processing upcoming renewals...');
  
  try {
    // Get subscriptions that need renewal reminders
    const { data: upcomingRenewals, error } = await supabaseClient.rpc('get_upcoming_renewals');
    
    if (error) {
      throw new Error(`Failed to get upcoming renewals: ${error.message}`);
    }

    const results = [];
    
    for (const renewal of upcomingRenewals || []) {
      try {
        // Get user's billing preferences
        const billingPrefs = await getBillingPreferences(renewal.user_id);
        
        if (!billingPrefs.auto_renewal_enabled) {
          console.log(`Auto-renewal disabled for user ${renewal.user_id}, skipping`);
          continue;
        }

        // Check if we need to send reminder emails
        const daysUntilRenewal = Math.ceil(
          (new Date(renewal.next_renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (billingPrefs.reminder_days_before_renewal.includes(daysUntilRenewal)) {
          await scheduleReminderEmail(renewal, daysUntilRenewal);
        }

        // Update renewal tracking
        await supabaseClient.rpc('update_subscription_renewal_tracking', {
          p_user_id: renewal.user_id,
          p_stripe_subscription_id: renewal.stripe_subscription_id,
          p_current_period_start: renewal.current_period_start,
          p_current_period_end: renewal.current_period_end,
          p_current_tier: renewal.current_tier,
          p_current_price_id: renewal.current_price_id
        });

        results.push({
          user_id: renewal.user_id,
          status: 'processed',
          days_until_renewal: daysUntilRenewal,
          reminder_scheduled: billingPrefs.reminder_days_before_renewal.includes(daysUntilRenewal)
        });

      } catch (error) {
        console.error(`Error processing renewal for user ${renewal.user_id}:`, error);
        results.push({
          user_id: renewal.user_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing upcoming renewals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle payment retry logic
 */
async function handlePaymentRetry(subscriptionId: string) {
  console.log(`Handling payment retry for subscription ${subscriptionId}`);
  
  try {
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get user from database
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Get billing preferences
    const billingPrefs = await getBillingPreferences(profile.id);
    
    // Get current retry tracking
    const { data: retryTracking, error: retryError } = await supabaseClient
      .from('payment_retry_tracking')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (retryError && retryError.code !== 'PGRST116') {
      throw new Error(`Failed to get retry tracking: ${retryError.message}`);
    }

    // If no retry tracking exists, this might be the first failure
    if (!retryTracking) {
      console.log('No existing retry tracking found, this might be a new failure');
      return new Response(
        JSON.stringify({ message: 'No retry needed' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if we should retry
    if (retryTracking.attempt_number >= billingPrefs.max_payment_retry_attempts) {
      console.log('Maximum retry attempts reached, moving to grace period');
      
      // Update retry tracking to abandoned
      await supabaseClient
        .from('payment_retry_tracking')
        .update({
          status: 'abandoned',
          abandoned_at: new Date().toISOString()
        })
        .eq('id', retryTracking.id);

      // Start grace period
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + billingPrefs.grace_period_days);

      await supabaseClient
        .from('profiles')
        .update({
          grace_period_end_date: gracePeriodEnd.toISOString(),
          subscription_status: 'past_due'
        })
        .eq('id', profile.id);

      // Schedule grace period warning email
      await scheduleGracePeriodEmail(profile, gracePeriodEnd);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'grace_period_started',
          grace_period_end: gracePeriodEnd.toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Attempt to retry the payment
    try {
      // Get the latest invoice for this subscription
      const invoices = await stripe.invoices.list({
        subscription: subscriptionId,
        limit: 1,
        status: 'open'
      });

      if (invoices.data.length === 0) {
        throw new Error('No open invoice found for retry');
      }

      const invoice = invoices.data[0];
      
      // Attempt to pay the invoice
      const paidInvoice = await stripe.invoices.pay(invoice.id);
      
      if (paidInvoice.status === 'paid') {
        // Payment succeeded, update retry tracking
        await supabaseClient
          .from('payment_retry_tracking')
          .update({
            status: 'succeeded',
            succeeded_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', retryTracking.id);

        // Update profile status
        await supabaseClient
          .from('profiles')
          .update({
            subscription_status: 'active',
            grace_period_end_date: null,
            payment_retry_attempts: 0
          })
          .eq('id', profile.id);

        // Log successful retry
        await supabaseClient.rpc('log_billing_event', {
          p_user_id: profile.id,
          p_event_type: 'payment_retry_succeeded',
          p_event_description: `Payment retry succeeded after ${retryTracking.attempt_number} attempts`,
          p_stripe_subscription_id: subscriptionId,
          p_metadata: {
            retry_attempt: retryTracking.attempt_number,
            invoice_id: invoice.id,
            amount_paid: paidInvoice.amount_paid
          },
          p_triggered_by: 'system'
        });

        return new Response(
          JSON.stringify({
            success: true,
            action: 'payment_retry_succeeded',
            attempt: retryTracking.attempt_number
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } catch (paymentError) {
      console.error('Payment retry failed:', paymentError);
      
      // Update retry tracking with failure
      const nextRetryAt = new Date();
      nextRetryAt.setHours(nextRetryAt.getHours() + billingPrefs.retry_interval_hours);

      await supabaseClient
        .from('payment_retry_tracking')
        .update({
          attempt_number: retryTracking.attempt_number + 1,
          next_retry_at: nextRetryAt.toISOString(),
          last_attempt_at: new Date().toISOString(),
          last_error_code: paymentError.code || 'unknown',
          last_error_message: paymentError.message
        })
        .eq('id', retryTracking.id);

      // Schedule payment failed email
      await schedulePaymentFailedEmail(profile, retryTracking.attempt_number + 1, billingPrefs.max_payment_retry_attempts);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'payment_retry_failed',
          attempt: retryTracking.attempt_number + 1,
          next_retry_at: nextRetryAt.toISOString(),
          error: paymentError.message
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error handling payment retry:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Process grace period expiry
 */
async function processGracePeriodExpiry() {
  console.log('Processing grace period expiry...');

  try {
    // Get users whose grace period has expired
    const { data: expiredUsers, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .not('grace_period_end_date', 'is', null)
      .lte('grace_period_end_date', new Date().toISOString())
      .neq('subscription_tier', 'free');

    if (error) {
      throw new Error(`Failed to get expired grace periods: ${error.message}`);
    }

    const results = [];

    for (const user of expiredUsers || []) {
      try {
        // Cancel the Stripe subscription
        if (user.stripe_subscription_id) {
          await stripe.subscriptions.cancel(user.stripe_subscription_id);
        }

        // Update user to free tier
        await supabaseClient
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            grace_period_end_date: null,
            subscription_end_date: new Date().toISOString()
          })
          .eq('id', user.id);

        // Schedule subscription expiry email
        await scheduleSubscriptionExpiryEmail(user);

        // Log the expiry
        await supabaseClient.rpc('log_billing_event', {
          p_user_id: user.id,
          p_event_type: 'grace_period_expired',
          p_event_description: 'Grace period expired, subscription canceled',
          p_stripe_subscription_id: user.stripe_subscription_id,
          p_old_values: {
            subscription_tier: user.subscription_tier,
            subscription_status: user.subscription_status
          },
          p_new_values: {
            subscription_tier: 'free',
            subscription_status: 'canceled'
          },
          p_triggered_by: 'system'
        });

        results.push({
          user_id: user.id,
          status: 'expired',
          previous_tier: user.subscription_tier
        });

      } catch (error) {
        console.error(`Error processing grace period expiry for user ${user.id}:`, error);
        results.push({
          user_id: user.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing grace period expiry:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Update auto-renewal settings for a user
 */
async function updateAutoRenewalSettings(userId: string, settings: any) {
  console.log(`Updating auto-renewal settings for user ${userId}`);

  try {
    const {
      auto_renewal_enabled,
      auto_renewal_frequency,
      billing_email_enabled,
      reminder_days_before_renewal,
      max_payment_retry_attempts,
      retry_interval_hours,
      grace_period_days
    } = settings;

    // Update billing preferences
    const { error } = await supabaseClient
      .from('billing_preferences')
      .upsert({
        user_id: userId,
        auto_renewal_enabled,
        auto_renewal_frequency,
        billing_email_enabled,
        reminder_days_before_renewal,
        max_payment_retry_attempts,
        retry_interval_hours,
        grace_period_days,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to update billing preferences: ${error.message}`);
    }

    // Log the settings update
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: userId,
      p_event_type: 'auto_renewal_settings_updated',
      p_event_description: 'User updated auto-renewal settings',
      p_new_values: {
        auto_renewal_enabled,
        auto_renewal_frequency,
        billing_email_enabled,
        reminder_days_before_renewal,
        max_payment_retry_attempts,
        retry_interval_hours,
        grace_period_days
      },
      p_triggered_by: 'user'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-renewal settings updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating auto-renewal settings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Check subscription health for a user
 */
async function checkSubscriptionHealth(userId: string) {
  console.log(`Checking subscription health for user ${userId}`);

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const health = {
      user_id: userId,
      subscription_tier: profile.subscription_tier,
      subscription_status: profile.subscription_status,
      issues: [],
      recommendations: [],
      next_actions: []
    };

    // Check if subscription is active
    if (profile.subscription_tier !== 'free' && profile.subscription_status !== 'active') {
      health.issues.push({
        type: 'subscription_inactive',
        severity: 'high',
        message: `Subscription status is ${profile.subscription_status}`
      });
    }

    // Check for grace period
    if (profile.grace_period_end_date) {
      const gracePeriodEnd = new Date(profile.grace_period_end_date);
      const daysLeft = Math.ceil((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      health.issues.push({
        type: 'grace_period_active',
        severity: daysLeft <= 1 ? 'critical' : 'high',
        message: `Grace period expires in ${daysLeft} days`,
        expires_at: profile.grace_period_end_date
      });

      health.next_actions.push('Update payment method to restore subscription');
    }

    // Check for failed payment retries
    if (profile.stripe_subscription_id) {
      const { data: retryTracking } = await supabaseClient
        .from('payment_retry_tracking')
        .select('*')
        .eq('stripe_subscription_id', profile.stripe_subscription_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (retryTracking) {
        health.issues.push({
          type: 'payment_retry_pending',
          severity: 'medium',
          message: `Payment retry attempt ${retryTracking.attempt_number} of ${retryTracking.max_attempts}`,
          next_retry_at: retryTracking.next_retry_at
        });
      }
    }

    // Get billing preferences
    const billingPrefs = await getBillingPreferences(userId);

    // Check auto-renewal settings
    if (profile.subscription_tier !== 'free' && !billingPrefs.auto_renewal_enabled) {
      health.recommendations.push({
        type: 'enable_auto_renewal',
        message: 'Enable auto-renewal to avoid service interruption'
      });
    }

    // Check if payment method is on file (via Stripe)
    if (profile.stripe_customer_id && profile.subscription_tier !== 'free') {
      try {
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        if (customer && !customer.deleted) {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: profile.stripe_customer_id,
            type: 'card'
          });

          if (paymentMethods.data.length === 0) {
            health.issues.push({
              type: 'no_payment_method',
              severity: 'high',
              message: 'No payment method on file'
            });
            health.next_actions.push('Add a payment method');
          }
        }
      } catch (stripeError) {
        console.error('Error checking Stripe customer:', stripeError);
        health.issues.push({
          type: 'stripe_customer_error',
          severity: 'medium',
          message: 'Unable to verify payment method status'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        health
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking subscription health:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// Helper Functions

/**
 * Get billing preferences for a user
 */
async function getBillingPreferences(userId: string) {
  const { data, error } = await supabaseClient.rpc('get_billing_preferences', {
    p_user_id: userId
  });

  if (error) {
    console.error('Error getting billing preferences:', error);
    // Return defaults if error
    return {
      auto_renewal_enabled: true,
      auto_renewal_frequency: 'monthly',
      billing_email_enabled: true,
      reminder_days_before_renewal: [7, 3, 1],
      payment_failure_notifications: true,
      grace_period_notifications: true,
      max_payment_retry_attempts: 3,
      retry_interval_hours: 24,
      grace_period_days: 7,
      preferred_language: 'en',
      timezone: 'UTC'
    };
  }

  return data[0] || {
    auto_renewal_enabled: true,
    auto_renewal_frequency: 'monthly',
    billing_email_enabled: true,
    reminder_days_before_renewal: [7, 3, 1],
    payment_failure_notifications: true,
    grace_period_notifications: true,
    max_payment_retry_attempts: 3,
    retry_interval_hours: 24,
    grace_period_days: 7,
    preferred_language: 'en',
    timezone: 'UTC'
  };
}

/**
 * Schedule a billing reminder email
 */
async function scheduleReminderEmail(renewal: any, daysUntilRenewal: number) {
  console.log(`Scheduling reminder email for user ${renewal.user_id}, ${daysUntilRenewal} days until renewal`);

  // Get user profile for email details
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', renewal.user_id)
    .single();

  if (error || !profile) {
    console.error('Error getting user profile for email:', error);
    return;
  }

  // Get billing preferences for language
  const billingPrefs = await getBillingPreferences(renewal.user_id);

  // Schedule the reminder email
  await supabaseClient.rpc('schedule_billing_reminder', {
    p_user_id: renewal.user_id,
    p_subscription_id: renewal.stripe_subscription_id,
    p_reminder_type: 'upcoming_renewal',
    p_scheduled_for: new Date().toISOString(), // Send immediately
    p_template_data: {
      recipientName: profile.full_name || profile.email,
      recipientEmail: profile.email,
      subscriptionTier: renewal.current_tier,
      renewalDate: renewal.next_renewal_date,
      amount: renewal.amount || 0,
      currency: renewal.currency || 'usd',
      billingInterval: billingPrefs.auto_renewal_frequency,
      daysUntilRenewal: daysUntilRenewal,
      paymentMethodLast4: renewal.payment_method_last_four,
      paymentMethodBrand: renewal.payment_method_brand,
      manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`,
      updatePaymentMethodUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing?tab=payment-method`
    },
    p_language: billingPrefs.preferred_language
  });
}

/**
 * Schedule a payment failed email
 */
async function schedulePaymentFailedEmail(profile: any, attemptNumber: number, maxAttempts: number) {
  console.log(`Scheduling payment failed email for user ${profile.id}, attempt ${attemptNumber}/${maxAttempts}`);

  const billingPrefs = await getBillingPreferences(profile.id);

  if (!billingPrefs.payment_failure_notifications) {
    console.log('Payment failure notifications disabled for user');
    return;
  }

  await supabaseClient.rpc('schedule_billing_reminder', {
    p_user_id: profile.id,
    p_subscription_id: profile.stripe_subscription_id,
    p_reminder_type: 'payment_failed',
    p_scheduled_for: new Date().toISOString(),
    p_template_data: {
      recipientName: profile.full_name || profile.email,
      recipientEmail: profile.email,
      subscriptionTier: profile.subscription_tier,
      amount: 0, // Will be filled from invoice data
      currency: 'usd',
      retryAttempt: attemptNumber,
      maxRetryAttempts: maxAttempts,
      gracePeriodEndDate: profile.grace_period_end_date,
      updatePaymentMethodUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing?tab=payment-method`,
      manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`
    },
    p_language: billingPrefs.preferred_language
  });
}

/**
 * Schedule a grace period warning email
 */
async function scheduleGracePeriodEmail(profile: any, gracePeriodEnd: Date) {
  console.log(`Scheduling grace period email for user ${profile.id}`);

  const billingPrefs = await getBillingPreferences(profile.id);

  if (!billingPrefs.grace_period_notifications) {
    console.log('Grace period notifications disabled for user');
    return;
  }

  await supabaseClient.rpc('schedule_billing_reminder', {
    p_user_id: profile.id,
    p_subscription_id: profile.stripe_subscription_id,
    p_reminder_type: 'grace_period_warning',
    p_scheduled_for: new Date().toISOString(),
    p_template_data: {
      recipientName: profile.full_name || profile.email,
      recipientEmail: profile.email,
      subscriptionTier: profile.subscription_tier,
      gracePeriodEndDate: gracePeriodEnd.toISOString(),
      updatePaymentMethodUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing?tab=payment-method`,
      manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`
    },
    p_language: billingPrefs.preferred_language
  });
}

/**
 * Schedule a subscription expiry email
 */
async function scheduleSubscriptionExpiryEmail(profile: any) {
  console.log(`Scheduling subscription expiry email for user ${profile.id}`);

  const billingPrefs = await getBillingPreferences(profile.id);

  await supabaseClient.rpc('schedule_billing_reminder', {
    p_user_id: profile.id,
    p_subscription_id: profile.stripe_subscription_id,
    p_reminder_type: 'subscription_expiry',
    p_scheduled_for: new Date().toISOString(),
    p_template_data: {
      recipientName: profile.full_name || profile.email,
      recipientEmail: profile.email,
      subscriptionTier: profile.subscription_tier,
      expiryDate: profile.subscription_end_date || new Date().toISOString(),
      isInGracePeriod: false,
      renewSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/pricing`,
      manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`
    },
    p_language: billingPrefs.preferred_language
  });
}
