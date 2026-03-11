import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleCategoriesAPI } from '../../supabase/functions/_shared/api-categories.ts';
import { handleMeAPI } from '../../supabase/functions/_shared/api-me.ts';

type HandlerContext = Parameters<typeof handleMeAPI>[2];

function createQueryResult<T>(data: T, error: { message: string } | null = null) {
  return { data, error };
}

function createThenableQuery<T>(result: Promise<{ data: T; error: { message: string } | null }> | { data: T; error: { message: string } | null }) {
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
    then(onFulfilled: (value: { data: T; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) {
      return promise.then(onFulfilled, onRejected);
    },
  };
}

function createContext(overrides: Partial<Record<'scopes' | 'supabase' | 'userSupabase' | 'teamId', unknown>> = {}) {
  return {
    userId: 'user-123',
    teamId: overrides.teamId as string | undefined,
    scopes: (overrides.scopes as string[]) ?? ['profile:read', 'categories:read'],
    keyId: 'key-123',
    supabase: overrides.supabase,
    userSupabase: overrides.userSupabase,
    authHeader: 'Bearer valid-user-token',
  } as unknown as HandlerContext;
}

describe('external-api profile/category handlers', () => {
  it('returns account profile, subscription, and team membership data for GET /me', async () => {
    const context = createContext({
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

    const response = await handleMeAPI(new Request('https://example.com/api/v1/me'), ['me'], context);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.user.displayName, 'Ada Lovelace');
    assert.equal(payload.data.user.avatarUrl, 'https://example.com/avatar.png');
    assert.equal(payload.data.user.preferredCurrency, 'MYR');
    assert.equal(payload.data.subscription.tier, 'pro');
    assert.equal(payload.data.subscription.limits.monthlyReceipts, 100);
    assert.deepEqual(payload.data.teams, [
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

  it('rejects GET /me when profile:read scope is missing', async () => {
    const response = await handleMeAPI(
      new Request('https://example.com/api/v1/me'),
      ['me'],
      createContext({ scopes: ['categories:read'], supabase: {}, userSupabase: {} }),
    );
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.message, 'Insufficient permissions for profile:read');
  });

  it('returns an empty list for GET /categories without auto-creating defaults', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, string | null> }> = [];
    const response = await handleCategoriesAPI(
      new Request('https://example.com/api/v1/categories'),
      ['categories'],
      createContext({
        supabase: {
          from: () => {
            throw new Error('Team membership lookup should not run without team_id');
          },
        },
        userSupabase: {
          rpc: async (fn: string, args: Record<string, string | null>) => {
            rpcCalls.push({ fn, args });
            return createQueryResult([]);
          },
        },
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(rpcCalls, [
      {
        fn: 'get_user_categories_with_counts',
        args: {
          p_user_id: 'user-123',
          p_team_id: null,
        },
      },
    ]);
    assert.deepEqual(payload.data, {
      categories: [],
      count: 0,
      teamId: null,
    });
  });

  it('blocks team category reads when the caller is not a team member', async () => {
    let rpcCalled = false;
    const response = await handleCategoriesAPI(
      new Request('https://example.com/api/v1/categories?team_id=team-9'),
      ['categories'],
      createContext({
        supabase: {
          from: (table: string) => {
            assert.equal(table, 'team_members');
            return createThenableQuery(createQueryResult(null));
          },
        },
        userSupabase: {
          rpc: async () => {
            rpcCalled = true;
            return createQueryResult([]);
          },
        },
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.message, 'Access denied to team categories');
    assert.equal(rpcCalled, false);
  });

  it('uses the user-scoped client for authorized team category reads', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, string | null> }> = [];
    const response = await handleCategoriesAPI(
      new Request('https://example.com/api/v1/categories?team_id=team-7'),
      ['categories'],
      createContext({
        supabase: {
          from: (table: string) => {
            assert.equal(table, 'team_members');
            return createThenableQuery(createQueryResult({ role: 'member' }));
          },
        },
        userSupabase: {
          rpc: async (fn: string, args: Record<string, string | null>) => {
            rpcCalls.push({ fn, args });
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
      }),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(rpcCalls, [
      {
        fn: 'get_user_categories_with_counts',
        args: {
          p_user_id: 'user-123',
          p_team_id: 'team-7',
        },
      },
    ]);
    assert.deepEqual(payload.data.categories, [
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
});