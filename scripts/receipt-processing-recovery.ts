#!/usr/bin/env tsx

/**
 * Receipt Processing Recovery Tool
 * 
 * This script helps recover receipts that were processed before the line item bug was fixed.
 * It identifies receipts missing line items and re-processes them through the fixed function.
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
const BATCH_SIZE = 5; // Process 5 receipts at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
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

interface RecoveryStats {
  totalReceipts: number;
  receiptsWithLineItems: number;
  receiptsWithoutLineItems: number;
  processedSuccessfully: number;
  processingFailed: number;
  skipped: number;
}

interface ReceiptToRecover {
  id: string;
  merchant: string;
  image_url: string;
  user_id: string;
  created_at: string;
  processing_status: string;
}

class ReceiptRecoveryTool {
  private stats: RecoveryStats = {
    totalReceipts: 0,
    receiptsWithLineItems: 0,
    receiptsWithoutLineItems: 0,
    processedSuccessfully: 0,
    processingFailed: 0,
    skipped: 0
  };

  async analyzeCurrentState(): Promise<void> {
    console.log('🔍 Analyzing Current Database State');
    console.log('=====================================');

    try {
      // Get total receipts count
      const { count: totalCount, error: totalError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;
      this.stats.totalReceipts = totalCount || 0;

      // Get receipts with line items using a different approach
      const { data: receiptsWithLineItems, error: withLineItemsError } = await supabase
        .from('line_items')
        .select('receipt_id')
        .not('receipt_id', 'is', null);

      if (withLineItemsError) throw withLineItemsError;

      // Get unique receipt IDs that have line items
      const uniqueReceiptIds = new Set(receiptsWithLineItems?.map(item => item.receipt_id) || []);
      this.stats.receiptsWithLineItems = uniqueReceiptIds.size;
      this.stats.receiptsWithoutLineItems = this.stats.totalReceipts - this.stats.receiptsWithLineItems;

      console.log(`📊 Database Analysis Results:`);
      console.log(`   Total Receipts: ${this.stats.totalReceipts}`);
      console.log(`   Receipts WITH Line Items: ${this.stats.receiptsWithLineItems}`);
      console.log(`   Receipts WITHOUT Line Items: ${this.stats.receiptsWithoutLineItems}`);
      console.log(`   Recovery Needed: ${this.stats.receiptsWithoutLineItems > 0 ? 'YES' : 'NO'}`);

    } catch (error) {
      console.error('❌ Failed to analyze database state:', error.message);
      throw error;
    }
  }

  async getReceiptsToRecover(): Promise<ReceiptToRecover[]> {
    console.log('\n🎯 Identifying Receipts for Recovery');
    console.log('====================================');

    try {
      // First, get all receipt IDs that have line items
      const { data: receiptIdsWithLineItems, error: lineItemError } = await supabase
        .from('line_items')
        .select('receipt_id');

      if (lineItemError) throw lineItemError;

      const receiptIdsWithLineItemsSet = new Set(
        receiptIdsWithLineItems?.map(item => item.receipt_id) || []
      );

      // Then get all receipts
      const { data: allReceipts, error: receiptsError } = await supabase
        .from('receipts')
        .select(`
          id,
          merchant,
          image_url,
          user_id,
          created_at,
          processing_status
        `);

      if (receiptsError) throw receiptsError;

      // Filter out receipts that already have line items
      const receiptsWithoutLineItems = allReceipts?.filter(
        receipt => !receiptIdsWithLineItemsSet.has(receipt.id)
      ) || [];

      const receiptsToRecover = receiptsWithoutLineItems;
      
      console.log(`📋 Found ${receiptsToRecover.length} receipts to recover:`);
      
      if (receiptsToRecover.length > 0) {
        console.log('\n   Sample receipts:');
        receiptsToRecover.slice(0, 5).forEach((receipt, index) => {
          console.log(`     ${index + 1}. ${receipt.merchant} (${receipt.id.substring(0, 8)}...)`);
        });
        
        if (receiptsToRecover.length > 5) {
          console.log(`     ... and ${receiptsToRecover.length - 5} more`);
        }
      }

      return receiptsToRecover;

    } catch (error) {
      console.error('❌ Failed to identify receipts for recovery:', error.message);
      throw error;
    }
  }

  async processReceiptBatch(receipts: ReceiptToRecover[]): Promise<void> {
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-receipt`;
    
    for (const receipt of receipts) {
      try {
        console.log(`   Processing: ${receipt.merchant} (${receipt.id.substring(0, 8)}...)`);
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            receiptId: receipt.id,
            imageUrl: receipt.image_url,
            userId: receipt.user_id,
            processingMethod: 'ai-vision'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`     ❌ Failed: ${response.status} - ${errorText}`);
          this.stats.processingFailed++;
          continue;
        }

        const result = await response.json();
        const lineItemsCount = result.result?.line_items?.length || 0;
        
        console.log(`     ✅ Success: ${lineItemsCount} line items extracted`);
        this.stats.processedSuccessfully++;

      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        this.stats.processingFailed++;
      }
    }
  }

  async runRecovery(): Promise<void> {
    console.log('\n🚀 Starting Receipt Processing Recovery');
    console.log('=======================================');

    try {
      const receiptsToRecover = await this.getReceiptsToRecover();
      
      if (receiptsToRecover.length === 0) {
        console.log('\n🎉 No receipts need recovery! All receipts have line items.');
        return;
      }

      console.log(`\n📦 Processing ${receiptsToRecover.length} receipts in batches of ${BATCH_SIZE}`);
      console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
      
      // Process in batches
      for (let i = 0; i < receiptsToRecover.length; i += BATCH_SIZE) {
        const batch = receiptsToRecover.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(receiptsToRecover.length / BATCH_SIZE);
        
        console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches} (${batch.length} receipts):`);
        
        await this.processReceiptBatch(batch);
        
        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < receiptsToRecover.length) {
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

    } catch (error) {
      console.error('❌ Recovery process failed:', error.message);
      throw error;
    }
  }

  async verifyRecovery(): Promise<void> {
    console.log('\n🔍 Verifying Recovery Results');
    console.log('=============================');

    try {
      // Re-analyze the state after recovery
      await this.analyzeCurrentState();
      
      console.log('\n📊 Recovery Summary:');
      console.log(`   ✅ Successfully Processed: ${this.stats.processedSuccessfully}`);
      console.log(`   ❌ Failed to Process: ${this.stats.processingFailed}`);
      console.log(`   ⏭️  Skipped: ${this.stats.skipped}`);
      console.log(`   📈 Recovery Rate: ${this.stats.processedSuccessfully > 0 ? 
        ((this.stats.processedSuccessfully / (this.stats.processedSuccessfully + this.stats.processingFailed)) * 100).toFixed(1) : 0}%`);

    } catch (error) {
      console.error('❌ Failed to verify recovery:', error.message);
    }
  }

  async run(): Promise<void> {
    console.log('🏥 Receipt Processing Recovery Tool');
    console.log('===================================');
    console.log('This tool will recover receipts that are missing line items.\n');

    try {
      await this.analyzeCurrentState();
      await this.runRecovery();
      await this.verifyRecovery();
      
      console.log('\n🎉 Recovery process completed!');
      
    } catch (error) {
      console.error('\n💥 Recovery process failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the recovery tool
const recoveryTool = new ReceiptRecoveryTool();
recoveryTool.run().catch(console.error);
