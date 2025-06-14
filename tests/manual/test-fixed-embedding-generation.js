// Test script to verify the fixed line item embedding generation
// This simulates what the admin panel does after our fix

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testFixedEmbeddingGeneration() {
  try {
    console.log('🔍 Testing fixed line item embedding generation...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Step 1: Test the new RPC function
    console.log('📊 Testing new RPC function...');
    const { data: receiptsWithMissing, error: rpcError } = await supabase.rpc('get_receipts_with_missing_line_item_embeddings', {
      p_limit: 5
    });
    
    if (rpcError) {
      console.error('❌ RPC function error:', rpcError);
      return;
    }
    
    console.log(`✅ RPC function returned ${receiptsWithMissing?.length || 0} receipts with missing embeddings`);
    console.log('First few receipts:', receiptsWithMissing?.slice(0, 3));
    
    // Step 2: Test edge function with one of these receipts
    if (receiptsWithMissing && receiptsWithMissing.length > 0) {
      const testReceiptId = receiptsWithMissing[0].id;
      console.log(`🧪 Testing edge function with receipt: ${testReceiptId}`);
      
      // Call the edge function using the same pattern as the admin panel
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
          receiptId: testReceiptId,
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
          if (result.failedCount > 0) {
            console.log(`⚠️ ${result.failedCount} line items failed to process`);
          }
          
          // Step 3: Verify that embeddings were actually created
          console.log('🔍 Verifying embeddings were created...');
          const { data: newEmbeddings, error: embeddingError } = await supabase
            .from('receipt_embeddings')
            .select('id, metadata')
            .eq('content_type', 'line_item')
            .eq('receipt_id', testReceiptId);
          
          if (embeddingError) {
            console.error('❌ Error checking embeddings:', embeddingError);
          } else {
            console.log(`✅ Found ${newEmbeddings?.length || 0} line item embeddings for this receipt`);
          }
        } else {
          console.log(`❌ Edge function failed: ${result.error}`);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Edge function request failed:', response.status, errorText);
      }
    } else {
      console.log('ℹ️ No receipts with missing embeddings found');
    }
    
  } catch (error) {
    console.error('❌ Error testing fixed embedding generation:', error);
  }
}

// Run the test
testFixedEmbeddingGeneration();
