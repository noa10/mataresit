// Direct test of POWERCAT search to debug the response issue
// Run this in browser console on the search page

console.log('🧪 Starting direct POWERCAT search test...');

async function testPowercatDirect() {
  try {
    // Method 1: Get auth token from localStorage (Supabase stores it there)
    let authToken = null;

    console.log('🔍 Searching for auth token in localStorage...');
    const allKeys = Object.keys(localStorage);
    console.log('📋 All localStorage keys:', allKeys);

    // Look for Supabase auth token in localStorage
    const authKeys = allKeys.filter(key =>
      key.includes('supabase') && key.includes('auth')
    );

    console.log('🔑 Found auth-related keys:', authKeys);

    for (const key of authKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          console.log(`🔍 Checking key ${key}:`, {
            hasAccessToken: !!parsed.access_token,
            hasSession: !!parsed.session,
            sessionAccessToken: !!parsed.session?.access_token
          });

          // Try different paths to get the token
          authToken = parsed.access_token ||
                     parsed.session?.access_token ||
                     parsed.data?.session?.access_token;

          if (authToken) {
            console.log('✅ Auth token found in key:', key);
            console.log('✅ Token preview:', authToken.substring(0, 20) + '...');
            break;
          }
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse key ${key}:`, e);
      }
    }

    // Method 2: If no token found, try to create a Supabase client and get session
    if (!authToken) {
      console.log('🔄 No token in localStorage, trying to create Supabase client...');

      // Import Supabase dynamically
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1');
        const supabaseClient = createClient(
          'https://mpmkbtsufihzdelrlszs.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY'
        );

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          authToken = session.access_token;
          console.log('✅ Auth token obtained from new Supabase client:', authToken.substring(0, 20) + '...');
        }
      } catch (e) {
        console.warn('⚠️ Could not create Supabase client:', e);
      }
    }

    if (!authToken) {
      console.error('❌ No auth token found. Please make sure you are logged in.');
      console.log('💡 Try refreshing the page and logging in again.');
      return;
    }

    // Test parameters
    const searchParams = {
      query: 'powercat',
      sources: ['receipt'],
      limit: 10,
      offset: 0,
      filters: {},
      similarityThreshold: 0.2,
      includeMetadata: true,
      aggregationMode: 'relevance'
    };

    console.log('📤 Sending request with params:', searchParams);

    // Make direct fetch call
    const url = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(searchParams)
    });

    console.log('📝 Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Get response text
    const responseText = await response.text();
    console.log('📄 Raw response text:', {
      length: responseText.length,
      preview: responseText.substring(0, 500),
      isEmpty: responseText.trim() === ''
    });

    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Parsed JSON successfully:', {
        hasData: !!data,
        dataType: typeof data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        success: data?.success,
        resultsLength: data?.results?.length,
        hasEnhancedResponse: !!data?.enhancedResponse,
        fullData: data
      });

      if (data?.results && data.results.length > 0) {
        console.log('🎯 First result:', data.results[0]);
      }

      return data;
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('❌ Raw response that failed to parse:', responseText);
      return null;
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run the test
testPowercatDirect().then(result => {
  if (result) {
    console.log('🎉 Test completed successfully!');
    console.log('📊 Final result summary:', {
      success: result.success,
      totalResults: result.totalResults,
      resultsCount: result.results?.length,
      hasUIComponents: !!result.uiComponents,
      hasEnhancedResponse: !!result.enhancedResponse
    });
  } else {
    console.log('❌ Test failed - no valid result returned');
  }
});
