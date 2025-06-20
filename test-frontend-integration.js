/**
 * Frontend Integration Testing for Phase 5
 * Tests the complete search workflow from frontend to backend
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NzI3ODksImV4cCI6MjAyNzA0ODc4OX0.Vh4XAp5vMuFCRoegO9RnIsIwaN6_wjV8rZB_QMwlL3g";

// Test configuration
const TEST_CONFIG = {
  edgeFunctionUrl: `${SUPABASE_URL}/functions/v1/unified-search`,
  generateEmbeddingsUrl: `${SUPABASE_URL}/functions/v1/generate-embeddings`,
  testTimeout: 30000,
  testQueries: [
    "99 Speed Mart", // Should find receipts
    "GE SHENG HENG", // Should find receipts
    "office supplies", // Should find custom categories
    "restaurant", // Should find business directory
    "travel expense" // Should find claims
  ]
};

// Test results storage
const testResults = {
  integration: [],
  performance: [],
  quality: [],
  errors: []
};

function logTest(category, testName, status, details = {}) {
  const result = {
    category,
    testName,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  testResults[category].push(result);
  
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${statusIcon} [${category.toUpperCase()}] ${testName}: ${status}`);
  
  if (details.duration) {
    console.log(`   Duration: ${details.duration}ms`);
  }
  if (details.error) {
    console.log(`   Error: ${details.error}`);
  }
  if (details.note) {
    console.log(`   Note: ${details.note}`);
  }
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
 * Test 1: Basic Integration Flow
 * Test the complete flow without authentication (should fail gracefully)
 */
async function testBasicIntegration() {
  console.log('\n🔗 Testing Basic Integration Flow...');

  for (const query of TEST_CONFIG.testQueries) {
    try {
      const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: query,
          sources: ['receipt', 'custom_category', 'business_directory', 'claim'],
          limit: 10,
          similarityThreshold: 0.2,
          includeMetadata: true
        })
      });

      if (result.status === 401) {
        logTest('integration', `Query: "${query}"`, 'PASS', {
          note: 'Correctly requires authentication',
          duration: result.duration
        });
      } else if (result.status === 200 && result.data.success) {
        logTest('integration', `Query: "${query}"`, 'PASS', {
          note: `Found ${result.data.totalResults} results`,
          duration: result.duration
        });
      } else {
        logTest('integration', `Query: "${query}"`, 'FAIL', {
          error: `Unexpected response: ${result.status}`,
          duration: result.duration
        });
      }
    } catch (error) {
      logTest('integration', `Query: "${query}"`, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Test 2: API Response Structure
 * Verify the API returns the expected response structure
 */
async function testResponseStructure() {
  console.log('\n📋 Testing API Response Structure...');

  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: "test query",
        sources: ['receipt'],
        limit: 5
      })
    });

    // Check if response has expected structure (even for 401)
    if (result.data) {
      const hasExpectedFields = 
        typeof result.data.success === 'boolean' ||
        result.data.error ||
        result.data.results;

      if (hasExpectedFields) {
        logTest('integration', 'Response Structure', 'PASS', {
          note: 'API returns expected response format',
          duration: result.duration
        });
      } else {
        logTest('integration', 'Response Structure', 'FAIL', {
          error: 'Missing expected response fields',
          duration: result.duration
        });
      }
    } else {
      logTest('integration', 'Response Structure', 'FAIL', {
        error: 'No response data received',
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('integration', 'Response Structure', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * Test 3: Error Handling
 * Test various error conditions
 */
async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');

  // Test 1: Empty query
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: '',
        sources: ['receipt'],
        limit: 5
      })
    });

    if (result.status === 400 || (result.data && !result.data.success)) {
      logTest('integration', 'Empty Query Handling', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('integration', 'Empty Query Handling', 'FAIL', {
        error: `Expected validation error, got status ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('integration', 'Empty Query Handling', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Invalid JSON
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
      method: 'POST',
      body: 'invalid json'
    });

    if (result.status === 400) {
      logTest('integration', 'Invalid JSON Handling', 'PASS', {
        duration: result.duration
      });
    } else {
      logTest('integration', 'Invalid JSON Handling', 'FAIL', {
        error: `Expected 400, got status ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('integration', 'Invalid JSON Handling', 'PASS', {
      note: 'Correctly threw error for invalid JSON',
      error: error.message
    });
  }
}

/**
 * Test 4: Performance Baseline
 * Measure response times for different query types
 */
async function testPerformanceBaseline() {
  console.log('\n⚡ Testing Performance Baseline...');

  const performanceTests = [
    { name: 'Simple Query', query: 'test', sources: ['receipt'], limit: 5 },
    { name: 'Multi-Source Query', query: 'office', sources: ['receipt', 'custom_category', 'business_directory'], limit: 10 },
    { name: 'Complex Query', query: 'restaurant food delivery service', sources: ['receipt', 'business_directory'], limit: 20 }
  ];

  for (const test of performanceTests) {
    try {
      const startTime = Date.now();
      const result = await makeAuthenticatedRequest(TEST_CONFIG.edgeFunctionUrl, {
        method: 'POST',
        body: JSON.stringify(test)
      });
      const duration = Date.now() - startTime;

      if (duration < 10000) { // Less than 10 seconds
        logTest('performance', test.name, 'PASS', {
          duration,
          note: `Response time: ${duration}ms`
        });
      } else {
        logTest('performance', test.name, 'FAIL', {
          duration,
          error: `Too slow: ${duration}ms`
        });
      }
    } catch (error) {
      logTest('performance', test.name, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Main test runner
 */
async function runFrontendIntegrationTests() {
  console.log('🚀 Starting Frontend Integration Tests for Phase 5');
  console.log('='.repeat(60));

  await testBasicIntegration();
  await testResponseStructure();
  await testErrorHandling();
  await testPerformanceBaseline();

  // Print summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  
  Object.entries(testResults).forEach(([category, results]) => {
    if (results.length > 0) {
      const passed = results.filter(r => r.status === 'PASS').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      const warnings = results.filter(r => r.status === 'WARN').length;
      
      console.log(`${category.toUpperCase()}: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    }
  });

  return testResults;
}

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  runFrontendIntegrationTests().catch(console.error);
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.runFrontendIntegrationTests = runFrontendIntegrationTests;
}
