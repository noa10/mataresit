/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ProcessingLogger } from '../_shared/db-logger.ts'
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
  provider: 'gemini' | 'openrouter';
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
  // Google Gemini Models
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true
  },
  'gemini-2.5-flash-preview-05-20': {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-preview-05-20:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true
  },

  // OpenRouter Free Models
  'openrouter/google/gemini-2.0-flash-exp:free': {
    id: 'openrouter/google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Experimental',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true
  },
  'openrouter/meta-llama/llama-4-maverick:free': {
    id: 'openrouter/meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true
  },

  'openrouter/moonshotai/kimi-vl-a3b-thinking:free': {
    id: 'openrouter/moonshotai/kimi-vl-a3b-thinking:free',
    name: 'Kimi VL A3B Thinking',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
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
  // Log the requested model ID for debugging
  await logger.log(`Requested model ID: ${modelId}`, "AI");

  // Check if the requested model exists
  if (modelId && !AVAILABLE_MODELS[modelId]) {
    await logger.log(`Model ${modelId} not found in AVAILABLE_MODELS. Available models: ${Object.keys(AVAILABLE_MODELS).join(', ')}`, "ERROR");
    throw new Error(`Model ${modelId} is not available in this edge function`);
  }

  // Get the model config or use default if not found
  const modelConfig = AVAILABLE_MODELS[modelId] ||
    AVAILABLE_MODELS[input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL];

  await logger.log(`Using ${modelConfig.name} (${modelConfig.id}) for analysis`, "AI");

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

  // Handle model-specific API calls based on provider
  switch (modelConfig.provider) {
    case 'gemini':
      return await callGeminiAPI(input, modelConfig, apiKey, logger);
    case 'openrouter':
      return await callOpenRouterAPI(input, modelConfig, apiKey, logger);
    default:
      await logger.log(`Unsupported model provider: ${modelConfig.provider}`, "ERROR");
      throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
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
  console.log(`🔍 GEMINI API CALL DEBUG:`);
  console.log(`🔍 Model: ${modelConfig.id}`);
  console.log(`🔍 Endpoint: ${modelConfig.endpoint}`);
  console.log(`🔍 Payload contents:`, {
    model: payload.model,
    generationConfig: payload.generationConfig,
    contents_length: payload.contents?.length,
    contents_parts: payload.contents?.[0]?.parts?.map(part => ({
      text_length: part.text?.length,
      inline_data_mime_type: part.inline_data?.mime_type
    }))
  });

  await logger.log("Calling Gemini API", "AI");
  const geminiCallStart = Date.now();
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
  const geminiCallEnd = Date.now();
  const geminiCallDuration = (geminiCallEnd - geminiCallStart) / 1000;

  console.log(`🔍 Gemini API call completed in ${geminiCallDuration.toFixed(2)} seconds`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    await logger.log(`Gemini API error: ${response.status} ${response.statusText}`, "ERROR");

    // If we get a 429 rate limit error, suggest using a different model
    if (response.status === 429) {
      await logger.log("Rate limit detected - consider using gemini-2.0-flash-lite for better reliability", "ERROR");
    }

    throw new Error(`Failed to process with Gemini API: ${response.status} ${response.statusText}`);
  }

  const geminiResponse = await response.json();
  console.log(`🔍 Gemini API response received:`, {
    candidates_length: geminiResponse.candidates?.length,
    first_candidate_content: geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 200) + '...'
  });
  await logger.log("Received response from Gemini API", "AI");

  // Parse the response
  try {
    // Extract the text content from Gemini response
    const responseText = geminiResponse.candidates[0].content.parts[0].text;
    console.log(`🔍 Full Gemini response text:`, responseText);
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
 * Call OpenRouter API for text or vision processing
 */
async function callOpenRouterAPI(
  input: AIModelInput,
  modelConfig: ModelConfig,
  apiKey: string,
  logger: ProcessingLogger
): Promise<any> {
  await logger.log("Constructing prompt for OpenRouter API", "AI");

  // Extract model name from OpenRouter model ID
  const modelName = modelConfig.id.replace(/^openrouter\//, '');

  // Prepare messages based on input type
  let messages: any[];

  if (input.type === 'text') {
    // Text-based processing
    const prompt = `You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

TEXTRACT EXTRACTED DATA:
${JSON.stringify(input.textractData, null, 2)}

Based on the receipt text above, please:
1. Identify the CURRENCY used (look for symbols like RM, $, MYR, USD). Default to MYR if ambiguous but likely Malaysian.
2. Identify the PAYMENT METHOD (e.g., VISA, Mastercard, Cash, GrabPay, Touch 'n Go eWallet).
3. Predict a CATEGORY for this expense from the following list: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".
4. Provide SUGGESTIONS for potential OCR errors.

Return your findings in JSON format:
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
    "predicted_category": "Confidence score 0-100 for category prediction"
  }
}`;

    messages = [
      { role: "user", content: prompt }
    ];
  } else {
    // Vision-based processing
    if (!modelConfig.supportsVision) {
      await logger.log(`Model ${modelConfig.name} does not support vision input`, "ERROR");
      throw new Error(`Model ${modelConfig.name} does not support vision input`);
    }

    const imageBase64 = encodeBase64(input.imageData.data);
    const dataUrl = `data:${input.imageData.mimeType};base64,${imageBase64}`;

    messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an AI assistant specialized in analyzing receipt images.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name)
2. DATE of purchase (in YYYY-MM-DD format)
3. TOTAL amount
4. TAX amount (if present)
5. LINE ITEMS (product/service name and price for each item)
6. CURRENCY used (look for symbols like RM, $, MYR, USD). Default to MYR if ambiguous.
7. PAYMENT METHOD (e.g., VISA, Mastercard, Cash, GrabPay, Touch 'n Go eWallet).
8. Predict a CATEGORY for this expense from: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".

Return your findings in JSON format:
{
  "merchant": "The merchant name",
  "date": "The date in YYYY-MM-DD format",
  "total": "The total amount as a number",
  "tax": "The tax amount as a number",
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "line_items": [
    { "description": "Item 1 description", "amount": "Item 1 price as a number" }
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
            type: "image_url",
            image_url: {
              url: dataUrl,
              detail: "high"
            }
          }
        ]
      }
    ];
  }

  const payload = {
    model: modelName,
    messages: messages,
    temperature: modelConfig.temperature,
    max_tokens: modelConfig.maxTokens,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  };

  // Call OpenRouter API
  await logger.log(`Calling OpenRouter API with model: ${modelName}`, "AI");
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://paperless-maverick.vercel.app',
      'X-Title': 'Paperless Maverick Receipt Processing'
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter API error:', errorText);
    await logger.log(`OpenRouter API error: ${response.status} ${response.statusText}`, "ERROR");
    throw new Error(`Failed to process with OpenRouter API: ${response.status} ${response.statusText}`);
  }

  const openRouterResponse = await response.json();
  await logger.log("Received response from OpenRouter API", "AI");

  // Parse the response
  try {
    // Extract the text content from OpenRouter response
    const responseText = openRouterResponse.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No content in OpenRouter response');
    }

    await logger.log("Parsing OpenRouter response", "AI");

    // Extract JSON from the response (handle case where other text might be included)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : null;

    if (!jsonStr) {
      console.error('No valid JSON found in OpenRouter response');
      await logger.log("No valid JSON found in OpenRouter response", "ERROR");
      return {};
    }

    // Parse the JSON data
    const enhancedData = JSON.parse(jsonStr);

    // Set default MYR currency if not found
    if (!enhancedData.currency) {
      enhancedData.currency = 'MYR';
      if (!enhancedData.confidence) enhancedData.confidence = {};
      enhancedData.confidence.currency = 50; // medium confidence for default
      await logger.log("Using default currency: MYR", "AI");
    } else {
      await logger.log(`Detected currency: ${enhancedData.currency}`, "AI");
    }

    await logger.log("OpenRouter AI processing complete", "AI");
    return enhancedData;
  } catch (error) {
    console.error('Error parsing OpenRouter response:', error);
    await logger.log(`Error parsing OpenRouter response: ${error.message}`, "ERROR");
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
    const enhanceStartTime = Date.now();
    console.log(`🔍 ENHANCE-RECEIPT-DATA DEBUG - Starting processing at ${new Date().toISOString()}`);
    console.log(`🔍 Receipt ID: ${receiptId}`);
    console.log(`🔍 Input type: ${input.type}`);
    console.log(`🔍 Model ID requested: ${modelId}`);

    await logger.log(`Starting ${modelId || 'AI'} processing`, "AI");

    // Use the specified model or default based on input type
    const modelToUse = modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL);
    console.log(`🔍 Model to use: ${modelToUse}`);
    await logger.log(`Using model: ${modelToUse}`, "AI");

    // Call the appropriate AI model
    console.log(`🔍 Calling AI model: ${modelToUse}`);
    const aiCallStartTime = Date.now();
    const enhancedData = await callAIModel(input, modelToUse, receiptId, logger);
    const aiCallEndTime = Date.now();
    const aiCallDuration = (aiCallEndTime - aiCallStartTime) / 1000;

    console.log(`🔍 AI model call completed in ${aiCallDuration.toFixed(2)} seconds`);
    console.log(`🔍 Enhanced data result:`, {
      merchant: enhancedData.merchant,
      total: enhancedData.total,
      line_items_count: enhancedData.line_items?.length || 0,
      line_items: enhancedData.line_items,
      confidence: enhancedData.confidence
    });

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