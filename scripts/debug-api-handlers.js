/**
 * Debug API Handlers - Enhanced External API
 * Detailed debugging of API handler responses
 */

import axios from 'axios';

const API_BASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const TEST_API_KEY = 'mk_test_499408260a6c25aceedc2f036a4887164daefe1e2915ad91302b8c1c5add71a7';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'X-API-Key': TEST_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

async function debugEndpoint(endpoint, method = 'GET', data = null) {
  console.log(`\n🔍 Debugging ${method} ${endpoint}`);
  console.log(`Full URL: ${API_BASE_URL}${endpoint}`);
  
  try {
    let response;
    if (method === 'GET') {
      response = await apiClient.get(endpoint);
    } else if (method === 'POST') {
      response = await apiClient.post(endpoint, data);
    }
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log('❌ Error!');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Error Headers:', JSON.stringify(error.response?.headers, null, 2));
    
    if (error.code) {
      console.log('Error Code:', error.code);
    }
    if (error.message) {
      console.log('Error Message:', error.message);
    }
    
    return false;
  }
}

async function main() {
  console.log('🔍 Debugging Enhanced External API Handlers\n');
  
  // Test health endpoint first (we know this works)
  await debugEndpoint('/health');
  
  // Test each API handler
  await debugEndpoint('/receipts');
  await debugEndpoint('/claims');
  await debugEndpoint('/search', 'POST', {
    query: 'test',
    sources: ['receipts'],
    limit: 3
  });
  await debugEndpoint('/analytics/summary?start_date=2024-01-01&end_date=2025-12-31');
  await debugEndpoint('/teams');
  await debugEndpoint('/performance');
  
  console.log('\n🔍 Debug session completed');
}

main().catch(console.error);
