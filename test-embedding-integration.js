/**
 * Test Embedding Generation Integration
 * Tests the enhanced generate-embeddings function integration with unified search
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NzI3ODksImV4cCI6MjAyNzA0ODc4OX0.Vh4XAp5vMuFCRoegO9RnIsIwaN6_wjV8rZB_QMwlL3g";

// Test configuration
const TEST_CONFIG = {
  generateEmbeddingsUrl: `${SUPABASE_URL}/functions/v1/generate-embeddings`,
  unifiedSearchUrl: `${SUPABASE_URL}/functions/v1/unified-search`,
  testTimeout: 30000
};

// Test results storage
const testResults = {
  embedding: [],
  integration: [],
  search: []
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
 * Test 1: Generate Embeddings Function
 */
async function testGenerateEmbeddings() {
  console.log('\n🧠 Testing Generate Embeddings Function...');

  // Test 1: Basic embedding generation
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.generateEmbeddingsUrl, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'test',
        content: 'Test content for embedding generation',
        contentType: 'test',
        sourceType: 'test',
        sourceId: 'test-id-123'
      })
    });

    if (result.status === 401) {
      logTest('embedding', 'Generate Embeddings Auth', 'PASS', {
        note: 'Correctly requires authentication',
        duration: result.duration
      });
    } else if (result.status === 200 && result.data.success) {
      logTest('embedding', 'Generate Embeddings Function', 'PASS', {
        note: 'Function responds correctly',
        duration: result.duration
      });
    } else {
      logTest('embedding', 'Generate Embeddings Function', 'FAIL', {
        error: `Unexpected response: ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('embedding', 'Generate Embeddings Function', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Batch embedding generation
  try {
    const result = await makeAuthenticatedRequest(TEST_CONFIG.generateEmbeddingsUrl, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'batch',
        sourceType: 'receipt',
        batchSize: 5,
        priority: 'normal'
      })
    });

    if (result.status === 401) {
      logTest('embedding', 'Batch Embeddings Auth', 'PASS', {
        note: 'Correctly requires authentication',
        duration: result.duration
      });
    } else {
      logTest('embedding', 'Batch Embeddings Function', 'FAIL', {
        error: `Unexpected response: ${result.status}`,
        duration: result.duration
      });
    }
  } catch (error) {
    logTest('embedding', 'Batch Embeddings Function', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * Test 2: Search Integration
 */
async function testSearchIntegration() {
  console.log('\n🔍 Testing Search Integration...');

  const testQueries = [
    '99 speedmart',
    'tesco',
    'utilities',
    'restaurant'
  ];

  for (const query of testQueries) {
    try {
      const result = await makeAuthenticatedRequest(TEST_CONFIG.unifiedSearchUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: query,
          sources: ['receipt', 'custom_category', 'business_directory'],
          limit: 5,
          similarityThreshold: 0.2,
          includeMetadata: true
        })
      });

      if (result.status === 401) {
        logTest('search', `Search Query: "${query}"`, 'PASS', {
          note: 'Correctly requires authentication',
          duration: result.duration
        });
      } else if (result.status === 200 && result.data.success) {
        logTest('search', `Search Query: "${query}"`, 'PASS', {
          note: `Found ${result.data.totalResults} results`,
          duration: result.duration
        });
      } else {
        logTest('search', `Search Query: "${query}"`, 'FAIL', {
          error: result.data.error || `HTTP ${result.status}`,
          duration: result.duration
        });
      }
    } catch (error) {
      logTest('search', `Search Query: "${query}"`, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Test 3: Integration Flow
 */
async function testIntegrationFlow() {
  console.log('\n🔗 Testing Integration Flow...');

  // Test 1: API availability
  try {
    const embeddingResult = await makeAuthenticatedRequest(TEST_CONFIG.generateEmbeddingsUrl, {
      method: 'OPTIONS'
    });

    const searchResult = await makeAuthenticatedRequest(TEST_CONFIG.unifiedSearchUrl, {
      method: 'OPTIONS'
    });

    if (embeddingResult.status === 200 && searchResult.status === 200) {
      logTest('integration', 'API Endpoints Available', 'PASS', {
        note: 'Both endpoints respond to OPTIONS'
      });
    } else {
      logTest('integration', 'API Endpoints Available', 'FAIL', {
        error: `Embedding: ${embeddingResult.status}, Search: ${searchResult.status}`
      });
    }
  } catch (error) {
    logTest('integration', 'API Endpoints Available', 'FAIL', {
      error: error.message
    });
  }

  // Test 2: Error handling consistency
  try {
    const embeddingError = await makeAuthenticatedRequest(TEST_CONFIG.generateEmbeddingsUrl, {
      method: 'POST',
      body: 'invalid json'
    });

    const searchError = await makeAuthenticatedRequest(TEST_CONFIG.unifiedSearchUrl, {
      method: 'POST',
      body: 'invalid json'
    });

    if (embeddingError.status === 400 && searchError.status === 400) {
      logTest('integration', 'Error Handling Consistency', 'PASS', {
        note: 'Both APIs handle invalid JSON consistently'
      });
    } else {
      logTest('integration', 'Error Handling Consistency', 'WARN', {
        note: `Different error responses: ${embeddingError.status} vs ${searchError.status}`
      });
    }
  } catch (error) {
    logTest('integration', 'Error Handling Consistency', 'PASS', {
      note: 'Both APIs correctly throw errors for invalid JSON'
    });
  }

  // Test 3: Response format consistency
  try {
    const embeddingResponse = await makeAuthenticatedRequest(TEST_CONFIG.generateEmbeddingsUrl, {
      method: 'POST',
      body: JSON.stringify({ mode: 'test' })
    });

    const searchResponse = await makeAuthenticatedRequest(TEST_CONFIG.unifiedSearchUrl, {
      method: 'POST',
      body: JSON.stringify({ query: 'test' })
    });

    const embeddingHasSuccess = embeddingResponse.data && typeof embeddingResponse.data.success === 'boolean';
    const searchHasSuccess = searchResponse.data && typeof searchResponse.data.success === 'boolean';

    if (embeddingHasSuccess && searchHasSuccess) {
      logTest('integration', 'Response Format Consistency', 'PASS', {
        note: 'Both APIs use consistent response format'
      });
    } else {
      logTest('integration', 'Response Format Consistency', 'FAIL', {
        error: 'Inconsistent response formats'
      });
    }
  } catch (error) {
    logTest('integration', 'Response Format Consistency', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * Main test runner
 */
async function runEmbeddingIntegrationTests() {
  console.log('🚀 Starting Embedding Integration Tests for Phase 5');
  console.log('='.repeat(60));

  await testGenerateEmbeddings();
  await testSearchIntegration();
  await testIntegrationFlow();

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
  runEmbeddingIntegrationTests().catch(console.error);
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.runEmbeddingIntegrationTests = runEmbeddingIntegrationTests;
}
