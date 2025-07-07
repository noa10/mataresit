import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BatchRequest {
  batchSize?: number;
  maxBatches?: number;
  forceRegenerate?: boolean;
}

interface LineItemData {
  line_item_id: string;
  receipt_id: string;
  description: string;
  amount: number;
  merchant: string;
  receipt_date: string;
  user_id: string;
}

/**
 * Generate embeddings using Google's Gemini embedding model
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.warn('Empty or invalid text provided for embedding generation');
    return new Array(1536).fill(0);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: text.trim() }]
          },
          outputDimensionality: 1536
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.embedding?.values) {
      throw new Error('Invalid response format from Google API');
    }

    return data.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Process a single line item and generate its embedding
 */
async function processLineItem(
  supabase: any,
  lineItem: LineItemData
): Promise<{ success: boolean; lineItemId: string; error?: string }> {
  try {
    console.log(`Processing line item: ${lineItem.line_item_id} - "${lineItem.description}"`);

    // Generate embedding for the line item description
    const embedding = await generateEmbedding(lineItem.description);

    // Store in unified_embeddings table using the RPC function
    const { error } = await supabase.rpc('add_unified_embedding', {
      p_source_type: 'receipt',
      p_source_id: lineItem.receipt_id,
      p_content_type: 'line_item',
      p_content_text: lineItem.description,
      p_embedding: embedding,
      p_metadata: {
        line_item_id: lineItem.line_item_id,
        amount: lineItem.amount,
        receipt_date: lineItem.receipt_date,
        merchant: lineItem.merchant,
        source_metadata: 'line_item'
      },
      p_user_id: lineItem.user_id,
      p_language: 'en'
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`✅ Successfully processed line item: ${lineItem.line_item_id}`);
    return { success: true, lineItemId: lineItem.line_item_id };

  } catch (error) {
    console.error(`❌ Error processing line item ${lineItem.line_item_id}:`, error);
    return { 
      success: false, 
      lineItemId: lineItem.line_item_id, 
      error: error.message || String(error) 
    };
  }
}

/**
 * Process a batch of line items concurrently
 */
async function processBatch(
  supabase: any,
  lineItems: LineItemData[]
): Promise<{ successful: number; failed: number; errors: string[] }> {
  console.log(`Processing batch of ${lineItems.length} line items...`);

  const results = await Promise.allSettled(
    lineItems.map(lineItem => processLineItem(supabase, lineItem))
  );

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successful++;
      } else {
        failed++;
        errors.push(`Line item ${result.value.lineItemId}: ${result.value.error}`);
      }
    } else {
      failed++;
      errors.push(`Line item ${lineItems[index].line_item_id}: ${result.reason}`);
    }
  });

  console.log(`Batch complete: ${successful} successful, ${failed} failed`);
  return { successful, failed, errors };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    // Parse request body
    const { batchSize = 10, maxBatches = 10, forceRegenerate = false }: BatchRequest = 
      req.method === 'POST' ? await req.json() : {};

    console.log(`Starting batch line item embedding generation: batchSize=${batchSize}, maxBatches=${maxBatches}, forceRegenerate=${forceRegenerate}`);

    // Get line items that need embeddings
    const { data: lineItems, error: fetchError } = await supabase
      .rpc('find_line_items_missing_embeddings', { limit_count: batchSize * maxBatches });

    if (fetchError) {
      throw new Error(`Error fetching line items: ${fetchError.message}`);
    }

    if (!lineItems || lineItems.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No line items need embedding generation',
        processed: 0,
        failed: 0,
        totalBatches: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${lineItems.length} line items that need embeddings`);

    // Process in batches
    let totalSuccessful = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    let batchCount = 0;

    for (let i = 0; i < lineItems.length && batchCount < maxBatches; i += batchSize) {
      const batch = lineItems.slice(i, i + batchSize);
      batchCount++;

      console.log(`Processing batch ${batchCount}/${Math.min(maxBatches, Math.ceil(lineItems.length / batchSize))}`);

      const batchResult = await processBatch(supabase, batch);
      
      totalSuccessful += batchResult.successful;
      totalFailed += batchResult.failed;
      allErrors.push(...batchResult.errors);

      // Add a small delay between batches to avoid overwhelming the API
      if (i + batchSize < lineItems.length && batchCount < maxBatches) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const response = {
      success: true,
      message: `Batch processing complete`,
      processed: totalSuccessful,
      failed: totalFailed,
      totalBatches: batchCount,
      remainingItems: Math.max(0, lineItems.length - (batchCount * batchSize)),
      errors: allErrors.slice(0, 10) // Limit errors in response
    };

    console.log('Batch processing summary:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
