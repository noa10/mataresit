import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  mapPriceIdToTier,
  getTierPriceId,
  validateStripeEnvironment
} from '../_shared/stripe-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== MANAGE SUBSCRIPTION FUNCTION START ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Debug authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header present:', !!authHeader);
    console.log('Authorization header starts with Bearer:', authHeader?.startsWith('Bearer '));
    if (authHeader) {
      console.log('Authorization header length:', authHeader.length);
      console.log('Authorization header preview:', authHeader.substring(0, 20) + '...');
    }

    console.log('Creating Supabase client...');

    // Create a client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create a client with the user's JWT for user operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader! },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Getting user from auth...');

    // Try to decode JWT token manually first
    let jwtPayload = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = atob(parts[1]);
          jwtPayload = JSON.parse(payload);
          console.log('JWT payload decoded:', {
            sub: jwtPayload.sub,
            email: jwtPayload.email,
            exp: jwtPayload.exp,
            iat: jwtPayload.iat
          });
        }
      } catch (e) {
        console.error('Failed to decode JWT:', e.message);
      }
    }

    // Try to get user from the JWT token
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    console.log('User retrieval result:', {
      hasUser: !!user,
      userError: userError?.message,
      userId: user?.id,
      jwtUserId: jwtPayload?.sub
    });

    // If user retrieval failed but we have JWT payload, use that
    let userId = user?.id;
    if (!user && jwtPayload?.sub) {
      console.log('User retrieval failed, but JWT payload available. Using JWT user ID:', jwtPayload.sub);
      userId = jwtPayload.sub;
    }

    if (!userId) {
      console.error('No authenticated user found and no valid JWT payload');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Authenticated user:', userId);

    console.log('Parsing request body...');
    const requestBody = await req.json();
    const { action, targetTier, immediate } = requestBody;

    console.log('Request details:', { action, targetTier, immediate, userId });

    // Check environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY environment variable is missing');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Creating Stripe client...');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    console.log('Fetching user profile...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile', details: profileError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Profile data:', {
      hasCustomerId: !!profile?.stripe_customer_id,
      hasSubscriptionId: !!profile?.stripe_subscription_id,
      customerId: profile?.stripe_customer_id,
      subscriptionId: profile?.stripe_subscription_id
    });

    if (!profile?.stripe_customer_id) {
      console.error('No Stripe customer ID found in profile');
      return new Response(
        JSON.stringify({ error: 'No Stripe customer found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!action) {
      console.error('No action provided in request');
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing action:', action);

    switch (action) {
      case 'get_status':
        console.log('Calling getSubscriptionStatus...');
        return await getSubscriptionStatus(stripe, profile, corsHeaders);

      case 'cancel':
        console.log('Calling cancelSubscription...');
        return await cancelSubscription(stripe, profile, corsHeaders);

      case 'downgrade':
        console.log('Calling downgradeSubscription...');
        return await downgradeSubscription(stripe, profile, targetTier, immediate, corsHeaders, supabaseAdmin, userId);

      case 'create_portal_session':
        console.log('Calling createPortalSession...');
        return await createPortalSession(stripe, profile, req, corsHeaders);

      default:
        console.error('Invalid action provided:', action);
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

  } catch (error) {
    console.error('=== CRITICAL ERROR IN MANAGE SUBSCRIPTION ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error occurred',
        type: error.constructor.name,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getSubscriptionStatus(stripe: Stripe, profile: any, corsHeaders: any) {
  if (!profile.stripe_subscription_id) {
    return new Response(
      JSON.stringify({
        status: 'inactive',
        tier: 'free'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Check if this is a simulated/test subscription
    const isSimulatedSubscription = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                                   profile.stripe_subscription_id?.startsWith('test_sub_') ||
                                   profile.stripe_customer_id?.startsWith('cus_simulated_');

    if (isSimulatedSubscription) {
      console.log('Detected simulated subscription for status check');
      return new Response(
        JSON.stringify({
          status: 'active',
          tier: 'max', // Assume simulated subscriptions are max tier
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          cancelAtPeriodEnd: false,
          simulated: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    return new Response(
      JSON.stringify({
        status: subscription.status,
        tier: mapPriceIdToTier(subscription.items.data[0]?.price.id),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'inactive',
        tier: 'free',
        error: 'Subscription not found'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function cancelSubscription(stripe: Stripe, profile: any, corsHeaders: any) {
  if (!profile.stripe_subscription_id) {
    return new Response(
      JSON.stringify({ error: 'No active subscription found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  return new Response(
    JSON.stringify({
      success: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function createPortalSession(stripe: Stripe, profile: any, req: Request, corsHeaders: any) {
  console.log('=== CREATE PORTAL SESSION START ===');
  console.log('Profile data:', {
    stripe_customer_id: profile.stripe_customer_id,
    stripe_subscription_id: profile.stripe_subscription_id
  });

  const baseUrl = req.headers.get('origin') || 'http://localhost:8080';

  // Check if this is a simulated/test subscription
  const isSimulatedSubscription = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                                 profile.stripe_subscription_id?.startsWith('test_sub_') ||
                                 profile.stripe_customer_id?.startsWith('cus_simulated_');

  if (isSimulatedSubscription) {
    console.log('Detected simulated subscription for portal session');

    // For simulated subscriptions, redirect to a local billing management page
    // instead of trying to create a Stripe portal session
    const localBillingUrl = `${baseUrl}/account/billing?simulated=true`;

    return new Response(
      JSON.stringify({
        url: localBillingUrl,
        simulated: true,
        message: 'Redirecting to local billing management for simulated subscription'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  console.log('Creating real Stripe portal session for customer:', profile.stripe_customer_id);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/account/billing`,
    });

    console.log('Stripe portal session created successfully:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error creating Stripe portal session:', error);

    // If Stripe portal creation fails, fall back to local billing page
    const localBillingUrl = `${baseUrl}/account/billing?error=portal_unavailable`;

    return new Response(
      JSON.stringify({
        url: localBillingUrl,
        error: 'Stripe portal unavailable, redirecting to local billing management',
        details: error.message
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function downgradeSubscription(
  stripe: Stripe,
  profile: any,
  targetTier: 'free' | 'pro' | 'max',
  immediate: boolean = true,
  corsHeaders: any,
  supabaseAdmin: any,
  userId: string
) {
  console.log('=== DOWNGRADE SUBSCRIPTION START ===');
  console.log(`Downgrade request: targetTier=${targetTier}, immediate=${immediate}, userId=${userId}`);
  console.log('Profile data:', {
    stripe_customer_id: profile.stripe_customer_id,
    stripe_subscription_id: profile.stripe_subscription_id
  });

  // Handle downgrade to free tier (cancellation)
  if (targetTier === 'free') {
    console.log('Processing downgrade to free tier (cancellation)');

    if (!profile.stripe_subscription_id) {
      console.error('No subscription ID found for cancellation');
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (immediate) {
      console.log('Processing immediate cancellation');

      try {
        // Check if this is a simulated/test subscription
        const isSimulatedSubscription = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                                       profile.stripe_subscription_id?.startsWith('test_sub_') ||
                                       profile.stripe_customer_id?.startsWith('cus_simulated_');

        if (isSimulatedSubscription) {
          console.log('Detected simulated subscription for cancellation, handling gracefully');

          // Update database to reflect cancellation
          console.log('Updating database with RPC call for simulated cancellation...');
          const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('update_subscription_from_stripe', {
            _stripe_customer_id: profile.stripe_customer_id,
            _stripe_subscription_id: profile.stripe_subscription_id,
            _tier: 'free',
            _status: 'canceled',
            _current_period_start: new Date().toISOString(),
            _current_period_end: new Date().toISOString(),
            _trial_end: null,
          });

          if (rpcError) {
            console.error('RPC call failed for simulated cancellation:', rpcError);
            return new Response(
              JSON.stringify({ error: 'Failed to update subscription in database', details: rpcError.message }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Simulated subscription canceled immediately',
              newTier: 'free',
              effectiveDate: new Date().toISOString(),
              simulated: true
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        console.log('Canceling subscription with Stripe:', profile.stripe_subscription_id);
        const canceledSubscription = await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        console.log('Stripe cancellation successful:', canceledSubscription.status);

        console.log('Updating database with RPC call...');
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('update_subscription_from_stripe', {
          _stripe_customer_id: profile.stripe_customer_id,
          _stripe_subscription_id: profile.stripe_subscription_id,
          _tier: 'free',
          _status: 'canceled',
          _current_period_start: new Date().toISOString(),
          _current_period_end: new Date().toISOString(),
          _trial_end: null,
        });

        if (rpcError) {
          console.error('RPC call failed:', rpcError);
          return new Response(
            JSON.stringify({ error: 'Failed to update subscription in database', details: rpcError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        console.log('Database update successful:', rpcData);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Subscription canceled immediately',
            newTier: 'free',
            effectiveDate: new Date().toISOString()
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (stripeError) {
        console.error('Stripe cancellation failed:', stripeError);
        return new Response(
          JSON.stringify({ error: 'Failed to cancel subscription with Stripe', details: stripeError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // Cancel at period end
      const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription will be canceled at the end of the current billing period',
          newTier: 'free',
          effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Handle downgrade to a lower paid tier (e.g., Max -> Pro)
  console.log('Processing downgrade to lower paid tier');

  if (!profile.stripe_subscription_id) {
    console.error('No subscription ID found for paid tier downgrade');
    return new Response(
      JSON.stringify({ error: 'No active subscription found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  let currentSubscription;
  let currentTier;

  try {
    console.log('Retrieving current subscription from Stripe:', profile.stripe_subscription_id);

    // Check if this is a simulated/test subscription
    const isSimulatedSubscription = profile.stripe_subscription_id?.startsWith('sub_simulated_') ||
                                   profile.stripe_subscription_id?.startsWith('test_sub_') ||
                                   profile.stripe_customer_id?.startsWith('cus_simulated_');

    if (isSimulatedSubscription) {
      console.log('Detected simulated subscription for paid tier downgrade, updating database');

      // Update database to reflect the tier change
      console.log('Updating database with RPC call for simulated paid tier downgrade...');
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('update_subscription_from_stripe', {
        _stripe_customer_id: profile.stripe_customer_id,
        _stripe_subscription_id: profile.stripe_subscription_id,
        _tier: targetTier,
        _status: 'active',
        _current_period_start: new Date().toISOString(),
        _current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        _trial_end: null,
      });

      if (rpcError) {
        console.error('RPC call failed for simulated paid tier downgrade:', rpcError);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription in database', details: rpcError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Database update successful for simulated paid tier downgrade:', rpcData);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Simulated downgrade from max to ${targetTier} ${immediate ? 'immediately' : 'at period end'}`,
          newTier: targetTier,
          effectiveDate: immediate ? new Date().toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          simulated: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    currentSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    console.log('Current subscription retrieved:', {
      id: currentSubscription.id,
      status: currentSubscription.status,
      items: currentSubscription.items.data.length
    });

    const currentPriceId = currentSubscription.items.data[0]?.price.id;
    currentTier = mapPriceIdToTier(currentPriceId);

    console.log('Current subscription details:', {
      priceId: currentPriceId,
      currentTier: currentTier,
      targetTier: targetTier
    });

    // Validate downgrade direction
    const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };
    if (tierHierarchy[targetTier] >= tierHierarchy[currentTier]) {
      console.error('Invalid downgrade direction:', { currentTier, targetTier });
      return new Response(
        JSON.stringify({ error: 'Target tier is not a downgrade from current tier' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (stripeError) {
    console.error('Failed to retrieve current subscription:', stripeError);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve current subscription', details: stripeError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Determine billing interval from current subscription
  const isAnnual = currentSubscription.items.data[0]?.price.recurring?.interval === 'year';
  const billingInterval = isAnnual ? 'annual' : 'monthly';

  // Get target price ID
  console.log('Getting target price ID for:', { targetTier, billingInterval });
  const targetPriceId = getTierPriceId(targetTier, billingInterval);
  console.log('Target price ID:', targetPriceId);

  if (!targetPriceId) {
    console.error('No price ID found for target tier and billing interval');
    return new Response(
      JSON.stringify({ error: 'Invalid target tier or billing interval' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  if (immediate) {
    console.log('Processing immediate downgrade for paid tier');

    try {
      console.log('Updating subscription with Stripe:', {
        subscriptionId: profile.stripe_subscription_id,
        itemId: currentSubscription.items.data[0].id,
        newPriceId: targetPriceId
      });

      const updatedSubscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        items: [{
          id: currentSubscription.items.data[0].id,
          price: targetPriceId,
        }],
        proration_behavior: 'create_prorations', // Create credit for unused time
      });

      console.log('Stripe subscription update successful:', updatedSubscription.status);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Subscription downgraded to ${targetTier} immediately`,
          newTier: targetTier,
          effectiveDate: new Date().toISOString(),
          nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (stripeError) {
      console.error('Failed to update subscription with Stripe:', stripeError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: stripeError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } else {
    console.log('Processing scheduled downgrade for paid tier');

    try {
      console.log('Scheduling subscription downgrade with Stripe:', {
        subscriptionId: profile.stripe_subscription_id,
        itemId: currentSubscription.items.data[0].id,
        newPriceId: targetPriceId,
        currentPeriodEnd: new Date(currentSubscription.current_period_end * 1000).toISOString()
      });

      const updatedSubscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        items: [{
          id: currentSubscription.items.data[0].id,
          price: targetPriceId,
        }],
        proration_behavior: 'none', // No proration, change at period end
        billing_cycle_anchor: 'unchanged',
      });

      console.log('Stripe scheduled downgrade successful:', updatedSubscription.status);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Subscription will be downgraded to ${targetTier} at the end of the current billing period`,
          newTier: targetTier,
          effectiveDate: new Date(currentSubscription.current_period_end * 1000).toISOString(),
          scheduledChange: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (stripeError) {
      console.error('Failed to schedule subscription downgrade:', stripeError);
      return new Response(
        JSON.stringify({ error: 'Failed to schedule downgrade', details: stripeError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
}

// Functions now imported from _shared/stripe-config.ts
