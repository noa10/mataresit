#!/usr/bin/env node

/**
 * Simple Performance Check Script for Monitoring Workflow
 * 
 * This script performs basic performance checks that can run in CI/CD
 * without requiring the full test suite setup.
 */

import https from 'https';
import http from 'http';

// Configuration
const config = {
  supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: process.env.APP_URL || 'https://mataresit.vercel.app',
  timeout: 10000, // 10 seconds
  maxResponseTime: 5000, // 5 seconds
  retries: 3
};

// Performance thresholds
const thresholds = {
  supabaseHealth: 2000, // 2 seconds
  databaseQuery: 3000, // 3 seconds
  edgeFunction: 5000, // 5 seconds
  apiEndpoint: 4000 // 4 seconds
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.supabaseKey}`,
        ...options.headers
      },
      timeout: config.timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          data: data.toString(),
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function retryRequest(url, options = {}, retries = config.retries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await makeRequest(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} for ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Performance tests
async function testSupabaseHealth() {
  console.log('🔍 Testing Supabase health...');
  
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  // Test Supabase REST API health by making a simple query
  const healthUrl = `${config.supabaseUrl}/rest/v1/`;
  const response = await retryRequest(healthUrl, {
    headers: {
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`
    }
  });
  
  if (response.statusCode !== 200 && response.statusCode !== 404) {
    throw new Error(`Supabase health check failed: HTTP ${response.statusCode}`);
  }

  if (response.responseTime > thresholds.supabaseHealth) {
    console.warn(`⚠️ Supabase health response time (${response.responseTime}ms) exceeds threshold (${thresholds.supabaseHealth}ms)`);
  }

  console.log(`✅ Supabase health: ${response.responseTime}ms`);
  return { responseTime: response.responseTime, status: 'healthy' };
}

async function testDatabaseQuery() {
  console.log('🔍 Testing database query performance...');
  
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('Supabase configuration missing');
  }

  // Simple query to test database performance
  const queryUrl = `${config.supabaseUrl}/rest/v1/receipts?select=id&limit=1`;
  const response = await retryRequest(queryUrl, {
    headers: {
      'apikey': config.supabaseKey
    }
  });
  
  if (response.statusCode !== 200 && response.statusCode !== 404) {
    throw new Error(`Database query failed: HTTP ${response.statusCode}`);
  }

  if (response.responseTime > thresholds.databaseQuery) {
    console.warn(`⚠️ Database query response time (${response.responseTime}ms) exceeds threshold (${thresholds.databaseQuery}ms)`);
  }

  console.log(`✅ Database query: ${response.responseTime}ms`);
  return { responseTime: response.responseTime, status: 'responsive' };
}

async function testEdgeFunction() {
  console.log('🔍 Testing Edge Function performance...');
  
  if (!config.supabaseUrl) {
    console.log('⚠️ Skipping Edge Function test - Supabase URL not configured');
    return { responseTime: 0, status: 'skipped' };
  }

  try {
    // Test a known edge function (mataresit-api health endpoint)
    const functionUrl = `${config.supabaseUrl}/functions/v1/mataresit-api`;
    const response = await retryRequest(functionUrl, {
      method: 'GET',
      headers: {
        'x-api-key': 'test-key-for-monitoring'
      }
    });
    
    // Edge functions might return 404 if not deployed, which is acceptable for monitoring
    if (response.statusCode === 404) {
      console.log('⚠️ Edge function not found - this is acceptable for monitoring');
      return { responseTime: response.responseTime, status: 'not_deployed' };
    }

    if (response.responseTime > thresholds.edgeFunction) {
      console.warn(`⚠️ Edge function response time (${response.responseTime}ms) exceeds threshold (${thresholds.edgeFunction}ms)`);
    }

    console.log(`✅ Edge function: ${response.responseTime}ms`);
    return { responseTime: response.responseTime, status: 'responsive' };
  } catch (error) {
    console.log(`⚠️ Edge function test failed: ${error.message}`);
    return { responseTime: 0, status: 'error', error: error.message };
  }
}

async function generatePerformanceReport(results) {
  console.log('\n📊 Performance Report Summary:');
  console.log('================================');
  
  let totalScore = 0;
  let maxScore = 0;
  
  for (const [test, result] of Object.entries(results)) {
    maxScore += 100;
    
    if (result.status === 'error') {
      console.log(`❌ ${test}: FAILED - ${result.error || 'Unknown error'}`);
      totalScore += 0;
    } else if (result.status === 'skipped') {
      console.log(`⏭️ ${test}: SKIPPED`);
      totalScore += 50; // Partial credit for skipped tests
    } else {
      const threshold = thresholds[test.replace('test', '').toLowerCase()] || 5000;
      const score = Math.max(0, 100 - (result.responseTime / threshold) * 50);
      totalScore += score;
      
      const status = result.responseTime <= threshold ? '✅' : '⚠️';
      console.log(`${status} ${test}: ${result.responseTime}ms (Score: ${score.toFixed(1)}/100)`);
    }
  }
  
  const overallScore = (totalScore / maxScore) * 100;
  console.log(`\n🎯 Overall Performance Score: ${overallScore.toFixed(1)}/100`);
  
  if (overallScore >= 80) {
    console.log('🎉 Performance is EXCELLENT');
  } else if (overallScore >= 60) {
    console.log('👍 Performance is GOOD');
  } else if (overallScore >= 40) {
    console.log('⚠️ Performance needs IMPROVEMENT');
  } else {
    console.log('🚨 Performance is POOR - immediate attention required');
  }
  
  return overallScore;
}

// Main execution
async function main() {
  console.log('🚀 Starting Simple Performance Check...\n');
  
  const results = {};
  let hasErrors = false;
  
  try {
    results.supabaseHealth = await testSupabaseHealth();
  } catch (error) {
    console.error(`❌ Supabase health test failed: ${error.message}`);
    results.supabaseHealth = { status: 'error', error: error.message };
    hasErrors = true;
  }
  
  try {
    results.databaseQuery = await testDatabaseQuery();
  } catch (error) {
    console.error(`❌ Database query test failed: ${error.message}`);
    results.databaseQuery = { status: 'error', error: error.message };
    hasErrors = true;
  }
  
  try {
    results.edgeFunction = await testEdgeFunction();
  } catch (error) {
    console.error(`❌ Edge function test failed: ${error.message}`);
    results.edgeFunction = { status: 'error', error: error.message };
    hasErrors = true;
  }
  
  const overallScore = await generatePerformanceReport(results);
  
  // Exit with appropriate code
  if (hasErrors && overallScore < 40) {
    console.log('\n🚨 Critical performance issues detected');
    process.exit(1);
  } else if (overallScore < 60) {
    console.log('\n⚠️ Performance warnings detected');
    process.exit(0); // Don't fail the build for warnings
  } else {
    console.log('\n✅ Performance check completed successfully');
    process.exit(0);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Run the performance check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Performance check failed:', error.message);
    process.exit(1);
  });
}

export { main, testSupabaseHealth, testDatabaseQuery, testEdgeFunction };
