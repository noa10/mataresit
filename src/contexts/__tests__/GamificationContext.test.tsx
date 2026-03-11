import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureReferralCodeFromSearch, getPendingReferralCode } from "@/lib/referralTracking";

type RewardEvent = {
  id: string;
  sourceType: string;
  amount: number;
  metadata?: Record<string, unknown>;
};

type RewardBadge = {
  code?: string | null;
  definition?: { name?: string | null } | null;
};

const rewardSubscription = vi.hoisted(() => ({
  onXpEvent: undefined as ((event: RewardEvent) => void) | undefined,
  onBadgeChange: undefined as ((badge: RewardBadge) => void) | undefined,
  onStatsChange: undefined as (() => void) | undefined,
}));

const gamificationServiceMock = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  recordDailyLogin: vi.fn(),
  updatePreferences: vi.fn(),
  recordReceiptReview: vi.fn(),
  getLeaderboard: vi.fn(),
  getMissions: vi.fn(),
  getReferralSummary: vi.fn(),
  redeemReferralCode: vi.fn(),
  subscribeToUserRewards: vi.fn(),
}));

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com" },
    session: { expires_at: 12345 },
  }),
}));

vi.mock("@/services/gamificationService", () => ({
  gamificationQueryKeys: {
    root: ["gamification"],
    snapshot: (userId: string) => ["gamification", "snapshot", userId],
    legacySurface: (userId: string) => ["gamification-surface", userId],
  },
  toRewardSummary: (event: RewardEvent) => ({
    eventId: event.id,
    sourceType: event.sourceType,
    amount: event.amount,
    totalXp: event.metadata?.total_xp ?? null,
    levelUpTo: event.metadata?.level_up_to ?? null,
    badgeNames: event.metadata?.badges ?? [],
    missionTitles: event.metadata?.missions ?? [],
  }),
  gamificationService: gamificationServiceMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
  },
}));

import { GamificationProvider } from "@/contexts/GamificationContext";

describe("GamificationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gamificationServiceMock.getSnapshot.mockResolvedValue({ profile: { totalXp: 0 } });
    gamificationServiceMock.recordDailyLogin.mockResolvedValue(true);
    gamificationServiceMock.redeemReferralCode.mockResolvedValue(true);
    gamificationServiceMock.subscribeToUserRewards.mockImplementation((_userId: string, handlers: typeof rewardSubscription) => {
      rewardSubscription.onXpEvent = handlers.onXpEvent;
      rewardSubscription.onBadgeChange = handlers.onBadgeChange;
      rewardSubscription.onStatsChange = handlers.onStatsChange;
      return vi.fn();
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("records daily login once per authenticated app session", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GamificationProvider>
          <div>ready</div>
        </GamificationProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(gamificationServiceMock.recordDailyLogin).toHaveBeenCalledTimes(1);
      expect(gamificationServiceMock.subscribeToUserRewards).toHaveBeenCalledWith("user-1", expect.any(Object));
    });
  });

  it("invalidates gamification caches and shows reward toasts on realtime xp events", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <GamificationProvider>
          <div>ready</div>
        </GamificationProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(rewardSubscription.onXpEvent).toBeTypeOf("function");
    });

    act(() => {
      rewardSubscription.onXpEvent?.({
        id: "event-1",
        sourceType: "receipt_scan",
        amount: 20,
        metadata: {
          total_xp: 520,
          level_up_to: 2,
          badges: ["First Scan"],
          missions: ["Weekly Sprint"],
        },
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["gamification"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["gamification-surface", "user-1"] });
      expect(toastSuccess).toHaveBeenCalledTimes(4);
    });
  });

  it("redeems a captured referral code once after login", async () => {
    captureReferralCodeFromSearch("?ref=INVITE42");

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <GamificationProvider>
          <div>ready</div>
        </GamificationProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(gamificationServiceMock.redeemReferralCode).toHaveBeenCalledWith("INVITE42");
    });

    expect(getPendingReferralCode()).toBeNull();
  });
});