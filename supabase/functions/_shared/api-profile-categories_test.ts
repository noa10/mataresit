import { assertEquals } from 'jsr:@std/assert';

import { handleCategoriesAPI } from './api-categories.ts';
import { handleMeAPI } from './api-me.ts';

function createApiContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-123',
    teamId: undefined,
    scopes: ['profile:read', 'categories:read'],
    keyId: 'key-123',
    supabase: null,
    userSupabase: null,
    authHeader: 'Bearer test-token',
    ...overrides,
  };
}

function createQueryResult<T>(data: T, error: { message: string } | null = null) {
  return { data, error };
}

function createThenableQuery<T>(
  result: Promise<{ data: T; error: { message: string } | null }> | { data: T; error: { message: string } | null },
) {
  const promise = Promise.resolve(result);

  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return promise;
    },
    single() {
      return promise;
    },
    then(
      onFulfilled: (value: { data: T; error: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return promise.then(onFulfilled, onRejected);
    },
  };
}

Deno.test('GET /me returns current-user profile, subscription, and team memberships', async () => {
  const context = createApiContext({
    supabase: {
      from: (table: string) => {
        if (table === 'profiles') {
          return createThenableQuery(createQueryResult({
            id: 'user-123',
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            avatar_url: null,
            google_avatar_url: 'https://example.com/avatar.png',
            preferred_currency: null,
            preferred_language: 'ms',
            subscription_tier: 'pro',
            subscription_status: 'active',
            receipts_used_this_month: 12,
            monthly_reset_date: '2026-03-31',
            subscription_start_date: '2026-03-01',
            subscription_end_date: null,
            trial_end_date: null,
          }));
        }

        if (table === 'team_members') {
          return createThenableQuery(createQueryResult([
            {
              id: 'membership-1',
              role: 'admin',
              joined_at: '2026-01-01T00:00:00.000Z',
              teams: {
                id: 'team-1',
                name: 'Finance',
                description: 'Finance team',
                status: 'active',
              },
            },
          ]));
        }

        if (table === 'subscription_limits') {
          return createThenableQuery(createQueryResult({
            monthly_receipts: 100,
            storage_limit_mb: 2048,
            retention_days: 365,
            batch_upload_limit: 25,
            api_access_enabled: true,
            max_users: 10,
            support_level: 'priority',
          }));
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
    userSupabase: { rpc: async () => createQueryResult([]) },
  });

  const response = await handleMeAPI(
    new Request('https://example.com/api/v1/me'),
    ['me'],
    context as never,
  );
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.success, true);
  assertEquals(payload.data.user.displayName, 'Ada Lovelace');
  assertEquals(payload.data.user.avatarUrl, 'https://example.com/avatar.png');
  assertEquals(payload.data.user.preferredCurrency, 'MYR');
  assertEquals(payload.data.subscription.tier, 'pro');
  assertEquals(payload.data.subscription.limits.monthlyReceipts, 100);
  assertEquals(payload.data.teams, [
    {
      id: 'membership-1',
      role: 'admin',
      joinedAt: '2026-01-01T00:00:00.000Z',
      team: {
        id: 'team-1',
        name: 'Finance',
        description: 'Finance team',
        status: 'active',
      },
    },
  ]);
});

Deno.test('GET /me rejects requests missing profile:read scope', async () => {
  const response = await handleMeAPI(
    new Request('https://example.com/api/v1/me'),
    ['me'],
    createApiContext({
      scopes: ['categories:read'],
      supabase: {},
      userSupabase: {},
    }) as never,
  );
  const payload = await response.json();

  assertEquals(response.status, 403);
  assertEquals(payload.message, 'Insufficient permissions for profile:read');
});

Deno.test('GET /categories returns an empty list without creating defaults', async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, string | null> }> = [];
  const response = await handleCategoriesAPI(
    new Request('https://example.com/api/v1/categories'),
    ['categories'],
    createApiContext({
      supabase: {
        from: () => {
          throw new Error('Team membership lookup should not run without team_id');
        },
      },
      userSupabase: {
        rpc: async (name: string, args: Record<string, string | null>) => {
          rpcCalls.push({ name, args });
          return createQueryResult([]);
        },
      },
    }) as never,
  );
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(rpcCalls, [
    {
      name: 'get_user_categories_with_counts',
      args: {
        p_user_id: 'user-123',
        p_team_id: null,
      },
    },
  ]);
  assertEquals(payload.data, {
    categories: [],
    count: 0,
    teamId: null,
  });
});

Deno.test('GET /categories blocks team reads for non-members', async () => {
  let rpcCalled = false;

  const response = await handleCategoriesAPI(
    new Request('https://example.com/api/v1/categories?team_id=team-9'),
    ['categories'],
    createApiContext({
      supabase: {
        from: (table: string) => {
          assertEquals(table, 'team_members');
          return createThenableQuery(createQueryResult(null));
        },
      },
      userSupabase: {
        rpc: async () => {
          rpcCalled = true;
          return createQueryResult([]);
        },
      },
    }) as never,
  );
  const payload = await response.json();

  assertEquals(response.status, 403);
  assertEquals(payload.message, 'Access denied to team categories');
  assertEquals(rpcCalled, false);
});

Deno.test('GET /categories uses the user-scoped client for authorized team reads', async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, string | null> }> = [];

  const response = await handleCategoriesAPI(
    new Request('https://example.com/api/v1/categories?team_id=team-7'),
    ['categories'],
    createApiContext({
      supabase: {
        from: (table: string) => {
          assertEquals(table, 'team_members');
          return createThenableQuery(createQueryResult({ role: 'member' }));
        },
      },
      userSupabase: {
        rpc: async (name: string, args: Record<string, string | null>) => {
          rpcCalls.push({ name, args });
          return createQueryResult([
            {
              id: 'category-1',
              name: 'Travel',
              color: '#2563eb',
              icon: 'plane',
              created_at: '2026-03-01T00:00:00.000Z',
              updated_at: '2026-03-02T00:00:00.000Z',
              receipt_count: 4,
              team_id: 'team-7',
              is_team_category: true,
            },
          ]);
        },
      },
    }) as never,
  );
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(rpcCalls, [
    {
      name: 'get_user_categories_with_counts',
      args: {
        p_user_id: 'user-123',
        p_team_id: 'team-7',
      },
    },
  ]);
  assertEquals(payload.data.categories, [
    {
      id: 'category-1',
      name: 'Travel',
      color: '#2563eb',
      icon: 'plane',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      receiptCount: 4,
      teamId: 'team-7',
      isTeamCategory: true,
    },
  ]);
});