#!/usr/bin/env tsx

/**
 * Test Temporal Search Functionality
 * Verifies that the temporal search system works correctly for the fixed date range
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

/**
 * Generate query embedding for search
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
 * Test semantic search for receipts in the temporal date range
 */
async function testSemanticSearch(query: string, dateStart: string, dateEnd: string): Promise<any[]> {
  try {
    console.log(`🔍 Testing semantic search for: "${query}"`);
    console.log(`📅 Date range: ${dateStart} to ${dateEnd}`);
    
    // Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(query);
    console.log(`✅ Generated query embedding with ${queryEmbedding.length} dimensions`);
    
    // Perform semantic search using cosine similarity
    const { data: searchResults, error } = await supabase.rpc('semantic_search_receipts', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Lower threshold to get more results
      match_count: 20,
      user_id_param: 'feecc208-3282-49d2-8e15-0c64b0ee4abb',
      date_start: dateStart,
      date_end: dateEnd
    });

    if (error) {
      console.error('❌ Semantic search error:', error);
      return [];
    }

    console.log(`📊 Found ${searchResults?.length || 0} semantic search results`);
    
    if (searchResults && searchResults.length > 0) {
      console.log('\n🎯 Semantic Search Results:');
      searchResults.forEach((result: any, index: number) => {
        console.log(`   ${index + 1}. ${result.date} - ${result.merchant} (similarity: ${result.similarity?.toFixed(3)})`);
      });
    }

    return searchResults || [];
  } catch (error) {
    console.error('❌ Error in semantic search:', error.message);
    return [];
  }
}

/**
 * Test basic receipt filtering for the date range
 */
async function testBasicFiltering(dateStart: string, dateEnd: string): Promise<any[]> {
  try {
    console.log(`\n📋 Testing basic receipt filtering for date range: ${dateStart} to ${dateEnd}`);
    
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select(`
        id,
        date,
        merchant,
        total,
        currency,
        has_embeddings,
        embedding_status
      `)
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Basic filtering error:', error);
      return [];
    }

    console.log(`📊 Found ${receipts?.length || 0} receipts in date range`);
    
    if (receipts && receipts.length > 0) {
      console.log('\n📝 Receipts in Date Range:');
      receipts.forEach((receipt: any, index: number) => {
        const embeddingStatus = receipt.has_embeddings ? '✅' : '❌';
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} ${embeddingStatus} (${receipt.total} ${receipt.currency})`);
      });
    }

    return receipts || [];
  } catch (error) {
    console.error('❌ Error in basic filtering:', error.message);
    return [];
  }
}

/**
 * Test the unified search API endpoint
 */
async function testUnifiedSearchAPI(query: string, dateStart: string, dateEnd: string): Promise<any> {
  try {
    console.log(`\n🚀 Testing unified search API for: "${query}"`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        query: query,
        targets: ['receipts'],
        filters: {
          dateRange: {
            start: dateStart,
            end: dateEnd
          }
        },
        userId: 'feecc208-3282-49d2-8e15-0c64b0ee4abb',
        limit: 20
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Unified search API error: ${response.status} ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`📊 Unified search found ${result.results?.receipts?.length || 0} results`);
    
    if (result.results?.receipts && result.results.receipts.length > 0) {
      console.log('\n🎯 Unified Search Results:');
      result.results.receipts.forEach((receipt: any, index: number) => {
        console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} (score: ${receipt.score?.toFixed(3)})`);
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Error in unified search API:', error.message);
    return null;
  }
}

/**
 * Comprehensive test of temporal search functionality
 */
async function testTemporalSearchFunctionality() {
  console.log('🧪 Temporal Search Functionality Test');
  console.log('====================================');
  
  const dateStart = '2025-07-07';
  const dateEnd = '2025-07-13';
  
  try {
    // Test 1: Basic receipt filtering
    console.log('\n1. Testing basic receipt filtering...');
    const basicResults = await testBasicFiltering(dateStart, dateEnd);
    
    // Test 2: Semantic search with merchant names
    console.log('\n2. Testing semantic search with merchant queries...');
    const merchantQueries = [
      'PERNIAGAAN WAH SING',
      'SUPER SEVEN',
      'MY HERO',
      'frozen food',
      'cash carry'
    ];
    
    let totalSemanticResults = 0;
    for (const query of merchantQueries) {
      const results = await testSemanticSearch(query, dateStart, dateEnd);
      totalSemanticResults += results.length;
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 3: Unified search API
    console.log('\n3. Testing unified search API...');
    const unifiedResult = await testUnifiedSearchAPI('supermarket', dateStart, dateEnd);
    
    // Test 4: Summary and validation
    console.log('\n4. Test Summary and Validation');
    console.log('==============================');
    
    const receiptsWithEmbeddings = basicResults.filter(r => r.has_embeddings).length;
    const receiptsTotal = basicResults.length;
    
    console.log(`📊 Total receipts in date range: ${receiptsTotal}`);
    console.log(`✅ Receipts with embeddings: ${receiptsWithEmbeddings}`);
    console.log(`📈 Embedding coverage: ${receiptsTotal > 0 ? ((receiptsWithEmbeddings / receiptsTotal) * 100).toFixed(1) : 0}%`);
    console.log(`🔍 Total semantic search results: ${totalSemanticResults}`);
    console.log(`🚀 Unified search API: ${unifiedResult ? 'Working' : 'Failed'}`);
    
    // Validation checks
    const validationResults = {
      allReceiptsHaveEmbeddings: receiptsWithEmbeddings === receiptsTotal,
      semanticSearchWorking: totalSemanticResults > 0,
      unifiedSearchWorking: unifiedResult !== null,
      temporalFilteringWorking: receiptsTotal === 32 // Expected number
    };
    
    console.log('\n✅ Validation Results:');
    console.log(`   All receipts have embeddings: ${validationResults.allReceiptsHaveEmbeddings ? '✅' : '❌'}`);
    console.log(`   Semantic search working: ${validationResults.semanticSearchWorking ? '✅' : '❌'}`);
    console.log(`   Unified search API working: ${validationResults.unifiedSearchWorking ? '✅' : '❌'}`);
    console.log(`   Temporal filtering working: ${validationResults.temporalFilteringWorking ? '✅' : '❌'}`);
    
    const allTestsPassed = Object.values(validationResults).every(result => result === true);
    
    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Temporal search functionality is fully restored!');
      console.log('✅ The temporal search system is working correctly for the date range 2025-07-07 to 2025-07-13');
    } else {
      console.log('\n⚠️  Some tests failed. Temporal search functionality may need additional fixes.');
    }
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testTemporalSearchFunctionality().catch(console.error);
