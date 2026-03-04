/**
 * Enhanced model configuration system with multiple providers
 * Supports Google Gemini, OpenRouter, and other AI model providers
 */

export type ModelProvider = 'gemini' | 'openrouter' | 'kilo' | 'opencode' | 'groq';

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
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
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

  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
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
  },

  // New OpenRouter Free Models
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

  // Additional OpenRouter Free Vision Models (Updated 2024)
  'openrouter/google/gemini-2.5-flash-preview-05-20:free': {
    id: 'openrouter/google/gemini-2.5-flash-preview-05-20:free',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Google\'s latest Gemini 2.5 Flash preview with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'excellent',
      reliability: 0.90
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 1000000
    }
  },
  'openrouter/meta-llama/llama-3.2-11b-vision-instruct:free': {
    id: 'openrouter/meta-llama/llama-3.2-11b-vision-instruct:free',
    name: 'Llama 3.2 11B Vision',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true,
    description: 'Meta\'s Llama 3.2 11B with vision capabilities (Free)',
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
      contextWindow: 128000
    }
  },
  'openrouter/qwen/qwen-2.5-72b-instruct:free': {
    id: 'openrouter/qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: false,
    description: 'Qwen 2.5 72B instruct model - excellent for text analysis (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      reliability: 0.90
    },
    capabilities: {
      maxImageSize: 0,
      supportedFormats: [],
      contextWindow: 32768
    }
  },
  'openrouter/deepseek/deepseek-chat-v3-0324:free': {
    id: 'openrouter/deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek Chat V3',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: false,
    description: 'DeepSeek V3 chat model - strong reasoning capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'excellent',
      reliability: 0.89
    },
    capabilities: {
      maxImageSize: 0,
      supportedFormats: [],
      contextWindow: 64000
    }
  },

  // ==========================================
  // Groq Models (Vision-Capable)
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
  // Kilo Gateway Models (Vision-Capable)
  // ==========================================
  'kilo/google/gemma-3-27b-it': {
    id: 'kilo/google/gemma-3-27b-it',
    name: 'Gemma 3 27B Instruct',
    provider: 'kilo',
    endpoint: 'https://api.kilo.ai/api/gateway/chat/completions',
    apiKeyEnvVar: 'KILO_API_KEY',
    temperature: 0.2,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Google Gemma 3 27B with vision capabilities (via Kilo)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.88
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 8192
    }
  },
  'kilo/qwen/qwen2.5-vl-72b-instruct': {
    id: 'kilo/qwen/qwen2.5-vl-72b-instruct',
    name: 'Qwen 2.5 VL 72B Instruct',
    provider: 'kilo',
    endpoint: 'https://api.kilo.ai/api/gateway/chat/completions',
    apiKeyEnvVar: 'KILO_API_KEY',
    temperature: 0.2,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Qwen 2.5 Vision-Language 72B model (via Kilo)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'excellent',
      reliability: 0.90
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 32768
    }
  },
  'kilo/moonshotai/kimi-k2.5': {
    id: 'kilo/moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'kilo',
    endpoint: 'https://api.kilo.ai/api/gateway/chat/completions',
    apiKeyEnvVar: 'KILO_API_KEY',
    temperature: 0.2,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Moonshot Kimi K2.5 with vision capabilities (via Kilo)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'medium',
      accuracy: 'very-good',
      reliability: 0.90
    },
    capabilities: {
      maxImageSize: 4 * 1024 * 1024, // 4MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 128000
    }
  },

  // ==========================================
  // OpenCode Zen Models (Free Vision-Capable)
  // ==========================================
  'opencode/gpt-5-nano': {
    id: 'opencode/gpt-5-nano',
    name: 'GPT 5 Nano',
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY',
    temperature: 0.3,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: false,
    description: 'OpenAI GPT 5 Nano (chat-completions path used as text-only for stability)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.95
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 100000
    }
  },
  'opencode/kimi-k2.5-free': {
    id: 'opencode/kimi-k2.5-free',
    name: 'Kimi K2.5 Free',
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY',
    temperature: 0.3,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Moonshot AI Kimi K2.5 with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.92
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 128000
    }
  },
  'opencode/minimax-m2.5-free': {
    id: 'opencode/minimax-m2.5-free',
    name: 'MiniMax M2.5 Free',
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY',
    temperature: 0.3,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'MiniMax M2.5 with vision capabilities (Free)',
    pricing: {
      inputTokens: 0,
      outputTokens: 0
    },
    performance: {
      speed: 'fast',
      accuracy: 'very-good',
      reliability: 0.90
    },
    capabilities: {
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 100000
    }
  },
  'opencode/glm-5-free': {
    id: 'opencode/glm-5-free',
    name: 'GLM 5 Free',
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY',
    temperature: 0.3,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Zhipu AI GLM 5 with vision capabilities (Free)',
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
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 100000
    }
  },
  'opencode/big-pickle': {
    id: 'opencode/big-pickle',
    name: 'Big Pickle',
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    apiKeyEnvVar: 'OPENCODE_ZEN_API_KEY',
    temperature: 0.3,
    maxTokens: 4096,
    supportsText: true,
    supportsVision: true,
    description: 'Stealth model by OpenCode - free with vision (beta)',
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
      maxImageSize: 5 * 1024 * 1024, // 5MB
      supportedFormats: ['image/jpeg', 'image/png'],
      contextWindow: 100000
    }
  }
};

// Default models for different scenarios
export const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash-lite',
  vision: 'gemini-2.5-flash-lite',
  fast: 'gemini-2.5-flash-lite',
  accurate: 'gemini-2.5-pro',
  economical: 'gemini-2.5-flash-lite'
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
    'kilo/google/gemma-3-27b-it:free': 'kilo/google/gemma-3-27b-it',
    'kilo/qwen/qwen2-vl-72b-instruct:free': 'kilo/qwen/qwen2.5-vl-72b-instruct',
    'kilo/liuhaotian/llava-v1.6-34b:free': 'kilo/moonshotai/kimi-k2.5',
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

/**
 * Kilo Gateway account requirements notice
 * Free models available with API key
 */
export const KILO_REQUIREMENTS = {
  requiresPaymentMethod: false,
  minimumCredits: 0,
  setupUrl: 'https://app.kilo.ai',
  keysUrl: 'https://app.kilo.ai/api-keys',
  note: 'Kilo Gateway offers free tiers with API key registration.'
};

/**
 * OpenCode Zen account requirements notice
 * Several free models available
 */
export const OPENCODE_ZEN_REQUIREMENTS = {
  requiresPaymentMethod: false,
  minimumCredits: 0,
  setupUrl: 'https://opencode.ai/auth',
  keysUrl: 'https://opencode.ai/zen',
  note: 'OpenCode Zen offers several free models including GPT-5 Nano, Kimi K2.5 Free, MiniMax M2.5 Free, GLM 5 Free, and Big Pickle.'
};
