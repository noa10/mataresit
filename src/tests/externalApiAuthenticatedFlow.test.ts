import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createExternalApiHandler } from '../../supabase/functions/_shared/external-api-handler.ts';

const VALID_API_KEY = 'mk_live_1234567890abcdef1234567890abcdef';

describe('external-api authenticated flow', () => {
  it('returns a successful health response for a validated authenticated request', async () => {
    const calls = {
      validateApiKey: [] as Array<string | null>,
      checkRateLimit: [] as Array<{ endpoint: string; userId: string }>,
      recordRequest: [] as Array<{ endpoint: string; method: string; statusCode: number; userId: string }>,
    };

    const apiContext = {
      userId: 'user-123',
      teamId: 'team-456',
      scopes: ['receipts:read', 'claims:read'],
      keyId: 'key-789',
      supabase: null,
    };

    const handler = createExternalApiHandler(
      {
        validateApiKey: async (apiKey) => {
          calls.validateApiKey.push(apiKey);
          return {
            valid: true,
            userId: apiContext.userId,
            teamId: apiContext.teamId,
            scopes: apiContext.scopes,
            keyId: apiContext.keyId,
          };
        },
        createApiContext: () => apiContext,
        hasScope: (context, requiredScope) => context.scopes.includes(requiredScope),
        checkRateLimit: async (context, endpoint) => {
          calls.checkRateLimit.push({ endpoint, userId: context.userId });
          return { allowed: true, remaining: 999 };
        },
        recordRequest: async (context, endpoint, method, statusCode) => {
          calls.recordRequest.push({ endpoint, method, statusCode, userId: context.userId });
        },
        getRateLimitHeaders: () => ({ 'x-ratelimit-remaining': '999' }),
        handleReceiptsAPI: async () => new Response('unexpected receipts handler', { status: 500 }),
        handleClaimsAPI: async () => new Response('unexpected claims handler', { status: 500 }),
        handleSearchAPI: async () => new Response('unexpected search handler', { status: 500 }),
        handleAnalyticsAPI: async () => new Response('unexpected analytics handler', { status: 500 }),
        handleTeamsAPI: async () => new Response('unexpected teams handler', { status: 500 }),
        withPerformanceMonitoring: (_endpoint, _method, callback) => callback,
        getCacheStats: () => ({ hits: 1 }),
        getPerformanceHealth: () => ({ status: 'healthy' }),
        validateUUID: () => null,
      },
      {
        useMockContext: false,
        bypassMode: false,
        logger: {
          log: () => undefined,
          error: () => undefined,
        },
      },
    );

    const response = await handler(new Request('https://example.com/external-api/api/v1/health', {
      headers: {
        Authorization: 'Bearer valid-user-token',
        'X-API-Key': VALID_API_KEY,
      },
    }));

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls.validateApiKey, [VALID_API_KEY]);
    assert.deepEqual(calls.checkRateLimit, [{ endpoint: '/api/v1/health', userId: apiContext.userId }]);
    assert.deepEqual(calls.recordRequest, [{ endpoint: '/api/v1/health', method: 'GET', statusCode: 200, userId: apiContext.userId }]);
    assert.equal(payload.success, true);
    assert.equal(payload.data.function, 'external-api');
    assert.equal(payload.data.mode, 'production');
    assert.equal(payload.data.user.id, apiContext.userId);
    assert.deepEqual(payload.data.user.scopes, apiContext.scopes);
  });
});