/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ProcessingLogger } from '../_shared/db-logger.ts'
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Initialize Supabase client for tax processing
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Model configuration interface for AI models with performance and capability tracking
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
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 65536,
    supportsText: true,
    supportsVision: true,
    description: 'Advanced Gemini 2.5 Flash with thinking capabilities and balanced performance',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'excellent',
      reliability: 0.95
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1048576
    }
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent',
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
  'gemini-2.5-flash-lite-preview-06-17': {
    id: 'gemini-2.5-flash-lite-preview-06-17',
    name: 'Gemini 2.5 Flash Lite Preview (Deprecated)',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite-preview-06-17:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 64000,
    supportsText: true,
    supportsVision: true,
    description: '⚠️ DEPRECATED: This model is currently unavailable. Automatically falls back to Gemini 2.5 Flash.',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.50 // Reduced reliability due to availability issues
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1000000
    }
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.1,
    maxTokens: 65536,
    supportsText: true,
    supportsVision: true,
    description: 'Most advanced Gemini model with superior reasoning and thinking capabilities',
    pricing: {
      inputTokens: 1.25,
      outputTokens: 5.00
    },
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      reliability: 0.98
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 1048576
    }
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
    supportsVision: true,
    description: 'Google\'s experimental Gemini 2.0 Flash model with vision (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.88
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 1000000
    }
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
    supportsVision: true,
    description: 'Meta\'s latest Llama 4 Maverick model with multimodal capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      reliability: 0.92
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 128000
    }
  },
  'openrouter/google/gemma-3-27b-it:free': {
    id: 'openrouter/google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Google\'s Gemma 3 27B Instruct model with vision capabilities (Free)',
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
  },
  'openrouter/qwen/qwen2.5-vl-72b-instruct:free': {
    id: 'openrouter/qwen/qwen2.5-vl-72b-instruct:free',
    name: 'Qwen 2.5 VL 72B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Qwen 2.5 Vision-Language 72B model with advanced multimodal capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      reliability: 0.91
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 32768
    }
  },
  'openrouter/mistralai/mistral-small-3.1-24b-instruct:free': {
    id: 'openrouter/mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Mistral Small 3.1 24B model with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.88
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 32768
    }
  },
  'openrouter/mistralai/mistral-small-3.2-24b-instruct:free': {
    id: 'openrouter/mistralai/mistral-small-3.2-24b-instruct:free',
    name: 'Mistral Small 3.2 24B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Mistral Small 3.2 24B model with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.88
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 32768
    }
  },
  'openrouter/meta-llama/llama-4-scout:free': {
    id: 'openrouter/meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Meta\'s Llama 4 Scout model with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.87
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
  },
  'openrouter/opengvlab/internvl3-14b:free': {
    id: 'openrouter/opengvlab/internvl3-14b:free',
    name: 'InternVL3 14B',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'InternVL3 14B vision-language model with strong multimodal understanding (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.85
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
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
    supportsVision: true,
    description: 'Moonshot AI\'s vision-language model with reasoning capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.86
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 200000
    }
  }
};

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_VISION_MODEL = 'gemini-2.5-flash-lite';

/**
 * Types for input to AI models
 */
interface TextInput {
  type: 'text';
  extractedData: any; // Legacy field name for compatibility
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
  logger: ProcessingLogger
): Promise<{ result: any; modelUsed: string }> {
  const modelSelectionStart = Date.now();

  // Enhanced model selection logging with timing
  await logger.log(`🎯 MODEL SELECTION STARTED: Receipt ${receiptId}`, "AI");
  await logger.log(`📝 Requested model ID: ${modelId || 'DEFAULT'}`, "AI");
  await logger.log(`📊 Input type: ${input.type}`, "AI");

  let modelConfig: ModelConfig;
  let wasDefaultUsed = false;
  let fallbackReason = '';

  // Enhanced model validation and fallback logic
  if (modelId && AVAILABLE_MODELS[modelId]) {
    // Requested model exists
    modelConfig = AVAILABLE_MODELS[modelId];
    await logger.log(`✅ Requested model found: ${modelConfig.name}`, "AI");
  } else if (modelId) {
    // Requested model doesn't exist - log detailed error and use fallback
    const availableModels = Object.keys(AVAILABLE_MODELS);
    await logger.log(`❌ Model '${modelId}' not found in registry`, "ERROR");
    await logger.log(`📋 Available models: ${availableModels.join(', ')}`, "ERROR");

    // Use default fallback
    const defaultModelId = input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL;
    modelConfig = AVAILABLE_MODELS[defaultModelId];
    wasDefaultUsed = true;
    fallbackReason = `Model '${modelId}' not found`;

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

  // Enhanced input compatibility validation
  const compatibilityCheckStart = Date.now();
  await logger.log(`🔍 COMPATIBILITY CHECK: Validating ${input.type} input with ${modelConfig.name}`, "AI");

  if (input.type === 'text' && !modelConfig.supportsText) {
    await logger.log(`❌ COMPATIBILITY ERROR: Model ${modelConfig.id} does not support text input`, "ERROR");
    await logger.log(`💡 SUGGESTION: Use a text-capable model like ${DEFAULT_TEXT_MODEL}`, "ERROR");
    throw new Error(`Model ${modelConfig.id} does not support text input`);
  }

  if (input.type === 'image' && !modelConfig.supportsVision) {
    await logger.log(`❌ COMPATIBILITY ERROR: Model ${modelConfig.id} does not support vision input`, "ERROR");
    await logger.log(`💡 SUGGESTION: Use a vision-capable model like ${DEFAULT_VISION_MODEL}`, "ERROR");
    throw new Error(`Model ${modelConfig.id} does not support vision input`);
  }

  const compatibilityCheckEnd = Date.now();
  const compatibilityCheckDuration = (compatibilityCheckEnd - compatibilityCheckStart) / 1000;
  await logger.log(`✅ Compatibility check passed in ${compatibilityCheckDuration.toFixed(3)} seconds`, "AI");

  // Enhanced API key validation
  await logger.log(`🔑 API KEY VALIDATION: Checking ${modelConfig.apiKeyEnvVar}`, "AI");
  const apiKey = Deno.env.get(modelConfig.apiKeyEnvVar);
  if (!apiKey) {
    await logger.log(`❌ API KEY ERROR: ${modelConfig.apiKeyEnvVar} not found in environment variables`, "ERROR");
    await logger.log(`💡 SOLUTION: Set ${modelConfig.apiKeyEnvVar} in Supabase dashboard secrets`, "ERROR");
    throw new Error(`${modelConfig.apiKeyEnvVar} not found in environment variables`);
  }
  await logger.log(`✅ API key validated for ${modelConfig.provider.toUpperCase()}`, "AI");

  // Log final model selection summary
  if (wasDefaultUsed) {
    await logger.log(`📋 SELECTION SUMMARY: Using ${modelConfig.name} (${fallbackReason})`, "AI");
  } else {
    await logger.log(`📋 SELECTION SUMMARY: Using requested ${modelConfig.name}`, "AI");
  }

  // Enhanced provider routing with validation
  await logger.log(`🚀 PROVIDER ROUTING: Calling ${modelConfig.provider.toUpperCase()} API`, "AI");
  const providerCallStart = Date.now();

  try {
    let result: any;
    switch (modelConfig.provider) {
      case 'gemini':
        result = await callGeminiAPI(input, modelConfig, apiKey, logger);
        break;
      case 'openrouter':
        result = await callOpenRouterAPI(input, modelConfig, apiKey, logger);
        break;
      default:
        await logger.log(`❌ PROVIDER ERROR: Unsupported provider '${modelConfig.provider}'`, "ERROR");
        await logger.log(`💡 SUPPORTED: gemini, openrouter`, "ERROR");
        throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
    }

    const providerCallEnd = Date.now();
    const providerCallDuration = (providerCallEnd - providerCallStart) / 1000;
    await logger.log(`✅ Provider call completed in ${providerCallDuration.toFixed(2)} seconds`, "AI");

    return { result, modelUsed: modelConfig.id };
  } catch (error) {
    const providerCallEnd = Date.now();
    const providerCallDuration = (providerCallEnd - providerCallStart) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`❌ Provider call failed after ${providerCallDuration.toFixed(2)} seconds: ${errorMessage}`, "ERROR");
    throw error;
  }
}

/**
 * Parse bounding box format response from Gemini 2.5 Flash Lite Preview
 * Note: This format provides structure but lacks actual text content
 */
async function parseBoundingBoxFormat(boundingBoxData: any[], logger: ProcessingLogger): Promise<any> {
  await logger.log(`📦 Processing ${boundingBoxData.length} bounding box elements`, "AI");
  await logger.log(`⚠️ LIMITATION: Bounding box format detected - structure available but text content missing`, "ERROR");

  // Group elements by label for analysis
  const elementsByLabel: { [key: string]: any[] } = {};
  boundingBoxData.forEach(element => {
    if (!elementsByLabel[element.label]) {
      elementsByLabel[element.label] = [];
    }
    elementsByLabel[element.label].push(element);
  });

  const detectedLabels = Object.keys(elementsByLabel);
  await logger.log(`🏷️ Detected ${detectedLabels.length} unique labels: ${detectedLabels.join(', ')}`, "AI");

  // Create a structured response indicating what was detected
  const result = {
    merchant: elementsByLabel.store_name ? 'Store detected (text extraction needed)' : '',
    date: elementsByLabel.date ? new Date().toISOString().split('T')[0] : '',
    total: 0, // Cannot extract actual values without text content
    tax: 0,
    currency: 'MYR',
    payment_method: elementsByLabel.payment_method ? 'Payment method detected' : '',
    predicted_category: 'Other',
    line_items: [] as any[],
    confidence: {
      merchant: elementsByLabel.store_name ? 50 : 0, // Lower confidence due to missing text
      date: elementsByLabel.date ? 50 : 0,
      total: 0,
      tax: 0,
      currency: 50,
      payment_method: elementsByLabel.payment_method ? 50 : 0,
      predicted_category: 30,
      line_items: 0
    },
    // Add metadata about the bounding box detection
    bounding_box_metadata: {
      format_detected: 'gemini_2.5_bounding_box',
      total_elements: boundingBoxData.length,
      unique_labels: detectedLabels.length,
      detected_labels: detectedLabels,
      requires_text_extraction: true
    }
  };

  // Create placeholder line items based on detected item descriptions
  if (elementsByLabel.item_description) {
    const itemCount = elementsByLabel.item_description.length;
    for (let i = 0; i < Math.min(itemCount, 3); i++) {
      result.line_items.push({
        description: `Item ${i + 1} (structure detected)`,
        amount: 0 // Cannot extract actual price without text content
      });
    }
    await logger.log(`📦 Created ${result.line_items.length} placeholder line items`, "AI");
  }

  // Predict category based on structure
  if (elementsByLabel.item_description && elementsByLabel.item_description.length > 3) {
    result.predicted_category = 'Groceries';
    result.confidence.predicted_category = 60;
  }

  await logger.log(`✅ Bounding box analysis complete - structure detected but text extraction needed`, "AI");
  await logger.log(`💡 RECOMMENDATION: Use traditional JSON format for better data extraction`, "AI");

  return result;
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
    // Text-based prompt for extracted data with Malaysian business context
    const prompt = `
You are an AI assistant specialized in analyzing receipt data with expertise in Malaysian business terminology and Malay language.

RECEIPT TEXT:
${input.fullText}

EXTRACTED DATA:
${JSON.stringify(input.extractedData, null, 2)}

Based on the receipt text above, please:
1. Identify the CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous but likely Malaysian.
2. Identify the PAYMENT METHOD including Malaysian-specific methods:
   - Credit/Debit Cards: VISA, Mastercard, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD
   - Digital Wallets: GrabPay, Touch 'n Go eWallet, Boost, ShopeePay, BigPay, MAE, FPX
   - Cash: CASH, TUNAI
   - Bank Transfer: Online Banking, Internet Banking, Bank Transfer
3. Predict a CATEGORY for this expense from the following list: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".
4. Recognize Malaysian business terminology:
   - Common Malaysian business names and chains (e.g., 99 Speedmart, KK Super Mart, Tesco, AEON, Mydin, Giant, Village Grocer)
   - Malaysian food establishments (e.g., Mamak, Kopitiam, Restoran, Kedai Kopi)
   - Malaysian service providers (e.g., Astro, Unifi, Celcom, Digi, Maxis, TNB, Syabas)
5. Identify MALAYSIAN TAX information:
   - Look for GST (6% - historical 2015-2018) or SST (Sales & Service Tax - current from 2018)
   - SST Sales Tax: 5-10% on goods (varies by category)
   - SST Service Tax: 6% on services
   - Zero-rated items: Basic food, medical, education
   - Detect if tax is inclusive or exclusive in the total
6. Handle Malay language text and mixed English-Malay content
7. Provide SUGGESTIONS for potential extraction errors - look at fields like merchant name, date format, total amount, etc. that might have been incorrectly extracted.

Return your findings in the following JSON format:
{
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "merchant": "The merchant name if you find a better match than extracted data",
  "total": "The total amount if you find a better match than extracted data",
  "malaysian_tax_info": {
    "tax_type": "GST, SST_SALES, SST_SERVICE, EXEMPT, or ZERO_RATED",
    "tax_rate": "Tax rate percentage (e.g., 6.00, 10.00)",
    "tax_amount": "Calculated or detected tax amount",
    "is_tax_inclusive": "true if tax is included in total, false if added separately",
    "business_category": "Detected Malaysian business category"
  },
  "structured_data": {
    "merchant_normalized": "Standardized merchant name for consistent querying",
    "merchant_category": "Business category (grocery, restaurant, gas_station, pharmacy, etc.)",
    "business_type": "Type of business (retail, service, restaurant, healthcare, etc.)",
    "location_city": "City where transaction occurred",
    "location_state": "State/province where transaction occurred",
    "receipt_type": "Type of transaction (purchase, refund, exchange, service)",
    "transaction_time": "Time of day in HH:MM format if available",
    "item_count": "Number of distinct items purchased",
    "discount_amount": "Total discount amount applied",
    "service_charge": "Service charge amount",
    "tip_amount": "Tip/gratuity amount",
    "subtotal": "Subtotal before tax and charges",
    "total_before_tax": "Total amount before tax",
    "cashier_name": "Name of cashier if visible",
    "receipt_number": "Receipt number from merchant system",
    "transaction_id": "Unique transaction identifier",
    "loyalty_program": "Loyalty program used (if any)",
    "loyalty_points": "Loyalty points earned or redeemed",
    "payment_card_last4": "Last 4 digits of payment card if visible",
    "payment_approval_code": "Payment approval/authorization code",
    "is_business_expense": "true/false - whether this appears to be a business expense",
    "expense_type": "Type of expense (meal, travel, office_supplies, fuel, etc.)",
    "vendor_registration_number": "Vendor business registration number if visible",
    "invoice_number": "Invoice number for business receipts",
    "purchase_order_number": "Purchase order number if visible"
  },
  "line_items_analysis": {
    "categories": "Categorize line items by type (food, beverage, service, product, etc.)",
    "patterns": "Identify patterns in purchases (bulk buying, premium items, etc.)",
    "anomalies": "Flag unusual items or pricing"
  },
  "spending_patterns": {
    "transaction_type": "regular, bulk_purchase, special_occasion, business_related",
    "price_tier": "budget, mid_range, premium based on item prices",
    "shopping_behavior": "planned, impulse, necessity based on items"
  },
  "suggestions": {
    "merchant": "A suggested correction for merchant name if extraction made errors",
    "date": "A suggested date correction in YYYY-MM-DD format if needed",
    "total": "A suggested total amount correction if needed",
    "tax": "A suggested tax amount correction if needed"
  },
  "confidence": {
    "currency": "Confidence score 0-100 for currency",
    "payment_method": "Confidence score 0-100 for payment method",
    "predicted_category": "Confidence score 0-100 for category prediction",
    "malaysian_tax_info": "Confidence score 0-100 for tax detection",
    "structured_data": "Confidence score 0-100 for structured data extraction",
    "line_items_analysis": "Confidence score 0-100 for line items analysis",
    "spending_patterns": "Confidence score 0-100 for spending pattern analysis",
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
    // Vision-based prompt for direct image analysis with Malaysian business context
    payload = {
      contents: [{
        parts: [
          {
            text: `You are an AI assistant specialized in analyzing receipt images with expertise in Malaysian business terminology and Malay language.

IMPORTANT: Please provide TEXT EXTRACTION and DATA ANALYSIS, not bounding box coordinates or structural markup. Return actual extracted text values in JSON format.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name) - recognize Malaysian business chains and local establishments
2. DATE of purchase (in YYYY-MM-DD format) - handle DD/MM/YYYY format common in Malaysia
3. TOTAL amount
4. TAX amount (if present) - recognize GST/SST terminology
5. LINE ITEMS (product/service name and price for each item) - handle mixed English-Malay product names
6. CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous.
7. PAYMENT METHOD including Malaysian-specific methods:
   - Credit/Debit Cards: VISA, Mastercard, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD
   - Digital Wallets: GrabPay, Touch 'n Go eWallet, Boost, ShopeePay, BigPay, MAE, FPX
   - Cash: CASH, TUNAI
   - Bank Transfer: Online Banking, Internet Banking, Bank Transfer
8. Predict a CATEGORY for this expense from: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".
9. Identify MALAYSIAN TAX information:
   - Look for GST (6% - historical 2015-2018) or SST (Sales & Service Tax - current from 2018)
   - SST Sales Tax: 5-10% on goods (varies by category)
   - SST Service Tax: 6% on services
   - Zero-rated items: Basic food, medical, education
   - Detect if tax is inclusive or exclusive in the total

Malaysian Business Recognition:
- Grocery chains: 99 Speedmart, KK Super Mart, Tesco, AEON, Mydin, Giant, Village Grocer, Jaya Grocer, Cold Storage
- Food establishments: Mamak, Kopitiam, Restoran, Kedai Kopi, McDonald's, KFC, Pizza Hut, Subway
- Service providers: Astro, Unifi, Celcom, Digi, Maxis, TNB (Tenaga Nasional), Syabas, IWK
- Petrol stations: Petronas, Shell, BHP, Caltex
- Pharmacies: Guardian, Watsons, Caring, Big Pharmacy

Return your findings in the following JSON format:
{
  "merchant": "The merchant name",
  "date": "The date in YYYY-MM-DD format",
  "total": "The total amount as a number",
  "tax": "The tax amount as a number",
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "malaysian_tax_info": {
    "tax_type": "GST, SST_SALES, SST_SERVICE, EXEMPT, or ZERO_RATED",
    "tax_rate": "Tax rate percentage (e.g., 6.00, 10.00)",
    "tax_amount": "Calculated or detected tax amount",
    "is_tax_inclusive": "true if tax is included in total, false if added separately",
    "business_category": "Detected Malaysian business category"
  },
  "line_items": [
    { "description": "Item 1 description", "amount": "Item 1 price as a number" },
    { "description": "Item 2 description", "amount": "Item 2 price as a number" }
  ],
  "structured_data": {
    "merchant_normalized": "Standardized merchant name",
    "merchant_category": "Business category (grocery, restaurant, gas_station, etc.)",
    "business_type": "Type of business (retail, service, restaurant, etc.)",
    "location_city": "City where transaction occurred",
    "location_state": "State/province where transaction occurred",
    "receipt_type": "purchase, refund, exchange, or service",
    "transaction_time": "Time in HH:MM format if visible",
    "item_count": "Number of distinct items purchased",
    "discount_amount": "Total discount amount",
    "service_charge": "Service charge amount",
    "tip_amount": "Tip/gratuity amount",
    "subtotal": "Subtotal before tax",
    "total_before_tax": "Total before tax",
    "cashier_name": "Cashier name if visible",
    "receipt_number": "Receipt number",
    "transaction_id": "Transaction ID",
    "loyalty_program": "Loyalty program used",
    "loyalty_points": "Points earned/redeemed",
    "payment_card_last4": "Last 4 digits of card",
    "payment_approval_code": "Approval code",
    "is_business_expense": "true/false for business expense",
    "expense_type": "meal, travel, office_supplies, etc.",
    "vendor_registration_number": "Business registration number",
    "invoice_number": "Invoice number",
    "purchase_order_number": "PO number"
  },
  "line_items_analysis": {
    "categories": "Categorize items by type",
    "patterns": "Shopping patterns identified",
    "anomalies": "Unusual items or pricing"
  },
  "spending_patterns": {
    "transaction_type": "regular, bulk_purchase, special_occasion, business_related",
    "price_tier": "budget, mid_range, premium",
    "shopping_behavior": "planned, impulse, necessity"
  },
  "confidence": {
    "merchant": "Confidence score 0-100",
    "date": "Confidence score 0-100",
    "total": "Confidence score 0-100",
    "tax": "Confidence score 0-100",
    "currency": "Confidence score 0-100",
    "payment_method": "Confidence score 0-100",
    "predicted_category": "Confidence score 0-100",
    "malaysian_tax_info": "Confidence score 0-100 for tax detection",
    "structured_data": "Confidence score 0-100 for structured data",
    "line_items_analysis": "Confidence score 0-100 for line items analysis",
    "spending_patterns": "Confidence score 0-100 for spending patterns",
    "line_items": "Confidence score 0-100"
  }
}

CRITICAL INSTRUCTION: Return ONLY the JSON object above with actual extracted text values. Do NOT return bounding box coordinates, structural markup, or any other format. Extract and return the actual text content from the receipt image.`
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

  // Parse the response with enhanced error handling
  try {
    // Extract the text content from Gemini response
    const responseText = geminiResponse.candidates[0].content.parts[0].text;
    console.log(`🔍 Full Gemini response text:`, responseText);
    await logger.log("Parsing Gemini response", "AI");
    await logger.log(`📝 Response length: ${responseText.length} characters`, "AI");

    // Enhanced parsing with support for multiple response formats
    let enhancedData = null;
    let jsonStr = null;
    let parseMethod = '';

    // Strategy 1: Check for bounding box format (Gemini 2.5 Flash Lite Preview format)
    try {
      const boundingBoxData = JSON.parse(responseText.trim());
      if (Array.isArray(boundingBoxData) && boundingBoxData.length > 0 && boundingBoxData[0].box_2d && boundingBoxData[0].label) {
        await logger.log("🎯 CRITICAL: Detected bounding box format from Gemini 2.5 Flash Lite Preview", "ERROR");
        await logger.log("🔄 FALLBACK REQUIRED: This format lacks text content needed for data extraction", "ERROR");

        // This format is not suitable for our needs - trigger fallback
        const fallbackModelConfig = AVAILABLE_MODELS['gemini-2.5-flash'];
        if (fallbackModelConfig) {
          await logger.log(`🚀 AUTOMATIC FALLBACK: Switching to ${fallbackModelConfig.name} due to incompatible response format`, "AI");
          return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
        } else {
          // If no fallback available, parse what we can
          enhancedData = await parseBoundingBoxFormat(boundingBoxData, logger);
          parseMethod = 'bounding-box-fallback';
        }
      }
    } catch (e) {
      // Not bounding box format, continue to other strategies
    }

    // Strategy 2: Try to find JSON block with code fences
    if (!enhancedData) {
      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
        parseMethod = 'code-block';
        await logger.log("Found JSON in code block", "AI");
      }
    }

    // Strategy 3: Try to find JSON object (original method)
    if (!jsonStr && !enhancedData) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        parseMethod = 'regex-match';
        await logger.log("Found JSON using regex", "AI");
      }
    }

    // Strategy 4: Try to parse the entire response as JSON (traditional format)
    if (!jsonStr && !enhancedData) {
      try {
        enhancedData = JSON.parse(responseText.trim());
        parseMethod = 'direct-parse';
        await logger.log("Parsed entire response as JSON", "AI");
      } catch (e) {
        // Continue to next strategy
      }
    }

    // Strategy 5: Look for JSON-like content with more flexible regex
    if (!jsonStr && !enhancedData) {
      const flexibleMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (flexibleMatch) {
        jsonStr = flexibleMatch[0];
        parseMethod = 'flexible-regex';
        await logger.log("Found JSON using flexible regex", "AI");
      }
    }

    // Parse the JSON if we found a string to parse
    if (jsonStr && !enhancedData) {
      try {
        enhancedData = JSON.parse(jsonStr);
        await logger.log(`✅ JSON parsed successfully using ${parseMethod}`, "AI");
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        await logger.log(`❌ JSON parse error with ${parseMethod}: ${errorMessage}`, "ERROR");
        await logger.log(`📄 Failed JSON string: ${jsonStr.substring(0, 200)}...`, "ERROR");
      }
    }

    // If all parsing strategies failed
    if (!enhancedData) {
      console.error('No valid JSON found in Gemini response after all strategies');
      await logger.log("❌ CRITICAL: No valid JSON found after all parsing strategies", "ERROR");
      await logger.log(`📄 Raw response preview: ${responseText.substring(0, 500)}...`, "ERROR");

      // Return a structured empty response instead of empty object
      return {
        merchant: '',
        date: '',
        total: 0,
        tax: 0,
        currency: 'MYR',
        payment_method: '',
        predicted_category: 'Other',
        line_items: [],
        confidence: {
          merchant: 0,
          date: 0,
          total: 0,
          tax: 0,
          currency: 50,
          payment_method: 0,
          predicted_category: 0,
          line_items: 0
        },
        parsing_error: 'Failed to extract JSON from model response'
      };
    }

    // Validate and normalize the parsed data
    await logger.log("🔍 Validating extracted data", "AI");

    // Ensure all required fields exist with proper defaults
    const validatedData = {
      merchant: enhancedData.merchant || '',
      date: enhancedData.date || '',
      total: parseFloat(enhancedData.total) || 0,
      tax: parseFloat(enhancedData.tax) || 0,
      currency: enhancedData.currency || 'MYR',
      payment_method: enhancedData.payment_method || '',
      predicted_category: enhancedData.predicted_category || 'Other',
      line_items: Array.isArray(enhancedData.line_items) ? enhancedData.line_items : [],
      confidence: enhancedData.confidence || {}
    };

    // Ensure confidence object has all required fields
    if (!validatedData.confidence || typeof validatedData.confidence !== 'object') {
      validatedData.confidence = {};
    }

    const defaultConfidence = {
      merchant: 0,
      date: 0,
      total: 0,
      tax: 0,
      currency: 50,
      payment_method: 0,
      predicted_category: 0,
      line_items: 0
    };

    validatedData.confidence = { ...defaultConfidence, ...validatedData.confidence };

    // Set default MYR currency if not found by Gemini
    if (!enhancedData.currency) {
      validatedData.currency = 'MYR';
      validatedData.confidence.currency = 50; // medium confidence for default
      await logger.log("Using default currency: MYR", "AI");
    } else {
      await logger.log(`Detected currency: ${validatedData.currency}`, "AI");
    }

    // Validate that we extracted meaningful data
    const hasData = validatedData.merchant || validatedData.total > 0 || validatedData.date ||
                   (validatedData.line_items && validatedData.line_items.length > 0);

    if (!hasData) {
      await logger.log("⚠️ WARNING: No meaningful data extracted from receipt", "ERROR");
      await logger.log(`📊 Data summary: merchant='${validatedData.merchant}', total=${validatedData.total}, date='${validatedData.date}', items=${validatedData.line_items.length}`, "ERROR");

      // Special handling for problematic models - attempt fallback if no data extracted
      if (modelConfig.id === 'gemini-2.5-flash-lite-preview-06-17') {
        await logger.log(`🔄 EMPTY DATA FALLBACK: ${modelConfig.id} returned no data, trying fallback`, "ERROR");

        const fallbackModelConfig = AVAILABLE_MODELS['gemini-2.5-flash'];
        if (fallbackModelConfig) {
          await logger.log(`🚀 FALLBACK ATTEMPT: Retrying with ${fallbackModelConfig.name} due to empty data`, "AI");
          return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
        }
      }
    } else {
      await logger.log("✅ Meaningful data extracted successfully", "AI");
    }

    // Replace enhancedData with validatedData for the rest of the function
    enhancedData = validatedData;

    // Log final processing results
    const providerCallEnd = Date.now();
    const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
    await logger.log(`✅ GEMINI PROCESSING COMPLETE in ${totalProviderDuration.toFixed(2)} seconds`, "AI");

    // Log extracted data summary
    const dataFields = Object.keys(enhancedData);
    await logger.log(`📋 Extracted fields: ${dataFields.join(', ')}`, "AI");

    if (enhancedData.confidence) {
      const avgConfidence = Object.values(enhancedData.confidence)
        .filter(val => typeof val === 'number')
        .reduce((sum: number, val: any) => sum + val, 0) /
        Object.values(enhancedData.confidence).filter(val => typeof val === 'number').length;
      await logger.log(`📊 Average confidence: ${avgConfidence.toFixed(1)}%`, "AI");
    }

    return enhancedData;
  } catch (error) {
    const providerCallEnd = Date.now();
    const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`❌ GEMINI PARSING ERROR after ${totalProviderDuration.toFixed(2)}s: ${errorMessage}`, "ERROR");
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
    // Text-based processing
    const prompt = `You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

EXTRACTED DATA:
${JSON.stringify(input.extractedData, null, 2)}

Based on the receipt text above, please:
1. Identify the CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous but likely Malaysian.
2. Identify the PAYMENT METHOD including Malaysian-specific methods:
   - Credit/Debit Cards: VISA, Mastercard, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD
   - Digital Wallets: GrabPay, Touch 'n Go eWallet, Boost, ShopeePay, BigPay, MAE, FPX
   - Cash: CASH, TUNAI
   - Bank Transfer: Online Banking, Internet Banking, Bank Transfer
3. Predict a CATEGORY for this expense from the following list: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".
4. Recognize Malaysian business terminology and handle Malay language text.
5. Provide SUGGESTIONS for potential extraction errors.

Return your findings in JSON format:
{
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "merchant": "The merchant name if you find a better match than extracted data",
  "total": "The total amount if you find a better match than extracted data",
  "suggestions": {
    "merchant": "A suggested correction for merchant name if extraction made errors",
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
            text: `You are an AI assistant specialized in analyzing receipt images with expertise in Malaysian business terminology and Malay language.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name) - recognize Malaysian business chains and local establishments
2. DATE of purchase (in YYYY-MM-DD format) - handle DD/MM/YYYY format common in Malaysia
3. TOTAL amount
4. TAX amount (if present) - recognize GST/SST terminology
5. LINE ITEMS (product/service name and price for each item) - handle mixed English-Malay product names
6. CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous.
7. PAYMENT METHOD including Malaysian-specific methods:
   - Credit/Debit Cards: VISA, Mastercard, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD
   - Digital Wallets: GrabPay, Touch 'n Go eWallet, Boost, ShopeePay, BigPay, MAE, FPX
   - Cash: CASH, TUNAI
   - Bank Transfer: Online Banking, Internet Banking, Bank Transfer
8. Predict a CATEGORY for this expense from: "Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other".

Malaysian Business Recognition:
- Grocery chains: 99 Speedmart, KK Super Mart, Tesco, AEON, Mydin, Giant, Village Grocer, Jaya Grocer, Cold Storage
- Food establishments: Mamak, Kopitiam, Restoran, Kedai Kopi, McDonald's, KFC, Pizza Hut, Subway
- Service providers: Astro, Unifi, Celcom, Digi, Maxis, TNB (Tenaga Nasional), Syabas, IWK
- Petrol stations: Petronas, Shell, BHP, Caltex
- Pharmacies: Guardian, Watsons, Caring, Big Pharmacy

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
      'HTTP-Referer': 'https://paperless-maverick.vercel.app',
      'X-Title': 'Paperless Maverick Receipt Processing'
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

    // Log final processing results
    const providerCallEnd = Date.now();
    const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
    await logger.log(`✅ OPENROUTER PROCESSING COMPLETE in ${totalProviderDuration.toFixed(2)} seconds`, "AI");

    // Log extracted data summary
    const dataFields = Object.keys(enhancedData);
    await logger.log(`📋 Extracted fields: ${dataFields.join(', ')}`, "AI");

    if (enhancedData.confidence) {
      const avgConfidence = Object.values(enhancedData.confidence)
        .filter(val => typeof val === 'number')
        .reduce((sum: number, val: any) => sum + val, 0) /
        Object.values(enhancedData.confidence).filter(val => typeof val === 'number').length;
      await logger.log(`📊 Average confidence: ${avgConfidence.toFixed(1)}%`, "AI");
    }

    return enhancedData;
  } catch (error) {
    const providerCallEnd = Date.now();
    const totalProviderDuration = (providerCallEnd - providerCallStart) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`❌ OPENROUTER PARSING ERROR after ${totalProviderDuration.toFixed(2)}s: ${errorMessage}`, "ERROR");
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
): Promise<{ data: any; modelUsed: string }> {
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
    const aiResult = await callAIModel(input, modelToUse, receiptId, logger);
    const enhancedData = aiResult.result;
    const actualModelUsed = aiResult.modelUsed;
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
    return { data: enhancedData, modelUsed: actualModelUsed };
  } catch (error) {
    console.error("Error in enhanceReceiptData:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.log(`Error in AI enhancement: ${errorMessage}`, "ERROR");
    return { data: {}, modelUsed: modelToUse }; // Return empty object on error to avoid breaking the flow
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
    const enhancementResult = await enhanceReceiptData(input, modelId, receiptId);
    console.log("Data enhancement complete");

    // Return the enhanced data
    return new Response(
      JSON.stringify({
        success: true,
        result: enhancementResult.data,
        model_used: enhancementResult.modelUsed,
        model_requested: modelId || (input.type === 'text' ? DEFAULT_TEXT_MODEL : DEFAULT_VISION_MODEL)
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.log(`Server error: ${errorMessage}`, "ERROR");
      }
    } catch (logError) {
      // Ignore errors during error logging
    }

    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)) || 'Internal server error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});