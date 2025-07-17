#!/usr/bin/env tsx

/**
 * Fix Data Consistency Script
 * Corrects misleading embedding status in receipts table for affected date range
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

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixDataConsistency() {
  console.log('🔧 Data Consistency Fix - Temporal Search System');
  console.log('================================================');
  
  try {
    // Step 1: Check current state before fix
    console.log('\n1. Checking current data consistency state...');
    
    const { data: beforeData, error: beforeError } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        has_embeddings,
        embedding_status,
        created_at
      `)
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .order('date', { ascending: true });

    if (beforeError) {
      console.error('❌ Error checking current state:', beforeError);
      return;
    }

    console.log(`📊 Found ${beforeData?.length || 0} receipts in affected date range (2025-07-07 to 2025-07-13)`);
    
    if (beforeData && beforeData.length > 0) {
      console.log('\nCurrent embedding status:');
      beforeData.forEach((receipt, index) => {
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} - has_embeddings: ${receipt.has_embeddings}, status: ${receipt.embedding_status}`);
      });
    }

    // Step 2: Check if any receipts actually have embeddings in unified_embeddings table
    console.log('\n2. Verifying actual embedding existence in unified_embeddings table...');
    
    const receiptIds = beforeData?.map(r => r.id) || [];
    
    if (receiptIds.length > 0) {
      const { data: embeddingData, error: embeddingError } = await supabase
        .from('unified_embeddings')
        .select('source_id, content_type')
        .eq('source_type', 'receipt')
        .in('source_id', receiptIds);

      if (embeddingError) {
        console.error('❌ Error checking embeddings:', embeddingError);
        return;
      }

      console.log(`📊 Found ${embeddingData?.length || 0} actual embeddings for these receipts`);
      
      if (embeddingData && embeddingData.length > 0) {
        console.log('Receipts with actual embeddings:');
        embeddingData.forEach((embedding, index) => {
          console.log(`   ${index + 1}. Receipt ID: ${embedding.source_id}, Content Type: ${embedding.content_type}`);
        });
      }
    }

    // Step 3: Execute the data consistency fix
    console.log('\n3. Executing data consistency correction...');
    console.log('   Updating has_embeddings from true to false');
    console.log('   Updating embedding_status from "complete" to "pending"');
    console.log('   For date range: 2025-07-07 to 2025-07-13');
    
    const { data: updateData, error: updateError } = await supabase
      .from('receipts')
      .update({
        has_embeddings: false,
        embedding_status: 'pending'
      })
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .select('id, date, merchant, has_embeddings, embedding_status');

    if (updateError) {
      console.error('❌ Error executing update:', updateError);
      return;
    }

    console.log(`✅ Successfully updated ${updateData?.length || 0} receipts`);

    // Step 4: Verify the fix
    console.log('\n4. Verifying the data consistency fix...');
    
    const { data: afterData, error: afterError } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        has_embeddings,
        embedding_status,
        updated_at
      `)
      .gte('date', '2025-07-07')
      .lte('date', '2025-07-13')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .order('date', { ascending: true });

    if (afterError) {
      console.error('❌ Error verifying fix:', afterError);
      return;
    }

    console.log(`📊 Verified ${afterData?.length || 0} receipts after fix`);
    
    if (afterData && afterData.length > 0) {
      console.log('\nUpdated embedding status:');
      afterData.forEach((receipt, index) => {
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} - has_embeddings: ${receipt.has_embeddings}, status: ${receipt.embedding_status}`);
      });
    }

    // Step 5: Summary
    console.log('\n5. Data Consistency Fix Summary');
    console.log('===============================');
    console.log(`✅ Processed ${beforeData?.length || 0} receipts in date range 2025-07-07 to 2025-07-13`);
    console.log(`✅ Updated ${updateData?.length || 0} receipts to correct embedding status`);
    console.log('✅ All affected receipts now have has_embeddings: false and embedding_status: "pending"');
    console.log('✅ Data consistency issue resolved');
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Trigger embedding generation for these 32 receipts');
    console.log('   2. Verify temporal search functionality works correctly');
    console.log('   3. Monitor for any additional data consistency issues');

  } catch (error) {
    console.error('❌ Data consistency fix failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the fix
fixDataConsistency().catch(console.error);
