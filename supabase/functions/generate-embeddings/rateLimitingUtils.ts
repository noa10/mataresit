/**
 * Rate Limiting Utilities for Generate Embeddings Function
 * Phase 3: Batch Upload Optimization
 * 
 * Utility functions for integrating rate limiting with embedding generation.
 */

import { EdgeRateLimitingManager, ProcessingStrategy, RateLimitPermission } from './rateLimitingManager.ts';

// Global rate limiting manager instance
let globalRateLimitingManager: EdgeRateLimitingManager | null = null;

/**
 * Initialize the global rate limiting manager
 */
export function initializeRateLimiting(
  strategy: ProcessingStrategy = 'balanced',
  supabaseUrl?: string,
  supabaseKey?: string
): EdgeRateLimitingManager {
  if (!globalRateLimitingManager) {
    globalRateLimitingManager = new EdgeRateLimitingManager(strategy, supabaseUrl, supabaseKey);
    console.log(`🚀 Rate limiting manager initialized with strategy: ${strategy}`);
  }
  return globalRateLimitingManager;
}

/**
 * Get the global rate limiting manager
 */
export function getRateLimitingManager(): EdgeRateLimitingManager | null {
  return globalRateLimitingManager;
}

/**
 * Estimate tokens for text content
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // Rough estimation: 1 token ≈ 4 characters for most models
  // Add some buffer for safety
  return Math.ceil(text.length / 3.5);
}

/**
 * Estimate tokens for different content types
 */
export function estimateTokensForContent(content: string, contentType: string): number {
  const baseTokens = estimateTokens(content);
  
  // Apply multipliers based on content type complexity
  const multipliers: Record<string, number> = {
    'receipt_full': 1.2,      // Full receipt content is more complex
    'receipt_summary': 0.8,   // Summaries are more concise
    'line_item': 0.6,         // Line items are typically shorter
    'merchant': 0.4,          // Merchant names are short
    'category': 0.3,          // Categories are very short
    'default': 1.0
  };
  
  const multiplier = multipliers[contentType] || multipliers.default;
  return Math.ceil(baseTokens * multiplier);
}

/**
 * Wait for rate limit permission with intelligent backoff
 */
export async function waitForPermission(
  rateLimiter: EdgeRateLimitingManager,
  requestId: string,
  estimatedTokens: number,
  maxRetries: number = 3
): Promise<RateLimitPermission> {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    const permission = await rateLimiter.acquirePermission(requestId, estimatedTokens);
    
    if (permission.allowed) {
      return permission;
    }
    
    // If not allowed, wait for the suggested delay
    if (permission.delayMs > 0) {
      console.log(`⏳ Rate limited (${permission.reason}), waiting ${permission.delayMs}ms before retry ${retryCount + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, permission.delayMs));
    }
    
    retryCount++;
    
    // If we've exhausted retries, return the last permission result
    if (retryCount > maxRetries) {
      console.warn(`❌ Max retries (${maxRetries}) exceeded for request ${requestId}`);
      return permission;
    }
  }
  
  // This should never be reached, but return a denied permission as fallback
  return {
    allowed: false,
    delayMs: 0,
    reason: 'max_retries_exceeded',
    requestId
  };
}

/**
 * Enhanced embedding generation with rate limiting
 */
export async function generateEmbeddingWithRateLimit(
  text: string,
  contentType: string,
  generateEmbeddingFn: (text: string) => Promise<number[]>,
  rateLimiter?: EdgeRateLimitingManager
): Promise<{ embedding: number[]; rateLimited: boolean; tokensUsed: number }> {
  const requestId = crypto.randomUUID();
  const estimatedTokens = estimateTokensForContent(text, contentType);
  let rateLimited = false;
  
  // If rate limiting is enabled, request permission first
  if (rateLimiter) {
    const permission = await waitForPermission(rateLimiter, requestId, estimatedTokens);
    
    if (!permission.allowed) {
      console.warn(`❌ Rate limit permission denied for request ${requestId}: ${permission.reason}`);
      rateLimited = true;
      
      // Return a zero vector as fallback
      return {
        embedding: new Array(1536).fill(0), // Standard embedding dimension
        rateLimited: true,
        tokensUsed: 0
      };
    }
  }
  
  try {
    const startTime = performance.now();
    const embedding = await generateEmbeddingFn(text);
    const endTime = performance.now();
    
    // Record successful API call
    if (rateLimiter) {
      rateLimiter.recordSuccess(requestId, estimatedTokens, endTime - startTime);
    }
    
    console.log(`✅ Embedding generated successfully in ${(endTime - startTime).toFixed(2)}ms, tokens: ${estimatedTokens}`);
    
    return {
      embedding,
      rateLimited: false,
      tokensUsed: estimatedTokens
    };
  } catch (error) {
    console.error(`❌ Error generating embedding for request ${requestId}:`, error);
    
    // Determine error type for rate limiting
    let errorType: 'rate_limit' | 'timeout' | 'server_error' = 'server_error';
    
    if (error.message?.includes('rate limit') || 
        error.message?.includes('quota') || 
        error.message?.includes('429')) {
      errorType = 'rate_limit';
      rateLimited = true;
    } else if (error.message?.includes('timeout')) {
      errorType = 'timeout';
    }
    
    // Record error in rate limiter
    if (rateLimiter) {
      rateLimiter.recordError(requestId, errorType);
    }
    
    // Re-throw the error for upstream handling
    throw error;
  }
}

/**
 * Batch processing with rate limiting
 */
export async function processBatchWithRateLimit<T>(
  items: T[],
  processFn: (item: T) => Promise<any>,
  rateLimiter?: EdgeRateLimitingManager,
  batchSize: number = 5
): Promise<{ results: any[]; errors: any[]; rateLimitHits: number }> {
  const results: any[] = [];
  const errors: any[] = [];
  let rateLimitHits = 0;
  
  // Process items in batches to respect rate limits
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch items in parallel
    const batchPromises = batch.map(async (item, index) => {
      try {
        const result = await processFn(item);
        return { success: true, result, index: i + index };
      } catch (error) {
        // Check if this was a rate limiting error
        if (error.message?.includes('rate limit') || 
            error.message?.includes('quota') || 
            error.message?.includes('429')) {
          rateLimitHits++;
        }
        
        return { success: false, error, index: i + index };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process batch results
    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') {
        const { success, result: itemResult, error, index } = result.value;
        if (success) {
          results[index] = itemResult;
        } else {
          errors[index] = error;
        }
      } else {
        errors[i + batchIndex] = result.reason;
      }
    });
    
    // Add delay between batches if rate limiter suggests it
    if (rateLimiter && i + batchSize < items.length) {
      const status = rateLimiter.getStatus();
      if (status.isRateLimited || status.requestsRemaining < batchSize) {
        const delayMs = Math.max(1000, status.backoffMs || 2000);
        console.log(`⏳ Adding delay between batches: ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  return { results, errors, rateLimitHits };
}

/**
 * Get rate limiting status for monitoring
 */
export function getRateLimitingStatus(): any {
  if (!globalRateLimitingManager) {
    return { enabled: false, message: 'Rate limiting not initialized' };
  }
  
  const status = globalRateLimitingManager.getStatus();
  return {
    enabled: true,
    ...status,
    activeRequests: globalRateLimitingManager['activeRequests']?.size || 0
  };
}

/**
 * Update processing strategy at runtime
 */
export function updateProcessingStrategy(strategy: ProcessingStrategy): boolean {
  if (!globalRateLimitingManager) {
    console.warn('⚠️ Cannot update strategy: Rate limiting not initialized');
    return false;
  }
  
  globalRateLimitingManager.updateStrategy(strategy);
  console.log(`📊 Processing strategy updated to: ${strategy}`);
  return true;
}
