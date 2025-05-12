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
  searchTarget?: 'receipts' | 'line_items' | 'all'; // Target for search (receipts, line_items, or all)
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
  receipts?: ReceiptWithSimilarity[]; // Optional: results for receipts (legacy support)
  lineItems?: LineItemSearchResult[]; // Optional: results for line items (legacy support)
  results?: (ReceiptWithSimilarity | LineItemSearchResult)[]; // Combined results for unified search
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
        results: [],
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
        results: [],
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
        results: [],
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

      // Populate the unified results array for all search types
      if (searchTarget === 'all') {
        // Combine receipts and line items into a single array
        results.results = [
          ...(results.receipts || []),
          ...(results.lineItems || [])
        ];

        // Sort by similarity score (highest first)
        results.results.sort((a, b) => {
          const scoreA = 'similarity_score' in a ? a.similarity_score : ('similarity' in a ? a.similarity : 0);
          const scoreB = 'similarity_score' in b ? b.similarity_score : ('similarity' in b ? b.similarity : 0);
          return scoreB - scoreA;
        });
      } else if (searchTarget === 'receipts') {
        // For backward compatibility, populate results with receipts
        results.results = [...(results.receipts || [])];
      } else if (searchTarget === 'line_items') {
        // For backward compatibility, populate results with line items
        results.results = [...(results.lineItems || [])];
      }

      console.log('Processed results:', {
        type: searchTarget,
        lineItemsCount: results.lineItems?.length || 0,
        receiptsCount: results.receipts?.length || 0,
        unifiedResultsCount: results.results?.length || 0,
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
        if (params.searchTarget === 'all') {
          // For 'all' search, check if both receipts and line items are empty
          if ((!results.receipts || results.receipts.length === 0) &&
              (!results.lineItems || results.lineItems.length === 0)) {
            console.log('No results from unified search, trying fallback search');
            return await fallbackBasicSearch(params);
          }
        } else if ((params.searchTarget !== 'line_items' && (!results.receipts || results.receipts.length === 0)) ||
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
      results: [],
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
      results: [],
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
            results: receiptsWithScores, // Add to unified results array
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
      results: receiptsWithScores, // Add to unified results array
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
      results: [],
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
export async function generateEmbeddings(receiptId: string, model: string = 'gemini-1.5-flash-latest'): Promise<boolean> {
  try {
    console.log(`Generating embeddings for receipt ${receiptId} using model ${model}`);
    const response = await callEdgeFunction('generate-embeddings', 'POST', {
      receiptId,
      model,
      contentTypes: ['full_text', 'merchant', 'notes', 'raw_text'],
    });
    
    return response && response.success;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return false;
  }
}

/**
 * Generate embeddings for multiple receipts
 */
export async function generateAllEmbeddings(model: string = 'gemini-1.5-flash-latest', forceRegenerate: boolean = false): Promise<{
  success: boolean;
  count: number;
  total: number;
  processed: number;
  message: string;
}> {
  try {
    console.log(`Starting generateAllEmbeddings with model: ${model}, forceRegenerate: ${forceRegenerate}`);
    
    // First get all receipts
    const { data: allReceipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id');

    if (receiptError) {
      console.error('Error fetching all receipts:', receiptError);
      throw receiptError;
    }

    if (!allReceipts || allReceipts.length === 0) {
      console.log('No receipts found in the database');
      return { success: true, count: 0, total: 0, processed: 0, message: 'No receipts found' };
    }

    console.log(`Found ${allReceipts.length} total receipts in database`);

    // If we're not forcing regeneration, identify receipts that already have embeddings
    let receiptsToProcess = [...allReceipts]; // Create a copy to avoid mutation issues
    
    if (!forceRegenerate) {
      console.log('Not forcing regeneration, identifying receipts without embeddings');
      
      // Query for existing embeddings in receipt_embeddings table
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id')
        .not('receipt_id', 'is', null);
      
      if (embeddingsError) {
        console.error('Error checking for existing embeddings:', embeddingsError);
        throw embeddingsError;
      }
      
      if (existingEmbeddings && existingEmbeddings.length > 0) {
        // Create a set of receipt IDs that already have embeddings
        const existingIds = new Set(existingEmbeddings.map(e => e.receipt_id));
        console.log(`Found ${existingIds.size} receipts with existing embeddings`);
        
        // Filter to only process receipts without embeddings
        receiptsToProcess = allReceipts.filter(r => !existingIds.has(r.id));
        console.log(`Will process ${receiptsToProcess.length} receipts without embeddings`);
      } else {
        console.log('No existing embeddings found, will process all receipts');
      }
    } else {
      console.log(`Forcing regeneration of all ${allReceipts.length} receipts`);
    }

    if (receiptsToProcess.length === 0) {
      return { 
        success: true, 
        count: 0, 
        total: allReceipts.length,
        processed: 0,
        message: 'All receipts already have embeddings' 
      };
    }

    // Process each receipt
    console.log(`Starting batch processing of ${receiptsToProcess.length} receipts`);
    const results = await Promise.all(
      receiptsToProcess.map(receipt => 
        generateEmbeddings(receipt.id, model)
      )
    );

    const successCount = results.filter(r => r === true).length;
    const failedCount = results.filter(r => r === false).length;
    
    console.log(`Embedding generation complete: ${successCount} successful, ${failedCount} failed`);

    return { 
      success: true, 
      count: successCount,
      total: allReceipts.length,
      processed: receiptsToProcess.length,
      message: `Generated embeddings for ${successCount} receipts out of ${receiptsToProcess.length} attempted.` 
    };
  } catch (error) {
    console.error('Error generating all embeddings:', error);
    return {
      success: false,
      count: 0,
      total: 0,
      processed: 0,
      message: `Error generating embeddings: ${error.message || 'Unknown error'}`
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
    // First check if embeddings column exists by getting total count
    const { count: totalLineItems, error: countError } = await supabase
      .from('line_items')
      .select('id', { count: 'exact' });

    if (countError) throw countError;

    // For migration compatibility - check both old and new schemas
    let embeddingsCount = 0;
    
    try {
      // Try to count direct embeddings in line_items first (old schema)
      const { data, error } = await supabase
        .from('line_items')
        .select('id')
        .not('embedding', 'is', null)
        .limit(1);
        
      if (!error) {
        // If this succeeds, the embedding column exists in line_items
        const { count, error: embedError } = await supabase
          .from('line_items')
          .select('id', { count: 'exact' })
          .not('embedding', 'is', null);
          
        if (!embedError) {
          embeddingsCount = count || 0;
        }
      }
    } catch (e) {
      console.log('Old schema check failed, trying new schema...');
      // Try the new unified schema if the old one fails
      try {
        const { count, error } = await supabase
          .from('receipt_embeddings')
          .select('id', { count: 'exact' })
          .eq('source_type', 'line_item');
          
        if (!error) {
          embeddingsCount = count || 0;
        }
      } catch (unifiedError) {
        console.log('Both schema checks failed:', unifiedError);
      }
    }
    
    // Calculate those without embeddings
    const withoutEmbeddings = (totalLineItems || 0) - embeddingsCount;

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
 * Generate line item embeddings for multiple line items.
 * 
 * @param limit The maximum number of line items to process.
 * @param forceRegenerate Whether to regenerate embeddings even if they already exist.
 * 
 * @returns A promise that resolves with an object containing the results of the operation.
 */
export async function generateLineItemEmbeddings(limit: number = 50, forceRegenerate: boolean = false): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    // Get the status of line item embeddings
    const status = await checkLineItemEmbeddings();

    if (!forceRegenerate && status.withoutEmbeddings === 0) {
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
          processLineItems: true,
          forceRegenerate: forceRegenerate // Pass along the regenerate flag
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
export async function generateAllTypeEmbeddings(limit: number = 10, model: string = 'gemini-1.5-flash-latest', forceRegenerate: boolean = false): Promise<{
  success: boolean;
  message: string;
  receiptResults: {
    processed: number;
    count: number;
    total: number;
  };
  lineItemResults: {
    processed: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  };
}> {
  try {
    console.log(`Generating all embeddings for receipts and line items with model: ${model}, forceRegenerate: ${forceRegenerate}`);
    
    // First generate receipts
    const receiptResults = await generateAllEmbeddings(model, forceRegenerate);
    
    // Then generate line items
    const lineItemResults = await generateLineItemEmbeddings(limit, forceRegenerate);
    
    return {
      success: true,
      message: `Generated embeddings for ${receiptResults.count} receipts and ${lineItemResults.withEmbeddings} line items`,
      receiptResults: {
        processed: receiptResults.processed,
        count: receiptResults.count,
        total: receiptResults.total
      },
      lineItemResults: {
        processed: lineItemResults.processed,
        withEmbeddings: lineItemResults.withEmbeddings,
        withoutEmbeddings: lineItemResults.withoutEmbeddings
      }
    };
  } catch (error) {
    console.error('Error generating all type embeddings:', error);
    return {
      success: false,
      message: 'Error generating all type embeddings',
      receiptResults: {
        processed: 0,
        count: 0,
        total: 0
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

/**
 * Check if a database table/schema exists
 */
async function checkDbSchema(tableName: 'receipts' | 'receipt_embeddings' | 'line_items'): Promise<{ exists: boolean }> {
  try {
    // Try to query the table structure
    const { error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
      
    // If no error, the table exists
    return { exists: !error };
  } catch (e) {
    console.error(`Error checking if schema ${tableName} exists:`, e);
    return { exists: false };
  }
}

/**
 * Check if receipt embeddings exist in the database
 */
export async function checkReceiptEmbeddings(): Promise<{
  exists: boolean,
  count: number,
  total: number,
  withEmbeddings: number,
  withoutEmbeddings: number
}> {
  try {
    // Get total receipt count
    const { count: totalReceipts, error: countError } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error("Error fetching total receipts count:", countError);
      throw countError;
    }

    // Count distinct receipts that have embeddings
    let distinctReceiptsWithEmbeddings = 0;
    try {
      // Get count of distinct receipt_ids in receipt_embeddings table
      const { data, error: distinctError } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id')
        .not('receipt_id', 'is', null);
      
      if (distinctError) {
        console.error('Error getting distinct receipt_ids:', distinctError);
      } else if (data) {
        // Count distinct receipt_ids from the returned data
        const uniqueReceiptIds = new Set(data.map(item => item.receipt_id));
        distinctReceiptsWithEmbeddings = uniqueReceiptIds.size;
        console.log('Distinct receipts with embeddings count:', distinctReceiptsWithEmbeddings);
      }
    } catch (e) {
      console.error('Exception checking distinct receipt embeddings:', e);
      // Default to 0 for calculation
    }

    const withEmbeddings = distinctReceiptsWithEmbeddings;
    // Ensure withoutEmbeddings is not negative
    const withoutEmbeddings = Math.max(0, (totalReceipts || 0) - withEmbeddings);

    console.log('Calculated Receipt Stats:', { total: totalReceipts, withEmbeddings, withoutEmbeddings });

    return {
      exists: withEmbeddings > 0,
      count: withEmbeddings, // Report the count of distinct receipts with embeddings
      total: totalReceipts || 0,
      withEmbeddings: withEmbeddings,
      withoutEmbeddings: withoutEmbeddings
    };
  } catch (error) {
    console.error('Error in checkReceiptEmbeddings:', error);
    return { exists: false, count: 0, total: 0, withEmbeddings: 0, withoutEmbeddings: 0 };
  }
}



/**
 * Generate receipt embeddings - can regenerate all if forceRegenerate is true
 */
export async function generateReceiptEmbeddings(limit: number = 50, model: string = 'gemini-1.5-flash-latest', forceRegenerate: boolean = false): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    console.log(`Starting generateReceiptEmbeddings with limit: ${limit}, model: ${model}, forceRegenerate: ${forceRegenerate}`);
    
    // Get the status of receipt embeddings
    const status = await checkReceiptEmbeddings();
    console.log('Current embedding status:', status);

    if (!forceRegenerate && status.withoutEmbeddings === 0) {
      console.log('All receipts already have embeddings, skipping generation');
      return {
        success: true,
        processed: 0,
        total: status.total,
        withEmbeddings: status.withEmbeddings,
        withoutEmbeddings: 0
      };
    }

    // Use the generateAllEmbeddings function
    console.log(`Generating embeddings for up to ${limit} receipts`);
    const result = await generateAllEmbeddings(model, forceRegenerate);
    console.log('Generation result:', result);
    
    // Get updated status after processing
    const newStatus = await checkReceiptEmbeddings();
    console.log('Updated embedding status after processing:', newStatus);

    return {
      success: result.success,
      processed: result.processed,
      total: newStatus.total,
      withEmbeddings: newStatus.withEmbeddings,
      withoutEmbeddings: newStatus.withoutEmbeddings
    };
  } catch (error) {
    console.error('Error generating receipt embeddings:', error);
    return {
      success: false,
      processed: 0,
      total: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0
    };
  }
}
