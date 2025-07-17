#!/usr/bin/env tsx

/**
 * Generate Embeddings for Affected Receipts
 * Safely generates embeddings for the 32 receipts in the temporal search date range
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ReceiptData {
  id: string;
  date: string;
  merchant: string;
  fullText: string | null;
  has_embeddings: boolean;
  embedding_status: string;
}

interface EmbeddingResult {
  receiptId: string;
  success: boolean;
  error?: string;
  contentTypes?: string[];
  processingTime?: number;
}

/**
 * Call the generate-embeddings edge function for a specific receipt
 */
async function generateEmbeddingsForReceipt(receiptId: string): Promise<EmbeddingResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Generating embeddings for receipt ${receiptId}...`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        receiptId,
        processAllFields: true,
        processLineItems: true,
        useImprovedDimensionHandling: true,
        forceRegenerate: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ Successfully generated embeddings for receipt ${receiptId} (${processingTime}ms)`);
      return {
        receiptId,
        success: true,
        contentTypes: result.contentTypes || [],
        processingTime
      };
    } else {
      console.log(`❌ Failed to generate embeddings for receipt ${receiptId}: ${result.error}`);
      return {
        receiptId,
        success: false,
        error: result.error || 'Unknown error',
        processingTime
      };
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.log(`❌ Error generating embeddings for receipt ${receiptId}: ${error.message}`);
    return {
      receiptId,
      success: false,
      error: error.message,
      processingTime
    };
  }
}

/**
 * Update receipt embedding status in the database
 */
async function updateReceiptEmbeddingStatus(receiptId: string, success: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('receipts')
      .update({
        has_embeddings: success,
        embedding_status: success ? 'complete' : 'failed'
      })
      .eq('id', receiptId);

    if (error) {
      console.error(`❌ Failed to update embedding status for receipt ${receiptId}:`, error);
    } else {
      console.log(`📝 Updated embedding status for receipt ${receiptId}: ${success ? 'complete' : 'failed'}`);
    }
  } catch (error) {
    console.error(`❌ Error updating embedding status for receipt ${receiptId}:`, error.message);
  }
}

/**
 * Verify embeddings were created successfully
 */
async function verifyEmbeddingsCreated(receiptId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('unified_embeddings')
      .select('id, content_type')
      .eq('source_type', 'receipt')
      .eq('source_id', receiptId);

    if (error) {
      console.error(`❌ Error verifying embeddings for receipt ${receiptId}:`, error);
      return false;
    }

    const embeddingCount = data?.length || 0;
    console.log(`🔍 Verified ${embeddingCount} embeddings created for receipt ${receiptId}`);
    
    if (data && data.length > 0) {
      const contentTypes = data.map(e => e.content_type).join(', ');
      console.log(`   Content types: ${contentTypes}`);
    }

    return embeddingCount > 0;
  } catch (error) {
    console.error(`❌ Error verifying embeddings for receipt ${receiptId}:`, error.message);
    return false;
  }
}

/**
 * Process receipts in batches with proper error handling and rate limiting
 */
async function processBatch(receipts: ReceiptData[], batchSize: number = 3): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  
  for (let i = 0; i < receipts.length; i += batchSize) {
    const batch = receipts.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(receipts.length / batchSize);
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} receipts)`);
    
    // Process batch in parallel
    const batchPromises = batch.map(receipt => generateEmbeddingsForReceipt(receipt.id));
    const batchResults = await Promise.all(batchPromises);
    
    // Update database status for each receipt in the batch
    for (const result of batchResults) {
      await updateReceiptEmbeddingStatus(result.receiptId, result.success);
      
      // Verify embeddings were actually created
      if (result.success) {
        const verified = await verifyEmbeddingsCreated(result.receiptId);
        if (!verified) {
          console.log(`⚠️  Warning: Embeddings not found for receipt ${result.receiptId} despite success response`);
          result.success = false;
          result.error = 'Embeddings not found after generation';
          await updateReceiptEmbeddingStatus(result.receiptId, false);
        }
      }
    }
    
    results.push(...batchResults);
    
    // Rate limiting: wait between batches to avoid overwhelming the system
    if (i + batchSize < receipts.length) {
      console.log(`⏳ Waiting 2 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

async function generateEmbeddingsForAffectedReceipts() {
  console.log('🚀 Embedding Generation for Affected Receipts');
  console.log('==============================================');
  
  try {
    // Step 1: Get the affected receipts
    console.log('\n1. Fetching affected receipts (2025-07-07 to 2025-07-13)...');
    
    const { data: receipts, error: fetchError } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        fullText,
        has_embeddings,
        embedding_status
      `)
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .order('date', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching receipts:', fetchError);
      return;
    }

    console.log(`📊 Found ${receipts?.length || 0} receipts in affected date range`);
    
    if (!receipts || receipts.length === 0) {
      console.log('✅ No receipts found to process');
      return;
    }

    // Step 2: Filter receipts that need embedding generation
    const receiptsNeedingEmbeddings = receipts.filter(r => 
      !r.has_embeddings || r.embedding_status === 'pending' || r.embedding_status === 'failed'
    );

    console.log(`📋 ${receiptsNeedingEmbeddings.length} receipts need embedding generation`);
    
    if (receiptsNeedingEmbeddings.length === 0) {
      console.log('✅ All receipts already have embeddings');
      return;
    }

    // Step 3: Display receipts to be processed
    console.log('\n📝 Receipts to process:');
    receiptsNeedingEmbeddings.forEach((receipt, index) => {
      console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} (${receipt.id})`);
    });

    // Step 4: Process embeddings in batches
    console.log('\n2. Generating embeddings...');
    const results = await processBatch(receiptsNeedingEmbeddings, 3); // Process 3 at a time

    // Step 5: Summary
    console.log('\n3. Embedding Generation Summary');
    console.log('===============================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`📊 Total processed: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      const avgTime = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
      console.log(`⏱️  Average processing time: ${Math.round(avgTime)}ms`);
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed receipts:');
      failed.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.receiptId}: ${result.error}`);
      });
    }

    // Step 6: Final verification
    console.log('\n4. Final verification...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('receipts')
      .select('id, date, merchant, has_embeddings, embedding_status')
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .eq('has_embeddings', true)
      .eq('embedding_status', 'complete');

    if (finalError) {
      console.error('❌ Error in final verification:', finalError);
    } else {
      console.log(`✅ Final verification: ${finalCheck?.length || 0} receipts now have complete embeddings`);
    }

    console.log('\n🎉 Embedding generation process completed!');
    console.log('📋 Next steps:');
    console.log('   1. Test temporal search functionality');
    console.log('   2. Verify search results include these receipts');
    console.log('   3. Monitor for any additional issues');

  } catch (error) {
    console.error('❌ Embedding generation failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the embedding generation
generateEmbeddingsForAffectedReceipts().catch(console.error);
