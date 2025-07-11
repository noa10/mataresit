#!/usr/bin/env tsx

/**
 * Performance Validation Suite
 * 
 * Comprehensive performance testing for the optimized formatting pipeline.
 * Validates all performance improvements and optimizations.
 */

import { performance } from 'perf_hooks';
import { parseUIComponents, parseUIComponentsWithOptions } from '../src/lib/ui-component-parser';

// Test data generators
function generateLargeTable(rows: number, columns: number = 5): string {
  const headers = Array.from({ length: columns }, (_, i) => `Column ${i + 1}`);
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `|${headers.map(() => '---').join('|')}|`;
  
  const dataRows = Array.from({ length: rows }, (_, i) => 
    `| ${Array.from({ length: columns }, (_, j) => `Data ${i + 1}-${j + 1}`).join(' | ')} |`
  );
  
  return `# Large Table Test\n\n${headerRow}\n${separatorRow}\n${dataRows.join('\n')}`;
}

function generateComplexContent(sections: number = 10): string {
  let content = '# Complex Content Test\n\n';
  
  for (let i = 1; i <= sections; i++) {
    content += `## Section ${i}\n\n`;
    content += `This is section ${i} with some content.\n\n`;
    
    // Add a table every few sections
    if (i % 3 === 0) {
      content += `| Item | Value | Status |\n|------|-------|--------|\n`;
      for (let j = 1; j <= 5; j++) {
        content += `| Item ${j} | Value ${j} | Active |\n`;
      }
      content += '\n';
    }
    
    // Add a list
    content += `### Key Points\n`;
    for (let k = 1; k <= 3; k++) {
      content += `• Point ${k} for section ${i}\n`;
    }
    content += '\n';
  }
  
  return content;
}

// Performance test cases
interface PerformanceTest {
  name: string;
  content: string;
  expectedParseTime: number; // milliseconds
  expectedComponentCount: number;
  description: string;
}

const performanceTests: PerformanceTest[] = [
  {
    name: 'Small Table (10 rows)',
    content: generateLargeTable(10),
    expectedParseTime: 50,
    expectedComponentCount: 2, // header + table
    description: 'Basic table parsing performance'
  },
  {
    name: 'Medium Table (100 rows)',
    content: generateLargeTable(100),
    expectedParseTime: 200,
    expectedComponentCount: 2,
    description: 'Medium table with pagination'
  },
  {
    name: 'Large Table (1000 rows)',
    content: generateLargeTable(1000),
    expectedParseTime: 800,
    expectedComponentCount: 2,
    description: 'Large table with virtualization'
  },
  {
    name: 'Complex Content (10 sections)',
    content: generateComplexContent(10),
    expectedParseTime: 300,
    expectedComponentCount: 15, // headers + tables + content
    description: 'Mixed content with multiple components'
  },
  {
    name: 'Complex Content (50 sections)',
    content: generateComplexContent(50),
    expectedParseTime: 1000,
    expectedComponentCount: 70,
    description: 'Large mixed content document'
  }
];

// Cache performance test
async function testCachePerformance(): Promise<void> {
  console.log('🔄 Testing Cache Performance\n');
  
  const testContent = generateLargeTable(50);
  const iterations = 10;
  
  // First parse (cache miss)
  const startTime1 = performance.now();
  const result1 = parseUIComponents(testContent);
  const endTime1 = performance.now();
  const firstParseTime = endTime1 - startTime1;
  
  console.log(`  📊 First Parse (Cache Miss): ${firstParseTime.toFixed(2)}ms`);
  
  // Subsequent parses (cache hits)
  const cacheTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    parseUIComponents(testContent);
    const endTime = performance.now();
    cacheTimes.push(endTime - startTime);
  }
  
  const averageCacheTime = cacheTimes.reduce((sum, time) => sum + time, 0) / cacheTimes.length;
  const speedupRatio = firstParseTime / averageCacheTime;
  
  console.log(`  ⚡ Average Cache Hit: ${averageCacheTime.toFixed(2)}ms`);
  console.log(`  🚀 Speedup Ratio: ${speedupRatio.toFixed(1)}x faster`);
  console.log(`  ✅ Cache Performance: ${speedupRatio > 5 ? 'EXCELLENT' : speedupRatio > 2 ? 'GOOD' : 'NEEDS IMPROVEMENT'}\n`);
}

// Memory usage test
async function testMemoryUsage(): Promise<void> {
  console.log('💾 Testing Memory Usage\n');
  
  const initialMemory = (process.memoryUsage().heapUsed / 1024 / 1024);
  console.log(`  📊 Initial Memory: ${initialMemory.toFixed(2)} MB`);
  
  // Parse multiple large documents
  const documents = Array.from({ length: 20 }, () => generateComplexContent(20));
  
  for (let i = 0; i < documents.length; i++) {
    parseUIComponents(documents[i]);
    
    if (i % 5 === 0) {
      const currentMemory = (process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`  📈 After ${i + 1} documents: ${currentMemory.toFixed(2)} MB`);
    }
  }
  
  const finalMemory = (process.memoryUsage().heapUsed / 1024 / 1024);
  const memoryIncrease = finalMemory - initialMemory;
  
  console.log(`  📊 Final Memory: ${finalMemory.toFixed(2)} MB`);
  console.log(`  📈 Memory Increase: ${memoryIncrease.toFixed(2)} MB`);
  console.log(`  ✅ Memory Efficiency: ${memoryIncrease < 50 ? 'EXCELLENT' : memoryIncrease < 100 ? 'GOOD' : 'NEEDS IMPROVEMENT'}\n`);
}

// Row limit optimization test
async function testRowLimitOptimization(): Promise<void> {
  console.log('📊 Testing Row Limit Optimization\n');
  
  const testCases = [
    { rows: 50, limit: 25, shouldTruncate: true },
    { rows: 100, limit: 150, shouldTruncate: false },
    { rows: 500, limit: 100, shouldTruncate: true }
  ];
  
  for (const testCase of testCases) {
    const content = generateLargeTable(testCase.rows);
    const result = parseUIComponentsWithOptions(content, {
      tableRowLimit: testCase.limit
    });
    
    const tableComponent = result.components.find(c => c.component === 'data_table');
    if (tableComponent) {
      const actualRows = tableComponent.data.rows.length;
      const expectedRows = testCase.shouldTruncate ? testCase.limit : testCase.rows;
      const hasPagination = tableComponent.data.pagination;
      
      console.log(`  📋 ${testCase.rows} rows, limit ${testCase.limit}:`);
      console.log(`    - Actual rows: ${actualRows}`);
      console.log(`    - Expected rows: ${expectedRows}`);
      console.log(`    - Pagination: ${hasPagination ? 'Enabled' : 'Disabled'}`);
      console.log(`    - Status: ${actualRows === expectedRows ? '✅ PASS' : '❌ FAIL'}\n`);
    }
  }
}

// Main performance validation
async function runPerformanceValidation(): Promise<void> {
  console.log('🚀 Starting Performance Validation Suite\n');
  console.log('=' .repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Run individual performance tests
  console.log('\n📋 Individual Performance Tests\n');
  
  for (const test of performanceTests) {
    totalTests++;
    console.log(`🧪 Testing: ${test.name}`);
    console.log(`   Description: ${test.description}`);
    
    const startTime = performance.now();
    const result = parseUIComponents(test.content);
    const endTime = performance.now();
    
    const parseTime = endTime - startTime;
    const componentCount = result.components.length;
    
    console.log(`   📊 Parse Time: ${parseTime.toFixed(2)}ms (target: <${test.expectedParseTime}ms)`);
    console.log(`   🔧 Components: ${componentCount} (expected: ~${test.expectedComponentCount})`);
    console.log(`   📝 Content Length: ${test.content.length} characters`);
    
    const timePass = parseTime <= test.expectedParseTime;
    const componentPass = Math.abs(componentCount - test.expectedComponentCount) <= 2; // Allow some variance
    const overallPass = timePass && componentPass && result.success;
    
    if (overallPass) {
      passedTests++;
      console.log(`   ✅ Result: PASS\n`);
    } else {
      const issues = [];
      if (!timePass) issues.push('Parse time exceeded');
      if (!componentPass) issues.push('Component count mismatch');
      if (!result.success) issues.push('Parse failed');
      console.log(`   ❌ Result: FAIL (${issues.join(', ')})\n`);
    }
  }
  
  // Run specialized tests
  await testCachePerformance();
  await testMemoryUsage();
  await testRowLimitOptimization();
  
  // Performance regression test
  console.log('🔄 Performance Regression Test\n');
  const regressionContent = generateLargeTable(200);
  const regressionTimes: number[] = [];
  
  for (let i = 0; i < 10; i++) {
    const startTime = performance.now();
    parseUIComponents(regressionContent);
    const endTime = performance.now();
    regressionTimes.push(endTime - startTime);
  }
  
  const averageTime = regressionTimes.reduce((sum, time) => sum + time, 0) / regressionTimes.length;
  const maxTime = Math.max(...regressionTimes);
  const minTime = Math.min(...regressionTimes);
  const variance = Math.sqrt(regressionTimes.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / regressionTimes.length);
  
  console.log(`  📊 Average Time: ${averageTime.toFixed(2)}ms`);
  console.log(`  📈 Max Time: ${maxTime.toFixed(2)}ms`);
  console.log(`  📉 Min Time: ${minTime.toFixed(2)}ms`);
  console.log(`  📊 Variance: ${variance.toFixed(2)}ms`);
  console.log(`  ✅ Consistency: ${variance < 50 ? 'EXCELLENT' : variance < 100 ? 'GOOD' : 'NEEDS IMPROVEMENT'}\n`);
  
  // Final summary
  console.log('=' .repeat(60));
  console.log('📊 Performance Validation Summary');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All performance tests passed! The formatting pipeline is optimized and ready for production.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some performance tests failed. Please review the optimization implementation.');
    process.exit(1);
  }
}

// Run the validation
if (import.meta.main) {
  runPerformanceValidation().catch(error => {
    console.error('❌ Performance validation failed:', error);
    process.exit(1);
  });
}
