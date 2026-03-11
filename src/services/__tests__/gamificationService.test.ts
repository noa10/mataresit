import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

import { gamificationService, toRewardSummary } from "@/services/gamificationService";

type MockQueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

const createBuilder = (result: MockQueryResult) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue(result),
  upsert: vi.fn().mockResolvedValue(result),
  then: (resolve: (value: typeof result) => void) => resolve(result),
});

describe("gamificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps snapshot data from stats, badges, and xp events", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "ensure_user_gamification_stats") {
        return {
          data: {
            user_id: "user-1",
            total_xp: 750,
            current_level: 2,
            scan_streak_days: 3,
            last_scan_date: "2026-03-10",
            referral_code: "ABC123",
            successful_referrals: 2,
            unlocked_scanner_themes: ["default", "ocean"],
          },
          error: null,
        };
      }

      if (fn === "get_gamification_missions") {
        return {
          data: [{
            id: "mission-progress-1",
            mission_id: "mission-1",
            current_value: 1,
            target_value: 3,
            completed_at: null,
            claimed_at: null,
            mission: {
              id: "mission-1",
              code: "first_receipt_complete",
              title: "First receipt complete",
              description: "Finish your first successful receipt scan.",
              missionType: "one_time",
              objectiveType: "receipts_scanned",
              targetValue: 3,
              rewardXp: 40,
              startsAt: null,
              endsAt: null,
              metadata: {},
            },
            community_current_value: null,
            community_target_value: null,
            community_completed_at: null,
          }],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "gamification_badges") {
        return createBuilder({
          data: [{
            id: "badge-1",
            code: "first_scan",
            name: "First Scan",
            description: "desc",
            icon_name: "scan",
            category: "onboarding",
            rarity: "common",
            sort_order: 10,
            criteria: {},
            is_active: true,
          }],
          error: null,
        });
      }

      if (table === "user_badges") {
        return createBuilder({
          data: [{
            id: "user-badge-1",
            user_id: "user-1",
            badge_id: "badge-1",
            equipped: true,
            metadata: {},
            unlocked_at: "2026-03-10T10:00:00Z",
            created_at: "2026-03-10T10:00:00Z",
            updated_at: "2026-03-10T10:00:00Z",
          }],
          error: null,
        });
      }

      if (table === "gamification_xp_events") {
        return createBuilder({
          data: [{
            id: "event-1",
            user_id: "user-1",
            source_type: "receipt_scan",
            amount: 20,
            metadata: { level_up_to: 2 },
            awarded_at: "2026-03-10T10:00:00Z",
            created_at: "2026-03-10T10:00:00Z",
          }],
          error: null,
        });
      }

      if (table === "gamification_referrals") {
        return createBuilder({
          data: [
            { redeemed_at: "2026-03-10T08:00:00Z", reward_released_at: null },
            { redeemed_at: "2026-03-09T08:00:00Z", reward_released_at: "2026-03-10T09:00:00Z" },
          ],
          error: null,
        });
      }

      return createBuilder({ data: { timezone_preference: "Asia/Kuala_Lumpur" }, error: null });
    });

    const snapshot = await gamificationService.getSnapshot("user-1");

    expect(snapshot.profile.totalXp).toBe(750);
    expect(snapshot.profile.currentLevel).toBe(2);
    expect(snapshot.profile.scanStreakDays).toBe(3);
    expect(snapshot.badges[0].definition?.code).toBe("first_scan");
    expect(snapshot.referralSummary.referralCode).toBe("ABC123");
    expect(snapshot.referralSummary.pendingReferrals).toBe(1);
    expect(snapshot.referralSummary.redeemedReferrals).toBe(1);
    expect(snapshot.recentEvents[0].sourceType).toBe("receipt_scan");
    expect(snapshot.activeMissions[0].mission?.code).toBe("first_receipt_complete");
  });

  it("persists preference updates to user_gamification_stats", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert });

    const success = await gamificationService.updatePreferences("user-99", {
      leaderboardOptIn: true,
      leaderboardDisplayMode: "name",
      selectedScannerTheme: "ocean",
    });

    expect(success).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-99",
      leaderboard_opt_in: true,
      leaderboard_display_mode: "name",
      selected_scanner_theme: "ocean",
    }), { onConflict: "user_id" });
  });

  it("passes leaderboard filters to the RPC and maps rows safely", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{
        rank: 14,
        user_id: "user-14",
        display_name: "Anonymous #14",
        is_current_user: false,
        is_anonymous: true,
        metric_value: 320,
        gap_to_top_ten: 18,
      }],
      error: null,
    });

    const leaderboard = await gamificationService.getLeaderboard("weekly_xp", {
      countryCode: "MY",
      limit: 25,
    });

    expect(rpcMock).toHaveBeenCalledWith("get_gamification_leaderboard", {
      _metric: "weekly_xp",
      _country_code: "MY",
      _limit: 25,
    });
    expect(leaderboard).toEqual([{
      rank: 14,
      userId: "user-14",
      displayName: "Anonymous #14",
      isCurrentUser: false,
      isAnonymous: true,
      metric: "weekly_xp",
      value: 320,
      gapToTopTen: 18,
    }]);
  });

  it("maps mission rpc rows into typed mission progress", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{
        id: "mission-progress-2",
        mission_id: "mission-2",
        current_value: 245,
        target_value: 250,
        completed_at: null,
        claimed_at: null,
        mission: {
          id: "mission-2",
          code: "weekly_tax_focus",
          title: "Weekly tax focus",
          description: "Track RM250 of deductible receipts this week.",
          missionType: "weekly",
          objectiveType: "deductible_total_amount",
          targetValue: 250,
          rewardXp: 80,
          startsAt: "2026-03-09T00:00:00Z",
          endsAt: "2026-03-15T23:59:59Z",
          metadata: { theme: "weekly" },
        },
        community_current_value: null,
        community_target_value: null,
        community_completed_at: null,
      }],
      error: null,
    });

    const missions = await gamificationService.getMissions();

    expect(missions).toEqual([{
      id: "mission-progress-2",
      missionId: "mission-2",
      currentValue: 245,
      targetValue: 250,
      completedAt: null,
      claimedAt: null,
      mission: {
        id: "mission-2",
        code: "weekly_tax_focus",
        title: "Weekly tax focus",
        description: "Track RM250 of deductible receipts this week.",
        missionType: "weekly",
        objectiveType: "deductible_total_amount",
        targetValue: 250,
        rewardXp: 80,
        startsAt: "2026-03-09T00:00:00Z",
        endsAt: "2026-03-15T23:59:59Z",
        metadata: { theme: "weekly" },
      },
      communityCurrentValue: null,
      communityTargetValue: null,
      communityCompletedAt: null,
    }]);
  });

  it("passes the SQL parameter name expected by redeem_referral_code RPC", async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null });

    const result = await gamificationService.redeemReferralCode("INVITE42");

    expect(rpcMock).toHaveBeenCalledWith("redeem_referral_code", {
      p_referral_code: "INVITE42",
    });
    expect(result).toBe(true);
  });

  it("extracts reward summary details from xp event metadata", () => {
    const reward = toRewardSummary({
      id: "event-1",
      userId: "user-1",
      sourceType: "receipt_scan",
      sourceId: null,
      receiptId: "receipt-1",
      amount: 15,
      metadata: {
        level_up_to: 3,
        total_xp: 1025,
        badges_unlocked: [{ name: "First Scan" }],
        missions_completed: [{ title: "Weekly Sprint" }],
      },
      idempotencyKey: null,
      awardedAt: null,
      createdAt: null,
    });

    expect(reward.levelUpTo).toBe(3);
    expect(reward.totalXp).toBe(1025);
    expect(reward.badgeNames).toEqual(["First Scan"]);
    expect(reward.missionTitles).toEqual(["Weekly Sprint"]);
  });
});