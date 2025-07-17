#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Analysis script to assess embedding migration needs
 * Identifies receipts that need embedding backfill due to AI vision transition
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

interface AnalysisResult {
  totalReceipts: number;
  receiptsWithEmptyFullText: number;
  receiptsWithEmbeddings: number;
  receiptsNeedingMigration: number;
  embeddingCoverage: number;
  migrationPriority: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Analyze receipts and their embedding status
 */
async function analyzeReceiptEmbeddingStatus(): Promise<AnalysisResult> {
  console.log('🔍 Analyzing receipt and embedding status...');
  
  try {
    // Get total receipt count
    const { count: totalReceipts, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Failed to count receipts: ${countError.message}`);
    }
    
    console.log(`📊 Total receipts in database: ${totalReceipts}`);
    
    // Get receipts with empty fullText
    const { data: emptyFullTextReceipts, error: emptyError } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, fullText, created_at, model_used')
      .or('fullText.is.null,fullText.eq.');
    
    if (emptyError) {
      throw new Error(`Failed to query empty fullText receipts: ${emptyError.message}`);
    }
    
    const receiptsWithEmptyFullText = emptyFullTextReceipts?.length || 0;
    console.log(`📝 Receipts with empty fullText: ${receiptsWithEmptyFullText}`);
    
    // Get receipts that have embeddings
    const { data: receiptsWithEmbeddings, error: embeddingError } = await supabase
      .from('unified_embeddings')
      .select('source_id')
      .eq('source_type', 'receipt');
    
    if (embeddingError) {
      throw new Error(`Failed to query embeddings: ${embeddingError.message}`);
    }
    
    const uniqueReceiptsWithEmbeddings = new Set(receiptsWithEmbeddings?.map(e => e.source_id) || []).size;
    console.log(`🔗 Receipts with embeddings: ${uniqueReceiptsWithEmbeddings}`);
    
    // Calculate receipts needing migration (empty fullText but no embeddings)
    const receiptsWithEmbeddingsSet = new Set(receiptsWithEmbeddings?.map(e => e.source_id) || []);
    const receiptsNeedingMigration = emptyFullTextReceipts?.filter(
      receipt => !receiptsWithEmbeddingsSet.has(receipt.id)
    ).length || 0;
    
    console.log(`🚨 Receipts needing migration: ${receiptsNeedingMigration}`);
    
    // Calculate embedding coverage
    const embeddingCoverage = totalReceipts > 0 ? (uniqueReceiptsWithEmbeddings / totalReceipts) * 100 : 0;
    console.log(`📈 Embedding coverage: ${embeddingCoverage.toFixed(1)}%`);
    
    // Analyze migration priority based on receipt characteristics
    const migrationPriority = await analyzeMigrationPriority(emptyFullTextReceipts || []);
    
    return {
      totalReceipts: totalReceipts || 0,
      receiptsWithEmptyFullText,
      receiptsWithEmbeddings: uniqueReceiptsWithEmbeddings,
      receiptsNeedingMigration,
      embeddingCoverage: Math.round(embeddingCoverage * 10) / 10,
      migrationPriority
    };
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    throw error;
  }
}

/**
 * Analyze migration priority based on receipt characteristics
 */
async function analyzeMigrationPriority(receipts: any[]): Promise<{ high: number; medium: number; low: number }> {
  console.log('🎯 Analyzing migration priority...');
  
  let high = 0, medium = 0, low = 0;
  
  for (const receipt of receipts) {
    // High priority: Recent receipts with merchant info and substantial total
    if (receipt.merchant && receipt.total > 50 && isRecentReceipt(receipt.created_at)) {
      high++;
    }
    // Medium priority: Has merchant or substantial total
    else if (receipt.merchant || receipt.total > 20) {
      medium++;
    }
    // Low priority: Minimal data
    else {
      low++;
    }
  }
  
  console.log(`🔴 High priority: ${high} receipts`);
  console.log(`🟡 Medium priority: ${medium} receipts`);
  console.log(`🟢 Low priority: ${low} receipts`);
  
  return { high, medium, low };
}

/**
 * Check if receipt is recent (within last 6 months)
 */
function isRecentReceipt(createdAt: string): boolean {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return new Date(createdAt) > sixMonthsAgo;
}

/**
 * Analyze embedding quality for existing embeddings
 */
async function analyzeExistingEmbeddingQuality(): Promise<void> {
  console.log('\n🔍 Analyzing existing embedding quality...');
  
  try {
    // Get embedding statistics by content type
    const { data: embeddingStats, error } = await supabase
      .from('unified_embeddings')
      .select('content_type, source_id')
      .eq('source_type', 'receipt');
    
    if (error) {
      throw new Error(`Failed to query embedding stats: ${error.message}`);
    }
    
    if (!embeddingStats || embeddingStats.length === 0) {
      console.log('📊 No existing embeddings found');
      return;
    }
    
    // Group by content type
    const contentTypeStats: Record<string, number> = {};
    embeddingStats.forEach(embedding => {
      contentTypeStats[embedding.content_type] = (contentTypeStats[embedding.content_type] || 0) + 1;
    });
    
    console.log('📊 Existing embeddings by content type:');
    Object.entries(contentTypeStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([contentType, count]) => {
        console.log(`   ${contentType}: ${count} embeddings`);
      });
    
    // Check for full_text embeddings specifically
    const fullTextEmbeddings = contentTypeStats['full_text'] || 0;
    const totalEmbeddings = embeddingStats.length;
    const fullTextCoverage = totalEmbeddings > 0 ? (fullTextEmbeddings / totalEmbeddings) * 100 : 0;
    
    console.log(`📝 Full text embedding coverage: ${fullTextCoverage.toFixed(1)}% (${fullTextEmbeddings}/${totalEmbeddings})`);
    
  } catch (error) {
    console.error('❌ Error analyzing embedding quality:', error.message);
  }
}

/**
 * Generate migration recommendations
 */
function generateMigrationRecommendations(analysis: AnalysisResult): void {
  console.log('\n💡 Migration Recommendations:');
  console.log('=' .repeat(50));
  
  if (analysis.receiptsNeedingMigration === 0) {
    console.log('✅ No migration needed - all receipts have embeddings');
    return;
  }
  
  console.log(`🎯 Priority Migration Plan:`);
  console.log(`   1. High Priority: ${analysis.migrationPriority.high} receipts (recent, valuable)`);
  console.log(`   2. Medium Priority: ${analysis.migrationPriority.medium} receipts (has merchant/amount)`);
  console.log(`   3. Low Priority: ${analysis.migrationPriority.low} receipts (minimal data)`);
  
  // Batch size recommendations
  const recommendedBatchSize = Math.min(50, Math.max(10, Math.floor(analysis.receiptsNeedingMigration / 10)));
  console.log(`\n📦 Recommended batch size: ${recommendedBatchSize} receipts per batch`);
  
  // Time estimates
  const estimatedBatches = Math.ceil(analysis.receiptsNeedingMigration / recommendedBatchSize);
  const estimatedTimeMinutes = estimatedBatches * 2; // Assume 2 minutes per batch
  console.log(`⏱️ Estimated migration time: ${estimatedTimeMinutes} minutes (${estimatedBatches} batches)`);
  
  // Resource considerations
  console.log(`\n🔧 Migration Strategy:`);
  if (analysis.receiptsNeedingMigration > 1000) {
    console.log('   - Use background processing for large dataset');
    console.log('   - Implement rate limiting to avoid API throttling');
    console.log('   - Consider running during off-peak hours');
  } else if (analysis.receiptsNeedingMigration > 100) {
    console.log('   - Use batch processing with progress tracking');
    console.log('   - Monitor for API rate limits');
  } else {
    console.log('   - Can process in single session');
    console.log('   - Monitor for any processing errors');
  }
  
  // Quality considerations
  if (analysis.embeddingCoverage < 50) {
    console.log('\n⚠️ Low embedding coverage detected:');
    console.log('   - Consider regenerating all embeddings with enhanced system');
    console.log('   - Validate embedding quality after migration');
    console.log('   - Monitor search performance improvements');
  }
}

/**
 * Main analysis function
 */
async function runAnalysis(): Promise<void> {
  console.log('🚀 Embedding Migration Analysis');
  console.log('=' .repeat(60));
  
  try {
    // Analyze current state
    const analysis = await analyzeReceiptEmbeddingStatus();
    
    // Analyze existing embedding quality
    await analyzeExistingEmbeddingQuality();
    
    // Generate recommendations
    generateMigrationRecommendations(analysis);
    
    console.log('\n✅ Analysis complete!');
    console.log('\nNext steps:');
    console.log('1. Review the migration recommendations above');
    console.log('2. Run the migration script with appropriate batch sizes');
    console.log('3. Monitor embedding quality metrics during migration');
    console.log('4. Validate search functionality after migration');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    Deno.exit(1);
  }
}

// Run the analysis
if (import.meta.main) {
  await runAnalysis();
}
