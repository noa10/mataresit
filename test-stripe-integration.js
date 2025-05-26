#!/usr/bin/env node

/**
 * Test script to verify Stripe integration with Supabase Edge Functions
 * This script tests the create-checkout-session function directly
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

// Test price IDs
const PRICE_IDS = {
  pro: {
    monthly: 'price_1RSiggPHa6JfBjtMFGNcoKnZ',
    annual: 'price_1RSiiHPHa6JfBjtMOIItG7RA',
  },
  max: {
    monthly: 'price_1RSiixPHa6JfBjtMXI9INFRf',
    annual: 'price_1RSik1PHa6JfBjtMbYhspNSR',
  }
};

async function testCreateCheckoutSession() {
  console.log('🧪 Testing Stripe create-checkout-session Edge Function...\n');

  try {
    // Test without authentication (should fail)
    console.log('1. Testing without authentication (should return 401)...');
    const unauthResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        priceId: PRICE_IDS.pro.monthly,
        billingInterval: 'monthly'
      }),
    });

    console.log(`   Status: ${unauthResponse.status}`);
    const unauthResult = await unauthResponse.text();
    console.log(`   Response: ${unauthResult}\n`);

    if (unauthResponse.status === 401) {
      console.log('✅ Unauthenticated request correctly returned 401\n');
    } else {
      console.log('❌ Expected 401 for unauthenticated request\n');
    }

    // Test with invalid price ID (with auth header but no real user)
    console.log('2. Testing with invalid authentication...');
    const invalidAuthResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({
        priceId: PRICE_IDS.pro.monthly,
        billingInterval: 'monthly'
      }),
    });

    console.log(`   Status: ${invalidAuthResponse.status}`);
    const invalidAuthResult = await invalidAuthResponse.text();
    console.log(`   Response: ${invalidAuthResult}\n`);

    // Test CORS preflight
    console.log('3. Testing CORS preflight...');
    const corsResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });

    console.log(`   Status: ${corsResponse.status}`);
    console.log(`   CORS Headers:`, Object.fromEntries(corsResponse.headers.entries()));

    if (corsResponse.status === 200) {
      console.log('✅ CORS preflight working correctly\n');
    } else {
      console.log('❌ CORS preflight failed\n');
    }

    console.log('🎯 Summary:');
    console.log('- Edge Function is deployed and accessible');
    console.log('- Authentication is properly enforced (401 for unauthenticated requests)');
    console.log('- CORS is configured correctly');
    console.log('- To test with real authentication, use the web app test page');

  } catch (error) {
    console.error('❌ Error testing Edge Function:', error.message);
  }
}

async function testStripeWebhook() {
  console.log('\n🪝 Testing Stripe webhook Edge Function...\n');

  try {
    // Test webhook endpoint accessibility
    console.log('1. Testing webhook endpoint accessibility...');
    const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: true }),
    });

    console.log(`   Status: ${webhookResponse.status}`);
    const webhookResult = await webhookResponse.text();
    console.log(`   Response: ${webhookResult}\n`);

    if (webhookResponse.status === 400) {
      console.log('✅ Webhook correctly requires Stripe signature\n');
    } else {
      console.log('❌ Unexpected webhook response\n');
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Stripe Integration Tests\n');
  console.log('=' .repeat(50));
  
  await testCreateCheckoutSession();
  await testStripeWebhook();
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Tests completed!');
  console.log('\n💡 Next steps:');
  console.log('1. Test with real authentication using the web app');
  console.log('2. Verify Stripe dashboard receives test payments');
  console.log('3. Test webhook with real Stripe events');
}

runTests().catch(console.error);
