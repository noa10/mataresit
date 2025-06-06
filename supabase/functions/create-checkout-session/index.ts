import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { mapPriceIdToTier } from '../_shared/stripe-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Debug: Log all headers
    console.log('=== Request Headers Debug ===');
    const authHeader = req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('apikey');
    console.log('Authorization header:', authHeader ? 'present' : 'missing');
    console.log('API Key header:', apiKeyHeader ? 'present' : 'missing');
    console.log('All headers:', Object.fromEntries(req.headers.entries()));

    if (!authHeader) {
      console.log('No Authorization header found - returning 401');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create client with user's auth token for user operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the user from the request
    console.log('Attempting to get user from auth header...');
    console.log('Environment check:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSupabaseAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasStripeKey: !!Deno.env.get('STRIPE_SECRET_KEY'),
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      anonKeyPreview: Deno.env.get('SUPABASE_ANON_KEY')?.substring(0, 20) + '...'
    });

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    console.log('JWT token preview:', token.substring(0, 50) + '...');

    // Verify the JWT token using the admin client
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

    console.log('User lookup result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userError: userError?.message,
      userErrorDetails: userError
    });

    if (!user) {
      console.log('No user found - returning 401');
      return new Response(
        JSON.stringify({
          error: 'Unauthorized - No user found',
          details: userError?.message || 'User lookup failed'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { priceId, billingInterval = 'monthly' } = await req.json();

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Price ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get or create customer
    let customerId: string;

    // Check if user already has a Stripe customer ID
    console.log('Looking up profile for user:', user.id);
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier, email')
      .eq('id', user.id)
      .single();

    console.log('Profile lookup result:', { profile, profileError });

    // Check if this is a simulated/test subscription user trying to upgrade
    const isSimulatedSubscription = profile?.stripe_subscription_id?.startsWith('sub_simulated_') ||
                                   profile?.stripe_subscription_id?.startsWith('test_sub_') ||
                                   profile?.stripe_customer_id?.startsWith('cus_simulated_');

    if (isSimulatedSubscription) {
      console.log('Detected simulated subscription user attempting upgrade');

      // For simulated subscriptions, simulate the upgrade by updating the database directly
      const targetTier = mapPriceIdToTier(priceId);
      console.log('Simulating upgrade to tier:', targetTier);

      // Update database to reflect the tier change
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
        console.error('RPC call failed for simulated upgrade:', rpcError);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription in database', details: rpcError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Database update successful for simulated upgrade:', rpcData);

      // Return a simulated success URL that redirects to a success page
      const baseUrl = req.headers.get('origin') || 'http://localhost:8080';
      const simulatedSuccessUrl = `${baseUrl}/payment-success?simulated=true&tier=${targetTier}`;

      return new Response(
        JSON.stringify({
          sessionId: 'sim_' + Date.now(),
          url: simulatedSuccessUrl,
          simulated: true,
          message: `Simulated upgrade to ${targetTier} tier`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Update profile with customer ID
      await supabaseClient
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          email: user.email
        })
        .eq('id', user.id);
    }

    // Determine success and cancel URLs based on environment
    const baseUrl = req.headers.get('origin') || 'http://localhost:8080';
    const successUrl = `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing`;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        billing_interval: billingInterval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          billing_interval: billingInterval,
        },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating checkout session:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Function now imported from _shared/stripe-config.ts
