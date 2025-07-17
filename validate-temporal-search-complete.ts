#!/usr/bin/env -S deno run --allow-all

/**
 * Complete validation of temporal search accuracy fixes
 * Tests all components that can be validated programmatically
 */

// Import the temporal parser for direct testing
import { parseTemporalQuery } from './supabase/functions/_shared/temporal-parser.ts';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function validateTemporalSearchComplete() {
  console.log('🔍 Complete Temporal Search Accuracy Validation');
  console.log('=' .repeat(70));
  console.log('');
  
  let allTestsPassed = true;
  const testResults: { test: string; status: string; details?: string }[] = [];
  
  // Test 1: Temporal Parser Accuracy
  console.log('🧪 Test 1: Temporal Parser Accuracy');
  console.log('-'.repeat(50));
  
  try {
    const testQuery = "show me all receipts from last week";
    const result = await parseTemporalQuery(testQuery);
    
    const expectedStart = '2025-07-07';
    const expectedEnd = '2025-07-13';
    const expectedPreset = 'last_week';
    
    const dateRangeCorrect = result.dateRange?.start === expectedStart && 
                            result.dateRange?.end === expectedEnd;
    const presetCorrect = result.dateRange?.preset === expectedPreset;
    
    if (dateRangeCorrect && presetCorrect) {
      console.log('✅ Temporal parser working correctly');
      console.log(`   Date Range: ${result.dateRange?.start} to ${result.dateRange?.end}`);
      console.log(`   Preset: ${result.dateRange?.preset}`);
      testResults.push({ test: 'Temporal Parser', status: '✅ PASS' });
    } else {
      console.log('❌ Temporal parser failed');
      console.log(`   Expected: ${expectedStart} to ${expectedEnd} (${expectedPreset})`);
      console.log(`   Actual: ${result.dateRange?.start} to ${result.dateRange?.end} (${result.dateRange?.preset})`);
      testResults.push({ 
        test: 'Temporal Parser', 
        status: '❌ FAIL',
        details: `Expected ${expectedStart}-${expectedEnd}, got ${result.dateRange?.start}-${result.dateRange?.end}`
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Temporal parser test failed:', error.message);
    testResults.push({ test: 'Temporal Parser', status: '❌ ERROR', details: error.message });
    allTestsPassed = false;
  }
  
  console.log('');
  
  // Test 2: Authentication Validation
  console.log('🧪 Test 2: Authentication Validation');
  console.log('-'.repeat(50));
  
  try {
    // Test without authentication
    const noAuthResponse = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "show me all receipts from last week", limit: 50 })
    });
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Authentication validation working (401 for no auth)');
      testResults.push({ test: 'Authentication Validation', status: '✅ PASS' });
    } else {
      console.log(`❌ Expected 401, got ${noAuthResponse.status}`);
      testResults.push({ 
        test: 'Authentication Validation', 
        status: '❌ FAIL',
        details: `Expected 401, got ${noAuthResponse.status}`
      });
      allTestsPassed = false;
    }
    
    // Test with invalid token
    const invalidTokenResponse = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: "show me all receipts from last week", limit: 50 })
    });
    
    if (invalidTokenResponse.status === 401) {
      console.log('✅ Invalid token properly rejected (401)');
      const errorResponse = await invalidTokenResponse.json();
      console.log(`   Error message: ${errorResponse.error}`);
    } else {
      console.log(`⚠️ Invalid token test: Expected 401, got ${invalidTokenResponse.status}`);
    }
    
  } catch (error) {
    console.log('❌ Authentication test failed:', error.message);
    testResults.push({ test: 'Authentication Validation', status: '❌ ERROR', details: error.message });
    allTestsPassed = false;
  }
  
  console.log('');
  
  // Test 3: Database Data Verification
  console.log('🧪 Test 3: Database Data Verification');
  console.log('-'.repeat(50));
  
  try {
    // This would require proper database access, so we'll simulate
    console.log('📊 Expected data in July 7-13, 2025:');
    console.log('   - Total receipts: 32');
    console.log('   - User ID: feecc208-3282-49d2-8e15-0c64b0ee4abb');
    console.log('   - Date range: 2025-07-07 to 2025-07-13');
    console.log('   - All 7 days should have receipts');
    console.log('');
    console.log('⚠️ Database verification requires UI testing with proper authentication');
    testResults.push({ test: 'Database Data', status: '⚠️ MANUAL', details: 'Requires UI testing' });
  } catch (error) {
    console.log('❌ Database verification failed:', error.message);
    testResults.push({ test: 'Database Data', status: '❌ ERROR', details: error.message });
  }
  
  console.log('');
  
  // Test 4: Edge Function Deployment Status
  console.log('🧪 Test 4: Edge Function Deployment Status');
  console.log('-'.repeat(50));
  
  try {
    // Test if the function is deployed and responding
    const healthResponse = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "" }) // Empty query should trigger validation error
    });
    
    if (healthResponse.status === 400) {
      console.log('✅ Edge function deployed and responding');
      console.log('   Function properly validates empty queries');
      testResults.push({ test: 'Edge Function Deployment', status: '✅ PASS' });
    } else if (healthResponse.status === 401) {
      console.log('✅ Edge function deployed and responding');
      console.log('   Function properly requires authentication');
      testResults.push({ test: 'Edge Function Deployment', status: '✅ PASS' });
    } else {
      console.log(`⚠️ Unexpected response: ${healthResponse.status}`);
      testResults.push({ 
        test: 'Edge Function Deployment', 
        status: '⚠️ PARTIAL',
        details: `Unexpected status: ${healthResponse.status}`
      });
    }
  } catch (error) {
    console.log('❌ Edge function deployment test failed:', error.message);
    testResults.push({ test: 'Edge Function Deployment', status: '❌ ERROR', details: error.message });
    allTestsPassed = false;
  }
  
  console.log('');
  
  // Test Summary
  console.log('📊 Validation Summary');
  console.log('=' .repeat(70));
  
  testResults.forEach(result => {
    console.log(`${result.status} ${result.test}`);
    if (result.details) {
      console.log(`    ${result.details}`);
    }
  });
  
  console.log('');
  console.log('🎯 Overall Status:');
  if (allTestsPassed) {
    console.log('✅ All automated tests passed!');
  } else {
    console.log('⚠️ Some tests failed - see details above');
  }
  
  console.log('');
  console.log('📝 Next Steps:');
  console.log('1. 🔍 Test in UI with proper user authentication');
  console.log('2. 📊 Verify all 32 receipts are returned');
  console.log('3. 📅 Check date range display shows July 7-13, 2025');
  console.log('4. 🔄 Test multiple query variations');
  console.log('5. 📈 Monitor edge function logs for debugging info');
  
  console.log('');
  console.log('🎯 Success Criteria for UI Testing:');
  console.log('   ✅ Query: "show me all receipts from last week"');
  console.log('   ✅ Results: 32 receipts');
  console.log('   ✅ Date Range: July 7-13, 2025');
  console.log('   ✅ All 7 days represented');
  console.log('   ✅ No authentication errors');
  
  console.log('');
  console.log('📋 Validation Guide: temporal-search-validation-guide.md');
  
  return allTestsPassed;
}

// Run the validation
const success = await validateTemporalSearchComplete();
Deno.exit(success ? 0 : 1);
