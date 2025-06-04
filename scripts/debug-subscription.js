#!/usr/bin/env node

/**
 * Debug script to test subscription update functionality
 * This script helps diagnose issues with subscription tier updates
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSubscription(stripeCustomerId) {
  console.log('🔍 Debugging subscription for customer:', stripeCustomerId);
  console.log('=====================================');

  try {
    // 1. Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    if (!profile) {
      console.error('❌ No profile found for stripe_customer_id:', stripeCustomerId);
      return;
    }

    console.log('✅ Profile found:');
    console.log('  - User ID:', profile.id);
    console.log('  - Email:', profile.email);
    console.log('  - Current Tier:', profile.subscription_tier);
    console.log('  - Current Status:', profile.subscription_status);
    console.log('  - Stripe Customer ID:', profile.stripe_customer_id);
    console.log('  - Stripe Subscription ID:', profile.stripe_subscription_id);
    console.log('  - Subscription Start:', profile.subscription_start_date);
    console.log('  - Subscription End:', profile.subscription_end_date);

    // 2. Test the update function
    console.log('\n🧪 Testing subscription update function...');
    
    const testTier = 'max';
    const testStatus = 'active';
    const testSubscriptionId = 'sub_test_123';
    const testStart = new Date().toISOString();
    const testEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

    const { data: updateResult, error: updateError } = await supabase.rpc('update_subscription_from_stripe', {
      _stripe_customer_id: stripeCustomerId,
      _stripe_subscription_id: testSubscriptionId,
      _tier: testTier,
      _status: testStatus,
      _current_period_start: testStart,
      _current_period_end: testEnd,
      _trial_end: null,
    });

    if (updateError) {
      console.error('❌ Error calling update function:', updateError);
      return;
    }

    console.log('✅ Update function called successfully');

    // 3. Verify the update
    const { data: updatedProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status, stripe_subscription_id, subscription_start_date, subscription_end_date')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
      return;
    }

    console.log('✅ Verification results:');
    console.log('  - New Tier:', updatedProfile.subscription_tier);
    console.log('  - New Status:', updatedProfile.subscription_status);
    console.log('  - New Subscription ID:', updatedProfile.stripe_subscription_id);
    console.log('  - New Start Date:', updatedProfile.subscription_start_date);
    console.log('  - New End Date:', updatedProfile.subscription_end_date);

    // 4. Restore original values
    console.log('\n🔄 Restoring original values...');
    const { error: restoreError } = await supabase.rpc('update_subscription_from_stripe', {
      _stripe_customer_id: stripeCustomerId,
      _stripe_subscription_id: profile.stripe_subscription_id,
      _tier: profile.subscription_tier,
      _status: profile.subscription_status,
      _current_period_start: profile.subscription_start_date || new Date().toISOString(),
      _current_period_end: profile.subscription_end_date || new Date().toISOString(),
      _trial_end: profile.trial_end_date,
    });

    if (restoreError) {
      console.error('❌ Error restoring original values:', restoreError);
    } else {
      console.log('✅ Original values restored');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function listProfiles() {
  console.log('📋 Listing all profiles with Stripe customer IDs...');
  console.log('================================================');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id, subscription_tier, subscription_status')
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('ℹ️  No profiles with Stripe customer IDs found');
    return;
  }

  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. ${profile.email}`);
    console.log(`   - User ID: ${profile.id}`);
    console.log(`   - Stripe Customer ID: ${profile.stripe_customer_id}`);
    console.log(`   - Tier: ${profile.subscription_tier}`);
    console.log(`   - Status: ${profile.subscription_status}`);
    console.log('');
  });
}

// Main execution
const command = process.argv[2];
const stripeCustomerId = process.argv[3];

if (command === 'debug' && stripeCustomerId) {
  debugSubscription(stripeCustomerId);
} else if (command === 'list') {
  listProfiles();
} else {
  console.log('Usage:');
  console.log('  node scripts/debug-subscription.js list');
  console.log('  node scripts/debug-subscription.js debug <stripe_customer_id>');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/debug-subscription.js list');
  console.log('  node scripts/debug-subscription.js debug cus_1234567890');
}
