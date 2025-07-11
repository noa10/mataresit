#!/usr/bin/env tsx

/**
 * Comprehensive Formatting Pipeline Test Runner
 * 
 * This script runs end-to-end tests for the complete formatting pipeline
 * from LLM response generation through UI rendering.
 */

import { parseUIComponents, analyzeMarkdownContent } from '../src/lib/ui-component-parser';

// Test data representing various LLM response scenarios
const testScenarios = {
  basicReceiptTable: {
    name: 'Basic Receipt Table',
    input: `# Receipt Search Results

Found 3 receipts:

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Groceries |
| SHELL STATION | 17/01/2024 | MYR 80.00 | Fuel |

Total: **MYR 143.50**`,
    expectedComponents: ['section_header', 'data_table'],
    expectedTableRows: 3,
    expectedHeaders: 1
  },

  financialAnalysis: {
    name: 'Financial Analysis with Multiple Tables',
    input: `# Financial Analysis Summary

## Monthly Spending
| Category | Amount | Percentage |
|----------|--------|------------|
| Groceries | MYR 245.30 | 45% |
| Fuel | MYR 180.00 | 33% |
| Dining | MYR 120.50 | 22% |

## Top Merchants
| Merchant | Visits | Total Spent |
|----------|--------|-------------|
| SUPER SEVEN | 12 | MYR 215.80 |
| TESCO EXTRA | 8 | MYR 364.20 |
| SHELL STATION | 6 | MYR 480.00 |

### Key Insights
• Grocery spending increased by 15%
• Fuel costs are above average
• Consider loyalty programs for frequent merchants`,
    expectedComponents: ['section_header', 'data_table'],
    expectedTableRows: 6, // 3 + 3 from two tables
    expectedHeaders: 3 // H1, H2, H3
  },

  mixedContent: {
    name: 'Mixed Markdown and JSON Components',
    input: `# Search Results

Found receipts for your query:

| Merchant | Amount |
|----------|--------|
| Store A | MYR 25.99 |
| Store B | MYR 15.50 |

\`\`\`json
{
  "type": "ui_component",
  "component": "summary_card",
  "data": {
    "title": "Total Spent",
    "value": "MYR 41.49",
    "subtitle": "2 transactions"
  },
  "metadata": {
    "title": "Summary",
    "interactive": false
  }
}
\`\`\`

## Analysis
Both transactions processed successfully.`,
    expectedComponents: ['section_header', 'data_table', 'summary_card'],
    expectedTableRows: 2,
    expectedHeaders: 2
  },

  emptyResults: {
    name: 'Empty Results with Suggestions',
    input: `# No Results Found

No receipts found for your search criteria.

## Suggestions
• Try a broader date range
• Check spelling of merchant names
• Use different keywords

Would you like me to search with different criteria?`,
    expectedComponents: ['section_header'],
    expectedTableRows: 0,
    expectedHeaders: 2
  },

  largeDataset: {
    name: 'Large Dataset Performance Test',
    input: `# Large Receipt Dataset

## All Transactions
| ID | Merchant | Date | Amount | Category |
|----|----------|------|--------|----------|
${Array.from({ length: 50 }, (_, i) => 
  `| ${i + 1} | Merchant ${i + 1} | ${String(15 + (i % 16)).padStart(2, '0')}/01/2024 | MYR ${((i + 1) * 12.50).toFixed(2)} | Category ${(i % 5) + 1} |`
).join('\n')}

Total transactions: 50`,
    expectedComponents: ['section_header', 'data_table'],
    expectedTableRows: 50,
    expectedHeaders: 2
  }
};

// Test validation functions
function validateCurrencyFormat(text: string): boolean {
  const currencyRegex = /MYR \d+\.\d{2}/g;
  const matches = text.match(currencyRegex);
  return matches !== null && matches.length > 0;
}

function validateDateFormat(text: string): boolean {
  const dateRegex = /\d{2}\/\d{2}\/\d{4}/g;
  const matches = text.match(dateRegex);
  return matches !== null && matches.length > 0;
}

function validateTableStructure(text: string): boolean {
  const tableRegex = /\|(.+)\|\n\|(?:-+\|)+\n((?:\|.+\|\n?)+)/g;
  return tableRegex.test(text);
}

function validateNoTemplatePlaceholders(text: string): boolean {
  const placeholderRegex = /\{\{.*?\}\}/g;
  return !placeholderRegex.test(text);
}

// Main test runner
async function runFormattingPipelineTests(): Promise<void> {
  console.log('🚀 Starting Formatting Pipeline Integration Tests\n');
  
  let totalTests = 0;
  let passedTests = 0;
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; details: string }> = [];

  for (const [key, scenario] of Object.entries(testScenarios)) {
    console.log(`📋 Testing: ${scenario.name}`);
    totalTests++;

    try {
      // Test 1: Content Analysis
      const analysis = analyzeMarkdownContent(scenario.input);
      console.log(`  📊 Content Analysis:`);
      console.log(`    - Tables: ${analysis.tableCount}`);
      console.log(`    - Headers: ${analysis.headerCount}`);
      console.log(`    - Header Levels: [${analysis.headerLevels.join(', ')}]`);

      // Test 2: Component Parsing
      const parseResult = parseUIComponents(scenario.input);
      console.log(`  🔧 Component Parsing:`);
      console.log(`    - Success: ${parseResult.success}`);
      console.log(`    - Components: ${parseResult.components.length}`);
      console.log(`    - Component Types: [${parseResult.components.map(c => c.component).join(', ')}]`);

      // Test 3: Validation Checks
      const validations = {
        currencyFormat: validateCurrencyFormat(scenario.input),
        dateFormat: validateDateFormat(scenario.input),
        tableStructure: validateTableStructure(scenario.input),
        noPlaceholders: validateNoTemplatePlaceholders(scenario.input)
      };

      console.log(`  ✅ Format Validation:`);
      console.log(`    - Currency Format: ${validations.currencyFormat ? '✓' : '✗'}`);
      console.log(`    - Date Format: ${validations.dateFormat ? '✓' : '✗'}`);
      console.log(`    - Table Structure: ${validations.tableStructure ? '✓' : '✗'}`);
      console.log(`    - No Placeholders: ${validations.noPlaceholders ? '✓' : '✗'}`);

      // Test 4: Component Type Validation
      const componentTypes = parseResult.components.map(c => c.component);
      const hasExpectedComponents = scenario.expectedComponents.every(expected => 
        componentTypes.includes(expected)
      );

      // Test 5: Data Table Validation
      const dataTables = parseResult.components.filter(c => c.component === 'data_table');
      const totalTableRows = dataTables.reduce((sum, table) => sum + (table.data.rows?.length || 0), 0);

      // Test 6: Header Count Validation
      const sectionHeaders = parseResult.components.filter(c => c.component === 'section_header');

      console.log(`  🎯 Component Validation:`);
      console.log(`    - Expected Components: ${hasExpectedComponents ? '✓' : '✗'}`);
      console.log(`    - Table Rows: ${totalTableRows}/${scenario.expectedTableRows} ${totalTableRows === scenario.expectedTableRows ? '✓' : '✗'}`);
      console.log(`    - Headers: ${sectionHeaders.length}/${scenario.expectedHeaders} ${sectionHeaders.length === scenario.expectedHeaders ? '✓' : '✗'}`);

      // Test 7: Performance Check
      const startTime = performance.now();
      parseUIComponents(scenario.input);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      const performanceOk = processingTime < 1000; // Should complete within 1 second

      console.log(`  ⚡ Performance:`);
      console.log(`    - Processing Time: ${processingTime.toFixed(2)}ms ${performanceOk ? '✓' : '✗'}`);

      // Overall test result
      const allChecks = [
        parseResult.success,
        hasExpectedComponents,
        totalTableRows === scenario.expectedTableRows,
        sectionHeaders.length === scenario.expectedHeaders,
        validations.noPlaceholders,
        performanceOk
      ];

      const testPassed = allChecks.every(check => check);
      
      if (testPassed) {
        passedTests++;
        results.push({ name: scenario.name, status: 'PASS', details: 'All checks passed' });
        console.log(`  🎉 Result: PASS\n`);
      } else {
        const failedChecks = [];
        if (!parseResult.success) failedChecks.push('Parsing failed');
        if (!hasExpectedComponents) failedChecks.push('Missing expected components');
        if (totalTableRows !== scenario.expectedTableRows) failedChecks.push('Incorrect table row count');
        if (sectionHeaders.length !== scenario.expectedHeaders) failedChecks.push('Incorrect header count');
        if (!validations.noPlaceholders) failedChecks.push('Contains template placeholders');
        if (!performanceOk) failedChecks.push('Performance too slow');
        
        results.push({ name: scenario.name, status: 'FAIL', details: failedChecks.join(', ') });
        console.log(`  ❌ Result: FAIL (${failedChecks.join(', ')})\n`);
      }

    } catch (error) {
      results.push({ name: scenario.name, status: 'FAIL', details: `Error: ${error.message}` });
      console.log(`  ❌ Result: FAIL (Error: ${error.message})\n`);
    }
  }

  // Summary Report
  console.log('📊 Test Summary Report');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

  // Detailed Results
  console.log('📋 Detailed Results:');
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.status === 'FAIL') {
      console.log(`   └─ ${result.details}`);
    }
  });

  // Exit with appropriate code
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Formatting pipeline is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
    process.exit(1);
  }
}

// Run the tests
if (import.meta.main) {
  runFormattingPipelineTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}
