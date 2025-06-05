import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== INITIALIZE USER SUBSCRIPTION FUNCTION START ===');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Extract JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

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

    console.log('Authenticated user:', user.id);

    // Check if user already has subscription setup
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
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

    // Check if user needs subscription setup
    const needsSetup = !profile.stripe_customer_id || !profile.stripe_subscription_id;

    if (!needsSetup) {
      console.log('User already has subscription setup');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User already has subscription setup',
          profile: {
            tier: profile.subscription_tier,
            status: profile.subscription_status,
            customer_id: profile.stripe_customer_id,
            subscription_id: profile.stripe_subscription_id
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Setting up simulated subscription for user:', user.id);

    // Generate simulated IDs
    const timestamp = Date.now();
    const simulatedCustomerId = `cus_simulated_${timestamp}_${user.id.substring(0, 8)}`;
    const simulatedSubscriptionId = `sub_simulated_${timestamp}_${user.id.substring(0, 8)}`;

    // Update the profile with simulated subscription data
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_customer_id: simulatedCustomerId,
        stripe_subscription_id: simulatedSubscriptionId,
        subscription_tier: profile.subscription_tier || 'free',
        subscription_status: profile.subscription_status || 'active',
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update user profile', details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Successfully set up simulated subscription for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Simulated subscription setup complete',
        profile: {
          tier: profile.subscription_tier || 'free',
          status: 'active',
          customer_id: simulatedCustomerId,
          subscription_id: simulatedSubscriptionId
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in initialize-user-subscription:', error);
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
