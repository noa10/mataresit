/**
 * Test Fixes Validation
 * Quick test to validate that the response format and rate limiting header fixes are working
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.test');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const API_BASE_URL = envVars.API_BASE_URL;
const TEST_API_KEY = envVars.TEST_API_KEY;
const SUPABASE_ANON_KEY = envVars.SUPABASE_ANON_KEY;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'X-API-Key': TEST_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

async function testResponseFormat() {
  console.log('🧪 Testing Response Format Fixes...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Health endpoint response format
  try {
    totalTests++;
    const response = await apiClient.get('/health');
    
    console.log('1️⃣ Health Endpoint Response Format:');
    console.log('   Status:', response.status);
    console.log('   Success:', response.data.success);
    console.log('   Has timestamp:', !!response.data.timestamp);
    console.log('   Has rate limit headers:', !!response.headers['x-ratelimit-limit']);
    
    if (response.data.success && response.data.timestamp && response.headers['x-ratelimit-limit']) {
      console.log('   ✅ PASS - Response format correct');
      passedTests++;
    } else {
      console.log('   ❌ FAIL - Response format issues');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Request failed:', error.message);
  }
  
  // Test 2: Error response format
  try {
    totalTests++;
    await apiClient.get('/invalid-endpoint');
    console.log('2️⃣ Error Response Format: ❌ FAIL - Should have thrown error');
  } catch (error) {
    console.log('2️⃣ Error Response Format:');
    console.log('   Status:', error.response?.status);
    console.log('   Error structure:', JSON.stringify(error.response?.data, null, 2));
    console.log('   Has rate limit headers:', !!error.response?.headers['x-ratelimit-limit']);
    
    const data = error.response?.data;
    if (data?.error === true && data?.code && data?.timestamp && error.response?.headers['x-ratelimit-limit']) {
      console.log('   ✅ PASS - Error format correct');
      passedTests++;
    } else {
      console.log('   ❌ FAIL - Error format issues');
    }
  }
  
  // Test 3: Receipts API response format
  try {
    totalTests++;
    const response = await apiClient.get('/receipts?limit=3');
    
    console.log('3️⃣ Receipts API Response Format:');
    console.log('   Status:', response.status);
    console.log('   Success:', response.data.success);
    console.log('   Has timestamp:', !!response.data.timestamp);
    console.log('   Has rate limit headers:', !!response.headers['x-ratelimit-limit']);
    console.log('   Data structure:', Object.keys(response.data.data || {}));
    
    if (response.data.success && response.data.timestamp && response.headers['x-ratelimit-limit']) {
      console.log('   ✅ PASS - Response format correct');
      passedTests++;
    } else {
      console.log('   ❌ FAIL - Response format issues');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Request failed:', error.message);
  }
  
  // Test 4: Search API response format
  try {
    totalTests++;
    const response = await apiClient.get('/search/sources');
    
    console.log('4️⃣ Search API Response Format:');
    console.log('   Status:', response.status);
    console.log('   Success:', response.data.success);
    console.log('   Has timestamp:', !!response.data.timestamp);
    console.log('   Has rate limit headers:', !!response.headers['x-ratelimit-limit']);
    
    if (response.data.success && response.data.timestamp && response.headers['x-ratelimit-limit']) {
      console.log('   ✅ PASS - Response format correct');
      passedTests++;
    } else {
      console.log('   ❌ FAIL - Response format issues');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Request failed:', error.response?.status, error.response?.data?.message);
  }
  
  // Test 5: Claims API response format
  try {
    totalTests++;
    const response = await apiClient.get('/claims?limit=3');
    
    console.log('5️⃣ Claims API Response Format:');
    console.log('   Status:', response.status);
    console.log('   Success:', response.data.success);
    console.log('   Has timestamp:', !!response.data.timestamp);
    console.log('   Has rate limit headers:', !!response.headers['x-ratelimit-limit']);
    
    if (response.data.success && response.data.timestamp && response.headers['x-ratelimit-limit']) {
      console.log('   ✅ PASS - Response format correct');
      passedTests++;
    } else {
      console.log('   ❌ FAIL - Response format issues');
    }
  } catch (error) {
    console.log('   ❌ FAIL - Request failed:', error.response?.status, error.response?.data?.message);
  }
  
  // Summary
  console.log('\n📊 Response Format Test Results:');
  console.log('='.repeat(40));
  console.log(`Passed: ${passedTests}/${totalTests} tests`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL RESPONSE FORMAT TESTS PASSED!');
    console.log('✅ Response format fixes are working correctly');
    console.log('✅ Rate limiting headers are being returned');
    console.log('✅ Error format standardization successful');
  } else {
    console.log('\n⚠️  Some response format tests failed');
    console.log('❌ Additional fixes may be needed');
  }
  
  return passedTests === totalTests;
}

testResponseFormat().catch(console.error);
