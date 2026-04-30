/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ProcessingLogger } from '../_shared/db-logger.ts'
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import {
  executeWithFallback,
  ProviderRequestError,
  selectImageFallbackCandidates,
} from '../_shared/provider-routing.ts'
import {
  buildTextPrompt,
  buildVisionPrompt,
  AIModelInput,
} from '../_shared/receipt-prompts.ts'
import {
  parseGeminiResponse,
  parseOpenAICompatibleResponse,
  buildDefaultEmptyResponse,
} from '../_shared/ai-response-parsers.ts'

// Initialize Supabase client for tax processing
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-groq-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Model configuration interface for AI models with performance and capability tracking
 */
interface ModelConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'openrouter' | 'groq';
  endpoint: string;
  apiKeyEnvVar: string;
  temperature: number;
  maxTokens: number;
  supportsText: boolean;  // Indicates if the model can process text input
  supportsVision: boolean; // Indicates if the model can process image input
  description?: string;
  pricing?: {
    inputTokens: number;  // Cost per 1M input tokens
    outputTokens: number; // Cost per 1M output tokens
  };
  performance?: {
    speed: 'fast' | 'medium' | 'slow';
    accuracy: 'good' | 'very-good' | 'excellent';
    reliability: number; // 0-1 scale
  };
  capabilities?: {
    maxImageSize: number; // in bytes
    supportedFormats: string[];
    contextWindow: number; // in tokens
  };
}

/**
 * Registry of available AI models
 */
const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // ==========================================
  // Google Gemini Models (Primary - Vision-Capable)
  // ==========================================
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 8192,
    supportsText: true,
    supportsVision: true,
    description: 'Fast, low-cost, high-performance Gemini 2.5 model with reasoning capabilities',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'excellent',
      reliability: 0.97
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1048576
    }
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 8192,
    supportsText: true,
    supportsVision: true,
    description: 'Latest Gemini 2.0 Flash model with enhanced speed and capabilities',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.96
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1048576
    }
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true,
    description: 'Latest fast model with improved efficiency',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.95
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1000000
    }
  },

  // ==========================================
  // Groq Models (Fallback 1 - Vision-Capable)
  // ==========================================
  'groq/meta-llama/llama-4-scout-17b-16e-instruct': {
    id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B 16E Instruct',
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKeyEnvVar: 'GROQ_API_KEY',
    temperature: 0.2,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Meta Llama 4 Scout via Groq chat completions with vision support',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.9
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      contextWindow: 131072
    }
  },

  // ==========================================
  // OpenRouter Free Models (Fallback 2)
  // ==========================================
  'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free': {
    id: 'openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free',
    name: 'Llama Nemotron Embed VL 1B V2',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'NVIDIA Llama Nemotron vision-language model (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'good',
      reliability: 0.85
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
  },
  'openrouter/google/gemma-3-12b-it:free': {
    id: 'openrouter/google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Google Gemma 3 12B vision-language model (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.87
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
  },
  'openrouter/google/gemma-4-26b-a4b-it:free': {
    id: 'openrouter/google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B A4B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Google Gemma 4 26B vision-language model (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.89
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
  }
};

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_VISION_MODEL = 'gemini-2.5-flash-lite';

/**
 * Process Malaysian tax information for a receipt
 */
async function processMalaysianTax(
  merchant: string,
  total: number,
  receiptDate: string,
  aiTaxInfo: any,
  logger: ProcessingLogger
): Promise<any> {
  try {
    await logger.log("Processing Malaysian tax information", "TAX");

    // Get tax information from database
    const { data: taxInfo, error } = await supabase
      .rpc('get_malaysian_tax_info', {
        merchant_name: merchant,
        receipt_date: receiptDate
      });

    if (error) {
      console.error('Error getting Malaysian tax info:', error);
      await logger.log(`Error getting tax info: ${error.message}`, "ERROR");
      return null;
    }

    let finalTaxInfo = taxInfo;

    // If AI provided tax information, use it to enhance or override database detection
    if (aiTaxInfo && aiTaxInfo.tax_type) {
      await logger.log(`AI detected tax type: ${aiTaxInfo.tax_type}`, "TAX");

      // Use AI tax information if it has higher confidence or provides more specific details
      if (aiTaxInfo.tax_rate && aiTaxInfo.tax_amount) {
        finalTaxInfo = {
          tax_type: aiTaxInfo.tax_type,
          tax_rate: parseFloat(aiTaxInfo.tax_rate),
          category_name: aiTaxInfo.business_category || taxInfo?.category_name || 'Unknown',
          confidence_score: 85, // High confidence for AI detection
          is_detected: true
        };
      }
    }

    if (!finalTaxInfo || !finalTaxInfo.is_detected) {
      await logger.log("No Malaysian tax category detected, using exempt", "TAX");
      return {
        detected_tax_type: 'EXEMPT',
        detected_tax_rate: 0.00,
        tax_breakdown: {
          subtotal: total,
          tax_amount: 0.00,
          tax_rate: 0.00,
          total: total,
          is_inclusive: true,
          calculation_method: 'exempt'
        },
        is_tax_inclusive: true,
        malaysian_business_category: 'Unknown'
      };
    }

    // Calculate tax breakdown
    const isInclusive = aiTaxInfo?.is_tax_inclusive !== false; // Default to inclusive
    const { data: taxBreakdown, error: calcError } = await supabase
      .rpc('calculate_malaysian_tax', {
        total_amount: total,
        tax_rate: finalTaxInfo.tax_rate,
        is_inclusive: isInclusive
      });

    if (calcError) {
      console.error('Error calculating tax:', calcError);
      await logger.log(`Error calculating tax: ${calcError.message}`, "ERROR");
      return null;
    }

    await logger.log(`Tax calculation complete: ${finalTaxInfo.tax_type} at ${finalTaxInfo.tax_rate}%`, "TAX");

    return {
      detected_tax_type: finalTaxInfo.tax_type,
      detected_tax_rate: finalTaxInfo.tax_rate,
      tax_breakdown: taxBreakdown,
      is_tax_inclusive: isInclusive,
      malaysian_business_category: finalTaxInfo.category_name
    };

  } catch (error) {
    console.error('Error processing Malaysian tax:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`Error processing tax: ${errorMessage}`, "ERROR");
    return null;
  }
}

/**
 * Log comprehensive model information for debugging and tracking with performance and capability data
 */
async function logModelInfo(
  modelConfig: ModelConfig,
  inputType: 'text' | 'image',
  logger: ProcessingLogger
): Promise<void> {
  try {
    // Log basic model identification
    await logger.log(`🤖 MODEL SELECTED: ${modelConfig.name} (${modelConfig.id})`, "AI");
    await logger.log(`📊 Provider: ${modelConfig.provider.toUpperCase()}`, "AI");

    // Log model description if available
    if (modelConfig.description) {
      await logger.log(`📝 Description: ${modelConfig.description}`, "AI");
    }

    // Log capabilities
    const capabilities: string[] = [];
    if (modelConfig.supportsText) capabilities.push('Text');
    if (modelConfig.supportsVision) capabilities.push('Vision');
    await logger.log(`🔧 Capabilities: ${capabilities.join(', ')}`, "AI");

    // Log input compatibility
    const isCompatible = inputType === 'text' ? modelConfig.supportsText : modelConfig.supportsVision;
    await logger.log(`✅ Input Compatibility: ${inputType} processing ${isCompatible ? 'SUPPORTED' : 'NOT SUPPORTED'}`, "AI");

    // Log configuration settings
    await logger.log(`⚙️ Temperature: ${modelConfig.temperature}, Max Tokens: ${modelConfig.maxTokens}`, "AI");
    await logger.log(`🌐 Endpoint: ${modelConfig.endpoint}`, "AI");
    await logger.log(`🔑 API Key Variable: ${modelConfig.apiKeyEnvVar}`, "AI");

    // Log performance characteristics
    if (modelConfig.performance) {
      const perf = modelConfig.performance;
      await logger.log(`🚀 PERFORMANCE PROFILE:`, "AI");
      await logger.log(`   ⚡ Speed: ${perf.speed.toUpperCase()}`, "AI");
      await logger.log(`   🎯 Accuracy: ${perf.accuracy.toUpperCase()}`, "AI");
      await logger.log(`   🛡️ Reliability: ${(perf.reliability * 100).toFixed(1)}%`, "AI");
    }

    // Log capability specifications
    if (modelConfig.capabilities) {
      const caps = modelConfig.capabilities;
      await logger.log(`🔧 CAPABILITY SPECIFICATIONS:`, "AI");
      await logger.log(`   📏 Max Image Size: ${(caps.maxImageSize / (1024 * 1024)).toFixed(1)}MB`, "AI");
      await logger.log(`   📄 Supported Formats: ${caps.supportedFormats.join(', ')}`, "AI");
      await logger.log(`   🧠 Context Window: ${caps.contextWindow.toLocaleString()} tokens`, "AI");
    }

    // Log pricing information
    if (modelConfig.pricing) {
      const pricing = modelConfig.pricing;
      if (pricing.inputTokens === 0 && pricing.outputTokens === 0) {
        await logger.log(`💰 PRICING: FREE MODEL`, "AI");
      } else {
        await logger.log(`💰 PRICING (per 1M tokens):`, "AI");
        await logger.log(`   📥 Input: $${pricing.inputTokens.toFixed(3)}`, "AI");
        await logger.log(`   📤 Output: $${pricing.outputTokens.toFixed(3)}`, "AI");
      }
    }

    // Log model selection timestamp
    await logger.log(`⏰ Model selected at: ${new Date().toISOString()}`, "AI");

  } catch (error) {
    // Don't let logging errors break the main flow
    console.warn('Error in logModelInfo:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`Warning: Error logging model info: ${errorMessage}`, "WARNING");
  }
}

/**
 * Call the appropriate AI model based on the model configuration and input type
 */
async function callAIModel(
  input: AIModelInput,
  modelId: string,
  receiptId: string,
  logger: ProcessingLogger,
  options?: {
    groqApiKeyOverride?: string;
  }
): Promise<{
  result: any;
  modelUsed: string;
  fallbackApplied: boolean;
  fallbackFrom: string | null;
  fallbackReason: string | null;
}> {
  const modelSelectionStart = Date.now();

  // Enhanced model selection logging with timing
  await logger.log(`🎯 MODEL SELECTION STARTED: Receipt ${receiptId}`, "AI");
  await logger.log(`📝 Requested model ID: ${modelId || 'DEFAULT'}`, "AI");
  await logger.log(`📊 Input type: ${input.type}`, "AI");

  let modelConfig: ModelConfig;
  let wasDefaultUsed = false;
  let fallbackReason = '';
  const LEGACY_MODEL_ID_ALIASES: Record<string, string> = {
    'meta-llama/llama-4-scout-17b-16e-instruct': 'groq/meta-llama/llama-4-scout-17b-16e-instruct'
  };
  const requestedModelId = modelId && LEGACY_MODEL_ID_ALIASES[modelId]
    ? LEGACY_MODEL_ID_ALIASES[modelId]
    : modelId;
  if (modelId && requestedModelId !== modelId) {
    await logger.log(`🔄 MODEL ID REMAP: ${modelId} -> ${requestedModelId}`, "AI");
  }

  // Enhanced model validation and fallback logic
  if (requestedModelId && AVAILABLE_MODELS[requestedModelId]) {
    // Requested model exists
    modelConfig = AVAILABLE_MODELS[requestedModelId];
    await logger.log(`✅ Requested model found: ${modelConfig.name}`, "AI");
  } else if (requestedModelId) {
    // Requested model doesn't exist - log detailed error and use fallback
    const availableModels = Object.keys(AVAILABLE_MODELS);
    await logger.log(`❌ Model '${requestedModelId}' not found in registry`, "ERROR");
    await logger.log(`📋 Available models: ${availableModels.join(', ')}`, "ERROR");

    // Use default fallback
    const defaultModelId = input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL;
    modelConfig = AVAILABLE_MODELS[defaultModelId];
    wasDefaultUsed = true;
    fallbackReason = `Model '${requestedModelId}' not found`;

    await logger.log(`🔄 FALLBACK: Using default ${input.type} model: ${modelConfig.name}`, "AI");
  } else {
    // No model specified - use default
    const defaultModelId = input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL;
    modelConfig = AVAILABLE_MODELS[defaultModelId];
    wasDefaultUsed = true;
    fallbackReason = 'No model specified';

    await logger.log(`🔄 DEFAULT: Using default ${input.type} model: ${modelConfig.name}`, "AI");
  }

  // Log model selection timing
  const modelSelectionEnd = Date.now();
  const modelSelectionDuration = (modelSelectionEnd - modelSelectionStart) / 1000;
  await logger.log(`⏱️ Model selection completed in ${modelSelectionDuration.toFixed(3)} seconds`, "AI");

  // Log comprehensive model information
  await logModelInfo(modelConfig, input.type, logger);

  // Log final model selection summary
  if (wasDefaultUsed) {
    await logger.log(`📋 SELECTION SUMMARY: Using ${modelConfig.name} (${fallbackReason})`, "AI");
  } else {
    await logger.log(`📋 SELECTION SUMMARY: Using requested ${modelConfig.name}`, "AI");
  }

  const validateCompatibility = async (config: ModelConfig) => {
    const compatibilityCheckStart = Date.now();
    await logger.log(`🔍 COMPATIBILITY CHECK: Validating ${input.type} input with ${config.name}`, "AI");

    if (input.type === 'text' && !config.supportsText) {
      await logger.log(`❌ COMPATIBILITY ERROR: Model ${config.id} does not support text input`, "ERROR");
      throw new Error(`Model ${config.id} does not support text input`);
    }

    if (input.type === 'image' && !config.supportsVision) {
      await logger.log(`❌ COMPATIBILITY ERROR: Model ${config.id} does not support vision input`, "ERROR");
      throw new Error(`Model ${config.id} does not support vision input`);
    }

    const compatibilityCheckDuration = (Date.now() - compatibilityCheckStart) / 1000;
    await logger.log(`✅ Compatibility check passed in ${compatibilityCheckDuration.toFixed(3)} seconds`, "AI");
  };

  const callProvider = async (config: ModelConfig, apiKey: string): Promise<any> => {
    switch (config.provider) {
      case 'gemini':
        return await callGeminiAPI(input, config, apiKey, logger);
      case 'openrouter':
        return await callOpenRouterAPI(input, config, apiKey, logger);
      case 'groq':
        return await callGroqAPI(input, config, apiKey, logger);
      default:
        throw new Error(`Unsupported model provider: ${config.provider}`);
    }
  };

  const attemptModelCall = async (targetModelId: string): Promise<any> => {
    const targetConfig = AVAILABLE_MODELS[targetModelId];
    if (!targetConfig) {
      throw new Error(`Model ${targetModelId} not found for attempt`);
    }

    await validateCompatibility(targetConfig);

    await logger.log(`🔑 API KEY VALIDATION: Checking ${targetConfig.apiKeyEnvVar}`, "AI");
    const apiKey =
      targetConfig.provider === 'groq' && options?.groqApiKeyOverride
        ? options.groqApiKeyOverride
        : Deno.env.get(targetConfig.apiKeyEnvVar);
    if (!apiKey) {
      await logger.log(`❌ API KEY ERROR: ${targetConfig.apiKeyEnvVar} not found`, "ERROR");
      throw new Error(`${targetConfig.apiKeyEnvVar} not found in environment variables`);
    }
    await logger.log(`✅ API key validated for ${targetConfig.provider.toUpperCase()}`, "AI");

    await logger.log(`🚀 PROVIDER ROUTING: Calling ${targetConfig.provider.toUpperCase()} API`, "AI");
    const providerCallStart = Date.now();

    try {
      const result = await callProvider(targetConfig, apiKey);
      const providerCallDuration = (Date.now() - providerCallStart) / 1000;
      await logger.log(`✅ Provider call completed in ${providerCallDuration.toFixed(2)} seconds`, "AI");
      return result;
    } catch (error) {
      const providerCallDuration = (Date.now() - providerCallStart) / 1000;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.log(
        `❌ Provider call failed after ${providerCallDuration.toFixed(2)} seconds: ${errorMessage}`,
        "ERROR"
      );
      throw error;
    }
  };

  const attemptedModelIds = new Set<string>([modelConfig.id]);
  const fallbackCandidates = input.type === 'image'
    ? selectImageFallbackCandidates({
      requestedModelId: modelConfig.id,
      requestedProvider: modelConfig.provider,
      attemptedModelIds,
      models: AVAILABLE_MODELS,
      hasApiKey: (apiKeyEnvVar: string) => Boolean(Deno.env.get(apiKeyEnvVar))
    })
    : [];

  if (input.type === 'image') {
    await logger.log(
      `🔁 FALLBACK CANDIDATES: ${fallbackCandidates.length > 0 ? fallbackCandidates.join(', ') : 'none'}`,
      "AI"
    );
  }

  try {
    const orchestrationResult = await executeWithFallback({
      primaryModelId: modelConfig.id,
      fallbackModelIds: fallbackCandidates,
      attempt: attemptModelCall,
      onFallbackAttempt: async (candidateId, reason, attemptNumber) => {
        await logger.log(
          `🔄 FALLBACK ATTEMPT ${attemptNumber}: ${candidateId} (reason: ${reason})`,
          "AI"
        );
      },
      onFallbackFailure: async (candidateId, error, attemptNumber) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.log(
          `❌ FALLBACK FAILED ${attemptNumber}: ${candidateId} (${errorMessage})`,
          "ERROR"
        );
      }
    });

    if (orchestrationResult.fallbackApplied) {
      await logger.log(
        `✅ FALLBACK SUCCESS: switched from ${orchestrationResult.fallbackFrom} to ${orchestrationResult.modelUsed}`,
        "AI"
      );
      await logger.log(
        `📋 FALLBACK CHAIN: ${orchestrationResult.attemptedModels.join(' -> ')}`,
        "AI"
      );
    }

    return {
      result: orchestrationResult.result,
      modelUsed: orchestrationResult.modelUsed,
      fallbackApplied: orchestrationResult.fallbackApplied,
      fallbackFrom: orchestrationResult.fallbackFrom,
      fallbackReason: orchestrationResult.fallbackReason
    };
  } catch (error) {
    const terminalReason = error instanceof Error ? error.message : String(error);
    await logger.log(`❌ TERMINAL FAILURE: ${terminalReason}`, "ERROR");
    await logger.log(`❌ FALLBACK CHAIN EXHAUSTED for ${modelConfig.id}`, "ERROR");
    throw error;
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
  const providerCallStart = Date.now();

  // Standardized provider logging
  await logger.log(`🔵 GEMINI API CALL INITIATED`, "AI");
  await logger.log(`📋 Model: ${modelConfig.name} (${modelConfig.id})`, "AI");
  await logger.log(`🎯 Input Type: ${input.type}`, "AI");
  await logger.log(`🌐 Endpoint: ${modelConfig.endpoint}`, "AI");

  // Log payload construction
  const payloadConstructionStart = Date.now();
  await logger.log(`🔧 PAYLOAD CONSTRUCTION: Building ${input.type} prompt`, "AI");

  // Construct the payload based on input type
  let payload: any;

  if (input.type === 'text') {
    const prompt = buildTextPrompt(input, 'full');
    payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
  } else {
    payload = {
      contents: [{
        parts: [
          {
            text: buildVisionPrompt('full')
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

  // Log payload construction completion
  const payloadConstructionEnd = Date.now();
  const payloadConstructionDuration = (payloadConstructionEnd - payloadConstructionStart) / 1000;
  await logger.log(`✅ Payload constructed in ${payloadConstructionDuration.toFixed(3)} seconds`, "AI");

  // Log payload metadata
  const payloadSize = JSON.stringify(payload).length;
  await logger.log(`📊 Payload size: ${payloadSize} bytes`, "AI");
  await logger.log(`⚙️ Generation config: temp=${modelConfig.temperature}, maxTokens=${modelConfig.maxTokens}`, "AI");

  if (input.type === 'text') {
    const textLength = input.fullText?.length || 0;
    await logger.log(`📝 Text input length: ${textLength} characters`, "AI");
  } else {
    const imageSize = input.imageData.data.length;
    await logger.log(`🖼️ Image size: ${imageSize} bytes (${input.imageData.mimeType})`, "AI");
  }

  // Enhanced API call logging
  await logger.log(`🚀 GEMINI API REQUEST: Initiating call to ${modelConfig.name}`, "AI");
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

  // Enhanced response logging
  await logger.log(`⏱️ API call completed in ${geminiCallDuration.toFixed(2)} seconds`, "AI");
  await logger.log(`📡 Response status: ${response.status} ${response.statusText}`, "AI");

  if (!response.ok) {
    const errorText = await response.text();
    await logger.log(`❌ GEMINI API ERROR: ${response.status} ${response.statusText}`, "ERROR");
    await logger.log(`📄 Error details: ${errorText.substring(0, 500)}`, "ERROR");

    // Enhanced error handling with specific suggestions
    if (response.status === 429) {
      await logger.log(`🚫 RATE LIMIT: Consider using gemini-2.0-flash-lite for better reliability`, "ERROR");
      await logger.log(`💡 SUGGESTION: Implement exponential backoff or switch to a different model`, "ERROR");
    } else if (response.status === 401) {
      await logger.log(`🔑 AUTH ERROR: Check GEMINI_API_KEY in environment variables`, "ERROR");
    } else if (response.status === 400) {
      await logger.log(`📝 REQUEST ERROR: Invalid payload or model configuration`, "ERROR");
    } else if (response.status === 404 && modelConfig.id === 'gemini-2.5-flash-lite-preview-06-17') {
      // Specific handling for the problematic model
      await logger.log(`🔄 MODEL UNAVAILABLE: ${modelConfig.id} is not available`, "ERROR");
      await logger.log(`💡 AUTOMATIC FALLBACK: Switching to gemini-2.5-flash`, "ERROR");

      // Use fallback model
      const fallbackModelConfig = AVAILABLE_MODELS['gemini-2.5-flash'];
      if (fallbackModelConfig) {
        await logger.log(`🚀 FALLBACK ATTEMPT: Retrying with ${fallbackModelConfig.name}`, "AI");
        return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
      }
    }

    throw new Error(`Failed to process with Gemini API: ${response.status} ${response.statusText}`);
  }

  // Enhanced response parsing with model-specific handling
  const responseParsingStart = Date.now();
  const geminiResponse = await response.json();
  const responseParsingEnd = Date.now();
  const responseParsingDuration = (responseParsingEnd - responseParsingStart) / 1000;

  await logger.log(`✅ Response received and parsed in ${responseParsingDuration.toFixed(3)} seconds`, "AI");

  // Log response metadata with model-specific information
  const candidatesCount = geminiResponse.candidates?.length || 0;
  await logger.log(`📊 Response metadata: ${candidatesCount} candidate(s) from ${modelConfig.id}`, "AI");

  if (candidatesCount === 0) {
    await logger.log(`❌ CRITICAL: No candidates in response from ${modelConfig.id}`, "ERROR");
    await logger.log(`📄 Full response: ${JSON.stringify(geminiResponse, null, 2)}`, "ERROR");
    throw new Error(`No candidates in Gemini response from ${modelConfig.id}`);
  }

  const firstCandidate = geminiResponse.candidates[0];

  // Check for finish reason issues
  if (firstCandidate.finishReason && firstCandidate.finishReason !== 'STOP') {
    await logger.log(`⚠️ WARNING: Unusual finish reason: ${firstCandidate.finishReason}`, "ERROR");
  }

  // Validate response structure
  if (!firstCandidate.content || !firstCandidate.content.parts || !firstCandidate.content.parts[0]) {
    await logger.log(`❌ CRITICAL: Invalid response structure from ${modelConfig.id}`, "ERROR");
    await logger.log(`📄 Candidate structure: ${JSON.stringify(firstCandidate, null, 2)}`, "ERROR");
    throw new Error(`Invalid response structure from ${modelConfig.id}`);
  }

  const contentLength = firstCandidate.content.parts[0].text?.length || 0;
  await logger.log(`📝 Content length: ${contentLength} characters`, "AI");

  if (contentLength === 0) {
    await logger.log(`❌ CRITICAL: Empty response text from ${modelConfig.id}`, "ERROR");
    throw new Error(`Empty response text from ${modelConfig.id}`);
  }

  // Parse the response using shared parser
  const responseText = geminiResponse.candidates[0].content.parts[0].text;
  console.log(`🔍 Full Gemini response text:`, responseText);

  const parseResult = await parseGeminiResponse(responseText, modelConfig.id, logger);

  // Handle model fallback signaled by the parser
  if (parseResult.needsModelFallback && parseResult.fallbackModelId) {
    const fallbackModelConfig = AVAILABLE_MODELS[parseResult.fallbackModelId];
    if (fallbackModelConfig) {
      await logger.log(
        `🚀 AUTOMATIC FALLBACK: Switching to ${fallbackModelConfig.name} due to ${parseResult.fallbackReason}`,
        "AI"
      );
      return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
    }
  }

  // If parser couldn't extract data and no fallback was triggered
  if (!parseResult.data) {
    return buildDefaultEmptyResponse(parseResult.fallbackReason || 'Failed to parse Gemini response');
  }

  // Log final processing results
  const providerCallEnd = Date.now();
  const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
  await logger.log(`✅ GEMINI PROCESSING COMPLETE in ${totalProviderDuration.toFixed(2)} seconds`, "AI");

  return parseResult.data;
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
  const providerCallStart = Date.now();

  // Standardized provider logging
  await logger.log(`🟠 OPENROUTER API CALL INITIATED`, "AI");
  await logger.log(`📋 Model: ${modelConfig.name} (${modelConfig.id})`, "AI");
  await logger.log(`🎯 Input Type: ${input.type}`, "AI");
  await logger.log(`🌐 Endpoint: ${modelConfig.endpoint}`, "AI");

  // Extract model name from OpenRouter model ID
  const modelName = modelConfig.id.replace(/^openrouter\//, '');
  await logger.log(`🔧 OpenRouter model name: ${modelName}`, "AI");

  // Log payload construction
  const payloadConstructionStart = Date.now();
  await logger.log(`🔧 PAYLOAD CONSTRUCTION: Building ${input.type} messages`, "AI");

  // Prepare messages based on input type
  let messages: any[];

  if (input.type === 'text') {
    const prompt = buildTextPrompt(input, 'standard');
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
            text: buildVisionPrompt('standard')
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

  // Log payload construction completion
  const payloadConstructionEnd = Date.now();
  const payloadConstructionDuration = (payloadConstructionEnd - payloadConstructionStart) / 1000;
  await logger.log(`✅ Payload constructed in ${payloadConstructionDuration.toFixed(3)} seconds`, "AI");

  // Log payload metadata
  const payloadSize = JSON.stringify(payload).length;
  await logger.log(`📊 Payload size: ${payloadSize} bytes`, "AI");
  await logger.log(`⚙️ Model config: temp=${modelConfig.temperature}, maxTokens=${modelConfig.maxTokens}`, "AI");
  await logger.log(`📝 Messages count: ${messages.length}`, "AI");

  if (input.type === 'text') {
    const textLength = input.fullText?.length || 0;
    await logger.log(`📝 Text input length: ${textLength} characters`, "AI");
  } else {
    const imageSize = input.imageData.data.length;
    await logger.log(`🖼️ Image size: ${imageSize} bytes (${input.imageData.mimeType})`, "AI");
  }

  // Enhanced API call logging
  await logger.log(`🚀 OPENROUTER API REQUEST: Initiating call to ${modelName}`, "AI");
  const openRouterCallStart = Date.now();
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mataresit.app',
      'X-Title': 'Mataresit Receipt Processing'
    },
    body: JSON.stringify(payload),
  });

  const openRouterCallEnd = Date.now();
  const openRouterCallDuration = (openRouterCallEnd - openRouterCallStart) / 1000;

  // Enhanced response logging
  await logger.log(`⏱️ API call completed in ${openRouterCallDuration.toFixed(2)} seconds`, "AI");
  await logger.log(`📡 Response status: ${response.status} ${response.statusText}`, "AI");

  if (!response.ok) {
    const errorText = await response.text();
    await logger.log(`❌ OPENROUTER API ERROR: ${response.status} ${response.statusText}`, "ERROR");
    await logger.log(`📄 Error details: ${errorText.substring(0, 500)}`, "ERROR");

    // Enhanced error handling with specific suggestions
    if (response.status === 429) {
      await logger.log(`🚫 RATE LIMIT: Consider switching to a different OpenRouter model`, "ERROR");
      await logger.log(`💡 SUGGESTION: Implement exponential backoff or use a paid model`, "ERROR");
    } else if (response.status === 401) {
      await logger.log(`🔑 AUTH ERROR: Check OPENROUTER_API_KEY in environment variables`, "ERROR");
    } else if (response.status === 400) {
      await logger.log(`📝 REQUEST ERROR: Invalid payload or unsupported model`, "ERROR");
    } else if (response.status === 402) {
      await logger.log(`💳 PAYMENT ERROR: Insufficient credits or billing issue`, "ERROR");
    }

    throw new Error(`Failed to process with OpenRouter API: ${response.status} ${response.statusText}`);
  }

  // Enhanced response parsing
  const responseParsingStart = Date.now();
  const openRouterResponse = await response.json();
  const responseParsingEnd = Date.now();
  const responseParsingDuration = (responseParsingEnd - responseParsingStart) / 1000;

  await logger.log(`✅ Response received and parsed in ${responseParsingDuration.toFixed(3)} seconds`, "AI");

  // Log response metadata
  const choicesCount = openRouterResponse.choices?.length || 0;
  await logger.log(`📊 Response metadata: ${choicesCount} choice(s)`, "AI");

  if (choicesCount > 0) {
    const firstChoice = openRouterResponse.choices[0];
    const contentLength = firstChoice?.message?.content?.length || 0;
    await logger.log(`📝 Content length: ${contentLength} characters`, "AI");

    if (openRouterResponse.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = openRouterResponse.usage;
      await logger.log(`🔢 Token usage: ${prompt_tokens} prompt + ${completion_tokens} completion = ${total_tokens} total`, "AI");
    }
  }

  // Parse the response using shared parser
  const responseText = openRouterResponse.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No content in OpenRouter response');
  }

  const enhancedData = await parseOpenAICompatibleResponse(responseText, logger, 'OpenRouter');

  // Log final processing results
  const providerCallEnd = Date.now();
  const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
  await logger.log(`✅ OPENROUTER PROCESSING COMPLETE in ${totalProviderDuration.toFixed(2)} seconds`, "AI");

  return enhancedData.data;
}

/**
 * Call Groq API for text or vision processing
 * Groq uses OpenAI-compatible chat completions for multimodal models
 */
async function callGroqAPI(
  input: AIModelInput,
  modelConfig: ModelConfig,
  apiKey: string,
  logger: ProcessingLogger
): Promise<any> {
  const providerCallStart = Date.now();

  await logger.log(`🟢 GROQ API CALL INITIATED`, "AI");
  await logger.log(`📋 Model: ${modelConfig.name} (${modelConfig.id})`, "AI");
  await logger.log(`🎯 Input Type: ${input.type}`, "AI");
  await logger.log(`🌐 Endpoint: ${modelConfig.endpoint}`, "AI");

  const payloadConstructionStart = Date.now();
  await logger.log(`🔧 PAYLOAD CONSTRUCTION: Building ${input.type} messages`, "AI");

  const modelName = modelConfig.id.replace(/^groq\//, '');
  await logger.log(`🔧 Groq model name: ${modelName}`, "AI");

  let messages: any[];
  if (input.type === 'text') {
    const prompt = buildTextPrompt(input, 'minimal');
    messages = [
      {
        role: 'user',
        content: prompt
      }
    ];
  } else {
    const base64Image = encodeBase64(input.imageData.data);
    const mimeType = input.imageData.mimeType;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt('minimal') },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ];
  }

  const payload = {
    model: modelName,
    messages,
    temperature: modelConfig.temperature,
    max_completion_tokens: modelConfig.maxTokens,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  };

  const payloadConstructionEnd = Date.now();
  const payloadConstructionDuration = (payloadConstructionEnd - payloadConstructionStart) / 1000;
  await logger.log(`✅ Groq payload constructed in ${payloadConstructionDuration.toFixed(3)} seconds`, "AI");

  await logger.log(`🚀 GROQ API REQUEST: Initiating call to ${modelName}`, "AI");
  const groqCallStart = Date.now();
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  });

  const groqCallDuration = (Date.now() - groqCallStart) / 1000;
  await logger.log(`⏱️ Groq API call completed in ${groqCallDuration.toFixed(2)} seconds`, "AI");
  await logger.log(`📡 Response status: ${response.status} ${response.statusText}`, "AI");

  if (!response.ok) {
    const errorText = await response.text();
    await logger.log(`❌ GROQ API ERROR: ${response.status} ${response.statusText}`, "ERROR");
    await logger.log(`📄 Error details: ${errorText.substring(0, 500)}`, "ERROR");
    throw new ProviderRequestError({
      provider: 'groq',
      modelId: modelConfig.id,
      status: response.status,
      statusText: response.statusText,
      errorBodySnippet: errorText.substring(0, 500),
      endpoint: modelConfig.endpoint
    });
  }

  const groqResponse = await response.json();

  const responseText = groqResponse.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No content in Groq response');
  }

  const enhancedData = await parseOpenAICompatibleResponse(responseText, logger, 'Groq');

  const providerCallEnd = Date.now();
  const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
  await logger.log(`✅ GROQ PROCESSING COMPLETE in ${totalProviderDuration.toFixed(2)} seconds`, "AI");

  return enhancedData.data;
}

/**
 * Main entry point for receipt data enhancement.
 * Coordinates AI model selection, execution, and post-processing.
 */
async function enhanceReceiptData(
  input: AIModelInput,
  modelId: string,
  receiptId: string,
  options?: {
    groqApiKeyOverride?: string;
  }
): Promise<{
  data: any;
  modelUsed: string;
  fallbackApplied: boolean;
  fallbackFrom: string | null;
  fallbackReason: string | null;
}> {
  const logger = new ProcessingLogger(receiptId);

  // Use the specified model or default based on input type
  const modelToUse = modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL);

  try {
    const enhanceStartTime = Date.now();
    console.log(`🔍 ENHANCE-RECEIPT-DATA DEBUG - Starting processing at ${new Date().toISOString()}`);
    console.log(`🔍 Receipt ID: ${receiptId}`);
    console.log(`🔍 Input type: ${input.type}`);
    console.log(`🔍 Model ID requested: ${modelId}`);

    await logger.log(`Starting ${modelId || 'AI'} processing`, "AI");

    console.log(`🔍 Model to use: ${modelToUse}`);
    await logger.log(`Using model: ${modelToUse}`, "AI");

    // Call the appropriate AI model
    console.log(`🔍 Calling AI model: ${modelToUse}`);
    const aiCallStartTime = Date.now();
    const aiResult = await callAIModel(input, modelToUse, receiptId, logger, options);
    const enhancedData = aiResult.result;
    const actualModelUsed = aiResult.modelUsed;
    const fallbackApplied = aiResult.fallbackApplied;
    const fallbackFrom = aiResult.fallbackFrom;
    const fallbackReason = aiResult.fallbackReason;
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

    // Process Malaysian tax information if we have merchant and total
    if (enhancedData.merchant && enhancedData.total) {
      const taxProcessingStart = Date.now();
      const taxInfo = await processMalaysianTax(
        enhancedData.merchant,
        parseFloat(enhancedData.total),
        enhancedData.date || new Date().toISOString().split('T')[0],
        enhancedData.malaysian_tax_info,
        logger
      );
      const taxProcessingEnd = Date.now();
      const taxProcessingDuration = (taxProcessingEnd - taxProcessingStart) / 1000;

      console.log(`🔍 Tax processing completed in ${taxProcessingDuration.toFixed(2)} seconds`);

      if (taxInfo) {
        // Add tax information to enhanced data
        enhancedData.detected_tax_type = taxInfo.detected_tax_type;
        enhancedData.detected_tax_rate = taxInfo.detected_tax_rate;
        enhancedData.tax_breakdown = taxInfo.tax_breakdown;
        enhancedData.is_tax_inclusive = taxInfo.is_tax_inclusive;
        enhancedData.malaysian_business_category = taxInfo.malaysian_business_category;

        await logger.log(`Tax processing complete: ${taxInfo.detected_tax_type} at ${taxInfo.detected_tax_rate}%`, "TAX");
      }
    }

    await logger.log("AI processing complete", "AI");
    return {
      data: enhancedData,
      modelUsed: actualModelUsed,
      fallbackApplied,
      fallbackFrom,
      fallbackReason
    };
  } catch (error) {
    console.error("Error in enhanceReceiptData:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`Error in enhanceReceiptData: ${errorMessage}`, "ERROR");
    throw error;
  }
}
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("Received request to enhance receipt data");
    const groqApiKeyHeader = req.headers.get('x-groq-api-key') || undefined;

    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData = await req.json();

    // Enhanced debugging for request validation
    console.log("🔍 ENHANCE-RECEIPT-DATA REQUEST DEBUG:");
    console.log("🔍 Request keys:", Object.keys(requestData));
    console.log("🔍 Has extractedData:", !!requestData.extractedData);
    console.log("🔍 Has fullText:", !!requestData.fullText);
    console.log("🔍 Has imageData:", !!requestData.imageData);
    if (requestData.imageData) {
      console.log("🔍 imageData keys:", Object.keys(requestData.imageData));
      console.log("🔍 imageData.data exists:", !!requestData.imageData.data);
      console.log("🔍 imageData.data type:", typeof requestData.imageData.data);
      console.log("🔍 imageData.data length:", requestData.imageData.data?.length || 'N/A');
      console.log("🔍 imageData.mimeType:", requestData.imageData.mimeType);
      console.log("🔍 imageData.isBase64:", requestData.imageData.isBase64);
    }

    // Extract and validate required parameters
    const { extractedData, fullText, imageData, receiptId, modelId } = requestData;
    // Legacy support for textractData field name
    const textractData = requestData.textractData || extractedData;

    if (!receiptId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter: receiptId',
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the input type (text or image)
    let input: AIModelInput;

    if (textractData && fullText) {
      input = {
        type: 'text',
        extractedData: textractData,
        fullText
      };
      console.log("Processing with text input (extracted data)");
    } else if (imageData && imageData.data) {
      // Additional validation for imageData.data
      if (typeof imageData.data !== 'string' && !Array.isArray(imageData.data) && !(imageData.data instanceof Uint8Array)) {
        console.error("🔍 Invalid imageData.data type:", typeof imageData.data);
        return new Response(
          JSON.stringify({
            error: 'Invalid imageData.data format: expected string (base64) or array',
            received_type: typeof imageData.data,
            timestamp: new Date().toISOString()
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (imageData.isBase64 && typeof imageData.data !== 'string') {
        console.error("🔍 Base64 flag set but data is not string:", typeof imageData.data);
        return new Response(
          JSON.stringify({
            error: 'Invalid imageData: isBase64=true but data is not a string',
            received_type: typeof imageData.data,
            timestamp: new Date().toISOString()
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        input = {
          type: 'image',
          imageData: {
            data: imageData.isBase64 ? decodeBase64(imageData.data) : new Uint8Array(Object.values(imageData.data)),
            mimeType: imageData.mimeType || 'image/jpeg'
          }
        };
        console.log("Processing with image input (direct vision)");
        console.log("🔍 Successfully processed imageData, final size:", input.imageData.data.length, "bytes");
      } catch (decodeError) {
        console.error("🔍 Error processing imageData:", decodeError);
        const errorMessage = decodeError instanceof Error ? decodeError.message : String(decodeError);
        return new Response(
          JSON.stringify({
            error: 'Failed to process imageData: ' + errorMessage,
            timestamp: new Date().toISOString()
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Enhanced error message with specific details
      const missingDetails: string[] = [];
      if (!textractData && !fullText) {
        missingDetails.push('extractedData and fullText for text processing');
      }
      if (!imageData) {
        missingDetails.push('imageData for vision processing');
      } else if (!imageData.data) {
        missingDetails.push('imageData.data (image data is present but data field is missing/empty)');
      }

      console.error("🔍 Input validation failed. Missing:", missingDetails.join(', '));

      return new Response(
        JSON.stringify({
          error: 'Input data is required',
          details: 'Missing required parameters: ' + missingDetails.join(' OR '),
          received_keys: Object.keys(requestData),
          imageData_present: !!imageData,
          imageData_data_present: !!(imageData && imageData.data),
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process the receipt data with AI
    const enhancementResult = await enhanceReceiptData(input, modelId, receiptId, {
      groqApiKeyOverride: groqApiKeyHeader
    });
    console.log("Data enhancement complete");

    // Return the enhanced data
    return new Response(
      JSON.stringify({
        success: true,
        result: enhancementResult.data,
        model_used: enhancementResult.modelUsed,
        model_requested: modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL),
        fallback_applied: enhancementResult.fallbackApplied,
        fallback_from: enhancementResult.fallbackFrom,
        fallback_reason: enhancementResult.fallbackReason
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enhance-receipt-data function:', error);
    const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Internal server error';

    let statusCode = 500;
    let providerError: Record<string, any> | null = null;
    if (error instanceof ProviderRequestError) {
      statusCode = 502;
      providerError = {
        provider: error.provider,
        model_id: error.modelId,
        status: error.status,
        status_text: error.statusText,
        endpoint: error.endpoint,
        error_body_snippet: error.errorBodySnippet
      };
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        provider_error: providerError,
        success: false
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
