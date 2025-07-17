#!/usr/bin/env tsx

/**
 * Test Hybrid Temporal Semantic Search
 * Tests the hybrid_temporal_semantic_search function directly
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
 * Get receipt IDs for a specific date range
 */
async function getReceiptIdsForDateRange(dateStart: string, dateEnd: string, userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('id')
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Error fetching receipt IDs: ${error.message}`);
    }

    return (data || []).map(r => r.id);
  } catch (error) {
    console.error('❌ Error getting receipt IDs:', error.message);
    return [];
  }
}

/**
 * Test the hybrid temporal semantic search function
 */
async function testHybridTemporalSearch(query: string, dateStart: string, dateEnd: string, userId: string): Promise<void> {
  try {
    console.log(`🔍 Testing hybrid temporal semantic search for: "${query}"`);
    console.log(`📅 Date range: ${dateStart} to ${dateEnd}`);
    
    // Step 1: Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(query);
    console.log(`✅ Generated query embedding with ${queryEmbedding.length} dimensions`);
    
    // Step 2: Get receipt IDs for the date range
    const receiptIds = await getReceiptIdsForDateRange(dateStart, dateEnd, userId);
    console.log(`📊 Found ${receiptIds.length} receipts in date range`);
    
    if (receiptIds.length === 0) {
      console.log('❌ No receipts found in date range, cannot perform search');
      return;
    }
    
    // Step 3: Call the hybrid_temporal_semantic_search function
    const { data: searchResults, error } = await supabase.rpc('hybrid_temporal_semantic_search', {
      query_embedding: queryEmbedding,
      query_text: query,
      user_filter: userId,
      receipt_ids: receiptIds,
      content_types: ['merchant'], // We only have merchant embeddings
      similarity_threshold: 0.1,
      semantic_weight: 0.7,
      keyword_weight: 0.2,
      trigram_weight: 0.1,
      match_count: 20
    });

    if (error) {
      console.error('❌ Hybrid search error:', error);
      return;
    }

    console.log(`📊 Found ${searchResults?.length || 0} search results`);
    
    if (searchResults && searchResults.length > 0) {
      console.log('\n🎯 Hybrid Search Results:');
      searchResults.forEach((result: any, index: number) => {
        console.log(`   ${index + 1}. ${result.content_type}: ${result.content_text}`);
        console.log(`      Semantic: ${result.similarity?.toFixed(3)}, Keyword: ${result.keyword_score?.toFixed(3)}, Combined: ${result.combined_score?.toFixed(3)}`);
      });
      
      // Get receipt details for the results
      const sourceIds = searchResults.map((r: any) => r.source_id);
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, date, merchant, total, currency')
        .in('id', sourceIds);
      
      if (!receiptsError && receipts && receipts.length > 0) {
        console.log('\n📝 Receipt Details:');
        receipts.forEach((receipt: any, index: number) => {
          console.log(`   ${index + 1}. ${receipt.date} - ${receipt.merchant} (${receipt.total} ${receipt.currency})`);
        });
      }
    } else {
      console.log('❌ No search results found');
    }
    
  } catch (error) {
    console.error('❌ Error in hybrid search:', error.message);
  }
}

/**
 * Run multiple test queries
 */
async function runTests(): Promise<void> {
  console.log('🧪 Hybrid Temporal Semantic Search Test');
  console.log('======================================');
  
  const dateStart = '2025-07-07';
  const dateEnd = '2025-07-13';
  const userId = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';
  
  const testQueries = [
    'supermarket',
    'frozen food',
    'PERNIAGAAN WAH SING',
    'SUPER SEVEN',
    'MY HERO'
  ];
  
  for (const query of testQueries) {
    await testHybridTemporalSearch(query, dateStart, dateEnd, userId);
    console.log('\n-----------------------------------\n');
    
    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ All tests completed');
}

// Run the tests
runTests().catch(console.error);
