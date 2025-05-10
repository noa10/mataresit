/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.0'

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
    query: searchQuery
  } = params;

  // Determine which search function to use
  const searchFunction = useHybridSearch ? 'hybrid_search_receipts' : 'search_receipts';

  // Call the database function for vector search
  const { data: receiptIds, error } = await client.rpc(
    searchFunction,
    {
      query_embedding: queryEmbedding,
      similarity_threshold: similarityThreshold,
      match_count: limit + offset,
      content_type: contentType,
      ...(useHybridSearch ? {
        search_text: searchQuery,
        similarity_weight: 0.7,
        text_weight: 0.3,
      } : {})
    }
  );

  if (error) {
    throw new Error(`Error in semantic search: ${error.message}`);
  }

  // If no results, return empty array
  if (!receiptIds || receiptIds.length === 0) {
    return { receipts: [], count: 0 };
  }

  // Extract receipt IDs with similarity scores
  const filteredIds = receiptIds.slice(offset, offset + limit);
  const extractedIds = filteredIds.map((r: any) => r.receipt_id);
  const similarityScores = filteredIds.reduce((acc: Record<string, number>, r: any) => {
    acc[r.receipt_id] = r.similarity || r.score || 0;
    return acc;
  }, {});

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
    queryBuilder = queryBuilder.eq('category', categories[0]); // Using first category for now
  }

  if (merchants && merchants.length > 0) {
    queryBuilder = queryBuilder.in('merchant', merchants);
  }

  // Execute the query
  const { data: receipts, error: receiptsError } = await queryBuilder;

  if (receiptsError) {
    throw new Error(`Error fetching receipt data: ${receiptsError.message}`);
  }

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
    total: receiptIds.length
  };
}

/**
 * Parse natural language query to extract search parameters
 */
async function parseNaturalLanguageQuery(query: string): Promise<SearchParams> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  try {
    // Use OpenAI to extract structured parameters from the query
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Extract search parameters from natural language queries about receipts.
            Return a JSON object with these fields if they can be inferred:
            - startDate and endDate (ISO format YYYY-MM-DD)
            - minAmount and maxAmount (numbers)
            - categories (array of strings)
            - merchants (array of strings)
            - contentType ('full_text', 'merchant', 'notes')
            - query (the core search query with filters removed)
            If something cannot be inferred, omit the field entirely.`
          },
          {
            role: 'user',
            content: query
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const extractedParams = JSON.parse(data.choices[0].message.content);

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
  } catch (error) {
    console.warn('Error parsing natural language query:', error);
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

      if (!query) {
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
          merchants
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
          merchants
        };
      }

      // Generate embedding for the search query
      console.log('Generating embedding for query:', searchParams.query);
      const queryEmbedding = await generateEmbedding({ text: searchParams.query });
      console.log('Embedding generated with dimensions:', queryEmbedding.length);

      // Perform semantic search
      const results = await performSemanticSearch(supabaseClient, queryEmbedding, searchParams);

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
