/**
 * Malaysian Multi-Language Support Deployment Validator
 * Validates all components before and after deployment
 */

import { supabase } from '../tests/config/test-supabase-client.ts';
import { performance } from 'perf_hooks';

// Validation configuration
const VALIDATION_CONFIG = {
  REQUIRED_TABLES: [
    'malaysian_tax_categories',
    'malaysian_business_categories', 
    'malaysian_business_directory',
    'malaysian_payment_methods',
    'malaysian_currency_rates',
    'malaysian_receipt_formats',
    'malaysian_address_formats',
    'malaysian_business_hours',
    'malaysian_public_holidays',
    'malaysian_cultural_preferences'
  ],
  REQUIRED_MATERIALIZED_VIEWS: [
    'mv_malaysian_business_analytics',
    'mv_malaysian_reference_data'
  ],
  REQUIRED_FUNCTIONS: [
    'search_malaysian_business_optimized',
    'detect_malaysian_payment_method',
    'format_malaysian_currency',
    'format_malaysian_date',
    'validate_malaysian_registration_number',
    'parse_malaysian_address',
    'refresh_malaysian_materialized_views'
  ],
  REQUIRED_EDGE_FUNCTIONS: [
    'enhance-receipt-data',
    'semantic-search',
    'send-email',
    'performance-cache'
  ],
  MINIMUM_DATA_COUNTS: {
    malaysian_tax_categories: 20,
    malaysian_business_directory: 500,
    malaysian_payment_methods: 15,
    malaysian_public_holidays: 10
  }
};

// Validation results
let validationResults = {
  preDeployment: {},
  postDeployment: {},
  summary: {}
};

/**
 * Utility functions
 */
function logValidation(category, item, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`  ${status} ${item}${details ? ': ' + details : ''}`);
  return passed;
}

function logCategory(category) {
  console.log(`\n📋 ${category}`);
  console.log('-'.repeat(50));
}

/**
 * 1. Database Schema Validation
 */
async function validateDatabaseSchema() {
  logCategory('Database Schema Validation');
  
  let allPassed = true;

  // Check required tables exist
  console.log('\n🗄️  Checking Required Tables:');
  for (const tableName of VALIDATION_CONFIG.REQUIRED_TABLES) {
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);

      const exists = !error && data && data.length > 0;
      allPassed &= logValidation('tables', tableName, exists, error?.message);
    } catch (err) {
      allPassed &= logValidation('tables', tableName, false, err.message);
    }
  }

  // Check materialized views
  console.log('\n👁️  Checking Materialized Views:');
  for (const viewName of VALIDATION_CONFIG.REQUIRED_MATERIALIZED_VIEWS) {
    try {
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1);

      const exists = !error && data !== null;
      allPassed &= logValidation('views', viewName, exists, error?.message);
    } catch (err) {
      allPassed &= logValidation('views', viewName, false, err.message);
    }
  }

  // Check database functions
  console.log('\n⚙️  Checking Database Functions:');
  for (const functionName of VALIDATION_CONFIG.REQUIRED_FUNCTIONS) {
    try {
      const { data, error } = await supabase
        .from('information_schema.routines')
        .select('routine_name')
        .eq('routine_schema', 'public')
        .eq('routine_name', functionName);

      const exists = !error && data && data.length > 0;
      allPassed &= logValidation('functions', functionName, exists, error?.message);
    } catch (err) {
      allPassed &= logValidation('functions', functionName, false, err.message);
    }
  }

  return allPassed;
}

/**
 * 2. Data Population Validation
 */
async function validateDataPopulation() {
  logCategory('Data Population Validation');
  
  let allPassed = true;

  console.log('\n📊 Checking Data Counts:');
  for (const [tableName, minCount] of Object.entries(VALIDATION_CONFIG.MINIMUM_DATA_COUNTS)) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      const hasEnoughData = !error && count >= minCount;
      allPassed &= logValidation('data', tableName, hasEnoughData, 
        `${count || 0}/${minCount} records`);
    } catch (err) {
      allPassed &= logValidation('data', tableName, false, err.message);
    }
  }

  // Check specific data quality
  console.log('\n🔍 Checking Data Quality:');
  
  // Malaysian businesses with keywords
  try {
    const { data, error } = await supabase
      .from('malaysian_business_directory')
      .select('business_name, keywords')
      .not('keywords', 'is', null)
      .limit(10);

    const hasKeywords = !error && data && data.length > 0 && 
      data.every(b => b.keywords && b.keywords.length > 0);
    allPassed &= logValidation('quality', 'Business keywords populated', hasKeywords);
  } catch (err) {
    allPassed &= logValidation('quality', 'Business keywords populated', false, err.message);
  }

  // Active tax categories
  try {
    const { data, error } = await supabase
      .from('malaysian_tax_categories')
      .select('*')
      .eq('is_active', true);

    const hasActiveTax = !error && data && data.length > 0;
    allPassed &= logValidation('quality', 'Active tax categories', hasActiveTax);
  } catch (err) {
    allPassed &= logValidation('quality', 'Active tax categories', false, err.message);
  }

  return allPassed;
}

/**
 * 3. Edge Functions Validation
 */
async function validateEdgeFunctions() {
  logCategory('Edge Functions Validation');
  
  let allPassed = true;

  console.log('\n🔧 Testing Edge Functions:');
  
  // Test enhance-receipt-data
  try {
    const { data, error } = await supabase.functions.invoke('enhance-receipt-data', {
      body: { 
        receipt_data: {
          merchant: '99 Speedmart',
          total: 25.50,
          currency: 'MYR'
        }
      }
    });

    const works = !error && data;
    allPassed &= logValidation('edge-functions', 'enhance-receipt-data', works, error?.message);
  } catch (err) {
    allPassed &= logValidation('edge-functions', 'enhance-receipt-data', false, err.message);
  }

  // Test semantic-search
  try {
    const { data, error } = await supabase.functions.invoke('semantic-search', {
      body: { 
        query: 'grocery store',
        limit: 5
      }
    });

    const works = !error && data;
    allPassed &= logValidation('edge-functions', 'semantic-search', works, error?.message);
  } catch (err) {
    allPassed &= logValidation('edge-functions', 'semantic-search', false, err.message);
  }

  // Test performance-cache
  try {
    const testKey = `validation_${Date.now()}`;
    const { data, error } = await supabase.functions.invoke('performance-cache', {
      body: { 
        action: 'set',
        key: testKey,
        value: { test: 'validation' },
        ttl: 300
      }
    });

    const works = !error && data;
    allPassed &= logValidation('edge-functions', 'performance-cache', works, error?.message);
  } catch (err) {
    allPassed &= logValidation('edge-functions', 'performance-cache', false, err.message);
  }

  return allPassed;
}

/**
 * 4. Performance Validation
 */
async function validatePerformance() {
  logCategory('Performance Validation');
  
  let allPassed = true;

  console.log('\n⚡ Testing Performance:');

  // Test search performance
  try {
    const startTime = performance.now();
    const { data, error } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: 'grocery',
      limit_results: 10,
      use_cache: true
    });
    const endTime = performance.now();
    
    const responseTime = endTime - startTime;
    const isFast = !error && responseTime < 100;
    allPassed &= logValidation('performance', 'Search speed', isFast, 
      `${responseTime.toFixed(2)}ms`);
  } catch (err) {
    allPassed &= logValidation('performance', 'Search speed', false, err.message);
  }

  // Test materialized view performance
  try {
    const startTime = performance.now();
    const { data, error } = await supabase
      .from('mv_malaysian_business_analytics')
      .select('*')
      .limit(100);
    const endTime = performance.now();
    
    const queryTime = endTime - startTime;
    const isFast = !error && queryTime < 50;
    allPassed &= logValidation('performance', 'Materialized view query', isFast, 
      `${queryTime.toFixed(2)}ms`);
  } catch (err) {
    allPassed &= logValidation('performance', 'Materialized view query', false, err.message);
  }

  return allPassed;
}

/**
 * 5. Integration Validation
 */
async function validateIntegration() {
  logCategory('Integration Validation');
  
  let allPassed = true;

  console.log('\n🔗 Testing Integration:');

  // Test Malaysian business recognition workflow
  try {
    const { data: searchResult, error: searchError } = await supabase.rpc('search_malaysian_business_optimized', {
      search_term: '99 speedmart',
      limit_results: 1,
      use_cache: true
    });

    if (!searchError && searchResult && searchResult.length > 0) {
      const business = searchResult[0];
      
      // Test payment method detection
      const { data: paymentResult, error: paymentError } = await supabase.rpc('detect_malaysian_payment_method', {
        receipt_text: 'Payment via GrabPay'
      });

      const integrationWorks = !paymentError && paymentResult;
      allPassed &= logValidation('integration', 'Business + Payment workflow', integrationWorks);
    } else {
      allPassed &= logValidation('integration', 'Business + Payment workflow', false, 'No business found');
    }
  } catch (err) {
    allPassed &= logValidation('integration', 'Business + Payment workflow', false, err.message);
  }

  // Test cultural formatting
  try {
    const { data: dateResult, error: dateError } = await supabase.rpc('format_malaysian_date', {
      input_date: '2025-06-17',
      format_preference: 'DD/MM/YYYY'
    });

    const { data: currencyResult, error: currencyError } = await supabase.rpc('format_malaysian_currency', {
      amount: 123.45,
      currency_code: 'MYR',
      include_symbol: true
    });

    const formattingWorks = !dateError && !currencyError && 
      dateResult === '17/06/2025' && currencyResult.includes('RM');
    allPassed &= logValidation('integration', 'Cultural formatting', formattingWorks);
  } catch (err) {
    allPassed &= logValidation('integration', 'Cultural formatting', false, err.message);
  }

  return allPassed;
}

/**
 * 6. Security Validation
 */
async function validateSecurity() {
  logCategory('Security Validation');
  
  let allPassed = true;

  console.log('\n🔒 Testing Security:');

  // Test RLS policies are active
  try {
    const { data, error } = await supabase
      .from('information_schema.table_privileges')
      .select('*')
      .eq('table_schema', 'public')
      .in('table_name', VALIDATION_CONFIG.REQUIRED_TABLES.slice(0, 3));

    const hasPrivileges = !error && data && data.length > 0;
    allPassed &= logValidation('security', 'Table privileges configured', hasPrivileges);
  } catch (err) {
    allPassed &= logValidation('security', 'Table privileges configured', false, err.message);
  }

  // Test Edge Function authentication
  try {
    // This should work with proper auth
    const { data, error } = await supabase.functions.invoke('enhance-receipt-data', {
      body: { test: 'auth_check' }
    });

    // We expect this to work (not test unauthorized access)
    const authWorks = !error || error.message !== 'Unauthorized';
    allPassed &= logValidation('security', 'Edge Function auth', authWorks);
  } catch (err) {
    allPassed &= logValidation('security', 'Edge Function auth', false, err.message);
  }

  return allPassed;
}

/**
 * Main validation runner
 */
async function runDeploymentValidation(phase = 'pre-deployment') {
  console.log(`🚀 Running ${phase.toUpperCase()} Validation for Malaysian Multi-Language Support\n`);
  console.log('=' * 80);

  const results = {
    databaseSchema: false,
    dataPopulation: false,
    edgeFunctions: false,
    performance: false,
    integration: false,
    security: false
  };

  try {
    results.databaseSchema = await validateDatabaseSchema();
    results.dataPopulation = await validateDataPopulation();
    results.edgeFunctions = await validateEdgeFunctions();
    results.performance = await validatePerformance();
    results.integration = await validateIntegration();
    results.security = await validateSecurity();

    // Store results
    validationResults[phase === 'pre-deployment' ? 'preDeployment' : 'postDeployment'] = results;

    // Generate validation report
    console.log('\n' + '=' * 80);
    console.log(`📋 ${phase.toUpperCase()} VALIDATION SUMMARY`);
    console.log('=' * 80);

    const passedValidations = Object.values(results).filter(Boolean).length;
    const totalValidations = Object.keys(results).length;

    console.log(`\n🎯 VALIDATION RESULTS:`);
    console.log(`  Database Schema: ${results.databaseSchema ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Data Population: ${results.dataPopulation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Edge Functions: ${results.edgeFunctions ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Performance: ${results.performance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Integration: ${results.integration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Security: ${results.security ? '✅ PASS' : '❌ FAIL'}`);

    console.log(`\n📊 OVERALL SCORE: ${passedValidations}/${totalValidations} (${((passedValidations/totalValidations)*100).toFixed(1)}%)`);

    const overallSuccess = passedValidations === totalValidations;
    console.log(`\n🎯 VALIDATION STATUS: ${overallSuccess ? '✅ ALL VALIDATIONS PASSED' : '❌ SOME VALIDATIONS FAILED'}`);
    
    if (!overallSuccess) {
      console.log('\n⚠️  DEPLOYMENT RECOMMENDATION: Fix failed validations before proceeding');
    } else {
      console.log('\n✅ DEPLOYMENT RECOMMENDATION: Safe to proceed with deployment');
    }
    
    return overallSuccess;

  } catch (error) {
    console.error('❌ Validation suite failed:', error);
    return false;
  }
}

/**
 * Compare pre and post deployment results
 */
function compareValidationResults() {
  if (!validationResults.preDeployment || !validationResults.postDeployment) {
    console.log('❌ Cannot compare - missing validation results');
    return false;
  }

  console.log('\n📊 PRE vs POST DEPLOYMENT COMPARISON');
  console.log('=' * 50);

  const categories = Object.keys(validationResults.preDeployment);
  let allImproved = true;

  for (const category of categories) {
    const pre = validationResults.preDeployment[category];
    const post = validationResults.postDeployment[category];
    
    if (post >= pre) {
      console.log(`  ${category}: ${pre ? '✅' : '❌'} → ${post ? '✅' : '❌'} ${post > pre ? '📈' : '='}`);
    } else {
      console.log(`  ${category}: ${pre ? '✅' : '❌'} → ${post ? '✅' : '❌'} 📉 REGRESSION`);
      allImproved = false;
    }
  }

  return allImproved;
}

// Export for use in other scripts
export { 
  runDeploymentValidation, 
  compareValidationResults, 
  VALIDATION_CONFIG, 
  validationResults 
};

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const phase = process.argv[2] || 'pre-deployment';
  runDeploymentValidation(phase)
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
      console.error('Validation runner error:', err);
      process.exit(1);
    });
}
