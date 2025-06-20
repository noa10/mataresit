/**
 * Advanced Search Parameter Testing
 * Tests search functions with various parameters to identify the exact issue
 */

import { supabase } from './supabase';

export interface SearchParameterTestResult {
  testName: string;
  success: boolean;
  resultCount: number;
  parameters: any;
  error?: string;
  details?: any;
  timing: number;
}

/**
 * Test unified_search with real embeddings from the database
 */
export async function testWithRealEmbeddings(): Promise<SearchParameterTestResult[]> {
  const results: SearchParameterTestResult[] = [];
  
  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated user');
    }

    const userId = session.user.id;

    // 1. Get a real embedding from the database
    const { data: realEmbedding, error: embError } = await supabase
      .from('unified_embeddings')
      .select('embedding, content_text, source_id')
      .eq('user_id', userId)
      .eq('source_type', 'receipt')
      .limit(1)
      .single();

    if (embError || !realEmbedding) {
      results.push({
        testName: 'Get Real Embedding',
        success: false,
        resultCount: 0,
        parameters: { userId },
        error: embError?.message || 'No embeddings found',
        timing: 0
      });
      return results;
    }

    results.push({
      testName: 'Get Real Embedding',
      success: true,
      resultCount: 1,
      parameters: { userId },
      details: { 
        contentText: realEmbedding.content_text,
        sourceId: realEmbedding.source_id
      },
      timing: 0
    });

    // 2. Test with the real embedding and very low threshold
    const testConfigs = [
      { threshold: 0.1, userFilter: userId, name: 'Real Embedding + User Filter + Low Threshold' },
      { threshold: 0.01, userFilter: userId, name: 'Real Embedding + User Filter + Very Low Threshold' },
      { threshold: 0.1, userFilter: null, name: 'Real Embedding + No User Filter + Low Threshold' },
      { threshold: 0.5, userFilter: userId, name: 'Real Embedding + User Filter + Medium Threshold' },
      { threshold: 0.9, userFilter: userId, name: 'Real Embedding + User Filter + High Threshold' }
    ];

    for (const config of testConfigs) {
      const startTime = Date.now();
      
      try {
        const { data: searchResults, error: searchError } = await supabase.rpc('unified_search', {
          query_embedding: realEmbedding.embedding,
          source_types: ['receipt'],
          content_types: null,
          similarity_threshold: config.threshold,
          match_count: 10,
          user_filter: config.userFilter,
          team_filter: null,
          language_filter: null
        });

        const timing = Date.now() - startTime;

        results.push({
          testName: config.name,
          success: !searchError,
          resultCount: searchResults?.length || 0,
          parameters: {
            threshold: config.threshold,
            userFilter: config.userFilter,
            sourceTypes: ['receipt']
          },
          error: searchError?.message,
          details: searchResults?.slice(0, 3), // First 3 results
          timing
        });

      } catch (testError) {
        results.push({
          testName: config.name,
          success: false,
          resultCount: 0,
          parameters: config,
          error: testError instanceof Error ? testError.message : String(testError),
          timing: Date.now() - startTime
        });
      }
    }

    return results;

  } catch (error) {
    results.push({
      testName: 'Test Setup',
      success: false,
      resultCount: 0,
      parameters: {},
      error: error instanceof Error ? error.message : String(error),
      timing: 0
    });
    return results;
  }
}

/**
 * Test different similarity thresholds with dummy embeddings
 */
export async function testSimilarityThresholds(): Promise<SearchParameterTestResult[]> {
  const results: SearchParameterTestResult[] = [];
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated user');
    }

    const userId = session.user.id;
    const dummyEmbedding = new Array(1536).fill(0.1);

    const thresholds = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];

    for (const threshold of thresholds) {
      const startTime = Date.now();
      
      try {
        const { data: searchResults, error: searchError } = await supabase.rpc('unified_search', {
          query_embedding: dummyEmbedding,
          source_types: ['receipt'],
          similarity_threshold: threshold,
          match_count: 10,
          user_filter: userId
        });

        const timing = Date.now() - startTime;

        results.push({
          testName: `Threshold ${threshold}`,
          success: !searchError,
          resultCount: searchResults?.length || 0,
          parameters: { threshold, userFilter: userId },
          error: searchError?.message,
          timing
        });

      } catch (testError) {
        results.push({
          testName: `Threshold ${threshold}`,
          success: false,
          resultCount: 0,
          parameters: { threshold },
          error: testError instanceof Error ? testError.message : String(testError),
          timing: Date.now() - startTime
        });
      }
    }

    return results;

  } catch (error) {
    results.push({
      testName: 'Threshold Test Setup',
      success: false,
      resultCount: 0,
      parameters: {},
      error: error instanceof Error ? error.message : String(error),
      timing: 0
    });
    return results;
  }
}

/**
 * Test user filtering behavior
 */
export async function testUserFiltering(): Promise<SearchParameterTestResult[]> {
  const results: SearchParameterTestResult[] = [];
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated user');
    }

    const userId = session.user.id;
    
    // Get a real embedding
    const { data: realEmbedding } = await supabase
      .from('unified_embeddings')
      .select('embedding')
      .eq('source_type', 'receipt')
      .limit(1)
      .single();

    if (!realEmbedding) {
      throw new Error('No embeddings found for testing');
    }

    const testConfigs = [
      { userFilter: userId, name: 'With Current User Filter' },
      { userFilter: null, name: 'No User Filter' },
      { userFilter: '00000000-0000-0000-0000-000000000000', name: 'With Fake User Filter' }
    ];

    for (const config of testConfigs) {
      const startTime = Date.now();
      
      try {
        const { data: searchResults, error: searchError } = await supabase.rpc('unified_search', {
          query_embedding: realEmbedding.embedding,
          source_types: ['receipt'],
          similarity_threshold: 0.1,
          match_count: 10,
          user_filter: config.userFilter
        });

        const timing = Date.now() - startTime;

        results.push({
          testName: config.name,
          success: !searchError,
          resultCount: searchResults?.length || 0,
          parameters: { userFilter: config.userFilter },
          error: searchError?.message,
          details: {
            sampleResults: searchResults?.slice(0, 2),
            userIds: searchResults?.map(r => r.metadata?.user_id || 'unknown').slice(0, 5)
          },
          timing
        });

      } catch (testError) {
        results.push({
          testName: config.name,
          success: false,
          resultCount: 0,
          parameters: config,
          error: testError instanceof Error ? testError.message : String(testError),
          timing: Date.now() - startTime
        });
      }
    }

    return results;

  } catch (error) {
    results.push({
      testName: 'User Filter Test Setup',
      success: false,
      resultCount: 0,
      parameters: {},
      error: error instanceof Error ? error.message : String(error),
      timing: 0
    });
    return results;
  }
}

/**
 * Run comprehensive search parameter tests
 */
export async function runComprehensiveSearchTests(): Promise<{
  realEmbeddingTests: SearchParameterTestResult[];
  thresholdTests: SearchParameterTestResult[];
  userFilterTests: SearchParameterTestResult[];
  summary: {
    totalTests: number;
    successfulTests: number;
    testsWithResults: number;
    avgTiming: number;
  };
}> {
  const realEmbeddingTests = await testWithRealEmbeddings();
  const thresholdTests = await testSimilarityThresholds();
  const userFilterTests = await testUserFiltering();

  const allTests = [...realEmbeddingTests, ...thresholdTests, ...userFilterTests];
  
  const summary = {
    totalTests: allTests.length,
    successfulTests: allTests.filter(t => t.success).length,
    testsWithResults: allTests.filter(t => t.success && t.resultCount > 0).length,
    avgTiming: allTests.reduce((sum, t) => sum + t.timing, 0) / allTests.length
  };

  return {
    realEmbeddingTests,
    thresholdTests,
    userFilterTests,
    summary
  };
}
