/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.0'
import { performLineItemSearch } from './performLineItemSearch.ts'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-requested-with, user-agent, accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
}

// Helper function to add CORS headers to any response
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Get environment variables
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Type for search parameters
interface SearchParams {
  query: string;
  contentType?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  categories?: string[];
  merchants?: string[];
  useHybridSearch?: boolean;
  similarityThreshold?: number;
  searchTarget?: 'receipts' | 'line_items' | 'all';
}

// Model configuration for embeddings
const DEFAULT_EMBEDDING_MODEL = 'embedding-001';
const EMBEDDING_DIMENSIONS = 1536; // Gemini's standard dimension

/**
 * Generate embeddings using Google's Gemini embedding model
 * Improved to handle dimension conversion more effectively
 */
async function generateEmbedding(input: { text: string; model?: string }): Promise<number[]> {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(input.text);
    let embedding = result.embedding.values;

    // Handle dimension mismatch - Gemini returns 768 dimensions but we need 1536 for pgvector
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.log(`Converting embedding dimensions from ${embedding.length} to ${EMBEDDING_DIMENSIONS}`);

      if (embedding.length < EMBEDDING_DIMENSIONS) {
        if (embedding.length * 2 === EMBEDDING_DIMENSIONS) {
          // If exactly half the size, duplicate each value instead of zero-padding
          // This preserves more semantic information than zero padding
          embedding = embedding.flatMap(val => [val, val]);
        } else {
          // Pad with zeros, but normalize the remaining values to maintain vector magnitude
          const normalizationFactor = Math.sqrt(EMBEDDING_DIMENSIONS / embedding.length);
          const normalizedEmbedding = embedding.map(val => val * normalizationFactor);
          const padding = new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0);
          embedding = [...normalizedEmbedding, ...padding];
        }
      } else if (embedding.length > EMBEDDING_DIMENSIONS) {
        // If too long, use a dimensionality reduction approach
        // For simplicity, we're averaging adjacent pairs if it's exactly double
        if (embedding.length === EMBEDDING_DIMENSIONS * 2) {
          const reducedEmbedding = [];
          for (let i = 0; i < embedding.length; i += 2) {
            reducedEmbedding.push((embedding[i] + embedding[i+1]) / 2);
          }
          embedding = reducedEmbedding;
        } else {
          // Otherwise just truncate but normalize the remaining values
          embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
          // Normalize to maintain vector magnitude
          const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
          if (magnitude > 0) {
            embedding = embedding.map(val => val / magnitude * Math.sqrt(EMBEDDING_DIMENSIONS));
          }
        }
      }
    }
    console.log(`Generated embedding for text "${input.text.substring(0,30)}...": [${embedding.slice(0,5).join(', ')}, ...] (length: ${embedding.length})`);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding with Gemini:', error);
    throw error;
  }
}

/**
 * Perform semantic search using vector embeddings
 */
async function performSemanticSearch(client: any, queryEmbedding: number[], params: SearchParams) {
  const {
    contentType = 'full_text',
    limit = 10,
    offset = 0,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    categories,
    merchants,
    similarityThreshold = 0.2, // Lowered from 0.4 for better recall
    useHybridSearch = false,
    query: searchQuery,
    searchTarget = 'receipts' // Default to receipts search
  } = params;

  console.log('Starting semantic search with params:', {
    contentType, limit, offset, startDate, endDate,
    minAmount, maxAmount, useHybridSearch, searchTarget
  });

  // Use the appropriate search function based on what's available in the database
  let searchFunction = 'search_receipts'; // Default to the legacy function
  let searchResults;
  let error;

  // For receipts, use search_receipts function
  if (searchTarget === 'receipts') {
    console.log(`Using search_receipts function`);

    const { data, error: searchError } = await client.rpc(
      'search_receipts',
      {
        query_embedding: queryEmbedding,
        similarity_threshold: similarityThreshold,
        match_count: limit + offset,
        content_type_filter: contentType || 'all'
      }
    );

    searchResults = data;
    error = searchError;
  }
  // For line items, use search_line_items function
  else if (searchTarget === 'line_items') {
    console.log(`Using search_line_items function`);

    const { data, error: searchError } = await client.rpc(
      'search_line_items',
      {
        query_embedding: queryEmbedding,
        similarity_threshold: similarityThreshold,
        match_count: limit + offset
      }
    );

    searchResults = data;
    error = searchError;
  }
  // For 'all', we'll handle this differently in the main search handler

  if (error) {
    console.error('Error in semantic search:', error);
    throw new Error(`Error in semantic search: ${error.message}`);
  }

  if (!searchResults || searchResults.length === 0) {
    console.log('No matches found for query');
    return { receipts: [], count: 0, total: 0 };
  }

  console.log(`Found ${searchResults.length} search results before pagination`);

  // Apply offset and limit for pagination
  const paginatedResults = searchResults.slice(offset, offset + limit);

  // If we're searching for line items, call the specialized line item search handler
  if (searchTarget === 'line_items') {
    return await processLineItemSearchResults(client, paginatedResults, params);
  }

  // For receipt searches, continue with the existing flow
  const extractedIds = paginatedResults.map((r: any) => r.receipt_id);
  const similarityScores = paginatedResults.reduce((acc: Record<string, number>, r: any) => {
    acc[r.receipt_id] = r.similarity || r.score || 0;
    return acc;
  }, {});

  console.log(`Extracted ${extractedIds.length} receipt IDs to fetch full details`);

  // Build query to get full receipt data
  let queryBuilder = client
    .from('receipts')
    .select('*')
    .in('id', extractedIds)
    .order('date', { ascending: false });

  // Apply additional filters if provided
  if (startDate) {
    queryBuilder = queryBuilder.gte('date', startDate);
  }

  if (endDate) {
    queryBuilder = queryBuilder.lte('date', endDate);
  }

  if (minAmount !== undefined) {
    queryBuilder = queryBuilder.gte('total', minAmount);
  }

  if (maxAmount !== undefined) {
    queryBuilder = queryBuilder.lte('total', maxAmount);
  }

  if (categories && categories.length > 0) {
    queryBuilder = queryBuilder.eq('predicted_category', categories[0]); // Using first category for now
  }

  if (merchants && merchants.length > 0) {
    queryBuilder = queryBuilder.in('merchant', merchants);
  }

  // Execute the query
  const { data: receipts, error: receiptsError } = await queryBuilder;

  if (receiptsError) {
    throw new Error(`Error fetching receipt data: ${receiptsError.message}`);
  }

  console.log(`Retrieved ${receipts.length} receipts`);

  // Add similarity scores to the results
  const receiptsWithSimilarity = receipts.map((receipt: any) => ({
    ...receipt,
    similarity_score: similarityScores[receipt.id] || 0
  }));

  // Sort by similarity score (highest first)
  receiptsWithSimilarity.sort((a: any, b: any) => b.similarity_score - a.similarity_score);

  return {
    receipts: receiptsWithSimilarity,
    count: receiptsWithSimilarity.length,
    total: extractedIds.length
  };
}

/**
 * Process line item search results from the unified embeddings model
 */
async function processLineItemSearchResults(client: any, results: any[], params: SearchParams) {
  if (!results || results.length === 0) {
    return { lineItems: [], count: 0, total: 0 };
  }

  // Extract line item IDs from the search results metadata
  const lineItemIds = results.map(r => {
    // Try to get line item ID from metadata
    if (r.metadata) {
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return metadata.line_item_id;
    }
    return null;
  }).filter(id => id !== null);

  // Create a map of similarity scores
  const similarityScores = results.reduce((acc: Record<string, number>, r: any) => {
    // Get line item ID from metadata
    let lineItemId = null;
    if (r.metadata) {
      const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      lineItemId = metadata.line_item_id;
    }
    if (lineItemId) {
      acc[lineItemId] = r.similarity || r.score || 0;
    }
    return acc;
  }, {});

  // Fetch the actual line item data
  // Use separate queries to avoid relationship conflicts
  const { data: lineItems, error } = await client
    .from('line_items')
    .select('id, receipt_id, description, amount')
    .in('id', lineItemIds);

  if (error) {
    console.error('Error fetching line item details:', error);
    throw new Error(`Error fetching line item details: ${error.message}`);
  }

  // Fetch receipt data separately to avoid relationship conflicts
  let receiptData = {};
  if (lineItems && lineItems.length > 0) {
    const receiptIds = [...new Set(lineItems.map(item => item.receipt_id))];
    const { data: receipts, error: receiptError } = await client
      .from('receipts')
      .select('id, merchant, date')
      .in('id', receiptIds);

    if (receiptError) {
      console.error('Error fetching receipt details:', receiptError);
      // Continue without receipt data rather than failing completely
    } else if (receipts) {
      receiptData = receipts.reduce((acc, receipt) => {
        acc[receipt.id] = receipt;
        return acc;
      }, {});
    }
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
      similarity: similarityScores[item.id] || 0
    };
  });

  // Sort by similarity score (highest first)
  formattedLineItems.sort((a: any, b: any) => b.similarity - a.similarity);

  return {
    lineItems: formattedLineItems,
    count: formattedLineItems.length,
    total: results.length
  };
}

/**
 * Parse natural language query to extract search parameters with improved prompt and error handling
 */
async function parseNaturalLanguageQuery(query: string): Promise<SearchParams> {
  console.log(`Parsing natural language query: ${query}`);

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Get current date for better relative date handling
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

    // Construct an improved prompt to help the model understand how to parse the query
    const prompt = `
      Parse the following search query for a receipt tracking app and extract structured parameters.
      You can extract dates, amounts, categories, merchants, and other relevant filters.

      Today's date is ${now.toISOString().split('T')[0]}.

      Guidelines for parsing:
      1. For dates, convert to ISO format (YYYY-MM-DD).
      2. For relative dates like 'last month', 'last week', etc., calculate the actual date range.
      3. For amounts, extract numeric values only.
      4. For merchants, extract exact store or business names.
      5. For categories, map to common shopping categories (groceries, dining, entertainment, etc.)
      6. If a field is not mentioned, return null for that field.
      7. For search target, determine if the user is looking for receipts or line items (individual items on receipts).

      Examples:
      Query: "Show me all receipts from last month over $50"
      {
        "startDate": "${currentYear}-${(currentMonth - 1).toString().padStart(2, '0')}-01",
        "endDate": "${currentYear}-${(currentMonth - 1).toString().padStart(2, '0')}-${new Date(currentYear, currentMonth - 1, 0).getDate()}",
        "minAmount": 50,
        "maxAmount": null,
        "categories": [],
        "merchants": [],
        "searchTarget": "receipts"
      }

      Query: "receipts from Target between $10 and $50 in January"
      {
        "startDate": "${currentYear}-01-01",
        "endDate": "${currentYear}-01-31",
        "minAmount": 10,
        "maxAmount": 50,
        "categories": [],
        "merchants": ["Target"],
        "searchTarget": "receipts"
      }

      Query: "milk purchases from last week"
      {
        "startDate": "${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",
        "endDate": "${now.toISOString().split('T')[0]}",
        "minAmount": null,
        "maxAmount": null,
        "categories": ["groceries"],
        "merchants": [],
        "searchTarget": "line_items"
      }

      Now parse this search query:
      Query: "${query}"

      Return a valid JSON object only, no explanation or additional text.
    `;

    // Set temperature to 0 for more deterministic parsing
    const generationConfig = {
      temperature: 0,
      topP: 0.8,
      maxOutputTokens: 500,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const text = result.response.text();
    console.log(`Raw NLU response: ${text}`);

    // Extract the JSON part from the text response with improved handling
    let jsonStr = text.trim();

    // Try different approaches to extract JSON
    let parsedParams = null;
    let jsonError = null;

    // Try to parse directly first
    try {
      parsedParams = JSON.parse(jsonStr);
    } catch (e) {
      jsonError = e;
      console.log('Could not parse directly, trying to extract JSON block...');

      // Find JSON boundaries with improved detection
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');

      if (jsonStart >= 0 && jsonEnd >= 0 && jsonEnd > jsonStart) {
        try {
          jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
          parsedParams = JSON.parse(jsonStr);
          jsonError = null;
        } catch (e2) {
          console.error(`Error extracting JSON from boundaries: ${e2}`);
        }
      }

      // If still not parsed, try regex for more complex cases
      if (!parsedParams) {
        try {
          const regex = /{[\s\S]*?}/;
          const match = jsonStr.match(regex);
          if (match && match[0]) {
            parsedParams = JSON.parse(match[0]);
            jsonError = null;
          }
        } catch (e3) {
          console.error(`Error parsing with regex: ${e3}`);
        }
      }
    }

    if (parsedParams) {
      // Validate and sanitize extracted parameters
      // Type assertion to avoid 'never' type issues
      const params = parsedParams as Record<string, any>;

      const validatedParams: SearchParams = {
        query,  // Keep the original query text
        // Convert date strings to ISO format if needed and verify they are valid dates
        startDate: params.startDate && typeof params.startDate === 'string' && isValidDateString(params.startDate) ?
                  params.startDate : undefined,
        endDate: params.endDate && typeof params.endDate === 'string' && isValidDateString(params.endDate) ?
                params.endDate : undefined,
        // Ensure numeric values are properly typed
        minAmount: typeof params.minAmount === 'number' ? params.minAmount : undefined,
        maxAmount: typeof params.maxAmount === 'number' ? params.maxAmount : undefined,
        // Validate arrays
        categories: Array.isArray(params.categories) ? params.categories : undefined,
        merchants: Array.isArray(params.merchants) ? params.merchants : undefined,
        // Validate searchTarget is one of the expected values
        searchTarget: ['receipts', 'line_items', 'all'].includes(params.searchTarget) ?
          params.searchTarget as 'receipts' | 'line_items' | 'all' : 'receipts',
        // Set a sensible default for useHybridSearch based on parameter presence
        useHybridSearch: Boolean(
          params.minAmount !== null ||
          params.maxAmount !== null ||
          params.startDate !== null ||
          params.endDate !== null ||
          (Array.isArray(params.merchants) && params.merchants.length > 0)
        )
      };

      console.log('Validated search parameters:', validatedParams);
      return validatedParams;
    } else if (jsonError) {
      console.error(`Error parsing JSON from NLU response: ${jsonError}`);
      // Fallback to just the query if parsing fails
      return { query };
    }

    // Final fallback
    return { query };
  } catch (error) {
    console.error(`Error in natural language parsing: ${error}`);
    // Return basic params with just the query on error
    return { query };
  }
}

// Helper function to validate date strings
function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;

  // Try to parse as ISO date string
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Main handler for the semantic search edge function
 */
serve(async (req) => {
  // Log request details for debugging
  console.log('Semantic search request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Responding to OPTIONS request with CORS headers');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Create Supabase client
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing Supabase credentials'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    // Parse request
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Parsed request body:', { ...requestBody, query: requestBody.query }); // Log request without full query text
    } catch (jsonError) {
      console.error('Error parsing request JSON:', jsonError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (req.method === 'POST') {
      console.log('Received POST request to semantic-search function');

      const { query, isNaturalLanguage = false } = requestBody;

      // For certain operations, we don't need a query parameter
      const operationsNotRequiringQuery = [
        'testGeminiConnection',
        'testLineItemEmbeddingStatus',
        'generateLineItemEmbeddings',
        'checkEmbeddingStats',
        'checkLineItemEmbeddingStats'
      ];

      const isSpecialOperation = operationsNotRequiringQuery.some(op => requestBody[op] === true);

      if (!query && !isSpecialOperation) {
        console.error('Missing required parameter: query');
        return new Response(
          JSON.stringify({ error: 'Missing required parameter: query' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this is a test connection request
      if (requestBody.testGeminiConnection) {
        console.log('Testing Gemini API connection...');
        try {
          if (!geminiApiKey) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'GEMINI_API_KEY is not set in environment variables'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Test Gemini connection by initializing the client
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: 'embedding-001' });

          return new Response(
            JSON.stringify({
              success: true,
              testResult: 'Gemini API connection successful',
              modelInfo: 'embedding-001'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error testing Gemini connection:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Error connecting to Gemini API: ${error instanceof Error ? error.message : String(error)}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check line item embedding status
      if (requestBody.testLineItemEmbeddingStatus) {
        console.log('Checking line item embedding status...');
        try {
          // Check how many line items have embeddings
          const { data: lineItemStats, error: statsError } = await supabaseClient
            .from('line_items')
            .select('id, embedding')
            .limit(1000);

          if (statsError) {
            throw new Error(`Error checking line item embedding status: ${statsError.message}`);
          }

          const total = lineItemStats.length;
          const withEmbeddings = lineItemStats.filter(item => item.embedding !== null).length;
          const withoutEmbeddings = total - withEmbeddings;

          return new Response(
            JSON.stringify({
              success: true,
              exists: withEmbeddings > 0,
              count: withEmbeddings,
              total,
              withEmbeddings,
              withoutEmbeddings
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error checking line item embedding status:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Error checking line item embedding status: ${error instanceof Error ? error.message : String(error)}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Generate embeddings for line items
      if (requestBody.generateLineItemEmbeddings) {
        console.log('Generating line item embeddings...');
        try {
          // Reduced batch size to avoid timeouts
          const limit = requestBody.limit || 10; // Reduced from 50 to 10

          // Get line items without embeddings
          const { data: lineItems, error: lineItemsError } = await supabaseClient
            .from('line_items')
            .select('id, description')
            .is('embedding', null)
            .limit(limit);

          if (lineItemsError) {
            throw new Error(`Error fetching line items: ${lineItemsError.message}`);
          }

          if (!lineItems || lineItems.length === 0) {
            console.log('No line items without embeddings found.');
            return new Response(
              JSON.stringify({
                success: true,
                processed: 0,
                total: 0,
                withEmbeddings: 0,
                withoutEmbeddings: 0,
                message: 'No line items without embeddings found.'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`Found ${lineItems.length} line items without embeddings.`);

          // Get total counts for stats - but limit to first 100 to avoid performance issues
          const { data: statsData, error: statsError } = await supabaseClient
            .from('line_items')
            .select('id, embedding')
            .limit(100);

          if (statsError) {
            throw new Error(`Error fetching line item stats: ${statsError.message}`);
          }

          // Process line items one by one, but with a smaller batch size
          let processed = 0;
          let errors = 0;
          const maxItems = Math.min(5, lineItems.length); // Process at most 5 items per request

          for (let i = 0; i < maxItems; i++) {
            const lineItem = lineItems[i];
            console.log(`Processing line item ${i+1}/${maxItems}: ${lineItem.id}`);

            try {
              // Skip if no description available
              if (!lineItem.description || lineItem.description.trim() === '') {
                console.log(`Skipping line item ${lineItem.id} - no description`);
                continue;
              }

              // Generate embedding for the line item description
              const embedding = await generateEmbedding({ text: lineItem.description });
              if (i === 0) { // Log only for the first item in the batch
                console.log(`First line item to process: ID=${lineItem.id}, Description="${lineItem.description.substring(0,30)}..."`);
                console.log(`Generated embedding for SQL (first item): [${embedding.slice(0,5).join(', ')}, ...] (length: ${embedding.length})`);
              }

              // Store the embedding
              const { data: rpcData, error: rpcError } = await supabaseClient.rpc('generate_line_item_embeddings', {
                p_line_item_id: lineItem.id,
                p_embedding: embedding
              });
              console.log(`RPC call to generate_line_item_embeddings for ${lineItem.id}: Data=${JSON.stringify(rpcData)}, Error=${JSON.stringify(rpcError)}`);

              if (rpcError) {
                console.error(`Error storing embedding for line item ${lineItem.id}:`, rpcError);
                errors++;
              } else {
                processed++;
                console.log(`Generated embedding for line item ${lineItem.id}`);
              }
            } catch (itemError) {
              console.error(`Error processing line item ${lineItem.id}:`, itemError);
              errors++;
            }
          }

          // Get new counts after processing
          const { data: newStatsData } = await supabaseClient
            .from('line_items')
            .select('id, embedding')
            .limit(100);

          const total = newStatsData?.length || 0;
          const withEmbeddings = newStatsData?.filter(item => item.embedding !== null).length || 0;
          const withoutEmbeddings = total - withEmbeddings;

          return new Response(
            JSON.stringify({
              success: true,
              processed,
              total,
              withEmbeddings,
              withoutEmbeddings
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error generating line item embeddings:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Error generating line item embeddings: ${error instanceof Error ? error.message : String(error)}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Parse search parameters for normal search
      let searchParams: SearchParams;

      console.log(`Received search query: "${query}"`);

      // Process natural language query if needed
      if (isNaturalLanguage) {
        console.log("Processing as natural language query");
        searchParams = await parseNaturalLanguageQuery(query);
        console.log("Extracted parameters:", JSON.stringify(searchParams));
      } else {
        // Extract other parameters from the request body
        const {
          contentType,
          limit,
          offset,
          startDate,
          endDate,
          minAmount,
          maxAmount,
          categories,
          merchants,
          searchTarget = 'receipts' // Default to receipts search if not specified
        } = requestBody;

        // Validate searchTarget to ensure it's one of the allowed values
        const validatedSearchTarget = ['receipts', 'line_items', 'all'].includes(searchTarget)
          ? searchTarget as 'receipts' | 'line_items' | 'all'
          : 'receipts';

        searchParams = {
          query,
          contentType,
          limit,
          offset,
          startDate,
          endDate,
          minAmount,
          maxAmount,
          categories,
          merchants,
          searchTarget: validatedSearchTarget
        };
      }

      // Generate embedding for the search query
      console.log('Generating embedding for query:', searchParams.query);
      const queryEmbedding = await generateEmbedding({ text: searchParams.query });
      console.log('Embedding generated with dimensions:', queryEmbedding.length);

      // Determine which search function to use based on searchTarget
      let results: {
        receipts?: any[];
        lineItems?: any[];
        count: number;
        total: number;
        fallback?: boolean;
      };

      if (searchParams.searchTarget === 'all') {
        console.log('Performing unified search (both receipts and line items)...');

        // Search receipts
        const receiptParams = { ...searchParams, searchTarget: 'receipts' };
        const receiptResults = await performSemanticSearch(supabaseClient, queryEmbedding, receiptParams);

        // Search line items
        const lineItemParams = { ...searchParams, searchTarget: 'line_items' };
        const lineItemResults = await performLineItemSearch(supabaseClient, queryEmbedding, lineItemParams);

        // Proper type handling for receipt and line item results
        const receiptItems = 'receipts' in receiptResults ? receiptResults.receipts : [];
        const lineItems = 'lineItems' in lineItemResults ? lineItemResults.lineItems : [];
        const receiptCount = receiptItems?.length || 0;
        const lineItemCount = lineItems?.length || 0;
        const receiptTotal = receiptResults.total || 0;
        const lineItemTotal = lineItemResults.total || 0;

        // Combine results
        results = {
          receipts: receiptItems,
          lineItems: lineItems,
          count: receiptCount + lineItemCount,
          total: receiptTotal + lineItemTotal,
          fallback: Boolean(receiptResults.fallback || lineItemResults.fallback)
        };

        console.log('Unified search completed with results:', {
          receiptCount,
          lineItemCount,
          totalCount: receiptCount + lineItemCount,
          total: receiptTotal + lineItemTotal,
          usingFallback: results.fallback
        });
      } else if (searchParams.searchTarget === 'line_items') {
        console.log('Performing line item search...');

        const lineItemResults = await performLineItemSearch(supabaseClient, queryEmbedding, searchParams);

        // Ensure type safety
        results = {
          lineItems: lineItemResults.lineItems || [],
          count: lineItemResults.lineItems?.length || 0,
          total: lineItemResults.total || 0,
          fallback: Boolean(lineItemResults.fallback)
        };

        console.log('Line item search completed with results:', {
          count: results.lineItems?.length || 0,
          total: results.total || 0,
          usingFallback: results.fallback
        });
      } else {
        console.log('Performing receipt search...');
        // Default to receipt search
        const receiptResults = await performSemanticSearch(supabaseClient, queryEmbedding, searchParams);

        // Ensure type safety
        results = {
          receipts: receiptResults.receipts || [],
          count: receiptResults.receipts?.length || 0,
          total: receiptResults.total || 0,
          fallback: Boolean(receiptResults.fallback)
        };

        console.log('Receipt search completed with results:', {
          count: results.receipts?.length || 0,
          total: results.total || 0,
          usingFallback: results.fallback
        });
      }

      // Return the search results
      return new Response(
        JSON.stringify({
          success: true,
          results,
          searchParams
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in semantic-search function:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
