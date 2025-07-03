/**
 * Performance Test Script
 * Run performance tests programmatically for CI/CD or manual testing
 */

import { PerformanceTestSuite } from '../utils/performanceTestSuite';

/**
 * Run performance tests and output results
 */
async function runPerformanceTests() {
  console.log('🚀 Starting Performance Test Suite...\n');
  
  const testSuite = new PerformanceTestSuite();
  
  try {
    // Run complete test suite
    const results = await testSuite.runCompleteTestSuite();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(60));
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   Total Tests: ${results.summary.totalTests}`);
    console.log(`   Passed: ${results.summary.passedTests} ✅`);
    console.log(`   Failed: ${results.summary.failedTests} ${results.summary.failedTests > 0 ? '❌' : '✅'}`);
    console.log(`   Average Duration: ${results.summary.averageDuration.toFixed(2)}ms`);
    console.log(`   Under 3 seconds: ${results.summary.under3Seconds ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Data Validation: ${results.validation.isValid ? 'VALID ✅' : 'INVALID ❌'}`);
    console.log(`   Total Test Time: ${results.totalTestTime}ms`);
    
    // Individual test results
    console.log('\n🔍 INDIVIDUAL TEST RESULTS:');
    results.metrics.forEach((metric, index) => {
      const status = metric.success ? '✅' : '❌';
      const performance = metric.duration < 1000 ? '🚀' : metric.duration < 3000 ? '⚡' : '🐌';
      
      console.log(`   ${index + 1}. ${metric.testName} ${status} ${performance}`);
      console.log(`      Duration: ${metric.duration}ms`);
      
      if (metric.error) {
        console.log(`      Error: ${metric.error}`);
      }
      
      if (metric.metadata) {
        console.log(`      Metadata: ${JSON.stringify(metric.metadata, null, 8)}`);
      }
      
      if (metric.cacheHit !== undefined) {
        console.log(`      Cache: ${metric.cacheHit ? 'HIT 🎯' : 'MISS 📡'}`);
      }
      
      console.log('');
    });
    
    // Validation details
    if (!results.validation.isValid) {
      console.log('\n❌ VALIDATION ERRORS:');
      results.validation.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (results.validation.warnings.length > 0) {
      console.log('\n⚠️  VALIDATION WARNINGS:');
      results.validation.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    // Recommendations
    if (results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      results.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    const allPassed = results.summary.failedTests === 0 && results.validation.isValid;
    const performanceTarget = results.summary.under3Seconds;
    
    if (allPassed && performanceTarget) {
      console.log('🎉 ALL TESTS PASSED - PERFORMANCE TARGETS MET!');
      console.log('✅ Ready for production deployment');
    } else if (allPassed) {
      console.log('⚠️  TESTS PASSED BUT PERFORMANCE NEEDS IMPROVEMENT');
      console.log('🔧 Consider additional optimizations');
    } else {
      console.log('❌ TESTS FAILED - ISSUES NEED TO BE ADDRESSED');
      console.log('🚫 Not ready for production');
    }
    
    console.log('='.repeat(60));
    
    // Return results for programmatic use
    return {
      success: allPassed && performanceTarget,
      results
    };
    
  } catch (error) {
    console.error('\n❌ Performance test suite failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run tests with specific configuration
 */
async function runTestsWithConfig(config: {
  maxDuration?: number;
  requireCacheHit?: boolean;
  validateData?: boolean;
}) {
  console.log('🔧 Running tests with custom configuration:', config);
  
  const results = await runPerformanceTests();
  
  if (!results.success) {
    return results;
  }
  
  // Additional validation based on config
  const { maxDuration = 3000, requireCacheHit = false, validateData = true } = config;
  
  let configSuccess = true;
  const configErrors: string[] = [];
  
  // Check max duration
  if (results.results.summary.averageDuration > maxDuration) {
    configSuccess = false;
    configErrors.push(`Average duration ${results.results.summary.averageDuration}ms exceeds limit ${maxDuration}ms`);
  }
  
  // Check cache hit requirement
  if (requireCacheHit) {
    const cacheHitTests = results.results.metrics.filter(m => m.cacheHit === true);
    if (cacheHitTests.length === 0) {
      configSuccess = false;
      configErrors.push('No cache hits detected - caching may not be working');
    }
  }
  
  // Check data validation
  if (validateData && !results.results.validation.isValid) {
    configSuccess = false;
    configErrors.push('Data validation failed');
  }
  
  if (!configSuccess) {
    console.log('\n❌ CUSTOM CONFIGURATION REQUIREMENTS NOT MET:');
    configErrors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  } else {
    console.log('\n✅ CUSTOM CONFIGURATION REQUIREMENTS MET');
  }
  
  return {
    success: configSuccess,
    results: results.results,
    configErrors
  };
}

// Export functions for use in other modules
export {
  runPerformanceTests,
  runTestsWithConfig
};

// If running directly (not imported), execute tests
if (typeof window !== 'undefined' && (window as any).__RUN_PERFORMANCE_TESTS__) {
  runPerformanceTests().then(results => {
    (window as any).__PERFORMANCE_TEST_RESULTS__ = results;
  });
}
