#!/usr/bin/env tsx

/**
 * Bulk Receipt Review Tool
 * 
 * This script helps change receipt status from 'unreviewed' to 'reviewed' in bulk.
 * You can review all receipts or filter by specific criteria.
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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ReceiptSummary {
  id: string;
  merchant: string;
  date: string;
  total: number;
  status: string;
  created_at: string;
}

class BulkReviewTool {
  async getUnreviewedReceipts(): Promise<ReceiptSummary[]> {
    console.log('🔍 Finding unreviewed receipts...');
    
    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('id, merchant, date, total, status, created_at')
        .eq('status', 'unreviewed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`📋 Found ${receipts?.length || 0} unreviewed receipts`);
      
      if (receipts && receipts.length > 0) {
        console.log('\n   Sample unreviewed receipts:');
        receipts.slice(0, 5).forEach((receipt, index) => {
          const date = new Date(receipt.date).toLocaleDateString();
          console.log(`     ${index + 1}. ${receipt.merchant} - $${receipt.total} (${date})`);
        });
        
        if (receipts.length > 5) {
          console.log(`     ... and ${receipts.length - 5} more`);
        }
      }

      return receipts || [];
    } catch (error) {
      console.error('❌ Failed to fetch unreviewed receipts:', error.message);
      throw error;
    }
  }

  async getReceiptsByDateRange(startDate: string, endDate: string): Promise<ReceiptSummary[]> {
    console.log(`🔍 Finding receipts between ${startDate} and ${endDate}...`);
    
    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('id, merchant, date, total, status, created_at')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      console.log(`📋 Found ${receipts?.length || 0} receipts in date range`);
      
      const unreviewed = receipts?.filter(r => r.status === 'unreviewed') || [];
      const reviewed = receipts?.filter(r => r.status === 'reviewed') || [];
      
      console.log(`   📝 Unreviewed: ${unreviewed.length}`);
      console.log(`   ✅ Reviewed: ${reviewed.length}`);

      return receipts || [];
    } catch (error) {
      console.error('❌ Failed to fetch receipts by date range:', error.message);
      throw error;
    }
  }

  async bulkUpdateStatus(receiptIds: string[], newStatus: 'reviewed' | 'unreviewed'): Promise<number> {
    console.log(`\n🔄 Updating ${receiptIds.length} receipts to '${newStatus}' status...`);
    
    try {
      const { data, error } = await supabase
        .from('receipts')
        .update({ status: newStatus })
        .in('id', receiptIds)
        .select('id');

      if (error) throw error;

      const updatedCount = data?.length || 0;
      console.log(`✅ Successfully updated ${updatedCount} receipts`);
      
      return updatedCount;
    } catch (error) {
      console.error('❌ Failed to bulk update receipts:', error.message);
      throw error;
    }
  }

  async reviewAllUnreviewed(): Promise<void> {
    console.log('🎯 Reviewing ALL unreviewed receipts');
    console.log('===================================');

    try {
      const unreviewedReceipts = await this.getUnreviewedReceipts();
      
      if (unreviewedReceipts.length === 0) {
        console.log('\n🎉 No unreviewed receipts found! All receipts are already reviewed.');
        return;
      }

      const receiptIds = unreviewedReceipts.map(r => r.id);
      const updatedCount = await this.bulkUpdateStatus(receiptIds, 'reviewed');
      
      console.log(`\n🎉 Bulk review completed! ${updatedCount} receipts marked as reviewed.`);
      
    } catch (error) {
      console.error('❌ Bulk review failed:', error.message);
      throw error;
    }
  }

  async reviewByDateRange(startDate: string, endDate: string): Promise<void> {
    console.log(`🎯 Reviewing receipts from ${startDate} to ${endDate}`);
    console.log('================================================');

    try {
      const receipts = await this.getReceiptsByDateRange(startDate, endDate);
      const unreviewedReceipts = receipts.filter(r => r.status === 'unreviewed');
      
      if (unreviewedReceipts.length === 0) {
        console.log('\n🎉 No unreviewed receipts found in this date range!');
        return;
      }

      const receiptIds = unreviewedReceipts.map(r => r.id);
      const updatedCount = await this.bulkUpdateStatus(receiptIds, 'reviewed');
      
      console.log(`\n🎉 Date range review completed! ${updatedCount} receipts marked as reviewed.`);
      
    } catch (error) {
      console.error('❌ Date range review failed:', error.message);
      throw error;
    }
  }

  async showStats(): Promise<void> {
    console.log('📊 Receipt Status Statistics');
    console.log('============================');

    try {
      const { data: stats, error } = await supabase
        .from('receipts')
        .select('status')
        .not('status', 'is', null);

      if (error) throw error;

      const statusCounts = stats?.reduce((acc, receipt) => {
        const status = receipt.status || 'unreviewed';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const total = stats?.length || 0;
      
      console.log(`📈 Total Receipts: ${total}`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        const icon = status === 'reviewed' ? '✅' : '📝';
        console.log(`   ${icon} ${status}: ${count} (${percentage}%)`);
      });

    } catch (error) {
      console.error('❌ Failed to get statistics:', error.message);
    }
  }

  async run(): Promise<void> {
    console.log('📝 Bulk Receipt Review Tool');
    console.log('===========================');
    console.log('This tool helps you change receipt status from unreviewed to reviewed.\n');

    try {
      // Show current statistics
      await this.showStats();
      
      // Get command line arguments
      const args = process.argv.slice(2);
      const command = args[0];

      if (command === 'all') {
        await this.reviewAllUnreviewed();
      } else if (command === 'date' && args[1] && args[2]) {
        const startDate = args[1];
        const endDate = args[2];
        await this.reviewByDateRange(startDate, endDate);
      } else if (command === 'stats') {
        // Stats already shown above
        console.log('\n✅ Statistics displayed above.');
      } else {
        console.log('\n📖 Usage:');
        console.log('   npx tsx scripts/bulk-review-receipts.ts all                    # Review all unreviewed receipts');
        console.log('   npx tsx scripts/bulk-review-receipts.ts date 2024-01-01 2024-12-31  # Review receipts in date range');
        console.log('   npx tsx scripts/bulk-review-receipts.ts stats                  # Show statistics only');
        console.log('\n💡 Examples:');
        console.log('   npx tsx scripts/bulk-review-receipts.ts all');
        console.log('   npx tsx scripts/bulk-review-receipts.ts date 2024-06-01 2024-06-30');
      }
      
    } catch (error) {
      console.error('\n💥 Tool failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the tool
const reviewTool = new BulkReviewTool();
reviewTool.run().catch(console.error);
