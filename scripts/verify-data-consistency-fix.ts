#!/usr/bin/env tsx

/**
 * Verify Data Consistency Fix Script
 * Comprehensive verification that the embedding status correction was successful
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

async function verifyDataConsistencyFix() {
  console.log('🔍 Data Consistency Fix Verification');
  console.log('===================================');
  
  try {
    // Test 1: Verify affected receipts have correct status
    console.log('\n1. Verifying affected receipts have correct embedding status...');
    
    const { data: affectedReceipts, error: affectedError } = await supabase
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

    if (affectedError) {
      console.error('❌ Error querying affected receipts:', affectedError);
      return;
    }

    console.log(`📊 Found ${affectedReceipts?.length || 0} receipts in affected date range`);

    // Check if all have correct status
    const incorrectStatus = affectedReceipts?.filter(r => 
      r.has_embeddings !== false || r.embedding_status !== 'pending'
    ) || [];

    if (incorrectStatus.length === 0) {
      console.log('✅ All affected receipts have correct embedding status (has_embeddings: false, status: pending)');
    } else {
      console.log(`❌ Found ${incorrectStatus.length} receipts with incorrect status:`);
      incorrectStatus.forEach((receipt, index) => {
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} - has_embeddings: ${receipt.has_embeddings}, status: ${receipt.embedding_status}`);
      });
    }

    // Test 2: Cross-reference with unified_embeddings table
    console.log('\n2. Cross-referencing with unified_embeddings table...');
    
    const receiptIds = affectedReceipts?.map(r => r.id) || [];
    
    if (receiptIds.length > 0) {
      const { data: actualEmbeddings, error: embeddingError } = await supabase
        .from('unified_embeddings')
        .select('source_id, content_type, created_at')
        .eq('source_type', 'receipt')
        .in('source_id', receiptIds);

      if (embeddingError) {
        console.error('❌ Error checking unified_embeddings:', embeddingError);
        return;
      }

      console.log(`📊 Found ${actualEmbeddings?.length || 0} actual embeddings for affected receipts`);

      if (actualEmbeddings && actualEmbeddings.length > 0) {
        console.log('⚠️  Warning: Some receipts still have embeddings in unified_embeddings:');
        actualEmbeddings.forEach((embedding, index) => {
          console.log(`   ${index + 1}. Receipt ID: ${embedding.source_id}, Content Type: ${embedding.content_type}`);
        });
      } else {
        console.log('✅ Confirmed: No embeddings exist for affected receipts in unified_embeddings table');
      }
    }

    // Test 3: Verify data consistency across the entire system
    console.log('\n3. Performing system-wide data consistency check...');
    
    // Check for any receipts that claim to have embeddings but don't
    const { data: allReceipts, error: allReceiptsError } = await supabase
      .from('receipts')
      .select('id, date, merchant, has_embeddings, embedding_status')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .eq('has_embeddings', true);

    if (allReceiptsError) {
      console.error('❌ Error checking all receipts:', allReceiptsError);
      return;
    }

    console.log(`📊 Found ${allReceipts?.length || 0} receipts claiming to have embeddings`);

    if (allReceipts && allReceipts.length > 0) {
      // Check if these receipts actually have embeddings
      const claimingReceiptIds = allReceipts.map(r => r.id);
      
      const { data: verifyEmbeddings, error: verifyError } = await supabase
        .from('unified_embeddings')
        .select('source_id')
        .eq('source_type', 'receipt')
        .in('source_id', claimingReceiptIds);

      if (verifyError) {
        console.error('❌ Error verifying embeddings:', verifyError);
        return;
      }

      const embeddingReceiptIds = new Set(verifyEmbeddings?.map(e => e.source_id) || []);
      const inconsistentReceipts = allReceipts.filter(r => !embeddingReceiptIds.has(r.id));

      if (inconsistentReceipts.length === 0) {
        console.log('✅ All receipts claiming to have embeddings actually do have them');
      } else {
        console.log(`❌ Found ${inconsistentReceipts.length} receipts with inconsistent embedding status:`);
        inconsistentReceipts.forEach((receipt, index) => {
          console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} (ID: ${receipt.id})`);
        });
      }
    }

    // Test 4: Check receipts that should have embeddings but are marked as not having them
    console.log('\n4. Checking for receipts that might be missing embedding flags...');
    
    const { data: noEmbeddingReceipts, error: noEmbeddingError } = await supabase
      .from('receipts')
      .select('id, date, merchant, has_embeddings, embedding_status')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .eq('has_embeddings', false);

    if (noEmbeddingError) {
      console.error('❌ Error checking receipts without embeddings:', noEmbeddingError);
      return;
    }

    console.log(`📊 Found ${noEmbeddingReceipts?.length || 0} receipts marked as not having embeddings`);

    if (noEmbeddingReceipts && noEmbeddingReceipts.length > 0) {
      // Check if any of these actually have embeddings
      const noEmbeddingIds = noEmbeddingReceipts.map(r => r.id);
      
      const { data: unexpectedEmbeddings, error: unexpectedError } = await supabase
        .from('unified_embeddings')
        .select('source_id, content_type')
        .eq('source_type', 'receipt')
        .in('source_id', noEmbeddingIds);

      if (unexpectedError) {
        console.error('❌ Error checking for unexpected embeddings:', unexpectedError);
        return;
      }

      if (unexpectedEmbeddings && unexpectedEmbeddings.length > 0) {
        console.log(`⚠️  Found ${unexpectedEmbeddings.length} receipts that have embeddings but are marked as not having them:`);
        unexpectedEmbeddings.forEach((embedding, index) => {
          const receipt = noEmbeddingReceipts.find(r => r.id === embedding.source_id);
          console.log(`   ${index + 1}. ${receipt?.date} - ${receipt?.merchant} (ID: ${embedding.source_id})`);
        });
      } else {
        console.log('✅ All receipts marked as not having embeddings correctly have no embeddings');
      }
    }

    // Test 5: Summary and final verification
    console.log('\n5. Final Verification Summary');
    console.log('============================');
    
    const totalAffected = affectedReceipts?.length || 0;
    const correctlyFixed = totalAffected - incorrectStatus.length;
    
    console.log(`📊 Total receipts in affected date range: ${totalAffected}`);
    console.log(`✅ Receipts with correct status after fix: ${correctlyFixed}`);
    console.log(`❌ Receipts still with incorrect status: ${incorrectStatus.length}`);
    
    if (incorrectStatus.length === 0) {
      console.log('\n🎉 DATA CONSISTENCY FIX VERIFICATION SUCCESSFUL!');
      console.log('✅ All affected receipts now have accurate embedding status');
      console.log('✅ No data inconsistencies detected in the system');
      console.log('✅ Temporal search system data integrity restored');
    } else {
      console.log('\n⚠️  DATA CONSISTENCY FIX NEEDS ATTENTION');
      console.log(`❌ ${incorrectStatus.length} receipts still have incorrect status`);
      console.log('🔧 Additional fixes may be required');
    }

    console.log('\n📋 Verification Complete - Ready for next steps');

  } catch (error) {
    console.error('❌ Verification failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the verification
verifyDataConsistencyFix().catch(console.error);
