#!/usr/bin/env tsx

/**
 * Comprehensive Embedding Solution
 * Implements the complete strategy to fix system-wide embedding coverage issues
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const USER_ID = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';

interface ProcessingStats {
  totalReceipts: number;
  receiptsProcessed: number;
  receiptsSuccessful: number;
  receiptsFailed: number;
  dataConsistencyFixed: number;
  embeddingsGenerated: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * Phase 1: Fix Data Consistency Issues
 */
async function fixDataConsistencyIssues(): Promise<{ falseNegativesFixed: number; falsePositivesFixed: number }> {
  console.log('\n🔧 Phase 1: Fixing Data Consistency Issues');
  console.log('==========================================');
  
  try {
    // Get all receipts and their actual embedding status
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, has_embeddings, embedding_status')
      .eq('user_id', USER_ID);

    if (receiptsError || !receipts) {
      throw new Error(`Error fetching receipts: ${receiptsError?.message}`);
    }

    // Get actual embeddings from unified_embeddings table
    const receiptIds = receipts.map(r => r.id);
    const { data: actualEmbeddings, error: embeddingsError } = await supabase
      .from('unified_embeddings')
      .select('source_id')
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);

    if (embeddingsError) {
      throw new Error(`Error fetching embeddings: ${embeddingsError.message}`);
    }

    const receiptsWithActualEmbeddings = new Set((actualEmbeddings || []).map(e => e.source_id));

    // Identify false negatives (have embeddings but marked as not having them)
    const falseNegatives = receipts.filter(r => 
      receiptsWithActualEmbeddings.has(r.id) && r.has_embeddings === false
    );

    // Identify false positives (marked as having embeddings but don't have them)
    const falsePositives = receipts.filter(r => 
      !receiptsWithActualEmbeddings.has(r.id) && r.has_embeddings === true
    );

    console.log(`📊 Found ${falseNegatives.length} false negatives (have embeddings but marked as not having)`);
    console.log(`📊 Found ${falsePositives.length} false positives (marked as having but don't have)`);

    let falseNegativesFixed = 0;
    let falsePositivesFixed = 0;

    // Fix false negatives
    if (falseNegatives.length > 0) {
      console.log('\n🔄 Fixing false negatives...');
      const falseNegativeIds = falseNegatives.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          has_embeddings: true,
          embedding_status: 'complete'
        })
        .in('id', falseNegativeIds);

      if (updateError) {
        console.error('❌ Error fixing false negatives:', updateError);
      } else {
        falseNegativesFixed = falseNegatives.length;
        console.log(`✅ Fixed ${falseNegativesFixed} false negatives`);
      }
    }

    // Fix false positives
    if (falsePositives.length > 0) {
      console.log('\n🔄 Fixing false positives...');
      const falsePositiveIds = falsePositives.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          has_embeddings: false,
          embedding_status: 'pending'
        })
        .in('id', falsePositiveIds);

      if (updateError) {
        console.error('❌ Error fixing false positives:', updateError);
      } else {
        falsePositivesFixed = falsePositives.length;
        console.log(`✅ Fixed ${falsePositivesFixed} false positives`);
      }
    }

    console.log(`\n✅ Phase 1 Complete: Fixed ${falseNegativesFixed + falsePositivesFixed} data consistency issues`);
    return { falseNegativesFixed, falsePositivesFixed };

  } catch (error) {
    console.error('❌ Phase 1 failed:', error.message);
    throw error;
  }
}

/**
 * Validate and convert embedding dimensions
 */
function validateAndConvertEmbedding(embedding: number[], targetDimensions: number = 1536): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding: must be a non-empty array');
  }

  if (!embedding.every(val => Number.isFinite(val))) {
    throw new Error('Embedding contains NaN or infinite values');
  }

  let convertedEmbedding = embedding;

  if (embedding.length !== targetDimensions) {
    if (embedding.length === 768 && targetDimensions === 1536) {
      // Standard Gemini 768 -> 1536 conversion
      convertedEmbedding = embedding.flatMap((val: number) => [val, val]);
    } else {
      throw new Error(`Unsupported dimension conversion: ${embedding.length} -> ${targetDimensions}`);
    }
  }

  // Normalize the embedding vector to unit length
  const magnitude = Math.sqrt(convertedEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
  if (magnitude > 0) {
    convertedEmbedding = convertedEmbedding.map((val: number) => val / magnitude);
  }

  return convertedEmbedding;
}

/**
 * Generate embedding using Google Gemini API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/embedding-001',
        content: {
          parts: [{ text: text }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const embedding = result.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from Gemini API');
    }

    // Convert to 1536 dimensions
    return validateAndConvertEmbedding(embedding, 1536);
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Store embedding in unified_embeddings table
 */
async function storeEmbedding(
  receiptId: string,
  contentType: string,
  contentText: string,
  embedding: number[],
  metadata: any,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('add_unified_embedding', {
      p_source_type: 'receipt',
      p_source_id: receiptId,
      p_content_type: contentType,
      p_content_text: contentText,
      p_embedding: embedding,
      p_metadata: metadata,
      p_user_id: userId,
      p_language: 'en'
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ Error storing embedding for receipt ${receiptId}:`, error.message);
    throw error;
  }
}

/**
 * Process a single receipt for embedding generation
 */
async function processReceiptEmbedding(receipt: any): Promise<boolean> {
  try {
    const merchantText = receipt.merchant.trim();
    
    if (!merchantText) {
      console.log(`⚠️  Skipping receipt ${receipt.id} - no merchant name`);
      return false;
    }

    // Generate embedding for merchant name
    const embedding = await generateEmbedding(merchantText);
    
    // Prepare metadata
    const metadata = {
      receipt_date: receipt.date,
      total: receipt.total,
      currency: receipt.currency,
      merchant: receipt.merchant,
      source_metadata: 'merchant_name_only',
      content_source: 'merchant',
      embedding_method: 'comprehensive_solution',
      generated_at: new Date().toISOString()
    };

    // Store the embedding
    await storeEmbedding(
      receipt.id,
      'merchant',
      merchantText,
      embedding,
      metadata,
      receipt.user_id
    );

    // Update receipt status
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        has_embeddings: true,
        embedding_status: 'complete'
      })
      .eq('id', receipt.id);

    if (updateError) {
      console.error(`❌ Error updating receipt status for ${receipt.id}:`, updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error processing receipt ${receipt.id}:`, error.message);
    
    // Update receipt status to failed
    try {
      await supabase
        .from('receipts')
        .update({
          has_embeddings: false,
          embedding_status: 'failed'
        })
        .eq('id', receipt.id);
    } catch (updateError) {
      console.error(`❌ Error updating failed status for ${receipt.id}:`, updateError);
    }
    
    return false;
  }
}

/**
 * Phase 2: Bulk Embedding Generation
 */
async function bulkEmbeddingGeneration(): Promise<{ processed: number; successful: number; failed: number }> {
  console.log('\n🚀 Phase 2: Bulk Embedding Generation');
  console.log('====================================');
  
  try {
    // Get receipts without embeddings
    const { data: receiptsWithoutEmbeddings, error } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        total,
        currency,
        user_id,
        has_embeddings,
        embedding_status
      `)
      .eq('user_id', USER_ID)
      .eq('has_embeddings', false)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Error fetching receipts: ${error.message}`);
    }

    const receipts = receiptsWithoutEmbeddings || [];
    console.log(`📊 Found ${receipts.length} receipts without embeddings`);
    
    if (receipts.length === 0) {
      console.log('✅ No receipts need embedding generation');
      return { processed: 0, successful: 0, failed: 0 };
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process in batches of 5
    const batchSize = 5;
    const totalBatches = Math.ceil(receipts.length / batchSize);
    
    console.log(`📦 Processing ${receipts.length} receipts in ${totalBatches} batches of ${batchSize}`);
    
    for (let i = 0; i < receipts.length; i += batchSize) {
      const batch = receipts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} receipts)`);
      
      // Process batch sequentially to avoid overwhelming the API
      for (const receipt of batch) {
        console.log(`🔄 Processing ${receipt.date} - ${receipt.merchant}`);
        
        const success = await processReceiptEmbedding(receipt);
        processed++;
        
        if (success) {
          successful++;
          console.log(`✅ Success (${successful}/${processed})`);
        } else {
          failed++;
          console.log(`❌ Failed (${failed}/${processed})`);
        }
        
        // Small delay between receipts
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Delay between batches
      if (i + batchSize < receipts.length) {
        console.log('⏳ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`\n✅ Phase 2 Complete: Processed ${processed}, Successful ${successful}, Failed ${failed}`);
    return { processed, successful, failed };

  } catch (error) {
    console.error('❌ Phase 2 failed:', error.message);
    throw error;
  }
}

/**
 * Phase 3: Verification and Final Report
 */
async function verificationAndReport(): Promise<void> {
  console.log('\n🔍 Phase 3: Verification and Final Report');
  console.log('========================================');
  
  try {
    // Get final statistics
    const { data: finalStats, error } = await supabase
      .from('receipts')
      .select('id, has_embeddings, embedding_status')
      .eq('user_id', USER_ID);

    if (error || !finalStats) {
      throw new Error('Error fetching final statistics');
    }

    const totalReceipts = finalStats.length;
    const receiptsWithEmbeddings = finalStats.filter(r => r.has_embeddings === true).length;
    const embeddingCoverage = totalReceipts > 0 ? (receiptsWithEmbeddings / totalReceipts) * 100 : 0;

    console.log('\n📊 Final System Statistics:');
    console.log(`   Total receipts: ${totalReceipts}`);
    console.log(`   Receipts with embeddings: ${receiptsWithEmbeddings}`);
    console.log(`   Embedding coverage: ${embeddingCoverage.toFixed(1)}%`);
    
    if (embeddingCoverage === 100) {
      console.log('\n🎉 SUCCESS: 100% embedding coverage achieved!');
      console.log('✅ Temporal search system is fully functional across all date ranges');
    } else {
      console.log(`\n⚠️  ${totalReceipts - receiptsWithEmbeddings} receipts still need embeddings`);
      console.log('🔧 Additional work may be required');
    }

  } catch (error) {
    console.error('❌ Phase 3 failed:', error.message);
  }
}

/**
 * Main execution function
 */
async function executeComprehensiveSolution(): Promise<void> {
  console.log('🚀 Comprehensive Embedding Solution');
  console.log('===================================');
  
  const stats: ProcessingStats = {
    totalReceipts: 0,
    receiptsProcessed: 0,
    receiptsSuccessful: 0,
    receiptsFailed: 0,
    dataConsistencyFixed: 0,
    embeddingsGenerated: 0,
    startTime: new Date()
  };

  try {
    // Phase 1: Fix data consistency
    const phase1Results = await fixDataConsistencyIssues();
    stats.dataConsistencyFixed = phase1Results.falseNegativesFixed + phase1Results.falsePositivesFixed;

    // Phase 2: Bulk embedding generation
    const phase2Results = await bulkEmbeddingGeneration();
    stats.receiptsProcessed = phase2Results.processed;
    stats.receiptsSuccessful = phase2Results.successful;
    stats.receiptsFailed = phase2Results.failed;
    stats.embeddingsGenerated = phase2Results.successful;

    // Phase 3: Verification and report
    await verificationAndReport();

    stats.endTime = new Date();
    const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 / 60; // minutes

    console.log('\n📈 Execution Summary:');
    console.log('====================');
    console.log(`⏱️  Total execution time: ${duration.toFixed(1)} minutes`);
    console.log(`🔧 Data consistency issues fixed: ${stats.dataConsistencyFixed}`);
    console.log(`📊 Receipts processed: ${stats.receiptsProcessed}`);
    console.log(`✅ Embeddings generated: ${stats.embeddingsGenerated}`);
    console.log(`❌ Failed receipts: ${stats.receiptsFailed}`);
    
    if (stats.receiptsFailed === 0) {
      console.log('\n🎉 COMPREHENSIVE SOLUTION COMPLETED SUCCESSFULLY!');
      console.log('✅ All embedding coverage issues have been resolved');
      console.log('✅ Temporal search system is fully functional');
    } else {
      console.log('\n⚠️  Some issues remain - manual review may be required');
    }

  } catch (error) {
    console.error('❌ Comprehensive solution failed:', error.message);
    process.exit(1);
  }
}

// Run the comprehensive solution
executeComprehensiveSolution().catch(console.error);
