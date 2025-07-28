/**
 * Rate Limiting Library
 * Phase 3: Batch Upload Optimization
 *
 * Exports all rate limiting components for batch upload optimization.
 */

// Import classes for local use
import { RateLimitingManager } from './RateLimitingManager';

// Core classes
export { AdaptiveRateLimiter } from './AdaptiveRateLimiter';
export { QuotaTrackingService } from './QuotaTrackingService';
export { RateLimitingManager } from './RateLimitingManager';

// Types and interfaces
export type {
  RateLimitConfig,
  APIQuotaTracker,
  RateLimitPermission,
  RequestRecord,
  ErrorType,
  RateLimitStatus,
  ProcessingStrategy,
  AdaptiveMetrics,
  RateLimitEvent
} from './types';

export type {
  QuotaUsage,
  QuotaUpdateResult
} from './QuotaTrackingService';

export type {
  RateLimitingManagerConfig,
  EnhancedRateLimitStatus
} from './RateLimitingManager';

// Constants
export { PROCESSING_STRATEGIES } from './types';

// Utility functions
export const createRateLimitingManager = (config: {
  apiProvider: string;
  strategy: ProcessingStrategy['name'];
  quotaLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  enablePersistentTracking?: boolean;
}) => {
  return new RateLimitingManager({
    ...config,
    enablePersistentTracking: config.enablePersistentTracking ?? true
  });
};

export const getDefaultQuotaLimits = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'gemini':
      return {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      };
    case 'openai':
      return {
        requestsPerMinute: 50,
        tokensPerMinute: 80000
      };
    default:
      return {
        requestsPerMinute: 30,
        tokensPerMinute: 50000
      };
  }
};

export const estimateTokensFromText = (text: string): number => {
  // Rough estimation: 1 token ≈ 4 characters for most models
  return Math.ceil(text.length / 4);
};

export const estimateTokensFromImageSize = (sizeBytes: number): number => {
  // Rough estimation for image processing tokens
  // Based on typical vision model token usage
  const sizeMB = sizeBytes / (1024 * 1024);
  return Math.ceil(sizeMB * 1000); // ~1000 tokens per MB
};
