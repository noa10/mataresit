#!/usr/bin/env node

// Test script to simulate the chatbot query "find me receipts over 200"
// This will help us verify that the fix is working correctly

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_KEY) {
  console.error('❌ Either SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

// Use service key if available for testing, otherwise anon key
const authKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

async function testChatbotQuery() {
  console.log('🧪 Testing chatbot query: "find me receipts over 200"');
  console.log('🔗 Supabase URL:', SUPABASE_URL);
  
  const query = "find me receipts over 200";
  const requestBody = {
    query: query,
    sources: ['receipt'],
    limit: 20,
    offset: 0,
    filters: {},
    similarityThreshold: 0.2,
    includeMetadata: true,
    aggregationMode: 'relevance',
    useEnhancedPrompting: true, // Force enhanced search path
    conversationHistory: []
  };

  console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': authKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Response received');
    console.log('📊 Results summary:', {
      success: result.success,
      totalResults: result.results?.length || 0,
      hasResults: (result.results?.length || 0) > 0,
      queryType: result.metadata?.queryType,
      searchMethod: result.metadata?.searchMethod,
      processingTime: result.metadata?.processingTime
    });

    if (result.results && result.results.length > 0) {
      console.log('💰 Found receipts over 200:');
      result.results.forEach((receipt, index) => {
        console.log(`  ${index + 1}. ${receipt.metadata?.merchant || 'Unknown'} - ${receipt.metadata?.currency || 'MYR'} ${receipt.metadata?.total || 'N/A'} (${receipt.metadata?.date || 'No date'})`);
      });
    } else {
      console.log('❌ No results found - this indicates the issue is not fully resolved');
    }

    // Log the full response for debugging
    console.log('\n🔍 Full response for debugging:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error testing chatbot query:', error);
  }
}

// Run the test
testChatbotQuery().catch(console.error);
