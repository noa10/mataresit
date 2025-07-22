/**
 * Rate Limiting Manager for Generate Embeddings Function
 * Phase 3: Batch Upload Optimization
 * 
 * Integrates with the adaptive rate limiting system for intelligent
 * API quota management and backoff handling.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for rate limiting
export interface RateLimitConfig {
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstAllowance: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  adaptiveScaling: boolean;
}

export interface RateLimitPermission {
  allowed: boolean;
  delayMs: number;
  reason?: string;
  requestId: string;
}

export interface RateLimitStatus {
  isRateLimited: boolean;
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: number;
  backoffMs: number;
  consecutiveErrors: number;
}

export interface APIQuotaUsage {
  apiProvider: string;
  quotaType: 'requests' | 'tokens';
  timeWindow: Date;
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  isRateLimited: boolean;
  rateLimitResetAt?: Date;
}

export type ProcessingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'adaptive';

// Processing strategy configurations
const PROCESSING_STRATEGIES: Record<ProcessingStrategy, RateLimitConfig> = {
  conservative: {
    maxConcurrentRequests: 1,
    requestsPerMinute: 30,
    tokensPerMinute: 50000,
    burstAllowance: 5,
    backoffMultiplier: 2.0,
    maxBackoffMs: 300000,
    adaptiveScaling: false
  },
  balanced: {
    maxConcurrentRequests: 2,
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstAllowance: 10,
    backoffMultiplier: 1.5,
    maxBackoffMs: 180000,
    adaptiveScaling: true
  },
  aggressive: {
    maxConcurrentRequests: 4,
    requestsPerMinute: 120,
    tokensPerMinute: 200000,
    burstAllowance: 20,
    backoffMultiplier: 1.2,
    maxBackoffMs: 120000,
    adaptiveScaling: true
  },
  adaptive: {
    maxConcurrentRequests: 3,
    requestsPerMinute: 90,
    tokensPerMinute: 150000,
    burstAllowance: 15,
    backoffMultiplier: 1.8,
    maxBackoffMs: 240000,
    adaptiveScaling: true
  }
};

export class EdgeRateLimitingManager {
  private config: RateLimitConfig;
  private supabase: any;
  private activeRequests: Set<string> = new Set();
  private requestHistory: Array<{ timestamp: number; tokens: number }> = [];
  private consecutiveErrors: number = 0;
  private lastErrorTime: number = 0;
  private currentBackoffMs: number = 0;

  constructor(strategy: ProcessingStrategy = 'balanced', supabaseUrl?: string, supabaseKey?: string) {
    this.config = { ...PROCESSING_STRATEGIES[strategy] };
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Request permission to make an API call
   */
  async acquirePermission(requestId: string, estimatedTokens: number = 1000): Promise<RateLimitPermission> {
    const now = Date.now();
    
    // Clean old requests from tracking
    this.cleanOldRequests(now);
    
    // Check if we're in backoff period
    if (this.currentBackoffMs > 0) {
      const backoffRemaining = this.currentBackoffMs - (now - this.lastErrorTime);
      if (backoffRemaining > 0) {
        return {
          allowed: false,
          delayMs: backoffRemaining,
          reason: 'backoff_period',
          requestId
        };
      } else {
        this.currentBackoffMs = 0;
      }
    }

    // Check concurrent request limit
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return {
        allowed: false,
        delayMs: 1000,
        reason: 'concurrent_limit',
        requestId
      };
    }

    // Check rate limits
    const requestsInLastMinute = this.getRequestsInLastMinute(now);
    const tokensInLastMinute = this.getTokensInLastMinute(now);
    
    if (requestsInLastMinute >= this.config.requestsPerMinute) {
      const nextWindowMs = 60000 - (now % 60000);
      return {
        allowed: false,
        delayMs: nextWindowMs,
        reason: 'requests_limit',
        requestId
      };
    }
    
    if (tokensInLastMinute + estimatedTokens > this.config.tokensPerMinute) {
      const nextWindowMs = 60000 - (now % 60000);
      return {
        allowed: false,
        delayMs: nextWindowMs,
        reason: 'tokens_limit',
        requestId
      };
    }

    // Check burst allowance
    const recentRequests = this.requestHistory.filter(req => now - req.timestamp < 10000).length;
    if (recentRequests > this.config.burstAllowance) {
      return {
        allowed: false,
        delayMs: 2000,
        reason: 'burst_limit',
        requestId
      };
    }

    // Permission granted
    this.activeRequests.add(requestId);
    this.requestHistory.push({ timestamp: now, tokens: estimatedTokens });
    
    // Update persistent quota tracking if available
    if (this.supabase) {
      await this.updateQuotaTracking('gemini', 'requests', 1, this.config.requestsPerMinute);
      await this.updateQuotaTracking('gemini', 'tokens', estimatedTokens, this.config.tokensPerMinute);
    }

    return {
      allowed: true,
      delayMs: 0,
      requestId
    };
  }

  /**
   * Record successful API call
   */
  recordSuccess(requestId: string, actualTokens: number, responseTimeMs?: number): void {
    this.activeRequests.delete(requestId);
    this.consecutiveErrors = 0;
    
    // Update token usage if different from estimate
    const request = this.requestHistory.find(req => 
      Math.abs(req.timestamp - Date.now()) < 60000
    );
    if (request && actualTokens !== request.tokens) {
      request.tokens = actualTokens;
    }

    console.log(`✅ API call ${requestId} completed successfully, tokens: ${actualTokens}`);
  }

  /**
   * Record API call error
   */
  recordError(requestId: string, errorType: 'rate_limit' | 'timeout' | 'server_error'): void {
    this.activeRequests.delete(requestId);
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();

    if (errorType === 'rate_limit') {
      // Exponential backoff for rate limiting
      this.currentBackoffMs = Math.min(
        1000 * Math.pow(this.config.backoffMultiplier, this.consecutiveErrors),
        this.config.maxBackoffMs
      );
      
      console.log(`⏳ Rate limit hit, applying backoff: ${this.currentBackoffMs}ms`);
    }

    console.log(`❌ API call ${requestId} failed: ${errorType}, consecutive errors: ${this.consecutiveErrors}`);
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    const now = Date.now();
    this.cleanOldRequests(now);

    const requestsInLastMinute = this.getRequestsInLastMinute(now);
    const tokensInLastMinute = this.getTokensInLastMinute(now);

    return {
      isRateLimited: this.currentBackoffMs > 0,
      requestsRemaining: Math.max(0, this.config.requestsPerMinute - requestsInLastMinute),
      tokensRemaining: Math.max(0, this.config.tokensPerMinute - tokensInLastMinute),
      resetTime: now + (60000 - (now % 60000)),
      backoffMs: this.currentBackoffMs,
      consecutiveErrors: this.consecutiveErrors
    };
  }

  /**
   * Update processing strategy
   */
  updateStrategy(strategy: ProcessingStrategy): void {
    this.config = { ...PROCESSING_STRATEGIES[strategy] };
    console.log(`📊 Processing strategy updated to: ${strategy}`);
  }

  private cleanOldRequests(now: number): void {
    const oneMinuteAgo = now - 60000;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
  }

  private getRequestsInLastMinute(now: number): number {
    const oneMinuteAgo = now - 60000;
    return this.requestHistory.filter(req => req.timestamp > oneMinuteAgo).length;
  }

  private getTokensInLastMinute(now: number): number {
    const oneMinuteAgo = now - 60000;
    return this.requestHistory
      .filter(req => req.timestamp > oneMinuteAgo)
      .reduce((sum, req) => sum + req.tokens, 0);
  }

  private async updateQuotaTracking(
    apiProvider: string,
    quotaType: 'requests' | 'tokens',
    usage: number,
    quotaLimit: number
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      const timeWindow = this.getTimeWindow();
      
      const { error } = await this.supabase
        .from('api_quota_tracking')
        .upsert({
          api_provider: apiProvider,
          quota_type: quotaType,
          time_window: timeWindow.toISOString(),
          quota_used: usage,
          quota_limit: quotaLimit,
          is_rate_limited: usage >= quotaLimit,
          rate_limit_reset_at: usage >= quotaLimit ? this.getNextTimeWindow() : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'api_provider,quota_type,time_window',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error updating quota tracking:', error);
      }
    } catch (error) {
      console.error('Exception updating quota tracking:', error);
    }
  }

  private getTimeWindow(): Date {
    // Round down to the nearest minute
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
  }

  private getNextTimeWindow(): Date {
    const current = this.getTimeWindow();
    return new Date(current.getTime() + 60000); // Add 1 minute
  }
}
