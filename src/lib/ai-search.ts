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
  parent_receipt_id?: string; // Ensure this field is specified and documented
  receipt?: {  // Add optional receipt object that might be returned from the API
    id: string;
    merchant?: string;
    date?: string;
  };
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
          
          // Add validation for receipt_id before assigning
          results.lineItems = data.results.lineItems.map((item: any) => {
            // Check for receipt_id from various sources
            let effectiveReceiptId = item.receipt_id;
            
            // Try to find the receipt_id from various possible locations
            if (!effectiveReceiptId && item.parent_receipt_id) {
              effectiveReceiptId = item.parent_receipt_id;
              console.log(`Using parent_receipt_id for line item:`, item.line_item_id);
            }
            
            // Check if receipt_id is missing and log it
            if (!effectiveReceiptId) {
              console.warn('Line item missing receipt_id:', item);
            }
            
            return {
              line_item_id: item.line_item_id || item.id || `item-${Math.random().toString(36).substring(2, 10)}`,
              receipt_id: effectiveReceiptId || '', // Use the effective receipt ID, ensuring at least empty string
              line_item_description: item.line_item_description || item.description || 'Unknown item',
              line_item_quantity: item.line_item_quantity || item.quantity || 1,
              line_item_price: item.line_item_price || item.price || item.amount || 0,
              line_item_amount: item.line_item_amount || item.amount || item.price || 0,
              parent_receipt_merchant: item.parent_receipt_merchant || item.merchant || 'Unknown merchant',
              parent_receipt_date: item.parent_receipt_date || item.date || '',
              parent_receipt_id: item.parent_receipt_id || effectiveReceiptId || '', // Ensure parent_receipt_id is set
              similarity: item.similarity || item.similarity_score || 0
            };
          });
        } 
        else if (data.results.receipts && Array.isArray(data.results.receipts) && searchTarget === 'line_items') {
          console.log('Converting receipts format to lineItems format');
          
          results.lineItems = data.results.receipts.map((item: any) => {
            // Check for receipt_id from various sources
            let effectiveReceiptId = item.receipt_id || item.id;
            
            // Check if receipt_id is missing and log it
            if (!effectiveReceiptId) {
              console.warn('Line item (from receipts format) missing receipt_id:', item);
            }
            
            return {
              line_item_id: item.id || item.line_item_id || `item-${Math.random().toString(36).substring(2, 10)}`,
              receipt_id: effectiveReceiptId || '', // Use the effective receipt ID, ensuring at least empty string
              line_item_description: item.description || item.line_item_description || 'Unknown item',
              line_item_price: item.amount || item.line_item_price || item.price || 0,
              line_item_quantity: item.quantity || 1,
              parent_receipt_merchant: item.parent_receipt_merchant || item.merchant || 'Unknown merchant',
              parent_receipt_date: item.parent_receipt_date || item.date || '',
              parent_receipt_id: effectiveReceiptId || '', // Ensure parent_receipt_id is set
              similarity: item.similarity_score || item.similarity || 0
            };
          });
        }
      } 
      // Handle receipt search results
      else if (data.results.receipts) {
        results.receipts = data.results.receipts;
      }

      // Add validation check for lineItems with missing receipt_id
      if (results.lineItems && results.lineItems.length > 0) {
        // Direct count of missing ids instead of complex filtering
        let missingCount = 0;
        
        // Attempt to repair missing receipt_ids based on other data
        for (let i = 0; i < results.lineItems.length; i++) {
          const item = results.lineItems[i];
          
          // If receipt_id is missing, try to extract it from line_item_id if possible
          if (!item.receipt_id) {
            missingCount++;
            
            // Some line item IDs might be formatted as "receipt_id:line_number"
            if (item.line_item_id && item.line_item_id.includes(':')) {
              const parts = item.line_item_id.split(':');
              if (parts.length > 1) {
                console.log(`Repairing missing receipt_id for item ${item.line_item_id} -> ${parts[0]}`);
                results.lineItems[i].receipt_id = parts[0];
              }
            }
          }
        }
        
        if (missingCount > 0) {
          console.error(`Warning: ${missingCount} out of ${results.lineItems.length} line items are missing receipt_id`);
        }
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
        console.warn('Edge function approach failed, trying fallback search:', edgeFunctionError);
        
        // Skip the database function altogether and go straight to the JavaScript fallback
        return await fallbackBasicSearch(params);
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
 * Check if embeddings exist for a specific receipt
 */
export async function checkEmbeddings(receiptId: string): Promise<{exists: boolean, count: number}> {
  try {
    // Call the edge function to check embeddings
    const response = await callEdgeFunction('generate-embeddings', 'GET', { receiptId });
    
    console.log('Embedding check result:', response);
    
    if (response && response.success) {
      return { 
        exists: response.count > 0, 
        count: response.count || 0
      };
    }
    
    return { exists: false, count: 0 };
  } catch (error) {
    console.error('Error checking embeddings:', error);
    return { exists: false, count: 0 };
  }
}

/**
 * Generate embeddings for a specific receipt
 */
export async function generateEmbeddings(receiptId: string): Promise<boolean> {
  try {
    // Call the edge function to generate embeddings
    const response = await callEdgeFunction('generate-embeddings', 'POST', {
      receiptId,
      processAllFields: true // Process all available fields
    });
    
    console.log('Embedding generation result:', response);
    
    return response && response.success;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return false;
  }
}

/**
 * Generate embeddings for multiple receipts
 */
export async function generateAllEmbeddings(limit: number = 10): Promise<{
  success: boolean;
  message: string;
  processed: number;
  successful: number;
}> {
  try {
    // Get receipts that don't have embeddings yet
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, date, merchant, fullText')
      .not('fullText', 'is', null)  // Correct syntax for 'is not null'
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    console.log(`Found ${receipts?.length || 0} receipts to process for embeddings`);
    
    if (!receipts || receipts.length === 0) {
      return {
        success: true,
        message: 'No receipts need embeddings',
        processed: 0,
        successful: 0
      };
    }
    
    let successful = 0;
    
    // Process each receipt
    for (const receipt of receipts) {
      try {
        const generated = await generateEmbeddings(receipt.id);
        if (generated) successful++;
      } catch (err) {
        console.error(`Error generating embeddings for receipt ${receipt.id}:`, err);
      }
    }
    
    return {
      success: true,
      message: `Generated embeddings for ${successful} out of ${receipts.length} receipts`,
      processed: receipts.length,
      successful
    };
  } catch (error) {
    console.error('Error generating all embeddings:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      processed: 0,
      successful: 0
    };
  }
}

/**
 * Check if line item embeddings exist in the receipt_embeddings table
 */
export async function checkLineItemEmbeddings(): Promise<{
  exists: boolean,
  count: number,
  total: number,
  withEmbeddings: number,
  withoutEmbeddings: number
}> {
  try {
    // Query the new unified embedding model to count line item embeddings
    const { count: embeddingsCount, error: embeddingsError } = await supabase
      .from('receipt_embeddings')
      .select('id', { count: 'exact' })
      .eq('source_type', 'line_item');
    
    if (embeddingsError) throw embeddingsError;
    
    // Count total line items
    const { count: totalLineItems, error: countError } = await supabase
      .from('line_items')
      .select('id', { count: 'exact' });
    
    if (countError) throw countError;
    
    // Get counts with and without embeddings
    const withoutEmbeddings = (totalLineItems || 0) - (embeddingsCount || 0);
    
    return {
      exists: (embeddingsCount || 0) > 0,
      count: embeddingsCount || 0,
      total: totalLineItems || 0,
      withEmbeddings: embeddingsCount || 0,
      withoutEmbeddings: withoutEmbeddings > 0 ? withoutEmbeddings : 0
    };
  } catch (error) {
    console.error('Error checking line item embeddings:', error);
    return { exists: false, count: 0, total: 0, withEmbeddings: 0, withoutEmbeddings: 0 };
  }
}

/**
 * Generate line item embeddings for multiple line items
 */
export async function generateLineItemEmbeddings(limit: number = 50): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    // Get the status of line item embeddings
    const status = await checkLineItemEmbeddings();
    
    if (status.withoutEmbeddings === 0) {
      return {
        success: true,
        processed: 0,
        total: status.total,
        withEmbeddings: status.withEmbeddings,
        withoutEmbeddings: 0
      };
    }
    
    // Get receipts that need line item embeddings
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id')
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    console.log(`Found ${receipts?.length || 0} receipts to process for line item embeddings`);
    
    if (!receipts || receipts.length === 0) {
      return {
        success: true,
        processed: 0,
        total: status.total,
        withEmbeddings: status.withEmbeddings,
        withoutEmbeddings: status.withoutEmbeddings
      };
    }
    
    let processedCount = 0;
    
    // Process line items for each receipt
    for (const receipt of receipts) {
      try {
        // Call the edge function to generate line item embeddings
        const response = await callEdgeFunction('generate-embeddings', 'POST', {
          receiptId: receipt.id,
          processLineItems: true // Process line items
        });
        
        if (response && response.success) {
          processedCount += response.count || 0;
        }
      } catch (err) {
        console.error(`Error generating line item embeddings for receipt ${receipt.id}:`, err);
      }
    }
    
    // Get updated status after processing
    const newStatus = await checkLineItemEmbeddings();
    
    return {
      success: true,
      processed: processedCount,
      total: newStatus.total,
      withEmbeddings: newStatus.withEmbeddings,
      withoutEmbeddings: newStatus.withoutEmbeddings
    };
  } catch (error) {
    console.error('Error generating line item embeddings:', error);
    return {
      success: false,
      processed: 0,
      total: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0
    };
  }
}

/**
 * Generate all embeddings (receipts and line items)
 */
export async function generateAllTypeEmbeddings(limit: number = 10): Promise<{
  success: boolean;
  message: string;
  receiptResults: {
    processed: number;
    successful: number;
  };
  lineItemResults: {
    processed: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  };
}> {
  try {
    // Generate receipt embeddings
    const receiptResults = await generateAllEmbeddings(limit);
    
    // Generate line item embeddings
    const lineItemResults = await generateLineItemEmbeddings(limit);
    
    return {
      success: receiptResults.success && lineItemResults.success,
      message: `Generated embeddings for ${receiptResults.successful} receipts and ${lineItemResults.processed} line items`,
      receiptResults: {
        processed: receiptResults.processed,
        successful: receiptResults.successful
      },
      lineItemResults: {
        processed: lineItemResults.processed,
        withEmbeddings: lineItemResults.withEmbeddings,
        withoutEmbeddings: lineItemResults.withoutEmbeddings
      }
    };
  } catch (error) {
    console.error('Error generating all types of embeddings:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      receiptResults: {
        processed: 0,
        successful: 0
      },
      lineItemResults: {
        processed: 0,
        withEmbeddings: 0,
        withoutEmbeddings: 0
      }
    };
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
