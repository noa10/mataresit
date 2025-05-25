/**
 * Intelligent processing optimization utilities
 * Provides automatic fallback mechanisms and processing method selection
 */

export interface ProcessingRecommendation {
  recommendedMethod: 'ocr-ai' | 'ai-vision';
  recommendedModel: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  fallbackStrategy: FallbackStrategy;
  estimatedProcessingTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FallbackStrategy {
  primaryMethod: 'ocr-ai' | 'ai-vision';
  primaryModel: string;
  fallbackMethod: 'ocr-ai' | 'ai-vision';
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

// Add missing type definitions
export type SystemLoad = 'low' | 'medium' | 'high';

export interface QueueItem {
  id: string;
  priority: 'low' | 'medium' | 'high';
  estimatedProcessingTime: number;
}

export interface ProcessingPlan {
  batches: {
    items: QueueItem[];
    estimatedTime: number;
    priority: 'low' | 'medium' | 'high';
  }[];
  estimatedTime: number;
  recommendedConcurrency: number;
}

// Import model configurations from the centralized config
import { AVAILABLE_MODELS, getModelConfig } from '@/config/modelProviders';

// Processing method characteristics
const METHOD_CHARACTERISTICS = {
  'ai-vision': {
    accuracy: 'excellent',
    speed: 'medium',
    resourceUsage: 'high',
    maxFileSize: 5 * 1024 * 1024,
    reliability: 0.88, // Lower due to resource limits
    bestFor: ['complex-receipts', 'handwritten', 'poor-quality']
  },
  'ocr-ai': {
    accuracy: 'very-good',
    speed: 'fast',
    resourceUsage: 'medium',
    maxFileSize: 10 * 1024 * 1024,
    reliability: 0.95,
    bestFor: ['simple-receipts', 'printed-text', 'good-quality']
  }
};

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
    preferredMethod?: 'ocr-ai' | 'ai-vision';
    preferredModel?: string;
    prioritizeSpeed?: boolean;
    prioritizeAccuracy?: boolean;
  }
): ProcessingRecommendation {
  const reasoning: string[] = [];
  let recommendedMethod: 'ocr-ai' | 'ai-vision' = 'ai-vision'; // Default
  let recommendedModel = 'gemini-2.0-flash-lite'; // Default
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Analyze file characteristics
  if (fileAnalysis.size > 4 * 1024 * 1024) {
    recommendedMethod = 'ocr-ai';
    recommendedModel = 'gemini-1.5-flash';
    reasoning.push('Large file size detected - OCR + AI method is more reliable for large files');
    riskLevel = 'medium';
  }

  if (fileAnalysis.complexity === 'high') {
    if (fileAnalysis.size < 3 * 1024 * 1024) {
      recommendedMethod = 'ai-vision';
      recommendedModel = 'gemini-1.5-pro';
      reasoning.push('High complexity receipt - AI Vision provides better accuracy for complex layouts');
    } else {
      recommendedMethod = 'ocr-ai';
      recommendedModel = 'gemini-1.5-pro';
      reasoning.push('High complexity + large size - OCR + AI method is more stable');
      riskLevel = 'medium';
    }
  }

  // Fix the type comparison error by properly checking complexity
  if (fileAnalysis.complexity === 'low' && fileAnalysis.size < 2 * 1024 * 1024) {
    recommendedMethod = 'ai-vision';
    recommendedModel = 'gemini-2.0-flash-lite';
    reasoning.push('Simple receipt detected - fast AI Vision processing recommended');
    confidence = 'high';
  }

  // Apply user preferences
  if (userPreferences?.preferredMethod) {
    const userMethod = userPreferences.preferredMethod;
    const methodChar = METHOD_CHARACTERISTICS[userMethod];

    if (fileAnalysis.size <= methodChar.maxFileSize) {
      recommendedMethod = userMethod;
      reasoning.push(`Using user preference: ${userMethod}`);
    } else {
      reasoning.push(`User preference ${userMethod} not suitable for file size, using optimized method`);
      riskLevel = 'medium';
    }
  }

  if (userPreferences?.prioritizeSpeed) {
    recommendedModel = 'gemini-2.0-flash-lite';
    reasoning.push('Speed prioritized - using fastest model');
  }

  if (userPreferences?.prioritizeAccuracy && fileAnalysis.size < 3 * 1024 * 1024) {
    recommendedModel = 'gemini-1.5-flash-latest';
    reasoning.push('Accuracy prioritized - using more accurate model');
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
  primaryMethod: 'ocr-ai' | 'ai-vision',
  primaryModel: string,
  fileAnalysis: FileAnalysis
): FallbackStrategy {
  // Determine fallback method (opposite of primary)
  const fallbackMethod: 'ocr-ai' | 'ai-vision' = primaryMethod === 'ai-vision' ? 'ocr-ai' : 'ai-vision';

  // Choose fallback model based on file characteristics
  let fallbackModel = 'gemini-1.5-flash';
  if (fileAnalysis.size > 3 * 1024 * 1024) {
    fallbackModel = 'gemini-2.0-flash-lite'; // Use fastest for large files
  } else if (fileAnalysis.complexity === 'high') {
    fallbackModel = 'gemini-1.5-pro'; // Use more accurate for complex files
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
export function getBatchProcessingOptimization(files: File[]): {
  recommendations: ProcessingRecommendation[];
  batchStrategy: {
    concurrentLimit: number;
    priorityOrder: number[];
    estimatedTotalTime: number;
  };
} {
  const recommendations = files.map(file => {
    const analysis = analyzeFile(file);
    return getProcessingRecommendation(analysis);
  });

  // Optimize batch processing
  let concurrentLimit = 2; // Default
  const totalComplexity = recommendations.reduce((sum, rec) =>
    sum + (rec.riskLevel === 'high' ? 3 : rec.riskLevel === 'medium' ? 2 : 1), 0
  );

  // Reduce concurrency for complex batches
  if (totalComplexity > files.length * 2) {
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

/**
 * Optimize processing queue based on system load
 */
export function optimizeProcessingQueue(
  items: QueueItem[],
  systemLoad: SystemLoad = 'medium'
): ProcessingPlan {
  const plan: ProcessingPlan = {
    batches: [],
    estimatedTime: 0,
    recommendedConcurrency: getRecommendedConcurrency(systemLoad)
  };

  if (items.length === 0) {
    return plan;
  }

  // Sort items by priority and size
  const sortedItems = [...items].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // For same priority, smaller files first for faster feedback
    return a.estimatedProcessingTime - b.estimatedProcessingTime;
  });

  // Group into batches
  const batchSize = getBatchSize(systemLoad);
  for (let i = 0; i < sortedItems.length; i += batchSize) {
    const batchItems = sortedItems.slice(i, i + batchSize);
    const maxTime = Math.max(...batchItems.map(item => item.estimatedProcessingTime));
    
    plan.batches.push({
      items: batchItems,
      estimatedTime: maxTime,
      priority: batchItems[0].priority
    });
  }

  // Calculate total estimated time
  plan.estimatedTime = plan.batches.reduce((total, batch) => total + batch.estimatedTime, 0);

  return plan;
}

function getRecommendedConcurrency(systemLoad: SystemLoad): number {
  switch (systemLoad) {
    case 'low': return 2;
    case 'medium': return 3;
    case 'high': return 1;
    default: return 2;
  }
}

function getBatchSize(systemLoad: SystemLoad): number {
  switch (systemLoad) {
    case 'low': return 8;
    case 'medium': return 5;
    case 'high': return 2;
    default: return 5;
  }
}
