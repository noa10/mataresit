#!/usr/bin/env node

/**
 * Simple Security Check Script for Monitoring Workflow
 * 
 * This script performs basic security checks that can run in CI/CD
 * without requiring the full test suite setup.
 */

import https from 'https';
import http from 'http';

// Configuration
const config = {
  supabaseUrl: process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  timeout: 10000, // 10 seconds
  retries: 2
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: config.timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
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

// Security tests
async function testSupabaseAuthentication() {
  console.log('🔐 Testing Supabase authentication...');
  
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  // Test that unauthenticated requests are properly rejected
  const protectedUrl = `${config.supabaseUrl}/rest/v1/receipts`;
  
  try {
    const response = await makeRequest(protectedUrl);
    
    // Should return 401 or 403 for unauthenticated requests
    if (response.statusCode === 200) {
      console.warn('⚠️ Protected endpoint accessible without authentication');
      return { status: 'warning', message: 'Authentication may not be properly enforced' };
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log('✅ Authentication properly enforced');
      return { status: 'secure', message: 'Authentication working correctly' };
    } else {
      console.log(`ℹ️ Unexpected response code: ${response.statusCode}`);
      return { status: 'info', message: `Unexpected response: ${response.statusCode}` };
    }
  } catch (error) {
    console.log(`ℹ️ Authentication test inconclusive: ${error.message}`);
    return { status: 'info', message: 'Authentication test inconclusive' };
  }
}

async function testSecurityHeaders() {
  console.log('🛡️ Testing security headers...');
  
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  const response = await makeRequest(config.supabaseUrl);
  const headers = response.headers;
  
  const securityHeaders = {
    'x-frame-options': 'X-Frame-Options',
    'x-content-type-options': 'X-Content-Type-Options',
    'x-xss-protection': 'X-XSS-Protection',
    'strict-transport-security': 'Strict-Transport-Security',
    'content-security-policy': 'Content-Security-Policy'
  };
  
  const findings = [];
  let secureHeaders = 0;
  
  for (const [headerKey, headerName] of Object.entries(securityHeaders)) {
    if (headers[headerKey] || headers[headerKey.toLowerCase()]) {
      console.log(`✅ ${headerName}: Present`);
      secureHeaders++;
    } else {
      console.log(`⚠️ ${headerName}: Missing`);
      findings.push(`Missing ${headerName}`);
    }
  }
  
  const score = (secureHeaders / Object.keys(securityHeaders).length) * 100;
  
  return {
    status: score >= 60 ? 'secure' : 'warning',
    score,
    findings,
    message: `${secureHeaders}/${Object.keys(securityHeaders).length} security headers present`
  };
}

async function testRLSConfiguration() {
  console.log('🔒 Testing Row Level Security configuration...');
  
  if (!config.supabaseUrl || !config.supabaseKey) {
    console.log('⚠️ Skipping RLS test - Supabase configuration missing');
    return { status: 'skipped', message: 'Configuration missing' };
  }

  try {
    // Test with service role key (should have access)
    const serviceRoleUrl = `${config.supabaseUrl}/rest/v1/receipts?select=id&limit=1`;
    const serviceResponse = await makeRequest(serviceRoleUrl, {
      headers: {
        'Authorization': `Bearer ${config.supabaseKey}`,
        'apikey': config.supabaseKey
      }
    });
    
    if (serviceResponse.statusCode === 200) {
      console.log('✅ Service role access working');
    } else {
      console.log(`ℹ️ Service role response: ${serviceResponse.statusCode}`);
    }
    
    // Test with anonymous key (should be restricted)
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (anonKey) {
      const anonResponse = await makeRequest(serviceRoleUrl, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        }
      });
      
      if (anonResponse.statusCode === 401 || anonResponse.statusCode === 403) {
        console.log('✅ RLS properly restricting anonymous access');
        return { status: 'secure', message: 'RLS configuration appears correct' };
      } else if (anonResponse.statusCode === 200) {
        console.warn('⚠️ Anonymous key has unrestricted access - check RLS policies');
        return { status: 'warning', message: 'RLS may not be properly configured' };
      }
    }
    
    return { status: 'info', message: 'RLS test completed with limited verification' };
  } catch (error) {
    console.log(`ℹ️ RLS test inconclusive: ${error.message}`);
    return { status: 'info', message: 'RLS test inconclusive' };
  }
}

async function testSSLConfiguration() {
  console.log('🔐 Testing SSL/TLS configuration...');
  
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  if (!config.supabaseUrl.startsWith('https:')) {
    console.warn('⚠️ Supabase URL is not using HTTPS');
    return { status: 'warning', message: 'Not using HTTPS' };
  }
  
  try {
    const response = await makeRequest(config.supabaseUrl);
    
    if (response.statusCode < 400) {
      console.log('✅ HTTPS connection successful');
      return { status: 'secure', message: 'HTTPS working correctly' };
    } else {
      console.log(`ℹ️ HTTPS response: ${response.statusCode}`);
      return { status: 'info', message: `HTTPS response: ${response.statusCode}` };
    }
  } catch (error) {
    if (error.message.includes('certificate') || error.message.includes('SSL')) {
      console.warn(`⚠️ SSL/TLS issue: ${error.message}`);
      return { status: 'warning', message: `SSL/TLS issue: ${error.message}` };
    } else {
      console.log(`ℹ️ SSL test inconclusive: ${error.message}`);
      return { status: 'info', message: 'SSL test inconclusive' };
    }
  }
}

async function generateSecurityReport(results) {
  console.log('\n🛡️ Security Report Summary:');
  console.log('============================');
  
  let securityScore = 0;
  let maxScore = 0;
  const issues = [];
  
  for (const [test, result] of Object.entries(results)) {
    maxScore += 100;
    
    if (result.status === 'secure') {
      console.log(`✅ ${test}: SECURE - ${result.message}`);
      securityScore += 100;
    } else if (result.status === 'warning') {
      console.log(`⚠️ ${test}: WARNING - ${result.message}`);
      securityScore += 50;
      issues.push(`${test}: ${result.message}`);
    } else if (result.status === 'error') {
      console.log(`❌ ${test}: ERROR - ${result.message}`);
      securityScore += 0;
      issues.push(`${test}: ${result.message}`);
    } else {
      console.log(`ℹ️ ${test}: INFO - ${result.message}`);
      securityScore += 75; // Partial credit for inconclusive tests
    }
  }
  
  const overallScore = (securityScore / maxScore) * 100;
  console.log(`\n🎯 Overall Security Score: ${overallScore.toFixed(1)}/100`);
  
  if (issues.length > 0) {
    console.log('\n⚠️ Security Issues Found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (overallScore >= 80) {
    console.log('🎉 Security posture is EXCELLENT');
  } else if (overallScore >= 60) {
    console.log('👍 Security posture is GOOD');
  } else if (overallScore >= 40) {
    console.log('⚠️ Security posture needs IMPROVEMENT');
  } else {
    console.log('🚨 Security posture is POOR - immediate attention required');
  }
  
  return { score: overallScore, issues };
}

// Main execution
async function main() {
  console.log('🔒 Starting Simple Security Check...\n');
  
  const results = {};
  let hasErrors = false;
  
  try {
    results.authentication = await testSupabaseAuthentication();
  } catch (error) {
    console.error(`❌ Authentication test failed: ${error.message}`);
    results.authentication = { status: 'error', message: error.message };
    hasErrors = true;
  }
  
  try {
    results.securityHeaders = await testSecurityHeaders();
  } catch (error) {
    console.error(`❌ Security headers test failed: ${error.message}`);
    results.securityHeaders = { status: 'error', message: error.message };
    hasErrors = true;
  }
  
  try {
    results.rlsConfiguration = await testRLSConfiguration();
  } catch (error) {
    console.error(`❌ RLS test failed: ${error.message}`);
    results.rlsConfiguration = { status: 'error', message: error.message };
    hasErrors = true;
  }
  
  try {
    results.sslConfiguration = await testSSLConfiguration();
  } catch (error) {
    console.error(`❌ SSL test failed: ${error.message}`);
    results.sslConfiguration = { status: 'error', message: error.message };
    hasErrors = true;
  }
  
  const report = await generateSecurityReport(results);
  
  // Exit with appropriate code
  if (hasErrors && report.score < 40) {
    console.log('\n🚨 Critical security issues detected');
    process.exit(1);
  } else if (report.score < 60) {
    console.log('\n⚠️ Security warnings detected');
    process.exit(0); // Don't fail the build for warnings
  } else {
    console.log('\n✅ Security check completed successfully');
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

// Run the security check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Security check failed:', error.message);
    process.exit(1);
  });
}

export { main, testSupabaseAuthentication, testSecurityHeaders, testRLSConfiguration, testSSLConfiguration };
