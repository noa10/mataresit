/**
 * Simple API test to verify the external API is working
 * Updated to use production external-api function
 */

import axios from 'axios';

// Updated to use production external-api function
const API_BASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const TEST_API_KEY = 'mk_test_499408260a6c25aceedc2f036a4887164daefe1e2915ad91302b8c1c5add71a7';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testHealthEndpoint() {
  try {
    console.log('Testing health endpoint...');
    console.log(`URL: ${API_BASE_URL}/health`);
    console.log(`API Key: ${TEST_API_KEY.substring(0, 20)}...`);
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Headers:', JSON.stringify(error.response?.headers, null, 2));
  }
}

async function testWithoutApiKey() {
  try {
    console.log('\nTesting without API key...');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Unexpected success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Expected error:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

async function testInvalidApiKey() {
  try {
    console.log('\nTesting with invalid API key...');
    
    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-API-Key': 'mk_test_invalid_key',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Unexpected success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Expected error:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

async function main() {
  console.log('🧪 Testing Mataresit External API\n');
  
  await testHealthEndpoint();
  await testWithoutApiKey();
  await testInvalidApiKey();
  
  console.log('\n✅ Test completed');
}

main().catch(console.error);
