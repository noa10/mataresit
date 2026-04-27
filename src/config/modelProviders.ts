/**
 * Enhanced model configuration system with multiple providers
 * Supports Google Gemini, OpenRouter, and other AI model providers
 */

export type ModelProvider = 'gemini' | 'openrouter' | 'groq';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  endpoint: string;
  apiKeyEnvVar: string;
  temperature: number;
  maxTokens: number;
  supportsText: boolean;
  supportsVision: boolean;
  description: string;
  pricing?: {
    inputTokens: number;  // Cost per 1M input tokens
    outputTokens: number; // Cost per 1M output tokens
  };
  performance: {
    speed: 'fast' | 'medium' | 'slow';
    accuracy: 'good' | 'very-good' | 'excellent';
    reliability: number; // 0-1 scale
  };
  capabilities: {
    maxImageSize: number; // in bytes
    supportedFormats: string[];
    contextWindow: number; // in tokens
  };
}

/**
 * Registry of available AI models from multiple providers
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // ==========================================
  // Groq Models (Primary - Vision-Capable)
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
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      contextWindow: 131072
    }
  },

  // ==========================================
  // Google Gemini Models (Fallback 1)
  // ==========================================
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

// Default models for different scenarios
export const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash-lite',
  vision: 'gemini-2.5-flash-lite',
  fast: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
  accurate: 'gemini-2.5-flash-lite',
  economical: 'groq/meta-llama/llama-4-scout-17b-16e-instruct'
};

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return Object.values(AVAILABLE_MODELS).filter(model => model.provider === provider);
}

/**
 * Get models that support a specific capability
 */
export function getModelsByCapability(capability: 'text' | 'vision'): ModelConfig[] {
  return Object.values(AVAILABLE_MODELS).filter(model =>
    capability === 'text' ? model.supportsText : model.supportsVision
  );
}

/**
 * Get recommended models based on criteria
 */
export function getRecommendedModels(criteria: {
  speed?: 'fast' | 'medium' | 'slow';
  accuracy?: 'good' | 'very-good' | 'excellent';
  maxCost?: number; // Max cost per 1M tokens
  requiresVision?: boolean;
}): ModelConfig[] {
  return Object.values(AVAILABLE_MODELS).filter(model => {
    if (criteria.speed && model.performance.speed !== criteria.speed) return false;
    if (criteria.accuracy && model.performance.accuracy !== criteria.accuracy) return false;
    if (criteria.maxCost && model.pricing && model.pricing.inputTokens > criteria.maxCost) return false;
    if (criteria.requiresVision && !model.supportsVision) return false;
    return true;
  });
}

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  const LEGACY_MODEL_ID_ALIASES: Record<string, string> = {
    'meta-llama/llama-4-scout-17b-16e-instruct': 'groq/meta-llama/llama-4-scout-17b-16e-instruct'
  };
  const resolvedModelId = LEGACY_MODEL_ID_ALIASES[modelId] || modelId;
  return AVAILABLE_MODELS[resolvedModelId];
}

/**
 * Check if a model is available (has required API key)
 */
export function isModelAvailable(modelId: string): boolean {
  const model = AVAILABLE_MODELS[modelId];
  if (!model) return false;

  // In a real implementation, you'd check if the API key is configured
  // For now, we'll assume all models are available
  return true;
}

/**
 * Get all free models (pricing = 0)
 */
export function getFreeModels(): ModelConfig[] {
  return Object.values(AVAILABLE_MODELS).filter(model =>
    model.pricing?.inputTokens === 0 && model.pricing?.outputTokens === 0
  );
}

/**
 * Get all free vision-capable models
 */
export function getFreeVisionModels(): ModelConfig[] {
  return Object.values(AVAILABLE_MODELS).filter(model =>
    model.supportsVision &&
    model.pricing?.inputTokens === 0 &&
    model.pricing?.outputTokens === 0
  );
}

/**
 * Get the best free vision model for a given provider
 * Returns the model with highest reliability score
 */
export function getBestFreeVisionModel(provider?: ModelProvider): ModelConfig | undefined {
  const freeVisionModels = getFreeVisionModels()
    .filter(model => !provider || model.provider === provider)
    .sort((a, b) => b.performance.reliability - a.performance.reliability);

  return freeVisionModels[0];
}

/**
 * OpenRouter account requirements notice
 * Even free models require a payment method or credits on file
 */
export const OPENROUTER_REQUIREMENTS = {
  requiresPaymentMethod: true,
  minimumCredits: 0,
  setupUrl: 'https://openrouter.ai/settings/payment',
  creditsUrl: 'https://openrouter.ai/credits',
  keysUrl: 'https://openrouter.ai/keys',
  note: 'OpenRouter requires a payment method or credits on file even for free models. This is for fraud prevention.'
};
