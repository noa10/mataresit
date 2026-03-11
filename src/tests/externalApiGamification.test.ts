import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleGamificationAPI, type GamificationApiContext } from '../../supabase/functions/_shared/api-gamification.ts';

function currentDateStamp(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function createContext(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: 'user-123',
    teamId: 'team-456',
    scopes: ['gamification:read'],
    keyId: 'key-789',
    supabase: createProfileSupabaseMock(),
    userSupabase: createLeaderboardSupabaseMock(),
    authHeader: 'Bearer valid-user-token',
    ...overrides,
  } as unknown as GamificationApiContext;
}

function createProfileSupabaseMock() {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
  const today = currentDateStamp('Asia/Kuala_Lumpur');

  const from = (table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { timezone_preference: 'Asia/Kuala_Lumpur' },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'gamification_badges') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [{
                id: 'badge-1',
                code: 'first_scan',
                name: 'First Scan',
                description: 'Complete your first scan.',
                icon_name: 'scan-search',
                category: 'onboarding',
                rarity: 'common',
                sort_order: 10,
                criteria: {},
                is_active: true,
              }],
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'user_badges') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [{
                  id: 'user-badge-1',
                  user_id: 'user-123',
                  badge_id: 'badge-1',
                  equipped: true,
                  metadata: {},
                  unlocked_at: '2026-03-11T10:00:00Z',
                  created_at: '2026-03-11T10:00:00Z',
                  updated_at: '2026-03-11T10:00:00Z',
                }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'gamification_xp_events') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: [{
                  id: 'event-1',
                  user_id: 'user-123',
                  source_type: 'receipt_scan',
                  source_id: null,
                  receipt_id: null,
                  amount: 25,
                  metadata: {
                    total_xp: 775,
                    current_level: 2,
                    badges_unlocked: [{ name: 'First Scan' }],
                  },
                  idempotency_key: 'reward-1',
                  awarded_at: '2026-03-11T11:00:00Z',
                  created_at: '2026-03-11T11:00:00Z',
                }],
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  };

  return {
    rpcCalls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (fn === 'ensure_user_gamification_stats') {
        return {
          data: {
            user_id: 'user-123',
            total_xp: 775,
            current_level: 2,
            login_streak_days: 4,
            scan_streak_days: 3,
            longest_login_streak_days: 5,
            longest_scan_streak_days: 6,
            total_receipts_scanned: 12,
            deductible_receipt_count: 7,
            deductible_total_amount: 321.45,
            leaderboard_opt_in: true,
            leaderboard_display_mode: 'name',
            country_code: 'MY',
            referral_code: 'ABC123',
            successful_referrals: 2,
            selected_scanner_theme: 'ocean',
            unlocked_scanner_themes: ['default', 'ocean'],
            last_login_date: today,
            last_scan_date: today,
            updated_at: '2026-03-11T12:00:00Z',
          },
          error: null,
        };
      }

      throw new Error(`Unexpected rpc ${fn}`);
    },
    from,
  };
}

function createLeaderboardSupabaseMock() {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];

  return {
    rpcCalls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (fn === 'get_gamification_leaderboard') {
        return {
          data: [{
            rank: 12,
            user_id: 'user-123',
            display_name: 'You',
            is_current_user: true,
            is_anonymous: false,
            metric_value: 845,
            gap_to_top_ten: 35,
          }],
          error: null,
        };
      }

      throw new Error(`Unexpected rpc ${fn}`);
    },
  };
}

describe('external-api gamification handler', () => {
  it('returns a mapped gamification profile snapshot', async () => {
    const serviceSupabase = createProfileSupabaseMock();
    const response = await handleGamificationAPI(
      new Request('https://example.com/external-api/api/v1/gamification/profile'),
      ['gamification', 'profile'],
      createContext({ supabase: serviceSupabase }),
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.profile.totalXp, 775);
    assert.equal(payload.data.profile.currentLevel, 2);
    assert.equal(payload.data.profile.dailyGoalCompletedToday, true);
    assert.equal(payload.data.badgeSummary.totalUnlocked, 1);
    assert.equal(payload.data.badgeSummary.equipped[0].name, 'First Scan');
    assert.equal(payload.data.recentRewards[0].badgeNames[0], 'First Scan');
    assert.deepEqual(serviceSupabase.rpcCalls, [{
      fn: 'ensure_user_gamification_stats',
      args: { p_user_id: 'user-123' },
    }]);
  });

  it('uses the validated user-scoped client for leaderboard queries', async () => {
    const serviceSupabase = {
      rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> | undefined }>,
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        serviceSupabase.rpcCalls.push({ fn, args });
        throw new Error('Leaderboard should not use the service-role client');
      },
      from: () => {
        throw new Error('Unexpected from() call for leaderboard');
      },
    };
    const userSupabase = createLeaderboardSupabaseMock();

    const response = await handleGamificationAPI(
      new Request('https://example.com/external-api/api/v1/gamification/leaderboard?metric=weekly_xp&country_code=my&limit=25'),
      ['gamification', 'leaderboard'],
      createContext({ supabase: serviceSupabase, userSupabase }),
    );

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.metric, 'weekly_xp');
    assert.equal(payload.data.countryCode, 'MY');
    assert.equal(payload.data.limit, 25);
    assert.equal(payload.data.viewerEntry.rank, 12);
    assert.equal(payload.data.viewerEntry.isCurrentUser, true);
    assert.deepEqual(userSupabase.rpcCalls, [{
      fn: 'get_gamification_leaderboard',
      args: {
        _metric: 'weekly_xp',
        _country_code: 'MY',
        _limit: 25,
      },
    }]);
    assert.deepEqual(serviceSupabase.rpcCalls, []);
  });

  it('refuses to fall back to the service-role client when viewer context is unavailable', async () => {
    const serviceSupabase = {
      rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> | undefined }>,
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        serviceSupabase.rpcCalls.push({ fn, args });
        return { data: [], error: null };
      },
      from: () => {
        throw new Error('Unexpected from() call for leaderboard');
      },
    };

    const response = await handleGamificationAPI(
      new Request('https://example.com/external-api/api/v1/gamification/leaderboard?metric=weekly_xp'),
      ['gamification', 'leaderboard'],
      createContext({ supabase: serviceSupabase, userSupabase: null }),
    );

    const payload = await response.json();

    assert.equal(response.status, 501);
    assert.equal(payload.message, 'Leaderboard viewer context unavailable; validated user-scoped client required');
    assert.deepEqual(serviceSupabase.rpcCalls, []);
  });
});