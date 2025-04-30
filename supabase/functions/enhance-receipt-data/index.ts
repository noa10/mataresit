/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ProcessingLogger } from './shared/db-logger.ts'
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Model configuration interface for AI models
 */
interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKeyEnvVar: string;
  temperature: number;
  maxTokens: number;
  supportsText: boolean;  // Indicates if the model can process text input
  supportsVision: boolean; // Indicates if the model can process image input
}

/**
 * Registry of available AI models
 */
const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.1,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true
  }
};

const DEFAULT_TEXT_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_VISION_MODEL = 'gemini-2.0-flash-lite';

/**
 * Types for input to AI models
 */
interface TextInput {
  type: 'text';
  textractData: any;
  fullText: string;
}

interface ImageInput {
  type: 'image';
  imageData: {
    data: Uint8Array;
    mimeType: string;
  };
}

type AIModelInput = TextInput | ImageInput;

/**
 * Call the appropriate AI model based on the model configuration and input type
 */
async function callAIModel(
  input: AIModelInput,
  modelId: string,
  receiptId: string,
  logger: ProcessingLogger
): Promise<any> {
  // Get the model config or use default if not found
  const modelConfig = AVAILABLE_MODELS[modelId] || 
    AVAILABLE_MODELS[input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL];
  
  await logger.log(`Using ${modelConfig.name} for analysis`, "AI");
  
  // Validate input type is supported by the model
  if (input.type === 'image' && !modelConfig.supportsVision) {
    await logger.log(`Model ${modelConfig.id} does not support vision input`, "ERROR");
    throw new Error(`Model ${modelConfig.id} does not support vision input`);
  }
  
  // Get API key for the model
  const apiKey = Deno.env.get(modelConfig.apiKeyEnvVar);
  if (!apiKey) {
    await logger.log(`${modelConfig.apiKeyEnvVar} not found in environment variables. Please ensure this secret is set in the Supabase dashboard.`, "ERROR");
    return new Response(JSON.stringify({ error: `${modelConfig.apiKeyEnvVar} not found in environment variables` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  // Handle model-specific API calls
  if (modelConfig.id.startsWith('gemini')) {
    return await callGeminiAPI(input, modelConfig, apiKey, logger);
  } else if (modelConfig.id.startsWith('claude')) {
    return await callClaudeAPI(input, modelConfig, apiKey, logger);
  } else {
    throw new Error(`Unsupported model: ${modelConfig.id}`);
  }
}

/**
 * Call Gemini API for text or vision processing
 */
async function callGeminiAPI(
  input: AIModelInput, 
  modelConfig: ModelConfig, 
  apiKey: string,
  logger: ProcessingLogger
): Promise<any> {
  await logger.log("Constructing prompt for Gemini AI", "AI");
  
  // Construct the payload based on input type
  let payload: any;
  
  if (input.type === 'text') {
    // Text-based prompt for OCR data
    const prompt = `
You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

TEXTRACT EXTRACTED DATA:
${JSON.stringify(input.textractData, null, 2)}

Based on the receipt text above, please:
1. Identify the CURRENCY used (look for symbols like RM, $, MYR, USD). Default to MYR if ambiguous but likely Malaysian.
2. Identify the PAYMENT METHOD (e.g., VISA, Mastercard, Cash, GrabPay, Touch 'n Go eWallet, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD, CASH).
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
    
    payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
  } else {
    // Vision-based prompt for direct image analysis
    payload = {
      contents: [{
        parts: [
          {
            text: `You are an AI assistant specialized in analyzing receipt images.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name)
2. DATE of purchase (in YYYY-MM-DD format)
3. TOTAL amount
4. TAX amount (if present)
5. LINE ITEMS (product/service name and price for each item)
6. CURRENCY used (look for symbols like RM, $, MYR, USD). Default to MYR if ambiguous.
7. PAYMENT METHOD (e.g., VISA, Mastercard, Cash, GrabPay, Touch 'n Go eWallet, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD, CASH).
8. Predict a CATEGORY for this expense from: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".

Return your findings in the following JSON format:
{
  "merchant": "The merchant name",
  "date": "The date in YYYY-MM-DD format",
  "total": "The total amount as a number",
  "tax": "The tax amount as a number",
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "line_items": [
    { "description": "Item 1 description", "amount": "Item 1 price as a number" },
    { "description": "Item 2 description", "amount": "Item 2 price as a number" }
  ],
  "confidence": {
    "merchant": "Confidence score 0-100",
    "date": "Confidence score 0-100",
    "total": "Confidence score 0-100",
    "tax": "Confidence score 0-100",
    "currency": "Confidence score 0-100",
    "payment_method": "Confidence score 0-100",
    "predicted_category": "Confidence score 0-100",
    "line_items": "Confidence score 0-100"
  }
}`
          },
          {
            inlineData: {
              mimeType: input.imageData.mimeType,
              data: encodeBase64(input.imageData.data)
            }
          }
        ]
      }]
    };
  }
  
  // Add generation config
  payload.generationConfig = {
    temperature: modelConfig.temperature,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: modelConfig.maxTokens,
  };
  
  // Call Gemini API
  await logger.log("Calling Gemini API", "AI");
  const response = await fetch(
    `${modelConfig.endpoint}?key=${apiKey}`,
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
  await logger.log("Received response from Gemini API", "AI");
  
  // Parse the response
  try {
    // Extract the text content from Gemini response
    const responseText = geminiResponse.candidates[0].content.parts[0].text;
    await logger.log("Parsing Gemini response", "AI");
    
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
      await logger.log("Using default currency: MYR", "AI");
    } else {
      await logger.log(`Detected currency: ${enhancedData.currency}`, "AI");
    }
    
    await logger.log("AI processing complete", "AI");
    return enhancedData;
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    await logger.log(`Error parsing Gemini response: ${error.message}`, "ERROR");
    return {};
  }
}

/**
 * Call Claude API for text or vision processing
 */
async function callClaudeAPI(
  input: AIModelInput, 
  modelConfig: ModelConfig, 
  apiKey: string,
  logger: ProcessingLogger
): Promise<any> {
  await logger.log("Constructing prompt for Claude AI", "AI");
  
  // Validate input type (Claude currently only supports text)
  if (input.type === 'image') {
    await logger.log("Claude API does not support vision input yet", "ERROR");
    throw new Error("Claude API does not support vision input yet");
  }
  
  // Construct the payload for Claude
  const prompt = `
You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

TEXTRACT EXTRACTED DATA:
${JSON.stringify(input.textractData, null, 2)}

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
  
  const payload = {
    model: "claude-3-5-sonnet-20240620",
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: modelConfig.temperature,
    max_tokens: modelConfig.maxTokens,
  };
  
  // Call Claude API
  await logger.log("Calling Claude API", "AI");
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', errorText);
    await logger.log(`Claude API error: ${response.status} ${response.statusText}`, "ERROR");
    throw new Error(`Failed to process with Claude API: ${response.status} ${response.statusText}`);
  }
  
  const claudeResponse = await response.json();
  await logger.log("Received response from Claude API", "AI");
  
  // Parse the response
  try {
    // Extract the text content from Claude response
    const responseText = claudeResponse.content[0].text;
    await logger.log("Parsing Claude response", "AI");
    
    // Extract JSON from the response (handle case where other text might be included)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : null;
    
    if (!jsonStr) {
      console.error('No valid JSON found in Claude response');
      await logger.log("No valid JSON found in Claude response", "ERROR");
      return {};
    }
    
    // Parse the JSON data
    const enhancedData = JSON.parse(jsonStr);
    
    // Set default MYR currency if not found by Claude
    if (!enhancedData.currency) {
      enhancedData.currency = 'MYR';
      if (!enhancedData.confidence) enhancedData.confidence = {};
      enhancedData.confidence.currency = 50; // medium confidence for default
      await logger.log("Using default currency: MYR", "AI");
    } else {
      await logger.log(`Detected currency: ${enhancedData.currency}`, "AI");
    }
    
    await logger.log("AI processing complete", "AI");
    return enhancedData;
  } catch (error) {
    console.error('Error parsing Claude response:', error);
    await logger.log(`Error parsing Claude response: ${error.message}`, "ERROR");
    return {};
  }
}

/**
 * Primary function to enhance receipt data using selected AI model
 */
async function enhanceReceiptData(
  input: AIModelInput,
  modelId: string,
  receiptId: string
) {
  const logger = new ProcessingLogger(receiptId);
  
  try {
    await logger.log(`Starting ${modelId || 'AI'} processing`, "AI");
    
    // Use the specified model or default based on input type
    const modelToUse = modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL);
    await logger.log(`Using model: ${modelToUse}`, "AI");
    
    // Call the appropriate AI model
    const enhancedData = await callAIModel(input, modelToUse, receiptId, logger);
    
    // Log results
    if (enhancedData.payment_method) {
      await logger.log(`Detected payment method: ${enhancedData.payment_method}`, "AI");
    }
    
    if (enhancedData.predicted_category) {
      await logger.log(`Predicted category: ${enhancedData.predicted_category}`, "AI");
    }
    
    if (enhancedData.suggestions) {
      const suggestionFields = Object.keys(enhancedData.suggestions);
      if (suggestionFields.length > 0) {
        await logger.log(`Found ${suggestionFields.length} suggestion(s) for: ${suggestionFields.join(', ')}`, "AI");
      }
    }
    
    await logger.log("AI processing complete", "AI");
    return enhancedData;
  } catch (error) {
    console.error("Error in enhanceReceiptData:", error);
    await logger.log(`Error in AI enhancement: ${error.message}`, "ERROR");
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
    
    // Extract and validate required parameters
    const { textractData, fullText, imageData, receiptId, modelId } = requestData;
    
    if (!receiptId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: receiptId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine the input type (text or image)
    let input: AIModelInput;
    
    if (textractData && fullText) {
      input = {
        type: 'text',
        textractData,
        fullText
      };
      console.log("Processing with text input (OCR data)");
    } else if (imageData && imageData.data) {
      input = {
        type: 'image',
        imageData: {
          data: imageData.isBase64 ? decodeBase64(imageData.data) : new Uint8Array(Object.values(imageData.data)),
          mimeType: imageData.mimeType || 'image/jpeg'
        }
      };
      console.log("Processing with image input (direct vision)");
    } else {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: either (textractData + fullText) or imageData must be provided' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the receipt data with AI
    const enhancedData = await enhanceReceiptData(input, modelId, receiptId);
    console.log("Data enhancement complete");
    
    // Return the enhanced data
    return new Response(
      JSON.stringify({
        success: true,
        result: enhancedData,
        model_used: modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL)
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