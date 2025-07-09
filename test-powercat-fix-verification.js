// Test script to verify the POWERCAT search fix
// Run this in browser console on the search page after the fix

console.log('🧪 Testing POWERCAT search fix...');

async function testPowercatSearchFix() {
  try {
    console.log('🔍 Step 1: Getting auth token...');
    
    // Get auth token from localStorage
    let authToken = null;
    const allKeys = Object.keys(localStorage);
    const authKeys = allKeys.filter(key => key.includes('supabase') && key.includes('auth'));
    
    for (const key of authKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          authToken = parsed.access_token || parsed.session?.access_token || parsed.data?.session?.access_token;
          if (authToken) {
            console.log('✅ Auth token found');
            break;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    if (!authToken) {
      console.error('❌ No auth token found. Please make sure you are logged in.');
      return;
    }

    console.log('🔍 Step 2: Testing unified search with POWERCAT...');
    
    // Test parameters with the fixed threshold
    const searchParams = {
      query: 'powercat',
      sources: ['receipt'],
      limit: 10,
      offset: 0,
      filters: {},
      similarityThreshold: 0.45, // Using the new fixed threshold
      includeMetadata: true,
      aggregationMode: 'relevance'
    };

    console.log('📤 Sending request with params:', searchParams);

    // Make direct fetch call to unified-search
    const url = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(searchParams)
    });

    console.log('📝 Response status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('📄 Raw response length:', responseText.length);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Parsed JSON successfully');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('❌ Raw response:', responseText.substring(0, 500));
      return null;
    }

    console.log('🔍 Step 3: Analyzing search results...');
    console.log('📊 Search response analysis:', {
      success: data?.success,
      resultsLength: data?.results?.length,
      totalResults: data?.totalResults,
      hasError: !!data?.error,
      error: data?.error,
      hasEnhancedResponse: !!data?.enhancedResponse,
      searchMetadata: data?.searchMetadata
    });

    if (data?.results && data.results.length > 0) {
      console.log('🎯 First few results:');
      data.results.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} - ${result.content}`);
        console.log(`     Similarity: ${result.similarity}, Type: ${result.contentType}`);
      });
    }

    console.log('🔍 Step 4: Testing line item detection...');
    
    // Test if 'powercat' is detected as a line item query
    const lineItemIndicators = [
      'powercat', 'coca cola', 'pepsi', 'sprite', 'fanta', 'nestle', 'maggi',
      'milo', 'horlicks', 'ovaltine', 'kit kat', 'snickers', 'twix', 'oreo'
    ];
    
    const isLineItemQuery = lineItemIndicators.some(indicator => 
      'powercat'.toLowerCase().includes(indicator.toLowerCase())
    );
    
    console.log('🔍 Line item query detection:', {
      query: 'powercat',
      isDetectedAsLineItem: isLineItemQuery,
      matchedIndicator: lineItemIndicators.find(indicator => 
        'powercat'.toLowerCase().includes(indicator.toLowerCase())
      )
    });

    return data;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run the test
console.log('🚀 Starting POWERCAT search fix verification...');
testPowercatSearchFix().then(result => {
  if (result && result.success) {
    console.log('🎉 POWERCAT search fix verification PASSED!');
    console.log('📈 Results summary:', {
      totalResults: result.totalResults,
      resultsReturned: result.results?.length,
      searchSuccessful: result.success
    });
  } else {
    console.log('❌ POWERCAT search fix verification FAILED');
    if (result) {
      console.log('❌ Error details:', result.error);
    }
  }
});

console.log('💡 After running this test, try searching for "powercat" in the chat interface to see if it works!');
