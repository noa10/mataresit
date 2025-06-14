// Test script to run in browser console to test the fix
// Copy and paste this into the browser console on the admin settings page

console.log('🔍 Testing line item embedding fix in browser...');

// Test the checkLineItemEmbeddings function
async function testEmbeddingCheck() {
  try {
    // This should be available in the browser context on the admin page
    if (typeof window.supabase === 'undefined') {
      console.error('❌ Supabase client not available');
      return;
    }
    
    console.log('📊 Checking line item embedding stats...');
    
    // Get total line items with descriptions
    const { count: totalLineItems, error: countError } = await window.supabase
      .from('line_items')
      .select('id', { count: 'exact' })
      .not('description', 'is', null);
    
    if (countError) {
      console.error('Error counting line items:', countError);
      return;
    }
    
    // Count line item embeddings
    const { count: embeddingsCount, error: embedError } = await window.supabase
      .from('receipt_embeddings')
      .select('id', { count: 'exact' })
      .eq('content_type', 'line_item');
    
    if (embedError) {
      console.error('Error counting embeddings:', embedError);
      return;
    }
    
    const withoutEmbeddings = (totalLineItems || 0) - (embeddingsCount || 0);
    
    console.log(`✅ Stats: ${totalLineItems} total, ${embeddingsCount} with embeddings, ${withoutEmbeddings} without`);
    
    if (withoutEmbeddings > 0) {
      console.log('🔄 Testing RPC function to find receipts with missing embeddings...');
      
      // Test the new RPC function
      const { data: receiptsWithMissing, error: rpcError } = await window.supabase.rpc('get_receipts_with_missing_line_item_embeddings', {
        p_limit: 5
      });
      
      if (rpcError) {
        console.log('⚠️ RPC function error (will use fallback):', rpcError);
      } else {
        console.log(`✅ RPC function found ${receiptsWithMissing?.length || 0} receipts with missing embeddings`);
      }
      
      // Test the fallback method
      console.log('🔄 Testing fallback method...');
      const { data: allReceipts } = await window.supabase
        .from('receipts')
        .select('id')
        .order('date', { ascending: false })
        .limit(10);
      
      console.log(`Found ${allReceipts?.length || 0} recent receipts to check`);
      
      if (allReceipts && allReceipts.length > 0) {
        // Check first receipt for missing line items
        const testReceiptId = allReceipts[0].id;
        const { data: missingLineItems } = await window.supabase.rpc('get_line_items_without_embeddings_for_receipt', {
          p_receipt_id: testReceiptId
        });
        
        console.log(`Receipt ${testReceiptId} has ${missingLineItems?.length || 0} line items without embeddings`);
      }
    } else {
      console.log('✅ All line items already have embeddings!');
    }
    
  } catch (error) {
    console.error('❌ Error testing:', error);
  }
}

// Run the test
testEmbeddingCheck();

// Instructions
console.log(`
🧪 Line Item Embedding Fix Test

To test the actual generation, you can:
1. Click the "Generate Missing" button in the admin panel
2. Or run: document.querySelector('button[variant="default"]').click()

Watch the console and network tabs for results.
`);
