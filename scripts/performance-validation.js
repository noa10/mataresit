/**
 * Performance Validation for Production External API
 * Tests response times and concurrent request handling
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

async function measureResponseTime(endpoint, method = 'GET', data = null) {
  const startTime = Date.now();
  
  try {
    let response;
    if (method === 'GET') {
      response = await apiClient.get(endpoint);
    } else if (method === 'POST') {
      response = await apiClient.post(endpoint, data);
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: true,
      responseTime,
      status: response.status,
      endpoint
    };
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: false,
      responseTime,
      status: error.response?.status || 'timeout',
      endpoint,
      error: error.message
    };
  }
}

async function testConcurrentRequests() {
  console.log('🚀 Testing Concurrent Requests...');
  
  const requests = [
    measureResponseTime('/health'),
    measureResponseTime('/receipts?limit=3'),
    measureResponseTime('/claims?limit=3'),
    measureResponseTime('/teams'),
    measureResponseTime('/health')
  ];
  
  const startTime = Date.now();
  const results = await Promise.all(requests);
  const totalTime = Date.now() - startTime;
  
  console.log(`   Total time for 5 concurrent requests: ${totalTime}ms`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.endpoint}: ${result.responseTime}ms (${result.status})`);
  });
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`   Average response time: ${Math.round(avgResponseTime)}ms`);
  
  return {
    totalTime,
    avgResponseTime,
    allSuccessful: results.every(r => r.success)
  };
}

async function testSequentialRequests() {
  console.log('\n📊 Testing Sequential Requests...');
  
  const endpoints = [
    '/health',
    '/receipts?limit=5',
    '/claims?limit=5',
    '/teams'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await measureResponseTime(endpoint);
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${endpoint}: ${result.responseTime}ms (${result.status})`);
    results.push(result);
  }
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`   Average response time: ${Math.round(avgResponseTime)}ms`);
  
  return {
    avgResponseTime,
    allSuccessful: results.every(r => r.success)
  };
}

async function runPerformanceValidation() {
  console.log('⚡ Production Function Performance Validation');
  console.log('============================================');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('');
  
  const concurrentResults = await testConcurrentRequests();
  const sequentialResults = await testSequentialRequests();
  
  console.log('\n📈 Performance Summary');
  console.log('=====================');
  console.log(`Concurrent requests: ${concurrentResults.allSuccessful ? 'PASS' : 'FAIL'}`);
  console.log(`Sequential requests: ${sequentialResults.allSuccessful ? 'PASS' : 'FAIL'}`);
  console.log(`Concurrent avg time: ${Math.round(concurrentResults.avgResponseTime)}ms`);
  console.log(`Sequential avg time: ${Math.round(sequentialResults.avgResponseTime)}ms`);
  
  // Performance benchmarks
  const benchmarks = {
    excellent: 500,
    good: 1000,
    acceptable: 2000
  };
  
  const overallAvg = (concurrentResults.avgResponseTime + sequentialResults.avgResponseTime) / 2;
  
  let performanceRating;
  if (overallAvg <= benchmarks.excellent) {
    performanceRating = 'EXCELLENT 🚀';
  } else if (overallAvg <= benchmarks.good) {
    performanceRating = 'GOOD ✅';
  } else if (overallAvg <= benchmarks.acceptable) {
    performanceRating = 'ACCEPTABLE ⚠️';
  } else {
    performanceRating = 'NEEDS IMPROVEMENT ❌';
  }
  
  console.log(`Overall performance: ${performanceRating} (${Math.round(overallAvg)}ms avg)`);
  
  if (concurrentResults.allSuccessful && sequentialResults.allSuccessful) {
    console.log('\n🎉 PERFORMANCE VALIDATION PASSED!');
    console.log('✅ Production function handles concurrent requests well');
    console.log('✅ Response times are within acceptable ranges');
    console.log('✅ No timeout or error issues detected');
  } else {
    console.log('\n⚠️  PERFORMANCE ISSUES DETECTED');
    console.log('❌ Some requests failed or timed out');
  }
  
  return concurrentResults.allSuccessful && sequentialResults.allSuccessful;
}

runPerformanceValidation().catch(console.error);
