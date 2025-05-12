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
 * Store embeddings in the database using the new unified model
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
  // For receipt embeddings, the source_id is the receipt_id
  const actualSourceId = sourceId || receiptId;
  
  // Use the new add_embedding function that handles both receipt and line item embeddings
  const { data, error } = await client.rpc(
    'add_embedding',
    {
      p_source_type: sourceType,
      p_source_id: actualSourceId,
      p_receipt_id: receiptId,
      p_content_type: contentType,
      p_embedding: embedding,
      p_metadata: metadata
    }
  );
  
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
async function generateLineItemEmbeddings(supabaseClient: any, receiptId: string, model?: string) {
  // Fetch all line items for the receipt
  const { data: lineItems, error } = await supabaseClient
    .from('line_items')
    .select('id, description, amount')
    .eq('receipt_id', receiptId);
  
  if (error) {
    throw new Error(`Error fetching line items: ${error.message}`);
  }
  
  if (!lineItems || lineItems.length === 0) {
    console.log(`No line items found for receipt ${receiptId}`);
    return {
      success: true,
      receiptId,
      lineItems: [],
      count: 0
    };
  }
  
  console.log(`Processing ${lineItems.length} line items for receipt ${receiptId}`);
  
  const results = [];
  
  // Process each line item
  for (const lineItem of lineItems) {
    // Skip line items without descriptions
    if (!lineItem.description) {
      console.log(`Skipping line item ${lineItem.id} with no description`);
      continue;
    }
    
    try {
      const result = await processLineItemEmbedding({
        lineItemId: lineItem.id,
        receiptId,
        content: lineItem.description,
        metadata: {
          amount: lineItem.amount
        },
        model
      }, supabaseClient);
      
      results.push(result);
    } catch (error) {
      console.error(`Error processing line item ${lineItem.id}:`, error);
      // Continue with other line items even if one fails
    }
  }
  
  return {
    success: true,
    receiptId,
    lineItems: results,
    count: results.length
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
      } catch (jsonError) {
        console.error('Error parsing request JSON:', jsonError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
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
        processLineItems 
      } = requestBody;
      
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
          const result = await generateLineItemEmbeddings(supabaseClient, receiptId, model);
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
