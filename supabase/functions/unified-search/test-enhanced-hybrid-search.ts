/**
 * Test Enhanced Hybrid Search & Re-ranking System
 * 
 * This file provides test functions to verify the enhanced hybrid search
 * and re-ranking capabilities are working correctly.
 */

import { enhancedReRanking, calculateContextualFeatures } from '../_shared/enhanced-reranking.ts';
import { extractContextualSnippets } from '../_shared/contextual-snippets.ts';
import { UnifiedSearchResult } from './types.ts';

/**
 * Test enhanced hybrid search database function
 */
export async function testEnhancedHybridSearch(supabase: any, userId: string) {
  console.log('🧪 Testing Enhanced Hybrid Search Database Function...');

  const testQueries = [
    {
      query: "McDonald's receipts",
      description: "Exact merchant name match"
    },
    {
      query: "McDonalds food",
      description: "Fuzzy merchant name with trigram matching"
    },
    {
      query: "coffee starbucks",
      description: "Category + merchant combination"
    },
    {
      query: "expensive dinner last month",
      description: "Semantic query with time context"
    }
  ];

  // Mock embedding for testing (in real usage, this would come from Gemini)
  const mockEmbedding = Array(1536).fill(0).map(() => Math.random() * 0.1);

  for (const testCase of testQueries) {
    console.log(`\n📝 Testing: "${testCase.query}" (${testCase.description})`);
    
    try {
      const { data: results, error } = await supabase.rpc('enhanced_hybrid_search', {
        query_embedding: mockEmbedding,
        query_text: testCase.query,
        source_types: ['receipt'],
        content_types: null,
        similarity_threshold: 0.1,
        trigram_threshold: 0.2,
        semantic_weight: 0.6,
        keyword_weight: 0.25,
        trigram_weight: 0.15,
        match_count: 10,
        user_filter: userId
      });

      if (error) {
        console.error('❌ Search error:', error);
        continue;
      }

      console.log(`✅ Found ${results?.length || 0} results`);
      
      if (results && results.length > 0) {
        console.log('📊 Score breakdown for top result:');
        const topResult = results[0];
        console.log(`  - Semantic similarity: ${topResult.similarity?.toFixed(3) || 'N/A'}`);
        console.log(`  - Trigram similarity: ${topResult.trigram_similarity?.toFixed(3) || 'N/A'}`);
        console.log(`  - Keyword score: ${topResult.keyword_score?.toFixed(3) || 'N/A'}`);
        console.log(`  - Combined score: ${topResult.combined_score?.toFixed(3) || 'N/A'}`);
        console.log(`  - Content: "${topResult.content_text?.substring(0, 100)}..."`);
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
}

/**
 * Test fuzzy merchant search function
 */
export async function testFuzzyMerchantSearch(supabase: any, userId: string) {
  console.log('\n🧪 Testing Fuzzy Merchant Search...');

  const testMerchants = [
    "McDonalds",
    "Starbuck",
    "KFC",
    "Pizza Hut",
    "Subway"
  ];

  for (const merchant of testMerchants) {
    console.log(`\n🔍 Searching for: "${merchant}"`);
    
    try {
      const { data: results, error } = await supabase.rpc('fuzzy_merchant_search', {
        merchant_query: merchant,
        similarity_threshold: 0.3,
        match_count: 5,
        user_filter: userId
      });

      if (error) {
        console.error('❌ Fuzzy search error:', error);
        continue;
      }

      console.log(`✅ Found ${results?.length || 0} similar merchants`);
      
      if (results && results.length > 0) {
        results.forEach((result: any, index: number) => {
          console.log(`  ${index + 1}. ${result.merchant_name} (similarity: ${result.similarity_score?.toFixed(3)}, count: ${result.occurrence_count})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Fuzzy search test failed:', error.message);
    }
  }
}

/**
 * Test enhanced re-ranking system
 */
export async function testEnhancedReRanking() {
  console.log('\n🧪 Testing Enhanced Re-ranking System...');

  // Create mock search results
  const mockResults: UnifiedSearchResult[] = [
    {
      id: '1',
      sourceType: 'receipt',
      sourceId: 'receipt-1',
      contentType: 'merchant',
      title: "McDonald's Receipt",
      description: "Fast food receipt from McDonald's",
      similarity: 0.75,
      metadata: { merchant: "McDonald's", total: 15.50, date: '2024-01-15' },
      accessLevel: 'user',
      createdAt: '2024-01-15T10:00:00Z',
      contentText: "McDonald's Big Mac Meal"
    },
    {
      id: '2',
      sourceType: 'receipt',
      sourceId: 'receipt-2',
      contentType: 'full_text',
      title: "Starbucks Coffee",
      description: "Coffee purchase at Starbucks",
      similarity: 0.65,
      metadata: { merchant: "Starbucks", total: 8.50, date: '2024-01-16' },
      accessLevel: 'user',
      createdAt: '2024-01-16T08:00:00Z',
      contentText: "Starbucks Venti Latte with extra shot"
    },
    {
      id: '3',
      sourceType: 'receipt',
      sourceId: 'receipt-3',
      contentType: 'merchant',
      title: "KFC Dinner",
      description: "Fried chicken dinner",
      similarity: 0.55,
      metadata: { merchant: "KFC", total: 25.00, date: '2024-01-14' },
      accessLevel: 'user',
      createdAt: '2024-01-14T19:00:00Z',
      contentText: "KFC Original Recipe Chicken Bucket"
    }
  ];

  // Calculate contextual features for each result
  const candidates = mockResults.map((result, index) => ({
    result,
    originalScore: result.similarity,
    contextualFeatures: calculateContextualFeatures(
      result,
      "McDonald's food",
      'document_retrieval'
    )
  }));

  console.log('📊 Original ranking:');
  candidates.forEach((candidate, index) => {
    console.log(`  ${index + 1}. ${candidate.result.title} (score: ${candidate.originalScore.toFixed(3)})`);
  });

  // Test feature-based re-ranking
  console.log('\n🔄 Testing feature-based re-ranking...');
  try {
    const featureResult = await enhancedReRanking({
      candidates,
      originalQuery: "McDonald's food",
      queryIntent: 'document_retrieval',
      reRankingStrategy: 'feature_based'
    });

    console.log('✅ Feature-based re-ranking completed');
    console.log('📊 Re-ranked results:');
    featureResult.rerankedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (similarity: ${result.similarity.toFixed(3)})`);
    });
    
    console.log('📈 Re-ranking metadata:', {
      strategy: featureResult.reRankingMetadata.strategy,
      confidence: featureResult.reRankingMetadata.confidenceLevel,
      processingTime: featureResult.reRankingMetadata.processingTime
    });

  } catch (error) {
    console.error('❌ Feature-based re-ranking failed:', error.message);
  }

  // Test hybrid re-ranking (would use LLM if API key available)
  console.log('\n🔄 Testing hybrid re-ranking...');
  try {
    const hybridResult = await enhancedReRanking({
      candidates,
      originalQuery: "McDonald's food",
      queryIntent: 'document_retrieval',
      reRankingStrategy: 'hybrid',
      userProfile: {
        currency: 'MYR',
        commonMerchants: ["McDonald's", "Starbucks"]
      }
    });

    console.log('✅ Hybrid re-ranking completed');
    console.log('📊 Final ranking:');
    hybridResult.rerankedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (similarity: ${result.similarity.toFixed(3)})`);
    });

  } catch (error) {
    console.error('❌ Hybrid re-ranking failed:', error.message);
  }
}

/**
 * Test contextual snippet extraction
 */
export async function testContextualSnippetExtraction() {
  console.log('\n🧪 Testing Contextual Snippet Extraction...');

  const testContent = `
    McDonald's Restaurant Receipt
    Order #12345
    Date: January 15, 2024
    
    Big Mac Meal - RM 15.50
    - Big Mac Burger
    - Medium Fries
    - Medium Coca-Cola
    
    Chicken McNuggets (6 pieces) - RM 8.90
    Apple Pie - RM 3.50
    
    Subtotal: RM 27.90
    Tax (6%): RM 1.67
    Total: RM 29.57
    
    Payment Method: Credit Card
    Card Number: ****1234
    
    Thank you for visiting McDonald's!
    Have a great day!
  `;

  const testQueries = [
    "Big Mac",
    "chicken nuggets",
    "total amount",
    "payment method"
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Extracting snippets for: "${query}"`);
    
    try {
      const result = await extractContextualSnippets({
        content: testContent,
        query,
        maxSnippets: 2,
        snippetLength: 100,
        highlightTerms: true
      });

      console.log(`✅ Extracted ${result.snippets.length} snippets`);
      console.log(`📊 Found ${result.totalMatches} total matches`);
      
      result.snippets.forEach((snippet, index) => {
        console.log(`\n  Snippet ${index + 1} (relevance: ${snippet.relevanceScore.toFixed(3)}):`);
        console.log(`  "${snippet.text}"`);
        console.log(`  Context type: ${snippet.contextType}`);
        console.log(`  Highlighted terms: [${snippet.highlightedTerms.join(', ')}]`);
      });

    } catch (error) {
      console.error('❌ Snippet extraction failed:', error.message);
    }
  }
}

/**
 * Test search performance statistics
 */
export async function testSearchPerformanceStats(supabase: any, userId: string) {
  console.log('\n🧪 Testing Search Performance Statistics...');

  try {
    const { data: stats, error } = await supabase.rpc('get_enhanced_search_stats', {
      user_filter: userId
    });

    if (error) {
      console.error('❌ Stats error:', error);
      return;
    }

    if (stats && stats.length > 0) {
      const stat = stats[0];
      console.log('✅ Search performance statistics:');
      console.log(`  📊 Total embeddings: ${stat.total_embeddings}`);
      console.log(`  🔍 Semantic ready: ${stat.semantic_ready}`);
      console.log(`  🔤 Trigram indexed: ${stat.trigram_indexed}`);
      console.log(`  📏 Average content length: ${stat.avg_content_length?.toFixed(1) || 'N/A'}`);
      console.log(`  📈 Performance metrics:`, stat.search_performance_metrics);
      console.log(`  🏷️ Top content types:`, stat.top_content_types);
    } else {
      console.log('ℹ️ No statistics available');
    }

  } catch (error) {
    console.error('❌ Performance stats test failed:', error.message);
  }
}

/**
 * Run all enhanced hybrid search tests
 */
export async function runAllEnhancedSearchTests(supabase: any, userId: string) {
  console.log('🚀 Starting Enhanced Hybrid Search & Re-ranking Tests...\n');

  try {
    await testEnhancedHybridSearch(supabase, userId);
    await testFuzzyMerchantSearch(supabase, userId);
    await testEnhancedReRanking();
    await testContextualSnippetExtraction();
    await testSearchPerformanceStats(supabase, userId);
    
    console.log('\n✅ All enhanced search tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Export individual test functions for selective testing
export {
  testEnhancedHybridSearch,
  testFuzzyMerchantSearch,
  testEnhancedReRanking,
  testContextualSnippetExtraction,
  testSearchPerformanceStats
};
