// Test script to verify temporal search fixes
// This script tests the temporal search functionality after the fixes

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE0NzQsImV4cCI6MjA1MDAwNzQ3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8";

async function testTemporalSearchFix() {
  console.log('🧪 TESTING TEMPORAL SEARCH FIXES');
  console.log('=================================\n');

  const testQueries = [
    {
      query: 'receipts from 3 days ago',
      description: 'Original problematic query - should return exact receipts from 3 days ago',
      expectedBehavior: 'Should detect as temporal query and return receipts from exactly 3 days ago'
    },
    {
      query: 'find receipts from 2 days ago',
      description: 'Similar query with "find" prefix',
      expectedBehavior: 'Should detect as temporal query and return receipts from exactly 2 days ago'
    },
    {
      query: '1 day ago',
      description: 'Simple "X days ago" format',
      expectedBehavior: 'Should detect as temporal query and return receipts from exactly 1 day ago'
    },
    {
      query: 'yesterday',
      description: 'Basic temporal query',
      expectedBehavior: 'Should detect as temporal query and return yesterday\'s receipts'
    },
    {
      query: 'last week',
      description: 'Week-based temporal query',
      expectedBehavior: 'Should detect as temporal query and return receipts from last week'
    }
  ];

  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    console.log(`📝 Description: ${test.description}`);
    console.log(`🎯 Expected: ${test.expectedBehavior}`);
    console.log('─'.repeat(80));

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          query: test.query,
          sources: ['receipts'],
          limit: 10
        })
      });

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const result = await response.json();

      console.log(`📊 Results:`);
      console.log(`   - Success: ${result.success}`);
      console.log(`   - Total results: ${result.results?.length || 0}`);
      console.log(`   - UI components: ${result.uiComponents?.length || 0}`);

      if (result.searchMetadata) {
        console.log(`   - Search duration: ${result.searchMetadata.searchDuration || 'N/A'}ms`);
        console.log(`   - Sources searched: ${result.searchMetadata.sourcesSearched?.join(', ') || 'N/A'}`);
        console.log(`   - Temporal routing: ${result.searchMetadata.temporalRouting ? 'YES' : 'NO'}`);
      }

      // Check if temporal routing was applied
      const hasTemporalRouting = result.searchMetadata?.temporalRouting ||
                                result.searchMetadata?.routingStrategy?.includes('temporal');

      if (hasTemporalRouting) {
        console.log(`✅ TEMPORAL ROUTING DETECTED - Fix is working!`);
      } else {
        console.log(`❌ NO TEMPORAL ROUTING - Fix may not be working`);
      }

      // Check UI components
      if (result.uiComponents && result.uiComponents.length > 0) {
        const receiptCards = result.uiComponents.filter(c => c.component === 'receipt_card');
        console.log(`   - Receipt cards: ${receiptCards.length}`);
        if (receiptCards.length > 0) {
          console.log(`✅ RECEIPT CARDS DISPLAYED - Frontend fix is working!`);
        }
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n📋 SUMMARY');
  console.log('===========');
  console.log('Key indicators of successful fixes:');
  console.log('1. ✅ Temporal routing detected for "X days ago" queries');
  console.log('2. ✅ Receipt cards displayed (not limited to 3)');
  console.log('3. ✅ Exact date matching (not date ranges)');
  console.log('\nIf you see these indicators, the temporal search fixes are working correctly!');
}

// Run the test
testTemporalSearchFix().catch(console.error);