#!/usr/bin/env tsx

/**
 * Comprehensive Duplicate Receipt Detection and Management System
 * 
 * This tool provides advanced duplicate detection with multiple criteria,
 * safety features, and management options for paperless-maverick receipts.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

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

// Types
interface Receipt {
  id: string;
  user_id: string;
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  currency: string;
  payment_method?: string;
  status: string;
  image_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  predicted_category?: string;
  line_items?: LineItem[];
}

interface LineItem {
  id: string;
  receipt_id: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

interface DuplicateGroup {
  id: string;
  receipts: Receipt[];
  confidence: number;
  criteria: string[];
  recommendation: 'delete_older' | 'manual_review' | 'merge';
  analysis: {
    merchant_similarity: number;
    date_difference_days: number;
    amount_difference: number;
    payment_method_match: boolean;
    line_items_similarity?: number;
  };
}

interface DetectionCriteria {
  merchant_fuzzy_threshold: number;
  amount_tolerance: number;
  date_tolerance_days: number;
  require_payment_method_match: boolean;
  minimum_confidence: number;
}

class DuplicateReceiptManager {
  private criteria: DetectionCriteria = {
    merchant_fuzzy_threshold: 0.85, // 85% similarity for merchant names
    amount_tolerance: 0.50, // $0.50 tolerance
    date_tolerance_days: 2, // Within 2 days
    require_payment_method_match: false, // Optional payment method matching
    minimum_confidence: 0.75 // 75% minimum confidence for duplicates
  };

  private duplicateGroups: DuplicateGroup[] = [];
  private allReceipts: Receipt[] = [];

  // Fuzzy string matching using Levenshtein distance
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateDateDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateLineItemsSimilarity(items1: LineItem[], items2: LineItem[]): number {
    if (!items1?.length || !items2?.length) return 0;
    
    // Simple approach: compare total count and some descriptions
    const countSimilarity = Math.min(items1.length, items2.length) / Math.max(items1.length, items2.length);
    
    // Compare descriptions (simplified)
    let descriptionMatches = 0;
    for (const item1 of items1) {
      for (const item2 of items2) {
        if (this.calculateSimilarity(item1.description, item2.description) > 0.8) {
          descriptionMatches++;
          break;
        }
      }
    }
    
    const descriptionSimilarity = descriptionMatches / Math.max(items1.length, items2.length);
    
    return (countSimilarity + descriptionSimilarity) / 2;
  }

  async loadAllReceipts(): Promise<void> {
    console.log('📥 Loading all receipts from database...');

    try {
      // First load all receipts
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select(`
          id,
          user_id,
          merchant,
          date,
          total,
          tax,
          currency,
          payment_method,
          status,
          image_url,
          thumbnail_url,
          created_at,
          updated_at,
          predicted_category
        `)
        .order('created_at', { ascending: false });

      if (receiptsError) throw receiptsError;

      // Then load all line items separately
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('line_items')
        .select(`
          id,
          receipt_id,
          description,
          amount,
          created_at,
          updated_at
        `);

      if (lineItemsError) throw lineItemsError;

      // Group line items by receipt_id
      const lineItemsByReceipt = (lineItems || []).reduce((acc, item) => {
        if (!acc[item.receipt_id]) {
          acc[item.receipt_id] = [];
        }
        acc[item.receipt_id].push(item);
        return acc;
      }, {} as Record<string, LineItem[]>);

      // Combine receipts with their line items
      this.allReceipts = (receipts || []).map(receipt => ({
        ...receipt,
        line_items: lineItemsByReceipt[receipt.id] || []
      }));

      console.log(`✅ Loaded ${this.allReceipts.length} receipts`);
      console.log(`📋 Total line items: ${lineItems?.length || 0}`);

    } catch (error) {
      console.error('❌ Failed to load receipts:', error.message);
      throw error;
    }
  }

  async detectDuplicates(): Promise<void> {
    console.log('\n🔍 Detecting duplicate receipts...');
    console.log('===================================');
    
    const processed = new Set<string>();
    let groupId = 1;
    
    for (let i = 0; i < this.allReceipts.length; i++) {
      const receipt1 = this.allReceipts[i];
      
      if (processed.has(receipt1.id)) continue;
      
      const potentialDuplicates: Receipt[] = [receipt1];
      
      for (let j = i + 1; j < this.allReceipts.length; j++) {
        const receipt2 = this.allReceipts[j];
        
        if (processed.has(receipt2.id)) continue;
        if (receipt1.user_id !== receipt2.user_id) continue; // Only check same user
        
        const analysis = this.analyzeReceiptPair(receipt1, receipt2);
        
        if (analysis.isDuplicate) {
          potentialDuplicates.push(receipt2);
          processed.add(receipt2.id);
        }
      }
      
      if (potentialDuplicates.length > 1) {
        const group = this.createDuplicateGroup(groupId++, potentialDuplicates);
        this.duplicateGroups.push(group);
        processed.add(receipt1.id);
      }
    }
    
    console.log(`🎯 Found ${this.duplicateGroups.length} duplicate groups`);
    console.log(`📊 Total duplicate receipts: ${this.duplicateGroups.reduce((sum, group) => sum + group.receipts.length, 0)}`);
  }

  private analyzeReceiptPair(receipt1: Receipt, receipt2: Receipt): { isDuplicate: boolean; confidence: number; criteria: string[] } {
    const criteria: string[] = [];
    let score = 0;
    let maxScore = 0;
    
    // Merchant similarity (weight: 40%)
    const merchantSimilarity = this.calculateSimilarity(receipt1.merchant, receipt2.merchant);
    maxScore += 40;
    if (merchantSimilarity >= this.criteria.merchant_fuzzy_threshold) {
      score += 40 * merchantSimilarity;
      criteria.push('merchant_match');
    }
    
    // Amount similarity (weight: 30%)
    const amountDiff = Math.abs(receipt1.total - receipt2.total);
    maxScore += 30;
    if (amountDiff <= this.criteria.amount_tolerance) {
      const amountScore = Math.max(0, 1 - (amountDiff / this.criteria.amount_tolerance));
      score += 30 * amountScore;
      criteria.push('amount_match');
    }
    
    // Date similarity (weight: 20%)
    const dateDiff = this.calculateDateDifference(receipt1.date, receipt2.date);
    maxScore += 20;
    if (dateDiff <= this.criteria.date_tolerance_days) {
      const dateScore = Math.max(0, 1 - (dateDiff / this.criteria.date_tolerance_days));
      score += 20 * dateScore;
      criteria.push('date_match');
    }
    
    // Payment method (weight: 10%)
    maxScore += 10;
    if (receipt1.payment_method && receipt2.payment_method) {
      if (receipt1.payment_method.toLowerCase() === receipt2.payment_method.toLowerCase()) {
        score += 10;
        criteria.push('payment_method_match');
      }
    } else if (!this.criteria.require_payment_method_match) {
      score += 5; // Partial score if payment method is missing but not required
    }
    
    const confidence = score / maxScore;
    const isDuplicate = confidence >= this.criteria.minimum_confidence && criteria.length >= 2;
    
    return { isDuplicate, confidence, criteria };
  }

  private createDuplicateGroup(id: number, receipts: Receipt[]): DuplicateGroup {
    // Sort by creation date (newest first)
    const sortedReceipts = receipts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Analyze the group
    const firstReceipt = sortedReceipts[0];
    const lastReceipt = sortedReceipts[sortedReceipts.length - 1];
    
    const analysis = {
      merchant_similarity: this.calculateSimilarity(firstReceipt.merchant, lastReceipt.merchant),
      date_difference_days: this.calculateDateDifference(firstReceipt.date, lastReceipt.date),
      amount_difference: Math.abs(firstReceipt.total - lastReceipt.total),
      payment_method_match: firstReceipt.payment_method?.toLowerCase() === lastReceipt.payment_method?.toLowerCase(),
      line_items_similarity: this.calculateLineItemsSimilarity(firstReceipt.line_items || [], lastReceipt.line_items || [])
    };
    
    // Calculate overall confidence
    const pairAnalysis = this.analyzeReceiptPair(firstReceipt, lastReceipt);
    const confidence = pairAnalysis.confidence;
    
    // Determine recommendation
    let recommendation: 'delete_older' | 'manual_review' | 'merge' = 'manual_review';
    
    if (confidence > 0.9 && analysis.amount_difference < 0.01 && analysis.date_difference_days <= 1) {
      recommendation = 'delete_older';
    } else if (confidence > 0.8) {
      recommendation = 'merge';
    }
    
    return {
      id: `group_${id}`,
      receipts: sortedReceipts,
      confidence,
      criteria: pairAnalysis.criteria,
      recommendation,
      analysis
    };
  }

  displayDuplicateGroups(): void {
    console.log('\n📋 Duplicate Groups Analysis');
    console.log('============================');

    if (this.duplicateGroups.length === 0) {
      console.log('🎉 No duplicate receipts found!');
      return;
    }

    this.duplicateGroups.forEach((group, index) => {
      console.log(`\n📦 Group ${index + 1} (${group.id}) - Confidence: ${(group.confidence * 100).toFixed(1)}%`);
      console.log(`   🎯 Recommendation: ${group.recommendation.toUpperCase()}`);
      console.log(`   📊 Criteria: ${group.criteria.join(', ')}`);
      console.log(`   📈 Analysis:`);
      console.log(`      • Merchant similarity: ${(group.analysis.merchant_similarity * 100).toFixed(1)}%`);
      console.log(`      • Date difference: ${group.analysis.date_difference_days} days`);
      console.log(`      • Amount difference: $${group.analysis.amount_difference.toFixed(2)}`);
      console.log(`      • Payment method match: ${group.analysis.payment_method_match ? 'Yes' : 'No'}`);
      if (group.analysis.line_items_similarity !== undefined) {
        console.log(`      • Line items similarity: ${(group.analysis.line_items_similarity * 100).toFixed(1)}%`);
      }

      console.log(`   📄 Receipts (${group.receipts.length}):`);
      group.receipts.forEach((receipt, receiptIndex) => {
        const date = new Date(receipt.date).toLocaleDateString();
        const created = new Date(receipt.created_at).toLocaleDateString();
        const lineItemsCount = receipt.line_items?.length || 0;
        console.log(`      ${receiptIndex + 1}. ${receipt.merchant} - $${receipt.total} (${date})`);
        console.log(`         ID: ${receipt.id}`);
        console.log(`         Created: ${created} | Line Items: ${lineItemsCount} | Status: ${receipt.status}`);
        if (receipt.image_url) {
          console.log(`         Image: ${receipt.image_url.substring(0, 60)}...`);
        }
      });
    });
  }

  async exportDuplicatesReport(filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = filename || `duplicate-receipts-report-${timestamp}.json`;

    const report = {
      generated_at: new Date().toISOString(),
      criteria: this.criteria,
      summary: {
        total_receipts: this.allReceipts.length,
        duplicate_groups: this.duplicateGroups.length,
        total_duplicates: this.duplicateGroups.reduce((sum, group) => sum + group.receipts.length, 0),
        recommendations: {
          delete_older: this.duplicateGroups.filter(g => g.recommendation === 'delete_older').length,
          manual_review: this.duplicateGroups.filter(g => g.recommendation === 'manual_review').length,
          merge: this.duplicateGroups.filter(g => g.recommendation === 'merge').length
        }
      },
      duplicate_groups: this.duplicateGroups
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 Duplicate report exported to: ${reportFile}`);

    return reportFile;
  }

  async createBackup(): Promise<string> {
    console.log('\n💾 Creating backup of all receipts...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `receipts-backup-${timestamp}.json`;

    const backup = {
      created_at: new Date().toISOString(),
      total_receipts: this.allReceipts.length,
      receipts: this.allReceipts
    };

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup created: ${backupFile}`);

    return backupFile;
  }

  async deleteOlderDuplicates(dryRun: boolean = true): Promise<{ deleted: string[], errors: string[] }> {
    console.log(`\n🗑️  ${dryRun ? 'DRY RUN - ' : ''}Deleting older duplicates...`);

    const toDelete: string[] = [];
    const deleted: string[] = [];
    const errors: string[] = [];

    // Find receipts to delete (keep newest in each group)
    for (const group of this.duplicateGroups) {
      if (group.recommendation === 'delete_older' && group.receipts.length > 1) {
        // Keep the first (newest) receipt, delete the rest
        const receiptsToDelete = group.receipts.slice(1);
        toDelete.push(...receiptsToDelete.map(r => r.id));
      }
    }

    console.log(`📊 Found ${toDelete.length} receipts to delete`);

    if (dryRun) {
      console.log('🔍 DRY RUN - No actual deletions performed');
      console.log('   Receipts that would be deleted:');
      toDelete.forEach(id => {
        const receipt = this.allReceipts.find(r => r.id === id);
        if (receipt) {
          console.log(`   • ${receipt.merchant} - $${receipt.total} (${receipt.date}) - ${id}`);
        }
      });
      return { deleted: toDelete, errors: [] };
    }

    // Actual deletion
    for (const receiptId of toDelete) {
      try {
        const { error } = await supabase
          .from('receipts')
          .delete()
          .eq('id', receiptId);

        if (error) {
          errors.push(`${receiptId}: ${error.message}`);
        } else {
          deleted.push(receiptId);
          console.log(`✅ Deleted receipt: ${receiptId}`);
        }
      } catch (error) {
        errors.push(`${receiptId}: ${error.message}`);
      }
    }

    console.log(`✅ Successfully deleted ${deleted.length} receipts`);
    if (errors.length > 0) {
      console.log(`❌ Failed to delete ${errors.length} receipts`);
    }

    return { deleted, errors };
  }

  async markForManualReview(groupIds?: string[]): Promise<void> {
    console.log('\n📝 Marking duplicates for manual review...');

    const groupsToMark = groupIds
      ? this.duplicateGroups.filter(g => groupIds.includes(g.id))
      : this.duplicateGroups.filter(g => g.recommendation === 'manual_review');

    for (const group of groupsToMark) {
      for (const receipt of group.receipts) {
        try {
          const { error } = await supabase
            .from('receipts')
            .update({
              status: 'unreviewed',
              predicted_category: `DUPLICATE_CHECK: ${receipt.predicted_category || 'Unknown'}`
            })
            .eq('id', receipt.id);

          if (error) {
            console.error(`❌ Failed to mark ${receipt.id}: ${error.message}`);
          } else {
            console.log(`📝 Marked for review: ${receipt.merchant} (${receipt.id})`);
          }
        } catch (error) {
          console.error(`❌ Error marking ${receipt.id}: ${error.message}`);
        }
      }
    }
  }

  async showStatistics(): Promise<void> {
    console.log('\n📊 Duplicate Detection Statistics');
    console.log('=================================');

    const stats = {
      total_receipts: this.allReceipts.length,
      duplicate_groups: this.duplicateGroups.length,
      total_duplicates: this.duplicateGroups.reduce((sum, group) => sum + group.receipts.length, 0),
      potential_savings: this.duplicateGroups.reduce((sum, group) => sum + (group.receipts.length - 1), 0),
      confidence_distribution: {
        high: this.duplicateGroups.filter(g => g.confidence > 0.9).length,
        medium: this.duplicateGroups.filter(g => g.confidence > 0.8 && g.confidence <= 0.9).length,
        low: this.duplicateGroups.filter(g => g.confidence <= 0.8).length
      },
      recommendations: {
        delete_older: this.duplicateGroups.filter(g => g.recommendation === 'delete_older').length,
        manual_review: this.duplicateGroups.filter(g => g.recommendation === 'manual_review').length,
        merge: this.duplicateGroups.filter(g => g.recommendation === 'merge').length
      }
    };

    console.log(`📈 Total Receipts: ${stats.total_receipts}`);
    console.log(`🔍 Duplicate Groups Found: ${stats.duplicate_groups}`);
    console.log(`📄 Total Duplicate Receipts: ${stats.total_duplicates}`);
    console.log(`💾 Potential Storage Savings: ${stats.potential_savings} receipts`);
    console.log(`\n📊 Confidence Distribution:`);
    console.log(`   🟢 High (>90%): ${stats.confidence_distribution.high} groups`);
    console.log(`   🟡 Medium (80-90%): ${stats.confidence_distribution.medium} groups`);
    console.log(`   🔴 Low (<80%): ${stats.confidence_distribution.low} groups`);
    console.log(`\n🎯 Recommendations:`);
    console.log(`   🗑️  Auto-delete older: ${stats.recommendations.delete_older} groups`);
    console.log(`   📝 Manual review: ${stats.recommendations.manual_review} groups`);
    console.log(`   🔄 Merge candidates: ${stats.recommendations.merge} groups`);
  }

  async run(): Promise<void> {
    console.log('🔍 Duplicate Receipt Detection & Management System');
    console.log('==================================================');
    console.log('This tool helps identify and manage duplicate receipts safely.\n');

    try {
      // Get command line arguments
      const args = process.argv.slice(2);
      const command = args[0];
      const subCommand = args[1];

      // Load all receipts first
      await this.loadAllReceipts();

      if (command === 'detect' || !command) {
        // Detect duplicates and show analysis
        await this.detectDuplicates();
        await this.showStatistics();
        this.displayDuplicateGroups();

        if (this.duplicateGroups.length > 0) {
          console.log('\n💡 Next Steps:');
          console.log('   • Export report: npx tsx scripts/duplicate-receipt-manager.ts export');
          console.log('   • Create backup: npx tsx scripts/duplicate-receipt-manager.ts backup');
          console.log('   • Dry run delete: npx tsx scripts/duplicate-receipt-manager.ts delete --dry-run');
          console.log('   • Actually delete: npx tsx scripts/duplicate-receipt-manager.ts delete --confirm');
        }

      } else if (command === 'export') {
        await this.detectDuplicates();
        const reportFile = await this.exportDuplicatesReport();
        console.log(`\n✅ Report exported successfully to: ${reportFile}`);

      } else if (command === 'backup') {
        const backupFile = await this.createBackup();
        console.log(`\n✅ Backup created successfully: ${backupFile}`);

      } else if (command === 'delete') {
        await this.detectDuplicates();

        const isDryRun = subCommand !== '--confirm';

        if (isDryRun) {
          console.log('\n🔍 DRY RUN MODE - No actual deletions will be performed');
        } else {
          console.log('\n⚠️  LIVE MODE - Receipts will be permanently deleted!');
          console.log('   Make sure you have created a backup first.');
        }

        const result = await this.deleteOlderDuplicates(isDryRun);

        if (isDryRun) {
          console.log(`\n📊 Summary (DRY RUN):`);
          console.log(`   • Would delete: ${result.deleted.length} receipts`);
          console.log(`   • Errors: ${result.errors.length}`);
          console.log('\n💡 To actually delete, run: npx tsx scripts/duplicate-receipt-manager.ts delete --confirm');
        } else {
          console.log(`\n📊 Summary (LIVE):`);
          console.log(`   • Successfully deleted: ${result.deleted.length} receipts`);
          console.log(`   • Errors: ${result.errors.length}`);
        }

      } else if (command === 'mark-review') {
        await this.detectDuplicates();
        await this.markForManualReview();
        console.log('\n✅ Marked duplicate groups for manual review');

      } else if (command === 'stats') {
        await this.detectDuplicates();
        await this.showStatistics();

      } else {
        this.showUsage();
      }

    } catch (error) {
      console.error('\n💥 Tool failed:', error.message);
      process.exit(1);
    }
  }

  private showUsage(): void {
    console.log('\n📖 Usage:');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts [command] [options]');
    console.log('\n🔧 Commands:');
    console.log('   detect          # Detect and analyze duplicates (default)');
    console.log('   export          # Export duplicates report to JSON');
    console.log('   backup          # Create backup of all receipts');
    console.log('   delete --dry-run    # Preview what would be deleted');
    console.log('   delete --confirm    # Actually delete older duplicates');
    console.log('   mark-review     # Mark duplicates for manual review');
    console.log('   stats           # Show statistics only');
    console.log('\n💡 Examples:');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts detect');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts export');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts backup');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts delete --dry-run');
    console.log('   npx tsx scripts/duplicate-receipt-manager.ts delete --confirm');
    console.log('\n⚠️  Safety Features:');
    console.log('   • Always run backup before deleting');
    console.log('   • Use --dry-run to preview changes');
    console.log('   • Only deletes obvious duplicates (>90% confidence)');
    console.log('   • Preserves newest receipt in each group');
    console.log('   • Line items are automatically deleted via CASCADE');
  }
}

// Run the duplicate manager
const duplicateManager = new DuplicateReceiptManager();
duplicateManager.run().catch(console.error);
