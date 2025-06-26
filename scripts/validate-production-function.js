/**
 * Production Function Validation
 * Comprehensive validation of the enhanced external-api function
 * Tests middleware bypass, authentication, and basic functionality
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test
const envPath = path.join(__dirname, '..', '.env.test');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

// Configuration
const API_BASE_URL = envVars.API_BASE_URL;
const TEST_API_KEY = envVars.TEST_API_KEY;
const ADMIN_API_KEY = envVars.ADMIN_API_KEY;
const SUPABASE_ANON_KEY = envVars.SUPABASE_ANON_KEY;

console.log('🧪 Production Function Validation');
console.log('================================');
console.log(`API URL: ${API_BASE_URL}`);
console.log(`Test Key: ${TEST_API_KEY?.substring(0, 20)}...`);
console.log(`Using Production: ${API_BASE_URL?.includes('external-api') ? 'YES' : 'NO'}`);
console.log('');

// Create API client
const createApiClient = (apiKey) => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
};

const apiClient = createApiClient(TEST_API_KEY);
const adminClient = createApiClient(ADMIN_API_KEY);

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

function recordTest(name, passed, details = '') {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
  results.tests.push({ name, passed, details });
}

// Test 1: Health Endpoint
async function testHealthEndpoint() {
  console.log('\n1️⃣ Testing Health Endpoint...');
  
  try {
    const response = await apiClient.get('/health');
    
    if (response.status === 200 && response.data.success) {
      const data = response.data.data;
      recordTest('Health endpoint responds', true, `Function: ${data.function}, Mode: ${data.mode}`);
      
      // Verify response structure
      if (data.user && data.user.id && data.user.scopes) {
        recordTest('User authentication working', true, `User ID: ${data.user.id}`);
      } else {
        recordTest('User authentication working', false, 'Missing user data in response');
      }
      
      // Verify production mode
      if (data.mode === 'production') {
        recordTest('Production mode active', true);
      } else {
        recordTest('Production mode active', false, `Mode: ${data.mode}`);
      }
      
      return true;
    } else {
      recordTest('Health endpoint responds', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Health endpoint responds', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 2: Authentication Validation
async function testAuthentication() {
  console.log('\n2️⃣ Testing Authentication...');
  
  // Test without Authorization header
  try {
    await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    recordTest('Rejects missing Authorization header', false, 'Should have failed');
  } catch (error) {
    if (error.response?.status === 401) {
      recordTest('Rejects missing Authorization header', true);
    } else {
      recordTest('Rejects missing Authorization header', false, `Unexpected status: ${error.response?.status}`);
    }
  }
  
  // Test without API key
  try {
    await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    recordTest('Rejects missing API key', false, 'Should have failed');
  } catch (error) {
    if (error.response?.status === 401) {
      recordTest('Rejects missing API key', true);
    } else {
      recordTest('Rejects missing API key', false, `Unexpected status: ${error.response?.status}`);
    }
  }
  
  // Test invalid API key format
  try {
    await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-API-Key': 'invalid_key_format',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    recordTest('Rejects invalid API key format', false, 'Should have failed');
  } catch (error) {
    if (error.response?.status === 401) {
      recordTest('Rejects invalid API key format', true);
    } else {
      recordTest('Rejects invalid API key format', false, `Unexpected status: ${error.response?.status}`);
    }
  }
}

// Test 3: Basic API Endpoints
async function testBasicEndpoints() {
  console.log('\n3️⃣ Testing Basic API Endpoints...');
  
  // Test receipts endpoint
  try {
    const response = await apiClient.get('/receipts?limit=3');
    if (response.status === 200 && response.data.success) {
      recordTest('Receipts API responds', true, `Found ${response.data.data.receipts?.length || 0} receipts`);
    } else {
      recordTest('Receipts API responds', false, `Status: ${response.status}`);
    }
  } catch (error) {
    recordTest('Receipts API responds', false, `Error: ${error.message}`);
  }
  
  // Test claims endpoint
  try {
    const response = await apiClient.get('/claims?limit=3');
    if (response.status === 200 && response.data.success) {
      recordTest('Claims API responds', true, `Found ${response.data.data.claims?.length || 0} claims`);
    } else {
      recordTest('Claims API responds', false, `Status: ${response.status}`);
    }
  } catch (error) {
    recordTest('Claims API responds', false, `Error: ${error.message}`);
  }
  
  // Test teams endpoint
  try {
    const response = await apiClient.get('/teams');
    if (response.status === 200 && response.data.success) {
      recordTest('Teams API responds', true, `Found ${response.data.data.teams?.length || 0} teams`);
    } else {
      recordTest('Teams API responds', false, `Status: ${response.status}`);
    }
  } catch (error) {
    recordTest('Teams API responds', false, `Error: ${error.message}`);
  }
}

// Test 4: Error Handling
async function testErrorHandling() {
  console.log('\n4️⃣ Testing Error Handling...');
  
  // Test invalid endpoint
  try {
    await apiClient.get('/invalid-endpoint');
    recordTest('Handles invalid endpoints', false, 'Should have returned 404');
  } catch (error) {
    if (error.response?.status === 404) {
      recordTest('Handles invalid endpoints', true);
    } else {
      recordTest('Handles invalid endpoints', false, `Unexpected status: ${error.response?.status}`);
    }
  }
  
  // Test analytics endpoint (should require subscription)
  try {
    const response = await apiClient.get('/analytics/summary?start_date=2024-01-01&end_date=2025-12-31');
    recordTest('Analytics subscription enforcement', false, 'Should have been rejected');
  } catch (error) {
    if (error.response?.status === 403 && error.response?.data?.message?.includes('subscription')) {
      recordTest('Analytics subscription enforcement', true);
    } else {
      recordTest('Analytics subscription enforcement', false, `Unexpected response: ${error.response?.status}`);
    }
  }
}

// Main validation function
async function runValidation() {
  console.log('Starting production function validation...\n');
  
  await testHealthEndpoint();
  await testAuthentication();
  await testBasicEndpoints();
  await testErrorHandling();
  
  // Summary
  console.log('\n📊 Validation Summary');
  console.log('====================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL VALIDATION TESTS PASSED!');
    console.log('✅ Production function is ready for comprehensive testing');
    console.log('✅ Middleware bypass working correctly');
    console.log('✅ Authentication functioning properly');
    console.log('✅ Database integration operational');
  } else {
    console.log('\n⚠️  SOME VALIDATION TESTS FAILED');
    console.log('❌ Please review failed tests before running comprehensive suite');
    
    console.log('\nFailed Tests:');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.name}: ${test.details}`);
    });
  }
  
  return results.failed === 0;
}

// Run validation
runValidation().catch(console.error);
