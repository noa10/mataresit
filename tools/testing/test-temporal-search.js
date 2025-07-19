#!/usr/bin/env node

/**
 * Test script to verify temporal search functionality
 * Tests "yesterday's receipts" and other temporal queries
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testTemporalSearch() {
  console.log('🧪 Testing temporal search functionality...\n');

  const testQueries = [
    "show me yesterday's receipts",
    "find receipts from yesterday", 
    "yesterday's expenses",
    "receipts from last week",
    "show me today's receipts"
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    console.log('=' .repeat(50));

    try {
      const { data, error } = await supabase.functions.invoke('unified-search', {
        body: {
          query: query,
          sources: ['receipt'],
          limit: 5
        }
      });

      if (error) {
        console.error('❌ Error:', error);
        continue;
      }

      console.log('✅ Response received');
      console.log('📊 Results count:', data?.results?.length || 0);
      
      if (data?.metadata?.temporalParsing) {
        console.log('📅 Temporal parsing:');
        console.log('  - Query type:', data.metadata.temporalParsing.queryType);
        console.log('  - Date range:', data.metadata.temporalParsing.dateRange);
        console.log('  - Temporal intent:', data.metadata.temporalParsing.temporalIntent?.routingStrategy);
      }

      if (data?.metadata?.filters) {
        console.log('🔧 Applied filters:');
        console.log('  - Start date:', data.metadata.filters.startDate);
        console.log('  - End date:', data.metadata.filters.endDate);
        console.log('  - Date range object:', data.metadata.filters.dateRange);
      }

      if (data?.results && data.results.length > 0) {
        console.log('📋 Sample results:');
        data.results.slice(0, 2).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.metadata?.merchant || 'Unknown'} - ${result.metadata?.date || 'No date'} - ${result.metadata?.total || 'No amount'}`);
        });
      } else {
        console.log('⚠️  No results found');
      }

    } catch (err) {
      console.error('❌ Request failed:', err.message);
    }
  }
}

// Run the test
testTemporalSearch().catch(console.error);
