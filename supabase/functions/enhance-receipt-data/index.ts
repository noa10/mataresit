import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ProcessingLogger } from './shared/db-logger.ts'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Primary function to enhance receipt data using Gemini AI
 */
async function enhanceReceiptData(
  textractData: any,     // The structured data from Textract
  fullText: string,      // The raw text extracted from the receipt
  receiptId: string      // Receipt ID for logging
) {
  const logger = new ProcessingLogger(receiptId);
  
  try {
    await logger.log("Starting Gemini AI processing", "GEMINI");
    
    // Configure the Gemini API client
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      await logger.log("GEMINI_API_KEY not found in environment variables", "ERROR");
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    
    await logger.log("Constructing prompt for Gemini AI", "GEMINI");
    console.log("Constructing prompt for Gemini AI...");
    
    // Construct the prompt
    const prompt = `
You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${fullText}

TEXTRACT EXTRACTED DATA:
${JSON.stringify(textractData, null, 2)}

Based on the receipt text above, please:
1. Identify the CURRENCY used (look for symbols like RM, $, MYR, USD). Default to MYR if ambiguous but likely Malaysian.
2. Identify the PAYMENT METHOD (e.g., VISA, Mastercard, Cash, GrabPay, Touch 'n Go eWallet).
3. Predict a CATEGORY for this expense from the following list: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".
4. Provide SUGGESTIONS for potential OCR errors - look at fields like merchant name, date format, total amount, etc. that might have been incorrectly extracted.

Return your findings in the following JSON format:
{
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "merchant": "The merchant name if you find a better match than Textract",
  "total": "The total amount if you find a better match than Textract",
  "suggestions": {
    "merchant": "A suggested correction for merchant name if OCR made errors",
    "date": "A suggested date correction in YYYY-MM-DD format if needed",
    "total": "A suggested total amount correction if needed",
    "tax": "A suggested tax amount correction if needed"
  },
  "confidence": {
    "currency": "Confidence score 0-100 for currency",
    "payment_method": "Confidence score 0-100 for payment method",
    "predicted_category": "Confidence score 0-100 for category prediction",
    "suggestions": {
      "merchant": "Confidence score 0-100 for merchant suggestion",
      "date": "Confidence score 0-100 for date suggestion",
      "total": "Confidence score 0-100 for total suggestion",
      "tax": "Confidence score 0-100 for tax suggestion"
    }
  }
}`;
    
    // Prepare payload
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    };
    
    // Call Gemini API
    await logger.log("Calling Gemini API", "GEMINI");
    console.log("Calling Gemini API...");
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      await logger.log(`Gemini API error: ${response.status} ${response.statusText}`, "ERROR");
      throw new Error(`Failed to process with Gemini API: ${response.status} ${response.statusText}`);
    }
    
    const geminiResponse = await response.json();
    await logger.log("Received response from Gemini API", "GEMINI");
    console.log("Received response from Gemini API");
    
    // Parse the response
    try {
      // Extract the text content from Gemini response
      const responseText = geminiResponse.candidates[0].content.parts[0].text;
      await logger.log("Parsing Gemini response", "GEMINI");
      
      // Extract JSON from the response (handle case where other text might be included)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : null;
      
      if (!jsonStr) {
        console.error('No valid JSON found in Gemini response');
        await logger.log("No valid JSON found in Gemini response", "ERROR");
        return {};
      }
      
      // Parse the JSON data
      const enhancedData = JSON.parse(jsonStr);
      
      // Set default MYR currency if not found by Gemini
      if (!enhancedData.currency) {
        enhancedData.currency = 'MYR';
        if (!enhancedData.confidence) enhancedData.confidence = {};
        enhancedData.confidence.currency = 50; // medium confidence for default
        await logger.log("Using default currency: MYR", "GEMINI");
      } else {
        await logger.log(`Detected currency: ${enhancedData.currency}`, "GEMINI");
      }
      
      // Log payment method if detected
      if (enhancedData.payment_method) {
        await logger.log(`Detected payment method: ${enhancedData.payment_method}`, "GEMINI");
      }
      
      // Log category if detected
      if (enhancedData.predicted_category) {
        await logger.log(`Predicted category: ${enhancedData.predicted_category}`, "GEMINI");
      }
      
      // Log suggestions if any
      if (enhancedData.suggestions) {
        const suggestionFields = Object.keys(enhancedData.suggestions);
        if (suggestionFields.length > 0) {
          await logger.log(`Found ${suggestionFields.length} suggestion(s) for: ${suggestionFields.join(', ')}`, "GEMINI");
        }
      }
      
      await logger.log("Gemini AI processing complete", "GEMINI");
      return enhancedData;
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      await logger.log(`Error parsing Gemini response: ${error.message}`, "ERROR");
      return {};
    }
  } catch (error) {
    console.error("Error in enhanceReceiptData:", error);
    await logger.log(`Error in Gemini enhancement: ${error.message}`, "ERROR");
    return {}; // Return empty object on error to avoid breaking the flow
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  try {
    console.log("Received request to enhance receipt data");
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const requestData = await req.json();
    console.log("Request data received:", JSON.stringify({
      hasTextractData: !!requestData.textractData,
      hasFullText: !!requestData.fullText,
    }));
    
    // Extract and validate required parameters
    const { textractData, fullText, receiptId } = requestData;
    
    if (!textractData) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: textractData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!fullText) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: fullText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the receipt data with Gemini AI
    const enhancedData = await enhanceReceiptData(textractData, fullText, receiptId);
    console.log("Data enhancement complete:", enhancedData);
    
    // Return the enhanced data
    return new Response(
      JSON.stringify({
        success: true,
        result: enhancedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enhance-receipt-data function:', error);
    
    // Try to log the error if possible
    try {
      const { receiptId } = await req.json();
      if (receiptId) {
        const logger = new ProcessingLogger(receiptId);
        await logger.log(`Server error: ${error.message}`, "ERROR");
      }
    } catch (logError) {
      // Ignore errors during error logging
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 