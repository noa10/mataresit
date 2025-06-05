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

async function checkUserProfiles() {
  console.log('🔍 Checking user profiles...\n');

  try {
    // Get all user profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching profiles:', error);
      return;
    }

    console.log(`📊 Found ${profiles.length} user profiles:\n`);

    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. User ID: ${profile.id}`);
      console.log(`   Email: ${profile.email || 'N/A'}`);
      console.log(`   Subscription Tier: ${profile.subscription_tier || 'N/A'}`);
      console.log(`   Subscription Status: ${profile.subscription_status || 'N/A'}`);
      console.log(`   Stripe Customer ID: ${profile.stripe_customer_id || 'N/A'}`);
      console.log(`   Stripe Subscription ID: ${profile.stripe_subscription_id || 'N/A'}`);
      console.log(`   Created: ${profile.created_at}`);
      console.log('');
    });

    // Check which users need simulated subscription setup
    const usersNeedingSetup = profiles.filter(p => 
      !p.stripe_customer_id || !p.stripe_subscription_id
    );

    if (usersNeedingSetup.length > 0) {
      console.log(`⚠️  ${usersNeedingSetup.length} users need subscription setup:`);
      usersNeedingSetup.forEach(user => {
        console.log(`   - ${user.email || user.id}: Missing ${!user.stripe_customer_id ? 'customer_id' : ''} ${!user.stripe_subscription_id ? 'subscription_id' : ''}`);
      });
      console.log('');
    }

    // Check the test user specifically
    const testUser = profiles.find(p => p.id === '8c81fcf0-9528-4020-af12-97f865966ef7');
    if (testUser) {
      console.log('✅ Test user found with working subscription setup:');
      console.log(`   Customer ID: ${testUser.stripe_customer_id}`);
      console.log(`   Subscription ID: ${testUser.stripe_subscription_id}`);
      console.log(`   Tier: ${testUser.subscription_tier}`);
    } else {
      console.log('❌ Test user not found in profiles');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUserProfiles();
