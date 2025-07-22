/**
 * Adaptive Rate Limiter
 * Phase 3: Batch Upload Optimization
 * 
 * Implements intelligent rate limiting with adaptive scaling,
 * quota tracking, and backoff mechanisms for API calls.
 */

import {
  RateLimitConfig,
  APIQuotaTracker,
  RateLimitPermission,
  RequestRecord,
  ErrorType,
  RateLimitStatus,
  AdaptiveMetrics,
  RateLimitEvent,
  PROCESSING_STRATEGIES,
  ProcessingStrategy
} from './types';

export class AdaptiveRateLimiter {
  private config: RateLimitConfig;
  private quotaTracker: APIQuotaTracker;
  private requestQueue: RequestRecord[];
  private lastApiCall: number = 0;
  private adaptiveMetrics: AdaptiveMetrics;
  private eventListeners: ((event: RateLimitEvent) => void)[] = [];

  constructor(config: RateLimitConfig) {
    this.config = { ...config };
    this.quotaTracker = {
      currentRequests: 0,
      requestsInLastMinute: 0,
      tokensInLastMinute: 0,
      lastResetTime: Date.now(),
      consecutiveErrors: 0,
      currentBackoffMs: 0
    };
    this.requestQueue = [];
    this.adaptiveMetrics = {
      successRate: 1.0,
      averageResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      lastAdjustment: Date.now()
    };
  }

  /**
   * Create rate limiter from processing strategy
   */
  static fromStrategy(strategyName: ProcessingStrategy['name']): AdaptiveRateLimiter {
    const strategy = PROCESSING_STRATEGIES[strategyName];
    const config: RateLimitConfig = {
      maxConcurrentRequests: strategy.maxConcurrent,
      requestsPerMinute: strategy.requestsPerMinute,
      tokensPerMinute: strategy.tokensPerMinute,
      burstAllowance: strategy.burstAllowance,
      backoffMultiplier: strategy.backoffMultiplier,
      maxBackoffMs: 300000, // 5 minutes max
      adaptiveScaling: strategy.adaptiveScaling
    };
    return new AdaptiveRateLimiter(config);
  }

  /**
   * Request permission to make an API call
   */
  async acquirePermission(estimatedTokens: number = 1000): Promise<RateLimitPermission> {
    const now = Date.now();
    
    // Clean old requests from tracking
    this.cleanOldRequests(now);
    
    // Apply adaptive scaling if enabled
    if (this.config.adaptiveScaling) {
      this.applyAdaptiveScaling(now);
    }

    // Check if we're in backoff period
    if (this.quotaTracker.currentBackoffMs > 0) {
      const backoffRemaining = this.quotaTracker.currentBackoffMs - (now - this.lastApiCall);
      if (backoffRemaining > 0) {
        const permission: RateLimitPermission = {
          allowed: false,
          delayMs: backoffRemaining,
          reason: 'backoff_period'
        };
        this.emitEvent({
          type: 'permission_denied',
          timestamp: now,
          delayMs: backoffRemaining,
          reason: 'backoff_period'
        });
        return permission;
      } else {
        this.quotaTracker.currentBackoffMs = 0;
      }
    }

    // Check concurrent request limit
    if (this.quotaTracker.currentRequests >= this.config.maxConcurrentRequests) {
      const permission: RateLimitPermission = {
        allowed: false,
        delayMs: 1000,
        reason: 'concurrent_limit'
      };
      this.emitEvent({
        type: 'permission_denied',
        timestamp: now,
        delayMs: 1000,
        reason: 'concurrent_limit'
      });
      return permission;
    }

    // Check rate limits
    const requestsCheck = this.quotaTracker.requestsInLastMinute < this.config.requestsPerMinute;
    const tokensCheck = this.quotaTracker.tokensInLastMinute + estimatedTokens <= this.config.tokensPerMinute;
    
    if (!requestsCheck || !tokensCheck) {
      // Calculate delay until next minute window
      const nextWindowMs = 60000 - (now % 60000);
      const permission: RateLimitPermission = {
        allowed: false,
        delayMs: nextWindowMs,
        reason: !requestsCheck ? 'requests_limit' : 'tokens_limit'
      };
      this.emitEvent({
        type: 'permission_denied',
        timestamp: now,
        delayMs: nextWindowMs,
        reason: permission.reason
      });
      return permission;
    }

    // Check burst allowance
    const timeSinceLastCall = now - this.lastApiCall;
    const minInterval = 60000 / this.config.requestsPerMinute;
    
    if (timeSinceLastCall < minInterval && this.quotaTracker.requestsInLastMinute > this.config.burstAllowance) {
      const requiredDelay = minInterval - timeSinceLastCall;
      const permission: RateLimitPermission = {
        allowed: false,
        delayMs: requiredDelay,
        reason: 'burst_limit'
      };
      this.emitEvent({
        type: 'permission_denied',
        timestamp: now,
        delayMs: requiredDelay,
        reason: 'burst_limit'
      });
      return permission;
    }

    // Permission granted
    this.recordRequest(now, estimatedTokens);
    const permission: RateLimitPermission = {
      allowed: true,
      delayMs: 0
    };
    this.emitEvent({
      type: 'permission_granted',
      timestamp: now,
      tokens: estimatedTokens
    });
    return permission;
  }

  /**
   * Record successful API call
   */
  recordSuccess(actualTokens: number, responseTimeMs?: number): void {
    this.quotaTracker.currentRequests = Math.max(0, this.quotaTracker.currentRequests - 1);
    this.quotaTracker.consecutiveErrors = 0;
    this.lastApiCall = Date.now();
    
    // Update token usage if different from estimate
    const lastRequest = this.requestQueue[this.requestQueue.length - 1];
    if (lastRequest && actualTokens !== lastRequest.tokens) {
      this.quotaTracker.tokensInLastMinute += (actualTokens - lastRequest.tokens);
      lastRequest.tokens = actualTokens;
    }

    // Update adaptive metrics
    if (responseTimeMs) {
      this.updateAdaptiveMetrics(true, responseTimeMs);
    }

    this.emitEvent({
      type: 'success',
      timestamp: Date.now(),
      tokens: actualTokens
    });
  }

  /**
   * Record API call error
   */
  recordError(errorType: ErrorType): void {
    this.quotaTracker.currentRequests = Math.max(0, this.quotaTracker.currentRequests - 1);
    this.quotaTracker.consecutiveErrors++;
    this.lastApiCall = Date.now();

    if (errorType === 'rate_limit') {
      // Exponential backoff for rate limiting
      this.quotaTracker.currentBackoffMs = Math.min(
        1000 * Math.pow(this.config.backoffMultiplier, this.quotaTracker.consecutiveErrors),
        this.config.maxBackoffMs
      );
      
      this.emitEvent({
        type: 'backoff_applied',
        timestamp: Date.now(),
        delayMs: this.quotaTracker.currentBackoffMs,
        errorType
      });
    }

    // Update adaptive metrics
    this.updateAdaptiveMetrics(false);

    this.emitEvent({
      type: 'error',
      timestamp: Date.now(),
      errorType
    });
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    const now = Date.now();
    this.cleanOldRequests(now);

    return {
      isRateLimited: this.quotaTracker.currentBackoffMs > 0,
      requestsRemaining: Math.max(0, this.config.requestsPerMinute - this.quotaTracker.requestsInLastMinute),
      tokensRemaining: Math.max(0, this.config.tokensPerMinute - this.quotaTracker.tokensInLastMinute),
      resetTime: now + (60000 - (now % 60000)),
      backoffMs: this.quotaTracker.currentBackoffMs,
      consecutiveErrors: this.quotaTracker.consecutiveErrors
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Get adaptive metrics
   */
  getMetrics(): AdaptiveMetrics {
    return { ...this.adaptiveMetrics };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: RateLimitEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: RateLimitEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private recordRequest(timestamp: number, tokens: number): void {
    this.quotaTracker.currentRequests++;
    this.quotaTracker.requestsInLastMinute++;
    this.quotaTracker.tokensInLastMinute += tokens;
    this.requestQueue.push({ timestamp, tokens });
  }

  private cleanOldRequests(now: number): void {
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    while (this.requestQueue.length > 0 && this.requestQueue[0].timestamp < oneMinuteAgo) {
      const oldRequest = this.requestQueue.shift()!;
      this.quotaTracker.requestsInLastMinute--;
      this.quotaTracker.tokensInLastMinute -= oldRequest.tokens;
    }

    // Reset counters if needed
    if (now - this.quotaTracker.lastResetTime > 60000) {
      this.quotaTracker.requestsInLastMinute = this.requestQueue.length;
      this.quotaTracker.tokensInLastMinute = this.requestQueue.reduce((sum, req) => sum + req.tokens, 0);
      this.quotaTracker.lastResetTime = now;
    }
  }

  private updateAdaptiveMetrics(success: boolean, responseTimeMs?: number): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.adaptiveMetrics.lastAdjustment;
    
    // Update success rate with exponential moving average
    const alpha = 0.1; // Smoothing factor
    this.adaptiveMetrics.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * this.adaptiveMetrics.successRate;
    this.adaptiveMetrics.errorRate = 1 - this.adaptiveMetrics.successRate;
    
    // Update response time
    if (responseTimeMs) {
      this.adaptiveMetrics.averageResponseTime = alpha * responseTimeMs + (1 - alpha) * this.adaptiveMetrics.averageResponseTime;
    }
    
    // Update throughput (requests per second)
    if (timeSinceLastUpdate > 0) {
      const currentThroughput = 1000 / timeSinceLastUpdate; // Convert to requests per second
      this.adaptiveMetrics.throughput = alpha * currentThroughput + (1 - alpha) * this.adaptiveMetrics.throughput;
    }
  }

  private applyAdaptiveScaling(now: number): void {
    const timeSinceLastAdjustment = now - this.adaptiveMetrics.lastAdjustment;
    
    // Only adjust every 30 seconds
    if (timeSinceLastAdjustment < 30000) return;
    
    const metrics = this.adaptiveMetrics;
    
    // Increase limits if performing well
    if (metrics.successRate > 0.95 && metrics.errorRate < 0.05) {
      this.config.requestsPerMinute = Math.min(this.config.requestsPerMinute * 1.1, 200);
      this.config.tokensPerMinute = Math.min(this.config.tokensPerMinute * 1.1, 300000);
    }
    // Decrease limits if experiencing errors
    else if (metrics.successRate < 0.8 || metrics.errorRate > 0.2) {
      this.config.requestsPerMinute = Math.max(this.config.requestsPerMinute * 0.8, 10);
      this.config.tokensPerMinute = Math.max(this.config.tokensPerMinute * 0.8, 10000);
    }
    
    this.adaptiveMetrics.lastAdjustment = now;
  }

  private emitEvent(event: RateLimitEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in rate limit event listener:', error);
      }
    });
  }
}
