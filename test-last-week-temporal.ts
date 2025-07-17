#!/usr/bin/env -S deno run --allow-all

import { parseTemporalQuery } from './supabase/functions/_shared/temporal-parser.ts';

/**
 * Test temporal parsing specifically for "last week" queries
 */
function testLastWeekTemporal() {
  console.log('🧪 Testing Last Week Temporal Parsing\n');

  const testQueries = [
    "show me all receipts from last week",
    "last week's receipts", 
    "receipts from last week",
    "find receipts from last week",
    "last week receipts"
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    console.log('=' .repeat(60));
    
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
        
        // Calculate the number of days in the range
        const startDate = new Date(result.dateRange.start);
        const endDate = new Date(result.dateRange.end);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        console.log('  - Days in range:', daysDiff);
        
        // Check if this is a large date range that might cause performance issues
        if (daysDiff > 7) {
          console.log('⚠️  WARNING: Large date range detected - this might cause performance issues');
        }
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
  testLastWeekTemporal();
}
