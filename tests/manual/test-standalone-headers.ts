/**
 * Manual test for standalone header functionality
 * 
 * This test verifies that our changes to handle standalone headers work correctly
 */

import { parseUIComponents } from '../../src/lib/ui-component-parser';

function testStandaloneHeaders() {
  console.log('🧪 Testing Standalone Header Functionality\n');

  // Test case 1: Content with standalone headers that should be marked
  const testContent1 = `# Financial Analysis Summary

This analysis examines spending on "Thai Boy" chili purchases.

## Spending Overview

Here are the spending details.

## Transaction Breakdown

Individual transactions listed below.

# Regular Header

This is a regular header with actual content following.`;

  console.log('📝 Test 1: Parsing content with standalone headers');
  const result1 = parseUIComponents(testContent1);
  
  console.log('✅ Success:', result1.success);
  console.log('📊 Components found:', result1.components.length);
  
  result1.components.forEach((component, index) => {
    if (component.component === 'section_header') {
      console.log(`   ${index + 1}. "${component.data.title}" - Standalone: ${component.data.standalone}`);
    }
  });

  console.log('\n📄 Cleaned content:');
  console.log(result1.cleanedContent);
  console.log('\n' + '='.repeat(60) + '\n');

  // Test case 2: Content with redundant patterns
  const testContent2 = `# Financial Analysis Summary

Financial Analysis Summary:

This analysis examines spending patterns.

Spending Overview:

Transaction details follow here.

## Spending Overview

More detailed content here.

"Thai Boy" Chill Purchases

Some analysis content.`;

  console.log('📝 Test 2: Cleaning redundant content patterns');
  const result2 = parseUIComponents(testContent2);
  
  console.log('✅ Success:', result2.success);
  console.log('📊 Components found:', result2.components.length);
  
  console.log('\n📄 Cleaned content (should remove redundant patterns):');
  console.log(result2.cleanedContent);
  
  // Check if redundant patterns were removed
  const hasRedundantPattern1 = result2.cleanedContent.includes('Financial Analysis Summary:');
  const hasRedundantPattern2 = result2.cleanedContent.includes('Spending Overview:');
  const hasRedundantPattern3 = result2.cleanedContent.includes('"Thai Boy" Chill Purchases');

  console.log('\n🔍 Redundant pattern removal:');
  console.log(`   "Financial Analysis Summary:" removed: ${!hasRedundantPattern1 ? '✅' : '❌'}`);
  console.log(`   "Spending Overview:" removed: ${!hasRedundantPattern2 ? '✅' : '❌'}`);
  console.log(`   Duplicate title pattern removed: ${!hasRedundantPattern3 ? '✅' : '❌'}`);

  // Debug: show the exact content to understand the pattern
  console.log('\n🔍 Debug - Lines containing "Thai Boy":');
  result2.cleanedContent.split('\n').forEach((line, index) => {
    if (line.includes('Thai Boy')) {
      console.log(`   Line ${index + 1}: "${line}"`);
    }
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Test case 3: Mixed content with both standalone and regular headers
  const testContent3 = `# Analysis Results

## Financial Analysis Summary

Some financial data here.

### Key Insights

Important insights follow.

## Custom Section

This is a custom section with unique content.`;

  console.log('📝 Test 3: Mixed standalone and regular headers');
  const result3 = parseUIComponents(testContent3);
  
  console.log('✅ Success:', result3.success);
  console.log('📊 Components found:', result3.components.length);
  
  result3.components.forEach((component, index) => {
    if (component.component === 'section_header') {
      console.log(`   ${index + 1}. "${component.data.title}" (Level ${component.data.level}) - Standalone: ${component.data.standalone}`);
    }
  });

  console.log('\n📄 Final cleaned content:');
  console.log(result3.cleanedContent);
}

// Run the test
testStandaloneHeaders();
