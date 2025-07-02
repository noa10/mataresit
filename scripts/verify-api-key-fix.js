#!/usr/bin/env node

/**
 * Verification script for API Key Management fix
 * Tests the eye button (toggle active/inactive) functionality
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function callApiKeyFunction(method, path = '', body = null) {
  const url = `${SUPABASE_URL}/functions/v1/manage-api-keys${path}?t=${Date.now()}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    credentials: 'omit',
    mode: 'cors'
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log(`🔗 Calling: ${method} ${url}`);
  if (body) {
    console.log(`📦 Body:`, JSON.stringify(body, null, 2));
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

async function testApiKeyManagement() {
  console.log('🧪 Testing API Key Management Fix\n');

  try {
    // Step 1: Load API keys
    console.log('1️⃣ Loading API keys...');
    const listResult = await callApiKeyFunction('GET');
    
    if (!listResult.success || !listResult.data?.apiKeys) {
      console.log('❌ No API keys found or invalid response');
      console.log('Response:', JSON.stringify(listResult, null, 2));
      return;
    }

    const apiKeys = listResult.data.apiKeys;
    console.log(`✅ Found ${apiKeys.length} API keys`);

    if (apiKeys.length === 0) {
      console.log('ℹ️ No API keys to test. Create one first in the UI.');
      return;
    }

    // Step 2: Test updating the first API key
    const testKey = apiKeys[0];
    console.log(`\n2️⃣ Testing update on key: ${testKey.name} (${testKey.id})`);
    console.log(`   Current status: ${testKey.is_active ? 'Active' : 'Inactive'}`);

    const newActiveState = !testKey.is_active;
    console.log(`   Toggling to: ${newActiveState ? 'Active' : 'Inactive'}`);

    const updateResult = await callApiKeyFunction('PUT', '', {
      keyId: testKey.id,
      isActive: newActiveState
    });

    if (updateResult.success) {
      console.log('✅ API key updated successfully!');
      console.log('Updated data:', JSON.stringify(updateResult.data, null, 2));
    } else {
      console.log('❌ Update failed:', updateResult.error);
    }

    // Step 3: Verify the update by fetching again
    console.log('\n3️⃣ Verifying update...');
    const verifyResult = await callApiKeyFunction('GET');
    
    if (verifyResult.success) {
      const updatedKey = verifyResult.data.apiKeys.find(k => k.id === testKey.id);
      if (updatedKey) {
        console.log(`✅ Verification successful!`);
        console.log(`   Key status is now: ${updatedKey.is_active ? 'Active' : 'Inactive'}`);
        
        if (updatedKey.is_active === newActiveState) {
          console.log('🎉 API Key Management fix is working correctly!');
        } else {
          console.log('⚠️ Status didn\'t change as expected');
        }
      } else {
        console.log('❌ Could not find the updated key');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Check if it's a 404 error (the original issue)
    if (error.message.includes('404')) {
      console.log('\n🔍 This looks like the original 404 issue we were trying to fix.');
      console.log('   The Edge Function might not be properly deployed or the routing is still broken.');
    }
  }
}

// Run the test
testApiKeyManagement()
  .then(() => {
    console.log('\n✨ Test completed');
  })
  .catch((error) => {
    console.error('\n💥 Test script error:', error);
    process.exit(1);
  });
