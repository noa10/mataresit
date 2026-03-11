const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur';
const GAMIFICATION_XP_PER_LEVEL = 500;
const DEFAULT_LEADERBOARD_LIMIT = 100;
const MAX_LEADERBOARD_LIMIT = 100;
const VALID_LEADERBOARD_METRICS = new Set(['weekly_xp', 'monthly_receipts', 'deductible_total']);

type JsonRecord = Record<string, unknown>;

export interface GamificationApiContext {
  userId: string;
  scopes: string[];
  supabase: {
    rpc: (fn: string, args?: JsonRecord) => Promise<{ data: unknown; error: unknown }>;
    from: (table: string) => {
      select: (columns: string) => unknown;
    };
  };
  userSupabase?: unknown;
}

interface LeaderboardParams {
  metric: string;
  countryCode: string | null;
  limit: number;
}

export async function handleGamificationAPI(
  req: Request,
  pathSegments: string[],
  context: GamificationApiContext,
): Promise<Response> {
  const action = pathSegments[1];

  if (pathSegments.length !== 2 || (action !== 'profile' && action !== 'leaderboard')) {
    return createErrorResponse('Gamification resource not found', 404);
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  if (!hasRequiredScope(context.scopes, 'gamification:read')) {
    return createErrorResponse('Insufficient permissions for gamification:read', 403);
  }

  if (action === 'profile') {
    return getGamificationProfile(context);
  }

  return getGamificationLeaderboard(req, context);
}

async function getGamificationProfile(context: GamificationApiContext): Promise<Response> {
  try {
    const [statsResult, timezoneResult, badgeDefinitionsResult, userBadgesResult, recentEventsResult] = await Promise.all([
      context.supabase.rpc('ensure_user_gamification_stats', { p_user_id: context.userId }),
      context.supabase
        .from('profiles')
        .select('timezone_preference')
        .eq('id', context.userId)
        .maybeSingle(),
      context.supabase
        .from('gamification_badges')
        .select('id, code, name, description, icon_name, category, rarity, sort_order, criteria, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      context.supabase
        .from('user_badges')
        .select('id, user_id, badge_id, equipped, metadata, unlocked_at, created_at, updated_at')
        .eq('user_id', context.userId)
        .order('unlocked_at', { ascending: false })
        .limit(10),
      context.supabase
        .from('gamification_xp_events')
        .select('id, user_id, source_type, source_id, receipt_id, amount, metadata, idempotency_key, awarded_at, created_at')
        .eq('user_id', context.userId)
        .order('awarded_at', { ascending: false })
        .limit(10),
    ]);

    if (statsResult.error) {
      console.error('Failed to load gamification stats:', statsResult.error);
      return createErrorResponse('Failed to retrieve gamification profile', 500);
    }

    if (badgeDefinitionsResult.error) {
      console.error('Failed to load badge definitions:', badgeDefinitionsResult.error);
      return createErrorResponse('Failed to retrieve gamification profile', 500);
    }

    if (userBadgesResult.error) {
      console.error('Failed to load unlocked badges:', userBadgesResult.error);
      return createErrorResponse('Failed to retrieve gamification profile', 500);
    }

    if (recentEventsResult.error) {
      console.error('Failed to load recent reward events:', recentEventsResult.error);
      return createErrorResponse('Failed to retrieve gamification profile', 500);
    }

    const timezone = safeString(timezoneResult.data?.timezone_preference) ?? DEFAULT_TIMEZONE;
    const profile = mapProfile(context.userId, toRecord(statsResult.data), timezone);
    const definitionsById = new Map(
      asArray(badgeDefinitionsResult.data).map((value) => {
        const row = toRecord(value);
        return [safeString(row.id) ?? '', {
          badgeId: safeString(row.id) ?? '',
          code: safeString(row.code),
          name: safeString(row.name),
          description: safeString(row.description),
          iconName: safeString(row.icon_name),
          category: safeString(row.category),
          rarity: safeString(row.rarity) ?? 'common',
          sortOrder: safeNumber(row.sort_order),
        }];
      }),
    );

    const badges = asArray(userBadgesResult.data)
      .map((value) => mapBadge(toRecord(value), definitionsById))
      .filter((value) => value !== null);
    const recentRewards = asArray(recentEventsResult.data)
      .map((value) => mapReward(toRecord(value)))
      .filter((value) => value !== null);

    return createSuccessResponse({
      profile,
      badgeSummary: {
        totalUnlocked: badges.length,
        equipped: badges.filter((badge) => badge.equipped),
        recent: badges.slice(0, 5),
      },
      recentRewards,
    });
  } catch (error) {
    console.error('Gamification profile API error:', error);
    return createErrorResponse('Failed to retrieve gamification profile', 500);
  }
}

async function getGamificationLeaderboard(req: Request, context: GamificationApiContext): Promise<Response> {
  const params = parseLeaderboardParams(req);
  if ('error' in params) {
    return createErrorResponse(params.error, 400);
  }

  if (!hasRpcClient(context.userSupabase)) {
    return createErrorResponse(
      'Leaderboard viewer context unavailable; validated user-scoped client required',
      501,
    );
  }

  try {
    const { data, error } = await context.userSupabase.rpc('get_gamification_leaderboard', {
      _metric: params.metric,
      _country_code: params.countryCode,
      _limit: params.limit,
    });

    if (error) {
      const message = safeString((error as JsonRecord).message) ?? 'Unknown leaderboard error';
      console.error('Failed to load gamification leaderboard:', error);

      if (message === 'Authentication required') {
        return createErrorResponse(
          'Leaderboard viewer context unavailable; validated user-scoped client required',
          501,
        );
      }

      if (message.startsWith('Unsupported leaderboard metric')) {
        return createErrorResponse(message, 400);
      }

      return createErrorResponse('Failed to retrieve gamification leaderboard', 500);
    }

    const entries = asArray(data).map((value, index) => mapLeaderboardEntry(toRecord(value), params.metric, index));

    return createSuccessResponse({
      metric: params.metric,
      countryCode: params.countryCode,
      limit: params.limit,
      entries,
      viewerEntry: entries.find((entry) => entry.isCurrentUser) ?? null,
    });
  } catch (error) {
    console.error('Gamification leaderboard API error:', error);
    return createErrorResponse('Failed to retrieve gamification leaderboard', 500);
  }
}

function parseLeaderboardParams(req: Request): LeaderboardParams | { error: string } {
  const url = new URL(req.url);
  const metric = (url.searchParams.get('metric') ?? 'weekly_xp').trim();
  const rawCountryCode = url.searchParams.get('country_code') ?? url.searchParams.get('countryCode');
  const rawLimit = url.searchParams.get('limit');

  if (!VALID_LEADERBOARD_METRICS.has(metric)) {
    return {
      error: `Unsupported leaderboard metric '${metric}'. Expected one of: weekly_xp, monthly_receipts, deductible_total`,
    };
  }

  if (rawLimit !== null && !/^[0-9]+$/.test(rawLimit.trim())) {
    return {
      error: 'Leaderboard limit must be a positive integer',
    };
  }

  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LEADERBOARD_LIMIT;
  const limit = Math.min(Math.max(parsedLimit, 1), MAX_LEADERBOARD_LIMIT);

  return {
    metric,
    countryCode: normalizeCountryCode(rawCountryCode),
    limit,
  };
}

function mapProfile(userId: string, stats: JsonRecord, timezone: string) {
  const totalXp = safeNumber(stats.total_xp);
  const currentLevel = Math.max(1, safeNumber(stats.current_level, Math.floor(totalXp / GAMIFICATION_XP_PER_LEVEL) + 1));
  const xpFloor = Math.max(0, (currentLevel - 1) * GAMIFICATION_XP_PER_LEVEL);
  const xpIntoLevel = Math.max(0, totalXp - xpFloor);
  const lastScanDate = safeString(stats.last_scan_date);

  return {
    userId,
    totalXp,
    currentLevel,
    xpIntoLevel,
    xpForNextLevel: GAMIFICATION_XP_PER_LEVEL,
    progressPercent: Math.min(100, Math.max(0, (xpIntoLevel / GAMIFICATION_XP_PER_LEVEL) * 100)),
    loginStreakDays: safeNumber(stats.login_streak_days),
    scanStreakDays: safeNumber(stats.scan_streak_days),
    longestLoginStreakDays: safeNumber(stats.longest_login_streak_days),
    longestScanStreakDays: safeNumber(stats.longest_scan_streak_days),
    totalReceiptsScanned: safeNumber(stats.total_receipts_scanned),
    deductibleReceiptCount: safeNumber(stats.deductible_receipt_count),
    deductibleTotalAmount: safeNumber(stats.deductible_total_amount),
    dailyGoalCompletedToday: lastScanDate === todayStamp(timezone),
    leaderboardOptIn: safeBoolean(stats.leaderboard_opt_in),
    leaderboardDisplayMode: stats.leaderboard_display_mode === 'name' ? 'name' : 'anonymous',
    countryCode: safeString(stats.country_code) ?? 'MY',
    referralCode: safeString(stats.referral_code),
    successfulReferrals: safeNumber(stats.successful_referrals),
    selectedScannerTheme: safeString(stats.selected_scanner_theme) ?? 'default',
    unlockedScannerThemes: safeStringArray(stats.unlocked_scanner_themes, ['default']),
    lastLoginDate: safeString(stats.last_login_date),
    lastScanDate,
    updatedAt: safeString(stats.updated_at),
  };
}

function mapBadge(
  row: JsonRecord,
  definitionsById: Map<string, {
    badgeId: string;
    code: string | null;
    name: string | null;
    description: string | null;
    iconName: string | null;
    category: string | null;
    rarity: string;
    sortOrder: number;
  }>,
) {
  const definition = definitionsById.get(safeString(row.badge_id) ?? '');
  if (!definition) {
    return null;
  }

  return {
    id: safeString(row.id) ?? '',
    badgeId: definition.badgeId,
    code: definition.code,
    name: definition.name,
    description: definition.description,
    iconName: definition.iconName,
    category: definition.category,
    rarity: definition.rarity,
    equipped: safeBoolean(row.equipped),
    unlockedAt: safeString(row.unlocked_at),
    sortOrder: definition.sortOrder,
  };
}

function mapReward(row: JsonRecord) {
  const metadata = toRecord(row.metadata);

  return {
    id: safeString(row.id) ?? '',
    sourceType: safeString(row.source_type) ?? 'unknown',
    amount: safeNumber(row.amount),
    awardedAt: safeString(row.awarded_at) ?? safeString(row.created_at),
    totalXp: nullableNumber(metadata.total_xp ?? metadata.new_total_xp),
    levelUpTo: nullableNumber(metadata.level_up_to ?? metadata.current_level),
    badgeNames: namesFromMixedPayload(metadata.badges_unlocked ?? metadata.badgesUnlocked, metadata.badge_name),
    missionTitles: namesFromMixedPayload(metadata.missions_completed ?? metadata.missionsCompleted, metadata.mission_title),
  };
}

function mapLeaderboardEntry(row: JsonRecord, metric: string, index: number) {
  return {
    rank: safeNumber(row.rank, index + 1),
    userId: safeString(row.user_id) ?? '',
    displayName: safeString(row.display_name) ?? `Anonymous #${index + 1}`,
    isCurrentUser: safeBoolean(row.is_current_user),
    isAnonymous: safeBoolean(row.is_anonymous),
    metric,
    value: safeNumber(row.metric_value),
    gapToTopTen: nullableNumber(row.gap_to_top_ten),
  };
}

function namesFromMixedPayload(primary: unknown, secondary: unknown): string[] {
  const values = Array.isArray(primary) ? primary : secondary ? [secondary] : [];

  return values
    .map((value) => {
      if (typeof value === 'string') {
        return value.trim();
      }

      const record = toRecord(value);
      return safeString(record.name) ?? safeString(record.title) ?? safeString(record.code) ?? '';
    })
    .filter((value) => value.length > 0);
}

function todayStamp(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}

function normalizeCountryCode(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function hasRpcClient(value: unknown): value is { rpc: (fn: string, args?: JsonRecord) => Promise<{ data: unknown; error: unknown }> } {
  return typeof value === 'object' && value !== null && typeof (value as { rpc?: unknown }).rpc === 'function';
}

function hasRequiredScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes('admin:all') || scopes.includes(requiredScope);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null ? (value as JsonRecord) : {};
}

function safeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return safeNumber(value, 0);
}

function safeBoolean(value: unknown): boolean {
  return value === true;
}

function safeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value
    .map((entry) => safeString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return strings.length > 0 ? strings : fallback;
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      code: status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

function createSuccessResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}