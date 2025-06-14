// Final comprehensive test to verify the complete fix works
// This simulates the exact flow the admin panel uses

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testFinalFix() {
  try {
    console.log('🔍 Testing final line item embedding fix...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Simulate callEdgeFunction
    async function callEdgeFunction(functionName, method, body) {
      const url = `${SUPABASE_URL}/functions/v1/${functionName}?t=${Date.now()}`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'omit',
        mode: 'cors',
        ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {})
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    }
    
    // Simulate checkLineItemEmbeddings function
    async function checkLineItemEmbeddings() {
      const { count: totalLineItems } = await supabase
        .from('line_items')
        .select('id', { count: 'exact' })
        .not('description', 'is', null);
      
      const { count: embeddingsCount } = await supabase
        .from('receipt_embeddings')
        .select('id', { count: 'exact' })
        .eq('content_type', 'line_item');
      
      const withoutEmbeddings = Math.max(0, (totalLineItems || 0) - (embeddingsCount || 0));
      
      return {
        exists: (embeddingsCount || 0) > 0,
        count: embeddingsCount || 0,
        total: totalLineItems || 0,
        withEmbeddings: embeddingsCount || 0,
        withoutEmbeddings
      };
    }
    
    // Simulate generateLineItemEmbeddings function with our fix
    async function generateLineItemEmbeddings(limit = 200, forceRegenerate = false) {
      console.log(`Starting generateLineItemEmbeddings with limit=${limit}, forceRegenerate=${forceRegenerate}`);
      
      // Get the status of line item embeddings
      const status = await checkLineItemEmbeddings();
      console.log('Current status:', status);
      
      if (!forceRegenerate && status.withoutEmbeddings === 0) {
        console.log('No line items need processing');
        return {
          success: true,
          processed: 0,
          total: status.total,
          withEmbeddings: status.withEmbeddings,
          withoutEmbeddings: 0
        };
      }
      
      // Use our improved logic to find receipts with missing embeddings
      console.log('Finding receipts with missing line item embeddings...');
      
      // Try the RPC function first
      let receipts = [];
      try {
        const { data, error } = await supabase.rpc('get_receipts_with_missing_line_item_embeddings', {
          p_limit: limit
        });
        
        if (error) {
          console.warn('RPC function failed, using fallback:', error.message);
        } else {
          receipts = data || [];
          console.log(`RPC function found ${receipts.length} receipts with missing embeddings`);
        }
      } catch (rpcError) {
        console.warn('RPC function error:', rpcError);
      }
      
      // If RPC failed or returned no results, use fallback
      if (receipts.length === 0) {
        console.log('Using fallback method to find receipts...');
        
        const { data: allReceipts } = await supabase
          .from('receipts')
          .select('id, date')
          .order('date', { ascending: false })
          .limit(limit * 3);
        
        console.log(`Checking ${allReceipts?.length || 0} receipts for missing embeddings...`);
        
        const receiptsWithMissing = [];
        for (const receipt of allReceipts || []) {
          const { data: missingLineItems } = await supabase.rpc('get_line_items_without_embeddings_for_receipt', {
            p_receipt_id: receipt.id
          });
          
          if (missingLineItems && missingLineItems.length > 0) {
            receiptsWithMissing.push({ id: receipt.id });
            console.log(`Receipt ${receipt.id} has ${missingLineItems.length} missing line item embeddings`);
            
            if (receiptsWithMissing.length >= Math.min(limit, 10)) break; // Limit to 10 for testing
          }
        }
        
        receipts = receiptsWithMissing;
      }
      
      console.log(`Found ${receipts.length} receipts to process`);
      
      if (receipts.length === 0) {
        console.log('No receipts with missing embeddings found');
        return {
          success: true,
          processed: 0,
          total: status.total,
          withEmbeddings: status.withEmbeddings,
          withoutEmbeddings: status.withoutEmbeddings
        };
      }
      
      // Process receipts
      let processedCount = 0;
      
      for (const receipt of receipts.slice(0, 3)) { // Test with first 3 receipts
        try {
          console.log(`Processing receipt ${receipt.id}...`);
          
          const response = await callEdgeFunction('generate-embeddings', 'POST', {
            receiptId: receipt.id,
            processLineItems: true,
            forceRegenerate: forceRegenerate
          });
          
          if (response && response.success) {
            processedCount += response.count || 0;
            console.log(`✅ Processed ${response.count} line items for receipt ${receipt.id}`);
          } else {
            console.log(`❌ Failed to process receipt ${receipt.id}: ${response?.error}`);
          }
        } catch (err) {
          console.error(`Error processing receipt ${receipt.id}:`, err);
        }
      }
      
      // Get updated status
      const newStatus = await checkLineItemEmbeddings();
      
      return {
        success: true,
        processed: processedCount,
        total: newStatus.total,
        withEmbeddings: newStatus.withEmbeddings,
        withoutEmbeddings: newStatus.withoutEmbeddings
      };
    }
    
    // Run the test
    console.log('📊 Checking initial stats...');
    const initialStats = await checkLineItemEmbeddings();
    console.log('Initial stats:', initialStats);
    
    if (initialStats.withoutEmbeddings > 0) {
      console.log('🚀 Testing line item embedding generation...');
      const result = await generateLineItemEmbeddings(200, false);
      console.log('Generation result:', result);
      
      if (result.success && result.processed > 0) {
        console.log(`🎉 SUCCESS! Processed ${result.processed} line items`);
        console.log(`📈 Improvement: ${initialStats.withoutEmbeddings - result.withoutEmbeddings} fewer missing embeddings`);
      } else {
        console.log('⚠️ No line items were processed');
      }
    } else {
      console.log('✅ All line items already have embeddings!');
    }
    
  } catch (error) {
    console.error('❌ Error in final test:', error);
  }
}

// Run the test
testFinalFix();
