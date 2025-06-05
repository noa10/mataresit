#!/usr/bin/env node

/**
 * Test script to simulate and debug the payment flow
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateSuccessfulPayment(userEmail, priceId = 'price_1RSiggPHa6JfBjtMFGNcoKnZ') {
  console.log('🧪 Simulating successful payment flow for:', userEmail);
  console.log('===============================================');

  try {
    // 1. Find the user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (profileError || !profile) {
      console.error('❌ User not found:', userEmail);
      return;
    }

    console.log('✅ User found:', {
      id: profile.id,
      email: profile.email,
      currentTier: profile.subscription_tier,
      stripeCustomerId: profile.stripe_customer_id
    });

    // 2. Simulate webhook processing
    console.log('\n🔄 Simulating webhook processing...');
    
    // Map price ID to tier
    const priceToTierMap = {
      'price_1RSiggPHa6JfBjtMFGNcoKnZ': 'pro',  // Pro Monthly
      'price_1RSiiHPHa6JfBjtMOIItG7RA': 'pro',  // Pro Annual
      'price_1RSiixPHa6JfBjtMXI9INFRf': 'max',  // Max Monthly
      'price_1RSik1PHa6JfBjtMbYhspNSR': 'max',  // Max Annual
    };

    const targetTier = priceToTierMap[priceId] || 'pro';
    const fakeSubscriptionId = `sub_simulated_${Date.now()}`;
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log(`📝 Updating subscription: ${profile.stripe_customer_id} -> ${targetTier}`);

    // 3. Call the update function
    const { data, error } = await supabase.rpc('update_subscription_from_stripe', {
      _stripe_customer_id: profile.stripe_customer_id,
      _stripe_subscription_id: fakeSubscriptionId,
      _tier: targetTier,
      _status: 'active',
      _current_period_start: now.toISOString(),
      _current_period_end: nextMonth.toISOString(),
      _trial_end: null,
    });

    if (error) {
      console.error('❌ Error updating subscription:', error);
      return;
    }

    console.log('✅ Subscription updated successfully');

    // 4. Verify the update
    const { data: updatedProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status, stripe_subscription_id')
      .eq('id', profile.id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return;
    }

    console.log('✅ Verification results:', {
      tier: updatedProfile.subscription_tier,
      status: updatedProfile.subscription_status,
      subscriptionId: updatedProfile.stripe_subscription_id
    });

    // 5. Test payment success page logic
    console.log('\n🎯 Testing payment success page logic...');
    
    // Simulate what the payment success page does
    const { data: subscriptionData } = await supabase
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
      .eq('id', profile.id)
      .single();

    if (subscriptionData && subscriptionData.subscription_tier !== 'free') {
      console.log('✅ Payment success page would show:', {
        tier: subscriptionData.subscription_tier,
        status: subscriptionData.subscription_status,
        planName: subscriptionData.subscription_tier === 'pro' ? 'Pro Plan' : 'Max Plan'
      });
    } else {
      console.log('❌ Payment success page would redirect to dashboard (tier still free)');
    }

    return {
      success: true,
      tier: updatedProfile.subscription_tier,
      subscriptionId: updatedProfile.stripe_subscription_id
    };

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

async function checkWebhookConfiguration() {
  console.log('🔍 Checking webhook configuration...');
  console.log('=====================================');

  // Check if we can access the webhook function
  try {
    const response = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/stripe-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: true })
    });

    console.log('Webhook endpoint status:', response.status);
    
    if (response.status === 400) {
      console.log('✅ Webhook endpoint is accessible (400 expected for test request)');
    } else {
      console.log('⚠️  Unexpected response status:', response.status);
    }

  } catch (error) {
    console.error('❌ Error accessing webhook endpoint:', error.message);
  }
}

// Main execution
const command = process.argv[2];
const userEmail = process.argv[3];
const priceId = process.argv[4];

if (command === 'simulate' && userEmail) {
  simulateSuccessfulPayment(userEmail, priceId);
} else if (command === 'check-webhook') {
  checkWebhookConfiguration();
} else {
  console.log('Usage:');
  console.log('  node scripts/test-payment-flow.js simulate <email> [price_id]');
  console.log('  node scripts/test-payment-flow.js check-webhook');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-payment-flow.js simulate samcodersam7@gmail.com');
  console.log('  node scripts/test-payment-flow.js simulate samcodersam7@gmail.com price_1RSiggPHa6JfBjtMFGNcoKnZ');
  console.log('  node scripts/test-payment-flow.js check-webhook');
}
