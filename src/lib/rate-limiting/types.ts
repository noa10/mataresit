/**
 * Rate Limiting Types and Interfaces
 * Phase 3: Batch Upload Optimization
 */

export interface RateLimitConfig {
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstAllowance: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  adaptiveScaling: boolean;
}

export interface APIQuotaTracker {
  currentRequests: number;
  requestsInLastMinute: number;
  tokensInLastMinute: number;
  lastResetTime: number;
  consecutiveErrors: number;
  currentBackoffMs: number;
}

export interface RateLimitPermission {
  allowed: boolean;
  delayMs: number;
  reason?: string;
}

export interface RequestRecord {
  timestamp: number;
  tokens: number;
}

export type ErrorType = 'rate_limit' | 'timeout' | 'server_error';

export interface RateLimitStatus {
  isRateLimited: boolean;
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: number;
  backoffMs: number;
  consecutiveErrors: number;
}

export interface ProcessingStrategy {
  name: 'conservative' | 'balanced' | 'aggressive' | 'adaptive';
  maxConcurrent: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstAllowance: number;
  backoffMultiplier: number;
  adaptiveScaling: boolean;
}

// Predefined processing strategies
export const PROCESSING_STRATEGIES: Record<ProcessingStrategy['name'], ProcessingStrategy> = {
  conservative: {
    name: 'conservative',
    maxConcurrent: 1,
    requestsPerMinute: 30,
    tokensPerMinute: 50000,
    burstAllowance: 5,
    backoffMultiplier: 2.0,
    adaptiveScaling: false
  },
  balanced: {
    name: 'balanced',
    maxConcurrent: 2,
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstAllowance: 10,
    backoffMultiplier: 1.5,
    adaptiveScaling: true
  },
  aggressive: {
    name: 'aggressive',
    maxConcurrent: 4,
    requestsPerMinute: 120,
    tokensPerMinute: 200000,
    burstAllowance: 20,
    backoffMultiplier: 1.2,
    adaptiveScaling: true
  },
  adaptive: {
    name: 'adaptive',
    maxConcurrent: 3,
    requestsPerMinute: 90,
    tokensPerMinute: 150000,
    burstAllowance: 15,
    backoffMultiplier: 1.8,
    adaptiveScaling: true
  }
};

export interface AdaptiveMetrics {
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastAdjustment: number;
}

export interface RateLimitEvent {
  type: 'permission_granted' | 'permission_denied' | 'success' | 'error' | 'backoff_applied';
  timestamp: number;
  tokens?: number;
  delayMs?: number;
  errorType?: ErrorType;
  reason?: string;
}
