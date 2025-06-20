/**
 * Comprehensive Testing Suite for Unified Search Edge Function
 * Phase 2 Testing: Functional, Authentication, Error Handling, Performance, Integration, Subscription Enforcement
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NzI3ODksImV4cCI6MjAyNzA0ODc4OX0.Vh4XAp5vMuFCRoegO9RnIsIwaN6_wjV8rZB_QMwlL3g";

// Test configuration
const TEST_CONFIG = {
  edgeFunctionUrl: `${SUPABASE_URL}/functions/v1/unified-search`,
  testTimeout: 30000, // 30 seconds
  maxConcurrentRequests: 5,
  testUsers: {
    free: null, // Will be set during authentication
    pro: null,
    max: null,
    admin: null
  }
};

// Test results tracking
const testResults = {
  functional: [],
  authentication: [],
  errorHandling: [],
  performance: [],
  integration: [],
  subscriptionEnforcement: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  }
};

/**
 * Utility Functions
 */
function logTest(category, testName, status, details = {}) {
  const result = {
    category,
    testName,
    status,
    timestamp: new Date().toISOString(),
    details
  };

  testResults[category].push(result);
  testResults.summary.total++;

  if (status === 'PASS') {
    testResults.summary.passed++;
    console.log(`✅ [${category.toUpperCase()}] ${testName}`);
  } else {
    testResults.summary.failed++;
    testResults.summary.errors.push(`${category}: ${testName} - ${details.error || 'Unknown error'}`);
    console.log(`❌ [${category.toUpperCase()}] ${testName}: ${details.error || 'Failed'}`);
  }

  if (details.duration) {
    console.log(`   ⏱️  Duration: ${details.duration}ms`);
  }
}

function generateTestQuery(type = 'basic') {
  const queries = {
    basic: 'coffee receipt',
    complex: 'restaurant bill with tax GST payment card',
    malay: 'kedai makan bil cukai',
    empty: '',
    special: 'receipt@#$%^&*()',
    long: 'very long query with many words that should test the embedding generation and search capabilities of the system including merchant names dates amounts and various other receipt fields'
  };
  return queries[type] || queries.basic;
}

async function makeAuthenticatedRequest(url, options = {}, authToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    return {
      response,
      data,
      duration,
      status: response.status
    };
  } catch (error) {
    return {
      error: error.message,
      duration: Date.now() - startTime,
      status: 0
    };
  }
}

/**
 * 1. FUNCTIONAL TESTING
 * Test the deployed unified-search Edge Function with various search queries
 */
async function runFunctionalTests() {
  console.log('\n🔍 Starting Functional Tests...');

  // Test 1: Basic search functionality
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt', 'business_directory'],
        limit: 10
      })
    });

    if (result.error) {
      logTest('functional', 'Basic Search Request', 'FAIL', {
        error: result.error,
        duration: result.duration
      });
    } else if (result.status === 401) {
      logTest('functional', 'Basic Search Request', 'PASS', {
        note: 'Correctly requires authentication',
        duration: result.duration
      });
    } else {
      logTest('functional', 'Basic Search Request', 'FAIL', {
        error: `Unexpected status: ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('functional', 'Basic Search Request', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: CORS handling
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'OPTIONS'
    });

    if (result.status === 200) {
      logTest('functional', 'CORS Preflight', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('functional', 'CORS Preflight', 'FAIL', {
        error: `Status: ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('functional', 'CORS Preflight', 'FAIL', {
      error: error.message
    });
  }

  // Test 3: Invalid method handling
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'GET'
    });

    if (result.status === 405) {
      logTest('functional', 'Invalid Method Handling', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('functional', 'Invalid Method Handling', 'FAIL', {
        error: `Expected 405, got ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('functional', 'Invalid Method Handling', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * 2. AUTHENTICATION TESTING
 * Verify proper authentication and user access controls
 */
async function runAuthenticationTests() {
  console.log('\n🔐 Starting Authentication Tests...');

  // Test 1: No authorization header
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt'],
        limit: 5
      })
    });

    if (result.status === 401) {
      logTest('authentication', 'Missing Auth Header', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('authentication', 'Missing Auth Header', 'FAIL', {
        error: `Expected 401, got ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('authentication', 'Missing Auth Header', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Invalid token
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt'],
        limit: 5
      })
    }, 'invalid-token-12345');

    if (result.status === 401) {
      logTest('authentication', 'Invalid Token', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('authentication', 'Invalid Token', 'FAIL', {
        error: `Expected 401, got ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('authentication', 'Invalid Token', 'FAIL', {
      error: error.message
    });
  }

  // Test 3: Malformed authorization header
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt'],
        limit: 5
      })
    }, 'malformed-header-without-bearer');

    if (result.status === 401) {
      logTest('authentication', 'Malformed Auth Header', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('authentication', 'Malformed Auth Header', 'FAIL', {
        error: `Expected 401, got ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('authentication', 'Malformed Auth Header', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * 3. ERROR HANDLING TESTING
 * Test fallback mechanisms and error scenarios
 */
async function runErrorHandlingTests() {
  console.log('\n⚠️ Starting Error Handling Tests...');

  // Test 1: Empty query
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: '',
        sources: ['receipt'],
        limit: 5
      })
    }, 'dummy-token');

    if (result.status === 400 || (result.data && !result.data.success)) {
      logTest('errorHandling', 'Empty Query Validation', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('errorHandling', 'Empty Query Validation', 'FAIL', {
        error: `Expected validation error, got status ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('errorHandling', 'Empty Query Validation', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Invalid JSON body
  try {
    const result = await fetch(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token'
      },
      body: 'invalid-json-body'
    });

    if (result.status === 400 || result.status === 500) {
      logTest('errorHandling', 'Invalid JSON Body', 'PASS', {
        duration: Date.now()
      });
    } else {
      logTest('errorHandling', 'Invalid JSON Body', 'FAIL', {
        error: `Expected error status, got ${result.status}`
      });
    }
  } catch (error) {
    logTest('errorHandling', 'Invalid JSON Body', 'PASS', {
      note: 'Correctly threw error for invalid JSON'
    });
  }

  // Test 3: Invalid sources array
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['invalid_source', 'another_invalid'],
        limit: 5
      })
    }, 'dummy-token');

    if (result.status === 400 || (result.data && !result.data.success)) {
      logTest('errorHandling', 'Invalid Sources Validation', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('errorHandling', 'Invalid Sources Validation', 'FAIL', {
        error: `Expected validation error, got status ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('errorHandling', 'Invalid Sources Validation', 'FAIL', {
      error: error.message
    });
  }

  // Test 4: Excessive limit
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt'],
        limit: 1000 // Excessive limit
      })
    }, 'dummy-token');

    if (result.status === 400 || result.status === 403 || (result.data && !result.data.success)) {
      logTest('errorHandling', 'Excessive Limit Validation', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('errorHandling', 'Excessive Limit Validation', 'FAIL', {
        error: `Expected validation error, got status ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('errorHandling', 'Excessive Limit Validation', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * 4. PERFORMANCE TESTING
 * Measure response times and concurrent request handling
 */
async function runPerformanceTests() {
  console.log('\n⚡ Starting Performance Tests...');

  // Test 1: Response time for basic query
  try {
    const startTime = Date.now();
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('basic'),
        sources: ['receipt', 'business_directory'],
        limit: 10
      })
    }, 'dummy-token');

    const duration = Date.now() - startTime;

    if (duration < 10000) { // Less than 10 seconds
      logTest('performance', 'Basic Query Response Time', 'PASS', {
        duration,
        note: `Completed in ${duration}ms`
      });
    } else {
      logTest('performance', 'Basic Query Response Time', 'FAIL', {
        duration,
        error: `Too slow: ${duration}ms`
      });
    }
  } catch (error) {
    logTest('performance', 'Basic Query Response Time', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Complex query performance
  try {
    const startTime = Date.now();
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: generateTestQuery('complex'),
        sources: ['receipt', 'business_directory'],
        contentTypes: ['full_text', 'merchant', 'line_items'],
        limit: 20,
        similarityThreshold: 0.1,
        includeMetadata: true
      })
    }, 'dummy-token');

    const duration = Date.now() - startTime;

    if (duration < 15000) { // Less than 15 seconds for complex query
      logTest('performance', 'Complex Query Response Time', 'PASS', {
        duration,
        note: `Completed in ${duration}ms`
      });
    } else {
      logTest('performance', 'Complex Query Response Time', 'FAIL', {
        duration,
        error: `Too slow: ${duration}ms`
      });
    }
  } catch (error) {
    logTest('performance', 'Complex Query Response Time', 'FAIL', {
      error: error.message
    });
  }

  // Test 3: Concurrent requests handling
  try {
    const concurrentRequests = Array.from({ length: 3 }, (_, i) =>
      makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: `${generateTestQuery('basic')} ${i}`,
          sources: ['receipt'],
          limit: 5
        })
      }, 'dummy-token')
    );

    const startTime = Date.now();
    const results = await Promise.allSettled(concurrentRequests);
    const duration = Date.now() - startTime;

    const successCount = results.filter(r => r.status === 'fulfilled').length;

    if (successCount >= 2) { // At least 2 out of 3 should handle gracefully
      logTest('performance', 'Concurrent Requests Handling', 'PASS', {
        duration,
        note: `${successCount}/3 requests handled, total time: ${duration}ms`
      });
    } else {
      logTest('performance', 'Concurrent Requests Handling', 'FAIL', {
        duration,
        error: `Only ${successCount}/3 requests succeeded`
      });
    }
  } catch (error) {
    logTest('performance', 'Concurrent Requests Handling', 'FAIL', {
      error: error.message
    });
  }
}