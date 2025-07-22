/**
 * Rate Limiting Manager
 * Phase 3: Batch Upload Optimization
 * 
 * Coordinates between AdaptiveRateLimiter and QuotaTrackingService
 * to provide comprehensive rate limiting for batch uploads.
 */

import { AdaptiveRateLimiter } from './AdaptiveRateLimiter';
import { QuotaTrackingService } from './QuotaTrackingService';
import {
  RateLimitConfig,
  RateLimitPermission,
  ErrorType,
  RateLimitStatus,
  ProcessingStrategy,
  PROCESSING_STRATEGIES
} from './types';

export interface RateLimitingManagerConfig {
  apiProvider: string;
  strategy: ProcessingStrategy['name'];
  quotaLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  enablePersistentTracking: boolean;
}

export interface EnhancedRateLimitStatus extends RateLimitStatus {
  persistentQuotaUsage?: {
    requests: number;
    tokens: number;
    requestsRemaining: number;
    tokensRemaining: number;
  };
}

export class RateLimitingManager {
  private rateLimiter: AdaptiveRateLimiter;
  private quotaService: QuotaTrackingService;
  private config: RateLimitingManagerConfig;
  private activeRequests: Set<string> = new Set();

  constructor(config: RateLimitingManagerConfig) {
    this.config = config;
    this.rateLimiter = AdaptiveRateLimiter.fromStrategy(config.strategy);
    this.quotaService = QuotaTrackingService.getInstance();

    // Set up event listeners for quota tracking
    if (config.enablePersistentTracking) {
      this.setupQuotaTracking();
    }
  }

  /**
   * Request permission to make an API call with persistent quota checking
   */
  async acquirePermission(
    requestId: string,
    estimatedTokens: number = 1000
  ): Promise<RateLimitPermission & { requestId: string }> {
    // Check persistent quota limits first
    if (this.config.enablePersistentTracking) {
      const persistentCheck = await this.checkPersistentQuota(estimatedTokens);
      if (!persistentCheck.allowed) {
        return {
          ...persistentCheck,
          requestId
        };
      }
    }

    // Check local rate limiter
    const localPermission = await this.rateLimiter.acquirePermission(estimatedTokens);
    
    if (localPermission.allowed) {
      this.activeRequests.add(requestId);
    }

    return {
      ...localPermission,
      requestId
    };
  }

  /**
   * Record successful API call
   */
  async recordSuccess(
    requestId: string,
    actualTokens: number,
    responseTimeMs?: number
  ): Promise<void> {
    // Remove from active requests
    this.activeRequests.delete(requestId);

    // Record in local rate limiter
    this.rateLimiter.recordSuccess(actualTokens, responseTimeMs);

    // Record in persistent quota tracking
    if (this.config.enablePersistentTracking) {
      await Promise.all([
        this.quotaService.recordUsage(
          this.config.apiProvider,
          'requests',
          1,
          this.config.quotaLimits.requestsPerMinute
        ),
        this.quotaService.recordUsage(
          this.config.apiProvider,
          'tokens',
          actualTokens,
          this.config.quotaLimits.tokensPerMinute
        )
      ]);
    }
  }

  /**
   * Record API call error
   */
  async recordError(requestId: string, errorType: ErrorType): Promise<void> {
    // Remove from active requests
    this.activeRequests.delete(requestId);

    // Record in local rate limiter
    this.rateLimiter.recordError(errorType);

    // For rate limit errors, also record in persistent tracking
    if (errorType === 'rate_limit' && this.config.enablePersistentTracking) {
      // Mark as rate limited in persistent storage
      await Promise.all([
        this.quotaService.recordUsage(
          this.config.apiProvider,
          'requests',
          0, // Don't increment usage for failed requests
          this.config.quotaLimits.requestsPerMinute
        ),
        this.quotaService.recordUsage(
          this.config.apiProvider,
          'tokens',
          0,
          this.config.quotaLimits.tokensPerMinute
        )
      ]);
    }
  }

  /**
   * Get comprehensive rate limit status
   */
  async getStatus(): Promise<EnhancedRateLimitStatus> {
    const localStatus = this.rateLimiter.getStatus();
    
    let persistentQuotaUsage;
    if (this.config.enablePersistentTracking) {
      const [requestsUsage, tokensUsage] = await Promise.all([
        this.quotaService.getQuotaUsage(this.config.apiProvider, 'requests'),
        this.quotaService.getQuotaUsage(this.config.apiProvider, 'tokens')
      ]);

      persistentQuotaUsage = {
        requests: requestsUsage?.quotaUsed || 0,
        tokens: tokensUsage?.quotaUsed || 0,
        requestsRemaining: requestsUsage?.quotaRemaining || this.config.quotaLimits.requestsPerMinute,
        tokensRemaining: tokensUsage?.quotaRemaining || this.config.quotaLimits.tokensPerMinute
      };
    }

    return {
      ...localStatus,
      persistentQuotaUsage
    };
  }

  /**
   * Update processing strategy
   */
  updateStrategy(strategyName: ProcessingStrategy['name']): void {
    this.config.strategy = strategyName;
    this.rateLimiter = AdaptiveRateLimiter.fromStrategy(strategyName);
    
    // Re-setup quota tracking with new limits
    if (this.config.enablePersistentTracking) {
      const strategy = PROCESSING_STRATEGIES[strategyName];
      this.config.quotaLimits = {
        requestsPerMinute: strategy.requestsPerMinute,
        tokensPerMinute: strategy.tokensPerMinute
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitingManagerConfig {
    return { ...this.config };
  }

  /**
   * Get rate limiter metrics
   */
  getMetrics() {
    return this.rateLimiter.getMetrics();
  }

  /**
   * Get active requests count
   */
  getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
  }

  /**
   * Get quota statistics
   */
  async getQuotaStatistics(hours: number = 24) {
    if (!this.config.enablePersistentTracking) {
      return null;
    }
    return this.quotaService.getQuotaStatistics(this.config.apiProvider, hours);
  }

  /**
   * Reset quota (admin function)
   */
  async resetQuota(): Promise<boolean> {
    if (!this.config.enablePersistentTracking) {
      return false;
    }

    const [requestsReset, tokensReset] = await Promise.all([
      this.quotaService.resetQuota(this.config.apiProvider, 'requests'),
      this.quotaService.resetQuota(this.config.apiProvider, 'tokens')
    ]);

    return requestsReset && tokensReset;
  }

  private async checkPersistentQuota(estimatedTokens: number): Promise<RateLimitPermission> {
    try {
      const [requestsLimited, tokensLimited] = await Promise.all([
        this.quotaService.isRateLimited(this.config.apiProvider, 'requests'),
        this.quotaService.isRateLimited(this.config.apiProvider, 'tokens')
      ]);

      if (requestsLimited) {
        return {
          allowed: false,
          delayMs: 60000, // Wait until next minute
          reason: 'persistent_requests_limit'
        };
      }

      if (tokensLimited) {
        return {
          allowed: false,
          delayMs: 60000, // Wait until next minute
          reason: 'persistent_tokens_limit'
        };
      }

      // Check if we would exceed limits with this request
      const [requestsRemaining, tokensRemaining] = await Promise.all([
        this.quotaService.getRemainingQuota(this.config.apiProvider, 'requests'),
        this.quotaService.getRemainingQuota(this.config.apiProvider, 'tokens')
      ]);

      if (requestsRemaining <= 0) {
        return {
          allowed: false,
          delayMs: 60000,
          reason: 'persistent_requests_exhausted'
        };
      }

      if (tokensRemaining < estimatedTokens) {
        return {
          allowed: false,
          delayMs: 60000,
          reason: 'persistent_tokens_exhausted'
        };
      }

      return {
        allowed: true,
        delayMs: 0
      };
    } catch (error) {
      console.error('Error checking persistent quota:', error);
      // Allow request if quota check fails (fail open)
      return {
        allowed: true,
        delayMs: 0,
        reason: 'quota_check_failed'
      };
    }
  }

  private setupQuotaTracking(): void {
    // Listen to rate limiter events and sync with persistent storage
    this.rateLimiter.addEventListener((event) => {
      if (event.type === 'success' && event.tokens) {
        // Quota usage is recorded in recordSuccess method
      } else if (event.type === 'error' && event.errorType === 'rate_limit') {
        // Rate limit errors are handled in recordError method
      }
    });
  }
}
