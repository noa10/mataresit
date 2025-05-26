import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { action } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get user's profile with Stripe info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    switch (action) {
      case 'get_status':
        return await getSubscriptionStatus(stripe, profile, corsHeaders);

      case 'cancel':
        return await cancelSubscription(stripe, profile, corsHeaders);

      case 'create_portal_session':
        return await createPortalSession(stripe, profile, req, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

  } catch (error) {
    console.error('Error managing subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
  const baseUrl = req.headers.get('origin') || 'http://localhost:8080';

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${baseUrl}/account/billing`,
  });

  return new Response(
    JSON.stringify({ url: session.url }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

function mapPriceIdToTier(priceId: string): 'free' | 'pro' | 'max' {
  const priceToTierMap: Record<string, 'free' | 'pro' | 'max'> = {
    // Your actual Stripe price IDs from .env.local
    'price_1RSiggPHa6JfBjtMFGNcoKnZ': 'pro',  // Pro Monthly
    'price_1RSiiHPHa6JfBjtMOIItG7RA': 'pro',  // Pro Annual
    'price_1RSiixPHa6JfBjtMXI9INFRf': 'max',  // Max Monthly
    'price_1RSik1PHa6JfBjtMbYhspNSR': 'max',  // Max Annual
  };

  return priceToTierMap[priceId] || 'free';
}
