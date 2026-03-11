export const GAMIFICATION_XP_PER_LEVEL = 500;

export const SCANNER_THEME_IDS = ["default", "ocean", "forest", "sunset"] as const;
export const GAMIFICATION_BADGE_CODES = [
  "first_scan",
  "tax_saver_10",
  "tax_warrior_7",
  "receipt_marathon_30",
  "scanner_pro_100",
  "malaysia_tax_hero_5000",
  "level_5",
  "level_10",
  "mission_master",
  "recruiter",
] as const;
export const LEADERBOARD_METRICS = ["weekly_xp", "monthly_receipts", "deductible_total"] as const;
export const MISSION_TYPES = ["one_time", "weekly", "community"] as const;
export const MISSION_OBJECTIVES = [
  "receipts_scanned",
  "deductible_receipts",
  "deductible_total_amount",
  "scan_streak_days",
  "xp_earned",
] as const;

export type ScannerThemeId = (typeof SCANNER_THEME_IDS)[number];
export type GamificationBadgeCode = (typeof GAMIFICATION_BADGE_CODES)[number];
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];
export type MissionType = (typeof MISSION_TYPES)[number];
export type MissionObjectiveType = (typeof MISSION_OBJECTIVES)[number];
export type LeaderboardDisplayMode = "anonymous" | "name";
export type GamificationXpSourceType =
  | "daily_login"
  | "receipt_scan"
  | "daily_goal_bonus"
  | "manual_review"
  | "tax_bonus"
  | "badge_unlock"
  | "mission_completion"
  | "referral_reward"
  | "admin_adjustment";

export interface GamificationProfile {
  userId: string;
  totalXp: number;
  currentLevel: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  loginStreakDays: number;
  scanStreakDays: number;
  longestLoginStreakDays: number;
  longestScanStreakDays: number;
  totalReceiptsScanned: number;
  deductibleReceiptCount: number;
  deductibleTotalAmount: number;
  dailyGoalCompletedToday: boolean;
  leaderboardOptIn: boolean;
  leaderboardDisplayMode: LeaderboardDisplayMode;
  countryCode: string;
  referralCode: string | null;
  successfulReferrals: number;
  selectedScannerTheme: ScannerThemeId;
  unlockedScannerThemes: ScannerThemeId[];
  lastLoginDate: string | null;
  lastScanDate: string | null;
  updatedAt: string | null;
}

export interface XpEvent {
  id: string;
  userId: string;
  sourceType: GamificationXpSourceType | string;
  sourceId: string | null;
  receiptId: string | null;
  amount: number;
  metadata: Record<string, unknown>;
  idempotencyKey: string | null;
  awardedAt: string | null;
  createdAt: string | null;
}

export interface BadgeDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  iconName: string;
  category: string;
  rarity: string;
  sortOrder: number;
  criteria: Record<string, unknown>;
  isActive: boolean;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  code: string | null;
  definition: BadgeDefinition | null;
  equipped: boolean;
  metadata: Record<string, unknown>;
  unlockedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Mission {
  id: string;
  code: string;
  title: string;
  description: string;
  missionType: MissionType | string;
  objectiveType: MissionObjectiveType | string;
  targetValue: number;
  rewardXp: number;
  startsAt: string | null;
  endsAt: string | null;
  metadata: Record<string, unknown>;
}

export interface MissionProgress {
  id: string;
  missionId: string;
  currentValue: number;
  targetValue: number;
  completedAt: string | null;
  claimedAt: string | null;
  mission: Mission | null;
  communityCurrentValue: number | null;
  communityTargetValue: number | null;
  communityCompletedAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  isAnonymous: boolean;
  metric: LeaderboardMetric;
  value: number;
  gapToTopTen: number | null;
}

export interface LeaderboardQueryOptions {
  countryCode?: string | null;
  limit?: number;
}

export interface ReferralSummary {
  referralCode: string | null;
  successfulReferrals: number;
  pendingReferrals: number;
  redeemedReferrals: number;
  referralLink: string | null;
}

export interface GamificationSnapshot {
  profile: GamificationProfile;
  badges: UserBadge[];
  recentEvents: XpEvent[];
  activeMissions: MissionProgress[];
  referralSummary: ReferralSummary;
}

export interface GamificationPreferencesUpdate {
  leaderboardOptIn?: boolean;
  leaderboardDisplayMode?: LeaderboardDisplayMode;
  selectedScannerTheme?: ScannerThemeId;
}

export interface GamificationRewardSummary {
  eventId: string;
  sourceType: string;
  amount: number;
  totalXp: number | null;
  levelUpTo: number | null;
  badgeNames: string[];
  missionTitles: string[];
}