import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  getBillingIntervalFromPriceId,
  getDebugInfo,
  isValidPriceId,
  resolveTierFromPriceId,
} from '../_shared/stripe-config.ts';
import { getFrontendUrl } from '../_shared/site-url.ts';
import { getServiceRoleKey } from '../_shared/service-role.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isSimulatedId = (value: string | null | undefined): boolean =>
  Boolean(
    value?.startsWith('cus_simulated_') ||
    value?.startsWith('sub_simulated_') ||
    value?.startsWith('test_sub_'),
  );

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = getServiceRoleKey();

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    // `getUser` returns a null user for an invalid or expired token; the outer
    // catch turns transport failures into a 500.
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: { priceId?: string; billingInterval?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { priceId, billingInterval = 'monthly' } = body;

    if (!priceId) {
      return jsonResponse({ error: 'Price ID is required' }, 400);
    }

    if (billingInterval !== 'monthly' && billingInterval !== 'annual') {
      return jsonResponse({ error: 'Billing interval must be monthly or annual' }, 400);
    }

    if (!isValidPriceId(priceId)) {
      console.error('Rejected unconfigured price ID', { priceId, debug: getDebugInfo(priceId) });
      return jsonResponse({ error: 'This price is not available' }, 400);
    }

    const priceInterval = getBillingIntervalFromPriceId(priceId);
    if (priceInterval !== billingInterval) {
      return jsonResponse({ error: 'Billing interval does not match the selected price' }, 400);
    }

    const targetTier = resolveTierFromPriceId(priceId);

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is missing');
      return jsonResponse({ error: 'Stripe is not configured' }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to load profile', profileError);
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    // Legacy simulated IDs are not real Stripe objects. Clear them before a
    // real checkout so the user cannot keep a fake paid entitlement.
    if (isSimulatedId(profile.stripe_customer_id) || isSimulatedId(profile.stripe_subscription_id)) {
      const { error: resetError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_tier: 'free',
          subscription_status: 'active',
          subscription_start_date: null,
          subscription_end_date: null,
          trial_end_date: null,
          cancel_at_period_end: false,
          billing_interval: 'monthly',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (resetError) {
        console.error('Failed to clear simulated subscription', resetError);
        return jsonResponse({ error: 'Could not prepare your account for checkout' }, 500);
      }

      profile.stripe_customer_id = null;
      profile.stripe_subscription_id = null;
    }

    let customerId: string | null = profile.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          email: user.email ?? profile.email ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to store Stripe customer ID', updateError);
        return jsonResponse({ error: 'Could not prepare your account for checkout' }, 500);
      }
    }

    // A second Checkout Session for an existing subscriber creates a second
    // subscription. Plan changes must go through manage-subscription.
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    const blockingSubscription = existingSubscriptions.data.find((subscription: Stripe.Subscription) =>
      !['canceled', 'incomplete_expired'].includes(subscription.status)
    );

    if (blockingSubscription) {
      return jsonResponse({
        error: 'You already have an active subscription. Use the plan change option instead.',
        code: 'SUBSCRIPTION_EXISTS',
        tier: targetTier,
      }, 409);
    }

    const baseUrl = getFrontendUrl();
    const successUrl = `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        tier: targetTier,
        billing_interval: billingInterval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier: targetTier,
          billing_interval: billingInterval,
        },
      },
    });

    return jsonResponse({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
