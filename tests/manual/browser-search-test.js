/**
 * Browser-based Frontend Integration Test
 * Run this in the browser console on the unified search page
 * to test the complete search workflow with authentication
 */

// Test configuration
const TEST_CONFIG = {
  testQueries: [
    "99 Speed Mart", // Should find receipts
    "GE SHENG HENG", // Should find receipts  
    "office supplies", // Should find custom categories
    "restaurant", // Should find business directory
    "travel expense" // Should find claims
  ],
  sources: ['receipt', 'custom_category', 'business_directory', 'claim'],
  timeout: 30000
};

// Test results storage
const testResults = {
  authentication: [],
  search: [],
  performance: [],
  ui: []
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

/**
 * Test 1: Authentication Status
 */
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication Status...');

  try {
    // Check if Supabase client is available
    if (typeof window.supabase === 'undefined') {
      // Try to access through common global patterns
      const supabaseClient = window._supabase || window.supabaseClient;
      if (!supabaseClient) {
        logTest('authentication', 'Supabase Client Available', 'FAIL', {
          error: 'Supabase client not found in global scope'
        });
        return false;
      }
      window.supabase = supabaseClient;
    }

    // Check authentication status
    const { data: { session }, error } = await window.supabase.auth.getSession();
    
    if (error) {
      logTest('authentication', 'Get Session', 'FAIL', {
        error: error.message
      });
      return false;
    }

    if (session && session.user) {
      logTest('authentication', 'User Authenticated', 'PASS', {
        note: `User: ${session.user.email}`
      });
      return true;
    } else {
      logTest('authentication', 'User Authenticated', 'FAIL', {
        error: 'No active session found'
      });
      return false;
    }
  } catch (error) {
    logTest('authentication', 'Authentication Check', 'FAIL', {
      error: error.message
    });
    return false;
  }
}

/**
 * Test 2: Search API Integration
 */
async function testSearchAPI() {
  console.log('\n🔍 Testing Search API Integration...');

  for (const query of TEST_CONFIG.testQueries) {
    try {
      const startTime = Date.now();
      
      // Make direct API call to unified search
      const { data: { session } } = await window.supabase.auth.getSession();
      
      const response = await fetch('/functions/v1/unified-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          query: query,
          sources: TEST_CONFIG.sources,
          limit: 10,
          similarityThreshold: 0.2,
          includeMetadata: true
        })
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.success) {
        logTest('search', `API Query: "${query}"`, 'PASS', {
          note: `Found ${data.totalResults} results`,
          duration
        });
      } else {
        logTest('search', `API Query: "${query}"`, 'FAIL', {
          error: data.error || `HTTP ${response.status}`,
          duration
        });
      }
    } catch (error) {
      logTest('search', `API Query: "${query}"`, 'FAIL', {
        error: error.message
      });
    }
  }
}

/**
 * Test 3: Frontend Search Function
 */
async function testFrontendSearch() {
  console.log('\n🎯 Testing Frontend Search Function...');

  // Check if unifiedSearch function is available
  try {
    // Try to access the search function from the module
    const searchModule = await import('/src/lib/ai-search.js').catch(() => null);
    
    if (!searchModule || !searchModule.unifiedSearch) {
      logTest('search', 'Frontend Search Function Available', 'FAIL', {
        error: 'unifiedSearch function not accessible'
      });
      return;
    }

    logTest('search', 'Frontend Search Function Available', 'PASS');

    // Test the function with a sample query
    for (const query of TEST_CONFIG.testQueries.slice(0, 2)) { // Test first 2 queries
      try {
        const startTime = Date.now();
        
        const result = await searchModule.unifiedSearch({
          query: query,
          sources: TEST_CONFIG.sources,
          limit: 10,
          offset: 0,
          similarityThreshold: 0.2,
          includeMetadata: true,
          aggregationMode: 'relevance'
        });

        const duration = Date.now() - startTime;

        if (result.success) {
          logTest('search', `Frontend Query: "${query}"`, 'PASS', {
            note: `Found ${result.totalResults} results`,
            duration
          });
        } else {
          logTest('search', `Frontend Query: "${query}"`, 'FAIL', {
            error: result.error || 'Unknown error',
            duration
          });
        }
      } catch (error) {
        logTest('search', `Frontend Query: "${query}"`, 'FAIL', {
          error: error.message
        });
      }
    }
  } catch (error) {
    logTest('search', 'Frontend Search Function', 'FAIL', {
      error: error.message
    });
  }
}

/**
 * Test 4: UI Component Integration
 */
async function testUIComponents() {
  console.log('\n🎨 Testing UI Component Integration...');

  // Check if search input exists
  const searchInput = document.querySelector('input[placeholder*="Search"]');
  if (searchInput) {
    logTest('ui', 'Search Input Present', 'PASS');
    
    // Test input interaction
    try {
      searchInput.focus();
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      logTest('ui', 'Search Input Interaction', 'PASS');
    } catch (error) {
      logTest('ui', 'Search Input Interaction', 'FAIL', {
        error: error.message
      });
    }
  } else {
    logTest('ui', 'Search Input Present', 'FAIL', {
      error: 'Search input not found'
    });
  }

  // Check if search button exists
  const searchButton = document.querySelector('button[type="submit"]') || 
                      document.querySelector('button:has(svg)');
  if (searchButton) {
    logTest('ui', 'Search Button Present', 'PASS');
  } else {
    logTest('ui', 'Search Button Present', 'FAIL', {
      error: 'Search button not found'
    });
  }

  // Check if results container exists
  const resultsContainer = document.querySelector('[data-testid="search-results"]') ||
                          document.querySelector('.search-results') ||
                          document.querySelector('[class*="result"]');
  if (resultsContainer) {
    logTest('ui', 'Results Container Present', 'PASS');
  } else {
    logTest('ui', 'Results Container Present', 'WARN', {
      note: 'Results container not found (may appear after search)'
    });
  }
}

/**
 * Test 5: Performance Monitoring
 */
async function testPerformance() {
  console.log('\n⚡ Testing Performance...');

  // Check if performance monitoring is available
  if (typeof performance !== 'undefined') {
    logTest('performance', 'Performance API Available', 'PASS');
    
    // Measure page load performance
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      
      if (loadTime < 3000) { // Less than 3 seconds
        logTest('performance', 'Page Load Time', 'PASS', {
          note: `${loadTime.toFixed(0)}ms`,
          duration: loadTime
        });
      } else {
        logTest('performance', 'Page Load Time', 'WARN', {
          note: `${loadTime.toFixed(0)}ms (slow)`,
          duration: loadTime
        });
      }
    }
  } else {
    logTest('performance', 'Performance API Available', 'FAIL');
  }
}

/**
 * Main test runner
 */
async function runBrowserIntegrationTests() {
  console.log('🚀 Starting Browser Integration Tests for Phase 5');
  console.log('='.repeat(60));
  console.log('📍 Current URL:', window.location.href);
  console.log('📍 User Agent:', navigator.userAgent.split(' ').slice(-2).join(' '));

  // Run all tests
  const isAuthenticated = await testAuthentication();
  
  if (isAuthenticated) {
    await testSearchAPI();
    await testFrontendSearch();
  } else {
    console.log('⚠️ Skipping search tests due to authentication failure');
  }
  
  await testUIComponents();
  await testPerformance();

  // Print summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;
  
  Object.entries(testResults).forEach(([category, results]) => {
    if (results.length > 0) {
      const passed = results.filter(r => r.status === 'PASS').length;
      const failed = results.filter(r => r.status === 'FAIL').length;
      const warnings = results.filter(r => r.status === 'WARN').length;
      
      totalPassed += passed;
      totalFailed += failed;
      totalWarnings += warnings;
      
      console.log(`${category.toUpperCase()}: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    }
  });

  console.log(`\nOVERALL: ${totalPassed} passed, ${totalFailed} failed, ${totalWarnings} warnings`);
  
  return testResults;
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('🔧 Browser Integration Test Script Loaded');
  console.log('📝 Run: runBrowserIntegrationTests()');
  
  // Make function globally available
  window.runBrowserIntegrationTests = runBrowserIntegrationTests;
}
