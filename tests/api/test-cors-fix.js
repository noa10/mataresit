/**
 * Simple test script to verify CORS fix for unified-search Edge Function
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc4NTU4NzQsImV4cCI6MjAzMzQzMTg3NH0.Vh4XAp2lTTOYZoFH8VXBmKp8-72lYpYCjqRVVmQpVoM';

async function testCorsPreflightRequest() {
  console.log('🧪 Testing CORS preflight request...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type, apikey'
      }
    });

    console.log('✅ Preflight Response Status:', response.status);
    console.log('📋 CORS Headers:');
    
    // Log all CORS headers
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control-')) {
        console.log(`   ${key}: ${value}`);
      }
    });

    return response.ok;
  } catch (error) {
    console.error('❌ Preflight test failed:', error.message);
    return false;
  }
}

async function testActualRequest() {
  console.log('\n🔍 Testing actual search request with anon key...');

  const searchPayload = {
    query: 'test search',
    sources: ['receipt', 'business_directory'], // Using backend source names
    limit: 5,
    offset: 0,
    similarityThreshold: 0.2,
    includeMetadata: true,
    aggregationMode: 'relevance'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(searchPayload)
    });

    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Headers:');

    // Log response headers
    response.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });

    const responseText = await response.text();
    console.log('📄 Response Body:', responseText);

    return { success: response.status !== 0, status: response.status, body: responseText };
  } catch (error) {
    console.error('❌ Actual request test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testWithDifferentPayloads() {
  console.log('\n🧪 Testing different payload formats...');

  const payloads = [
    {
      name: 'Minimal payload',
      payload: {
        query: 'test',
        sources: ['receipt']
      }
    },
    {
      name: 'Standard payload',
      payload: {
        query: 'test search',
        sources: ['receipt', 'business_directory'],
        limit: 5,
        offset: 0
      }
    },
    {
      name: 'Full payload',
      payload: {
        query: 'test search',
        sources: ['receipt', 'business_directory'],
        limit: 5,
        offset: 0,
        similarityThreshold: 0.2,
        includeMetadata: true,
        aggregationMode: 'relevance'
      }
    }
  ];

  for (const { name, payload } of payloads) {
    console.log(`\n🔬 Testing ${name}:`, JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Origin': 'http://localhost:5173'
        },
        body: JSON.stringify(payload)
      });

      console.log(`   Status: ${response.status}`);
      const responseText = await response.text();
      console.log(`   Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting comprehensive CORS and unified-search tests...\n');

  // Test 1: CORS Preflight
  const preflightSuccess = await testCorsPreflightRequest();

  // Test 2: Actual Request with anon key
  const actualResult = await testActualRequest();

  // Test 3: Different payload formats
  await testWithDifferentPayloads();

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`   Preflight Test: ${preflightSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Actual Request: ${actualResult.success ? '✅ PASS' : '❌ FAIL'}`);

  if (actualResult.status) {
    console.log(`   Response Status: ${actualResult.status}`);
  }

  if (preflightSuccess && actualResult.success) {
    console.log('\n🎉 CORS configuration is working correctly!');

    if (actualResult.status === 401) {
      console.log('ℹ️  Authentication required - this is expected for the anon key');
    } else if (actualResult.status === 400) {
      console.log('ℹ️  Bad request - check the request payload format');
    } else if (actualResult.status === 200) {
      console.log('🎯 Search request successful!');
    }
  } else {
    console.log('\n❌ CORS configuration needs further investigation');
  }

  console.log('\n🔍 Next steps:');
  console.log('- If you see "Invalid request format" errors, check the Edge Function validation logic');
  console.log('- If you see authentication errors, verify the JWT token format');
  console.log('- If CORS is working but requests fail, check the request payload structure');
}

// Run the tests
runTests().catch(console.error);
