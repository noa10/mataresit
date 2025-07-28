/**
 * Time estimation utilities for receipt processing
 */

export interface ProcessingTimeEstimate {
  estimatedTimeMs: number;
  estimatedTimeRemaining: number;
  averageTimePerStage: Record<string, number>;
  confidence: 'low' | 'medium' | 'high';
}

export interface ProcessingMetrics {
  startTime: number;
  stageStartTimes: Record<string, number>;
  stageCompletionTimes: Record<string, number>;
  fileSize: number;
  processingMethod: 'ocr-ai' | 'ai-vision';
  modelId: string;
}

// Base time estimates in milliseconds for different processing stages
const BASE_STAGE_TIMES = {
  START: 2000,      // Upload time
  FETCH: 1000,      // File processing
  OCR: 8000,        // OCR processing (varies by method)
  GEMINI: 12000,    // AI analysis
  SAVE: 2000,       // Database save
  COMPLETE: 500     // Finalization
};

// Time multipliers based on processing method
const METHOD_MULTIPLIERS = {
  'ocr-ai': {
    OCR: 1.0,         // Standard OCR time
    GEMINI: 0.8,      // Faster AI enhancement
  },
  'ai-vision': {
    OCR: 0.3,         // Minimal OCR (just image prep)
    GEMINI: 1.5,      // Longer AI vision processing
  }
};

// Time multipliers based on file size (in MB)
const SIZE_MULTIPLIERS = {
  small: 0.7,   // < 1MB
  medium: 1.0,  // 1-3MB
  large: 1.4,   // 3-5MB
  xlarge: 1.8   // > 5MB
};

// Model-specific multipliers
const MODEL_MULTIPLIERS: Record<string, number> = {
  'gemini-2.0-flash-lite': 0.7,
  'gemini-2.0-flash': 0.75,
  'gemini-2.5-flash': 0.8,
  'gemini-2.5-flash-lite': 0.65, // Fastest and most efficient model
  'gemini-2.5-flash-lite-preview-06-17': 0.75,
  'gemini-2.5-pro': 1.0,
  'openrouter/google/gemini-2.0-flash-exp:free': 0.9,
  'openrouter/google/gemma-3-27b-it:free': 1.0,
  'openrouter/qwen/qwen2.5-vl-72b-instruct:free': 1.1,
  'openrouter/mistralai/mistral-small-3.1-24b-instruct:free': 0.95,
  'openrouter/meta-llama/llama-4-scout:free': 1.05,
  'openrouter/opengvlab/internvl3-14b:free': 1.15,
  'openrouter/moonshotai/kimi-vl-a3b-thinking:free': 1.2,
};

/**
 * Get file size category for time estimation
 */
function getFileSizeCategory(sizeInBytes: number): keyof typeof SIZE_MULTIPLIERS {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  if (sizeInMB < 1) return 'small';
  if (sizeInMB < 3) return 'medium';
  if (sizeInMB < 5) return 'large';
  return 'xlarge';
}

/**
 * Calculate initial time estimate for processing
 */
export function calculateInitialEstimate(
  fileSize: number,
  processingMethod: 'ocr-ai' | 'ai-vision',
  modelId: string = 'gemini-2.0-flash-lite'
): ProcessingTimeEstimate {
  const sizeCategory = getFileSizeCategory(fileSize);
  const sizeMultiplier = SIZE_MULTIPLIERS[sizeCategory];
  const modelMultiplier = MODEL_MULTIPLIERS[modelId] || 1.0;
  const methodMultipliers = METHOD_MULTIPLIERS[processingMethod];

  const estimatedStages: Record<string, number> = {};
  let totalTime = 0;

  // Calculate time for each stage
  Object.entries(BASE_STAGE_TIMES).forEach(([stage, baseTime]) => {
    let stageTime = baseTime * sizeMultiplier * modelMultiplier;
    
    // Apply method-specific multipliers
    if (methodMultipliers[stage as keyof typeof methodMultipliers]) {
      stageTime *= methodMultipliers[stage as keyof typeof methodMultipliers];
    }
    
    estimatedStages[stage] = stageTime;
    totalTime += stageTime;
  });

  // Determine confidence based on factors
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (sizeCategory === 'xlarge' || modelId.includes('pro')) {
    confidence = 'low'; // Less predictable for large files or complex models
  } else if (sizeCategory === 'small' && modelId.includes('flash')) {
    confidence = 'high'; // Very predictable for small files with fast models
  }

  return {
    estimatedTimeMs: totalTime,
    estimatedTimeRemaining: totalTime,
    averageTimePerStage: estimatedStages,
    confidence
  };
}

/**
 * Update time estimate based on actual progress
 */
export function updateTimeEstimate(
  metrics: ProcessingMetrics,
  currentStage: string,
  completedStages: string[]
): ProcessingTimeEstimate {
  const now = Date.now();
  const elapsed = now - metrics.startTime;
  
  // Calculate actual times for completed stages
  const actualStageTimes: Record<string, number> = {};
  completedStages.forEach(stage => {
    if (metrics.stageStartTimes[stage] && metrics.stageCompletionTimes[stage]) {
      actualStageTimes[stage] = metrics.stageCompletionTimes[stage] - metrics.stageStartTimes[stage];
    }
  });

  // Get initial estimate for comparison
  const initialEstimate = calculateInitialEstimate(
    metrics.fileSize,
    metrics.processingMethod,
    metrics.modelId
  );

  // Calculate remaining stages
  const allStages = Object.keys(BASE_STAGE_TIMES);
  const remainingStages = allStages.filter(stage => 
    !completedStages.includes(stage) && stage !== currentStage
  );

  // Estimate time for current stage (if in progress)
  let currentStageRemaining = 0;
  if (currentStage && metrics.stageStartTimes[currentStage]) {
    const currentStageElapsed = now - metrics.stageStartTimes[currentStage];
    const estimatedCurrentStageTotal = initialEstimate.averageTimePerStage[currentStage] || 5000;
    currentStageRemaining = Math.max(0, estimatedCurrentStageTotal - currentStageElapsed);
  }

  // Estimate remaining time based on actual performance
  let remainingTime = currentStageRemaining;
  
  // Calculate performance ratio from completed stages
  let performanceRatio = 1.0;
  if (Object.keys(actualStageTimes).length > 0) {
    const actualTotal = Object.values(actualStageTimes).reduce((sum, time) => sum + time, 0);
    const estimatedTotal = Object.keys(actualStageTimes)
      .reduce((sum, stage) => sum + (initialEstimate.averageTimePerStage[stage] || 0), 0);
    
    if (estimatedTotal > 0) {
      performanceRatio = actualTotal / estimatedTotal;
    }
  }

  // Add time for remaining stages (adjusted by performance ratio)
  remainingStages.forEach(stage => {
    const estimatedStageTime = initialEstimate.averageTimePerStage[stage] || 5000;
    remainingTime += estimatedStageTime * performanceRatio;
  });

  // Determine confidence based on how much we've completed
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  const completionRatio = completedStages.length / allStages.length;
  if (completionRatio > 0.6) {
    confidence = 'high';
  } else if (completionRatio < 0.3) {
    confidence = 'low';
  }

  return {
    estimatedTimeMs: elapsed + remainingTime,
    estimatedTimeRemaining: remainingTime,
    averageTimePerStage: { ...initialEstimate.averageTimePerStage, ...actualStageTimes },
    confidence
  };
}

/**
 * Format time duration for display
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return 'Less than 1 second';
  }
  
  const seconds = Math.ceil(milliseconds / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Get processing speed indicator
 */
export function getProcessingSpeed(
  completedStages: number,
  totalStages: number,
  elapsedTime: number
): { speed: 'slow' | 'normal' | 'fast'; description: string } {
  if (completedStages === 0) {
    return { speed: 'normal', description: 'Starting...' };
  }
  
  const averageTimePerStage = elapsedTime / completedStages;
  
  if (averageTimePerStage < 3000) {
    return { speed: 'fast', description: 'Processing quickly' };
  } else if (averageTimePerStage > 8000) {
    return { speed: 'slow', description: 'Processing slowly' };
  } else {
    return { speed: 'normal', description: 'Processing normally' };
  }
}
