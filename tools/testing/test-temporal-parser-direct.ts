#!/usr/bin/env -S deno run --allow-all

/**
 * Test the temporal parser directly to verify date range calculation
 */

// Import the temporal parser
import { parseTemporalQuery } from '../../supabase/functions/_shared/temporal-parser.ts';

async function testTemporalParser() {
  console.log('🔍 Testing Temporal Parser Directly');
  console.log('=' .repeat(50));
  
  const testQueries = [
    "show me all receipts from last week",
    "all receipts from last week",
    "receipts last week",
    "last week receipts"
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Testing Query: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      const result = await parseTemporalQuery(query);
      
      console.log('📊 Parsing Result:');
      console.log(`  - Is Temporal Query: ${result.isTemporal}`);
      console.log(`  - Routing Strategy: ${result.routingStrategy}`);
      console.log(`  - Has Semantic Content: ${result.hasSemanticContent}`);
      console.log(`  - Semantic Terms: ${JSON.stringify(result.semanticTerms)}`);
      console.log(`  - Temporal Confidence: ${result.temporalConfidence}`);
      
      if (result.dateRange) {
        console.log('📅 Date Range:');
        console.log(`  - Start: ${result.dateRange.start}`);
        console.log(`  - End: ${result.dateRange.end}`);
        console.log(`  - Preset: ${result.dateRange.preset}`);
        
        // Calculate days in range
        const startDate = new Date(result.dateRange.start);
        const endDate = new Date(result.dateRange.end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
        console.log(`  - Days in range: ${diffDays}`);
      }
      
      console.log(`🎯 Query Type: ${result.queryType}`);
      console.log(`📊 Confidence: ${result.confidence}`);
      
    } catch (error) {
      console.error(`❌ Error parsing query: ${error.message}`);
    }
  }
}

// Run the test
await testTemporalParser();
