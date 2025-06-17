/**
 * Performance Benchmarking Suite for Malaysian Multi-Language Support
 * Validates 70% performance improvements and system optimization targets
 */

import { supabase } from '../config/test-supabase-client.ts';
import { performance } from 'perf_hooks';

// Benchmark configuration
const BENCHMARK_CONFIG = {
  BASELINE_METRICS: {
    SEARCH_TIME_MS: 300,        // Original search time
    QUERY_TIME_MS: 200,         // Original database query time
    CACHE_MISS_RATIO: 50        // Original cache miss ratio %
  },
  TARGET_IMPROVEMENTS: {
    SEARCH_IMPROVEMENT: 70,     // 70% faster
    QUERY_IMPROVEMENT: 70,      // 70% faster  
    CACHE_IMPROVEMENT: 85       // 85% hit ratio
  },
  TEST_ITERATIONS: {
    WARMUP: 5,                  // Warmup iterations
    BENCHMARK: 20,              // Benchmark iterations
    LOAD_TEST: 50               // Load test iterations
  }
};

// Results tracking
let benchmarkResults = {
  searchPerformance: [],
  queryPerformance: [],
  cachePerformance: [],
  loadTestResults: [],
  summary: {}
};

/**
 * Utility functions
 */
function calculateStats(measurements) {
  const sorted = measurements.sort((a, b) => a - b);
  return {
    min: Math.min(...measurements),
    max: Math.max(...measurements),
    avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

function logBenchmark(testName, stats, target, improvement) {
  console.log(`\n📊 ${testName}`);
  console.log(`  Average: ${stats.avg.toFixed(2)}ms`);
  console.log(`  Median:  ${stats.median.toFixed(2)}ms`);
  console.log(`  P95:     ${stats.p95.toFixed(2)}ms`);
  console.log(`  P99:     ${stats.p99.toFixed(2)}ms`);
  console.log(`  Target:  < ${target}ms`);
  console.log(`  Status:  ${stats.avg < target ? '✅ PASS' : '❌ FAIL'}`);
  if (improvement) {
    console.log(`  Improvement: ${improvement.toFixed(1)}% (Target: ${BENCHMARK_CONFIG.TARGET_IMPROVEMENTS.SEARCH_IMPROVEMENT}%)`);
  }
}

/**
 * 1. Search Performance Benchmark
 */
async function benchmarkSearchPerformance() {
  console.log('\n🔍 Benchmarking Search Performance...');
  
  const searchTerms = [
    '99 speedmart',
    'mamak restaurant', 
    'grocery store',
    'kfc malaysia',
    'touch n go',
    'grabpay payment',
    'tesco hypermarket',
    'aeon shopping'
  ];

  // Warmup
  console.log('  Warming up...');
  for (let i = 0; i < BENCHMARK_CONFIG.TEST_ITERATIONS.WARMUP; i++) {
    await supabase.rpc('search_malaysian_business_optimized', {
      search_term: searchTerms[i % searchTerms.length],
      limit_results: 10,
      use_cache: true
    });
  }

  // Benchmark with cache
  console.log('  Running cached search benchmark...');
  const cachedTimes = [];
  for (let i = 0; i < BENCHMARK_CONFIG.TEST_ITERATIONS.BENCHMARK; i++) {
    const startTime = performance.now();
    
    const { data, error } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: searchTerms[i % searchTerms.length],
      limit_results: 10,
      use_cache: true
    });
    
    const endTime = performance.now();
    
    if (!error) {
      cachedTimes.push(endTime - startTime);
    }
  }

  // Benchmark without cache
  console.log('  Running non-cached search benchmark...');
  const nonCachedTimes = [];
  for (let i = 0; i < BENCHMARK_CONFIG.TEST_ITERATIONS.BENCHMARK; i++) {
    const startTime = performance.now();
    
    const { data, error } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: searchTerms[i % searchTerms.length],
      limit_results: 10,
      use_cache: false
    });
    
    const endTime = performance.now();
    
    if (!error) {
      nonCachedTimes.push(endTime - startTime);
    }
  }

  const cachedStats = calculateStats(cachedTimes);
  const nonCachedStats = calculateStats(nonCachedTimes);
  const improvement = ((BENCHMARK_CONFIG.BASELINE_METRICS.SEARCH_TIME_MS - cachedStats.avg) / BENCHMARK_CONFIG.BASELINE_METRICS.SEARCH_TIME_MS) * 100;

  benchmarkResults.searchPerformance = {
    cached: cachedStats,
    nonCached: nonCachedStats,
    improvement: improvement
  };

  logBenchmark('Search Performance (Cached)', cachedStats, 100, improvement);
  logBenchmark('Search Performance (Non-Cached)', nonCachedStats, 200);

  return cachedStats.avg < 100; // Target: < 100ms
}

/**
 * 2. Database Query Performance Benchmark
 */
async function benchmarkQueryPerformance() {
  console.log('\n💾 Benchmarking Database Query Performance...');

  const queries = [
    // Materialized view queries
    () => supabase.from('mv_malaysian_business_analytics').select('*').limit(100),
    () => supabase.from('mv_malaysian_reference_data').select('*').limit(100),
    
    // Regular table queries with indexes
    () => supabase.from('malaysian_business_directory').select('*').eq('is_active', true).limit(50),
    () => supabase.from('malaysian_tax_categories').select('*').eq('is_active', true),
    () => supabase.from('malaysian_payment_methods').select('*').eq('is_active', true),
    
    // Complex join queries
    () => supabase.from('receipts')
      .select('*, malaysian_business_directory(*)')
      .not('malaysian_business_category', 'is', null)
      .limit(20)
  ];

  const queryTimes = [];

  for (let i = 0; i < BENCHMARK_CONFIG.TEST_ITERATIONS.BENCHMARK; i++) {
    const query = queries[i % queries.length];
    
    const startTime = performance.now();
    const { data, error } = await query();
    const endTime = performance.now();
    
    if (!error) {
      queryTimes.push(endTime - startTime);
    }
  }

  const queryStats = calculateStats(queryTimes);
  const improvement = ((BENCHMARK_CONFIG.BASELINE_METRICS.QUERY_TIME_MS - queryStats.avg) / BENCHMARK_CONFIG.BASELINE_METRICS.QUERY_TIME_MS) * 100;

  benchmarkResults.queryPerformance = {
    stats: queryStats,
    improvement: improvement
  };

  logBenchmark('Database Query Performance', queryStats, 50, improvement);

  return queryStats.avg < 50; // Target: < 50ms
}

/**
 * 3. Cache Performance Benchmark
 */
async function benchmarkCachePerformance() {
  console.log('\n🎯 Benchmarking Cache Performance...');

  const cacheKeys = Array.from({ length: 20 }, (_, i) => `benchmark_key_${i}`);
  const testData = { test: 'benchmark_data', timestamp: Date.now() };

  // Set cache entries
  console.log('  Setting cache entries...');
  for (const key of cacheKeys) {
    await supabase.functions.invoke('performance-cache', {
      body: { 
        action: 'set',
        key: key,
        value: testData,
        ttl: 3600
      }
    });
  }

  // Test cache hits
  console.log('  Testing cache hits...');
  const cacheHitTimes = [];
  let cacheHits = 0;

  for (let i = 0; i < BENCHMARK_CONFIG.TEST_ITERATIONS.BENCHMARK; i++) {
    const key = cacheKeys[i % cacheKeys.length];
    
    const startTime = performance.now();
    const { data, error } = await supabase.functions.invoke('performance-cache', {
      body: { 
        action: 'get',
        key: key
      }
    });
    const endTime = performance.now();
    
    if (!error && data?.data) {
      cacheHits++;
      cacheHitTimes.push(endTime - startTime);
    }
  }

  const cacheHitRatio = (cacheHits / BENCHMARK_CONFIG.TEST_ITERATIONS.BENCHMARK) * 100;
  const cacheStats = calculateStats(cacheHitTimes);

  benchmarkResults.cachePerformance = {
    hitRatio: cacheHitRatio,
    responseTime: cacheStats
  };

  console.log(`\n📊 Cache Performance`);
  console.log(`  Hit Ratio: ${cacheHitRatio.toFixed(1)}% (Target: > ${BENCHMARK_CONFIG.TARGET_IMPROVEMENTS.CACHE_IMPROVEMENT}%)`);
  console.log(`  Avg Response: ${cacheStats.avg.toFixed(2)}ms`);
  console.log(`  Status: ${cacheHitRatio > BENCHMARK_CONFIG.TARGET_IMPROVEMENTS.CACHE_IMPROVEMENT ? '✅ PASS' : '❌ FAIL'}`);

  return cacheHitRatio > BENCHMARK_CONFIG.TARGET_IMPROVEMENTS.CACHE_IMPROVEMENT;
}

/**
 * 4. Load Testing
 */
async function benchmarkLoadPerformance() {
  console.log('\n🚀 Benchmarking Load Performance...');

  const concurrentLevels = [5, 10, 20, 50];
  const loadResults = [];

  for (const concurrency of concurrentLevels) {
    console.log(`  Testing ${concurrency} concurrent requests...`);
    
    const promises = [];
    const startTime = performance.now();

    for (let i = 0; i < concurrency; i++) {
      const promise = supabase.rpc('search_malaysian_business_optimized', {
        search_term: `load_test_${i}`,
        limit_results: 5,
        use_cache: true
      });
      promises.push(promise);
    }

    try {
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrency;
      const successCount = results.filter(r => !r.error).length;
      const successRate = (successCount / concurrency) * 100;

      loadResults.push({
        concurrency,
        totalTime,
        avgTime,
        successRate,
        throughput: concurrency / (totalTime / 1000) // requests per second
      });

      console.log(`    Total: ${totalTime.toFixed(2)}ms, Avg: ${avgTime.toFixed(2)}ms, Success: ${successRate.toFixed(1)}%`);
    } catch (error) {
      console.log(`    ❌ Failed at ${concurrency} concurrent requests: ${error.message}`);
    }
  }

  benchmarkResults.loadTestResults = loadResults;

  return loadResults.every(r => r.successRate > 95); // Target: > 95% success rate
}

/**
 * 5. Memory and Resource Usage
 */
async function benchmarkResourceUsage() {
  console.log('\n💾 Benchmarking Resource Usage...');

  const initialMemory = process.memoryUsage();
  
  // Perform intensive operations
  const operations = [];
  for (let i = 0; i < 100; i++) {
    operations.push(
      supabase.rpc('search_malaysian_business_optimized', {
        search_term: `resource_test_${i}`,
        limit_results: 10,
        use_cache: true
      })
    );
  }

  await Promise.all(operations);
  
  const finalMemory = process.memoryUsage();
  const memoryIncrease = {
    heapUsed: (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024, // MB
    heapTotal: (finalMemory.heapTotal - initialMemory.heapTotal) / 1024 / 1024, // MB
    external: (finalMemory.external - initialMemory.external) / 1024 / 1024 // MB
  };

  console.log(`\n📊 Resource Usage`);
  console.log(`  Heap Used Increase: ${memoryIncrease.heapUsed.toFixed(2)} MB`);
  console.log(`  Heap Total Increase: ${memoryIncrease.heapTotal.toFixed(2)} MB`);
  console.log(`  External Increase: ${memoryIncrease.external.toFixed(2)} MB`);

  return memoryIncrease.heapUsed < 50; // Target: < 50MB increase
}

/**
 * Main benchmark runner
 */
async function runPerformanceBenchmarks() {
  console.log('🚀 Starting Malaysian Multi-Language Performance Benchmarks\n');
  console.log('=' * 80);

  const results = {
    searchPerformance: false,
    queryPerformance: false,
    cachePerformance: false,
    loadPerformance: false,
    resourceUsage: false
  };

  try {
    results.searchPerformance = await benchmarkSearchPerformance();
    results.queryPerformance = await benchmarkQueryPerformance();
    results.cachePerformance = await benchmarkCachePerformance();
    results.loadPerformance = await benchmarkLoadPerformance();
    results.resourceUsage = await benchmarkResourceUsage();

    // Generate benchmark report
    console.log('\n' + '=' * 80);
    console.log('📋 PERFORMANCE BENCHMARK SUMMARY');
    console.log('=' * 80);

    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;

    console.log(`\n🎯 BENCHMARK RESULTS:`);
    console.log(`  Search Performance: ${results.searchPerformance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Query Performance: ${results.queryPerformance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Cache Performance: ${results.cachePerformance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Load Performance: ${results.loadPerformance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Resource Usage: ${results.resourceUsage ? '✅ PASS' : '❌ FAIL'}`);

    console.log(`\n📊 OVERALL SCORE: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);

    // Performance improvements summary
    if (benchmarkResults.searchPerformance?.improvement) {
      console.log(`\n⚡ PERFORMANCE IMPROVEMENTS:`);
      console.log(`  Search Speed: ${benchmarkResults.searchPerformance.improvement.toFixed(1)}% faster`);
      console.log(`  Query Speed: ${benchmarkResults.queryPerformance?.improvement?.toFixed(1) || 'N/A'}% faster`);
      console.log(`  Cache Hit Ratio: ${benchmarkResults.cachePerformance?.hitRatio?.toFixed(1) || 'N/A'}%`);
    }

    const overallSuccess = passedTests === totalTests;
    console.log(`\n🎯 BENCHMARK STATUS: ${overallSuccess ? '✅ ALL BENCHMARKS PASSED' : '❌ SOME BENCHMARKS FAILED'}`);
    
    return overallSuccess;

  } catch (error) {
    console.error('❌ Benchmark suite failed:', error);
    return false;
  }
}

// Export for use in other test files
export { runPerformanceBenchmarks, BENCHMARK_CONFIG, benchmarkResults };

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmarks()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Benchmark runner error:', err);
      process.exit(1);
    });
}
