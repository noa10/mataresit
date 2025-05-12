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

  // First verify if line_items table has the expected structure
  try {
    const { data: columnCheck, error: columnError } = await client
      .from('line_items')
      .select('embedding, description, amount')
      .limit(1);
    
    if (columnError) {
      console.error('Error checking line_items structure:', columnError);
      if (columnError.message && columnError.message.includes('does not exist')) {
        throw new Error('Line items embedding column not found - please ensure embeddings are generated');
      }
    }
    
    console.log('Line items table check result:', columnCheck);
    
    // Check if there are any items with the search term in description
    const searchTerm = searchQuery.toLowerCase();
    const { data: matchingItems, error: matchingError } = await client
      .from('line_items')
      .select('id, description, amount')
      .ilike('description', `%${searchTerm}%`)
      .limit(5);
      
    if (matchingError) {
      console.error('Error checking for matching items:', matchingError);
    } else {
      console.log(`Found ${matchingItems?.length || 0} items with "${searchTerm}" in description:`, 
        matchingItems?.map(i => `"${i.description}" (${i.amount})`) || 'none');
    }
    
    // Verify there are items with embeddings
    const { data: embeddingStats, error: statsError } = await client
      .from('line_items')
      .select('id')
      .not('embedding', 'is', null)
      .limit(5);
      
    if (statsError) {
      console.error('Error checking embeddings:', statsError);
    } else {
      console.log(`Found ${embeddingStats?.length || 0} items with embeddings`);
    }
  } catch (checkError) {
    console.error('Exception checking line items structure:', checkError);
  }

  // Determine which search function to use
  const searchFunction = useHybridSearch ? 'hybrid_search_line_items' : 'search_line_items';
  console.log(`Using database function: ${searchFunction}`);

  // Prepare parameters for the database function
  const functionParams = {
    query_embedding: queryEmbedding,
    similarity_threshold: similarityThreshold,
    match_count: limit + offset,
  };

  // Add hybrid search parameters if needed
  if (useHybridSearch) {
    Object.assign(functionParams, {
      query_text: searchQuery,
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

  // Call the database function for line item vector search
  const { data: lineItemsData, error } = await client.rpc(
    searchFunction,
    functionParams
  );

  if (error) {
    console.error('Error in line item semantic search:', error);
    throw new Error(`Error in line item semantic search: ${error.message}`);
  }

  if (!lineItemsData || lineItemsData.length === 0) {
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

  console.log(`Retrieved ${lineItemsData.length} line items before pagination`);
  
  // Log a sample of the actual data returned for debugging
  if (lineItemsData.length > 0) {
    console.log('Sample of line item results:', JSON.stringify(lineItemsData[0], null, 2));
  }
  
  // Apply offset and limit for pagination
  const paginatedLineItems = lineItemsData.slice(offset, offset + limit);
  
  // Map the DB field names to the expected frontend property names
  const formattedLineItems = paginatedLineItems.map(item => ({
    line_item_id: item.line_item_id || item.id,
    receipt_id: item.receipt_id,
    line_item_description: item.line_item_description || item.description,
    line_item_price: item.line_item_amount || item.amount, // Map amount to price for frontend compatibility
    line_item_quantity: 1, // Default quantity to 1 since we don't have that field
    parent_receipt_merchant: item.parent_receipt_merchant,
    parent_receipt_date: item.parent_receipt_date,
    similarity: item.similarity || item.score || 0
  }));
  
  // Log the structure of line item results for debugging
  console.log('Line item search results structure:', {
    sample: formattedLineItems.length > 0 ? formattedLineItems[0] : null,
    count: formattedLineItems.length,
    total: lineItemsData.length
  });

  return {
    lineItems: formattedLineItems,
    count: formattedLineItems.length,
    total: lineItemsData.length // Total potential matches before pagination
  };
}
