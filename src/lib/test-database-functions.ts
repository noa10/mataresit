/**
 * Test Database Functions
 * Quick tests to verify database functions exist and work
 */

import { supabase } from './supabase';

export interface DatabaseTestResult {
  functionName: string;
  exists: boolean;
  testPassed: boolean;
  error?: string;
  result?: any;
}

/**
 * Test if a database function exists and can be called
 */
export async function testDatabaseFunction(
  functionName: string,
  parameters: any = {}
): Promise<DatabaseTestResult> {
  try {
    console.log(`Testing database function: ${functionName}`);
    
    const { data, error } = await supabase.rpc(functionName, parameters);
    
    if (error) {
      // Check if it's a "function does not exist" error
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        return {
          functionName,
          exists: false,
          testPassed: false,
          error: `Function ${functionName} does not exist`
        };
      }
      
      // Other errors mean the function exists but failed
      return {
        functionName,
        exists: true,
        testPassed: false,
        error: error.message
      };
    }
    
    return {
      functionName,
      exists: true,
      testPassed: true,
      result: data
    };
    
  } catch (error) {
    return {
      functionName,
      exists: false,
      testPassed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test all embedding-related database functions
 */
export async function testEmbeddingDatabaseFunctions(): Promise<DatabaseTestResult[]> {
  const functions = [
    { name: 'unified_search', params: { 
      query_embedding: Array(1536).fill(0.1), // Dummy embedding
      similarity_threshold: 0.1,
      match_count: 5
    }},
    { name: 'get_unified_search_stats', params: {} },
    { name: 'get_embedding_migration_stats', params: {} },
    { name: 'find_receipts_missing_embeddings', params: { limit_count: 5 } },
    { name: 'migrate_receipt_embeddings_to_unified', params: {} },
    { name: 'fix_receipt_embedding_content', params: {} },
    { name: 'add_unified_embedding', params: {
      p_source_type: 'test',
      p_source_id: '00000000-0000-0000-0000-000000000000',
      p_content_type: 'test',
      p_content_text: 'test content',
      p_embedding: Array(1536).fill(0.1),
      p_metadata: {},
      p_user_id: null,
      p_language: 'en'
    }}
  ];
  
  const results: DatabaseTestResult[] = [];
  
  for (const func of functions) {
    const result = await testDatabaseFunction(func.name, func.params);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Test if unified_embeddings table exists and has proper structure
 */
export async function testUnifiedEmbeddingsTable(): Promise<{
  exists: boolean;
  structure?: any;
  error?: string;
}> {
  try {
    // Try to query the table structure
    const { data, error } = await supabase
      .from('unified_embeddings')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return {
          exists: false,
          error: 'unified_embeddings table does not exist'
        };
      }
      
      return {
        exists: true,
        error: error.message
      };
    }
    
    return {
      exists: true,
      structure: data
    };
    
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test basic receipt data availability
 */
export async function testReceiptData(): Promise<{
  totalReceipts: number;
  sampleReceipts: any[];
  error?: string;
}> {
  try {
    // First, try without the notes column since it doesn't exist
    const { data, error, count } = await supabase
      .from('receipts')
      .select('id, merchant, date, fullText, user_id', { count: 'exact' })
      .limit(5);

    if (error) {
      throw new Error(error.message);
    }

    return {
      totalReceipts: count || 0,
      sampleReceipts: data || []
    };

  } catch (error) {
    return {
      totalReceipts: 0,
      sampleReceipts: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test user-specific embeddings and search functionality
 */
export async function testUserEmbeddingsAndSearch(): Promise<{
  userEmbeddingsCount: number;
  sampleUserEmbeddings: any[];
  searchWithUserFilter: any;
  searchWithoutUserFilter: any;
  realQueryTest: any;
  error?: string;
}> {
  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated user');
    }

    const userId = session.user.id;

    // 1. Check user-specific embeddings
    const { data: userEmbeddings, error: embError } = await supabase
      .from('unified_embeddings')
      .select('source_type, content_type, source_id, content_text')
      .eq('user_id', userId)
      .eq('source_type', 'receipt')
      .limit(5);

    if (embError) {
      throw new Error(`User embeddings error: ${embError.message}`);
    }

    // 2. Test search with dummy embedding and user filter
    const dummyEmbedding = new Array(1536).fill(0.1);
    const { data: searchWithUser, error: searchUserError } = await supabase.rpc('unified_search', {
      query_embedding: dummyEmbedding,
      source_types: ['receipt'],
      similarity_threshold: 0.1,
      match_count: 10,
      user_filter: userId
    });

    // 3. Test search without user filter
    const { data: searchWithoutUser, error: searchNoUserError } = await supabase.rpc('unified_search', {
      query_embedding: dummyEmbedding,
      source_types: ['receipt'],
      similarity_threshold: 0.1,
      match_count: 10,
      user_filter: null
    });

    // 4. Test with a real embedding from the database
    let realQueryTest = null;
    if (userEmbeddings && userEmbeddings.length > 0) {
      // Get a real embedding from the database
      const { data: realEmbedding, error: realEmbError } = await supabase
        .from('unified_embeddings')
        .select('embedding')
        .eq('user_id', userId)
        .eq('source_type', 'receipt')
        .limit(1)
        .single();

      if (!realEmbError && realEmbedding) {
        const { data: realSearchResult, error: realSearchError } = await supabase.rpc('unified_search', {
          query_embedding: realEmbedding.embedding,
          source_types: ['receipt'],
          similarity_threshold: 0.1,
          match_count: 10,
          user_filter: userId
        });

        realQueryTest = {
          success: !realSearchError,
          resultCount: realSearchResult?.length || 0,
          error: realSearchError?.message
        };
      }
    }

    return {
      userEmbeddingsCount: userEmbeddings?.length || 0,
      sampleUserEmbeddings: userEmbeddings || [],
      searchWithUserFilter: {
        success: !searchUserError,
        resultCount: searchWithUser?.length || 0,
        error: searchUserError?.message
      },
      searchWithoutUserFilter: {
        success: !searchNoUserError,
        resultCount: searchWithoutUser?.length || 0,
        error: searchNoUserError?.message
      },
      realQueryTest
    };

  } catch (error) {
    return {
      userEmbeddingsCount: 0,
      sampleUserEmbeddings: [],
      searchWithUserFilter: { success: false, resultCount: 0, error: 'Test failed' },
      searchWithoutUserFilter: { success: false, resultCount: 0, error: 'Test failed' },
      realQueryTest: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Run comprehensive database readiness test
 */
export async function runDatabaseReadinessTest(): Promise<{
  ready: boolean;
  issues: string[];
  functionTests: DatabaseTestResult[];
  tableTest: any;
  receiptTest: any;
}> {
  const issues: string[] = [];
  
  // Test table existence
  const tableTest = await testUnifiedEmbeddingsTable();
  if (!tableTest.exists) {
    issues.push('unified_embeddings table does not exist - migrations need to be applied');
  }
  
  // Test receipt data
  const receiptTest = await testReceiptData();
  if (receiptTest.error) {
    issues.push(`Receipt data access error: ${receiptTest.error}`);
  } else if (receiptTest.totalReceipts === 0) {
    issues.push('No receipts found in database - nothing to test embeddings with');
  }
  
  // Test database functions
  const functionTests = await testEmbeddingDatabaseFunctions();
  const missingFunctions = functionTests.filter(test => !test.exists);
  const failedFunctions = functionTests.filter(test => test.exists && !test.testPassed);
  
  if (missingFunctions.length > 0) {
    issues.push(`Missing database functions: ${missingFunctions.map(f => f.functionName).join(', ')}`);
  }
  
  if (failedFunctions.length > 0) {
    issues.push(`Failed function tests: ${failedFunctions.map(f => f.functionName).join(', ')}`);
  }
  
  return {
    ready: issues.length === 0,
    issues,
    functionTests,
    tableTest,
    receiptTest
  };
}
