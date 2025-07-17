#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Migration monitoring dashboard
 * Real-time monitoring of embedding migration progress and quality
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

interface MigrationStats {
  totalReceipts: number;
  receiptsWithEmbeddings: number;
  embeddingCoverage: number;
  recentMigrations: number;
  qualityMetrics: {
    averageQualityScore: number;
    syntheticContentRate: number;
    enhancedProcessingRate: number;
  };
  contentTypeBreakdown: Record<string, number>;
}

/**
 * Get current migration statistics
 */
async function getMigrationStats(): Promise<MigrationStats> {
  try {
    // Get total receipts
    const { count: totalReceipts } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true });
    
    // Get receipts with embeddings
    const { data: embeddingData } = await supabase
      .from('unified_embeddings')
      .select('source_id, content_type, created_at')
      .eq('source_type', 'receipt');
    
    const uniqueReceiptsWithEmbeddings = new Set(embeddingData?.map(e => e.source_id) || []).size;
    const embeddingCoverage = totalReceipts ? (uniqueReceiptsWithEmbeddings / totalReceipts) * 100 : 0;
    
    // Get recent migrations (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentEmbeddings = embeddingData?.filter(e => 
      new Date(e.created_at) > oneDayAgo
    ) || [];
    
    const recentReceiptIds = new Set(recentEmbeddings.map(e => e.source_id));
    const recentMigrations = recentReceiptIds.size;
    
    // Get content type breakdown
    const contentTypeBreakdown: Record<string, number> = {};
    embeddingData?.forEach(e => {
      contentTypeBreakdown[e.content_type] = (contentTypeBreakdown[e.content_type] || 0) + 1;
    });
    
    // Get quality metrics (if available)
    let qualityMetrics = {
      averageQualityScore: 0,
      syntheticContentRate: 0,
      enhancedProcessingRate: 0
    };
    
    try {
      const { data: qualityData } = await supabase
        .from('embedding_quality_metrics')
        .select('overall_quality_score, synthetic_content_used, processing_method')
        .gte('created_at', oneDayAgo.toISOString());
      
      if (qualityData && qualityData.length > 0) {
        qualityMetrics.averageQualityScore = qualityData.reduce((sum, q) => sum + q.overall_quality_score, 0) / qualityData.length;
        qualityMetrics.syntheticContentRate = qualityData.filter(q => q.synthetic_content_used).length / qualityData.length;
        qualityMetrics.enhancedProcessingRate = qualityData.filter(q => q.processing_method === 'enhanced').length / qualityData.length;
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch quality metrics:', error.message);
    }
    
    return {
      totalReceipts: totalReceipts || 0,
      receiptsWithEmbeddings: uniqueReceiptsWithEmbeddings,
      embeddingCoverage: Math.round(embeddingCoverage * 10) / 10,
      recentMigrations,
      qualityMetrics: {
        averageQualityScore: Math.round(qualityMetrics.averageQualityScore),
        syntheticContentRate: Math.round(qualityMetrics.syntheticContentRate * 100) / 100,
        enhancedProcessingRate: Math.round(qualityMetrics.enhancedProcessingRate * 100) / 100
      },
      contentTypeBreakdown
    };
    
  } catch (error) {
    console.error('❌ Error fetching migration stats:', error.message);
    throw error;
  }
}

/**
 * Get receipts still needing migration
 */
async function getReceiptsNeedingMigration(): Promise<{ count: number; examples: any[] }> {
  try {
    // Get receipts with empty fullText
    const { data: emptyFullTextReceipts } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, created_at')
      .or('fullText.is.null,fullText.eq.')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!emptyFullTextReceipts || emptyFullTextReceipts.length === 0) {
      return { count: 0, examples: [] };
    }
    
    // Check which ones have embeddings
    const receiptIds = emptyFullTextReceipts.map(r => r.id);
    const { data: existingEmbeddings } = await supabase
      .from('unified_embeddings')
      .select('source_id')
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);
    
    const existingEmbeddingIds = new Set(existingEmbeddings?.map(e => e.source_id) || []);
    const receiptsNeedingMigration = emptyFullTextReceipts.filter(r => !existingEmbeddingIds.has(r.id));
    
    return {
      count: receiptsNeedingMigration.length,
      examples: receiptsNeedingMigration.slice(0, 5)
    };
    
  } catch (error) {
    console.error('❌ Error checking receipts needing migration:', error.message);
    return { count: 0, examples: [] };
  }
}

/**
 * Display migration dashboard
 */
function displayDashboard(stats: MigrationStats, needingMigration: { count: number; examples: any[] }): void {
  console.clear();
  console.log('🚀 Embedding Migration Dashboard');
  console.log('=' .repeat(60));
  console.log(`📊 Overall Progress:`);
  console.log(`   Total Receipts: ${stats.totalReceipts.toLocaleString()}`);
  console.log(`   With Embeddings: ${stats.receiptsWithEmbeddings.toLocaleString()}`);
  console.log(`   Coverage: ${stats.embeddingCoverage}%`);
  
  // Progress bar
  const progressBarWidth = 40;
  const filledWidth = Math.round((stats.embeddingCoverage / 100) * progressBarWidth);
  const emptyWidth = progressBarWidth - filledWidth;
  const progressBar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
  console.log(`   Progress: [${progressBar}] ${stats.embeddingCoverage}%`);
  
  console.log(`\n🔄 Recent Activity (24h):`);
  console.log(`   New Migrations: ${stats.recentMigrations}`);
  
  console.log(`\n📈 Quality Metrics:`);
  console.log(`   Average Quality Score: ${stats.qualityMetrics.averageQualityScore}/100`);
  console.log(`   Synthetic Content Rate: ${(stats.qualityMetrics.syntheticContentRate * 100).toFixed(1)}%`);
  console.log(`   Enhanced Processing Rate: ${(stats.qualityMetrics.enhancedProcessingRate * 100).toFixed(1)}%`);
  
  console.log(`\n📋 Content Type Breakdown:`);
  const sortedContentTypes = Object.entries(stats.contentTypeBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8);
  
  sortedContentTypes.forEach(([contentType, count]) => {
    console.log(`   ${contentType}: ${count.toLocaleString()}`);
  });
  
  console.log(`\n⚠️ Remaining Work:`);
  console.log(`   Receipts Needing Migration: ${needingMigration.count}`);
  
  if (needingMigration.examples.length > 0) {
    console.log(`   Recent Examples:`);
    needingMigration.examples.forEach(receipt => {
      const merchant = receipt.merchant || 'No merchant';
      const date = receipt.date || 'No date';
      const total = receipt.total ? `$${receipt.total}` : 'No total';
      console.log(`     ${receipt.id.substring(0, 8)}... | ${merchant} | ${date} | ${total}`);
    });
  }
  
  // Status indicators
  console.log(`\n🚦 Status:`);
  if (stats.embeddingCoverage >= 95) {
    console.log(`   ✅ Migration Complete (${stats.embeddingCoverage}% coverage)`);
  } else if (stats.embeddingCoverage >= 80) {
    console.log(`   🟡 Migration Nearly Complete (${stats.embeddingCoverage}% coverage)`);
  } else if (stats.embeddingCoverage >= 50) {
    console.log(`   🟠 Migration In Progress (${stats.embeddingCoverage}% coverage)`);
  } else {
    console.log(`   🔴 Migration Needed (${stats.embeddingCoverage}% coverage)`);
  }
  
  if (stats.qualityMetrics.averageQualityScore > 0) {
    if (stats.qualityMetrics.averageQualityScore >= 80) {
      console.log(`   ✅ High Quality Embeddings (${stats.qualityMetrics.averageQualityScore}/100)`);
    } else if (stats.qualityMetrics.averageQualityScore >= 60) {
      console.log(`   🟡 Good Quality Embeddings (${stats.qualityMetrics.averageQualityScore}/100)`);
    } else {
      console.log(`   🟠 Quality Needs Improvement (${stats.qualityMetrics.averageQualityScore}/100)`);
    }
  }
  
  console.log(`\n⏰ Last Updated: ${new Date().toLocaleString()}`);
  console.log(`💡 Press Ctrl+C to exit, or wait for auto-refresh...`);
}

/**
 * Monitor migration progress in real-time
 */
async function monitorMigration(refreshInterval: number = 30): Promise<void> {
  console.log(`🔄 Starting migration monitoring (refresh every ${refreshInterval}s)`);
  
  while (true) {
    try {
      const stats = await getMigrationStats();
      const needingMigration = await getReceiptsNeedingMigration();
      
      displayDashboard(stats, needingMigration);
      
      // Exit if migration is complete
      if (stats.embeddingCoverage >= 99.9 && needingMigration.count === 0) {
        console.log('\n🎉 Migration appears to be complete!');
        break;
      }
      
      // Wait for next refresh
      await new Promise(resolve => setTimeout(resolve, refreshInterval * 1000));
      
    } catch (error) {
      console.error('❌ Error during monitoring:', error.message);
      console.log('⏸️ Retrying in 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

/**
 * Generate migration report
 */
async function generateReport(): Promise<void> {
  console.log('📊 Generating Migration Report');
  console.log('=' .repeat(50));
  
  try {
    const stats = await getMigrationStats();
    const needingMigration = await getReceiptsNeedingMigration();
    
    console.log(`\n📈 Migration Summary:`);
    console.log(`   Total Receipts: ${stats.totalReceipts.toLocaleString()}`);
    console.log(`   Receipts with Embeddings: ${stats.receiptsWithEmbeddings.toLocaleString()}`);
    console.log(`   Embedding Coverage: ${stats.embeddingCoverage}%`);
    console.log(`   Receipts Still Needing Migration: ${needingMigration.count}`);
    
    console.log(`\n📊 Quality Analysis:`);
    console.log(`   Average Quality Score: ${stats.qualityMetrics.averageQualityScore}/100`);
    console.log(`   Synthetic Content Usage: ${(stats.qualityMetrics.syntheticContentRate * 100).toFixed(1)}%`);
    console.log(`   Enhanced Processing Rate: ${(stats.qualityMetrics.enhancedProcessingRate * 100).toFixed(1)}%`);
    
    console.log(`\n📋 Content Type Distribution:`);
    Object.entries(stats.contentTypeBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([contentType, count]) => {
        const percentage = stats.receiptsWithEmbeddings > 0 
          ? ((count / stats.receiptsWithEmbeddings) * 100).toFixed(1)
          : '0.0';
        console.log(`   ${contentType}: ${count.toLocaleString()} (${percentage}%)`);
      });
    
    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (needingMigration.count > 0) {
      console.log(`   - Run migration script for remaining ${needingMigration.count} receipts`);
    }
    if (stats.qualityMetrics.averageQualityScore < 70) {
      console.log(`   - Review and improve content synthesis quality`);
    }
    if (stats.qualityMetrics.syntheticContentRate > 0.8) {
      console.log(`   - High synthetic content usage - validate AI vision extraction`);
    }
    if (stats.embeddingCoverage >= 95) {
      console.log(`   - Migration is essentially complete - monitor search performance`);
    }
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { mode: 'monitor' | 'report'; refreshInterval: number } {
  const args = Deno.args;
  let mode: 'monitor' | 'report' = 'monitor';
  let refreshInterval = 30;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--report':
        mode = 'report';
        break;
      case '--refresh':
        refreshInterval = parseInt(args[++i]) || 30;
        break;
      case '--help':
        console.log(`
Usage: deno run --allow-env --allow-net monitor-migration-progress.ts [options]

Options:
  --report              Generate a one-time report instead of monitoring
  --refresh <seconds>   Refresh interval for monitoring mode (default: 30)
  --help               Show this help message

Examples:
  # Monitor with default 30s refresh
  deno run --allow-env --allow-net monitor-migration-progress.ts
  
  # Monitor with 10s refresh
  deno run --allow-env --allow-net monitor-migration-progress.ts --refresh 10
  
  # Generate one-time report
  deno run --allow-env --allow-net monitor-migration-progress.ts --report
        `);
        Deno.exit(0);
        break;
    }
  }
  
  return { mode, refreshInterval };
}

// Main execution
if (import.meta.main) {
  const { mode, refreshInterval } = parseArgs();
  
  try {
    if (mode === 'report') {
      await generateReport();
    } else {
      await monitorMigration(refreshInterval);
    }
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
    Deno.exit(1);
  }
}
