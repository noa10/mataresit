#!/usr/bin/env node

// Test script to verify our validation fix works correctly
// This simulates the exact validation logic from the edge function

function validateFilters(filters) {
  const errors = [];
  const warnings = [];

  console.log('🔍 FILTER VALIDATION: Starting filter validation:', {
    hasDateRange: !!filters.dateRange,
    hasAmountRange: !!filters.amountRange,
    amountRange: filters.amountRange,
    dateRange: filters.dateRange,
    allFilters: filters
  });

  // Validate amount range (our fixed logic)
  if (filters.amountRange) {
    console.log('💰 AMOUNT RANGE VALIDATION:', {
      amountRange: filters.amountRange,
      min: filters.amountRange.min,
      max: filters.amountRange.max,
      minType: typeof filters.amountRange.min,
      maxType: typeof filters.amountRange.max
    });

    // CRITICAL FIX: Allow either min OR max to be specified (not both required)
    const hasMin = filters.amountRange.min !== undefined && filters.amountRange.min !== null;
    const hasMax = filters.amountRange.max !== undefined && filters.amountRange.max !== null;
    
    if (!hasMin && !hasMax) {
      errors.push('Amount range must specify at least min or max value');
    }
    
    if (hasMin && typeof filters.amountRange.min !== 'number') {
      errors.push('Amount range min must be a number');
    }
    
    if (hasMax && typeof filters.amountRange.max !== 'number') {
      errors.push('Amount range max must be a number');
    }
    
    if (hasMin && filters.amountRange.min < 0) {
      errors.push('Amount range min cannot be negative');
    }
    
    if (hasMax && filters.amountRange.max < 0) {
      errors.push('Amount range max cannot be negative');
    }
    
    if (hasMin && hasMax && filters.amountRange.min > filters.amountRange.max) {
      errors.push('Amount range min must be less than or equal to max');
    }

    console.log('💰 AMOUNT RANGE VALIDATION RESULT:', {
      hasMin,
      hasMax,
      errors: errors.filter(e => e.includes('Amount range'))
    });
  }

  return { errors, warnings };
}

function testValidation() {
  console.log('🧪 Testing validation fix for "receipts over 200" query\n');

  // Test case 1: Amount range with only min (our case)
  console.log('📋 Test 1: Amount range with only min (receipts over 200)');
  const filters1 = {
    amountRange: {
      min: 200,
      currency: 'MYR'
    }
  };
  
  const result1 = validateFilters(filters1);
  console.log('Result:', {
    isValid: result1.errors.length === 0,
    errors: result1.errors,
    warnings: result1.warnings
  });
  console.log(result1.errors.length === 0 ? '✅ PASSED' : '❌ FAILED');
  console.log('');

  // Test case 2: Amount range with only max (receipts under 100)
  console.log('📋 Test 2: Amount range with only max (receipts under 100)');
  const filters2 = {
    amountRange: {
      max: 100,
      currency: 'MYR'
    }
  };
  
  const result2 = validateFilters(filters2);
  console.log('Result:', {
    isValid: result2.errors.length === 0,
    errors: result2.errors,
    warnings: result2.warnings
  });
  console.log(result2.errors.length === 0 ? '✅ PASSED' : '❌ FAILED');
  console.log('');

  // Test case 3: Amount range with both min and max
  console.log('📋 Test 3: Amount range with both min and max (receipts between 100-300)');
  const filters3 = {
    amountRange: {
      min: 100,
      max: 300,
      currency: 'MYR'
    }
  };
  
  const result3 = validateFilters(filters3);
  console.log('Result:', {
    isValid: result3.errors.length === 0,
    errors: result3.errors,
    warnings: result3.warnings
  });
  console.log(result3.errors.length === 0 ? '✅ PASSED' : '❌ FAILED');
  console.log('');

  // Test case 4: Empty amount range (should fail)
  console.log('📋 Test 4: Empty amount range (should fail)');
  const filters4 = {
    amountRange: {}
  };
  
  const result4 = validateFilters(filters4);
  console.log('Result:', {
    isValid: result4.errors.length === 0,
    errors: result4.errors,
    warnings: result4.warnings
  });
  console.log(result4.errors.length > 0 ? '✅ PASSED (correctly failed)' : '❌ FAILED (should have failed)');
  console.log('');

  // Summary
  const allPassed = result1.errors.length === 0 && 
                   result2.errors.length === 0 && 
                   result3.errors.length === 0 && 
                   result4.errors.length > 0;
  
  console.log('🎯 SUMMARY:');
  console.log(allPassed ? '✅ All tests passed! The validation fix is working correctly.' : '❌ Some tests failed. The validation fix needs more work.');
}

// Run the test
testValidation();
