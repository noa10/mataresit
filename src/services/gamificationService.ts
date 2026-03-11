import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  GAMIFICATION_XP_PER_LEVEL,
  SCANNER_THEME_IDS,
  type BadgeDefinition,
  type Mission,
  type GamificationPreferencesUpdate,
  type GamificationProfile,
  type GamificationRewardSummary,
  type GamificationSnapshot,
  type LeaderboardEntry,
  type LeaderboardQueryOptions,
  type LeaderboardMetric,
  type MissionProgress,
  type ReferralSummary,
  type ScannerThemeId,
  type UserBadge,
  type XpEvent,
} from "@/types/gamification";

type QueryError = { code?: string; message?: string } | null;
type QueryResult<T> = { data: T; error: QueryError };
type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: (...args: unknown[]) => QueryBuilder<T>;
  eq: (...args: unknown[]) => QueryBuilder<T>;
  order: (...args: unknown[]) => QueryBuilder<T>;
  limit: (...args: unknown[]) => QueryBuilder<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
  upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<QueryResult<T>>;
};

type BestEffortClient = typeof supabase & {
  from: <T = unknown>(table: string) => QueryBuilder<T>;
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<QueryResult<T>>;
  channel: (name: string) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => Promise<unknown> | unknown;
};

type RewardHandlers = {
  onXpEvent?: (event: XpEvent) => void;
  onBadgeChange?: (badge: UserBadge) => void;
  onStatsChange?: () => void;
};

const client = supabase as BestEffortClient;
const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

const gamificationQueryKeys = {
  root: ["gamification"] as const,
  snapshot: (userId: string) => ["gamification", "snapshot", userId] as const,
  leaderboard: (metric: LeaderboardMetric, countryCode: string | null = null) => ["gamification", "leaderboard", metric, countryCode ?? "global"] as const,
  missions: (userId: string) => ["gamification", "missions", userId] as const,
  referral: (userId: string) => ["gamification", "referral", userId] as const,
  legacySurface: (userId: string) => ["gamification-surface", userId] as const,
};

const safeString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null);
const safeNumber = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const safeNullableNumber = (value: unknown) => (value === null || value === undefined ? null : safeNumber(value));
const safeBoolean = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const safeRecord = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const safeThemes = (value: unknown): ScannerThemeId[] => {
  const themes = Array.isArray(value) ? value.filter((entry): entry is ScannerThemeId => SCANNER_THEME_IDS.includes(entry as ScannerThemeId)) : [];
  return themes.length > 0 ? Array.from(new Set(themes)) : ["default"];
};
const hasMissingArtifactError = (error: { code?: string; message?: string } | null) => {
  const content = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return content.includes("does not exist") || content.includes("not found") || content.includes("schema cache") || content.includes("could not find");
};
const todayStamp = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const buildReferralLink = (referralCode: string | null) => {
  if (!referralCode) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://mataresit.com";
  return `${origin}/auth?ref=${encodeURIComponent(referralCode)}`;
};

const fallbackProfile = (userId: string): GamificationProfile => ({
  userId,
  totalXp: 0,
  currentLevel: 1,
  xpIntoLevel: 0,
  xpForNextLevel: GAMIFICATION_XP_PER_LEVEL,
  progressPercent: 0,
  loginStreakDays: 0,
  scanStreakDays: 0,
  longestLoginStreakDays: 0,
  longestScanStreakDays: 0,
  totalReceiptsScanned: 0,
  deductibleReceiptCount: 0,
  deductibleTotalAmount: 0,
  dailyGoalCompletedToday: false,
  leaderboardOptIn: false,
  leaderboardDisplayMode: "anonymous",
  countryCode: "MY",
  referralCode: null,
  successfulReferrals: 0,
  selectedScannerTheme: "default",
  unlockedScannerThemes: ["default"],
  lastLoginDate: null,
  lastScanDate: null,
  updatedAt: null,
});

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toXpEvent = (row: Record<string, unknown>): XpEvent => ({
  id: safeString(row.id) ?? randomId(),
  userId: safeString(row.user_id) ?? "",
  sourceType: safeString(row.source_type) ?? "admin_adjustment",
  sourceId: safeString(row.source_id),
  receiptId: safeString(row.receipt_id),
  amount: safeNumber(row.amount),
  metadata: safeRecord(row.metadata),
  idempotencyKey: safeString(row.idempotency_key),
  awardedAt: safeString(row.awarded_at),
  createdAt: safeString(row.created_at),
});

const namesFromMixedPayload = (value: unknown, fallbackValue: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : safeString(safeRecord(entry).name) ?? safeString(safeRecord(entry).title) ?? null))
      .filter((entry): entry is string => Boolean(entry));
  }

  const fallback = safeString(fallbackValue);
  return fallback ? [fallback] : [];
};

const toRewardSummary = (event: XpEvent): GamificationRewardSummary => {
  const metadata = safeRecord(event.metadata);
  const totalXp = metadata.total_xp ?? metadata.new_total_xp;
  const levelUpTo = metadata.level_up_to ?? metadata.current_level;

  return {
    eventId: event.id,
    sourceType: event.sourceType,
    amount: event.amount,
    totalXp: totalXp === null || totalXp === undefined ? null : safeNumber(totalXp),
    levelUpTo: levelUpTo === null || levelUpTo === undefined ? null : safeNumber(levelUpTo),
    badgeNames: namesFromMixedPayload(metadata.badges_unlocked ?? metadata.badgesUnlocked, metadata.badge_name),
    missionTitles: namesFromMixedPayload(metadata.missions_completed ?? metadata.missionsCompleted, metadata.mission_title),
  };
};

const toMission = (value: unknown): Mission | null => {
  const row = safeRecord(value);
  const missionId = safeString(row.id);
  const code = safeString(row.code);

  if (!missionId && !code) return null;

  return {
    id: missionId ?? randomId(),
    code: code ?? "",
    title: safeString(row.title) ?? "",
    description: safeString(row.description) ?? "",
    missionType: safeString(row.missionType ?? row.mission_type) ?? "one_time",
    objectiveType: safeString(row.objectiveType ?? row.objective_type) ?? "receipts_scanned",
    targetValue: safeNumber(row.targetValue ?? row.target_value),
    rewardXp: safeNumber(row.rewardXp ?? row.reward_xp),
    startsAt: safeString(row.startsAt ?? row.starts_at),
    endsAt: safeString(row.endsAt ?? row.ends_at),
    metadata: safeRecord(row.metadata),
  };
};

const toMissionProgress = (row: Record<string, unknown>): MissionProgress => {
  const mission = toMission(row.mission);

  return {
    id: safeString(row.id) ?? randomId(),
    missionId: safeString(row.mission_id) ?? mission?.id ?? "",
    currentValue: safeNumber(row.current_value),
    targetValue: safeNumber(row.target_value, mission?.targetValue ?? 0),
    completedAt: safeString(row.completed_at),
    claimedAt: safeString(row.claimed_at),
    mission,
    communityCurrentValue: safeNullableNumber(row.community_current_value),
    communityTargetValue: safeNullableNumber(row.community_target_value),
    communityCompletedAt: safeString(row.community_completed_at),
  };
};

const loadStats = async (userId: string) => {
  const { data, error } = await client.rpc("ensure_user_gamification_stats", { p_user_id: userId });
  if (!error && data) return data as Record<string, unknown>;

  const fallback = await client.from("user_gamification_stats").select("*").eq("user_id", userId).maybeSingle();
  return (fallback?.data ?? {}) as Record<string, unknown>;
};

const loadOptionalRows = async <T>(table: string, query: (builder: QueryBuilder<T>) => PromiseLike<QueryResult<T>> | Promise<QueryResult<T>>) => {
  try {
    const result = await query(client.from(table));
    if (result?.error && !hasMissingArtifactError(result.error)) {
      console.warn(`Unable to load ${table}`, result.error);
    }
    return result?.data ?? [];
  } catch (error) {
    console.warn(`Unable to load ${table}`, error);
    return [];
  }
};

const loadMissionRows = async () => {
  try {
    const { data, error } = await client.rpc("get_gamification_missions");
    if (error) {
      if (!hasMissingArtifactError(error)) {
        console.warn("Unable to load gamification missions.", error);
      }
      return [] as Record<string, unknown>[];
    }

    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  } catch (error) {
    console.warn("Unable to load gamification missions.", error);
    return [] as Record<string, unknown>[];
  }
};

const mapProfile = (userId: string, stats: Record<string, unknown>, timezone: string): GamificationProfile => {
  const totalXp = safeNumber(stats.total_xp);
  const currentLevel = Math.max(1, safeNumber(stats.current_level, Math.floor(totalXp / GAMIFICATION_XP_PER_LEVEL) + 1));
  const xpFloor = Math.max(0, (currentLevel - 1) * GAMIFICATION_XP_PER_LEVEL);
  const xpIntoLevel = Math.max(0, totalXp - xpFloor);
  const lastScanDate = safeString(stats.last_scan_date);

  return {
    ...fallbackProfile(userId),
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
    leaderboardDisplayMode: stats.leaderboard_display_mode === "name" ? "name" : "anonymous",
    countryCode: safeString(stats.country_code) ?? "MY",
    referralCode: safeString(stats.referral_code),
    successfulReferrals: safeNumber(stats.successful_referrals),
    selectedScannerTheme: SCANNER_THEME_IDS.includes(stats.selected_scanner_theme as ScannerThemeId) ? (stats.selected_scanner_theme as ScannerThemeId) : "default",
    unlockedScannerThemes: safeThemes(stats.unlocked_scanner_themes),
    lastLoginDate: safeString(stats.last_login_date),
    lastScanDate,
    updatedAt: safeString(stats.updated_at),
  };
};

export const gamificationService = {
  async getSnapshot(userId: string): Promise<GamificationSnapshot> {
    const [stats, badgeDefinitions, badgeRows, recentEvents, timezoneRow, missionRows, referralRows] = await Promise.all([
      loadStats(userId),
      loadOptionalRows("gamification_badges", (builder) => builder.select("*").eq("is_active", true).order("sort_order", { ascending: true })),
      loadOptionalRows("user_badges", (builder) => builder.select("*").eq("user_id", userId).order("unlocked_at", { ascending: false })),
      loadOptionalRows("gamification_xp_events", (builder) => builder.select("*").eq("user_id", userId).order("awarded_at", { ascending: false }).limit(10)),
      client.from("profiles").select("timezone_preference").eq("id", userId).maybeSingle(),
      loadMissionRows(),
      loadOptionalRows("gamification_referrals", (builder) => builder.select("redeemed_at,reward_released_at").eq("inviter_user_id", userId)),
    ]);

    const profile = mapProfile(userId, stats, safeString(timezoneRow?.data?.timezone_preference) ?? DEFAULT_TIMEZONE);
    const definitionsById = new Map<string, BadgeDefinition>((badgeDefinitions as Record<string, unknown>[]).map((row) => [safeString(row.id) ?? "", {
      id: safeString(row.id) ?? "",
      code: safeString(row.code) ?? "",
      name: safeString(row.name) ?? "",
      description: safeString(row.description) ?? "",
      iconName: safeString(row.icon_name) ?? "",
      category: safeString(row.category) ?? "",
      rarity: safeString(row.rarity) ?? "common",
      sortOrder: safeNumber(row.sort_order),
      criteria: safeRecord(row.criteria),
      isActive: safeBoolean(row.is_active, true),
    }]));

    const inviterReferralRows = referralRows as Record<string, unknown>[];
    const pendingReferrals = inviterReferralRows.filter((row) => safeString(row.redeemed_at) && !safeString(row.reward_released_at)).length;
    const redeemedReferrals = inviterReferralRows.filter((row) => safeString(row.reward_released_at)).length;

    return {
      profile,
      badges: (badgeRows as Record<string, unknown>[]).map((row) => {
        const definition = definitionsById.get(safeString(row.badge_id) ?? "") ?? null;
        return {
          id: safeString(row.id) ?? randomId(),
          userId: safeString(row.user_id) ?? userId,
          badgeId: safeString(row.badge_id) ?? "",
          code: definition?.code ?? safeString(safeRecord(row.metadata).badge_code),
          definition,
          equipped: safeBoolean(row.equipped),
          metadata: safeRecord(row.metadata),
          unlockedAt: safeString(row.unlocked_at),
          createdAt: safeString(row.created_at),
          updatedAt: safeString(row.updated_at),
        };
      }),
      recentEvents: (recentEvents as Record<string, unknown>[]).map(toXpEvent),
      activeMissions: missionRows.map(toMissionProgress),
      referralSummary: {
        referralCode: profile.referralCode,
        successfulReferrals: Math.max(profile.successfulReferrals, redeemedReferrals),
        pendingReferrals,
        redeemedReferrals,
        referralLink: buildReferralLink(profile.referralCode),
      },
    };
  },

  async recordDailyLogin() {
    const { error } = await client.rpc("record_daily_login");
    if (error) {
      console.warn("Unable to record daily login reward.", error);
      return false;
    }
    return true;
  },

  async recordReceiptReview(receiptId: string) {
    const { error } = await client.rpc("record_receipt_review", { _receipt_id: receiptId });
    if (error) {
      console.warn("Unable to record receipt review reward.", error);
      return false;
    }
    return true;
  },

  async updatePreferences(userId: string, updates: GamificationPreferencesUpdate) {
    const { error } = await client.from("user_gamification_stats").upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
      leaderboard_opt_in: updates.leaderboardOptIn,
      leaderboard_display_mode: updates.leaderboardDisplayMode,
      selected_scanner_theme: updates.selectedScannerTheme,
    }, { onConflict: "user_id" });
    if (error) {
      console.warn("Unable to persist gamification preferences.", error);
      return false;
    }
    return true;
  },

  async getLeaderboard(metric: LeaderboardMetric, options: LeaderboardQueryOptions = {}): Promise<LeaderboardEntry[]> {
    const { data, error } = await client.rpc("get_gamification_leaderboard", {
      _metric: metric,
      _country_code: options.countryCode ?? null,
      _limit: options.limit ?? 100,
    });
    if (error) {
      console.warn("Unable to load gamification leaderboard.", error);
      return [];
    }
    return Array.isArray(data)
      ? data.map((row, index) => ({
          rank: safeNumber(row.rank, index + 1),
          userId: safeString(row.user_id) ?? "",
          displayName: safeString(row.display_name) ?? "Anonymous",
          isCurrentUser: safeBoolean(row.is_current_user),
          isAnonymous: safeBoolean(row.is_anonymous, true),
          metric,
          value: safeNumber(row.value ?? row.metric_value),
          gapToTopTen: row.gap_to_top_ten === null || row.gap_to_top_ten === undefined ? null : safeNumber(row.gap_to_top_ten),
        }))
      : [];
  },

  async getMissions(): Promise<MissionProgress[]> {
    return (await loadMissionRows()).map(toMissionProgress);
  },

  async getReferralSummary(userId: string): Promise<ReferralSummary> {
    const snapshot = await this.getSnapshot(userId);
    return snapshot.referralSummary;
  },

  async redeemReferralCode(code: string) {
    const { error } = await client.rpc("redeem_referral_code", { p_referral_code: code });
    if (error) {
      console.warn("Unable to redeem referral code.", error);
      return false;
    }
    return true;
  },

  subscribeToUserRewards(userId: string, handlers: RewardHandlers) {
    const channel = client.channel(`gamification:${userId}`);

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gamification_xp_events", filter: `user_id=eq.${userId}` }, (payload) => {
        handlers.onXpEvent?.(toXpEvent((payload.new ?? {}) as Record<string, unknown>));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges", filter: `user_id=eq.${userId}` }, (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        handlers.onBadgeChange?.({
          id: safeString(row.id) ?? randomId(),
          userId: safeString(row.user_id) ?? userId,
          badgeId: safeString(row.badge_id) ?? "",
          code: safeString(safeRecord(row.metadata).badge_code),
          definition: null,
          equipped: safeBoolean(row.equipped),
          metadata: safeRecord(row.metadata),
          unlockedAt: safeString(row.unlocked_at),
          createdAt: safeString(row.created_at),
          updatedAt: safeString(row.updated_at),
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_gamification_stats", filter: `user_id=eq.${userId}` }, () => {
        handlers.onStatsChange?.();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },
};

export { buildReferralLink, gamificationQueryKeys, toRewardSummary };