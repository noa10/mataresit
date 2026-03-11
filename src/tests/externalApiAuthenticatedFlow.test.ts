import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createExternalApiHandler } from '../../supabase/functions/_shared/external-api-handler.ts';

const VALID_API_KEY = 'mk_live_1234567890abcdef1234567890abcdef';

function createApiContextFixture() {
  return {
    userId: 'user-123',
    teamId: 'team-456',
    scopes: ['receipts:read', 'claims:read', 'profile:read', 'categories:read', 'gamification:read'],
    keyId: 'key-789',
    supabase: null,
    userSupabase: null,
    authHeader: 'Bearer valid-user-token',
  };
}

function createJsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createHandlerHarness() {
  const calls = {
    validateApiKey: [] as Array<string | null>,
    createApiContext: [] as Array<{ authHeader: string | null; userId: string | undefined }>,
    checkRateLimit: [] as Array<{ endpoint: string; userId: string }>,
    recordRequest: [] as Array<{ endpoint: string; method: string; statusCode: number; userId: string }>,
    receipts: [] as string[][],
    me: [] as string[][],
    categories: [] as string[][],
    gamification: [] as string[][],
    validateUUID: [] as Array<{ value: string; fieldName: string }>,
  };

  const apiContext = createApiContextFixture();

  const defaultDependencies = {
    validateApiKey: async (apiKey: string | null) => {
      calls.validateApiKey.push(apiKey);
      return {
        valid: true,
        userId: apiContext.userId,
        teamId: apiContext.teamId,
        scopes: apiContext.scopes,
        keyId: apiContext.keyId,
      };
    },
    createApiContext: async (validation: { userId?: string }, authHeader: string | null) => {
      calls.createApiContext.push({ authHeader, userId: validation.userId });
      return apiContext;
    },
    hasScope: (context: { scopes: string[] }, requiredScope: string) => context.scopes.includes(requiredScope),
    checkRateLimit: async (context: { userId: string }, endpoint: string) => {
      calls.checkRateLimit.push({ endpoint, userId: context.userId });
      return { allowed: true, remaining: 999 };
    },
    recordRequest: async (
      context: { userId: string },
      endpoint: string,
      method: string,
      statusCode: number,
    ) => {
      calls.recordRequest.push({ endpoint, method, statusCode, userId: context.userId });
    },
    getRateLimitHeaders: () => ({ 'x-ratelimit-remaining': '999' }),
    handleReceiptsAPI: async (_req: Request, pathSegments: string[]) => {
      calls.receipts.push(pathSegments);
      return createJsonResponse({ resource: 'receipts' }, 200);
    },
    handleClaimsAPI: async () => new Response('unexpected claims handler', { status: 500 }),
    handleMeAPI: async (_req: Request, pathSegments: string[]) => {
      calls.me.push(pathSegments);
      return createJsonResponse({ resource: 'me' }, 200);
    },
    handleCategoriesAPI: async (_req: Request, pathSegments: string[]) => {
      calls.categories.push(pathSegments);
      return createJsonResponse({ resource: 'categories' }, 200);
    },
    handleGamificationAPI: async (_req: Request, pathSegments: string[]) => {
      calls.gamification.push(pathSegments);
      return createJsonResponse({ resource: 'gamification' }, 200);
    },
    handleSearchAPI: async () => new Response('unexpected search handler', { status: 500 }),
    handleAnalyticsAPI: async () => new Response('unexpected analytics handler', { status: 500 }),
    handleTeamsAPI: async () => new Response('unexpected teams handler', { status: 500 }),
    withPerformanceMonitoring: (_endpoint: string, _method: string, callback: () => Promise<Response>) => callback,
    getCacheStats: () => ({ hits: 1 }),
    getPerformanceHealth: () => ({ status: 'healthy' }),
    validateUUID: (value: string, fieldName: string) => {
      calls.validateUUID.push({ value, fieldName });
      return null;
    },
  };

  const handler = createExternalApiHandler(defaultDependencies, {
    useMockContext: false,
    bypassMode: false,
    logger: {
      log: () => undefined,
      error: () => undefined,
    },
  });

  return {
    handler,
    calls,
    apiContext,
    defaultDependencies,
  };
}

describe('external-api authenticated flow', () => {
  it('returns a successful health response for a validated authenticated request', async () => {
    const { handler, calls, apiContext } = createHandlerHarness();

    const response = await handler(new Request('https://example.com/external-api/api/v1/health', {
      headers: {
        Authorization: 'Bearer valid-user-token',
        'X-API-Key': VALID_API_KEY,
      },
    }));

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls.validateApiKey, [VALID_API_KEY]);
    assert.deepEqual(calls.createApiContext, [{ authHeader: 'Bearer valid-user-token', userId: apiContext.userId }]);
    assert.deepEqual(calls.checkRateLimit, [{ endpoint: '/api/v1/health', userId: apiContext.userId }]);
    assert.deepEqual(calls.recordRequest, [{ endpoint: '/api/v1/health', method: 'GET', statusCode: 200, userId: apiContext.userId }]);
    assert.equal(payload.success, true);
    assert.equal(payload.data.function, 'external-api');
    assert.equal(payload.data.mode, 'production');
    assert.equal(payload.data.user.id, apiContext.userId);
    assert.deepEqual(payload.data.user.scopes, apiContext.scopes);
    assert.equal(payload.data.features.me, true);
    assert.equal(payload.data.features.categories, true);
    assert.equal(payload.data.features.gamification, true);
  });

  it('rejects authorization headers that are not bearer tokens', async () => {
    const { handler, calls } = createHandlerHarness();

    const response = await handler(new Request('https://example.com/external-api/api/v1/health', {
      headers: {
        Authorization: 'Token invalid-format',
        'X-API-Key': VALID_API_KEY,
      },
    }));

    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.message, 'Invalid Authorization header format. Expected Authorization: Bearer <token>');
    assert.deepEqual(calls.validateApiKey, []);
    assert.deepEqual(calls.createApiContext, []);
  });

  it('routes the new v1 shared resources through their dedicated handlers', async () => {
    const { handler, calls } = createHandlerHarness();

    const requests = [
      ['https://example.com/external-api/api/v1/me', calls.me, ['me']],
      ['https://example.com/external-api/api/v1/categories', calls.categories, ['categories']],
      ['https://example.com/external-api/api/v1/gamification/profile', calls.gamification, ['gamification', 'profile']],
      ['https://example.com/external-api/api/v1/gamification/leaderboard', calls.gamification, ['gamification', 'leaderboard']],
    ] as const;

    for (const [url, handlerCalls, expectedSegments] of requests) {
      const response = await handler(new Request(url, {
        headers: {
          Authorization: 'Bearer valid-user-token',
          'X-API-Key': VALID_API_KEY,
        },
      }));

      assert.equal(response.status, 200);
      assert.deepEqual(handlerCalls.at(-1), expectedSegments);
    }
  });

  it('routes /receipts/quick without applying UUID validation', async () => {
    const harness = createHandlerHarness();
    const handler = createExternalApiHandler(
      {
        ...harness.defaultDependencies,
        handleReceiptsAPI: async (_req: Request, pathSegments: string[]) => {
          harness.calls.receipts.push(pathSegments);
          return createJsonResponse({ resource: 'receipts-quick' }, 202);
        },
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

    const response = await handler(new Request('https://example.com/external-api/api/v1/receipts/quick', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-user-token',
        'X-API-Key': VALID_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ merchant: 'Quick Stop', total: 12.5 }),
    }));

    assert.equal(response.status, 202);
    assert.deepEqual(harness.calls.receipts, [['receipts', 'quick']]);
    assert.deepEqual(harness.calls.validateUUID, []);
  });
});