/**
 * Perform semantic search on line items using vector embeddings
 */
export async function performLineItemSearch(client: any, queryEmbedding: number[], params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    similarityThreshold = 0.3, // Lower threshold to catch more matches
    useHybridSearch = false,
    query: searchQuery
  } = params;

  console.log('Line item search parameters:', {
    limit, offset, startDate, endDate, minAmount, maxAmount,
    useHybridSearch, queryEmbeddingLength: queryEmbedding.length,
    similarityThreshold, // Log the threshold being used
    query: searchQuery // Log the actual search query
  });

  // Use the unified search functions for line item embeddings
  const searchFunction = useHybridSearch ? 'hybrid_search_embeddings' : 'search_embeddings';
  console.log(`Using unified search function: ${searchFunction} for line items`);

  // Prepare parameters for the database function
  const functionParams = {
    query_embedding: queryEmbedding,
    search_type: 'line_item', // Specify we're searching only line item embeddings
    content_type: 'line_item', // Content type for line items
    similarity_threshold: similarityThreshold,
    match_count: limit + offset,
  };

  // Add hybrid search parameters if needed
  if (useHybridSearch) {
    Object.assign(functionParams, {
      search_text: searchQuery,
      min_amount: minAmount,
      max_amount: maxAmount,
      start_date: startDate,
      end_date: endDate
    });
  }

  console.log(`Query Embedding (first 5 elements): [${queryEmbedding.slice(0,5).join(', ')}, ...] (length: ${queryEmbedding.length})`);
  
  // Create a separate object for logging to avoid type issues
  const loggableParams = {
    ...functionParams,
    query_embedding: `[Vector of length ${queryEmbedding.length}] (first 5: ${queryEmbedding.slice(0,5).join(', ')})`
  };
  
  console.log(`Detailed functionParams for ${searchFunction}:`, JSON.stringify(loggableParams, null, 2));

  // Call the database function for unified vector search
  const { data: searchResults, error } = await client.rpc(
    searchFunction,
    functionParams
  );

  if (error) {
    console.error('Error in line item semantic search:', error);
    throw new Error(`Error in line item semantic search: ${error.message}`);
  }

  if (!searchResults || searchResults.length === 0) {
    console.log('No line item matches found for query');
    
    // Try a fallback direct query approach
    try {
      console.log('Attempting fallback direct query approach...');
      const { data: fallbackResults, error: fallbackError } = await client
        .from('line_items')
        .select(`
          id as line_item_id,
          receipt_id,
          description as line_item_description,
          amount as line_item_amount,
          receipts(merchant as parent_receipt_merchant, date as parent_receipt_date)
        `)
        .ilike('description', `%${searchQuery.toLowerCase()}%`)
        .limit(limit);
        
      if (fallbackError) {
        console.error('Fallback query error:', fallbackError);
      } else if (fallbackResults && fallbackResults.length > 0) {
        console.log(`Fallback found ${fallbackResults.length} results`);
        
        // Format the fallback results to match expected structure
        const formattedFallback = fallbackResults.map(item => ({
          line_item_id: item.line_item_id,
          receipt_id: item.receipt_id,
          line_item_description: item.line_item_description,
          line_item_price: item.line_item_amount,
          line_item_quantity: 1,
          parent_receipt_merchant: item.receipts?.parent_receipt_merchant,
          parent_receipt_date: item.receipts?.parent_receipt_date,
          similarity: 0.5 // Default similarity for fallback results
        }));
        
        return {
          lineItems: formattedFallback,
          count: formattedFallback.length,
          total: formattedFallback.length,
          fallback: true
        };
      }
    } catch (fallbackEx) {
      console.error('Exception in fallback query:', fallbackEx);
    }
    
    return { lineItems: [], count: 0, total: 0 };
  }

  console.log(`Retrieved ${searchResults.length} search results before pagination`);
  
  // Apply offset and limit for pagination
  const paginatedResults = searchResults.slice(offset, offset + limit);
  
  // Extract line item IDs from the search results
  const lineItemIds = paginatedResults.map(r => r.source_id);
  
  // Create a map of similarity scores
  const similarityScores = paginatedResults.reduce((acc: Record<string, number>, r: any) => {
    acc[r.source_id] = r.similarity || r.score || 0;
    return acc;
  }, {});
  
  // Fetch the actual line item data
  const { data: lineItems, error: lineItemsError } = await client
    .from('line_items')
    .select(`
      id,
      receipt_id,
      description,
      amount,
      quantity,
      receipts(merchant, date)
    `)
    .in('id', lineItemIds);
  
  if (lineItemsError) {
    console.error('Error fetching line item details:', lineItemsError);
    throw new Error(`Error fetching line item details: ${lineItemsError.message}`);
  }
  
  // Format the line items with the structure expected by the frontend
  const formattedLineItems = lineItems.map(item => ({
    line_item_id: item.id,
    receipt_id: item.receipt_id,
    line_item_description: item.description,
    line_item_price: item.amount,
    line_item_quantity: item.quantity || 1,
    parent_receipt_merchant: item.receipts?.merchant,
    parent_receipt_date: item.receipts?.date,
    similarity: similarityScores[item.id] || 0
  }));
  
  // Sort by similarity score (highest first)
  formattedLineItems.sort((a: any, b: any) => b.similarity - a.similarity);
  
  return {
    lineItems: formattedLineItems,
    count: formattedLineItems.length,
    total: searchResults.length // Total potential matches before pagination
  };
}
