import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in your environment before running this manual test.');
  process.exit(1);
}

// Use the service role key to check user data. Never hardcode it in this file.
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkUserData() {
  try {
    console.log('🔍 Checking user data in database...');

    // Check all users with Stripe data
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status')
      .not('stripe_customer_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching profiles:', error);
      return;
    }

    console.log('📊 Users with Stripe data:');
    profiles.forEach(profile => {
      console.log(`- ${profile.email}:`);
      console.log(`  ID: ${profile.id}`);
      console.log(`  Customer ID: ${profile.stripe_customer_id}`);
      console.log(`  Subscription ID: ${profile.stripe_subscription_id}`);
      console.log(`  Tier: ${profile.subscription_tier}`);
      console.log(`  Status: ${profile.subscription_status}`);
      console.log('');
    });

    // Test the function with a specific user
    if (profiles.length > 0) {
      const testUser = profiles.find(p => p.email === 'samcodersam7@gmail.com') || profiles[0];
      console.log(`🧪 Testing function with user: ${testUser.email}`);

      // Create a temporary auth session for testing
      const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: testUser.email
      });

      if (authError) {
        console.error('❌ Failed to generate auth link:', authError);
        return;
      }

      console.log('✅ User data looks valid for testing');
      console.log('💡 Try the downgrade in the browser now');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkUserData();
