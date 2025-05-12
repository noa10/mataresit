/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.0';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-requested-with, user-agent, accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Get environment variables
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Create a type for embedding input
interface EmbeddingInput {
  text: string;
  model?: string;
}

// Create a type for receipt embedding request
interface ReceiptEmbeddingRequest {
  receiptId: string;
  contentType: string; // e.g., 'full_text', 'merchant', 'items', etc.
  content: string;
  metadata?: Record<string, any>;
  model?: string;
}

// Create a type for line item embedding request
interface LineItemEmbeddingRequest {
  lineItemId: string;
  receiptId: string;
  content: string;
  metadata?: Record<string, any>;
  model?: string;
}

// Default embedding model configuration
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536; // OpenAI's standard dimension

/**
 * Generate embeddings for a text using Google's Gemini embedding model
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(text);
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
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Store embeddings in the database using the current table structure
 */
async function storeEmbedding(
  client: any,
  receiptId: string,
  contentType: string,
  embedding: number[],
  metadata: Record<string, any> = {},
  sourceType: string = 'receipt',
  sourceId?: string
) {
  // For line items, store the ID in metadata
  if (sourceType === 'line_item' && sourceId) {
    metadata = {
      ...metadata,
      line_item_id: sourceId
    };
  }

  // Insert directly into receipt_embeddings table
  const { data, error } = await client
    .from('receipt_embeddings')
    .insert({
      receipt_id: receiptId,
      content_type: contentType,
      embedding: embedding,
      metadata: metadata
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Error storing embedding: ${error.message}`);
  }

  return data;
}

/**
 * Process receipt data and generate embeddings
 */
async function processReceiptEmbedding(request: ReceiptEmbeddingRequest, supabaseClient: any) {
  const { receiptId, contentType, content, metadata = {}, model } = request;

  // Validate inputs
  if (!receiptId || !contentType || !content) {
    throw new Error('Missing required parameters: receiptId, contentType, or content');
  }

  console.log(`Generating ${contentType} embedding for receipt ${receiptId}`);

  // Generate the embedding
  const embedding = await generateEmbedding(content);

  console.log(`Successfully generated embedding with ${embedding.length} dimensions`);

  // Store the embedding in the database
  await storeEmbedding(supabaseClient, receiptId, contentType, embedding, metadata);

  return {
    success: true,
    receiptId,
    contentType,
    dimensions: embedding.length
  };
}

/**
 * Process line item data and generate embeddings
 */
async function processLineItemEmbedding(request: LineItemEmbeddingRequest, supabaseClient: any) {
  const { lineItemId, receiptId, content, metadata = {}, model } = request;

  // Validate inputs
  if (!lineItemId || !receiptId || !content) {
    throw new Error('Missing required parameters: lineItemId, receiptId, or content');
  }

  console.log(`Generating embedding for line item ${lineItemId} in receipt ${receiptId}`);

  // Generate the embedding
  const embedding = await generateEmbedding(content);

  console.log(`Successfully generated line item embedding with ${embedding.length} dimensions`);

  // Store the embedding using the unified model
  await storeEmbedding(
    supabaseClient,
    receiptId,
    'line_item', // content_type for line items
    embedding,
    metadata,
    'line_item', // source_type
    lineItemId // source_id
  );

  return {
    success: true,
    lineItemId,
    receiptId,
    dimensions: embedding.length
  };
}

/**
 * Generate embeddings for multiple content types from a receipt
 */
async function generateReceiptEmbeddings(supabaseClient: any, receiptId: string, model?: string) {
  // Fetch the receipt data
  const { data: receipt, error } = await supabaseClient
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .single();

  if (error) {
    throw new Error(`Error fetching receipt: ${error.message}`);
  }

  if (!receipt) {
    throw new Error(`Receipt with ID ${receiptId} not found`);
  }

  console.log(`Processing receipt: ${receiptId}, fields available:`, Object.keys(receipt));

  const results = [];
  let contentProcessed = false;

  // Generate embedding for the full text (check both raw_text and fullText fields)
  const fullTextContent = receipt.raw_text || receipt.fullText;
  if (fullTextContent) {
    contentProcessed = true;
    const fullTextResult = await processReceiptEmbedding({
      receiptId,
      contentType: 'full_text',
      content: fullTextContent,
      metadata: {
        receipt_date: receipt.date,
        total: receipt.total
      },
      model
    }, supabaseClient);
    results.push(fullTextResult);
  } else {
    console.log(`No full text content found for receipt ${receiptId}`);
  }

  // Generate embedding for the merchant name
  if (receipt.merchant) {
    contentProcessed = true;
    const merchantResult = await processReceiptEmbedding({
      receiptId,
      contentType: 'merchant',
      content: receipt.merchant,
      metadata: {
        receipt_date: receipt.date,
        total: receipt.total
      },
      model
    }, supabaseClient);
    results.push(merchantResult);
  } else {
    console.log(`No merchant name found for receipt ${receiptId}`);
  }

  // Generate embedding for any notes
  if (receipt.notes) {
    contentProcessed = true;
    const notesResult = await processReceiptEmbedding({
      receiptId,
      contentType: 'notes',
      content: receipt.notes,
      metadata: {
        receipt_date: receipt.date,
        total: receipt.total
      },
      model
    }, supabaseClient);
    results.push(notesResult);
  }

  // If no content was processable, use a combination of available fields as fallback
  if (!contentProcessed) {
    console.log(`No standard fields available for embedding on receipt ${receiptId}, using fallback`);

    // Build a composite text from whatever data is available
    const fallbackText = [
      receipt.merchant ? `Merchant: ${receipt.merchant}` : '',
      receipt.date ? `Date: ${receipt.date}` : '',
      receipt.total ? `Total: ${receipt.total}` : '',
      receipt.currency ? `Currency: ${receipt.currency}` : '',
      receipt.predicted_category ? `Category: ${receipt.predicted_category}` : '',
    ].filter(Boolean).join('\n');

    if (fallbackText.trim()) {
      const fallbackResult = await processReceiptEmbedding({
        receiptId,
        contentType: 'fallback',
        content: fallbackText,
        metadata: {
          receipt_date: receipt.date,
          total: receipt.total,
          is_fallback: true
        },
        model
      }, supabaseClient);
      results.push(fallbackResult);
    } else {
      throw new Error(`Receipt ${receiptId} has no embeddable content`);
    }
  }

  return {
    success: true,
    receiptId,
    results
  };
}

/**
 * Generate embeddings for all line items in a receipt
 */
async function generateLineItemEmbeddings(supabaseClient: any, receiptId: string, model?: string, forceRegenerate: boolean = false) {
  // Log the forceRegenerate flag for debugging
  console.log(`Edge fn: Generating line items for receipt ${receiptId}, forceRegenerate: ${forceRegenerate}`);

  let lineItemsToProcess: {id: string, description: string, amount: number}[] = [];

  if (forceRegenerate) {
    // Fetch all line items for the receipt
    console.log(`Edge fn: Fetching ALL line items for receipt ${receiptId}`);
    const { data, error } = await supabaseClient
      .from('line_items')
      .select('id, description, amount')
      .eq('receipt_id', receiptId)
      .not('description', 'is', null); // Exclude items with no description upfront

    if (error) throw new Error(`Error fetching all line items: ${error.message}`);
    lineItemsToProcess = data || [];
  } else {
    // Fetch only line items WITHOUT existing embeddings using the RPC function
    console.log(`Edge fn: Fetching line items WITHOUT embeddings for receipt ${receiptId}`);
    const { data, error } = await supabaseClient
      .rpc('get_line_items_without_embeddings_for_receipt', { p_receipt_id: receiptId });

    if (error) throw new Error(`Error fetching line items without embeddings via RPC: ${error.message}`);
    lineItemsToProcess = data || [];
  }

  // Early exit if no items need processing
  if (!lineItemsToProcess || lineItemsToProcess.length === 0) {
    console.log(`Edge fn: No line items need processing for receipt ${receiptId}`);
    return {
      success: true,
      receiptId,
      lineItems: [],
      count: 0
    };
  }

  console.log(`Edge fn: Found ${lineItemsToProcess.length} line items to process for receipt ${receiptId}`);

  // *** Start: Parallel Processing Logic ***
  console.log(`Edge fn: Starting parallel processing for ${lineItemsToProcess.length} line items.`);

  const processingPromises = lineItemsToProcess.map(lineItem => {
    return processLineItemEmbedding({
      lineItemId: lineItem.id,
      receiptId,
      content: lineItem.description,
      metadata: { amount: lineItem.amount },
      model
    }, supabaseClient)
    .then(result => ({ status: 'fulfilled', value: result }))
    .catch(error => {
      // Log error but allow others to continue
      console.error(`Edge fn: Error processing line item ${lineItem.id} in parallel:`, error.message || error);
      return {
        status: 'rejected',
        reason: error.message || String(error),
        lineItemId: lineItem.id
      };
    });
  });

  // Wait for all promises to complete (success or failure)
  const settledResults = await Promise.all(processingPromises);

  // Collect successful results
  const successfulResults = settledResults
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  const failedCount = settledResults.length - successfulResults.length;

  console.log(`Edge fn: Finished parallel processing for receipt ${receiptId}. Successful: ${successfulResults.length}, Failed: ${failedCount}`);
  // *** End: Parallel Processing Logic ***

  // Return summary result
  return {
    success: true,
    receiptId,
    lineItems: successfulResults,
    count: successfulResults.length,
    failedCount: failedCount,
    totalProcessed: settledResults.length
  };
}

serve(async (req) => {
  // Log request details for debugging
  console.log('Request received:', {
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
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseServiceKey ?? ''
    );

    // Check if environment variables are set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing Supabase credentials'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      let requestBody;
      try {
        requestBody = await req.json();
        console.log('Received POST body for generate-embeddings:', JSON.stringify(requestBody));
      } catch (jsonError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const {
        receiptId,
        contentType,
        content,
        metadata,
        model,
        processAllFields,
        lineItemId,
        processLineItems,
        forceRegenerate = false // Add support for forced regeneration
      } = requestBody;

      console.log('Parsed generate-embeddings parameters:', {
        receiptId,
        processLineItems,
        forceRegenerate,
        lineItemId,
        processAllFields,
        contentType,
        hasContent: !!content
      });

      // Log the incoming request parameters (excluding any sensitive data)
      console.log('Received embedding request:', {
        receiptId,
        contentType,
        processAllFields,
        lineItemId,
        processLineItems,
        hasContent: !!content,
        hasMetadata: !!metadata
      });

      // Process line items for a receipt
      if (processLineItems && receiptId) {
        try {
          // Pass the forceRegenerate flag to the function
          const result = await generateLineItemEmbeddings(supabaseClient, receiptId, model, forceRegenerate);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error generating line item embeddings for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // Process a single line item
      else if (lineItemId && receiptId && content) {
        try {
          const result = await processLineItemEmbedding({
            lineItemId,
            receiptId,
            content,
            metadata,
            model
          }, supabaseClient);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error processing single line item embedding for ${lineItemId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              lineItemId,
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // If processAllFields is true, generate embeddings for all fields
      else if (processAllFields && receiptId) {
        try {
          const result = await generateReceiptEmbeddings(supabaseClient, receiptId, model);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error generating embeddings for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // Process a single embedding
      else if (receiptId && contentType && content) {
        try {
          const result = await processReceiptEmbedding({
            receiptId,
            contentType,
            content,
            metadata,
            model
          }, supabaseClient);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error processing single embedding for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId,
              contentType
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Handle GET request to check embedding status
    else if (req.method === 'GET') {
      const url = new URL(req.url);
      const receiptId = url.searchParams.get('receiptId');

      if (!receiptId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing receiptId parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Get all embeddings for the receipt
        const { data: embeddings, error } = await supabaseClient
          .from('receipt_embeddings')
          .select('id, content_type, created_at')
          .eq('receipt_id', receiptId);

        if (error) {
          throw new Error(`Error fetching embeddings: ${error.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            receiptId,
            count: embeddings ? embeddings.length : 0,
            embeddings
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error(`Error checking embeddings for receipt ${receiptId}:`, error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            receiptId
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Method ${req.method} not allowed` }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // Catch any uncaught errors and ensure they return with CORS headers
    console.error('Uncaught error in edge function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
