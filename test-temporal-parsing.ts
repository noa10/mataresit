#!/usr/bin/env -S deno run --allow-all

import { parseTemporalQuery } from './supabase/functions/_shared/temporal-parser.ts';

/**
 * Test temporal parsing for various queries
 */
function testTemporalParsing() {
  console.log('🧪 Testing Temporal Parsing\n');

  const testQueries = [
    "yesterday's receipts",
    "show me yesterday's receipts", 
    "receipts from yesterday",
    "find receipts from last week",
    "last week's expenses",
    "show me receipts from June 27",
    "receipts from today",
    "this week's receipts"
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    console.log('=' .repeat(50));
    
    try {
      const result = parseTemporalQuery(query);
      
      console.log('🔍 Parsing Result:');
      console.log('  - Is Temporal Query:', result.temporalIntent?.isTemporalQuery || false);
      console.log('  - Routing Strategy:', result.temporalIntent?.routingStrategy || 'none');
      console.log('  - Has Semantic Content:', result.temporalIntent?.hasSemanticContent || false);
      console.log('  - Semantic Terms:', result.temporalIntent?.semanticTerms || []);
      console.log('  - Temporal Confidence:', result.temporalIntent?.temporalConfidence || 0);
      
      if (result.dateRange) {
        console.log('📅 Date Range:');
        console.log('  - Start:', result.dateRange.start);
        console.log('  - End:', result.dateRange.end);
        console.log('  - Preset:', result.dateRange.preset || 'none');
      } else {
        console.log('❌ No date range detected');
      }
      
      console.log('🎯 Query Type:', result.queryType || 'none');
      console.log('📊 Confidence:', result.confidence || 0);
      
    } catch (error) {
      console.error('❌ Error parsing query:', error.message);
    }
  }
}

if (import.meta.main) {
  testTemporalParsing();
}
