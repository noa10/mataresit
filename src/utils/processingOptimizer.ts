/**
 * Intelligent processing optimization utilities
 * Provides AI model selection and processing optimization
 */

export interface ProcessingRecommendation {
  recommendedMethod: 'ai-vision';
  recommendedModel: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  fallbackStrategy: FallbackStrategy;
  estimatedProcessingTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FallbackStrategy {
  primaryMethod: 'ai-vision';
  primaryModel: string;
  fallbackMethod: 'ai-vision';
  fallbackModel: string;
  triggers: string[];
  maxRetries: number;
}

export interface FileAnalysis {
  size: number;
  type: string;
  dimensions?: { width: number; height: number };
  complexity: 'low' | 'medium' | 'high';
  isOptimized: boolean;
  estimatedProcessingDifficulty: number; // 1-10 scale
}

// Import model configurations from the centralized config
import { getModelConfig, AVAILABLE_MODELS, DEFAULT_MODELS } from '@/config/modelProviders';
import { selectModelForImageSize } from '../../supabase/functions/_shared/provider-routing';

/**
 * Resolve a candidate model to one that can actually accept this file size.
 *
 * Models declare `capabilities.maxImageSize`, but nothing ever enforced it —
 * it was only logged. With Groq (4MB) now primary, an oversized receipt is
 * sent to Groq, rejected by the provider, and only rescued by the server-side
 * fallback chain: one guaranteed failed round-trip per large file, plus the
 * added latency and error-log noise.
 *
 * This helper is the single guard point for that. It must be applied where the
 * model is actually selected — i.e. after `preferredModel` short-circuits the
 * size-based branches in getProcessingRecommendation, which run only when no
 * user preference is supplied.
 *
 * Applies to the upload path only. Reprocess paths (ReceiptViewer,
 * processBatchReceipts, the queue worker) have no client-side size knowledge,
 * so the same rule is enforced server-side by the SIZE PRE-ROUTE block in
 * supabase/functions/enhance-receipt-data/index.ts. The selection rule below
 * MUST stay in sync with that block — pick the highest-capacity vision model
 * that fits, and leave the model unchanged if none does.
 *
 * Returns the original model when it fits, otherwise the highest-capacity
 * vision model that does, or the original model if nothing fits (in which case
 * the server fallback chain remains the backstop).
 */
export function resolveModelForFileSize(
  modelId: string,
  fileSizeInBytes: number
): { modelId: string; adjusted: boolean } {
  const result = selectModelForImageSize({
    modelId,
    fileSizeInBytes,
    models: AVAILABLE_MODELS
  });

  if (result.adjusted) {
    const capInMB = (getModelConfig(modelId)?.capabilities.maxImageSize ?? 0) / (1024 * 1024);
    const sizeInMB = fileSizeInBytes / (1024 * 1024);
    console.warn(
      `[model-sizing] ${modelId} cap is ${capInMB.toFixed(1)}MB but file is ${sizeInMB.toFixed(1)}MB — routing to ${result.modelId}`
    );
  }

  return result;
}

/**
 * Analyze file characteristics to determine processing complexity
 */
export function analyzeFile(file: File, dimensions?: { width: number; height: number }): FileAnalysis {
  const size = file.size;
  const type = file.type;

  // Determine complexity based on multiple factors
  let complexity: 'low' | 'medium' | 'high' = 'medium';
  let estimatedProcessingDifficulty = 5;

  // Size-based complexity
  if (size < 500 * 1024) { // < 500KB
    complexity = 'low';
    estimatedProcessingDifficulty -= 2;
  } else if (size > 3 * 1024 * 1024) { // > 3MB
    complexity = 'high';
    estimatedProcessingDifficulty += 2;
  }

  // Dimension-based complexity (if available)
  if (dimensions) {
    const totalPixels = dimensions.width * dimensions.height;
    if (totalPixels > 4000000) { // > 4MP
      complexity = 'high';
      estimatedProcessingDifficulty += 1;
    } else if (totalPixels < 1000000) { // < 1MP
      estimatedProcessingDifficulty -= 1;
    }
  }

  // File type considerations
  if (type === 'application/pdf') {
    estimatedProcessingDifficulty += 1; // PDFs can be more complex
  }

  // Clamp difficulty to 1-10 range
  estimatedProcessingDifficulty = Math.max(1, Math.min(10, estimatedProcessingDifficulty));

  return {
    size,
    type,
    dimensions,
    complexity,
    isOptimized: size < 2 * 1024 * 1024, // Consider optimized if < 2MB
    estimatedProcessingDifficulty
  };
}

/**
 * Get intelligent processing recommendation based on file analysis
 */
export function getProcessingRecommendation(
  fileAnalysis: FileAnalysis,
  userPreferences?: {
    preferredModel?: string;
    prioritizeSpeed?: boolean;
    prioritizeAccuracy?: boolean;
  }
): ProcessingRecommendation {
  const reasoning: string[] = [];
  const recommendedMethod: 'ai-vision' = 'ai-vision'; // Always AI Vision
  let recommendedModel = DEFAULT_MODELS.vision;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // PRIORITY 1: User's preferred model takes highest priority
  if (userPreferences?.preferredModel) {
    recommendedModel = userPreferences.preferredModel;
    reasoning.push(`Using user's selected model: ${userPreferences.preferredModel}`);
    confidence = 'high'; // High confidence when user explicitly selects model
  } else {
    // PRIORITY 2: Analyze file characteristics for automatic model selection
    // Only apply automatic selection if user hasn't specified a model
    if (fileAnalysis.size > 8 * 1024 * 1024) {
      recommendedModel = 'gemini-3.1-flash-lite';
      reasoning.push('Very large file size detected - using higher-capacity AI Vision model');
      riskLevel = 'high';
    } else if (fileAnalysis.size > 6 * 1024 * 1024) {
      recommendedModel = 'gemini-3.1-flash-lite';
      reasoning.push('Large file size detected - using higher-capacity AI Vision model');
      riskLevel = 'medium';
    } else if (fileAnalysis.complexity === 'high' && fileAnalysis.size > 4 * 1024 * 1024) {
      // Also covers the Groq 4MB cap: analyzeFile classifies anything >3MB as
      // 'high' complexity, so every file that exceeds Groq's maxImageSize lands
      // in this branch and is routed to a 5MB-cap Gemini model. A dedicated
      // `size > 4MB` branch below would be unreachable.
      recommendedModel = 'gemini-3.1-flash-lite';
      reasoning.push('High complexity large receipt - newer Gemini model provides better accuracy');
      riskLevel = 'medium';
    } else if (fileAnalysis.estimatedProcessingDifficulty > 8) {
      recommendedModel = 'gemini-3.1-flash-lite';
      reasoning.push('Very complex receipt detected - using newer Gemini model');
      riskLevel = 'high';
    } else {
      // Default to Groq (qwen3.8-27b): free, ~7x faster than Gemini and
      // equivalent extraction quality. Bounded above by its 4MB image cap —
      // the size branches above route larger files to Gemini.
      recommendedModel = DEFAULT_MODELS.vision;
      reasoning.push('Using fast free Groq vision model for optimal processing');
      confidence = 'high';
    }
  }

  // Always use AI Vision processing
  reasoning.push('Using AI Vision processing for optimal accuracy');

  // PRIORITY 3: Apply speed/accuracy preferences only if no specific model was chosen
  if (!userPreferences?.preferredModel) {
    if (userPreferences?.prioritizeSpeed) {
      recommendedModel = DEFAULT_MODELS.fast;
      reasoning.push('Speed prioritized - using fastest model');
    }

    if (userPreferences?.prioritizeAccuracy && fileAnalysis.size < 4 * 1024 * 1024) {
      recommendedModel = 'gemini-3.1-flash-lite';
      reasoning.push('Accuracy prioritized - using newer Gemini model');
    }
  }

  // Determine confidence based on risk factors
  if (riskLevel === 'low' && fileAnalysis.complexity === 'low') {
    confidence = 'high';
  } else if (riskLevel === 'high' || fileAnalysis.estimatedProcessingDifficulty > 7) {
    confidence = 'low';
  }

  // Create fallback strategy
  const fallbackStrategy = createFallbackStrategy(recommendedMethod, recommendedModel, fileAnalysis);

  // Estimate processing time using the new model system
  const modelConfig = getModelConfig(recommendedModel);
  const sizeMultiplier = fileAnalysis.size > 2 * 1024 * 1024 ? 1.5 : 1.0;
  const complexityMultiplier = fileAnalysis.complexity === 'high' ? 1.3 :
                              fileAnalysis.complexity === 'low' ? 0.8 : 1.0;

  // Base processing time based on model performance
  const baseTime = modelConfig?.performance.speed === 'fast' ? 8000 :
                   modelConfig?.performance.speed === 'medium' ? 12000 : 20000;

  const estimatedProcessingTime = baseTime * sizeMultiplier * complexityMultiplier;

  return {
    recommendedMethod,
    recommendedModel,
    confidence,
    reasoning,
    fallbackStrategy,
    estimatedProcessingTime,
    riskLevel
  };
}

/**
 * Create a fallback strategy based on primary method and file characteristics
 */
function createFallbackStrategy(
  primaryMethod: 'ai-vision',
  primaryModel: string,
  fileAnalysis: FileAnalysis
): FallbackStrategy {
  // Use different AI Vision model as fallback
  const fallbackMethod: 'ai-vision' = 'ai-vision';

  // Choose fallback model based on file characteristics
  // Use different models for reliable fallback processing
  let fallbackModel = 'gemini-2.5-flash-lite';
  if (fileAnalysis.complexity === 'high') {
    fallbackModel = 'gemini-3.1-flash-lite'; // Newer model for complex files
  }

  // Ensure fallback model is different from primary model
  if (fallbackModel === primaryModel) {
    fallbackModel = primaryModel === 'groq/qwen/qwen3.8-27b'
      ? 'gemini-2.5-flash-lite'
      : 'groq/qwen/qwen3.8-27b';
  }

  // Define triggers for fallback
  const triggers = [
    'WORKER_LIMIT',
    'compute resources',
    'timeout',
    'resource limit',
    'processing failed',
    'too complex to process'
  ];

  // Determine max retries based on file characteristics
  let maxRetries = 2;
  if (fileAnalysis.size > 4 * 1024 * 1024 || fileAnalysis.complexity === 'high') {
    maxRetries = 1; // Fewer retries for problematic files
  }

  return {
    primaryMethod,
    primaryModel,
    fallbackMethod,
    fallbackModel,
    triggers,
    maxRetries
  };
}

/**
 * Check if an error should trigger fallback processing
 */
export function shouldTriggerFallback(error: string, fallbackStrategy: FallbackStrategy): boolean {
  const errorLower = error.toLowerCase();
  return fallbackStrategy.triggers.some(trigger =>
    errorLower.includes(trigger.toLowerCase())
  );
}

/**
 * Get optimized processing options for batch uploads
 */
export function getBatchProcessingOptimization(
  files: File[],
  userPreferences?: {
    preferredModel?: string;
    prioritizeSpeed?: boolean;
    prioritizeAccuracy?: boolean;
  }
): {
  recommendations: ProcessingRecommendation[];
  batchStrategy: {
    concurrentLimit: number;
    priorityOrder: number[];
    estimatedTotalTime: number;
  };
} {
  const recommendations = files.map(file => {
    const analysis = analyzeFile(file);
    return getProcessingRecommendation(analysis, userPreferences);
  });

  // Optimize batch processing
  let concurrentLimit = 2; // Default
  const totalComplexity = recommendations.reduce((sum, rec) =>
    sum + (rec.riskLevel === 'high' ? 3 : rec.riskLevel === 'medium' ? 2 : 1), 0
  );

  // Count files that will use a genuinely fast model. Groq is the default and
  // is free-tier rate-limited, so this intentionally does NOT raise
  // concurrency for Groq batches — the extra throughput would just trade one
  // error for a burst of 429s. Only a batch that is predominantly Gemini gets
  // the bump.
  const fastModelCount = recommendations.filter(rec =>
    rec.recommendedModel === 'gemini-2.5-flash-lite'
  ).length;
  const fastModelRatio = fastModelCount / recommendations.length;

  // Increase concurrency for batches using primarily fast models
  if (fastModelRatio > 0.7 && totalComplexity <= files.length * 1.5) {
    concurrentLimit = 3; // Higher concurrency for fast model batches
  }
  // Reduce concurrency for complex batches
  else if (totalComplexity > files.length * 2) {
    concurrentLimit = 1;
  }

  // Create priority order (simple files first)
  const priorityOrder = recommendations
    .map((rec, index) => ({ index, priority: rec.riskLevel === 'low' ? 1 : rec.riskLevel === 'medium' ? 2 : 3 }))
    .sort((a, b) => a.priority - b.priority)
    .map(item => item.index);

  const estimatedTotalTime = recommendations.reduce((sum, rec) => sum + rec.estimatedProcessingTime, 0);

  return {
    recommendations,
    batchStrategy: {
      concurrentLimit,
      priorityOrder,
      estimatedTotalTime
    }
  };
}
