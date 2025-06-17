/**
 * Comprehensive Test Suite for Malaysian Multi-Language Support
 * Tests all Malaysian business features, cultural adaptations, and performance optimizations
 */

import { supabase } from '../config/test-supabase-client.ts';
import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  PERFORMANCE_TARGETS: {
    SEARCH_RESPONSE_TIME: 100, // ms
    CACHE_HIT_RATIO: 85, // %
    BUSINESS_RECOGNITION_ACCURACY: 95, // %
    DATABASE_QUERY_TIME: 50 // ms
  },
  MALAYSIAN_TEST_DATA: {
    BUSINESSES: [
      '99 Speedmart', 'KK Super Mart', 'Tesco Malaysia', 'AEON',
      'Mamak Restaurant', 'McDonald\'s Malaysia', 'KFC Malaysia'
    ],
    PAYMENT_METHODS: [
      'GrabPay', 'Touch \'n Go eWallet', 'Boost', 'ShopeePay',
      'BigPay', 'MAE', 'FPX', 'Cash'
    ],
    TAX_TYPES: ['GST', 'SST_SALES', 'SST_SERVICE', 'EXEMPT'],
    CURRENCIES: ['MYR', 'RM']
  }
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

/**
 * Test utility functions
 */
function logTest(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: ${details}`);
  }
  testResults.details.push({ testName, passed, details });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * 1. Malaysian Business Recognition Tests
 */
async function testMalaysianBusinessRecognition() {
  console.log('\n🏢 Testing Malaysian Business Recognition...');
  
  try {
    // Test business directory search
    const { data: businesses, error } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: '99 speedmart',
      limit_results: 5,
      use_cache: true
    });

    assert(!error, `Business search error: ${error?.message}`);
    assert(businesses && businesses.length > 0, 'No businesses found');
    assert(businesses[0].business_name.toLowerCase().includes('99 speedmart'), 'Business not recognized correctly');
    
    logTest('Malaysian Business Directory Search', true);
  } catch (err) {
    logTest('Malaysian Business Directory Search', false, err.message);
  }

  // Test payment method detection
  try {
    const { data: paymentResult, error } = await supabase.rpc('detect_malaysian_payment_method', {
      receipt_text: 'Payment via GrabPay - RM 25.50'
    });

    assert(!error, `Payment detection error: ${error?.message}`);
    assert(paymentResult && paymentResult.method_name, 'Payment method not detected');
    assert(paymentResult.method_name.toLowerCase().includes('grabpay'), 'GrabPay not detected correctly');
    
    logTest('Malaysian Payment Method Detection', true);
  } catch (err) {
    logTest('Malaysian Payment Method Detection', false, err.message);
  }

  // Test tax category detection
  try {
    const { data: taxData, error } = await supabase
      .from('malaysian_tax_categories')
      .select('*')
      .eq('tax_type', 'SST_SALES')
      .eq('is_active', true)
      .limit(1);

    assert(!error, `Tax category query error: ${error?.message}`);
    assert(taxData && taxData.length > 0, 'No active SST categories found');
    
    logTest('Malaysian Tax Category System', true);
  } catch (err) {
    logTest('Malaysian Tax Category System', false, err.message);
  }
}

/**
 * 2. Cultural Adaptation Tests
 */
async function testCulturalAdaptations() {
  console.log('\n🌏 Testing Cultural Adaptations...');

  // Test Malaysian date formatting
  try {
    const { data: formatResult, error } = await supabase.rpc('format_malaysian_date', {
      input_date: '2025-06-17',
      format_preference: 'DD/MM/YYYY'
    });

    assert(!error, `Date formatting error: ${error?.message}`);
    assert(formatResult === '17/06/2025', `Expected 17/06/2025, got ${formatResult}`);
    
    logTest('Malaysian Date Formatting', true);
  } catch (err) {
    logTest('Malaysian Date Formatting', false, err.message);
  }

  // Test Malaysian currency formatting
  try {
    const { data: currencyResult, error } = await supabase.rpc('format_malaysian_currency', {
      amount: 123.45,
      currency_code: 'MYR',
      include_symbol: true
    });

    assert(!error, `Currency formatting error: ${error?.message}`);
    assert(currencyResult.includes('RM'), 'RM symbol not included');
    assert(currencyResult.includes('123.45'), 'Amount not formatted correctly');
    
    logTest('Malaysian Currency Formatting', true);
  } catch (err) {
    logTest('Malaysian Currency Formatting', false, err.message);
  }

  // Test Malaysian public holidays
  try {
    const { data: holidays, error } = await supabase
      .from('malaysian_public_holidays')
      .select('*')
      .eq('is_active', true)
      .gte('holiday_date', '2025-01-01')
      .lte('holiday_date', '2025-12-31')
      .limit(10);

    assert(!error, `Holiday query error: ${error?.message}`);
    assert(holidays && holidays.length > 0, 'No Malaysian holidays found');
    
    logTest('Malaysian Public Holidays System', true);
  } catch (err) {
    logTest('Malaysian Public Holidays System', false, err.message);
  }
}

/**
 * 3. Performance Optimization Tests
 */
async function testPerformanceOptimizations() {
  console.log('\n⚡ Testing Performance Optimizations...');

  // Test search performance
  try {
    const startTime = performance.now();
    
    const { data: searchResults, error } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: 'grocery',
      limit_results: 10,
      use_cache: true
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    assert(!error, `Search performance error: ${error?.message}`);
    assert(responseTime < TEST_CONFIG.PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME, 
           `Search too slow: ${responseTime}ms > ${TEST_CONFIG.PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME}ms`);
    
    logTest(`Search Performance (${responseTime.toFixed(2)}ms)`, true);
  } catch (err) {
    logTest('Search Performance', false, err.message);
  }

  // Test materialized view performance
  try {
    const startTime = performance.now();
    
    const { data: analyticsData, error } = await supabase
      .from('mv_malaysian_business_analytics')
      .select('*')
      .limit(100);
    
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    assert(!error, `Analytics query error: ${error?.message}`);
    assert(queryTime < TEST_CONFIG.PERFORMANCE_TARGETS.DATABASE_QUERY_TIME,
           `Query too slow: ${queryTime}ms > ${TEST_CONFIG.PERFORMANCE_TARGETS.DATABASE_QUERY_TIME}ms`);
    
    logTest(`Materialized View Performance (${queryTime.toFixed(2)}ms)`, true);
  } catch (err) {
    logTest('Materialized View Performance', false, err.message);
  }

  // Test caching system
  try {
    const { data: cacheTest, error } = await supabase.functions.invoke('performance-cache', {
      body: { 
        action: 'set',
        key: 'test_cache_key',
        value: { test: 'data' },
        ttl: 300
      }
    });

    assert(!error, `Cache set error: ${error?.message}`);

    const { data: cacheRetrieve, error: retrieveError } = await supabase.functions.invoke('performance-cache', {
      body: { 
        action: 'get',
        key: 'test_cache_key'
      }
    });

    assert(!retrieveError, `Cache get error: ${retrieveError?.message}`);
    assert(cacheRetrieve?.data?.test === 'data', 'Cache data not retrieved correctly');
    
    logTest('Caching System Functionality', true);
  } catch (err) {
    logTest('Caching System Functionality', false, err.message);
  }
}

/**
 * 4. Edge Function Integration Tests
 */
async function testEdgeFunctionIntegration() {
  console.log('\n🔧 Testing Edge Function Integration...');

  // Test enhance-receipt-data with Malaysian content
  try {
    const testReceiptData = {
      merchant: '99 Speedmart',
      total: 25.50,
      currency: 'MYR',
      payment_method: 'GrabPay',
      raw_text: 'Receipt from 99 Speedmart\nTotal: RM 25.50\nPayment: GrabPay'
    };

    const { data: enhancedData, error } = await supabase.functions.invoke('enhance-receipt-data', {
      body: { receipt_data: testReceiptData }
    });

    assert(!error, `Enhancement error: ${error?.message}`);
    assert(enhancedData?.enhanced_data, 'No enhanced data returned');
    
    logTest('Receipt Enhancement with Malaysian Data', true);
  } catch (err) {
    logTest('Receipt Enhancement with Malaysian Data', false, err.message);
  }

  // Test semantic search with Malay terms
  try {
    const { data: searchData, error } = await supabase.functions.invoke('semantic-search', {
      body: { 
        query: 'resit kedai runcit',
        limit: 5
      }
    });

    assert(!error, `Semantic search error: ${error?.message}`);
    
    logTest('Semantic Search with Malay Terms', true);
  } catch (err) {
    logTest('Semantic Search with Malay Terms', false, err.message);
  }
}

/**
 * 5. Load Testing
 */
async function testLoadPerformance() {
  console.log('\n📊 Testing Load Performance...');

  const concurrentRequests = 10;
  const promises = [];

  try {
    // Create multiple concurrent search requests
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = supabase.rpc('search_malaysian_business_optimized', {
        search_term: `test_${i}`,
        limit_results: 5,
        use_cache: true
      });
      promises.push(promise);
    }

    const startTime = performance.now();
    const results = await Promise.all(promises);
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    const avgTime = totalTime / concurrentRequests;

    assert(results.every(r => !r.error), 'Some concurrent requests failed');
    assert(avgTime < TEST_CONFIG.PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME * 2, 
           `Concurrent requests too slow: ${avgTime}ms average`);
    
    logTest(`Load Performance (${concurrentRequests} concurrent, ${avgTime.toFixed(2)}ms avg)`, true);
  } catch (err) {
    logTest('Load Performance', false, err.message);
  }
}

/**
 * Main test runner
 */
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Malaysian Multi-Language Support Tests\n');
  console.log('=' * 80);

  try {
    await testMalaysianBusinessRecognition();
    await testCulturalAdaptations();
    await testPerformanceOptimizations();
    await testEdgeFunctionIntegration();
    await testLoadPerformance();

    // Generate test report
    console.log('\n' + '=' * 80);
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('=' * 80);
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.details
        .filter(t => !t.passed)
        .forEach(t => console.log(`  - ${t.testName}: ${t.details}`));
    }

    // Performance summary
    console.log('\n⚡ PERFORMANCE TARGETS:');
    console.log(`  Search Response Time: < ${TEST_CONFIG.PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME}ms`);
    console.log(`  Database Query Time: < ${TEST_CONFIG.PERFORMANCE_TARGETS.DATABASE_QUERY_TIME}ms`);
    console.log(`  Business Recognition: > ${TEST_CONFIG.PERFORMANCE_TARGETS.BUSINESS_RECOGNITION_ACCURACY}%`);

    const overallSuccess = testResults.failed === 0;
    console.log(`\n🎯 OVERALL STATUS: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return overallSuccess;

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return false;
  }
}

// Export for use in other test files
export { runComprehensiveTests, TEST_CONFIG, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Test runner error:', err);
      process.exit(1);
    });
}
