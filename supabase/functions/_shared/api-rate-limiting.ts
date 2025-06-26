/**
 * API Rate Limiting Utilities
 * Implements subscription-based rate limiting for external API access
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import type { ApiContext } from './api-auth.ts';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstAllowance: number; // Additional requests allowed in short bursts
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // Seconds to wait before retry
  tier: string;
  error?: string;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Tier': string;
  'Retry-After'?: string;
}

/**
 * Gets rate limit configuration based on user's subscription tier
 */
export async function getRateLimitConfig(context: ApiContext): Promise<RateLimitConfig> {
  try {
    // Get user's subscription tier
    const { data: profile } = await context.supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', context.userId)
      .single();

    const tier = profile?.subscription_tier || 'free';

    // Define rate limits per tier
    const configs: Record<string, RateLimitConfig> = {
      free: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        burstAllowance: 5
      },
      pro: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstAllowance: 20
      },
      max: {
        requestsPerMinute: 300,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        burstAllowance: 100
      }
    };

    return configs[tier] || configs.free;

  } catch (error) {
    console.error('Error getting rate limit config:', error);
    // Return most restrictive config on error
    return {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 1000,
      burstAllowance: 5
    };
  }
}

/**
 * Checks if a request is within rate limits
 */
export async function checkRateLimit(
  context: ApiContext,
  endpoint: string
): Promise<RateLimitResult> {
  try {
    const config = await getRateLimitConfig(context);
    const now = new Date();
    
    // Check minute window (most restrictive)
    const minuteResult = await checkWindow(
      context,
      'minute',
      config.requestsPerMinute + config.burstAllowance,
      now
    );

    if (!minuteResult.allowed) {
      return {
        ...minuteResult,
        tier: await getUserTier(context)
      };
    }

    // Check hour window
    const hourResult = await checkWindow(
      context,
      'hour',
      config.requestsPerHour,
      now
    );

    if (!hourResult.allowed) {
      return {
        ...hourResult,
        tier: await getUserTier(context)
      };
    }

    // Check day window
    const dayResult = await checkWindow(
      context,
      'day',
      config.requestsPerDay,
      now
    );

    return {
      ...dayResult,
      tier: await getUserTier(context)
    };

  } catch (error) {
    console.error('Rate limit check error:', error);
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(Date.now() + 60000), // 1 minute
      error: 'Rate limit check failed',
      tier: 'unknown'
    };
  }
}

/**
 * Records a successful API request for rate limiting
 */
export async function recordRequest(
  context: ApiContext,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  requestInfo: {
    ipAddress?: string;
    userAgent?: string;
    requestSize?: number;
    responseSize?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  try {
    const now = new Date();

    // Record in access logs
    await context.supabase
      .from('api_access_logs')
      .insert({
        api_key_id: context.keyId,
        user_id: context.userId,
        team_id: context.teamId,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        ip_address: requestInfo.ipAddress,
        user_agent: requestInfo.userAgent,
        request_size_bytes: requestInfo.requestSize,
        response_size_bytes: requestInfo.responseSize,
        error_message: requestInfo.errorMessage,
        timestamp: now.toISOString()
      });

    // Update rate limit counters for all windows
    await Promise.all([
      updateRateLimitCounter(context, 'minute', now),
      updateRateLimitCounter(context, 'hour', now),
      updateRateLimitCounter(context, 'day', now)
    ]);

  } catch (error) {
    console.error('Error recording request:', error);
    // Don't throw - logging failures shouldn't break API
  }
}

/**
 * Generates rate limit headers for API responses
 */
export function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': result.remaining.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString(),
    'X-RateLimit-Tier': result.tier
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Checks rate limit for a specific time window
 */
async function checkWindow(
  context: ApiContext,
  window: 'minute' | 'hour' | 'day',
  limit: number,
  now: Date
): Promise<RateLimitResult> {
  const { windowStart, windowEnd } = getWindowBounds(window, now);

  // Get current usage for this window
  const { data: rateLimitData } = await context.supabase
    .from('api_rate_limits')
    .select('request_count')
    .eq('user_id', context.userId)
    .eq('api_key_id', context.keyId)
    .eq('window_start', windowStart.toISOString())
    .single();

  const currentCount = rateLimitData?.request_count || 0;
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;

  return {
    allowed,
    remaining,
    resetTime: windowEnd,
    retryAfter: allowed ? undefined : Math.ceil((windowEnd.getTime() - now.getTime()) / 1000),
    tier: 'unknown' // Will be set by caller
  };
}

/**
 * Updates rate limit counter for a specific window
 */
async function updateRateLimitCounter(
  context: ApiContext,
  window: 'minute' | 'hour' | 'day',
  now: Date
): Promise<void> {
  const { windowStart, windowEnd } = getWindowBounds(window, now);

  await context.supabase
    .from('api_rate_limits')
    .upsert({
      user_id: context.userId,
      api_key_id: context.keyId,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      request_count: 1
    }, {
      onConflict: 'user_id,api_key_id,window_start',
      ignoreDuplicates: false
    });
}

/**
 * Gets window boundaries for rate limiting
 */
function getWindowBounds(window: 'minute' | 'hour' | 'day', now: Date): {
  windowStart: Date;
  windowEnd: Date;
} {
  const windowStart = new Date(now);
  const windowEnd = new Date(now);

  switch (window) {
    case 'minute':
      windowStart.setSeconds(0, 0);
      windowEnd.setSeconds(59, 999);
      break;
    case 'hour':
      windowStart.setMinutes(0, 0, 0);
      windowEnd.setMinutes(59, 59, 999);
      break;
    case 'day':
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { windowStart, windowEnd };
}

/**
 * Gets user's subscription tier
 */
async function getUserTier(context: ApiContext): Promise<string> {
  try {
    const { data: profile } = await context.supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', context.userId)
      .single();

    return profile?.subscription_tier || 'free';
  } catch {
    return 'free';
  }
}
