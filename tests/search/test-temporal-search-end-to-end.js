/**
 * End-to-end test for temporal search fix
 * This script tests the complete "receipts from June 27" query flow
 */

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU5MzE1NzQsImV4cCI6MjAzMTUwNzU3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8";

async function testTemporalSearch() {
  console.log('🧪 Testing temporal search fix for "receipts from June 27"');
  
  try {
    // Test the unified-search Edge Function directly
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        query: "receipts from June 27",
        sources: ["receipt"],
        limit: 50,
        useEnhancedPrompting: false // Use regular search to test the fix
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('📊 Search Results:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Total results: ${result.results?.length || 0}`);
    console.log(`- Search duration: ${result.searchMetadata?.searchDuration || 'N/A'}ms`);
    
    if (result.results && result.results.length > 0) {
      console.log('\n📋 Results breakdown:');
      
      // Group by source_id (receipt)
      const receiptGroups = {};
      result.results.forEach(item => {
        if (!receiptGroups[item.source_id]) {
          receiptGroups[item.source_id] = [];
        }
        receiptGroups[item.source_id].push(item);
      });
      
      console.log(`- Unique receipts found: ${Object.keys(receiptGroups).length}`);
      
      // Show details for each receipt
      Object.entries(receiptGroups).forEach(([receiptId, items]) => {
        const merchantItem = items.find(item => item.content_type === 'merchant');
        const merchant = merchantItem ? merchantItem.content_text : 'Unknown';
        console.log(`  • Receipt ${receiptId.substring(0, 8)}...: ${merchant} (${items.length} embeddings)`);
      });
      
      // Check if we found the expected June 27 receipt
      const june27ReceiptId = "ac69dea1-6f1d-46ee-9d00-580371e49c0a";
      const foundJune27 = receiptGroups[june27ReceiptId];
      
      if (foundJune27) {
        console.log(`\n✅ SUCCESS: Found the June 27 receipt (TOH 15B PASAR BORONG)`);
        console.log(`   - Receipt ID: ${june27ReceiptId}`);
        console.log(`   - Embeddings found: ${foundJune27.length}`);
      } else {
        console.log(`\n❌ ISSUE: June 27 receipt not found in results`);
      }
      
      // Check if we're getting too many results (should be close to 1 receipt, not 30+)
      const uniqueReceiptCount = Object.keys(receiptGroups).length;
      if (uniqueReceiptCount === 1) {
        console.log(`\n🎯 PERFECT: Exactly 1 receipt found (expected for June 27)`);
      } else if (uniqueReceiptCount <= 5) {
        console.log(`\n✅ GOOD: ${uniqueReceiptCount} receipts found (reasonable for temporal query)`);
      } else {
        console.log(`\n⚠️  WARNING: ${uniqueReceiptCount} receipts found (might be too many for specific date)`);
      }
      
    } else {
      console.log('\n❌ No results found');
    }
    
    // Show metadata
    if (result.searchMetadata) {
      console.log('\n🔍 Search Metadata:');
      console.log(`- Sources searched: ${result.searchMetadata.sourcesSearched?.join(', ') || 'N/A'}`);
      console.log(`- Fallbacks used: ${result.searchMetadata.fallbacksUsed?.join(', ') || 'None'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTemporalSearch();
