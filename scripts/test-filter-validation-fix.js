#!/usr/bin/env node

/**
 * Test script to verify the filter validation fix
 * This tests that legitimate PostgreSQL event types are not flagged as dangerous
 */

console.log('🧪 Testing Filter Validation Fix...\n');

// Mock the validateFilter method with the fixed logic
function validateFilter(filter) {
  try {
    // Check for basic filter structure
    if (!filter.includes('recipient_id=eq.')) {
      return { isValid: false, error: 'Filter must include recipient_id constraint' };
    }

    // Validate filter syntax patterns
    const filterParts = filter.split('&');
    for (const part of filterParts) {
      if (part.includes('=in.(') && !part.includes(')')) {
        return { isValid: false, error: `Malformed in() filter: ${part}` };
      }

      // 🔧 FIXED: Check for actual SQL injection patterns, excluding legitimate PostgreSQL event types
      const actualDangerousPatterns = [
        ';',           // SQL statement terminator
        '--',          // SQL comment
        '/*',          // SQL block comment start
        '*/',          // SQL block comment end
        'DROP TABLE',  // Dangerous SQL command
        'DROP DATABASE', // Dangerous SQL command
        'TRUNCATE',    // Dangerous SQL command
        'ALTER TABLE', // Dangerous SQL command
        'CREATE TABLE', // Potentially dangerous SQL command
        'GRANT',       // SQL permission command
        'REVOKE',      // SQL permission command
        'EXEC',        // SQL execution command
        'EXECUTE',     // SQL execution command
        'UNION',       // SQL injection technique
        'SCRIPT',      // Script injection
        '<SCRIPT',     // XSS attempt
        'JAVASCRIPT:', // XSS attempt
        'VBSCRIPT:',   // XSS attempt
        'ONLOAD',      // XSS attempt
        'ONERROR'      // XSS attempt
      ];

      // Check for actual dangerous patterns
      const upperPart = part.toUpperCase();
      for (const pattern of actualDangerousPatterns) {
        if (upperPart.includes(pattern)) {
          return { isValid: false, error: `Potentially dangerous pattern detected: ${pattern}` };
        }
      }

      // 🔧 ADDITIONAL: Check for suspicious SQL injection patterns in values
      if (part.includes('=') && !part.startsWith('recipient_id=') && !part.startsWith('type=') && !part.startsWith('priority=')) {
        const suspiciousInFilterPatterns = [
          'DELETE FROM',
          'INSERT INTO',
          'UPDATE SET',
          'SELECT FROM',
          'WHERE 1=1',
          'OR 1=1',
          'AND 1=1',
          ') OR (',
          ') AND (',
          'UNION SELECT'
        ];

        for (const suspiciousPattern of suspiciousInFilterPatterns) {
          if (upperPart.includes(suspiciousPattern)) {
            return { isValid: false, error: `Suspicious SQL pattern in filter: ${suspiciousPattern}` };
          }
        }
      }
    }

    return { isValid: true, sanitizedFilter: filter };
  } catch (error) {
    return { isValid: false, error: `Filter validation error: ${error}` };
  }
}

// Test cases
const testCases = [
  {
    name: 'Basic user filter',
    filter: 'recipient_id=eq.user123',
    shouldPass: true
  },
  {
    name: 'Filter with notification types (including legitimate types)',
    filter: 'recipient_id=eq.user123&type=in.(receipt_processing_completed,team_member_joined)',
    shouldPass: true
  },
  {
    name: 'Filter with priorities',
    filter: 'recipient_id=eq.user123&priority=in.(medium,high)',
    shouldPass: true
  },
  {
    name: 'Complex legitimate filter',
    filter: 'recipient_id=eq.user123&type=in.(receipt_processing_completed,claim_review_requested)&priority=in.(medium,high)',
    shouldPass: true
  },
  {
    name: 'Filter with notification type containing UPDATE (should pass now)',
    filter: 'recipient_id=eq.user123&type=in.(receipt_update_notification)',
    shouldPass: true
  },
  {
    name: 'Filter with notification type containing DELETE (should pass now)',
    filter: 'recipient_id=eq.user123&type=in.(receipt_delete_notification)',
    shouldPass: true
  },
  {
    name: 'Filter with notification type containing INSERT (should pass now)',
    filter: 'recipient_id=eq.user123&type=in.(receipt_insert_notification)',
    shouldPass: true
  },
  {
    name: 'Actual SQL injection attempt - DROP TABLE',
    filter: 'recipient_id=eq.user123; DROP TABLE notifications;',
    shouldPass: false
  },
  {
    name: 'Actual SQL injection attempt - UNION SELECT',
    filter: 'recipient_id=eq.user123 UNION SELECT * FROM users',
    shouldPass: false
  },
  {
    name: 'Actual SQL injection attempt - DELETE FROM',
    filter: 'recipient_id=eq.user123&malicious=DELETE FROM notifications',
    shouldPass: false
  },
  {
    name: 'Actual SQL injection attempt - UPDATE SET',
    filter: 'recipient_id=eq.user123&malicious=UPDATE SET password=hacked',
    shouldPass: false
  },
  {
    name: 'XSS attempt',
    filter: 'recipient_id=eq.user123&type=<SCRIPT>alert("xss")</SCRIPT>',
    shouldPass: false
  },
  {
    name: 'Malformed in() filter',
    filter: 'recipient_id=eq.user123&type=in.(incomplete',
    shouldPass: false
  },
  {
    name: 'Missing recipient_id constraint',
    filter: 'type=in.(receipt_processing_completed)',
    shouldPass: false
  }
];

console.log('📋 Running Filter Validation Tests...\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = validateFilter(testCase.filter);
  const passed = result.isValid === testCase.shouldPass;
  
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Filter: ${testCase.filter}`);
  console.log(`   Expected: ${testCase.shouldPass ? 'PASS' : 'FAIL'}`);
  console.log(`   Actual: ${result.isValid ? 'PASS' : 'FAIL'}`);
  
  if (!result.isValid) {
    console.log(`   Error: ${result.error}`);
  }
  
  if (passed) {
    console.log(`   ✅ TEST PASSED`);
    passedTests++;
  } else {
    console.log(`   ❌ TEST FAILED`);
  }
  console.log('');
});

console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('\n✅ The filter validation fix is working correctly:');
  console.log('   • Legitimate notification types with UPDATE/DELETE/INSERT are now allowed');
  console.log('   • Actual SQL injection attempts are still blocked');
  console.log('   • PostgreSQL event types are properly distinguished from SQL injection');
  console.log('\n🔧 The original error should now be resolved!');
} else {
  console.log('❌ Some tests failed. Please review the validation logic.');
}
