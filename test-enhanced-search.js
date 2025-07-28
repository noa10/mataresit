#!/usr/bin/env node

// Test script to verify the enhanced search fix for "find me receipts over 200"

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testEnhancedSearch() {
  console.log('🧪 Testing enhanced search for "find me receipts over 200"');
  
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
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📥 Raw response:', responseText);

    if (!response.ok) {
      console.error('❌ Request failed with status:', response.status);
      console.error('❌ Error response:', responseText);
      return;
    }

    try {
      const result = JSON.parse(responseText);
      console.log('✅ Response parsed successfully');
      console.log('📊 Results summary:', {
        success: result.success,
        totalResults: result.totalResults || 0,
        hasResults: (result.results?.length || 0) > 0,
        resultsCount: result.results?.length || 0,
        queryType: result.searchMetadata?.queryType,
        searchMethod: result.searchMetadata?.searchMethod,
        processingTime: result.searchMetadata?.processingTime
      });

      if (result.results && result.results.length > 0) {
        console.log('💰 Found receipts over 200:');
        result.results.forEach((receipt, index) => {
          console.log(`  ${index + 1}. ${receipt.metadata?.merchant || 'Unknown'} - ${receipt.metadata?.currency || 'MYR'} ${receipt.metadata?.total || 'N/A'} (${receipt.metadata?.date || 'No date'})`);
        });
        console.log('✅ SUCCESS: The fix is working! Found receipts over 200.');
      } else {
        console.log('❌ ISSUE: No results found - the fix may not be complete');
      }

    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      console.error('Raw response:', responseText);
    }

  } catch (error) {
    console.error('❌ Error testing enhanced search:', error);
  }
}

// Run the test
testEnhancedSearch().catch(console.error);
