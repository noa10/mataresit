import { supabase } from './supabase';
import { callEdgeFunction } from './edge-function-utils';

/**
 * Type definitions for semantic search
 */
export interface SearchParams {
  query: string;
  contentType?: 'full_text' | 'merchant' | 'notes';
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  categories?: string[];
  merchants?: string[];
  isNaturalLanguage?: boolean;
  isVectorSearch?: boolean; // Indicates whether vector search was used
}

export interface SearchResult {
  receipts: any[];
  count: number;
  total: number;
  searchParams: SearchParams;
}

/**
 * Perform semantic search on receipts
 */
export async function semanticSearch(params: SearchParams): Promise<SearchResult> {
  try {
    // Check if query is empty
    if (!params.query || params.query.trim() === '') {
      console.error('Empty search query');
      return {
        receipts: [],
        count: 0,
        total: 0,
        searchParams: params,
      };
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('User is not authenticated');
      return {
        receipts: [],
        count: 0,
        total: 0,
        searchParams: params,
      };
    }

    try {
      console.log('Performing semantic search using utility function...', params);

      // Try the edge function approach first
      try {
        // Use the utility function to call the semantic-search edge function
        const data = await callEdgeFunction('semantic-search', 'POST', params);
        console.log('Semantic search response:', data);

        if (!data || !data.success) {
          throw new Error(data?.error || 'Unknown error in semantic search');
        }

        const results = {
          receipts: data.results.receipts || [],
          count: data.results.count || 0,
          total: data.results.total || 0,
          searchParams: data.searchParams,
        };

        console.log('Semantic search results:', results);

        // If no results found, try fallback search
        if (results.receipts.length === 0) {
          console.log('No results from vector search, trying fallback search');
          return await fallbackBasicSearch(params);
        }

        return results;
      } catch (edgeFunctionError) {
        console.warn('Edge function approach failed, trying database function:', edgeFunctionError);
        
        // Try the database function fallback
        try {
          console.log('Using database function fallback for semantic search after edge function failure');
          
          // @ts-ignore - The function exists in the database but might not be reflected in the types
          const { data, error } = await supabase.rpc('basic_search_receipts', {
            p_query: params.query,
            p_limit: params.limit || 10,
            p_offset: params.offset || 0,
            p_start_date: params.startDate,
            p_end_date: params.endDate,
            p_min_amount: params.minAmount,
            p_max_amount: params.maxAmount,
            p_merchants: params.merchants
          });
          
          if (error) {
            console.error('Database function error:', error);
            throw new Error(`Database search error: ${error.message}`);
          }
          
          console.log('Database search function succeeded:', data && (data as any).success === true);
          
          // Type assertion for the database response
          type DbSearchResponse = {
            success: boolean;
            results: {
              receipts: any[];
              count: number;
              total: number;
            };
            searchParams: SearchParams;
          };
          
          // If no results or database function fails, try the JavaScript fallback
          const typedData = data as unknown as DbSearchResponse;
          if (!typedData || !typedData.success) {
            return await fallbackBasicSearch(params);
          }
          
          return {
            receipts: typedData.results.receipts || [],
            count: typedData.results.count || 0,
            total: typedData.results.total || 0,
            searchParams: typedData.searchParams || params,
          };
        } catch (dbFunctionError) {
          console.warn('Database function failed, using JavaScript fallback:', dbFunctionError);
          return await fallbackBasicSearch(params);
        }
      }
    } catch (vectorError) {
      console.warn('All vector search methods failed, falling back to basic search:', vectorError);

      // Fallback to basic text search if vector search fails
      return await fallbackBasicSearch(params);
    }
  } catch (error) {
    console.error('Error in semanticSearch:', error);
    throw error;
  }
}

/**
 * Fallback to basic text search when vector search is unavailable
 */
async function fallbackBasicSearch(params: SearchParams): Promise<SearchResult> {
  const { query, limit = 10, offset = 0 } = params;

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('User is not authenticated for fallback search');
    return {
      receipts: [],
      count: 0,
      total: 0,
      searchParams: params,
    };
  }

  // Build a basic text search query
  // First, try to get at least some results by using a very simple query
  let textQuery = supabase
    .from('receipts')
    .select('*')
    .limit(limit)
    .order('date', { ascending: false });

  // If we have a specific query, use it to filter
  if (query && query.trim() !== '') {
    textQuery = supabase
      .from('receipts')
      .select('*')
      .or(`merchant.ilike.%${query}%,fullText.ilike.%${query}%,predicted_category.ilike.%${query}%`)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);
  }

  console.log('Fallback search query:', query);

  // Apply date filters if present
  if (params.startDate) {
    textQuery = textQuery.gte('date', params.startDate);
  }

  if (params.endDate) {
    textQuery = textQuery.lte('date', params.endDate);
  }

  // Execute the query
  const { data, error, count } = await textQuery;
  console.log('Fallback search results:', { data, error, count });

  if (error) {
    console.error('Fallback search error:', error);
    throw error;
  }

  const results = {
    receipts: data || [],
    count: data?.length || 0,
    total: count || 0,
    searchParams: {
      ...params,
      isVectorSearch: false,
    },
  };

  console.log('Formatted fallback results:', results);
  return results;
}

/**
 * Check if embeddings exist for a receipt
 */
export async function checkEmbeddings(receiptId: string): Promise<{exists: boolean, count: number}> {
  try {
    console.log('Checking embeddings using utility function...');

    // Use the utility function to call the generate-embeddings edge function
    const data = await callEdgeFunction('generate-embeddings', 'GET', null, { receiptId });

    return {
      exists: (data?.count || 0) > 0,
      count: data?.count || 0,
    };
  } catch (error) {
    console.error('Error checking embeddings:', error);
    return { exists: false, count: 0 };
  }
}

/**
 * Generate embeddings for a receipt
 */
export async function generateEmbeddings(receiptId: string): Promise<boolean> {
  try {
    console.log('Generating embeddings using utility function...');

    // Try the direct edge function call first
    try {
      const data = await callEdgeFunction('generate-embeddings', 'POST', {
        receiptId,
        processAllFields: true,
      });
      
      return data?.success || false;
    } catch (edgeFunctionError) {
      console.warn('Edge function approach failed, trying alternative API method:', edgeFunctionError);
      
      // Fallback: Use the Supabase REST API directly to call our database function
      // @ts-ignore - The function exists in the database but might not be reflected in the types
      const { data, error } = await supabase.rpc('generate_receipt_embeddings', {
        p_receipt_id: receiptId,
        p_process_all_fields: true,
      });
      
      if (error) throw new Error(`Database procedure error: ${error.message}`);
      
      // Type assertion since we know the expected response structure
      const result = data as unknown as { success: boolean };
      return result?.success || false;
    }
  } catch (error) {
    // Provide more detailed error information
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${errorMessage}`);
  }
}

/**
 * Generate embeddings for multiple receipts
 * @param limit Maximum number of receipts to process
 */
export async function generateAllEmbeddings(limit: number = 10): Promise<{
  success: boolean;
  message: string;
  processed: number;
  successful: number;
}> {
  try {
    console.log(`Generating embeddings for up to ${limit} receipts...`);

    // Use the utility function to call the generate-all-embeddings edge function
    const data = await callEdgeFunction('generate-all-embeddings', 'GET', null, {
      limit: limit.toString()
    });

    return {
      success: data?.success || false,
      message: data?.message || 'Unknown result',
      processed: data?.processed || 0,
      successful: data?.successful || 0
    };
  } catch (error) {
    console.error('Error generating embeddings for multiple receipts:', error);
    throw error;
  }
}

/**
 * Get similar receipts based on a receipt ID
 */
export async function getSimilarReceipts(receiptId: string, limit: number = 5): Promise<any[]> {
  try {
    // First, get the receipt to access its data
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError) throw receiptError;
    if (!receipt) throw new Error('Receipt not found');

    // Use merchant name as query to find similar receipts
    const searchQuery = receipt.merchant || '';

    if (!searchQuery) return [];

    const result = await semanticSearch({
      query: searchQuery,
      contentType: 'merchant',
      limit,
      // Exclude the current receipt
    });

    // Filter out the current receipt
    return result.receipts.filter(r => r.id !== receiptId);
  } catch (error) {
    console.error('Error getting similar receipts:', error);
    return [];
  }
}
