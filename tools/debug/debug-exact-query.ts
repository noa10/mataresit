#!/usr/bin/env -S deno run --allow-all

/**
 * Debug the exact query from the screenshot to understand the date range issue
 */

// Import the temporal parser
import { parseTemporalQuery } from '../../supabase/functions/_shared/temporal-parser.ts';

async function debugExactQuery() {
  console.log('🔍 Debugging Exact Query from Screenshot');
  console.log('=' .repeat(60));
  
  const exactQuery = "show me all receipts from last week";
  
  console.log(`📝 Query: "${exactQuery}"`);
  console.log(`📅 Current Date: ${new Date().toISOString()}`);
  console.log(`📅 Expected Range: 2025-07-07 to 2025-07-13 (Monday to Sunday)`);
  console.log(`📅 Screenshot Shows: 10/07/2025 - 11/07/2025 (July 10-11)`);
  console.log('');
  
  try {
    const result = await parseTemporalQuery(exactQuery);
    
    console.log('📊 Temporal Parsing Result:');
    console.log(`  - Query Type: ${result.queryType}`);
    console.log(`  - Confidence: ${result.confidence}`);
    
    if (result.temporalIntent) {
      console.log('🕐 Temporal Intent:');
      console.log(`  - Is Temporal Query: ${result.temporalIntent.isTemporalQuery}`);
      console.log(`  - Routing Strategy: ${result.temporalIntent.routingStrategy}`);
      console.log(`  - Has Semantic Content: ${result.temporalIntent.hasSemanticContent}`);
      console.log(`  - Temporal Confidence: ${result.temporalIntent.temporalConfidence}`);
      console.log(`  - Semantic Terms: ${JSON.stringify(result.temporalIntent.semanticTerms)}`);
    }
    
    if (result.dateRange) {
      console.log('📅 Date Range:');
      console.log(`  - Start: ${result.dateRange.start}`);
      console.log(`  - End: ${result.dateRange.end}`);
      console.log(`  - Preset: ${result.dateRange.preset}`);
      
      // Calculate days in range
      const startDate = new Date(result.dateRange.start);
      const endDate = new Date(result.dateRange.end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      console.log(`  - Days in range: ${diffDays}`);
      
      // Check if this matches the screenshot
      const isCorrectRange = result.dateRange.start === '2025-07-07' && result.dateRange.end === '2025-07-13';
      const isScreenshotRange = result.dateRange.start === '2025-07-10' && result.dateRange.end === '2025-07-11';
      
      console.log('');
      console.log('🎯 Range Analysis:');
      console.log(`  - Matches Expected (July 7-13): ${isCorrectRange ? '✅' : '❌'}`);
      console.log(`  - Matches Screenshot (July 10-11): ${isScreenshotRange ? '⚠️ ISSUE!' : '✅'}`);
      
      if (!isCorrectRange) {
        console.log('');
        console.log('❌ DATE RANGE MISMATCH DETECTED!');
        console.log(`   Expected: 2025-07-07 to 2025-07-13`);
        console.log(`   Actual:   ${result.dateRange.start} to ${result.dateRange.end}`);
      }
    }
    
    console.log('');
    console.log('🔍 Additional Debug Info:');
    console.log(`  - Original Query: ${result.originalQuery}`);
    console.log(`  - Search Terms: ${JSON.stringify(result.searchTerms)}`);
    
    // Test the date calculation manually
    console.log('');
    console.log('🧮 Manual Date Calculation Check:');
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    console.log(`  - Current Day of Week: ${currentDay} (0=Sunday, 1=Monday, ..., 6=Saturday)`);
    console.log(`  - Current Date: ${now.toISOString().split('T')[0]}`);
    
    // Calculate start of this week (Monday)
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, it's 6 days from Monday
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - daysFromMonday);
    startOfThisWeek.setHours(0, 0, 0, 0);
    
    // Calculate start of last week (Monday of previous week)
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    
    // Calculate end of last week (Sunday of previous week)
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);
    
    console.log(`  - Manual Start of Last Week: ${startOfLastWeek.toISOString().split('T')[0]}`);
    console.log(`  - Manual End of Last Week: ${endOfLastWeek.toISOString().split('T')[0]}`);
    
    const manualMatches = result.dateRange?.start === startOfLastWeek.toISOString().split('T')[0] && 
                         result.dateRange?.end === endOfLastWeek.toISOString().split('T')[0];
    console.log(`  - Manual Calculation Matches Parser: ${manualMatches ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error(`❌ Error parsing query: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the debug
await debugExactQuery();
