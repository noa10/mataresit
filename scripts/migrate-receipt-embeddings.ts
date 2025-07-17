#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Comprehensive migration script for receipt embeddings
 * Backfills embeddings for receipts affected by AI vision transition
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Load environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MigrationOptions {
  batchSize: number;
  priority: 'high' | 'medium' | 'low' | 'all';
  dryRun: boolean;
  maxRetries: number;
  delayBetweenBatches: number; // milliseconds
  forceRegenerate: boolean;
}

interface MigrationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
  processingTime: number;
}

/**
 * Get receipts that need embedding migration based on priority
 */
async function getReceiptsForMigration(priority: string, limit?: number): Promise<any[]> {
  console.log(`🔍 Finding receipts for migration (priority: ${priority})`);
  
  let query = supabase
    .from('receipts')
    .select('id, merchant, date, total, tax, currency, payment_method, predicted_category, fullText, created_at, model_used, user_id, team_id')
    .or('fullText.is.null,fullText.eq.');
  
  // Apply priority filtering
  if (priority === 'high') {
    // Recent receipts with merchant info and substantial total
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    query = query
      .not('merchant', 'is', null)
      .gte('total', 50)
      .gte('created_at', sixMonthsAgo.toISOString());
  } else if (priority === 'medium') {
    // Has merchant or substantial total, but not high priority
    query = query.or('merchant.not.is.null,total.gte.20');
  } else if (priority === 'low') {
    // Minimal data receipts
    query = query
      .is('merchant', null)
      .lt('total', 20);
  }
  // 'all' priority doesn't add additional filters
  
  if (limit) {
    query = query.limit(limit);
  }
  
  query = query.order('created_at', { ascending: false });
  
  const { data: receipts, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch receipts: ${error.message}`);
  }
  
  // Filter out receipts that already have embeddings
  if (receipts && receipts.length > 0) {
    const receiptIds = receipts.map(r => r.id);
    
    const { data: existingEmbeddings, error: embeddingError } = await supabase
      .from('unified_embeddings')
      .select('source_id')
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);
    
    if (embeddingError) {
      console.warn('⚠️ Could not check existing embeddings:', embeddingError.message);
      return receipts;
    }
    
    const existingEmbeddingIds = new Set(existingEmbeddings?.map(e => e.source_id) || []);
    const receiptsNeedingMigration = receipts.filter(r => !existingEmbeddingIds.has(r.id));
    
    console.log(`📋 Found ${receipts.length} receipts with empty fullText, ${receiptsNeedingMigration.length} need migration`);
    return receiptsNeedingMigration;
  }
  
  return [];
}

/**
 * Process a single receipt for embedding generation
 */
async function processReceiptEmbedding(receipt: any, options: MigrationOptions): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🔄 Processing receipt ${receipt.id} (${receipt.merchant || 'No merchant'})`);
    
    if (options.dryRun) {
      console.log(`   [DRY RUN] Would generate embeddings for receipt ${receipt.id}`);
      return { success: true, details: { dryRun: true } };
    }
    
    // Call the enhanced embedding generation function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        receiptId: receipt.id,
        processAllFields: true,
        useImprovedDimensionHandling: true,
        forceRegenerate: options.forceRegenerate,
        mode: 'migration'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`   ✅ Successfully generated embeddings for receipt ${receipt.id}`);
      return { 
        success: true, 
        details: {
          contentTypes: result.results?.length || 0,
          qualityScore: result.qualityMetrics?.overallQualityScore || 0
        }
      };
    } else {
      throw new Error(result.error || 'Unknown error from embedding generation');
    }
    
  } catch (error) {
    console.error(`   ❌ Failed to process receipt ${receipt.id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process receipts in batches
 */
async function processBatch(receipts: any[], batchNumber: number, options: MigrationOptions): Promise<MigrationResult> {
  console.log(`\n📦 Processing batch ${batchNumber} (${receipts.length} receipts)`);
  
  const batchStartTime = Date.now();
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    console.log(`   [${i + 1}/${receipts.length}] Processing ${receipt.id}...`);
    
    let retries = 0;
    let result = { success: false, error: 'Not attempted' };
    
    // Retry logic
    while (retries <= options.maxRetries && !result.success) {
      if (retries > 0) {
        console.log(`   🔄 Retry ${retries}/${options.maxRetries} for receipt ${receipt.id}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
      }
      
      result = await processReceiptEmbedding(receipt, options);
      retries++;
    }
    
    if (result.success) {
      successful++;
      if (result.details?.qualityScore) {
        console.log(`   📊 Quality score: ${result.details.qualityScore}/100`);
      }
    } else {
      failed++;
      errors.push(`Receipt ${receipt.id}: ${result.error}`);
    }
    
    // Small delay between receipts to avoid overwhelming the system
    if (i < receipts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  const batchTime = Date.now() - batchStartTime;
  
  console.log(`📊 Batch ${batchNumber} complete:`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️ Time: ${(batchTime / 1000).toFixed(1)}s`);
  
  return {
    totalProcessed: receipts.length,
    successful,
    failed,
    skipped,
    errors,
    processingTime: batchTime
  };
}

/**
 * Main migration function
 */
async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  console.log('🚀 Starting Receipt Embedding Migration');
  console.log('=' .repeat(60));
  console.log(`📋 Configuration:`);
  console.log(`   Priority: ${options.priority}`);
  console.log(`   Batch Size: ${options.batchSize}`);
  console.log(`   Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`   Force Regenerate: ${options.forceRegenerate ? 'Yes' : 'No'}`);
  console.log(`   Max Retries: ${options.maxRetries}`);
  
  const migrationStartTime = Date.now();
  
  try {
    // Get receipts for migration
    const receipts = await getReceiptsForMigration(options.priority);
    
    if (receipts.length === 0) {
      console.log('✅ No receipts need migration');
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        processingTime: 0
      };
    }
    
    console.log(`📊 Found ${receipts.length} receipts needing migration`);
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < receipts.length; i += options.batchSize) {
      batches.push(receipts.slice(i, i + options.batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches`);
    
    let totalResult: MigrationResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      processingTime: 0
    };
    
    for (let i = 0; i < batches.length; i++) {
      const batchResult = await processBatch(batches[i], i + 1, options);
      
      // Aggregate results
      totalResult.totalProcessed += batchResult.totalProcessed;
      totalResult.successful += batchResult.successful;
      totalResult.failed += batchResult.failed;
      totalResult.skipped += batchResult.skipped;
      totalResult.errors.push(...batchResult.errors);
      totalResult.processingTime += batchResult.processingTime;
      
      // Delay between batches
      if (i < batches.length - 1 && options.delayBetweenBatches > 0) {
        console.log(`⏸️ Waiting ${options.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenBatches));
      }
    }
    
    const totalTime = Date.now() - migrationStartTime;
    totalResult.processingTime = totalTime;
    
    return totalResult;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Print migration summary
 */
function printMigrationSummary(result: MigrationResult, options: MigrationOptions): void {
  console.log('\n📊 Migration Summary');
  console.log('=' .repeat(50));
  console.log(`Total Processed: ${result.totalProcessed}`);
  console.log(`✅ Successful: ${result.successful}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`⏭️ Skipped: ${result.skipped}`);
  console.log(`⏱️ Total Time: ${(result.processingTime / 1000 / 60).toFixed(1)} minutes`);
  
  const successRate = result.totalProcessed > 0 ? (result.successful / result.totalProcessed) * 100 : 0;
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(error => {
      console.log(`   ${error}`);
    });
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more errors`);
    }
  }
  
  if (options.dryRun) {
    console.log('\n💡 This was a dry run. No actual changes were made.');
    console.log('   Remove --dry-run flag to execute the migration.');
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = Deno.args;
  
  const options: MigrationOptions = {
    batchSize: 25,
    priority: 'all',
    dryRun: false,
    maxRetries: 2,
    delayBetweenBatches: 1000,
    forceRegenerate: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 25;
        break;
      case '--priority':
        const priority = args[++i];
        if (['high', 'medium', 'low', 'all'].includes(priority)) {
          options.priority = priority as any;
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--max-retries':
        options.maxRetries = parseInt(args[++i]) || 2;
        break;
      case '--delay':
        options.delayBetweenBatches = parseInt(args[++i]) || 1000;
        break;
      case '--force':
        options.forceRegenerate = true;
        break;
      case '--help':
        console.log(`
Usage: deno run --allow-env --allow-net migrate-receipt-embeddings.ts [options]

Options:
  --batch-size <number>    Number of receipts per batch (default: 25)
  --priority <level>       Priority level: high, medium, low, all (default: all)
  --dry-run               Preview changes without executing (default: false)
  --max-retries <number>   Maximum retries per receipt (default: 2)
  --delay <ms>            Delay between batches in milliseconds (default: 1000)
  --force                 Force regenerate existing embeddings (default: false)
  --help                  Show this help message

Examples:
  # Dry run for high priority receipts
  deno run --allow-env --allow-net migrate-receipt-embeddings.ts --priority high --dry-run
  
  # Migrate all receipts in small batches
  deno run --allow-env --allow-net migrate-receipt-embeddings.ts --batch-size 10
  
  # Force regenerate all embeddings
  deno run --allow-env --allow-net migrate-receipt-embeddings.ts --force
        `);
        Deno.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * Validate migration results
 */
async function validateMigration(): Promise<void> {
  console.log('\n🔍 Validating migration results...');

  try {
    // Check embedding coverage after migration
    const { count: totalReceipts } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true });

    const { data: receiptsWithEmbeddings } = await supabase
      .from('unified_embeddings')
      .select('source_id')
      .eq('source_type', 'receipt');

    const uniqueReceiptsWithEmbeddings = new Set(receiptsWithEmbeddings?.map(e => e.source_id) || []).size;
    const coverage = totalReceipts ? (uniqueReceiptsWithEmbeddings / totalReceipts) * 100 : 0;

    console.log(`📊 Post-migration embedding coverage: ${coverage.toFixed(1)}% (${uniqueReceiptsWithEmbeddings}/${totalReceipts})`);

    // Check for receipts still missing embeddings
    const { data: stillMissingReceipts } = await supabase
      .from('receipts')
      .select('id, merchant, created_at')
      .or('fullText.is.null,fullText.eq.')
      .limit(10);

    if (stillMissingReceipts && stillMissingReceipts.length > 0) {
      const receiptsWithEmbeddingsSet = new Set(receiptsWithEmbeddings?.map(e => e.source_id) || []);
      const stillNeedingMigration = stillMissingReceipts.filter(r => !receiptsWithEmbeddingsSet.has(r.id));

      if (stillNeedingMigration.length > 0) {
        console.log(`⚠️ ${stillNeedingMigration.length} receipts still need migration`);
        console.log('   Consider running migration again with --force flag');
      } else {
        console.log('✅ All receipts with empty fullText now have embeddings');
      }
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Main execution
if (import.meta.main) {
  const options = parseArgs();

  try {
    const result = await runMigration(options);
    printMigrationSummary(result, options);

    // Run validation if not a dry run
    if (!options.dryRun && result.successful > 0) {
      await validateMigration();
    }

    if (result.failed > 0) {
      console.log('\n⚠️ Some receipts failed to migrate. Check the errors above.');
      console.log('💡 Consider running the migration again for failed receipts.');
      Deno.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');

      if (!options.dryRun) {
        console.log('\nNext steps:');
        console.log('1. Test search functionality with migrated receipts');
        console.log('2. Monitor embedding quality metrics');
        console.log('3. Consider running analysis script to verify improvements');
      }

      Deno.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    Deno.exit(1);
  }
}
