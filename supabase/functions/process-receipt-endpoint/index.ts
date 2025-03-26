
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create a Supabase client with the user's JWT
    const supabase = supabaseClient(authHeader);
    
    // Parse request body
    const requestData = await req.json();
    
    // Extract and validate required parameters
    const { receiptId } = requestData;
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the receipt from the database
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();
      
    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ error: 'Receipt not found', details: receiptError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if image URL exists
    if (!receipt.image_url) {
      return new Response(
        JSON.stringify({ error: 'Receipt has no associated image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Call the process-receipt function (internal Edge Function)
    const processResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-receipt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          imageUrl: receipt.image_url,
          receiptId: receiptId,
        }),
      }
    );
    
    if (!processResponse.ok) {
      const errorData = await processResponse.json();
      throw new Error(`Processing failed: ${errorData.error || 'Unknown error'}`);
    }
    
    const processResult = await processResponse.json();
    
    // Extract data from OCR result
    const ocrData = processResult.data;
    
    // Create line items from extracted data
    const lineItems = ocrData.lineItems.items.map((item) => ({
      description: item.description,
      amount: item.amount,
      receipt_id: receiptId,
    }));
    
    // Calculate confidence scores
    const confidenceScore = {
      receipt_id: receiptId,
      merchant: ocrData.merchant.confidence,
      date: ocrData.date.confidence,
      total: ocrData.total.confidence,
      tax: ocrData.tax ? ocrData.tax.confidence : null,
      line_items: ocrData.lineItems.confidence,
    };
    
    // Update receipt with extracted data
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        merchant: ocrData.merchant.value,
        date: ocrData.date.value,
        total: ocrData.total.value,
        tax: ocrData.tax ? ocrData.tax.value : null,
        status: 'unreviewed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId);
      
    if (updateError) {
      throw new Error(`Failed to update receipt: ${updateError.message}`);
    }
    
    // Insert line items
    if (lineItems.length > 0) {
      const { error: lineItemsError } = await supabase
        .from('line_items')
        .upsert(lineItems);
        
      if (lineItemsError) {
        console.error("Error inserting line items:", lineItemsError);
      }
    }
    
    // Insert or update confidence scores
    const { error: confidenceError } = await supabase
      .from('confidence_scores')
      .upsert(confidenceScore);
      
    if (confidenceError) {
      console.error("Error inserting confidence scores:", confidenceError);
    }
    
    // Return success response with extracted data
    return new Response(
      JSON.stringify({
        success: true,
        receipt: {
          id: receiptId,
          merchant: ocrData.merchant.value,
          date: ocrData.date.value,
          total: ocrData.total.value,
          tax: ocrData.tax ? ocrData.tax.value : null,
        },
        lineItems: lineItems,
        confidence: confidenceScore,
        fullText: ocrData.fullText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-receipt-endpoint function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
