import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSimulatedSubscriptions() {
  console.log('🔧 Setting up simulated subscriptions for users...\n');

  try {
    // Get all users who need subscription setup
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id')
      .or('stripe_customer_id.is.null,stripe_subscription_id.is.null');

    if (error) {
      console.error('❌ Error fetching profiles:', error);
      return;
    }

    if (profiles.length === 0) {
      console.log('✅ All users already have subscription setup!');
      return;
    }

    console.log(`📋 Found ${profiles.length} users needing subscription setup:\n`);

    for (const profile of profiles) {
      console.log(`🔄 Setting up user: ${profile.email || profile.id}`);
      
      // Generate simulated IDs
      const timestamp = Date.now();
      const simulatedCustomerId = `cus_simulated_${timestamp}_${profile.id.substring(0, 8)}`;
      const simulatedSubscriptionId = `sub_simulated_${timestamp}_${profile.id.substring(0, 8)}`;
      
      // Update the profile with simulated subscription data
      const { error: updateError } = await supabase
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
        .eq('id', profile.id);

      if (updateError) {
        console.error(`❌ Error updating user ${profile.id}:`, updateError);
        continue;
      }

      console.log(`✅ Successfully set up simulated subscription for ${profile.email || profile.id}`);
      console.log(`   Customer ID: ${simulatedCustomerId}`);
      console.log(`   Subscription ID: ${simulatedSubscriptionId}`);
      console.log(`   Tier: ${profile.subscription_tier || 'free'}`);
      console.log('');
    }

    console.log('🎉 Simulated subscription setup complete!\n');

    // Verify the setup
    console.log('🔍 Verifying setup...');
    const { data: verifyProfiles, error: verifyError } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier, stripe_customer_id, stripe_subscription_id')
      .order('created_at', { ascending: false });

    if (verifyError) {
      console.error('❌ Error verifying setup:', verifyError);
      return;
    }

    console.log('\n📊 All user profiles after setup:');
    verifyProfiles.forEach((profile, index) => {
      const hasSimulated = profile.stripe_subscription_id?.startsWith('sub_simulated_');
      console.log(`${index + 1}. ${profile.email || profile.id.substring(0, 8)}`);
      console.log(`   Tier: ${profile.subscription_tier}`);
      console.log(`   Type: ${hasSimulated ? '🧪 Simulated' : '💳 Real/Test'}`);
      console.log(`   Customer ID: ${profile.stripe_customer_id}`);
      console.log(`   Subscription ID: ${profile.stripe_subscription_id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Also create a function to test subscription changes for a specific user
async function testSubscriptionChange(userId, targetTier = 'pro') {
  console.log(`\n🧪 Testing subscription change for user ${userId}...`);
  
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ User not found:', profileError);
      return;
    }

    console.log(`📋 Current user data:`);
    console.log(`   Email: ${profile.email || 'N/A'}`);
    console.log(`   Current Tier: ${profile.subscription_tier}`);
    console.log(`   Customer ID: ${profile.stripe_customer_id}`);
    console.log(`   Subscription ID: ${profile.stripe_subscription_id}`);

    if (!profile.stripe_customer_id || !profile.stripe_subscription_id) {
      console.log('⚠️  User needs subscription setup first!');
      return;
    }

    // Test the RPC function
    console.log(`\n🔄 Testing RPC function to change tier to ${targetTier}...`);
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_subscription_from_stripe', {
      _stripe_customer_id: profile.stripe_customer_id,
      _stripe_subscription_id: profile.stripe_subscription_id,
      _tier: targetTier,
      _status: 'active',
      _current_period_start: new Date().toISOString(),
      _current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      _trial_end: null,
    });

    if (rpcError) {
      console.error('❌ RPC function failed:', rpcError);
      return;
    }

    console.log('✅ RPC function succeeded!');

    // Verify the change
    const { data: updatedProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status, updated_at')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying change:', verifyError);
      return;
    }

    console.log(`✅ Subscription successfully changed to: ${updatedProfile.subscription_tier}`);
    console.log(`   Status: ${updatedProfile.subscription_status}`);
    console.log(`   Updated: ${updatedProfile.updated_at}`);

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'test' && args[1]) {
    // Test mode: node setup-simulated-subscriptions.js test <user_id> [target_tier]
    await testSubscriptionChange(args[1], args[2] || 'pro');
  } else {
    // Setup mode: node setup-simulated-subscriptions.js
    await setupSimulatedSubscriptions();
  }
}

main();
