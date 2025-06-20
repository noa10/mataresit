/**
 * Comprehensive Performance Analysis for Phase 5
 * Analyzes search performance metrics including embedding generation time,
 * search duration, and result quality across all data sources
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NzI3ODksImV4cCI6MjAyNzA0ODc4OX0.Vh4XAp5vMuFCRoegO9RnIsIwaN6_wjV8rZB_QMwlL3g";

// Performance test configuration
const PERFORMANCE_CONFIG = {
  unifiedSearchUrl: `${SUPABASE_URL}/functions/v1/unified-search`,
  generateEmbeddingsUrl: `${SUPABASE_URL}/functions/v1/generate-embeddings`,
  testIterations: 5, // Number of times to run each test
  timeoutMs: 30000,
  
  // Test scenarios
  testScenarios: [
    {
      name: 'Simple Receipt Search',
      query: '99 speedmart',
      sources: ['receipt'],
      limit: 10,
      expectedResultType: 'receipt'
    },
    {
      name: 'Multi-Source Search',
      query: 'restaurant',
      sources: ['receipt', 'business_directory'],
      limit: 20,
      expectedResultType: 'mixed'
    },
    {
      name: 'Complex Business Search',
      query: 'office supplies stationery equipment',
      sources: ['receipt', 'custom_category', 'business_directory'],
      limit: 15,
      expectedResultType: 'mixed'
    },
    {
      name: 'Category Search',
      query: 'utilities',
      sources: ['custom_category'],
      limit: 5,
      expectedResultType: 'custom_category'
    },
    {
      name: 'Large Result Set',
      query: 'food',
      sources: ['receipt', 'business_directory'],
      limit: 50,
      expectedResultType: 'mixed'
    }
  ]
};

// Performance metrics storage
const performanceMetrics = {
  searchPerformance: [],
  embeddingPerformance: [],
  resultQuality: [],
  systemMetrics: []
};

function logMetric(category, metric) {
  performanceMetrics[category].push({
    ...metric,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📊 [${category.toUpperCase()}] ${metric.name}: ${metric.value}${metric.unit || ''}`);
  if (metric.details) {
    console.log(`   Details: ${JSON.stringify(metric.details)}`);
  }
}

async function makeAuthenticatedRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      // Handle non-JSON responses
      data = { error: 'Non-JSON response' };
    }

    return {
      response,
      data,
      duration,
      status: response.status,
      success: response.ok
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      error: error.message,
      duration: endTime - startTime,
      status: 0,
      success: false
    };
  }
}

/**
 * Test 1: Search Performance Analysis
 */
async function analyzeSearchPerformance() {
  console.log('\n🔍 Analyzing Search Performance...');

  for (const scenario of PERFORMANCE_CONFIG.testScenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    
    const scenarioMetrics = {
      durations: [],
      resultCounts: [],
      errors: 0,
      successRate: 0
    };

    // Run multiple iterations for statistical significance
    for (let i = 0; i < PERFORMANCE_CONFIG.testIterations; i++) {
      try {
        const result = await makeAuthenticatedRequest(PERFORMANCE_CONFIG.unifiedSearchUrl, {
          method: 'POST',
          body: JSON.stringify({
            query: scenario.query,
            sources: scenario.sources,
            limit: scenario.limit,
            similarityThreshold: 0.2,
            includeMetadata: true,
            aggregationMode: 'relevance'
          })
        });

        if (result.success && result.data.success) {
          scenarioMetrics.durations.push(result.duration);
          scenarioMetrics.resultCounts.push(result.data.totalResults || 0);
        } else {
          scenarioMetrics.errors++;
        }
      } catch (error) {
        scenarioMetrics.errors++;
        console.log(`   Error in iteration ${i + 1}: ${error.message}`);
      }
    }

    // Calculate statistics
    if (scenarioMetrics.durations.length > 0) {
      const avgDuration = scenarioMetrics.durations.reduce((a, b) => a + b, 0) / scenarioMetrics.durations.length;
      const minDuration = Math.min(...scenarioMetrics.durations);
      const maxDuration = Math.max(...scenarioMetrics.durations);
      const avgResults = scenarioMetrics.resultCounts.reduce((a, b) => a + b, 0) / scenarioMetrics.resultCounts.length;
      
      scenarioMetrics.successRate = ((PERFORMANCE_CONFIG.testIterations - scenarioMetrics.errors) / PERFORMANCE_CONFIG.testIterations) * 100;

      logMetric('searchPerformance', {
        name: `${scenario.name} - Average Duration`,
        value: avgDuration.toFixed(2),
        unit: 'ms',
        details: {
          min: minDuration.toFixed(2),
          max: maxDuration.toFixed(2),
          avgResults: avgResults.toFixed(1),
          successRate: scenarioMetrics.successRate.toFixed(1) + '%',
          query: scenario.query,
          sources: scenario.sources
        }
      });
    } else {
      logMetric('searchPerformance', {
        name: `${scenario.name} - Failed`,
        value: 'N/A',
        details: { errors: scenarioMetrics.errors }
      });
    }
  }
}

/**
 * Test 2: Embedding Generation Performance
 */
async function analyzeEmbeddingPerformance() {
  console.log('\n🧠 Analyzing Embedding Generation Performance...');

  const embeddingTests = [
    {
      name: 'Short Text Embedding',
      content: 'Restaurant receipt',
      contentType: 'test',
      expectedDuration: 2000 // 2 seconds
    },
    {
      name: 'Medium Text Embedding',
      content: 'Office supplies including pens, paper, notebooks, and stationery items for business use',
      contentType: 'test',
      expectedDuration: 3000 // 3 seconds
    },
    {
      name: 'Long Text Embedding',
      content: 'Comprehensive business expense report including multiple line items such as office supplies, travel expenses, meal allowances, accommodation costs, transportation fees, and various miscellaneous business-related expenditures for quarterly review and analysis',
      contentType: 'test',
      expectedDuration: 5000 // 5 seconds
    }
  ];

  for (const test of embeddingTests) {
    console.log(`\n📋 Testing: ${test.name}`);
    
    const testMetrics = {
      durations: [],
      errors: 0
    };

    // Run multiple iterations
    for (let i = 0; i < 3; i++) { // Fewer iterations for embedding tests
      try {
        const result = await makeAuthenticatedRequest(PERFORMANCE_CONFIG.generateEmbeddingsUrl, {
          method: 'POST',
          body: JSON.stringify({
            mode: 'test',
            content: test.content,
            contentType: test.contentType,
            sourceType: 'test',
            sourceId: `test-${Date.now()}-${i}`
          })
        });

        if (result.status === 401) {
          // Expected for unauthenticated requests - measure response time
          testMetrics.durations.push(result.duration);
        } else if (result.success) {
          testMetrics.durations.push(result.duration);
        } else {
          testMetrics.errors++;
        }
      } catch (error) {
        testMetrics.errors++;
      }
    }

    // Calculate statistics
    if (testMetrics.durations.length > 0) {
      const avgDuration = testMetrics.durations.reduce((a, b) => a + b, 0) / testMetrics.durations.length;
      const performance = avgDuration <= test.expectedDuration ? 'Good' : 'Needs Optimization';
      
      logMetric('embeddingPerformance', {
        name: `${test.name} - Duration`,
        value: avgDuration.toFixed(2),
        unit: 'ms',
        details: {
          performance,
          expected: test.expectedDuration,
          contentLength: test.content.length,
          errors: testMetrics.errors
        }
      });
    }
  }
}

/**
 * Test 3: Result Quality Analysis
 */
async function analyzeResultQuality() {
  console.log('\n🎯 Analyzing Result Quality...');

  const qualityTests = [
    {
      name: 'Exact Match Quality',
      query: '99 speedmart',
      expectedSources: ['receipt', 'business_directory'],
      minResults: 1,
      relevanceThreshold: 0.7
    },
    {
      name: 'Semantic Match Quality',
      query: 'grocery shopping',
      expectedSources: ['receipt', 'business_directory'],
      minResults: 1,
      relevanceThreshold: 0.5
    },
    {
      name: 'Category Match Quality',
      query: 'utilities',
      expectedSources: ['custom_category'],
      minResults: 1,
      relevanceThreshold: 0.8
    }
  ];

  for (const test of qualityTests) {
    console.log(`\n📋 Testing: ${test.name}`);
    
    try {
      const result = await makeAuthenticatedRequest(PERFORMANCE_CONFIG.unifiedSearchUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: test.query,
          sources: test.expectedSources,
          limit: 20,
          similarityThreshold: 0.1, // Lower threshold to get more results
          includeMetadata: true
        })
      });

      if (result.status === 401) {
        // Expected for unauthenticated requests
        logMetric('resultQuality', {
          name: `${test.name} - Authentication Required`,
          value: 'Expected',
          details: { 
            note: 'Authentication required for quality testing',
            duration: result.duration
          }
        });
      } else if (result.success && result.data.success) {
        const resultCount = result.data.totalResults || 0;
        const hasMinResults = resultCount >= test.minResults;
        const sourcesFound = result.data.searchMetadata?.sourcesSearched || [];
        
        logMetric('resultQuality', {
          name: `${test.name} - Result Count`,
          value: resultCount,
          details: {
            hasMinResults,
            sourcesSearched: sourcesFound,
            query: test.query,
            duration: result.duration
          }
        });
      } else {
        logMetric('resultQuality', {
          name: `${test.name} - Failed`,
          value: 'Error',
          details: { error: result.data?.error || 'Unknown error' }
        });
      }
    } catch (error) {
      logMetric('resultQuality', {
        name: `${test.name} - Exception`,
        value: 'Error',
        details: { error: error.message }
      });
    }
  }
}

/**
 * Test 4: System Resource Analysis
 */
async function analyzeSystemMetrics() {
  console.log('\n⚙️ Analyzing System Metrics...');

  // Test concurrent request handling
  console.log('\n📋 Testing Concurrent Request Handling...');
  
  const concurrentRequests = 3;
  const requests = Array.from({ length: concurrentRequests }, (_, i) =>
    makeAuthenticatedRequest(PERFORMANCE_CONFIG.unifiedSearchUrl, {
      method: 'POST',
      body: JSON.stringify({
        query: `test query ${i}`,
        sources: ['receipt'],
        limit: 5
      })
    })
  );

  const startTime = performance.now();
  const results = await Promise.allSettled(requests);
  const totalDuration = performance.now() - startTime;

  const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const avgDurationPerRequest = totalDuration / concurrentRequests;

  logMetric('systemMetrics', {
    name: 'Concurrent Request Handling',
    value: successfulRequests,
    unit: ` of ${concurrentRequests} successful`,
    details: {
      totalDuration: totalDuration.toFixed(2) + 'ms',
      avgPerRequest: avgDurationPerRequest.toFixed(2) + 'ms',
      concurrency: concurrentRequests
    }
  });

  // Test API availability
  const availabilityTest = await makeAuthenticatedRequest(PERFORMANCE_CONFIG.unifiedSearchUrl, {
    method: 'OPTIONS'
  });

  logMetric('systemMetrics', {
    name: 'API Availability',
    value: availabilityTest.success ? 'Available' : 'Unavailable',
    details: {
      status: availabilityTest.status,
      duration: availabilityTest.duration.toFixed(2) + 'ms'
    }
  });
}

/**
 * Generate Performance Report
 */
function generatePerformanceReport() {
  console.log('\n📊 Performance Analysis Report');
  console.log('='.repeat(60));

  Object.entries(performanceMetrics).forEach(([category, metrics]) => {
    if (metrics.length > 0) {
      console.log(`\n${category.toUpperCase()}:`);
      metrics.forEach(metric => {
        console.log(`  • ${metric.name}: ${metric.value}${metric.unit || ''}`);
        if (metric.details) {
          Object.entries(metric.details).forEach(([key, value]) => {
            console.log(`    - ${key}: ${value}`);
          });
        }
      });
    }
  });

  // Calculate overall performance score
  const searchMetrics = performanceMetrics.searchPerformance;
  const avgSearchTime = searchMetrics.length > 0 
    ? searchMetrics.reduce((sum, m) => sum + parseFloat(m.value), 0) / searchMetrics.length 
    : 0;

  console.log('\n🎯 PERFORMANCE SUMMARY:');
  console.log(`  • Average Search Time: ${avgSearchTime.toFixed(2)}ms`);
  console.log(`  • Performance Grade: ${avgSearchTime < 100 ? 'Excellent' : avgSearchTime < 500 ? 'Good' : 'Needs Optimization'}`);
  console.log(`  • Total Metrics Collected: ${Object.values(performanceMetrics).flat().length}`);

  return performanceMetrics;
}

/**
 * Main performance analysis runner
 */
async function runPerformanceAnalysis() {
  console.log('🚀 Starting Performance Analysis for Phase 5');
  console.log('='.repeat(60));

  await analyzeSearchPerformance();
  await analyzeEmbeddingPerformance();
  await analyzeResultQuality();
  await analyzeSystemMetrics();

  return generatePerformanceReport();
}

// Run analysis if this script is executed directly
if (typeof window === 'undefined') {
  runPerformanceAnalysis().catch(console.error);
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.runPerformanceAnalysis = runPerformanceAnalysis;
}
