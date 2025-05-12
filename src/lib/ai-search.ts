import { supabase } from './supabase';
import { callEdgeFunction } from './edge-function-utils';

/**
 * Type definitions for semantic search
 */
export interface SearchParams {
  query: string;
  contentType?: 'fullText' | 'merchant' | 'notes';
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
  searchTarget?: 'receipts' | 'line_items'; // Target for search (receipts or line items)
}

export interface ReceiptWithSimilarity {
  id: string;
  merchant: string;
  date: string;
  total: number;
  notes?: string;
  raw_text?: string;
  predicted_category?: string;
  similarity_score: number;
  // Other receipt properties
}

export interface LineItemSearchResult {
  line_item_id: string;
  receipt_id: string;
  line_item_description: string;
  line_item_quantity?: number;
  line_item_price?: number;
  line_item_amount?: number;
  parent_receipt_merchant: string;
  parent_receipt_date: string;
  similarity: number;
}

export interface SearchResult {
  receipts?: ReceiptWithSimilarity[]; // Optional: results for receipts
  lineItems?: LineItemSearchResult[]; // Optional: results for line items
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
        lineItems: [],
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
        lineItems: [],
        count: 0,
        total: 0,
        searchParams: params,
      };
    }

    // Helper function to process search results from the edge function
    function handleSearchResults(data: any, searchTarget: string): SearchResult {
      console.log('Processing search results from API:', {
        target: searchTarget,
        hasLineItems: !!data.results.lineItems,
        hasReceipts: !!data.results.receipts,
        raw: data.results
      });
      
      let results: SearchResult = {
        receipts: [],
        lineItems: [],
        count: data.results?.count || 0,
        total: data.results?.total || 0,
        searchParams: data.searchParams,
      };
      
      // Handle line item search results
      if (searchTarget === 'line_items') {
        // Try various possible response formats
        if (data.results.lineItems && Array.isArray(data.results.lineItems)) {
          console.log('Using lineItems array directly from results');
          results.lineItems = data.results.lineItems;
        } 
        else if (data.results.receipts && Array.isArray(data.results.receipts) && searchTarget === 'line_items') {
          console.log('Converting receipts format to lineItems format');
          
          results.lineItems = data.results.receipts.map((item: any) => ({
            line_item_id: item.id || item.line_item_id,
            receipt_id: item.receipt_id,
            line_item_description: item.description || item.line_item_description,
            line_item_price: item.amount || item.line_item_price,
            line_item_quantity: 1,
            parent_receipt_merchant: item.parent_receipt_merchant,
            parent_receipt_date: item.parent_receipt_date,
            similarity: item.similarity_score || item.similarity || 0
          }));
        }
      } 
      // Handle receipt search results
      else if (data.results.receipts) {
        results.receipts = data.results.receipts;
      }

      console.log('Processed results:', {
        type: searchTarget,
        lineItemsCount: results.lineItems?.length || 0,
        receiptsCount: results.receipts?.length || 0,
        total: results.total
      });

      return results;
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

        // Process results using our helper function
        const results = handleSearchResults(data, params.searchTarget || 'receipts');

        // If no results found, try fallback search (only for receipts)
        if ((params.searchTarget !== 'line_items' && (!results.receipts || results.receipts.length === 0)) || 
            (params.searchTarget === 'line_items' && (!results.lineItems || results.lineItems.length === 0))) {
          console.log('No results from vector search, trying fallback search');
          // Only use fallback for receipts search, not line items
          if (params.searchTarget !== 'line_items') {
            return await fallbackBasicSearch(params);
          }
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

  // Line item fallback search is not supported yet
  if (params.searchTarget === 'line_items') {
    console.log('Fallback search not supported for line items');
    return {
      receipts: [],
      lineItems: [],
      count: 0,
      total: 0,
      searchParams: params,
    };
  }
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('User is not authenticated for fallback search');
    return {
      receipts: [],
      lineItems: [],
      count: 0,
      total: 0,
      searchParams: params,
    };
  }

  console.log('Starting fallback search with query:', query);

  try {
    // Build a basic text search query
    // First, try to get at least some results by using a very simple query
    let textQuery = supabase
      .from('receipts')
      .select('*')
      .limit(limit)
      .order('date', { ascending: false });

    // If we have a specific query, use it to filter
    if (query && query.trim() !== '') {
      console.log('Performing text search with query:', query);
      
      try {
        // Try individual filter approach (more reliable but potentially slower)
        const { data: merchantData, error: merchantError } = await supabase
          .from('receipts')
          .select('*')
          .ilike('merchant', `%${query}%`)
          .order('date', { ascending: false })
          .limit(limit);
          
        const { data: categoryData, error: categoryError } = await supabase
          .from('receipts')
          .select('*')
          .ilike('predicted_category', `%${query}%`)
          .order('date', { ascending: false })
          .limit(limit);

        // Note: fullText column is case-sensitive, so need to use a different approach
        const { data: fullTextData, error: fullTextError } = await supabase
          .from('receipts')
          .select('*')
          .filter('LOWER("fullText")', 'ilike', `%${query.toLowerCase()}%`)
          .order('date', { ascending: false })
          .limit(limit);
          
        // Combine results and remove duplicates
        const combinedResults = [...(merchantData || []), ...(categoryData || []), ...(fullTextData || [])];
        const uniqueResults = Array.from(new Map(combinedResults.map(item => [item.id, item])).values());
        
        console.log(`Found results: merchant(${merchantData?.length || 0}), category(${categoryData?.length || 0}), fullText(${fullTextData?.length || 0})`);
        
        // If we found results with individual queries, return them
        if (uniqueResults.length > 0) {
          // Sort by date
          uniqueResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Apply pagination
          const paginatedResults = uniqueResults.slice(offset, offset + limit);
          
          // Add similarity score
          const receiptsWithScores = paginatedResults.map(receipt => ({
            ...receipt,
            similarity_score: 0 // No meaningful similarity score in fallback search
          }));
          
          const results: SearchResult = {
            receipts: receiptsWithScores,
            lineItems: [], 
            count: receiptsWithScores.length,
            total: uniqueResults.length,
            searchParams: {
              ...params,
              isVectorSearch: false,
            },
          };
          
          console.log('Returning combined fallback results:', results.count);
          return results;
        }
      } catch (individualQueryError) {
        console.error('Error with individual query approach:', individualQueryError);
      }
      
      // If individual queries didn't work or didn't find results, try simpler approach
      textQuery = supabase
        .from('receipts')
        .select('*')
        .ilike('merchant', `%${query}%`)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
    }

    console.log('Fallback to simple merchant search query:', query);

    // Apply date filters if present
    if (params.startDate) {
      textQuery = textQuery.gte('date', params.startDate);
    }

    if (params.endDate) {
      textQuery = textQuery.lte('date', params.endDate);
    }

    // Execute the query
    const { data, error, count } = await textQuery;
    console.log('Simple fallback search results:', { count: data?.length || 0, error: error?.message || 'none' });

    if (error) {
      console.error('Fallback search error:', error);
      throw error;
    }

    // Add similarity_score to make receipts compatible with ReceiptWithSimilarity type
    const receiptsWithScores = (data || []).map(receipt => ({
      ...receipt,
      similarity_score: 0 // No meaningful similarity score in fallback search
    }));

    const results: SearchResult = {
      receipts: receiptsWithScores,
      lineItems: [], // Always empty for fallback search
      count: data?.length || 0,
      total: count || data?.length || 0,
      searchParams: {
        ...params,
        isVectorSearch: false,
      },
    };

    console.log('Formatted simple fallback results:', results.count);
    return results;
  } catch (error) {
    console.error('Error in fallback search:', error);
    return {
      receipts: [],
      lineItems: [],
      count: 0, 
      total: 0,
      searchParams: params,
    };
  }
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
 * Check if embeddings exist for line items
 */
export async function checkLineItemEmbeddings(): Promise<{exists: boolean, count: number, total: number, withEmbeddings: number, withoutEmbeddings: number}> {
  try {
    console.log('Checking line item embeddings...');

    // Use the utility function to call the semantic-search edge function with a test parameter
    const data = await callEdgeFunction('semantic-search', 'POST', {
      testLineItemEmbeddingStatus: true
    });

    return data;
  } catch (error) {
    console.error('Error checking line item embeddings:', error);
    throw new Error(`Failed to check line item embeddings: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate embeddings for line items
 */
export async function generateLineItemEmbeddings(limit: number = 50): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    console.log(`Generating embeddings for up to ${limit} line items...`);

    // Use the utility function to call the semantic-search edge function
    const data = await callEdgeFunction('semantic-search', 'POST', {
      generateLineItemEmbeddings: true,
      limit
    });

    console.log('Line item embedding generation result:', data);
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error generating line item embeddings:', error);
    throw new Error(`Failed to generate line item embeddings: ${errorMessage}`);
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
