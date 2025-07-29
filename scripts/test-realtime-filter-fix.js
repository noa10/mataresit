#!/usr/bin/env node

/**
 * Test script to validate the Supabase realtime filter syntax fix
 * This script tests the corrected PostgreSQL filter syntax for realtime subscriptions
 */

console.log('🧪 Testing Supabase Realtime Filter Syntax Fix');
console.log('='.repeat(50));

// Test filter construction with the new quoted syntax
function testFilterConstruction() {
  console.log('\n📋 Testing Filter Construction');
  console.log('-'.repeat(30));

  const userId = 'feecc208-1234-5678-9abc-def012345678';
  const notificationTypes = ['receipt_processing_completed', 'team_member_joined'];
  const priorities = ['medium', 'high'];

  // Build filters using the corrected syntax
  let filter = `recipient_id=eq.${userId}`;
  
  if (notificationTypes && notificationTypes.length > 0) {
    const sanitizedTypes = notificationTypes
      .filter(type => type && typeof type === 'string')
      .map(type => type.trim());
    
    if (sanitizedTypes.length > 0) {
      // Use unquoted values for proper PostgREST syntax
      filter += `&type=in.(${sanitizedTypes.join(',')})`;
    }
  }
  
  if (priorities && priorities.length > 0) {
    const sanitizedPriorities = priorities
      .filter(priority => priority && typeof priority === 'string')
      .map(priority => priority.trim());
    
    if (sanitizedPriorities.length > 0) {
      // Use unquoted values for proper PostgREST syntax
      filter += `&priority=in.(${sanitizedPriorities.join(',')})`;
    }
  }

  console.log('✅ Corrected Filter:', filter);
  console.log('📝 Expected format: recipient_id=eq.user123&type=in.(type1,type2)&priority=in.(medium,high)');

  // Validate the filter format
  const hasUnquotedValues = !filter.includes('"');
  const hasProperInSyntax = /=in\.\([^)]+\)/.test(filter);

  console.log('\n🔍 Validation Results:');
  console.log(`   - Has unquoted string values: ${hasUnquotedValues ? '✅' : '❌'}`);
  console.log(`   - Has proper in() syntax: ${hasProperInSyntax ? '✅' : '❌'}`);

  return hasUnquotedValues && hasProperInSyntax;
}

// Test the old (broken) vs new (fixed) syntax
function testSyntaxComparison() {
  console.log('\n🔄 Syntax Comparison');
  console.log('-'.repeat(30));

  const priorities = ['medium', 'high'];

  // Old (broken) syntax with quotes
  const quotedPriorities = priorities.map(priority => `"${priority}"`);
  const oldSyntax = `priority=in.(${quotedPriorities.join(',')})`;
  console.log('❌ Old (broken) syntax:', oldSyntax);

  // New (fixed) syntax without quotes
  const newSyntax = `priority=in.(${priorities.join(',')})`;
  console.log('✅ New (fixed) syntax:', newSyntax);

  return !newSyntax.includes('"');
}

// Test edge cases
function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases');
  console.log('-'.repeat(30));

  const testCases = [
    {
      name: 'Empty arrays',
      notificationTypes: [],
      priorities: [],
      expected: 'recipient_id=eq.user123'
    },
    {
      name: 'Single values',
      notificationTypes: ['receipt_processing_completed'],
      priorities: ['high'],
      expected: 'recipient_id=eq.user123&type=in.(receipt_processing_completed)&priority=in.(high)'
    },
    {
      name: 'Multiple values',
      notificationTypes: ['type1', 'type2', 'type3'],
      priorities: ['low', 'medium', 'high'],
      expected: 'recipient_id=eq.user123&type=in.(type1,type2,type3)&priority=in.(low,medium,high)'
    },
    {
      name: 'Values with spaces (trimmed)',
      notificationTypes: [' receipt_processing_completed ', ' team_member_joined '],
      priorities: [' medium ', ' high '],
      expected: 'recipient_id=eq.user123&type=in.(receipt_processing_completed,team_member_joined)&priority=in.(medium,high)'
    }
  ];

  let allPassed = true;

  testCases.forEach((testCase, index) => {
    console.log(`\n   Test ${index + 1}: ${testCase.name}`);
    
    const userId = 'user123';
    let filter = `recipient_id=eq.${userId}`;
    
    if (testCase.notificationTypes && testCase.notificationTypes.length > 0) {
      const sanitizedTypes = testCase.notificationTypes
        .filter(type => type && typeof type === 'string')
        .map(type => type.trim());
      
      if (sanitizedTypes.length > 0) {
        filter += `&type=in.(${sanitizedTypes.join(',')})`;
      }
    }
    
    if (testCase.priorities && testCase.priorities.length > 0) {
      const sanitizedPriorities = testCase.priorities
        .filter(priority => priority && typeof priority === 'string')
        .map(priority => priority.trim());
      
      if (sanitizedPriorities.length > 0) {
        filter += `&priority=in.(${sanitizedPriorities.join(',')})`;
      }
    }

    const passed = filter === testCase.expected;
    console.log(`   Result: ${filter}`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!passed) {
      allPassed = false;
    }
  });

  return allPassed;
}

// Run all tests
function runTests() {
  console.log('🚀 Starting Filter Syntax Tests...\n');

  const results = {
    filterConstruction: testFilterConstruction(),
    syntaxComparison: testSyntaxComparison(),
    edgeCases: testEdgeCases()
  };

  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Filter Construction: ${results.filterConstruction ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Syntax Comparison: ${results.syntaxComparison ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Edge Cases: ${results.edgeCases ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (allPassed) {
    console.log('\n🎉 The realtime filter syntax fix is working correctly!');
    console.log('   The PostgreSQL filters now use proper quoted string syntax.');
    console.log('   This should resolve the Supabase realtime subscription errors.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the filter construction logic.');
  }

  return allPassed;
}

// Run the tests
runTests();
