#!/usr/bin/env tsx

/**
 * Fixed Embedding Generation for Receipts with Merchant Names Only
 * Generates embeddings using merchant names when fullText is not available
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
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY');
  process.exit(1);
}

// Initialize Supabase client
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
  total: number;
  currency: string;
  user_id: string;
}

/**
 * Validate and convert embedding dimensions (from vector-validation.ts)
 */
function validateAndConvertEmbedding(embedding: number[], targetDimensions: number = 1536): number[] {
  // Validate input embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding: must be a non-empty array');
  }

  // Validate all values are finite numbers
  if (!embedding.every(val => Number.isFinite(val))) {
    throw new Error('Embedding contains NaN or infinite values');
  }

  let convertedEmbedding = embedding;

  // Handle dimension conversion if needed
  if (embedding.length !== targetDimensions) {
    console.log(`🔧 Converting embedding dimensions from ${embedding.length} to ${targetDimensions}`);

    if (embedding.length < targetDimensions) {
      if (embedding.length === 768 && targetDimensions === 1536) {
        // Standard Gemini 768 -> 1536 conversion
        console.log('🔧 Applying standard Gemini 768->1536 conversion');
        convertedEmbedding = embedding.flatMap((val: number) => [val, val]);
      } else {
        // Pad with zeros for other cases
        console.log(`🔧 Padding embedding from ${embedding.length} to ${targetDimensions} dimensions`);
        const normalizationFactor = Math.sqrt(targetDimensions / embedding.length);
        const normalizedEmbedding = embedding.map((val: number) => val * normalizationFactor);
        const padding = new Array(targetDimensions - embedding.length).fill(0);
        convertedEmbedding = [...normalizedEmbedding, ...padding];
      }
    } else if (embedding.length > targetDimensions) {
      console.warn(`🔧 Embedding too large: ${embedding.length} dimensions. Reducing to ${targetDimensions}`);
      convertedEmbedding = embedding.slice(0, targetDimensions);
    }
  }

  // Final validation
  if (convertedEmbedding.length !== targetDimensions) {
    throw new Error(`Embedding dimension validation failed after conversion: ${convertedEmbedding.length} != ${targetDimensions}`);
  }

  // Normalize the final embedding vector to unit length
  const magnitude = Math.sqrt(convertedEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
  if (magnitude > 0) {
    convertedEmbedding = convertedEmbedding.map((val: number) => val / magnitude);
  }

  console.log(`🔧 Embedding validation passed: ${convertedEmbedding.length} dimensions, magnitude: ${magnitude.toFixed(6)}`);
  return convertedEmbedding;
}

/**
 * Generate embedding using Google Gemini API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log(`🔄 Generating embedding for text: "${text.substring(0, 50)}..."`);

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
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const embedding = result.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from Gemini API');
    }

    console.log(`✅ Generated embedding with ${embedding.length} dimensions`);

    // Convert to 1536 dimensions using the same logic as the edge function
    const convertedEmbedding = validateAndConvertEmbedding(embedding, 1536);

    return convertedEmbedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Store embedding directly in unified_embeddings table using add_unified_embedding function
 */
async function storeEmbedding(
  receiptId: string,
  contentType: string,
  contentText: string,
  embedding: number[],
  metadata: any,
  userId: string
): Promise<string> {
  try {
    console.log(`📝 Storing ${contentType} embedding for receipt ${receiptId}`);
    
    const { data, error } = await supabase.rpc('add_unified_embedding', {
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

    console.log(`✅ Successfully stored ${contentType} embedding for receipt ${receiptId}`);
    return data;
  } catch (error) {
    console.error(`❌ Error storing embedding for receipt ${receiptId}:`, error.message);
    throw error;
  }
}

/**
 * Generate and store embeddings for a single receipt using merchant name
 */
async function processReceiptEmbedding(receipt: ReceiptData): Promise<boolean> {
  try {
    console.log(`\n🔄 Processing receipt ${receipt.id} - ${receipt.merchant}`);
    
    // Use merchant name as the primary content for embedding
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
      embedding_method: 'direct_api_call',
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

    console.log(`✅ Successfully processed receipt ${receipt.id}`);
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
 * Test with a single receipt first
 */
async function testSingleReceipt(): Promise<boolean> {
  console.log('🧪 Testing with a single receipt...');
  
  try {
    // Get one receipt from the affected date range
    const { data: testReceipt, error } = await supabase
      .from('receipts')
      .select('id, date, merchant, total, currency, user_id')
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .limit(1)
      .single();

    if (error || !testReceipt) {
      console.error('❌ No test receipt found:', error);
      return false;
    }

    console.log(`📋 Testing with receipt: ${testReceipt.date} - ${testReceipt.merchant}`);
    
    const success = await processReceiptEmbedding(testReceipt);
    
    if (success) {
      // Verify the embedding was actually stored
      const { data: verification, error: verifyError } = await supabase
        .from('unified_embeddings')
        .select('id, content_type, content_text')
        .eq('source_type', 'receipt')
        .eq('source_id', testReceipt.id);

      if (verifyError) {
        console.error('❌ Error verifying embedding:', verifyError);
        return false;
      }

      if (verification && verification.length > 0) {
        console.log(`✅ Test successful! Found ${verification.length} embeddings:`);
        verification.forEach(emb => {
          console.log(`   - ${emb.content_type}: "${emb.content_text}"`);
        });
        return true;
      } else {
        console.log('❌ Test failed: No embeddings found after processing');
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

/**
 * Process all affected receipts
 */
async function processAllAffectedReceipts(): Promise<void> {
  console.log('\n🚀 Processing all affected receipts...');
  
  try {
    // Get all affected receipts
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, date, merchant, total, currency, user_id')
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .order('date', { ascending: true });

    if (error || !receipts) {
      console.error('❌ Error fetching receipts:', error);
      return;
    }

    console.log(`📊 Found ${receipts.length} receipts to process`);
    
    let successful = 0;
    let failed = 0;

    // Process receipts in small batches to avoid overwhelming the API
    const batchSize = 2;
    for (let i = 0; i < receipts.length; i += batchSize) {
      const batch = receipts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(receipts.length / batchSize);
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} receipts)`);
      
      // Process batch sequentially to avoid rate limits
      for (const receipt of batch) {
        const success = await processReceiptEmbedding(receipt);
        if (success) {
          successful++;
        } else {
          failed++;
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

    // Final summary
    console.log('\n📊 Processing Summary');
    console.log('====================');
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${receipts.length}`);
    
    if (successful > 0) {
      console.log('\n🎉 Embedding generation completed successfully!');
      console.log('📋 Next steps:');
      console.log('   1. Test temporal search functionality');
      console.log('   2. Verify search results include these receipts');
    }
    
  } catch (error) {
    console.error('❌ Error processing receipts:', error.message);
  }
}

async function main() {
  console.log('🔧 Fixed Embedding Generation for Merchant-Only Receipts');
  console.log('========================================================');
  
  try {
    // Step 1: Test with a single receipt
    console.log('\n1. Testing with single receipt...');
    const testSuccess = await testSingleReceipt();
    
    if (!testSuccess) {
      console.log('❌ Single receipt test failed. Aborting bulk processing.');
      return;
    }
    
    console.log('✅ Single receipt test passed! Proceeding with bulk processing...');
    
    // Step 2: Process all affected receipts
    console.log('\n2. Processing all affected receipts...');
    await processAllAffectedReceipts();
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
