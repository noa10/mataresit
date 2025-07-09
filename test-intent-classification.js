/**
 * Test the intent classification fix for temporal queries
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU5MzE1NzQsImV4cCI6MjAzMTUwNzU3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8";

async function testIntentClassification() {
  console.log('🧪 Testing Intent Classification Fix');
  console.log('===================================');
  
  const testQueries = [
    {
      query: "Show me all receipts from last month",
      expectedIntent: "document_retrieval",
      description: "Should be document_retrieval, not financial_analysis"
    },
    {
      query: "Find receipts from this week", 
      expectedIntent: "document_retrieval",
      description: "Should be document_retrieval"
    },
    {
      query: "How much did I spend last month?",
      expectedIntent: "financial_analysis", 
      description: "Should be financial_analysis"
    },
    {
      query: "What are my spending trends?",
      expectedIntent: "financial_analysis",
      description: "Should be financial_analysis"
    }
  ];

  for (const test of testQueries) {
    console.log(`\n🔍 Testing: "${test.query}"`);
    console.log(`📝 Expected Intent: ${test.expectedIntent}`);
    console.log(`📋 Description: ${test.description}`);
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
        const errorText = await response.text();
        console.log(`Error details: ${errorText}`);
        continue;
      }

      const result = await response.json();
      
      // Extract intent from the response metadata
      const actualIntent = result.metadata?.llmPreprocessing?.intent || 'unknown';
      const temporalRouting = result.metadata?.temporalRouting;
      
      console.log(`✅ Response received`);
      console.log(`🎯 Actual Intent: ${actualIntent}`);
      console.log(`📅 Temporal Query: ${temporalRouting?.isTemporalQuery || false}`);
      console.log(`🔀 Routing Strategy: ${temporalRouting?.routingStrategy || 'none'}`);
      console.log(`📊 Results Count: ${result.results?.length || 0}`);
      
      if (actualIntent === test.expectedIntent) {
        console.log(`✅ INTENT CLASSIFICATION CORRECT!`);
      } else {
        console.log(`❌ INTENT CLASSIFICATION WRONG! Expected: ${test.expectedIntent}, Got: ${actualIntent}`);
      }
      
      // Log any fallback information
      if (result.results && result.results.length > 0) {
        const hasFallback = result.results.some(r => r.metadata?.fallbackStrategy);
        if (hasFallback) {
          console.log(`🔄 Fallback strategy used`);
        }
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Run the test
testIntentClassification().catch(console.error);
