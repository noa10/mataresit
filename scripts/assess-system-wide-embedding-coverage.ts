#!/usr/bin/env tsx

/**
 * System-Wide Embedding Coverage Assessment
 * Comprehensive analysis of embedding coverage across the entire receipt database
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

const USER_ID = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';

interface ReceiptAnalysis {
  totalReceipts: number;
  receiptsWithEmbeddings: number;
  receiptsWithoutEmbeddings: number;
  receiptsWithFullText: number;
  receiptsWithoutFullText: number;
  embeddingCoverage: number;
  fullTextCoverage: number;
}

interface DateRangeAnalysis {
  dateRange: string;
  totalReceipts: number;
  receiptsWithEmbeddings: number;
  receiptsWithoutEmbeddings: number;
  embeddingCoverage: number;
  receiptsWithFullText: number;
  fullTextCoverage: number;
}

/**
 * Get overall system statistics
 */
async function getOverallStatistics(): Promise<ReceiptAnalysis> {
  try {
    console.log('📊 Analyzing overall system statistics...');
    
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        "fullText",
        has_embeddings,
        embedding_status,
        created_at
      `)
      .eq('user_id', USER_ID)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Error fetching receipts: ${error.message}`);
    }

    const totalReceipts = receipts?.length || 0;
    const receiptsWithEmbeddings = receipts?.filter(r => r.has_embeddings === true).length || 0;
    const receiptsWithoutEmbeddings = totalReceipts - receiptsWithEmbeddings;
    const receiptsWithFullText = receipts?.filter(r => r.fullText && r.fullText.trim().length > 0).length || 0;
    const receiptsWithoutFullText = totalReceipts - receiptsWithFullText;
    
    const embeddingCoverage = totalReceipts > 0 ? (receiptsWithEmbeddings / totalReceipts) * 100 : 0;
    const fullTextCoverage = totalReceipts > 0 ? (receiptsWithFullText / totalReceipts) * 100 : 0;

    console.log(`✅ Analyzed ${totalReceipts} total receipts`);
    
    return {
      totalReceipts,
      receiptsWithEmbeddings,
      receiptsWithoutEmbeddings,
      receiptsWithFullText,
      receiptsWithoutFullText,
      embeddingCoverage,
      fullTextCoverage
    };
  } catch (error) {
    console.error('❌ Error getting overall statistics:', error.message);
    throw error;
  }
}

/**
 * Analyze embedding coverage by date ranges
 */
async function analyzeByDateRanges(): Promise<DateRangeAnalysis[]> {
  try {
    console.log('\n📅 Analyzing embedding coverage by date ranges...');
    
    // Get date range of all receipts
    const { data: dateRange, error: dateError } = await supabase
      .from('receipts')
      .select('date')
      .eq('user_id', USER_ID)
      .order('date', { ascending: true });

    if (dateError || !dateRange || dateRange.length === 0) {
      throw new Error('No receipts found or error fetching date range');
    }

    const earliestDate = new Date(dateRange[0].date);
    const latestDate = new Date(dateRange[dateRange.length - 1].date);
    
    console.log(`📊 Date range: ${earliestDate.toISOString().split('T')[0]} to ${latestDate.toISOString().split('T')[0]}`);
    
    // Generate monthly date ranges for analysis
    const dateRanges: { start: string; end: string; label: string }[] = [];
    
    let currentDate = new Date(earliestDate);
    currentDate.setDate(1); // Start of month
    
    while (currentDate <= latestDate) {
      const startOfMonth = new Date(currentDate);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Don't go beyond the latest date
      if (endOfMonth > latestDate) {
        endOfMonth.setTime(latestDate.getTime());
      }
      
      dateRanges.push({
        start: startOfMonth.toISOString().split('T')[0],
        end: endOfMonth.toISOString().split('T')[0],
        label: `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    console.log(`📊 Analyzing ${dateRanges.length} monthly periods`);
    
    const results: DateRangeAnalysis[] = [];
    
    for (const range of dateRanges) {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          id,
          date,
          merchant,
          "fullText",
          has_embeddings,
          embedding_status
        `)
        .eq('user_id', USER_ID)
        .gte('date', range.start)
        .lte('date', range.end);

      if (error) {
        console.error(`❌ Error analyzing range ${range.label}:`, error);
        continue;
      }

      const totalReceipts = receipts?.length || 0;
      const receiptsWithEmbeddings = receipts?.filter(r => r.has_embeddings === true).length || 0;
      const receiptsWithoutEmbeddings = totalReceipts - receiptsWithEmbeddings;
      const receiptsWithFullText = receipts?.filter(r => r.fullText && r.fullText.trim().length > 0).length || 0;
      
      const embeddingCoverage = totalReceipts > 0 ? (receiptsWithEmbeddings / totalReceipts) * 100 : 0;
      const fullTextCoverage = totalReceipts > 0 ? (receiptsWithFullText / totalReceipts) * 100 : 0;

      results.push({
        dateRange: range.label,
        totalReceipts,
        receiptsWithEmbeddings,
        receiptsWithoutEmbeddings,
        embeddingCoverage,
        receiptsWithFullText,
        fullTextCoverage
      });
      
      console.log(`   ${range.label}: ${totalReceipts} receipts, ${embeddingCoverage.toFixed(1)}% embedding coverage`);
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error analyzing by date ranges:', error.message);
    return [];
  }
}

/**
 * Analyze receipts without embeddings in detail
 */
async function analyzeReceiptsWithoutEmbeddings(): Promise<any[]> {
  try {
    console.log('\n🔍 Analyzing receipts without embeddings in detail...');
    
    const { data: receiptsWithoutEmbeddings, error } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        "fullText",
        has_embeddings,
        embedding_status,
        total,
        currency,
        created_at
      `)
      .eq('user_id', USER_ID)
      .eq('has_embeddings', false)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Error fetching receipts without embeddings: ${error.message}`);
    }

    const receipts = receiptsWithoutEmbeddings || [];
    console.log(`📊 Found ${receipts.length} receipts without embeddings`);
    
    if (receipts.length > 0) {
      // Analyze by fullText availability
      const withFullText = receipts.filter(r => r.fullText && r.fullText.trim().length > 0);
      const withoutFullText = receipts.filter(r => !r.fullText || r.fullText.trim().length === 0);
      
      console.log(`   📝 With fullText: ${withFullText.length}`);
      console.log(`   📝 Without fullText: ${withoutFullText.length}`);
      
      // Show sample receipts without embeddings
      console.log('\n📋 Sample receipts without embeddings:');
      receipts.slice(0, 10).forEach((receipt, index) => {
        const hasFullText = receipt.fullText && receipt.fullText.trim().length > 0;
        const fullTextStatus = hasFullText ? `✅ (${receipt.fullText.length} chars)` : '❌';
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} - FullText: ${fullTextStatus}`);
      });
      
      if (receipts.length > 10) {
        console.log(`   ... and ${receipts.length - 10} more receipts`);
      }
    }
    
    return receipts;
  } catch (error) {
    console.error('❌ Error analyzing receipts without embeddings:', error.message);
    return [];
  }
}

/**
 * Cross-reference with unified_embeddings table
 */
async function crossReferenceWithUnifiedEmbeddings(): Promise<void> {
  try {
    console.log('\n🔗 Cross-referencing with unified_embeddings table...');
    
    // Get all receipt IDs
    const { data: allReceipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, has_embeddings')
      .eq('user_id', USER_ID);

    if (receiptsError || !allReceipts) {
      throw new Error('Error fetching receipt IDs');
    }

    const receiptIds = allReceipts.map(r => r.id);
    console.log(`📊 Checking ${receiptIds.length} receipt IDs against unified_embeddings`);
    
    // Get actual embeddings from unified_embeddings table
    const { data: actualEmbeddings, error: embeddingsError } = await supabase
      .from('unified_embeddings')
      .select('source_id, content_type, created_at')
      .eq('source_type', 'receipt')
      .in('source_id', receiptIds);

    if (embeddingsError) {
      throw new Error(`Error fetching embeddings: ${embeddingsError.message}`);
    }

    const embeddingsMap = new Map();
    (actualEmbeddings || []).forEach(emb => {
      if (!embeddingsMap.has(emb.source_id)) {
        embeddingsMap.set(emb.source_id, []);
      }
      embeddingsMap.get(emb.source_id).push(emb.content_type);
    });

    console.log(`📊 Found ${actualEmbeddings?.length || 0} actual embeddings in unified_embeddings table`);
    console.log(`📊 Covering ${embeddingsMap.size} unique receipts`);
    
    // Analyze discrepancies
    const receiptsClaimingEmbeddings = allReceipts.filter(r => r.has_embeddings === true);
    const receiptsWithActualEmbeddings = allReceipts.filter(r => embeddingsMap.has(r.id));
    
    const falsePositives = receiptsClaimingEmbeddings.filter(r => !embeddingsMap.has(r.id));
    const falseNegatives = receiptsWithActualEmbeddings.filter(r => r.has_embeddings === false);
    
    console.log(`\n📊 Data Consistency Analysis:`);
    console.log(`   ✅ Receipts claiming to have embeddings: ${receiptsClaimingEmbeddings.length}`);
    console.log(`   ✅ Receipts with actual embeddings: ${receiptsWithActualEmbeddings.length}`);
    console.log(`   ❌ False positives (claim embeddings but don't have): ${falsePositives.length}`);
    console.log(`   ❌ False negatives (have embeddings but don't claim): ${falseNegatives.length}`);
    
    if (falsePositives.length > 0) {
      console.log(`\n⚠️  False Positives (first 5):`);
      falsePositives.slice(0, 5).forEach((receipt, index) => {
        console.log(`   ${index + 1}. Receipt ID: ${receipt.id}`);
      });
    }
    
    if (falseNegatives.length > 0) {
      console.log(`\n⚠️  False Negatives (first 5):`);
      falseNegatives.slice(0, 5).forEach((receipt, index) => {
        const contentTypes = embeddingsMap.get(receipt.id).join(', ');
        console.log(`   ${index + 1}. Receipt ID: ${receipt.id} (has: ${contentTypes})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in cross-reference analysis:', error.message);
  }
}

/**
 * Main assessment function
 */
async function assessSystemWideEmbeddingCoverage(): Promise<void> {
  console.log('🔍 System-Wide Embedding Coverage Assessment');
  console.log('===========================================');
  
  try {
    // 1. Overall statistics
    const overallStats = await getOverallStatistics();
    
    console.log('\n📊 Overall System Statistics:');
    console.log(`   Total receipts: ${overallStats.totalReceipts}`);
    console.log(`   Receipts with embeddings: ${overallStats.receiptsWithEmbeddings} (${overallStats.embeddingCoverage.toFixed(1)}%)`);
    console.log(`   Receipts without embeddings: ${overallStats.receiptsWithoutEmbeddings}`);
    console.log(`   Receipts with fullText: ${overallStats.receiptsWithFullText} (${overallStats.fullTextCoverage.toFixed(1)}%)`);
    console.log(`   Receipts without fullText: ${overallStats.receiptsWithoutFullText}`);
    
    // 2. Date range analysis
    const dateRangeAnalysis = await analyzeByDateRanges();
    
    console.log('\n📅 Monthly Embedding Coverage Analysis:');
    dateRangeAnalysis.forEach(range => {
      const status = range.embeddingCoverage === 100 ? '✅' : range.embeddingCoverage > 0 ? '⚠️' : '❌';
      console.log(`   ${status} ${range.dateRange}: ${range.totalReceipts} receipts, ${range.embeddingCoverage.toFixed(1)}% embeddings, ${range.fullTextCoverage.toFixed(1)}% fullText`);
    });
    
    // 3. Detailed analysis of receipts without embeddings
    const receiptsWithoutEmbeddings = await analyzeReceiptsWithoutEmbeddings();
    
    // 4. Cross-reference with actual embeddings
    await crossReferenceWithUnifiedEmbeddings();
    
    // 5. Summary and recommendations
    console.log('\n📋 Assessment Summary:');
    console.log('=====================');
    
    const criticalIssues = [];
    const recommendations = [];
    
    if (overallStats.embeddingCoverage < 100) {
      criticalIssues.push(`${overallStats.receiptsWithoutEmbeddings} receipts lack embeddings`);
      recommendations.push('Generate embeddings for all receipts without embeddings');
    }
    
    if (overallStats.fullTextCoverage === 0) {
      criticalIssues.push('No receipts have fullText content - OCR processing may be broken');
      recommendations.push('Use merchant names as fallback content for embedding generation');
    }
    
    const monthsWithoutEmbeddings = dateRangeAnalysis.filter(r => r.embeddingCoverage === 0).length;
    if (monthsWithoutEmbeddings > 0) {
      criticalIssues.push(`${monthsWithoutEmbeddings} months have 0% embedding coverage`);
      recommendations.push('Prioritize embedding generation for months with zero coverage');
    }
    
    console.log('\n🚨 Critical Issues:');
    if (criticalIssues.length === 0) {
      console.log('   ✅ No critical issues found');
    } else {
      criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    if (recommendations.length === 0) {
      console.log('   ✅ System is in good state');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Priority assessment
    const urgencyLevel = overallStats.embeddingCoverage < 50 ? 'HIGH' : 
                        overallStats.embeddingCoverage < 80 ? 'MEDIUM' : 'LOW';
    
    console.log(`\n🎯 Priority Level: ${urgencyLevel}`);
    console.log(`📊 Estimated work: ${overallStats.receiptsWithoutEmbeddings} receipts need embedding generation`);
    
    if (urgencyLevel === 'HIGH') {
      console.log('⚠️  URGENT: Search functionality is significantly impacted');
      console.log('🔧 RECOMMENDATION: Proceed with immediate bulk embedding generation');
    } else if (urgencyLevel === 'MEDIUM') {
      console.log('⚠️  MODERATE: Some search functionality gaps exist');
      console.log('🔧 RECOMMENDATION: Schedule bulk embedding generation as maintenance work');
    } else {
      console.log('✅ LOW: System is mostly functional');
      console.log('🔧 RECOMMENDATION: Monitor and address gaps during regular maintenance');
    }
    
  } catch (error) {
    console.error('❌ Assessment failed:', error.message);
  }
}

// Run the assessment
assessSystemWideEmbeddingCoverage().catch(console.error);
