// Enhanced test script to debug the unified-search Edge Function
// Run this in the browser console on your app (make sure you're logged in first)

async function testUnifiedSearchDetailed() {
  console.log('🧪 Testing unified-search Edge Function with detailed debugging...');

  try {
    // Step 1: Check if supabase is available
    if (typeof window.supabase === 'undefined') {
      console.error('❌ Supabase client not found. Make sure you\'re on the app page.');
      return;
    }

    console.log('✅ Supabase client found');

    // Step 2: Get the current session
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('❌ No valid session found:', sessionError);
      console.log('💡 Please log in first, then run this test again');
      return;
    }

    console.log('✅ Session found for user:', session.user.id);
    console.log('🔑 Access token length:', session.access_token.length);

    // Step 3: Test CORS preflight first
    console.log('🔍 Testing CORS preflight...');
    try {
      const preflightResponse = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search', {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization,apikey'
        }
      });
      console.log('✅ CORS preflight status:', preflightResponse.status);
      console.log('📡 CORS headers:', Object.fromEntries(preflightResponse.headers.entries()));
    } catch (corsError) {
      console.warn('⚠️ CORS preflight failed:', corsError);
    }

    // Step 4: Test the actual function call
    console.log('🚀 Making actual function call...');
    const startTime = Date.now();

    const response = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQ0NzI4NzQsImV4cCI6MjAzMDA0ODg3NH0.Ej_199cW_Rw6qkDdJQhLaiPKNKLIXzuUUJjnJWK_Ej8'
      },
      body: JSON.stringify({
        query: 'receipt over $100',
        sources: ['receipt'],
        limit: 10,
        offset: 0,
        similarityThreshold: 0.2
      })
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Response time: ${responseTime}ms`);
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', response.status);
      console.error('❌ Error body:', errorText);

      // Try to parse as JSON in case it's a structured error
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Parsed error:', errorJson);
      } catch (e) {
        console.log('ℹ️ Error is not JSON format');
      }
      return;
    }

    const data = await response.json();
    console.log('✅ Response data:', data);

    if (data.success) {
      console.log(`🎉 Success! Found ${data.results?.length || 0} results`);
      if (data.results && data.results.length > 0) {
        console.log('📋 Sample results:', data.results.slice(0, 3));
      }
      if (data.searchMetadata) {
        console.log('🔍 Search metadata:', data.searchMetadata);
      }
    } else {
      console.error('❌ Function returned error:', data.error);
      if (data.searchMetadata) {
        console.log('🔍 Search metadata (with error):', data.searchMetadata);
      }
    }

  } catch (error) {
    console.error('❌ Network/JS Error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Additional debugging for common issues
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.log('💡 This is likely a CORS or network connectivity issue');
      console.log('💡 Possible causes:');
      console.log('   - Edge function is not deployed or crashed');
      console.log('   - CORS headers not properly configured');
      console.log('   - Network connectivity issues');
      console.log('   - Function timeout');
    }
  }
}

// Also test the database function directly
async function testDatabaseFunction() {
  console.log('🧪 Testing database function directly...');

  try {
    if (typeof window.supabase === 'undefined') {
      console.error('❌ Supabase client not found');
      return;
    }

    // Test the can_perform_unified_search function
    const { data: permissionData, error: permissionError } = await window.supabase.rpc('can_perform_unified_search', {
      p_user_id: (await window.supabase.auth.getUser()).data.user?.id,
      p_sources: ['receipt'],
      p_result_limit: 10
    });

    if (permissionError) {
      console.error('❌ Permission check failed:', permissionError);
    } else {
      console.log('✅ Permission check result:', permissionData);
    }

    // Test the unified_search function with a dummy embedding
    const testEmbedding = new Array(1536).fill(0.1);
    const { data: searchData, error: searchError } = await window.supabase.rpc('unified_search', {
      query_embedding: testEmbedding,
      source_types: ['receipt'],
      similarity_threshold: 0.1,
      match_count: 5,
      user_filter: (await window.supabase.auth.getUser()).data.user?.id
    });

    if (searchError) {
      console.error('❌ Database search failed:', searchError);
    } else {
      console.log('✅ Database search result:', searchData);
      console.log(`📊 Found ${searchData?.length || 0} results from database`);
    }

  } catch (error) {
    console.error('❌ Database test error:', error);
  }
}

// Run both tests
console.log('🚀 Starting comprehensive unified search test...');
console.log('');
testUnifiedSearchDetailed().then(() => {
  console.log('');
  console.log('🔄 Now testing database functions...');
  return testDatabaseFunction();
}).then(() => {
  console.log('');
  console.log('✅ All tests completed!');
});