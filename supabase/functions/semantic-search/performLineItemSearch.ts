/**
 * Perform semantic search on line items using unified_search function
 */
export async function performLineItemSearch(client: any, queryEmbedding: number[], params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    similarityThreshold = 0.15, // Lowered from 0.3 for better recall
    useHybridSearch = false,
    query: searchQuery
  } = params;

  // Validate queryEmbedding
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('Invalid queryEmbedding:', queryEmbedding);
    throw new Error('Invalid query embedding provided');
  }

  console.log('Line item search parameters:', {
    limit, offset, startDate, endDate, minAmount, maxAmount,
    useHybridSearch, queryEmbeddingLength: queryEmbedding.length,
    similarityThreshold, // Log the threshold being used
    query: searchQuery // Log the actual search query
  });

  console.log(`Query Embedding (first 5 elements): [${queryEmbedding.slice(0,5).join(', ')}, ...] (length: ${queryEmbedding.length})`);

  try {
    // Use unified_search function for line items
    console.log('Calling unified_search for line items...');
    const { data: searchResults, error: searchError } = await client.rpc(
      'unified_search',
      {
        query_embedding: queryEmbedding,
        source_types: ['line_item'],
        content_types: null,
        similarity_threshold: similarityThreshold,
        match_count: limit + offset,
        user_filter: null, // Will be set by RLS policies
        team_filter: null,
        language_filter: null
      }
    );

    if (searchError) {
      console.error('Error in unified_search for line items:', searchError);
      throw new Error(`Error in line item search: ${searchError.message}`);
    }

    if (!searchResults || searchResults.length === 0) {
      console.log('No line item search results found');
      return { lineItems: [], count: 0, total: 0 };
    }

    console.log(`Found ${searchResults.length} line item search results`);

    // Apply offset and limit for pagination
    const paginatedResults = searchResults.slice(offset, offset + limit);

    // Extract line item IDs from the search results
    const lineItemIds = paginatedResults.map(r => r.source_id).filter(id => id !== null);

    if (lineItemIds.length === 0) {
      console.log('No valid line item IDs found in search results');
      return { lineItems: [], count: 0, total: 0 };
    }

    // Create a map of similarity scores
    const similarityScores = paginatedResults.reduce((acc: Record<string, number>, r: any) => {
      if (r.source_id) {
        acc[r.source_id] = r.similarity || r.score || 0;
      }
      return acc;
    }, {});

    // Fetch the actual line item data
    const { data: lineItems, error: lineItemsError } = await client
      .from('line_items')
      .select('id, receipt_id, description, amount')
      .in('id', lineItemIds);

    if (lineItemsError) {
      console.error('Error fetching line item details:', lineItemsError);
      throw new Error(`Error fetching line item details: ${lineItemsError.message}`);
    }

    if (!lineItems || lineItems.length === 0) {
      console.log('No line items found for the given IDs');
      return { lineItems: [], count: 0, total: 0 };
    }

    // Fetch receipt data separately to avoid relationship conflicts
    const receiptIds = [...new Set(lineItems.map(item => item.receipt_id))];
    const { data: receipts, error: receiptError } = await client
      .from('receipts')
      .select('id, merchant, date')
      .in('id', receiptIds);

    let receiptData = {};
    if (receiptError) {
      console.error('Error fetching receipt details:', receiptError);
      // Continue without receipt data rather than failing completely
    } else if (receipts) {
      receiptData = receipts.reduce((acc, receipt) => {
        acc[receipt.id] = receipt;
        return acc;
      }, {});
    }
    // Format the line items with the structure expected by the frontend
    const formattedLineItems = lineItems.map(item => {
      const receipt = receiptData[item.receipt_id] || {};
      return {
        line_item_id: item.id,
        receipt_id: item.receipt_id,
        line_item_description: item.description,
        line_item_price: item.amount,
        line_item_quantity: 1, // Default quantity since column doesn't exist
        parent_receipt_merchant: receipt.merchant || 'Unknown merchant',
        parent_receipt_date: receipt.date || '',
        parent_receipt_id: item.receipt_id,
        similarity: similarityScores[item.id] || 0
      };
    });

    // Sort by similarity score (highest first)
    formattedLineItems.sort((a: any, b: any) => b.similarity - a.similarity);

    console.log(`Returning ${formattedLineItems.length} formatted line items`);

    return {
      lineItems: formattedLineItems,
      count: formattedLineItems.length,
      total: searchResults.length
    };
  } catch (error) {
    console.error('Error performing line item search:', error);
    throw error;
  }
}
