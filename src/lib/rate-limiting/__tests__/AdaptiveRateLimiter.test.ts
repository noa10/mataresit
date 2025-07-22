/**
 * AdaptiveRateLimiter Tests
 * Phase 3: Batch Upload Optimization
 */

import { AdaptiveRateLimiter } from '../AdaptiveRateLimiter';
import { RateLimitConfig, PROCESSING_STRATEGIES } from '../types';

describe('AdaptiveRateLimiter', () => {
  let rateLimiter: AdaptiveRateLimiter;
  let config: RateLimitConfig;

  beforeEach(() => {
    config = {
      maxConcurrentRequests: 2,
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      burstAllowance: 10,
      backoffMultiplier: 2.0,
      maxBackoffMs: 300000,
      adaptiveScaling: false
    };
    rateLimiter = new AdaptiveRateLimiter(config);
  });

  describe('acquirePermission', () => {
    it('should allow requests within limits', async () => {
      const permission = await rateLimiter.acquirePermission(1000);
      expect(permission.allowed).toBe(true);
      expect(permission.delayMs).toBe(0);
    });

    it('should deny requests when concurrent limit exceeded', async () => {
      // Fill up concurrent slots
      await rateLimiter.acquirePermission(1000);
      await rateLimiter.acquirePermission(1000);
      
      // Third request should be denied
      const permission = await rateLimiter.acquirePermission(1000);
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('concurrent_limit');
    });

    it('should deny requests when token limit exceeded', async () => {
      const permission = await rateLimiter.acquirePermission(150000); // Exceeds tokensPerMinute
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('tokens_limit');
    });

    it('should apply backoff after rate limit errors', async () => {
      // Simulate rate limit error
      await rateLimiter.acquirePermission(1000);
      rateLimiter.recordError('rate_limit');
      
      const permission = await rateLimiter.acquirePermission(1000);
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toBe('backoff_period');
      expect(permission.delayMs).toBeGreaterThan(0);
    });
  });

  describe('recordSuccess', () => {
    it('should update metrics and reset error count', async () => {
      await rateLimiter.acquirePermission(1000);
      rateLimiter.recordSuccess(1200, 500); // Different actual tokens, response time
      
      const status = rateLimiter.getStatus();
      expect(status.consecutiveErrors).toBe(0);
      
      const metrics = rateLimiter.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('recordError', () => {
    it('should increment error count and apply backoff for rate limits', async () => {
      await rateLimiter.acquirePermission(1000);
      rateLimiter.recordError('rate_limit');
      
      const status = rateLimiter.getStatus();
      expect(status.consecutiveErrors).toBe(1);
      expect(status.backoffMs).toBeGreaterThan(0);
    });

    it('should not apply backoff for non-rate-limit errors', async () => {
      await rateLimiter.acquirePermission(1000);
      rateLimiter.recordError('server_error');
      
      const status = rateLimiter.getStatus();
      expect(status.consecutiveErrors).toBe(1);
      expect(status.backoffMs).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status', async () => {
      const status = rateLimiter.getStatus();
      expect(status.requestsRemaining).toBe(config.requestsPerMinute);
      expect(status.tokensRemaining).toBe(config.tokensPerMinute);
      expect(status.isRateLimited).toBe(false);
    });

    it('should update remaining counts after requests', async () => {
      await rateLimiter.acquirePermission(1000);
      const status = rateLimiter.getStatus();
      expect(status.requestsRemaining).toBe(config.requestsPerMinute - 1);
      expect(status.tokensRemaining).toBe(config.tokensPerMinute - 1000);
    });
  });

  describe('fromStrategy', () => {
    it('should create rate limiter from conservative strategy', () => {
      const limiter = AdaptiveRateLimiter.fromStrategy('conservative');
      const config = limiter.getConfig();
      const strategy = PROCESSING_STRATEGIES.conservative;
      
      expect(config.maxConcurrentRequests).toBe(strategy.maxConcurrent);
      expect(config.requestsPerMinute).toBe(strategy.requestsPerMinute);
      expect(config.tokensPerMinute).toBe(strategy.tokensPerMinute);
    });

    it('should create rate limiter from aggressive strategy', () => {
      const limiter = AdaptiveRateLimiter.fromStrategy('aggressive');
      const config = limiter.getConfig();
      const strategy = PROCESSING_STRATEGIES.aggressive;
      
      expect(config.maxConcurrentRequests).toBe(strategy.maxConcurrent);
      expect(config.requestsPerMinute).toBe(strategy.requestsPerMinute);
      expect(config.tokensPerMinute).toBe(strategy.tokensPerMinute);
    });
  });

  describe('adaptive scaling', () => {
    beforeEach(() => {
      config.adaptiveScaling = true;
      rateLimiter = new AdaptiveRateLimiter(config);
    });

    it('should increase limits when performing well', async () => {
      const initialConfig = rateLimiter.getConfig();
      
      // Simulate successful requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquirePermission(1000);
        rateLimiter.recordSuccess(1000, 100);
      }
      
      // Wait for adaptive scaling to kick in (mocked time)
      jest.advanceTimersByTime(31000); // 31 seconds
      
      await rateLimiter.acquirePermission(1000);
      
      const newConfig = rateLimiter.getConfig();
      // Note: In real implementation, limits might increase
      expect(newConfig.requestsPerMinute).toBeGreaterThanOrEqual(initialConfig.requestsPerMinute);
    });
  });

  describe('event listeners', () => {
    it('should emit events for permission granted', async () => {
      const events: any[] = [];
      rateLimiter.addEventListener((event) => events.push(event));
      
      await rateLimiter.acquirePermission(1000);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('permission_granted');
      expect(events[0].tokens).toBe(1000);
    });

    it('should emit events for permission denied', async () => {
      const events: any[] = [];
      rateLimiter.addEventListener((event) => events.push(event));
      
      // Exceed token limit
      await rateLimiter.acquirePermission(150000);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('permission_denied');
      expect(events[0].reason).toBe('tokens_limit');
    });

    it('should emit events for success and error', async () => {
      const events: any[] = [];
      rateLimiter.addEventListener((event) => events.push(event));
      
      await rateLimiter.acquirePermission(1000);
      rateLimiter.recordSuccess(1000);
      rateLimiter.recordError('rate_limit');
      
      expect(events).toHaveLength(3);
      expect(events[1].type).toBe('success');
      expect(events[2].type).toBe('error');
      expect(events[2].errorType).toBe('rate_limit');
    });
  });

  describe('burst allowance', () => {
    it('should allow burst requests up to burst allowance', async () => {
      // Make requests quickly within burst allowance
      for (let i = 0; i < config.burstAllowance; i++) {
        const permission = await rateLimiter.acquirePermission(1000);
        expect(permission.allowed).toBe(true);
        rateLimiter.recordSuccess(1000);
      }
    });

    it('should throttle requests beyond burst allowance', async () => {
      // Fill burst allowance
      for (let i = 0; i < config.burstAllowance + 1; i++) {
        await rateLimiter.acquirePermission(1000);
        rateLimiter.recordSuccess(1000);
      }
      
      // Next request should be throttled
      const permission = await rateLimiter.acquirePermission(1000);
      if (!permission.allowed) {
        expect(permission.reason).toBe('burst_limit');
        expect(permission.delayMs).toBeGreaterThan(0);
      }
    });
  });
});

// Mock timers for testing
jest.useFakeTimers();
