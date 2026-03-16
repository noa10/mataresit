import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import createMataresitSkill, {
  REQUIRED_ENV_VARS,
  ROUTE_CATALOG,
  detectIntent,
  resolveSkillConfig,
} from '../index.mjs';

const env = {
  MATARESIT_API_BASE_URL: 'https://example.supabase.co/functions/v1/external-api/api/v1/',
  MATARESIT_API_KEY: 'mk_test_1234567890abcdef1234567890abcdef',
  MATARESIT_SUPABASE_ACCESS_TOKEN: 'user-access-token',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('mataresit OpenClaw chat flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('exposes the finalized v1 route catalog and required env vars', () => {
    expect(REQUIRED_ENV_VARS).toEqual([
      'MATARESIT_API_BASE_URL',
      'MATARESIT_API_KEY',
      'MATARESIT_SUPABASE_ACCESS_TOKEN',
    ]);

    expect(Object.keys(ROUTE_CATALOG)).toEqual([
      'quickReceipt',
      'receiptsList',
      'receiptDetail',
      'receiptSearch',
      'claimsList',
      'claimCreate',
      'claimUpdate',
      'profile',
      'categories',
      'analyticsSummary',
      'analyticsCategories',
      'gamificationProfile',
      'gamificationLeaderboard',
      'teamsList',
      'teamStats',
    ]);

    expect(ROUTE_CATALOG.claimUpdate).toMatchObject({
      method: 'PATCH',
      path: '/claims/:claimId',
      scopes: ['claims:write'],
    });
  });

  it('detects the supported v1 intents', () => {
    expect(detectIntent('Add a receipt from Quick Stop for RM 12.50')).toMatchObject({
      name: 'quick-receipt',
      merchant: 'Quick Stop',
      amount: 12.5,
    });

    expect(detectIntent('Show my spending by category this month')).toMatchObject({
      name: 'spending-categories',
      dateRange: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(detectIntent('Submit claim 11111111-1111-4111-8111-111111111111')).toMatchObject({
      name: 'claim-submit',
      claimId: '11111111-1111-4111-8111-111111111111',
    });

    expect(detectIntent('Show the Malaysia leaderboard for deductible spending')).toMatchObject({
      name: 'leaderboard',
      metric: 'deductible_total',
      countryCode: 'MY',
    });
  });

  it('builds authenticated quick receipt requests with v1 defaults', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }, 202));
    const skill = createMataresitSkill({ env, fetchImpl });

    const response = await skill.apiClient.call('quickReceipt', {
      body: { merchant: 'Quick Stop', total: 12.5 },
    });

    expect(response.status).toBe(202);

    const [url, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/receipts/quick');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer user-access-token');
    expect(init.headers['X-API-Key']).toBe('mk_test_1234567890abcdef1234567890abcdef');
    expect(body).toMatchObject({
      merchant: 'Quick Stop',
      total: 12.5,
      currency: 'MYR',
      status: 'unreviewed',
      date: '2026-03-11',
    });
  });

  it('routes quick receipt prompts and formats MYR-friendly success text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: 'receipt-1',
        merchant: 'Quick Stop',
        total: 12.5,
        currency: 'MYR',
        date: '2026-03-11',
        status: 'unreviewed',
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({ message: 'Add a receipt from Quick Stop for RM 12.50' });

    expect(result.status).toBe('success');
    expect(result.intent).toBe('quick-receipt');
    expect(result.routeKeys).toEqual(['quickReceipt']);
    expect(result.text).toMatch(/RM\s*12\.50/);
    expect(result.text).toContain('Quick Stop');
  });

  it('routes spending summary prompts to analytics summary with date filters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        period: 'this_month',
        currency: 'MYR',
        totalAmount: 420.3,
        totalReceipts: 8,
        averageAmount: 52.5375,
        previousPeriodChange: { amount: 80.1, percentage: 23.55 },
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({ message: 'How much did I spend this month?' });

    const [url] = fetchImpl.mock.calls[0];
    const requestUrl = new URL(url);

    expect(requestUrl.pathname).toBe('/functions/v1/external-api/api/v1/analytics/summary');
    expect(requestUrl.searchParams.get('start_date')).toBe('2026-03-01');
    expect(requestUrl.searchParams.get('end_date')).toBe('2026-03-31');
    expect(requestUrl.searchParams.get('currency')).toBe('MYR');
    expect(result.text).toMatch(/RM\s*420\.30/);
    expect(result.text).toContain('8 receipts');
  });

  it('routes receipt lookup prompts to the search endpoint when the query is open-ended', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        results: [
          {
            title: 'Parking receipt - KL Sentral',
            highlights: ['RM 8.00 on 10 Mar 2026'],
          },
        ],
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({ message: 'Find my parking receipt' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/search');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      query: 'Find my parking receipt',
      sources: ['receipts'],
      limit: 5,
    });
    expect(result.text).toContain('Parking receipt - KL Sentral');
  });

  it('creates claims after resolving the requested team name', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          teams: [{ id: 'team-finance', name: 'Finance' }],
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          id: 'claim-1',
          title: 'Client travel',
          amount: 82.4,
          currency: 'MYR',
          status: 'draft',
        },
      }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({
      message: 'Create a claim "Client travel" for RM 82.40 for team Finance',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/teams');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/claims');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      teamId: 'team-finance',
      title: 'Client travel',
      amount: 82.4,
      currency: 'MYR',
    });
    expect(result.text).toContain('Finance');
    expect(result.text).toMatch(/RM\s*82\.40/);
  });

  it('updates an existing claim when the prompt requests a change', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Client travel',
        amount: 90,
        status: 'draft',
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({
      message: 'Update claim 11111111-1111-4111-8111-111111111111 to RM 90',
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://example.supabase.co/functions/v1/external-api/api/v1/claims/11111111-1111-4111-8111-111111111111',
    );
    expect(fetchImpl.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ amount: 90 });
    expect(result.text).toContain('Updated claim');
  });

  it('submits a claim by patching the finalized status payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Client travel',
        status: 'submitted',
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({
      message: 'Submit claim 11111111-1111-4111-8111-111111111111',
    });

    expect(fetchImpl.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ status: 'submitted' });
    expect(result.text).toContain('New status: submitted');
  });

  it('routes plural claim list prompts to GET /claims and formats the returned list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        claims: [
          {
            id: 'claim-1',
            title: 'Team lunch',
            amount: 45.2,
            currency: 'MYR',
            status: 'submitted',
          },
        ],
      },
    }));
    const skill = createMataresitSkill({ env, fetchImpl });

    const result = await skill.handle({ message: 'List my submitted claims' });

    const [url, init] = fetchImpl.mock.calls[0];
    const requestUrl = new URL(url);

    expect(init.method).toBe('GET');
    expect(requestUrl.pathname).toBe('/functions/v1/external-api/api/v1/claims');
    expect(requestUrl.searchParams.get('status')).toBe('submitted');
    expect(requestUrl.searchParams.get('limit')).toBe('5');
    expect(result.intent).toBe('claim-list');
    expect(result.text).toContain('Team lunch');
    expect(result.text).toMatch(/RM\s*45\.20/);
    expect(result.text).toContain('(submitted)');
  });

  it('handles profile, category, XP, leaderboard, and team spending flows', async () => {
    const profileSkill = createMataresitSkill({
      env,
      fetchImpl: vi.fn().mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          user: { displayName: 'Khairul', email: 'khairul@example.com', preferredCurrency: 'MYR' },
          subscription: { tier: 'pro', status: 'active', receiptsUsedThisMonth: 12 },
          teams: [{ team: { name: 'Finance' } }],
        },
      })),
    });
    const profileResult = await profileSkill.handle({ message: 'Show my profile' });
    expect(profileResult.text).toContain('Khairul');
    expect(profileResult.text).toContain('Plan: pro');

    const categoryFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { teams: [{ id: 'team-finance', name: 'Finance' }] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          categories: [{ name: 'Travel', receiptCount: 6, isTeamCategory: true }],
        },
      }));
    const categorySkill = createMataresitSkill({ env, fetchImpl: categoryFetch });
    const categoryResult = await categorySkill.handle({ message: 'Show categories for team Finance' });
    expect(categoryFetch.mock.calls[1][0]).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/categories?team_id=team-finance');
    expect(categoryResult.text).toContain('Travel');

    const xpSkill = createMataresitSkill({
      env,
      fetchImpl: vi.fn().mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          profile: { currentLevel: 4, totalXp: 980, progressPercent: 52.5, loginStreakDays: 8, scanStreakDays: 3 },
          badgeSummary: { totalUnlocked: 7 },
        },
      })),
    });
    const xpResult = await xpSkill.handle({ message: 'What is my XP and level?' });
    expect(xpResult.text).toContain('level 4');
    expect(xpResult.text).toContain('980 XP');

    const leaderboardFetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      success: true,
      data: {
        entries: [
          { rank: 1, displayName: 'Alice', metric: 'deductible_total', value: 1200, isCurrentUser: false },
          { rank: 2, displayName: 'Khairul', metric: 'deductible_total', value: 980.5, isCurrentUser: true },
        ],
        viewerEntry: { rank: 2, metric: 'deductible_total', value: 980.5 },
      },
    }));
    const leaderboardSkill = createMataresitSkill({ env, fetchImpl: leaderboardFetch });
    const leaderboardResult = await leaderboardSkill.handle({ message: 'Show the Malaysia leaderboard for deductible spending' });
    const leaderboardUrl = new URL(leaderboardFetch.mock.calls[0][0]);
    expect(leaderboardUrl.searchParams.get('metric')).toBe('deductible_total');
    expect(leaderboardUrl.searchParams.get('country_code')).toBe('MY');
    expect(leaderboardResult.text).toContain('#1 Alice');
    expect(leaderboardResult.text).toContain('Your current rank is #2');

    const teamFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { teams: [{ id: 'team-finance', name: 'Finance' }] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          totalAmount: 1500.45,
          totalReceipts: 27,
          totalClaims: 4,
          activeMembers: 6,
          currency: 'MYR',
          recentActivity: [{ description: '2 receipts added today' }],
        },
      }));
    const teamSkill = createMataresitSkill({ env, fetchImpl: teamFetch });
    const teamResult = await teamSkill.handle({ message: 'How is team Finance spending this month?' });
    expect(teamFetch.mock.calls[1][0]).toBe('https://example.supabase.co/functions/v1/external-api/api/v1/teams/team-finance/stats');
    expect(teamResult.text).toMatch(/RM\s*1,500\.45/);
    expect(teamResult.text).toContain('2 receipts added today');
  });

  it('returns explicit fallback guidance for unsupported prompts', async () => {
    const skill = createMataresitSkill({ env, fetchImpl: vi.fn() });

    const result = await skill.handle({ message: 'Write me a poem about receipts' });

    expect(result.status).toBe('fallback');
    expect(result.text).toContain('I can help with quick receipt entry');
    expect(result.text).toContain('Add a receipt from Quick Stop for RM 12.50');
  });

  it('fails fast when required environment variables are missing', () => {
    expect(() => resolveSkillConfig({ MATARESIT_API_BASE_URL: env.MATARESIT_API_BASE_URL })).toThrow(
      'Missing required Mataresit skill environment variables: MATARESIT_API_KEY, MATARESIT_SUPABASE_ACCESS_TOKEN',
    );
  });
});