#!/usr/bin/env -S deno run --allow-all

/**
 * Test the live system fixes for temporal search accuracy
 * This tests the actual deployed edge function with proper authentication
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';

// You'll need to replace this with a valid user JWT token from the browser
const USER_JWT_TOKEN = 'YOUR_USER_JWT_TOKEN_HERE';

async function testLiveSystemFixes() {
  console.log('🔍 Testing Live System Temporal Search Fixes');
  console.log('=' .repeat(70));
  console.log('');
  
  if (USER_JWT_TOKEN === 'YOUR_USER_JWT_TOKEN_HERE') {
    console.log('⚠️ IMPORTANT: To test the live system, you need to:');
    console.log('1. Open the browser developer tools on the live application');
    console.log('2. Go to Application/Storage > Local Storage or Session Storage');
    console.log('3. Find the Supabase auth token (usually under "sb-" key)');
    console.log('4. Copy the JWT token and replace USER_JWT_TOKEN in this script');
    console.log('5. Re-run this test');
    console.log('');
    console.log('📋 Expected Results After Fixes:');
    console.log('- Query: "show me all receipts from last week"');
    console.log('- Results: 32 receipts (not 5 or 20)');
    console.log('- Date Range: July 7-13, 2025 (not July 10-11)');
    console.log('- Backend Processing: All 32 receipts found and returned');
    console.log('- UI Display: Correct date range and full result count');
    return;
  }
  
  try {
    console.log('🧪 Test 1: Live Temporal Search with Authentication');
    console.log('-'.repeat(50));
    
    const testQuery = "show me all receipts from last week";
    console.log(`Query: "${testQuery}"`);
    console.log('');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${USER_JWT_TOKEN}`
      },
      body: JSON.stringify({ 
        query: testQuery,
        limit: 50 // Request higher limit to ensure we get all results
      })
    });
    
    console.log(`Response Status: ${response.status}`);
    
    if (response.status !== 200) {
      const errorText = await response.text();
      console.log('❌ Request failed:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('');
    console.log('📊 Response Analysis:');
    console.log('-'.repeat(30));
    
    // Analyze the response structure
    console.log('Response Structure:', {
      hasData: !!result.data,
      dataLength: result.data?.length || 0,
      hasMetadata: !!result.metadata,
      hasComponents: !!result.components,
      componentsLength: result.components?.length || 0
    });
    
    // Check for receipt results
    const receiptResults = result.data?.filter((item: any) => 
      item.sourceType === 'receipt' || item.source_type === 'receipt'
    ) || [];
    
    console.log('');
    console.log('🧾 Receipt Analysis:');
    console.log('-'.repeat(30));
    console.log(`Total Results: ${result.data?.length || 0}`);
    console.log(`Receipt Results: ${receiptResults.length}`);
    
    if (receiptResults.length > 0) {
      // Analyze date distribution
      const dates = receiptResults
        .map((r: any) => r.metadata?.date || r.date)
        .filter(Boolean)
        .sort();
      
      const uniqueDates = [...new Set(dates)];
      const earliestDate = dates[0];
      const latestDate = dates[dates.length - 1];
      
      console.log(`Date Range: ${earliestDate} to ${latestDate}`);
      console.log(`Unique Dates: ${uniqueDates.length} days`);
      console.log(`Date Distribution:`, uniqueDates);
      
      // Check if we got the expected July 7-13 range
      const expectedStart = '2025-07-07';
      const expectedEnd = '2025-07-13';
      const hasCorrectRange = earliestDate <= expectedStart && latestDate >= expectedEnd;
      
      console.log('');
      console.log('✅ Fix Validation:');
      console.log('-'.repeat(30));
      console.log(`Expected Range: ${expectedStart} to ${expectedEnd}`);
      console.log(`Actual Range: ${earliestDate} to ${latestDate}`);
      console.log(`Range Correct: ${hasCorrectRange ? '✅ YES' : '❌ NO'}`);
      console.log(`Result Count: ${receiptResults.length} ${receiptResults.length >= 32 ? '✅ GOOD' : receiptResults.length >= 20 ? '⚠️ PARTIAL' : '❌ LOW'}`);
      
      // Analyze merchants
      const merchants = [...new Set(receiptResults.map((r: any) => 
        r.metadata?.merchant || r.merchant
      ).filter(Boolean))];
      
      console.log(`Unique Merchants: ${merchants.length}`);
      console.log(`Sample Merchants:`, merchants.slice(0, 5));
      
      // Analyze amounts
      const amounts = receiptResults
        .map((r: any) => r.metadata?.total || r.total)
        .filter(n => typeof n === 'number');
      
      const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
      console.log(`Total Amount: MYR ${totalAmount.toFixed(2)}`);
    }
    
    // Check metadata for date range information
    console.log('');
    console.log('🔍 Metadata Analysis:');
    console.log('-'.repeat(30));
    
    if (result.metadata?.filters) {
      console.log('Filters:', {
        startDate: result.metadata.filters.startDate,
        endDate: result.metadata.filters.endDate,
        dateRange: result.metadata.filters.dateRange
      });
    }
    
    if (result.metadata?.searchMethod) {
      console.log(`Search Method: ${result.metadata.searchMethod}`);
    }
    
    if (result.metadata?.temporalRouting) {
      console.log('Temporal Routing:', result.metadata.temporalRouting);
    }
    
    // Check UI components for date range display
    console.log('');
    console.log('🎨 UI Components Analysis:');
    console.log('-'.repeat(30));
    
    if (result.components) {
      result.components.forEach((component: any, index: number) => {
        console.log(`Component ${index + 1}:`, {
          type: component.type,
          hasData: !!component.data,
          dataKeys: component.data ? Object.keys(component.data) : []
        });
        
        // Check for date range in summary data
        if (component.data?.dateRange) {
          console.log(`  Date Range:`, component.data.dateRange);
        }
        
        if (component.data?.totalResults) {
          console.log(`  Total Results: ${component.data.totalResults}`);
        }
      });
    }
    
    console.log('');
    console.log('🎯 Final Assessment:');
    console.log('=' .repeat(50));
    
    const isSuccess = receiptResults.length >= 32 && 
                     dates.some((d: string) => d.startsWith('2025-07-07')) &&
                     dates.some((d: string) => d.startsWith('2025-07-13'));
    
    if (isSuccess) {
      console.log('✅ SUCCESS: Temporal search fixes are working!');
      console.log('   - Full result set returned');
      console.log('   - Correct date range coverage');
      console.log('   - Backend processing improved');
    } else if (receiptResults.length >= 20) {
      console.log('⚠️ PARTIAL: Some improvements but not complete');
      console.log('   - More results than before (20+ vs 5)');
      console.log('   - May need additional limit adjustments');
    } else {
      console.log('❌ ISSUE: Fixes may not be fully effective');
      console.log('   - Still limited results');
      console.log('   - May need further investigation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Verify the JWT token is valid and not expired');
    console.log('2. Check if the user has access to the receipts');
    console.log('3. Ensure the edge function is deployed correctly');
    console.log('4. Check the browser network tab for detailed error info');
  }
}

// Run the test
await testLiveSystemFixes();
