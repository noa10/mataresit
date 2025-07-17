#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to directly call the unified-search edge function
 * and analyze the temporal search results for "last week" queries
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testTemporalSearch() {
  console.log('🔍 Testing Temporal Search for "last week" queries');
  console.log('=' .repeat(60));
  
  const testQuery = "show me all receipts from last week";
  
  try {
    console.log(`📝 Query: "${testQuery}"`);
    console.log(`📅 Expected Date Range: 2025-07-07 to 2025-07-13`);
    console.log(`📊 Expected Results: 32 receipts`);
    console.log('');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        query: testQuery,
        limit: 50, // Increase limit to see if that's the issue
        debug: true
      })
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      return;
    }
    
    const result = await response.json();
    
    console.log('📊 Search Results:');
    console.log(`- Total Results: ${result.results?.length || 0}`);
    console.log(`- Search Strategy: ${result.metadata?.searchStrategy || 'unknown'}`);
    console.log(`- Query Type: ${result.metadata?.queryType || 'unknown'}`);
    console.log(`- Temporal Confidence: ${result.metadata?.temporalConfidence || 'unknown'}`);
    
    if (result.metadata?.dateRange) {
      console.log(`- Date Range Used: ${result.metadata.dateRange.start} to ${result.metadata.dateRange.end}`);
      console.log(`- Date Range Preset: ${result.metadata.dateRange.preset}`);
    }
    
    if (result.metadata?.processingTime) {
      console.log(`- Processing Time: ${result.metadata.processingTime}ms`);
    }
    
    console.log('');
    
    if (result.results && result.results.length > 0) {
      console.log('📋 Receipt Details:');
      result.results.forEach((receipt: any, index: number) => {
        console.log(`${index + 1}. ${receipt.merchant} - ${receipt.currency} ${receipt.total} (${receipt.date})`);
      });
      
      // Analyze date distribution
      const dateDistribution: Record<string, number> = {};
      result.results.forEach((receipt: any) => {
        const date = receipt.date;
        dateDistribution[date] = (dateDistribution[date] || 0) + 1;
      });
      
      console.log('');
      console.log('📅 Date Distribution:');
      Object.entries(dateDistribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`- ${date}: ${count} receipt(s)`);
        });
    } else {
      console.log('❌ No results returned');
    }
    
    // Check for any debug information
    if (result.debug) {
      console.log('');
      console.log('🔧 Debug Information:');
      console.log(JSON.stringify(result.debug, null, 2));
    }
    
    // Check for any errors
    if (result.error) {
      console.log('');
      console.log('❌ Error Information:');
      console.log(JSON.stringify(result.error, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
await testTemporalSearch();
