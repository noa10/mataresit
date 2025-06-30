/**
 * CORS Testing Utilities for Mataresit Search
 * Provides comprehensive testing for Edge Function CORS configuration
 */

import { SUPABASE_URL } from '@/lib/supabase';

export interface CorsTestResult {
  functionName: string;
  success: boolean;
  error?: string;
  headers?: Record<string, string>;
  responseTime?: number;
}

export interface CorsTestSuite {
  preflightTest: CorsTestResult;
  actualRequestTest: CorsTestResult;
  authenticationTest: CorsTestResult;
}

/**
 * Test CORS preflight (OPTIONS) request for a specific Edge Function
 */
export async function testCorsPreflightRequest(functionName: string): Promise<CorsTestResult> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type, apikey'
      }
    });

    const responseTime = performance.now() - startTime;
    const headers: Record<string, string> = {};
    
    // Collect CORS headers from response
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control-')) {
        headers[key] = value;
      }
    });

    return {
      functionName,
      success: response.ok,
      headers,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime: performance.now() - startTime
    };
  }
}

/**
 * Test actual POST request to Edge Function (without authentication)
 */
export async function testCorsActualRequest(functionName: string, payload: any = {}): Promise<CorsTestResult> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(payload)
    });

    const responseTime = performance.now() - startTime;
    const headers: Record<string, string> = {};
    
    // Collect CORS headers from response
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control-')) {
        headers[key] = value;
      }
    });

    return {
      functionName,
      success: response.status !== 0, // Any response (even 401) means CORS is working
      headers,
      responseTime,
      error: response.status === 0 ? 'CORS blocked request' : undefined
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime: performance.now() - startTime
    };
  }
}

/**
 * Test authenticated request to Edge Function
 */
export async function testCorsAuthenticatedRequest(
  functionName: string, 
  authToken: string, 
  payload: any = {}
): Promise<CorsTestResult> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Origin': window.location.origin
      },
      body: JSON.stringify(payload)
    });

    const responseTime = performance.now() - startTime;
    const headers: Record<string, string> = {};
    
    // Collect CORS headers from response
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('access-control-')) {
        headers[key] = value;
      }
    });

    return {
      functionName,
      success: response.status !== 0, // Any response means CORS is working
      headers,
      responseTime,
      error: response.status === 0 ? 'CORS blocked authenticated request' : undefined
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime: performance.now() - startTime
    };
  }
}

/**
 * Run comprehensive CORS test suite for a specific Edge Function
 */
export async function runCorsTestSuite(
  functionName: string, 
  authToken?: string
): Promise<CorsTestSuite> {
  console.log(`🧪 Running CORS test suite for ${functionName}...`);

  const preflightTest = await testCorsPreflightRequest(functionName);
  const actualRequestTest = await testCorsActualRequest(functionName, { test: true });
  
  let authenticationTest: CorsTestResult;
  if (authToken) {
    authenticationTest = await testCorsAuthenticatedRequest(functionName, authToken, { test: true });
  } else {
    authenticationTest = {
      functionName,
      success: false,
      error: 'No auth token provided for authentication test'
    };
  }

  return {
    preflightTest,
    actualRequestTest,
    authenticationTest
  };
}

/**
 * Test unified-search Edge Function specifically with search payload
 */
export async function testUnifiedSearchCors(authToken?: string): Promise<CorsTestSuite> {
  const searchPayload = {
    query: 'test search',
    sources: ['receipts'],
    limit: 5,
    offset: 0,
    similarityThreshold: 0.2,
    includeMetadata: true
  };

  console.log('🔍 Testing unified-search CORS with search payload...');

  const preflightTest = await testCorsPreflightRequest('unified-search');
  const actualRequestTest = await testCorsActualRequest('unified-search', searchPayload);
  
  let authenticationTest: CorsTestResult;
  if (authToken) {
    authenticationTest = await testCorsAuthenticatedRequest('unified-search', authToken, searchPayload);
  } else {
    authenticationTest = {
      functionName: 'unified-search',
      success: false,
      error: 'No auth token provided for authentication test'
    };
  }

  return {
    preflightTest,
    actualRequestTest,
    authenticationTest
  };
}

/**
 * Generate a comprehensive CORS test report
 */
export function generateCorsTestReport(testSuite: CorsTestSuite): string {
  const { preflightTest, actualRequestTest, authenticationTest } = testSuite;
  
  let report = `\n🧪 CORS Test Report for ${preflightTest.functionName}\n`;
  report += '='.repeat(50) + '\n\n';
  
  // Preflight test
  report += `1. Preflight (OPTIONS) Test: ${preflightTest.success ? '✅ PASS' : '❌ FAIL'}\n`;
  if (preflightTest.error) {
    report += `   Error: ${preflightTest.error}\n`;
  }
  if (preflightTest.responseTime) {
    report += `   Response Time: ${preflightTest.responseTime.toFixed(2)}ms\n`;
  }
  if (preflightTest.headers) {
    report += '   CORS Headers:\n';
    Object.entries(preflightTest.headers).forEach(([key, value]) => {
      report += `     ${key}: ${value}\n`;
    });
  }
  report += '\n';
  
  // Actual request test
  report += `2. Actual Request Test: ${actualRequestTest.success ? '✅ PASS' : '❌ FAIL'}\n`;
  if (actualRequestTest.error) {
    report += `   Error: ${actualRequestTest.error}\n`;
  }
  if (actualRequestTest.responseTime) {
    report += `   Response Time: ${actualRequestTest.responseTime.toFixed(2)}ms\n`;
  }
  report += '\n';
  
  // Authentication test
  report += `3. Authentication Test: ${authenticationTest.success ? '✅ PASS' : '❌ FAIL'}\n`;
  if (authenticationTest.error) {
    report += `   Error: ${authenticationTest.error}\n`;
  }
  if (authenticationTest.responseTime) {
    report += `   Response Time: ${authenticationTest.responseTime.toFixed(2)}ms\n`;
  }
  report += '\n';
  
  // Overall assessment
  const allPassed = preflightTest.success && actualRequestTest.success && authenticationTest.success;
  report += `Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`;
  
  if (!allPassed) {
    report += '\n📋 Recommendations:\n';
    if (!preflightTest.success) {
      report += '- Check CORS headers configuration in Edge Function\n';
      report += '- Ensure OPTIONS method is handled properly\n';
    }
    if (!actualRequestTest.success) {
      report += '- Verify Edge Function is deployed and accessible\n';
      report += '- Check for network connectivity issues\n';
    }
    if (!authenticationTest.success && authenticationTest.error !== 'No auth token provided for authentication test') {
      report += '- Verify authentication token is valid\n';
      report += '- Check JWT verification configuration\n';
    }
  }
  
  return report;
}
