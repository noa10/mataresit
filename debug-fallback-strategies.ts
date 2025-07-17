#!/usr/bin/env -S deno run --allow-all

/**
 * Debug the fallback strategies to see what date ranges they generate
 */

function debugFallbackStrategies() {
  console.log('🔍 Debugging Fallback Strategies');
  console.log('=' .repeat(50));
  
  const now = new Date();
  console.log(`📅 Current Date: ${now.toISOString()}`);
  console.log(`📅 Current Date (local): ${now.toISOString().split('T')[0]}`);
  console.log('');
  
  // Define fallback strategies (copied from the code)
  const fallbackStrategies = [
    {
      name: 'last_2_months',
      getDateRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      name: 'last_3_months',
      getDateRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        };
      }
    },
    {
      name: 'recent_receipts',
      getDateRange: () => {
        const now = new Date();
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        return {
          start: start.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        };
      }
    }
  ];
  
  console.log('📊 Fallback Strategy Results:');
  fallbackStrategies.forEach((strategy, index) => {
    const dateRange = strategy.getDateRange();
    console.log(`${index + 1}. ${strategy.name}:`);
    console.log(`   - Start: ${dateRange.start}`);
    console.log(`   - End: ${dateRange.end}`);
    
    // Check if this matches the screenshot range
    const isScreenshotRange = dateRange.start === '2025-07-10' && dateRange.end === '2025-07-11';
    console.log(`   - Matches Screenshot (July 10-11): ${isScreenshotRange ? '⚠️ MATCH!' : '✅'}`);
    console.log('');
  });
  
  // Check if any of these could result in July 10-11
  console.log('🎯 Analysis:');
  console.log('- None of the fallback strategies should result in July 10-11, 2025');
  console.log('- The issue must be elsewhere in the pipeline');
  console.log('');
  
  // Let's also check what happens if we manually calculate recent dates
  console.log('🧮 Manual Recent Date Calculations:');
  
  // Check last few days
  for (let i = 1; i <= 7; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    console.log(`- ${i} day(s) ago: ${dateStr}`);
    
    if (dateStr === '2025-07-10' || dateStr === '2025-07-11') {
      console.log(`  ⚠️ This matches the screenshot range!`);
    }
  }
}

// Run the debug
debugFallbackStrategies();
