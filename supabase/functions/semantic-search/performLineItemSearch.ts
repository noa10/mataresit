/**
 * Enhanced line item search with hybrid matching and adaptive thresholds
 */

import { VectorProcessingContext, EMBEDDING_DIMENSIONS } from '../_shared/vector-validation.ts';

/**
 * Determine optimal similarity threshold based on query characteristics
 */
function getAdaptiveLineItemThreshold(query: string): number {
  const trimmedQuery = query.trim().toLowerCase();

  // 🔧 FIX: Reduce threshold for exact food item patterns to improve recall
  // Brand names and product names should have moderate threshold, not extremely high
  if (/^[a-zA-Z\s]{2,20}$/.test(trimmedQuery) && trimmedQuery.length <= 20) {
    console.log('🎯 Using moderate precision threshold for exact food item:', trimmedQuery);
    return 0.45; // 🔧 FIXED: Reduced from 0.85 to 0.45 for better recall on brand names like "powercat"
  }

  // Cross-language or mixed queries
  if (containsMixedLanguage(trimmedQuery)) {
    console.log('🌐 Using cross-language threshold for mixed query:', trimmedQuery);
    return 0.25; // Lower for multilingual support
  }

  // General semantic queries (longer, descriptive)
  console.log('🔍 Using balanced threshold for general query:', trimmedQuery);
  return 0.35; // Balanced default
}

/**
 * Check if query contains mixed language content
 */
function containsMixedLanguage(query: string): boolean {
  // Simple heuristic: contains both Latin and non-Latin characters
  const hasLatin = /[a-zA-Z]/.test(query);
  const hasNonLatin = /[^\x00-\x7F]/.test(query);
  return hasLatin && hasNonLatin;
}

/**
 * Enhanced line item search using receipt_embeddings with hybrid matching
 */
export async function performLineItemSearch(client: any, queryEmbedding: number[], params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    similarityThreshold, // Will be overridden by adaptive threshold
    useHybridSearch = true, // Enable hybrid search by default
    query: searchQuery
  } = params;

  // Validate inputs
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('Invalid queryEmbedding:', queryEmbedding);
    throw new Error('Invalid query embedding provided');
  }

  if (!searchQuery || typeof searchQuery !== 'string') {
    console.error('Invalid search query:', searchQuery);
    throw new Error('Search query is required for line item search');
  }

  // Use adaptive threshold based on query characteristics
  const adaptiveThreshold = similarityThreshold || getAdaptiveLineItemThreshold(searchQuery);

  console.log('🔍 Enhanced line item search parameters:', {
    limit, offset, startDate, endDate, minAmount, maxAmount,
    useHybridSearch, queryEmbeddingLength: queryEmbedding.length,
    originalThreshold: similarityThreshold,
    adaptiveThreshold,
    query: searchQuery,
    thresholdSource: similarityThreshold ? 'provided' : 'adaptive'
  });

  // 🔧 DEBUG: Log threshold decision for debugging
  console.log('🎯 Threshold decision for query "' + searchQuery + '":', {
    adaptiveThreshold,
    isExactFoodItem: /^[a-zA-Z\s]{2,20}$/.test(searchQuery.trim().toLowerCase()) && searchQuery.length <= 20,
    queryLength: searchQuery.length,
    queryPattern: searchQuery.trim().toLowerCase()
  });

  try {
    // UPDATED: Search unified_embeddings table for better data quality
    console.log('🔧 Calling enhanced line item search on unified_embeddings...');

    if (useHybridSearch) {
      return await performHybridLineItemSearch(client, queryEmbedding, searchQuery, {
        ...params,
        similarityThreshold: adaptiveThreshold
      });
    } else {
      return await performSemanticLineItemSearch(client, queryEmbedding, {
        ...params,
        similarityThreshold: adaptiveThreshold
      });
    }
  } catch (error) {
    console.error('Enhanced line item search error:', error);
    throw error;
  }
}

/**
 * Perform hybrid line item search combining exact text matching with semantic search
 */
async function performHybridLineItemSearch(client: any, queryEmbedding: number[], searchQuery: string, params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    similarityThreshold = 0.35
  } = params;

  console.log('🔀 Starting hybrid line item search...');

  // Step 1: Exact text matching for high precision
  const exactMatches = await performExactLineItemSearch(client, searchQuery, {
    limit: Math.ceil(limit * 0.7), // 70% of results from exact matches
    offset,
    startDate,
    endDate,
    minAmount,
    maxAmount
  });

  console.log(`✅ Found ${exactMatches.lineItems.length} exact matches`);

  // Step 2: Semantic search for remaining slots (if needed)
  const remainingLimit = limit - exactMatches.lineItems.length;
  let semanticMatches = { lineItems: [], count: 0, total: 0 };

  // 🔧 FIX: For specific product searches, disable semantic search to avoid false positives
  const isSpecificProductSearch = /^[a-zA-Z\s]{2,20}$/.test(searchQuery.trim()) && searchQuery.trim().length <= 20;

  if (remainingLimit > 0 && !isSpecificProductSearch) {
    // Exclude exact match IDs from semantic search to avoid duplicates
    const exactMatchIds = exactMatches.lineItems.map(item => item.line_item_id);

    semanticMatches = await performSemanticLineItemSearch(client, queryEmbedding, {
      ...params,
      limit: remainingLimit,
      excludeLineItemIds: exactMatchIds
    });

    console.log(`🧠 Found ${semanticMatches.lineItems.length} additional semantic matches`);
  } else if (isSpecificProductSearch) {
    console.log(`🎯 Skipping semantic search for specific product query: "${searchQuery}" to ensure 100% precision`);
  }

  // Step 3: Combine and re-rank results
  const combinedResults = [
    ...exactMatches.lineItems.map(item => ({ ...item, matchType: 'exact', boost: 2.0 })),
    ...semanticMatches.lineItems.map(item => ({ ...item, matchType: 'semantic', boost: 1.0 }))
  ];

  // Re-rank with exact matches prioritized
  const rerankedResults = combinedResults
    .sort((a, b) => {
      // Prioritize exact matches
      if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
      if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;

      // Then by similarity score
      return (b.similarity || 0) - (a.similarity || 0);
    })
    .slice(0, limit);

  console.log(`🎯 Hybrid search complete: ${rerankedResults.length} total results (${exactMatches.lineItems.length} exact, ${semanticMatches.lineItems.length} semantic)`);

  return {
    lineItems: rerankedResults,
    count: rerankedResults.length,
    total: exactMatches.total + semanticMatches.total,
    metadata: {
      exactMatches: exactMatches.lineItems.length,
      semanticMatches: semanticMatches.lineItems.length,
      searchStrategy: 'hybrid',
      threshold: similarityThreshold
    }
  };
}

/**
 * Extract food item name from search query for line item matching
 */
function extractFoodItemFromQuery(searchQuery: string): string {
  console.log('🔍 Extracting food item from query:', searchQuery);

  // Remove common search prefixes and suffixes
  let extracted = searchQuery
    .replace(/^(find|search|show|get|look for)\s+/gi, '')
    .replace(/\s+(receipts?|purchases?|transactions?|expenses?)(\s+that|\s+with|\s+containing|\s+for)?/gi, '')
    .replace(/\s+(that|which|with|containing|having|has|have)\s+/gi, ' ')
    .replace(/\s+(in|at|from)\s+/gi, ' ')
    .trim();

  // If the extracted query is too short or empty, return the original
  if (extracted.length < 2) {
    extracted = searchQuery;
  }

  console.log('🍜 Extracted food item:', extracted);
  return extracted;
}

/**
 * Perform exact text matching on line item descriptions
 */
async function performExactLineItemSearch(client: any, searchQuery: string, params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount
  } = params;

  // Extract the actual food item name from the search query
  const foodItem = extractFoodItemFromQuery(searchQuery);

  console.log('🎯 Performing exact line item search for:', foodItem);
  console.log('🔍 DEBUG: Exact search parameters:', {
    originalQuery: searchQuery,
    extractedFoodItem: foodItem,
    searchPattern: `%${foodItem}%`,
    limit,
    offset,
    hasDateFilters: !!(startDate || endDate),
    hasAmountFilters: !!(minAmount !== null || maxAmount !== null)
  });

  // Build the SQL query for exact text matching
  let query = client
    .from('line_items')
    .select(`
      id,
      description,
      amount,
      receipt_id,
      receipts!line_items_receipt_id_fkey(
        id,
        merchant,
        date,
        total,
        currency,
        user_id
      )
    `)
    .ilike('description', `%${foodItem}%`) // Case-insensitive partial match
    .order('id', { ascending: false }); // Order by line_items.id instead of receipts.date

  // Apply filters
  if (startDate) {
    query = query.gte('receipts.date', startDate);
  }
  if (endDate) {
    query = query.lte('receipts.date', endDate);
  }
  if (minAmount !== null && minAmount !== undefined) {
    query = query.gte('amount', minAmount);
  }
  if (maxAmount !== null && maxAmount !== undefined) {
    query = query.lte('amount', maxAmount);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: results, error } = await query;

  console.log('🔍 DEBUG: Exact search query result:', {
    hasError: !!error,
    errorMessage: error?.message,
    hasResults: !!results,
    resultsLength: results?.length,
    firstResult: results?.[0] ? {
      id: results[0].id,
      description: results[0].description,
      amount: results[0].amount,
      hasReceipt: !!results[0].receipts
    } : null
  });

  if (error) {
    console.error('Error in exact line item search:', error);
    throw new Error(`Exact line item search failed: ${error.message}`);
  }

  if (!results || results.length === 0) {
    console.log('🔍 DEBUG: No exact matches found for query:', foodItem);
    return { lineItems: [], count: 0, total: 0 };
  }

  // Transform results to match expected format
  const transformedResults = results.map((item: any) => ({
    line_item_id: item.id,
    receipt_id: item.receipt_id,
    description: item.description,
    amount: item.amount,
    merchant: item.receipts.merchant,
    date: item.receipts.date,
    total: item.receipts.total,
    currency: item.receipts.currency,
    similarity: 1.0, // Perfect match for exact text matching
    matchType: 'exact'
  }));

  console.log(`✅ Exact search found ${transformedResults.length} matches`);

  return {
    lineItems: transformedResults,
    count: transformedResults.length,
    total: transformedResults.length // For exact matches, count = total
  };
}

/**
 * Perform semantic search on line items using receipt_embeddings (FIXED)
 */
async function performSemanticLineItemSearch(client: any, queryEmbedding: number[], params: any) {
  const {
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    similarityThreshold = 0.35,
    excludeLineItemIds = []
  } = params;

  console.log('🧠 Performing semantic line item search with threshold:', similarityThreshold);

  // UPDATED: Search unified_embeddings table for better data quality
  let query = client
    .from('unified_embeddings')
    .select(`
      id,
      source_id,
      content_type,
      embedding,
      metadata
    `)
    .eq('source_type', 'receipt')
    .eq('content_type', 'line_item')
    .not('metadata->line_item_id', 'is', null);

  // Exclude specific line item IDs if provided (to avoid duplicates with exact matches)
  if (excludeLineItemIds.length > 0) {
    console.log('🔧 Excluding line item IDs:', excludeLineItemIds);
    // Use a different approach: filter out the IDs after fetching
    // This avoids the JSON syntax issues with PostgreSQL
    // We'll filter these out in the JavaScript code below
  }

  // Apply date filters
  if (startDate) {
    query = query.gte('receipts.date', startDate);
  }
  if (endDate) {
    query = query.lte('receipts.date', endDate);
  }

  const { data: embeddings, error } = await query;

  if (error) {
    console.error('Error fetching line item embeddings:', error);
    throw new Error(`Semantic line item search failed: ${error.message}`);
  }

  if (!embeddings || embeddings.length === 0) {
    console.log('No line item embeddings found');
    return { lineItems: [], count: 0, total: 0 };
  }

  // Calculate similarity scores with enhanced vector processing context
  console.log('🔍 Processing embeddings with enhanced vector validation...');
  console.log('🔍 Query embedding dimensions:', queryEmbedding.length);
  console.log('🔍 Total embeddings to process:', embeddings.length);

  // Create vector processing context for monitoring
  const vectorContext = new VectorProcessingContext('performLineItemSearch');

  // Validate query embedding first
  const validatedQueryEmbedding = vectorContext.processVector(queryEmbedding, EMBEDDING_DIMENSIONS);
  if (!validatedQueryEmbedding) {
    console.error('🔧 Invalid query embedding provided');
    throw new Error('Invalid query embedding dimensions or format');
  }

  const resultsWithSimilarity = embeddings
    .map((embedding: any, index: number) => {
      if (!embedding.embedding) {
        console.warn(`🔧 Embedding ${index}: No embedding data`);
        vectorContext.skipVector();
        return null;
      }

      // 🔧 CRITICAL FIX: Use shared vector validation utility
      const validatedVector = vectorContext.processVector(embedding.embedding, EMBEDDING_DIMENSIONS);
      if (!validatedVector) {
        console.warn(`🔧 Embedding ${index}: Failed vector validation`);
        return null;
      }

      // Calculate cosine similarity with validated vectors
      const similarity = 1 - cosineSimilarity(validatedQueryEmbedding, validatedVector);

      return {
        ...embedding,
        embedding: validatedVector, // Use the properly parsed vector
        similarity,
        line_item_id: embedding.metadata?.line_item_id,
        receipt_id: embedding.source_id // Map source_id to receipt_id for compatibility
      };
    })
    .filter(result => {
      if (!result) return false;
      if (result.similarity < similarityThreshold) return false;

      // 🔧 FIX: Exclude line item IDs in JavaScript to avoid PostgreSQL JSON syntax issues
      if (excludeLineItemIds.length > 0 && result.line_item_id) {
        const isExcluded = excludeLineItemIds.includes(result.line_item_id);
        if (isExcluded) {
          console.log('🔧 Excluding duplicate line item ID:', result.line_item_id);
        }
        return !isExcluded;
      }

      return true;
    })
    .sort((a, b) => b.similarity - a.similarity);

  console.log(`🧠 Found ${resultsWithSimilarity.length} semantic matches above threshold ${similarityThreshold}`);

  // Apply pagination
  const paginatedResults = resultsWithSimilarity.slice(offset, offset + limit);

  // Fetch actual line item data and receipt data
  const lineItemIds = paginatedResults.map(r => r.line_item_id).filter(id => id);
  const receiptIds = paginatedResults.map(r => r.receipt_id).filter(id => id);

  if (lineItemIds.length === 0) {
    return { lineItems: [], count: 0, total: 0 };
  }

  // Fetch line items with receipt data
  const { data: lineItems, error: lineItemsError } = await client
    .from('line_items')
    .select(`
      id,
      description,
      amount,
      receipt_id,
      receipts!line_items_receipt_id_fkey(
        id,
        merchant,
        date,
        total,
        currency,
        user_id
      )
    `)
    .in('id', lineItemIds);

  if (lineItemsError) {
    console.error('Error fetching line item details:', lineItemsError);
    throw new Error(`Failed to fetch line item details: ${lineItemsError.message}`);
  }

  // Combine embedding results with line item data
  const finalResults = paginatedResults.map((embeddingResult: any) => {
    const lineItem = lineItems?.find(li => li.id === embeddingResult.line_item_id);

    return {
      line_item_id: embeddingResult.line_item_id,
      receipt_id: embeddingResult.receipt_id,
      description: lineItem?.description || 'Unknown',
      amount: lineItem?.amount || 0,
      merchant: lineItem?.receipts?.merchant || 'Unknown',
      date: lineItem?.receipts?.date || null,
      total: lineItem?.receipts?.total || 0,
      currency: lineItem?.receipts?.currency || 'MYR',
      similarity: embeddingResult.similarity,
      matchType: 'semantic'
    };
  });

  // Log vector processing statistics for monitoring
  vectorContext.logStats();

  return {
    lineItems: finalResults,
    count: finalResults.length,
    total: resultsWithSimilarity.length
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
