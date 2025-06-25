/**
 * Multi-Source Search Quality Validation for Phase 5
 * Verifies that unified embeddings improve search relevance and accuracy
 * across all data sources
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NzI3ODksImV4cCI6MjAyNzA0ODc4OX0.Vh4XAp5vMuFCRoegO9RnIsIwaN6_wjV8rZB_QMwlL3g";

// Quality validation configuration
const QUALITY_CONFIG = {
  unifiedSearchUrl: `${SUPABASE_URL}/functions/v1/unified-search`,
  
  // Test scenarios for each data source
  testScenarios: {
    custom_categories: [
      {
        name: 'Exact Category Match',
        query: 'utilities',
        expectedResults: ['utilities'],
        minSimilarity: 0.8,
        expectedCount: 1
      },
      {
        name: 'Semantic Category Match',
        query: 'office supplies',
        expectedResults: ['office', 'supplies', 'stationery'],
        minSimilarity: 0.5,
        expectedCount: 1
      }
    ],
    
    malaysian_business_directory: [
      {
        name: 'Exact Business Name Match',
        query: '99 speedmart',
        expectedResults: ['99', 'speedmart'],
        minSimilarity: 0.7,
        expectedCount: 1
      },
      {
        name: 'Business Type Match',
        query: 'supermarket',
        expectedResults: ['tesco', 'speedmart', 'mart'],
        minSimilarity: 0.5,
        expectedCount: 2
      },
      {
        name: 'Malay Business Name',
        query: 'kedai',
        expectedResults: ['kedai', 'shop'],
        minSimilarity: 0.4,
        expectedCount: 1
      }
    ],
    
    claims: [
      {
        name: 'Travel Expense Claim',
        query: 'travel expense',
        expectedResults: ['travel', 'expense'],
        minSimilarity: 0.6,
        expectedCount: 1
      },
      {
        name: 'Office Equipment Claim',
        query: 'office equipment',
        expectedResults: ['office', 'equipment'],
        minSimilarity: 0.5,
        expectedCount: 1
      }
    ],
    
    team_members: [
      {
        name: 'Team Member Profile',
        query: 'team member',
        expectedResults: ['team', 'member', 'profile'],
        minSimilarity: 0.5,
        expectedCount: 1
      }
    ],
    
    receipts: [
      {
        name: 'Receipt Search (Limited)',
        query: 'receipt',
        expectedResults: ['receipt'],
        minSimilarity: 0.3,
        expectedCount: 1,
        note: 'Limited due to content storage issue'
      }
    ]
  },
  
  // Multi-source test scenarios
  multiSourceScenarios: [
    {
      name: 'Cross-Source Business Search',
      query: 'restaurant food',
      sources: ['receipt', 'business_directory', 'custom_category'],
      expectedSources: ['business_directory'],
      minResults: 1
    },
    {
      name: 'Office Supplies Cross-Search',
      query: 'office supplies stationery',
      sources: ['receipt', 'custom_category', 'business_directory'],
      expectedSources: ['custom_category'],
      minResults: 1
    },
    {
      name: 'Comprehensive Search',
      query: 'business expense',
      sources: ['receipt', 'claim', 'custom_category'],
      expectedSources: ['claim'],
      minResults: 1
    }
  ]
};

// Quality metrics storage
const qualityMetrics = {
  sourceQuality: {},
  multiSourceQuality: {},
  overallMetrics: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    averageRelevance: 0,
    searchAccuracy: 0
  }
};

function logQualityTest(category, testName, status, details = {}) {
  const result = {
    testName,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (!qualityMetrics[category] || !Array.isArray(qualityMetrics[category])) {
    qualityMetrics[category] = [];
  }
  qualityMetrics[category].push(result);
  
  // Update overall metrics
  qualityMetrics.overallMetrics.totalTests++;
  if (status === 'PASS') {
    qualityMetrics.overallMetrics.passedTests++;
  } else {
    qualityMetrics.overallMetrics.failedTests++;
  }
  
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${statusIcon} [${category.toUpperCase()}] ${testName}: ${status}`);
  
  if (details.relevanceScore) {
    console.log(`   Relevance Score: ${details.relevanceScore.toFixed(3)}`);
  }
  if (details.resultCount !== undefined) {
    console.log(`   Results Found: ${details.resultCount}`);
  }
  if (details.note) {
    console.log(`   Note: ${details.note}`);
  }
  if (details.error) {
    console.log(`   Error: ${details.error}`);
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
 * Calculate relevance score based on search results
 */
function calculateRelevanceScore(query, results, expectedResults) {
  if (!results || results.length === 0) {
    return 0;
  }

  let totalRelevance = 0;
  let matchCount = 0;

  results.forEach(result => {
    let resultRelevance = 0;
    
    // Check similarity score if available
    if (result.similarity) {
      resultRelevance += result.similarity * 0.6;
    }
    
    // Check content relevance
    const content = (result.content_text || result.title || '').toLowerCase();
    const queryTerms = query.toLowerCase().split(' ');
    
    queryTerms.forEach(term => {
      if (content.includes(term)) {
        resultRelevance += 0.2;
      }
    });
    
    // Check expected results match
    expectedResults.forEach(expected => {
      if (content.includes(expected.toLowerCase())) {
        resultRelevance += 0.2;
        matchCount++;
      }
    });
    
    totalRelevance += Math.min(resultRelevance, 1.0);
  });

  return totalRelevance / results.length;
}

/**
 * Test 1: Single Source Quality Validation
 */
async function validateSingleSourceQuality() {
  console.log('\n🎯 Validating Single Source Search Quality...');

  for (const [sourceType, scenarios] of Object.entries(QUALITY_CONFIG.testScenarios)) {
    console.log(`\n📋 Testing ${sourceType.replace('_', ' ').toUpperCase()}:`);
    
    for (const scenario of scenarios) {
      try {
        const result = await makeAuthenticatedRequest(QUALITY_CONFIG.unifiedSearchUrl, {
          method: 'POST',
          body: JSON.stringify({
            query: scenario.query,
            sources: [sourceType],
            limit: 10,
            similarityThreshold: 0.1, // Low threshold to get more results
            includeMetadata: true
          })
        });

        if (result.status === 401) {
          // Expected for unauthenticated requests
          logQualityTest('sourceQuality', `${sourceType} - ${scenario.name}`, 'SKIP', {
            note: 'Authentication required for quality testing',
            duration: result.duration
          });
        } else if (result.success && result.data.success) {
          const resultCount = result.data.totalResults || 0;
          const results = result.data.results || [];
          
          // Calculate relevance score
          const relevanceScore = calculateRelevanceScore(
            scenario.query, 
            results, 
            scenario.expectedResults
          );
          
          // Determine if test passed
          const meetsCountExpectation = resultCount >= scenario.expectedCount;
          const meetsRelevanceExpectation = relevanceScore >= scenario.minSimilarity;
          const testPassed = meetsCountExpectation && meetsRelevanceExpectation;
          
          logQualityTest('sourceQuality', `${sourceType} - ${scenario.name}`, 
            testPassed ? 'PASS' : 'FAIL', {
            resultCount,
            relevanceScore,
            expectedCount: scenario.expectedCount,
            minSimilarity: scenario.minSimilarity,
            duration: result.duration,
            note: scenario.note
          });
        } else {
          logQualityTest('sourceQuality', `${sourceType} - ${scenario.name}`, 'FAIL', {
            error: result.data?.error || 'Unknown error',
            duration: result.duration
          });
        }
      } catch (error) {
        logQualityTest('sourceQuality', `${sourceType} - ${scenario.name}`, 'FAIL', {
          error: error.message
        });
      }
    }
  }
}

/**
 * Test 2: Multi-Source Quality Validation
 */
async function validateMultiSourceQuality() {
  console.log('\n🔗 Validating Multi-Source Search Quality...');

  for (const scenario of QUALITY_CONFIG.multiSourceScenarios) {
    try {
      const result = await makeAuthenticatedRequest(QUALITY_CONFIG.unifiedSearchUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: scenario.query,
          sources: scenario.sources,
          limit: 20,
          similarityThreshold: 0.1,
          includeMetadata: true,
          aggregationMode: 'relevance'
        })
      });

      if (result.status === 401) {
        logQualityTest('multiSourceQuality', scenario.name, 'SKIP', {
          note: 'Authentication required for quality testing',
          duration: result.duration
        });
      } else if (result.success && result.data.success) {
        const resultCount = result.data.totalResults || 0;
        const results = result.data.results || [];
        const sourcesFound = [...new Set(results.map(r => r.sourceType))];
        
        // Check if expected sources are represented
        const hasExpectedSources = scenario.expectedSources.some(source => 
          sourcesFound.includes(source)
        );
        
        const meetsMinResults = resultCount >= scenario.minResults;
        const testPassed = hasExpectedSources && meetsMinResults;
        
        logQualityTest('multiSourceQuality', scenario.name, 
          testPassed ? 'PASS' : 'FAIL', {
          resultCount,
          sourcesFound,
          expectedSources: scenario.expectedSources,
          minResults: scenario.minResults,
          duration: result.duration
        });
      } else {
        logQualityTest('multiSourceQuality', scenario.name, 'FAIL', {
          error: result.data?.error || 'Unknown error',
          duration: result.duration
        });
      }
    } catch (error) {
      logQualityTest('multiSourceQuality', scenario.name, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Test 3: Search Accuracy Validation
 */
async function validateSearchAccuracy() {
  console.log('\n📊 Validating Search Accuracy...');

  const accuracyTests = [
    {
      name: 'Exact Match Accuracy',
      query: 'utilities',
      sources: ['custom_category'],
      expectedExactMatch: true
    },
    {
      name: 'Semantic Match Accuracy',
      query: 'grocery store',
      sources: ['business_directory'],
      expectedSemanticMatch: true
    },
    {
      name: 'Cross-Language Match',
      query: 'kedai',
      sources: ['business_directory'],
      expectedCrossLanguage: true
    }
  ];

  for (const test of accuracyTests) {
    try {
      const result = await makeAuthenticatedRequest(QUALITY_CONFIG.unifiedSearchUrl, {
        method: 'POST',
        body: JSON.stringify({
          query: test.query,
          sources: test.sources,
          limit: 5,
          similarityThreshold: 0.3,
          includeMetadata: true
        })
      });

      if (result.status === 401) {
        logQualityTest('searchAccuracy', test.name, 'SKIP', {
          note: 'Authentication required',
          duration: result.duration
        });
      } else if (result.success && result.data.success) {
        const results = result.data.results || [];
        const hasResults = results.length > 0;
        
        // For now, just check if we get results
        // In authenticated environment, we could check actual content relevance
        logQualityTest('searchAccuracy', test.name, 
          hasResults ? 'PASS' : 'FAIL', {
          resultCount: results.length,
          duration: result.duration,
          note: 'Basic accuracy test - authentication required for detailed validation'
        });
      } else {
        logQualityTest('searchAccuracy', test.name, 'FAIL', {
          error: result.data?.error || 'Unknown error'
        });
      }
    } catch (error) {
      logQualityTest('searchAccuracy', test.name, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Generate Quality Report
 */
function generateQualityReport() {
  console.log('\n📊 Search Quality Validation Report');
  console.log('='.repeat(60));

  // Calculate overall metrics
  const { totalTests, passedTests, failedTests } = qualityMetrics.overallMetrics;
  const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
  
  console.log(`\n📈 OVERALL METRICS:`);
  console.log(`  • Total Tests: ${totalTests}`);
  console.log(`  • Passed: ${passedTests}`);
  console.log(`  • Failed: ${failedTests}`);
  console.log(`  • Success Rate: ${successRate}%`);

  // Report by category
  Object.entries(qualityMetrics).forEach(([category, metrics]) => {
    if (Array.isArray(metrics) && metrics.length > 0) {
      console.log(`\n${category.toUpperCase()}:`);
      metrics.forEach(metric => {
        const statusIcon = metric.status === 'PASS' ? '✅' : 
                          metric.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`  ${statusIcon} ${metric.testName}`);
        if (metric.relevanceScore) {
          console.log(`    Relevance: ${metric.relevanceScore.toFixed(3)}`);
        }
        if (metric.resultCount !== undefined) {
          console.log(`    Results: ${metric.resultCount}`);
        }
      });
    }
  });

  console.log(`\n🎯 QUALITY ASSESSMENT:`);
  if (successRate >= 80) {
    console.log(`  • Quality Grade: Excellent (${successRate}%)`);
  } else if (successRate >= 60) {
    console.log(`  • Quality Grade: Good (${successRate}%)`);
  } else if (successRate >= 40) {
    console.log(`  • Quality Grade: Fair (${successRate}%)`);
  } else {
    console.log(`  • Quality Grade: Needs Improvement (${successRate}%)`);
  }

  return qualityMetrics;
}

/**
 * Main quality validation runner
 */
async function runSearchQualityValidation() {
  console.log('🚀 Starting Multi-Source Search Quality Validation for Phase 5');
  console.log('='.repeat(60));

  await validateSingleSourceQuality();
  await validateMultiSourceQuality();
  await validateSearchAccuracy();

  return generateQualityReport();
}

// Run validation if this script is executed directly
if (typeof window === 'undefined') {
  runSearchQualityValidation().catch(console.error);
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.runSearchQualityValidation = runSearchQualityValidation;
}
