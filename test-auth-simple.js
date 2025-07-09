// Simple auth token test - paste this in browser console
console.log('🧪 Testing auth token retrieval...');

// Check localStorage for auth tokens
console.log('📋 All localStorage keys:', Object.keys(localStorage));

const authKeys = Object.keys(localStorage).filter(key => 
  key.includes('supabase') || key.includes('auth') || key.includes('sb-')
);

console.log('🔑 Auth-related keys:', authKeys);

authKeys.forEach(key => {
  try {
    const value = localStorage.getItem(key);
    if (value) {
      const parsed = JSON.parse(value);
      console.log(`🔍 Key: ${key}`, {
        hasAccessToken: !!parsed.access_token,
        hasSession: !!parsed.session,
        sessionAccessToken: !!parsed.session?.access_token,
        keys: Object.keys(parsed)
      });
    }
  } catch (e) {
    console.log(`❌ Could not parse key ${key}:`, e);
  }
});

// Test direct fetch to Edge Function
async function testDirectFetch() {
  console.log('🚀 Testing direct fetch to unified-search...');
  
  // Get token from localStorage
  let authToken = null;
  for (const key of authKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        authToken = parsed.access_token || parsed.session?.access_token;
        if (authToken) {
          console.log('✅ Found auth token in key:', key);
          break;
        }
      }
    } catch (e) {
      // Skip
    }
  }
  
  if (!authToken) {
    console.error('❌ No auth token found');
    return;
  }
  
  console.log('🔑 Using token:', authToken.substring(0, 20) + '...');
  
  try {
    const response = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        query: 'powercat',
        sources: ['receipt'],
        limit: 5,
        offset: 0,
        filters: {},
        similarityThreshold: 0.2,
        includeMetadata: true,
        aggregationMode: 'relevance'
      })
    });
    
    console.log('📝 Response status:', response.status);
    console.log('📝 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📄 Response text length:', responseText.length);
    console.log('📄 Response preview:', responseText.substring(0, 200));
    
    if (responseText) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Parsed response:', {
          success: data.success,
          resultsLength: data.results?.length,
          hasEnhancedResponse: !!data.enhancedResponse,
          keys: Object.keys(data)
        });
        return data;
      } catch (e) {
        console.error('❌ JSON parse error:', e);
      }
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }
}

// Run the test
testDirectFetch();
