#!/usr/bin/env -S deno run --allow-all

/**
 * Debug the temporal pattern matching to see which pattern is being matched
 */

// Import the temporal parser
import { parseTemporalQuery } from '../../supabase/functions/_shared/temporal-parser.ts';

async function debugPatternMatching() {
  console.log('🔍 Debugging Temporal Pattern Matching');
  console.log('=' .repeat(60));
  
  const testQuery = "show me all receipts from last week";
  
  console.log(`📝 Query: "${testQuery}"`);
  console.log('');
  
  // Test different variations to see which patterns match
  const testQueries = [
    "show me all receipts from last week",
    "all receipts from last week", 
    "receipts from last week",
    "last week receipts",
    "receipts last week",
    "recent receipts",
    "latest receipts"
  ];
  
  for (const query of testQueries) {
    console.log(`\n🧪 Testing: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      const result = await parseTemporalQuery(query);
      
      console.log('📊 Result:');
      console.log(`  - Query Type: ${result.queryType}`);
      console.log(`  - Confidence: ${result.confidence}`);
      
      if (result.dateRange) {
        console.log('📅 Date Range:');
        console.log(`  - Start: ${result.dateRange.start}`);
        console.log(`  - End: ${result.dateRange.end}`);
        console.log(`  - Preset: ${result.dateRange.preset}`);
        
        // Check if this matches the screenshot
        const isScreenshotRange = result.dateRange.start === '2025-07-10' && result.dateRange.end === '2025-07-11';
        const isCorrectRange = result.dateRange.start === '2025-07-07' && result.dateRange.end === '2025-07-13';
        
        console.log(`  - Matches Expected (July 7-13): ${isCorrectRange ? '✅' : '❌'}`);
        console.log(`  - Matches Screenshot (July 10-11): ${isScreenshotRange ? '⚠️ ISSUE!' : '✅'}`);
      }
      
      if (result.temporalIntent) {
        console.log('🕐 Temporal Intent:');
        console.log(`  - Is Temporal: ${result.temporalIntent.isTemporalQuery}`);
        console.log(`  - Strategy: ${result.temporalIntent.routingStrategy}`);
        console.log(`  - Confidence: ${result.temporalIntent.temporalConfidence}`);
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  // Let's also manually check what patterns would match
  console.log('\n🔍 Manual Pattern Analysis:');
  console.log('=' .repeat(40));
  
  const patterns = [
    { name: 'last week', regex: /\blast\s+week\b/i },
    { name: 'recent receipts', regex: /\b(recent|latest|last)\s+(receipts?|purchases?|expenses?)\b/i },
    { name: 'from last week', regex: /\bfrom\s+last\s+week\b/i },
    { name: 'receipts from', regex: /\breceipts?\s+from\b/i }
  ];
  
  const testQuery2 = "show me all receipts from last week";
  console.log(`\nTesting patterns against: "${testQuery2}"`);
  
  patterns.forEach(pattern => {
    const match = testQuery2.match(pattern.regex);
    console.log(`- ${pattern.name}: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    if (match) {
      console.log(`  Matched text: "${match[0]}"`);
    }
  });
}

// Run the debug
await debugPatternMatching();
