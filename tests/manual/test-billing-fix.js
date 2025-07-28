#!/usr/bin/env node

/**
 * Test script to verify the billing portal fix for simulated subscriptions
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

// Test user with simulated subscription (from our earlier query)
const TEST_USER_ID = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';
const TEST_EMAIL = 'k.anwarbakar@gmail.com';

async function testCreatePortalSession() {
  console.log('🧪 Testing createPortalSession for simulated subscription...');
  console.log('='.repeat(60));
  
  try {
    // First, let's sign in as the test user (we'll simulate this by using the anon key)
    console.log(`👤 Testing with user: ${TEST_EMAIL}`);
    console.log(`🆔 User ID: ${TEST_USER_ID}`);
    
    // Call the manage-subscription function with create_portal_session action
    const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Origin': 'http://localhost:8080'
      },
      body: JSON.stringify({
        action: 'create_portal_session'
      })
    });

    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('📋 Response data:', JSON.stringify(data, null, 2));

    // Check if the response indicates a simulated subscription
    if (data.simulated === true) {
      console.log('✅ SUCCESS: Simulated subscription detected correctly!');
      console.log(`🔗 Redirect URL: ${data.url}`);
      
      // Verify the URL contains the simulated parameter
      if (data.url && data.url.includes('simulated=true')) {
        console.log('✅ SUCCESS: URL contains simulated=true parameter');
        return true;
      } else {
        console.log('⚠️  WARNING: URL does not contain simulated=true parameter');
        return false;
      }
    } else {
      console.log('❌ FAILURE: Simulated subscription not detected');
      console.log('Expected simulated=true in response');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

async function testGetSubscriptionStatus() {
  console.log('\n🧪 Testing getSubscriptionStatus for simulated subscription...');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: 'get_status'
      })
    });

    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('📋 Response data:', JSON.stringify(data, null, 2));

    // Check if the response indicates a simulated subscription
    if (data.simulated === true) {
      console.log('✅ SUCCESS: Simulated subscription status returned correctly!');
      return true;
    } else {
      console.log('❌ FAILURE: Simulated subscription status not detected');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting billing portal fix tests...\n');
  
  const results = [];
  
  // Test 1: Create portal session
  results.push(await testCreatePortalSession());
  
  // Test 2: Get subscription status
  results.push(await testGetSubscriptionStatus());
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED! The billing portal fix is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the implementation.');
  }
  
  return passed === total;
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
