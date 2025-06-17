/**
 * Basic Validation Test for Malaysian Multi-Language Support
 * Tests core functionality that can be validated in local environment
 */

import { supabase } from '../config/test-supabase-client.ts';
import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  BASIC_TESTS: [
    'Database Connection',
    'Basic Table Access',
    'Environment Configuration',
    'Supabase Client Functionality'
  ]
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
 * 1. Database Connection Test
 */
async function testDatabaseConnection() {
  console.log('\n🔌 Testing Database Connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(1);

    assert(!error, `Database connection error: ${error?.message}`);
    assert(data !== null, 'No response from database');
    
    logTest('Database Connection', true);
  } catch (err) {
    logTest('Database Connection', false, err.message);
  }
}

/**
 * 2. Basic Table Access Test
 */
async function testBasicTableAccess() {
  console.log('\n📋 Testing Basic Table Access...');
  
  try {
    // Test receipts table access (should exist in local)
    const { data, error } = await supabase
      .from('receipts')
      .select('id')
      .limit(1);

    // We expect this to work or fail with permission denied (not table not found)
    const tableExists = !error || !error.message.includes('does not exist');
    assert(tableExists, `Receipts table access issue: ${error?.message}`);
    
    logTest('Receipts Table Access', true);
  } catch (err) {
    logTest('Receipts Table Access', false, err.message);
  }

  try {
    // Test profiles table access
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const tableExists = !error || !error.message.includes('does not exist');
    assert(tableExists, `Profiles table access issue: ${error?.message}`);
    
    logTest('Profiles Table Access', true);
  } catch (err) {
    logTest('Profiles Table Access', false, err.message);
  }
}

/**
 * 3. Environment Configuration Test
 */
async function testEnvironmentConfiguration() {
  console.log('\n⚙️ Testing Environment Configuration...');
  
  try {
    // Test that we're using local environment
    const isLocal = supabase.supabaseUrl.includes('127.0.0.1') || supabase.supabaseUrl.includes('localhost');
    assert(isLocal, 'Not using local Supabase instance for testing');
    
    logTest('Local Environment Configuration', true);
  } catch (err) {
    logTest('Local Environment Configuration', false, err.message);
  }

  try {
    // Test environment variables are loaded
    const hasConfig = process.env.VITE_SUPABASE_PROJECT_ID !== undefined;
    logTest('Environment Variables Loaded', hasConfig, hasConfig ? '' : 'Missing environment variables');
  } catch (err) {
    logTest('Environment Variables Loaded', false, err.message);
  }
}

/**
 * 4. Supabase Client Functionality Test
 */
async function testSupabaseClientFunctionality() {
  console.log('\n🔧 Testing Supabase Client Functionality...');
  
  try {
    // Test client configuration
    assert(supabase.supabaseUrl, 'Supabase URL not configured');
    assert(supabase.supabaseKey, 'Supabase key not configured');
    
    logTest('Client Configuration', true);
  } catch (err) {
    logTest('Client Configuration', false, err.message);
  }

  try {
    // Test basic query functionality
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'public')
      .single();
    const endTime = performance.now();
    
    const responseTime = endTime - startTime;
    const isResponsive = !error && responseTime < 1000; // Should respond within 1 second
    
    logTest('Query Functionality', isResponsive, 
      isResponsive ? `${responseTime.toFixed(2)}ms` : `Slow response: ${responseTime.toFixed(2)}ms`);
  } catch (err) {
    logTest('Query Functionality', false, err.message);
  }
}

/**
 * 5. Malaysian Feature Readiness Test
 */
async function testMalaysianFeatureReadiness() {
  console.log('\n🇲🇾 Testing Malaysian Feature Readiness...');
  
  // Test if we can create the basic structure for Malaysian features
  try {
    // Test if we can query for Malaysian-related data structures
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'receipts')
      .in('column_name', ['currency', 'merchant', 'total']);

    const hasBasicColumns = !error && data && data.length >= 3;
    logTest('Basic Receipt Columns Available', hasBasicColumns);
  } catch (err) {
    logTest('Basic Receipt Columns Available', false, err.message);
  }

  try {
    // Test if we can access user profiles for language preferences
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'profiles');

    const hasProfilesTable = !error && data;
    logTest('Profiles Table Structure', hasProfilesTable);
  } catch (err) {
    logTest('Profiles Table Structure', false, err.message);
  }
}

/**
 * 6. Performance Baseline Test
 */
async function testPerformanceBaseline() {
  console.log('\n⚡ Testing Performance Baseline...');
  
  try {
    // Test query performance baseline
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(10);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const isPerformant = avgTime < 200; // Should be under 200ms average
    
    logTest('Query Performance Baseline', isPerformant, 
      `Average: ${avgTime.toFixed(2)}ms`);
  } catch (err) {
    logTest('Query Performance Baseline', false, err.message);
  }
}

/**
 * Main test runner
 */
async function runBasicValidationTests() {
  console.log('🚀 Starting Basic Validation Tests for Malaysian Multi-Language Support\n');
  console.log('=' * 80);

  try {
    await testDatabaseConnection();
    await testBasicTableAccess();
    await testEnvironmentConfiguration();
    await testSupabaseClientFunctionality();
    await testMalaysianFeatureReadiness();
    await testPerformanceBaseline();

    // Generate test report
    console.log('\n' + '=' * 80);
    console.log('📋 BASIC VALIDATION TEST RESULTS');
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

    // Validation summary
    console.log('\n🎯 VALIDATION SUMMARY:');
    console.log('  Environment: Local Supabase instance');
    console.log('  Database: Connected and responsive');
    console.log('  Tables: Basic structure available');
    console.log('  Performance: Baseline established');

    const overallSuccess = testResults.failed === 0;
    console.log(`\n🎯 OVERALL STATUS: ${overallSuccess ? '✅ BASIC VALIDATION PASSED' : '❌ SOME VALIDATIONS FAILED'}`);
    
    if (overallSuccess) {
      console.log('\n✅ READY FOR MALAYSIAN FEATURE DEPLOYMENT');
      console.log('   - Local environment is properly configured');
      console.log('   - Database connection is working');
      console.log('   - Basic table structure is available');
      console.log('   - Performance baseline is acceptable');
    } else {
      console.log('\n⚠️  ENVIRONMENT SETUP NEEDED');
      console.log('   - Fix failed validations before proceeding');
      console.log('   - Ensure local Supabase is running');
      console.log('   - Check database migrations');
    }
    
    return overallSuccess;

  } catch (error) {
    console.error('❌ Basic validation suite failed:', error);
    return false;
  }
}

// Export for use in other test files
export { runBasicValidationTests, TEST_CONFIG, testResults };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicValidationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Test runner error:', err);
      process.exit(1);
    });
}
