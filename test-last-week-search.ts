#!/usr/bin/env -S deno run --allow-all

/**
 * Test the "last week" temporal search to identify accuracy issues
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLastWeekSearch() {
  console.log('🧪 Testing "Last Week" Temporal Search Accuracy');
  console.log('===============================================\n');

  // First, let's check what receipts exist in the expected date range
  console.log('📊 Step 1: Checking receipts in expected "last week" range (2025-07-06 to 2025-07-13)');

  const { data: expectedReceipts, error: dbError } = await supabase
    .from('receipts')
    .select('id, merchant, total, currency, date, created_at, status')
    .gte('date', '2025-07-06')
    .lte('date', '2025-07-13')
    .order('date', { ascending: false });

  if (dbError) {
    console.error('❌ Database query failed:', dbError);
    return;
  }

  console.log(`📋 Found ${expectedReceipts?.length || 0} receipts in expected date range:`);
  expectedReceipts?.slice(0, 10).forEach((receipt, index) => {
    console.log(`  ${index + 1}. ${receipt.merchant} - ${receipt.total} ${receipt.currency} (${receipt.date})`);
  });

  if (expectedReceipts && expectedReceipts.length > 10) {
    console.log(`  ... and ${expectedReceipts.length - 10} more receipts`);
  }

  // Now test the temporal search
  console.log('\n🔍 Step 2: Testing temporal search with "show me all receipts from last week"');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        query: 'show me all receipts from last week',
        limit: 50, // Request more results to see if it's a limit issue
        sources: ['receipt'],
        contentTypes: ['receipt']
      })
    });

    if (!response.ok) {
      console.error('❌ Search request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const searchResult = await response.json();
    console.log('✅ Search completed successfully');
    console.log(`📊 Search returned ${searchResult.results?.length || 0} results`);

    if (searchResult.results && searchResult.results.length > 0) {
      console.log('\n📋 Search Results:');
      searchResult.results.forEach((result: any, index: number) => {
        const merchant = result.metadata?.merchant || result.title || 'Unknown';
        const amount = result.metadata?.total || 'N/A';
        const currency = result.metadata?.currency || '';
        const date = result.metadata?.date || result.createdAt || 'N/A';
        console.log(`  ${index + 1}. ${merchant} - ${amount} ${currency} (${date})`);
      });
    } else {
      console.log('❌ No results returned from search');
    }

    // Compare results
    console.log('\n🔍 Step 3: Analyzing result accuracy');
    const expectedCount = expectedReceipts?.length || 0;
    const actualCount = searchResult.results?.length || 0;

    console.log(`📊 Expected receipts in range: ${expectedCount}`);
    console.log(`📊 Actual search results: ${actualCount}`);

    if (actualCount < expectedCount) {
      console.log(`⚠️  Missing ${expectedCount - actualCount} receipts from search results`);
      console.log('🔍 This indicates a temporal search accuracy issue');
    } else if (actualCount === expectedCount) {
      console.log('✅ Search returned the expected number of results');
    } else {
      console.log(`⚠️  Search returned more results than expected (possible date range issue)`);
    }

    // Check metadata for debugging
    if (searchResult.metadata) {
      console.log('\n🔧 Search Metadata:');
      console.log('  - Search Method:', searchResult.metadata.searchMethod || 'unknown');
      console.log('  - Temporal Routing:', searchResult.metadata.temporalRouting || 'unknown');
      console.log('  - Processing Time:', searchResult.metadata.processingTime || 'unknown');
      console.log('  - Date Range Used:', searchResult.metadata.dateRange || 'unknown');
    }

  } catch (error) {
    console.error('❌ Search test failed:', error);
  }
}

if (import.meta.main) {
  testLastWeekSearch();
}