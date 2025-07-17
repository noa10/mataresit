#!/usr/bin/env -S deno run --allow-all

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE0NjI1ODksImV4cCI6MjAyNzAzODU4OX0.Ej_2Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Test the temporal search fix
 */
async function testTemporalSearchFix() {
  console.log('🧪 Testing Temporal Search Fix\n');

  // Test query: "yesterday's receipts"
  const testQuery = "yesterday's receipts";
  console.log(`📝 Testing query: "${testQuery}"`);
  console.log('=' .repeat(50));

  try {
    // Call the unified-search function
    const { data, error } = await supabase.functions.invoke('unified-search', {
      body: {
        query: testQuery,
        sources: ['receipt'],
        limit: 20
      }
    });

    if (error) {
      console.error('❌ Error calling unified-search:', error);
      return;
    }

    console.log('✅ Search completed successfully');
    console.log('📊 Results:', {
      success: data.success,
      totalResults: data.totalResults,
      resultsCount: data.results?.length || 0,
      searchMetadata: data.searchMetadata
    });

    if (data.results && data.results.length > 0) {
      console.log('\n📋 Found receipts:');
      data.results.forEach((result: any, index: number) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     Date: ${result.metadata?.date || 'Unknown'}`);
        console.log(`     Similarity: ${result.similarity || 'N/A'}`);
      });
    } else {
      console.log('❌ No results found');

      if (data.smartSuggestions) {
        console.log('\n💡 Smart suggestions:', data.smartSuggestions);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (import.meta.main) {
  testTemporalSearchFix();
}