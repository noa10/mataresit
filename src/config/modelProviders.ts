/**
 * Enhanced model configuration system with multiple providers
 * Supports Google Gemini, OpenRouter, and other AI model providers
 */

export type ModelProvider = 'gemini' | 'openrouter';

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
  // Google Gemini Models (Vision-capable only)

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
  'gemini-2.5-flash-preview-05-20': {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-preview-05-20:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true,
    description: 'Preview version of Gemini 2.5 Flash with enhanced capabilities',
    pricing: {
      inputTokens: 0.075,
      outputTokens: 0.30
    },
    performance: {
      speed: 'fast',
      accuracy: 'excellent',
      reliability: 0.93
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      contextWindow: 2000000
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

// Default models for different scenarios
export const DEFAULT_MODELS = {
  text: 'gemini-2.0-flash-lite',
  vision: 'gemini-2.0-flash-lite',
  fast: 'gemini-2.0-flash-lite',
  accurate: 'gemini-2.5-flash-preview-05-20',
  economical: 'gemini-2.0-flash-lite'
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
  return AVAILABLE_MODELS[modelId];
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
