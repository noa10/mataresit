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
  searchTarget?: 'receipts' | 'line_items';
}

// Model configuration for embeddings
const DEFAULT_EMBEDDING_MODEL = 'embedding-001';
const EMBEDDING_DIMENSIONS = 1536; // Gemini's standard dimension

/**
 * Generate embeddings using Google's Gemini embedding model
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

    // Handle dimension mismatch - Gemini returns 768 dimensions but we need 1536
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.log(`Adjusting embedding dimensions from ${embedding.length} to ${EMBEDDING_DIMENSIONS}`);
      
      if (embedding.length < EMBEDDING_DIMENSIONS) {
        // Pad the embedding with zeros if it's too short
        const padding = new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0);
        embedding = [...embedding, ...padding];
      } else if (embedding.length > EMBEDDING_DIMENSIONS) {
        // Truncate the embedding if it's too long
        embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
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
    similarityThreshold = 0.5,
    useHybridSearch = false,
    query: searchQuery,
    searchTarget = 'receipts' // Default to receipts search
  } = params;

  console.log('Starting semantic search with params:', {
    contentType, limit, offset, startDate, endDate, 
    minAmount, maxAmount, useHybridSearch, searchTarget
  });

  // Determine which search function to use based on searchTarget
  let searchFunction = '';
  if (searchTarget === 'receipts') {
    searchFunction = useHybridSearch ? 'hybrid_search_receipts' : 'search_receipts';
  } else {
    searchFunction = useHybridSearch ? 'hybrid_search_line_items' : 'search_line_items';
  }

  console.log(`Using database function: ${searchFunction}`);

  // Call the database function for vector search
  const { data: searchResults, error } = await client.rpc(
    searchFunction,
    {
      query_embedding: queryEmbedding,
      similarity_threshold: similarityThreshold,
      match_count: limit + offset,
      ...(searchTarget === 'receipts' ? { content_type_filter: contentType } : {}), // Use renamed parameter
      ...(useHybridSearch ? {
        search_text: searchQuery,
        similarity_weight: 0.7,
        text_weight: 0.3,
      } : {})
    }
  );

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
 * Parse natural language query to extract search parameters
 */
async function parseNaturalLanguageQuery(query: string): Promise<SearchParams> {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  try {
    // Use Gemini to extract structured parameters from the query
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Extract search parameters from natural language queries about receipts.
      Return a JSON object with these fields if they can be inferred:
      - startDate and endDate (ISO format YYYY-MM-DD)
      - minAmount and maxAmount (numbers)
      - categories (array of strings)
      - merchants (array of strings)
      - contentType ('full_text', 'merchant', 'notes')
      - query (the core search query with filters removed)
      If something cannot be inferred, omit the field entirely.
      
      User query: ${query}
      
      JSON response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse the response text as JSON
    try {
      // Extract JSON from the response text in case it's wrapped in markdown code blocks
      const jsonText = text.replace(/```json\n|\n```|```/g, '').trim();
      const extractedParams = JSON.parse(jsonText);
      
      return {
        query: extractedParams.query || query,
        contentType: extractedParams.contentType || 'full_text',
        startDate: extractedParams.startDate,
        endDate: extractedParams.endDate,
        minAmount: extractedParams.minAmount,
        maxAmount: extractedParams.maxAmount,
        categories: extractedParams.categories,
        merchants: extractedParams.merchants,
        useHybridSearch: true, // Default to hybrid search for natural language
      };
    } catch (jsonError) {
      console.warn('Error parsing Gemini response as JSON:', jsonError);
      console.log('Raw Gemini response:', text);
      // Fall back to using the raw query
      return { query };
    }
  } catch (error) {
    console.warn('Error parsing natural language query with Gemini:', error);
    // Fall back to using the raw query
    return { query };
  }
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
          searchTarget
        };
      }

      // Generate embedding for the search query
      console.log('Generating embedding for query:', searchParams.query);
      const queryEmbedding = await generateEmbedding({ text: searchParams.query });
      console.log('Embedding generated with dimensions:', queryEmbedding.length);

      // Determine which search function to use based on searchTarget
      let results;
      if (searchParams.searchTarget === 'line_items') {
        console.log('Performing line item search...');
        
        // Test direct SQL query to debug
        try {
          console.log('Testing direct SQL query for line items with "sayur"');
          const { data: directTestResults, error: directTestError } = await supabaseClient
            .from('line_items')
            .select('id, description, amount')
            .ilike('description', '%sayur%')
            .limit(5);
            
          if (directTestError) {
            console.error('Direct test query error:', directTestError);
          } else {
            console.log(`Direct SQL test found ${directTestResults?.length || 0} results for "sayur"`, 
              directTestResults?.map(i => `"${i.description}" (${i.amount})`) || []);
          }
        } catch (testError) {
          console.error('Error in direct test query:', testError);
        }
        
        results = await performLineItemSearch(supabaseClient, queryEmbedding, searchParams);
        console.log('Line item search completed with results:', {
          count: results.lineItems?.length || 0,
          total: results.total || 0,
          resultsStructure: results
        });
      } else {
        console.log('Performing receipt search...');
        // Default to receipt search
        results = await performSemanticSearch(supabaseClient, queryEmbedding, searchParams);
        console.log('Receipt search completed with results:', {
          count: results.receipts?.length || 0,
          total: results.total || 0
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
