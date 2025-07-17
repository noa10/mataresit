#!/usr/bin/env tsx

/**
 * Evaluate Search Functionality Impact
 * Test temporal search functionality across different date ranges to assess user impact
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

interface SearchTestResult {
  dateRange: string;
  totalReceipts: number;
  receiptsWithEmbeddings: number;
  embeddingCoverage: number;
  searchResults: number;
  searchWorking: boolean;
  userImpact: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Generate query embedding for search testing
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/embedding-001',
        content: {
          parts: [{ text: query }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const embedding = result.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response');
    }

    // Convert 768 to 1536 dimensions (same as our stored embeddings)
    const convertedEmbedding = embedding.flatMap((val: number) => [val, val]);
    
    // Normalize
    const magnitude = Math.sqrt(convertedEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
    return convertedEmbedding.map((val: number) => val / magnitude);
  } catch (error) {
    console.error('❌ Error generating query embedding:', error.message);
    throw error;
  }
}

/**
 * Test search functionality for a specific date range
 */
async function testSearchForDateRange(
  dateStart: string, 
  dateEnd: string, 
  query: string = 'supermarket'
): Promise<SearchTestResult> {
  try {
    console.log(`🔍 Testing search for ${dateStart} to ${dateEnd}...`);
    
    // Get receipts in this date range
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, date, merchant, has_embeddings')
      .eq('user_id', USER_ID)
      .gte('date', dateStart)
      .lte('date', dateEnd);

    if (receiptsError) {
      throw new Error(`Error fetching receipts: ${receiptsError.message}`);
    }

    const totalReceipts = receipts?.length || 0;
    const receiptsWithEmbeddings = receipts?.filter(r => r.has_embeddings === true).length || 0;
    const embeddingCoverage = totalReceipts > 0 ? (receiptsWithEmbeddings / totalReceipts) * 100 : 0;

    console.log(`   📊 ${totalReceipts} receipts, ${receiptsWithEmbeddings} with embeddings (${embeddingCoverage.toFixed(1)}%)`);

    let searchResults = 0;
    let searchWorking = false;

    if (totalReceipts > 0 && receiptsWithEmbeddings > 0) {
      try {
        // Generate embedding for search query
        const queryEmbedding = await generateQueryEmbedding(query);
        
        // Get receipt IDs for this date range
        const receiptIds = receipts?.map(r => r.id) || [];
        
        // Test hybrid temporal semantic search
        const { data: searchData, error: searchError } = await supabase.rpc('hybrid_temporal_semantic_search', {
          query_embedding: queryEmbedding,
          query_text: query,
          user_filter: USER_ID,
          receipt_ids: receiptIds,
          content_types: ['merchant'],
          similarity_threshold: 0.1,
          semantic_weight: 0.7,
          keyword_weight: 0.2,
          trigram_weight: 0.1,
          match_count: 20
        });

        if (!searchError && searchData) {
          searchResults = searchData.length;
          searchWorking = searchResults > 0;
          console.log(`   🎯 Search returned ${searchResults} results`);
        } else {
          console.log(`   ❌ Search failed: ${searchError?.message || 'Unknown error'}`);
        }
      } catch (searchError) {
        console.log(`   ❌ Search error: ${searchError.message}`);
      }
    } else {
      console.log(`   ⚠️  No receipts with embeddings - search not possible`);
    }

    // Determine user impact
    let userImpact: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    
    if (totalReceipts === 0) {
      userImpact = 'NONE';
    } else if (embeddingCoverage === 0) {
      userImpact = 'CRITICAL';
    } else if (embeddingCoverage < 25) {
      userImpact = 'HIGH';
    } else if (embeddingCoverage < 50) {
      userImpact = 'MEDIUM';
    } else if (embeddingCoverage < 100) {
      userImpact = 'LOW';
    } else {
      userImpact = 'NONE';
    }

    return {
      dateRange: `${dateStart} to ${dateEnd}`,
      totalReceipts,
      receiptsWithEmbeddings,
      embeddingCoverage,
      searchResults,
      searchWorking,
      userImpact
    };
  } catch (error) {
    console.error(`❌ Error testing search for ${dateStart} to ${dateEnd}:`, error.message);
    return {
      dateRange: `${dateStart} to ${dateEnd}`,
      totalReceipts: 0,
      receiptsWithEmbeddings: 0,
      embeddingCoverage: 0,
      searchResults: 0,
      searchWorking: false,
      userImpact: 'CRITICAL'
    };
  }
}

/**
 * Test search functionality across multiple date ranges
 */
async function evaluateSearchFunctionalityImpact(): Promise<void> {
  console.log('🔍 Search Functionality Impact Evaluation');
  console.log('========================================');
  
  try {
    // Define test date ranges based on the assessment results
    const testRanges = [
      // Recent periods with known issues
      { start: '2025-07-01', end: '2025-07-06', label: 'Pre-fix July 2025' },
      { start: '2025-07-07', end: '2025-07-13', label: 'Fixed July 2025' },
      { start: '2025-07-14', end: '2025-07-31', label: 'Post-fix July 2025' },
      
      // Recent months with varying coverage
      { start: '2025-06-01', end: '2025-06-30', label: 'June 2025' },
      { start: '2025-05-01', end: '2025-05-31', label: 'May 2025' },
      { start: '2025-04-01', end: '2025-04-30', label: 'April 2025' },
      { start: '2025-03-01', end: '2025-03-31', label: 'March 2025' },
      
      // Earlier periods with zero coverage
      { start: '2025-01-01', end: '2025-02-28', label: 'Early 2025' },
      { start: '2024-01-01', end: '2024-12-31', label: 'Year 2024' },
      { start: '2023-01-01', end: '2023-12-31', label: 'Year 2023' },
      
      // Very old data
      { start: '2016-01-01', end: '2022-12-31', label: 'Historical (2016-2022)' }
    ];

    const results: SearchTestResult[] = [];
    
    console.log('\n🧪 Testing search functionality across date ranges...\n');
    
    for (const range of testRanges) {
      const result = await testSearchForDateRange(range.start, range.end);
      result.dateRange = range.label;
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Analyze results
    console.log('\n📊 Search Functionality Impact Analysis');
    console.log('======================================');
    
    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const impactIcon = {
        'NONE': '✅',
        'LOW': '🟡',
        'MEDIUM': '🟠',
        'HIGH': '🔴',
        'CRITICAL': '💀'
      }[result.userImpact];

      const searchIcon = result.searchWorking ? '✅' : '❌';

      console.log(`   ${index + 1}. ${result.dateRange}:`);
      console.log(`      📊 ${result.totalReceipts} receipts, ${result.receiptsWithEmbeddings} with embeddings (${result.embeddingCoverage.toFixed(1)}%)`);
      console.log(`      🔍 Search: ${searchIcon} (${result.searchResults} results)`);
      console.log(`      ${impactIcon} Impact: ${result.userImpact}`);
      console.log('');
    });

    // Summary statistics
    const totalPeriods = results.length;
    const periodsWithCriticalImpact = results.filter(r => r.userImpact === 'CRITICAL').length;
    const periodsWithHighImpact = results.filter(r => r.userImpact === 'HIGH').length;
    const periodsWithMediumImpact = results.filter(r => r.userImpact === 'MEDIUM').length;
    const periodsWithLowImpact = results.filter(r => r.userImpact === 'LOW').length;
    const periodsWithNoImpact = results.filter(r => r.userImpact === 'NONE').length;
    
    const periodsWithWorkingSearch = results.filter(r => r.searchWorking).length;
    const periodsWithBrokenSearch = totalPeriods - periodsWithWorkingSearch;
    
    const totalReceiptsAcrossRanges = results.reduce((sum, r) => sum + r.totalReceipts, 0);
    const totalReceiptsWithEmbeddings = results.reduce((sum, r) => sum + r.receiptsWithEmbeddings, 0);
    
    console.log('\n📈 Impact Summary:');
    console.log(`   💀 Critical Impact: ${periodsWithCriticalImpact}/${totalPeriods} periods (${((periodsWithCriticalImpact/totalPeriods)*100).toFixed(1)}%)`);
    console.log(`   🔴 High Impact: ${periodsWithHighImpact}/${totalPeriods} periods (${((periodsWithHighImpact/totalPeriods)*100).toFixed(1)}%)`);
    console.log(`   🟠 Medium Impact: ${periodsWithMediumImpact}/${totalPeriods} periods (${((periodsWithMediumImpact/totalPeriods)*100).toFixed(1)}%)`);
    console.log(`   🟡 Low Impact: ${periodsWithLowImpact}/${totalPeriods} periods (${((periodsWithLowImpact/totalPeriods)*100).toFixed(1)}%)`);
    console.log(`   ✅ No Impact: ${periodsWithNoImpact}/${totalPeriods} periods (${((periodsWithNoImpact/totalPeriods)*100).toFixed(1)}%)`);
    
    console.log('\n🔍 Search Functionality:');
    console.log(`   ✅ Working Search: ${periodsWithWorkingSearch}/${totalPeriods} periods (${((periodsWithWorkingSearch/totalPeriods)*100).toFixed(1)}%)`);
    console.log(`   ❌ Broken Search: ${periodsWithBrokenSearch}/${totalPeriods} periods (${((periodsWithBrokenSearch/totalPeriods)*100).toFixed(1)}%)`);
    
    // User experience assessment
    console.log('\n👤 User Experience Assessment:');
    
    const recentPeriods = results.filter(r => 
      r.dateRange.includes('2025') && !r.dateRange.includes('Historical')
    );
    const recentCriticalImpact = recentPeriods.filter(r => r.userImpact === 'CRITICAL').length;
    const recentWorkingSearch = recentPeriods.filter(r => r.searchWorking).length;
    
    if (recentCriticalImpact > recentPeriods.length / 2) {
      console.log('   🚨 SEVERE: Most recent periods have critical search issues');
      console.log('   📉 User experience is significantly degraded');
      console.log('   🔧 URGENT ACTION REQUIRED: Immediate embedding generation needed');
    } else if (recentWorkingSearch < recentPeriods.length / 2) {
      console.log('   ⚠️  MODERATE: Some recent periods have search issues');
      console.log('   📉 User experience is partially degraded');
      console.log('   🔧 ACTION RECOMMENDED: Schedule embedding generation soon');
    } else {
      console.log('   ✅ GOOD: Most recent periods have working search');
      console.log('   📈 User experience is mostly functional');
      console.log('   🔧 MAINTENANCE: Address remaining gaps during regular maintenance');
    }
    
    // Business impact assessment
    console.log('\n💼 Business Impact Assessment:');
    
    const criticalAndHighImpact = periodsWithCriticalImpact + periodsWithHighImpact;
    const impactPercentage = (criticalAndHighImpact / totalPeriods) * 100;
    
    if (impactPercentage > 70) {
      console.log('   🚨 CRITICAL BUSINESS IMPACT');
      console.log('   📊 Search functionality is severely compromised across most time periods');
      console.log('   💰 Revenue impact: Users cannot effectively search historical receipts');
      console.log('   🎯 Priority: IMMEDIATE bulk embedding generation required');
    } else if (impactPercentage > 40) {
      console.log('   ⚠️  SIGNIFICANT BUSINESS IMPACT');
      console.log('   📊 Search functionality is compromised across many time periods');
      console.log('   💰 Revenue impact: Users have limited search capabilities');
      console.log('   🎯 Priority: HIGH - schedule bulk embedding generation within days');
    } else if (impactPercentage > 20) {
      console.log('   🟡 MODERATE BUSINESS IMPACT');
      console.log('   📊 Search functionality has some gaps');
      console.log('   💰 Revenue impact: Minor user experience degradation');
      console.log('   🎯 Priority: MEDIUM - schedule bulk embedding generation within weeks');
    } else {
      console.log('   ✅ LOW BUSINESS IMPACT');
      console.log('   📊 Search functionality is mostly working');
      console.log('   💰 Revenue impact: Minimal');
      console.log('   🎯 Priority: LOW - address during regular maintenance');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('==================');
    
    const periodsNeedingFix = results.filter(r => 
      r.userImpact === 'CRITICAL' || r.userImpact === 'HIGH'
    );
    
    if (periodsNeedingFix.length > 0) {
      console.log('🔧 IMMEDIATE ACTIONS:');
      periodsNeedingFix.forEach((period, index) => {
        console.log(`   ${index + 1}. Fix ${period.dateRange}: ${period.totalReceipts - period.receiptsWithEmbeddings} receipts need embeddings`);
      });
    }
    
    console.log('\n🎯 STRATEGIC RECOMMENDATIONS:');
    console.log('   1. Implement bulk embedding generation for all 156 receipts without embeddings');
    console.log('   2. Fix data consistency issue: 156 receipts have embeddings but wrong status');
    console.log('   3. Investigate and fix OCR processing system (0% fullText coverage)');
    console.log('   4. Implement monitoring to prevent future embedding gaps');
    console.log('   5. Consider automated embedding generation for new receipts');
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error.message);
  }
}

// Run the evaluation
evaluateSearchFunctionalityImpact().catch(console.error);
