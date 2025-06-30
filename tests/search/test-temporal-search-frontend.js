/**
 * Frontend test script for temporal search fix
 * Run this in the browser console on localhost:5173 to test the fix
 */

async function testTemporalSearchFix() {
  console.log('🧪 Testing Temporal Search Fix: "receipts from June 27"');
  console.log('Expected: 1 result (TOH 15B PASAR BORONG)');
  console.log('Previous bug: 30+ results');
  
  try {
    // Get the auth token from localStorage (assuming user is logged in)
    const supabaseAuth = JSON.parse(localStorage.getItem('sb-mpmkbtsufihzdelrlszs-auth-token') || '{}');
    const accessToken = supabaseAuth?.access_token;
    
    if (!accessToken) {
      console.error('❌ No auth token found. Please log in first.');
      return;
    }
    
    console.log('✅ Auth token found, making request...');
    
    // Test the unified-search Edge Function
    const response = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: "receipts from June 27",
        sources: ["receipt"],
        limit: 50,
        useEnhancedPrompting: false // Test regular search flow
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP error! status: ${response.status}`, errorText);
      return;
    }

    const result = await response.json();
    
    console.log('\n📊 RESULTS:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Total results: ${result.results?.length || 0}`);
    console.log(`- Search duration: ${result.searchMetadata?.searchDuration || 'N/A'}ms`);
    console.log(`- Sources searched: ${result.searchMetadata?.sourcesSearched?.join(', ') || 'N/A'}`);
    console.log(`- Fallbacks used: ${result.searchMetadata?.fallbacksUsed?.join(', ') || 'None'}`);
    
    if (result.results && result.results.length > 0) {
      // Group by receipt ID
      const receiptGroups = {};
      result.results.forEach(item => {
        if (!receiptGroups[item.source_id]) {
          receiptGroups[item.source_id] = [];
        }
        receiptGroups[item.source_id].push(item);
      });
      
      const uniqueReceiptCount = Object.keys(receiptGroups).length;
      console.log(`\n📋 ANALYSIS:`);
      console.log(`- Unique receipts found: ${uniqueReceiptCount}`);
      
      // Check for the expected June 27 receipt
      const june27ReceiptId = "ac69dea1-6f1d-46ee-9d00-580371e49c0a";
      const foundJune27 = receiptGroups[june27ReceiptId];
      
      if (foundJune27) {
        console.log(`✅ SUCCESS: Found June 27 receipt (TOH 15B PASAR BORONG)`);
        console.log(`   - Receipt ID: ${june27ReceiptId}`);
        console.log(`   - Embeddings: ${foundJune27.length}`);
        
        // Show the merchant name
        const merchantItem = foundJune27.find(item => item.content_type === 'merchant');
        if (merchantItem) {
          console.log(`   - Merchant: ${merchantItem.content_text}`);
        }
      } else {
        console.log(`❌ ISSUE: June 27 receipt not found`);
      }
      
      // Evaluate the fix effectiveness
      if (uniqueReceiptCount === 1 && foundJune27) {
        console.log(`\n🎯 PERFECT FIX: Exactly 1 receipt found (the correct June 27 receipt)`);
        console.log(`✅ Temporal search is working correctly!`);
      } else if (uniqueReceiptCount <= 3 && foundJune27) {
        console.log(`\n✅ GOOD FIX: ${uniqueReceiptCount} receipts found (reasonable, includes June 27)`);
      } else if (uniqueReceiptCount > 10) {
        console.log(`\n⚠️  PARTIAL FIX: ${uniqueReceiptCount} receipts found (better than 30+, but still too many)`);
      } else {
        console.log(`\n❌ FIX INCOMPLETE: ${uniqueReceiptCount} receipts found, but missing June 27 receipt`);
      }
      
      // Show all receipts found
      console.log(`\n📝 ALL RECEIPTS FOUND:`);
      Object.entries(receiptGroups).forEach(([receiptId, items]) => {
        const merchantItem = items.find(item => item.content_type === 'merchant');
        const merchant = merchantItem ? merchantItem.content_text : 'Unknown';
        const isJune27 = receiptId === june27ReceiptId;
        console.log(`  ${isJune27 ? '🎯' : '📄'} ${receiptId.substring(0, 8)}...: ${merchant} (${items.length} embeddings)`);
      });
      
    } else {
      console.log('\n❌ NO RESULTS: This indicates the fix may have overcorrected');
      console.log('   Expected: 1 result for June 27 receipt');
    }
    
    // Show error details if any
    if (!result.success && result.error) {
      console.log(`\n❌ ERROR: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions for running the test
console.log(`
🧪 TEMPORAL SEARCH FIX TEST
===========================

To test the fix:
1. Make sure you're logged into the app (localhost:5173)
2. Open browser console (F12)
3. Run: testTemporalSearchFix()

Expected result: Exactly 1 receipt (TOH 15B PASAR BORONG from June 27)
Previous bug: 30+ receipts returned
`);

// Make function available globally
window.testTemporalSearchFix = testTemporalSearchFix;
