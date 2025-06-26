/**
 * Test Enhanced External API Function
 * Verifies that the enhanced external-api function works with middleware bypass
 */

import axios from 'axios';

const API_BASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const TEST_API_KEY = 'mk_test_499408260a6c25aceedc2f036a4887164daefe1e2915ad91302b8c1c5add71a7';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testHealthEndpoint() {
  try {
    console.log('🧪 Testing Enhanced External API Health Endpoint');
    console.log(`URL: ${API_BASE_URL}/health`);
    console.log(`API Key: ${TEST_API_KEY.substring(0, 20)}...`);
    console.log('---');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Verify response structure
    if (response.data.success && response.data.data.status === 'healthy') {
      console.log('✅ Response structure is correct');
      console.log('✅ Function:', response.data.data.function || 'external-api');
      console.log('✅ Mode:', response.data.data.mode || 'production');
      console.log('✅ User ID:', response.data.data.user?.id);
      console.log('✅ Scopes:', response.data.data.user?.scopes?.length || 0, 'scopes');
      return true;
    } else {
      console.log('❌ Unexpected response structure');
      return false;
    }
    
  } catch (error) {
    console.log('❌ ERROR:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Headers:', JSON.stringify(error.response?.headers, null, 2));
    return false;
  }
}

async function testWithoutAuthHeader() {
  try {
    console.log('\n🧪 Testing without Authorization header...');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('❌ Unexpected success! Should have failed without Authorization header');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return false;
    
  } catch (error) {
    console.log('✅ Expected error (missing Authorization header):');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.error || error.response?.data?.message);
    return error.response?.status === 401;
  }
}

async function testWithoutApiKey() {
  try {
    console.log('\n🧪 Testing without X-API-Key header...');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('❌ Unexpected success! Should have failed without X-API-Key header');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return false;
    
  } catch (error) {
    console.log('✅ Expected error (missing X-API-Key header):');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.error || error.response?.data?.message);
    return error.response?.status === 401;
  }
}

async function testInvalidApiKey() {
  try {
    console.log('\n🧪 Testing with invalid API key format...');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-API-Key': 'invalid_key_format',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('❌ Unexpected success! Should have failed with invalid API key');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    return false;
    
  } catch (error) {
    console.log('✅ Expected error (invalid API key format):');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.error || error.response?.data?.message);
    return error.response?.status === 401;
  }
}

async function main() {
  console.log('🚀 Testing Enhanced External API Function\n');
  
  const results = {
    healthEndpoint: await testHealthEndpoint(),
    withoutAuthHeader: await testWithoutAuthHeader(),
    withoutApiKey: await testWithoutApiKey(),
    invalidApiKey: await testInvalidApiKey()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('✅ Health endpoint:', results.healthEndpoint ? 'PASS' : 'FAIL');
  console.log('✅ Auth header validation:', results.withoutAuthHeader ? 'PASS' : 'FAIL');
  console.log('✅ API key validation:', results.withoutApiKey ? 'PASS' : 'FAIL');
  console.log('✅ Invalid key rejection:', results.invalidApiKey ? 'PASS' : 'FAIL');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Enhanced external-api function is working correctly.');
    console.log('✅ Middleware bypass is functional');
    console.log('✅ Dual-header authentication is working');
    console.log('✅ API key validation is working');
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
  }
  
  return allPassed;
}

main().catch(console.error);
