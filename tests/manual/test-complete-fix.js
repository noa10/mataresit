// Complete test to verify the line item embedding fix works end-to-end
// This tests both the RPC function and the fallback method

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testCompleteFix() {
  try {
    console.log('🔍 Testing complete line item embedding fix...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Step 1: Check current stats
    console.log('📊 Checking current line item embedding stats...');
    
    // Count total line items with descriptions
    const { count: totalLineItems } = await supabase
      .from('line_items')
      .select('id', { count: 'exact' })
      .not('description', 'is', null);
    
    // Count line item embeddings
    const { count: embeddingsCount } = await supabase
      .from('receipt_embeddings')
      .select('id', { count: 'exact' })
      .eq('content_type', 'line_item');
    
    const withoutEmbeddings = (totalLineItems || 0) - (embeddingsCount || 0);
    
    console.log(`Current stats: ${totalLineItems} total, ${embeddingsCount} with embeddings, ${withoutEmbeddings} without`);
    
    if (withoutEmbeddings === 0) {
      console.log('✅ All line items already have embeddings!');
      return;
    }
    
    // Step 2: Test the fallback method directly (since RPC might not work from client)
    console.log('🔄 Testing fallback method to find receipts with missing embeddings...');
    
    const { data: receiptsWithLineItems } = await supabase
      .from('receipts')
      .select('id')
      .order('date', { ascending: false })
      .limit(20); // Test with first 20 receipts
    
    console.log(`Found ${receiptsWithLineItems?.length || 0} receipts to check`);
    
    // Check each receipt for missing line item embeddings
    const receiptsWithMissing = [];
    for (const receipt of receiptsWithLineItems || []) {
      const { data: missingLineItems } = await supabase.rpc('get_line_items_without_embeddings_for_receipt', {
        p_receipt_id: receipt.id
      });
      
      if (missingLineItems && missingLineItems.length > 0) {
        receiptsWithMissing.push({
          id: receipt.id,
          missingCount: missingLineItems.length
        });
        console.log(`Receipt ${receipt.id} has ${missingLineItems.length} line items without embeddings`);
        
        if (receiptsWithMissing.length >= 3) break; // Test with first 3 receipts that have missing embeddings
      }
    }
    
    console.log(`Found ${receiptsWithMissing.length} receipts with missing line item embeddings`);
    
    if (receiptsWithMissing.length === 0) {
      console.log('ℹ️ No receipts with missing embeddings found in the first 20 receipts');
      return;
    }
    
    // Step 3: Test edge function with one receipt
    const testReceipt = receiptsWithMissing[0];
    console.log(`🧪 Testing edge function with receipt: ${testReceipt.id} (${testReceipt.missingCount} missing embeddings)`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      credentials: 'omit',
      mode: 'cors',
      body: JSON.stringify({
        receiptId: testReceipt.id,
        processLineItems: true,
        forceRegenerate: false
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Edge function response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.count} line items`);
        
        // Step 4: Verify embeddings were created
        console.log('🔍 Verifying embeddings were created...');
        const { data: newEmbeddings } = await supabase
          .from('receipt_embeddings')
          .select('id, metadata')
          .eq('content_type', 'line_item')
          .eq('receipt_id', testReceipt.id);
        
        console.log(`✅ Found ${newEmbeddings?.length || 0} line item embeddings for this receipt`);
        
        // Check if the count improved
        const { data: remainingMissing } = await supabase.rpc('get_line_items_without_embeddings_for_receipt', {
          p_receipt_id: testReceipt.id
        });
        
        const remainingCount = remainingMissing?.length || 0;
        const processed = testReceipt.missingCount - remainingCount;
        
        console.log(`📈 Processed ${processed} line items (${remainingCount} still missing)`);
        
        if (processed > 0) {
          console.log('🎉 SUCCESS: Line item embedding generation is working!');
        } else {
          console.log('⚠️ No line items were processed - there might still be an issue');
        }
      } else {
        console.log(`❌ Edge function failed: ${result.error}`);
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Edge function request failed:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing complete fix:', error);
  }
}

// Run the test
testCompleteFix();
