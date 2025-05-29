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
    // Get all line items with their details first
    // Use separate queries to avoid relationship conflicts
    const { data: lineItems, error: lineItemsError } = await client
      .from('line_items')
      .select('id, receipt_id, description, amount')
      .order('id', { ascending: false })
      .limit(100); // Limit to a reasonable number to avoid processing too many

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      throw new Error(`Error fetching line items: ${lineItemsError.message}`);
    }

    if (!lineItems || lineItems.length === 0) {
      console.log('No line items found');
      return { lineItems: [], count: 0, total: 0 };
    }

    console.log(`Found ${lineItems.length} line items to process`);

    // Get receipt IDs from line items
    const receiptIds = [...new Set(lineItems.map(item => item.receipt_id))];

    // Fetch receipt data separately to avoid relationship conflicts
    const { data: receipts, error: receiptsError } = await client
      .from('receipts')
      .select('id, merchant, date')
      .in('id', receiptIds);

    if (receiptsError) {
      console.error('Error fetching receipts:', receiptsError);
      // Continue without receipt data rather than failing completely
    }

    // Create a lookup map for receipts
    const receiptLookup = {};
    if (receipts) {
      receipts.forEach(receipt => {
        receiptLookup[receipt.id] = receipt;
      });
    }

    // Get embeddings for those receipts, focusing on line item content type
    // Use the unified embedding model where all embeddings are in receipt_embeddings
    const { data: embeddings, error: embeddingsError } = await client
      .from('receipt_embeddings')
      .select(`
        id,
        receipt_id,
        content_type,
        embedding,
        metadata
      `)
      .in('receipt_id', receiptIds)
      .eq('content_type', 'line_item'); // Look for embeddings that are specifically for line items

    if (embeddingsError) {
      console.error('Error fetching embeddings:', embeddingsError);
      throw new Error(`Error fetching embeddings: ${embeddingsError.message}`);
    }

    if (!embeddings || embeddings.length === 0) {
      console.log('No embeddings found for line items');
      return { lineItems: [], count: 0, total: 0 };
    }

    console.log(`Found ${embeddings.length} embeddings for line items`);

    // Calculate similarity for each embedding
    const scoredEmbeddings = embeddings.map(embeddingRecord => {
      // Vector embedding is stored as string in some cases, handle both
      let embedding;
      try {
        embedding = typeof embeddingRecord.embedding === 'string'
          ? JSON.parse(embeddingRecord.embedding)
          : embeddingRecord.embedding;
      } catch (error) {
        console.error('Error parsing embedding:', error);
        // Return a default similarity of 0 if we can't parse the embedding
        return {
          ...embeddingRecord,
          similarity: 0,
          lineItemId: embeddingRecord.metadata?.line_item_id || null
        };
      }

      // Check if embedding is null or undefined
      if (!embedding || !Array.isArray(embedding)) {
        console.warn('Invalid embedding found:', embedding);
        // Return a default similarity of 0 if the embedding is invalid
        return {
          ...embeddingRecord,
          similarity: 0,
          lineItemId: embeddingRecord.metadata?.line_item_id || null
        };
      }

      // Calculate cosine similarity
      let dotProduct = 0;
      let embedMagnitude = 0;
      let queryMagnitude = 0;

      // We might have different vector dimensions, use the minimum
      const minDimension = Math.min(embedding.length, queryEmbedding.length);

      for (let i = 0; i < minDimension; i++) {
        dotProduct += embedding[i] * queryEmbedding[i];
        embedMagnitude += embedding[i] * embedding[i];
        queryMagnitude += queryEmbedding[i] * queryEmbedding[i];
      }

      embedMagnitude = Math.sqrt(embedMagnitude);
      queryMagnitude = Math.sqrt(queryMagnitude);

      // Calculate cosine similarity (1 = exactly the same, 0 = completely different)
      let similarity = 0;
      if (embedMagnitude > 0 && queryMagnitude > 0) {
        similarity = dotProduct / (embedMagnitude * queryMagnitude);
      } else {
        console.warn('Zero magnitude detected in similarity calculation');
      }

      // Ensure similarity is a valid number between 0 and 1
      if (isNaN(similarity) || similarity < 0) {
        similarity = 0;
      } else if (similarity > 1) {
        similarity = 1;
      }

      // Extract the line item ID from metadata
      let lineItemId = null;

      // Get line item ID from metadata
      if (embeddingRecord.metadata) {
        const metadata = typeof embeddingRecord.metadata === 'string'
          ? JSON.parse(embeddingRecord.metadata)
          : embeddingRecord.metadata;

        lineItemId = metadata.line_item_id;
      }

      return {
        ...embeddingRecord,
        similarity,
        lineItemId
      };
    });

    // Filter by similarity threshold
    const filteredEmbeddings = scoredEmbeddings
      .filter(record => record.similarity > similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity);

    if (filteredEmbeddings.length === 0) {
      console.log('No embeddings found above threshold');
      return { lineItems: [], count: 0, total: 0 };
    }

    // Match embeddings to line items
    // We need to be careful as each receipt can have multiple line items
    // and the embedding metadata should contain the specific line item ID
    const lineItemsWithSimilarity = [];

    for (const embedding of filteredEmbeddings) {
      // If we have the line item ID in metadata, use it
      if (embedding.lineItemId) {
        const matchingLineItem = lineItems.find(item => item.id === embedding.lineItemId);
        if (matchingLineItem) {
          lineItemsWithSimilarity.push({
            ...matchingLineItem,
            similarity: embedding.similarity
          });
        }
      } else {
        // If no specific line item ID in metadata, match by receipt ID and add all line items
        // This is a fallback approach
        const matchingLineItems = lineItems.filter(item => item.receipt_id === embedding.receipt_id);
        for (const lineItem of matchingLineItems) {
          lineItemsWithSimilarity.push({
            ...lineItem,
            similarity: embedding.similarity
          });
        }
      }
    }

    // Remove duplicates in case a line item appears multiple times
    const uniqueLineItems = [];
    const seenIds = new Set();
    for (const item of lineItemsWithSimilarity) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueLineItems.push(item);
      }
    }

    // Sort by similarity and apply pagination
    uniqueLineItems.sort((a, b) => b.similarity - a.similarity);
    const paginatedItems = uniqueLineItems.slice(offset, offset + limit);

    // Format the results for the frontend
    const formattedLineItems = paginatedItems.map(item => {
      const receipt = receiptLookup[item.receipt_id] || {};
      return {
        line_item_id: item.id,
        receipt_id: item.receipt_id,
        line_item_description: item.description,
        line_item_price: item.amount,
        line_item_quantity: 1, // Default quantity since column doesn't exist
        parent_receipt_merchant: receipt.merchant || 'Unknown merchant',
        parent_receipt_date: receipt.date || '',
        parent_receipt_id: item.receipt_id, // Explicitly add parent_receipt_id field
        similarity: item.similarity || 0
      };
    });

    return {
      lineItems: formattedLineItems,
      count: formattedLineItems.length,
      total: uniqueLineItems.length
    };
  } catch (error) {
    console.error('Error performing line item search:', error);
    throw error;
  }
}
