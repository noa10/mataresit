import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileRewardsPanel } from "@/components/gamification/ProfileRewardsPanel";

const mocks = vi.hoisted(() => ({
  shareAchievementCard: vi.fn(),
  updatePreferences: vi.fn(),
  toast: vi.fn(),
  clipboardWriteText: vi.fn(),
  mockSnapshot: {
    profile: {
      totalXp: 1200,
      currentLevel: 4,
      xpIntoLevel: 200,
      xpForNextLevel: 500,
      progressPercent: 40,
      loginStreakDays: 6,
      scanStreakDays: 9,
      dailyGoalCompletedToday: false,
      leaderboardOptIn: false,
      leaderboardDisplayMode: "anonymous" as const,
      selectedScannerTheme: "default" as const,
      unlockedScannerThemes: ["default", "ocean"] as const,
    },
    referralSummary: {
      referralCode: "INVITE42",
      pendingReferrals: 1,
      redeemedReferrals: 3,
      successfulReferrals: 3,
      referralLink: "https://app.test/auth?ref=INVITE42",
    },
    badges: [
      {
        id: "badge-1",
        code: "first_scan",
        equipped: true,
        unlockedAt: "2026-03-01T00:00:00Z",
        definition: { name: "First scan", description: "Complete your first successful scan." },
      },
      {
        id: "badge-2",
        code: "recruiter",
        equipped: false,
        unlockedAt: "2026-03-02T00:00:00Z",
        definition: { name: "Recruiter", description: "Invite friends to join." },
      },
    ],
  },
}));

vi.mock("@/contexts/GamificationContext", () => ({
  useGamification: () => ({
    snapshot: mocks.mockSnapshot,
    isLoading: false,
    updatePreferences: mocks.updatePreferences,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useProfileTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "rewards.title": "Rewards center",
        "rewards.description": "Manage your badges, privacy, themes, and referrals.",
        "rewards.actions.leaderboard": "Leaderboard",
        "rewards.actions.missions": "Missions",
        "rewards.overview.totalXp": "Total XP",
        "rewards.overview.level": `Level ${options?.level ?? 1}`,
        "rewards.overview.progress": "Progress to next level",
        "rewards.overview.loginStreak": "Login streak",
        "rewards.overview.scanStreak": "Scan streak",
        "rewards.overview.completed": "Completed",
        "rewards.overview.ready": "Ready",
        "rewards.overview.dailyGoal": "Daily bonus",
        "rewards.badges.title": "Badge collection",
        "rewards.badges.description": "Equip your proudest unlocks and preview what is next.",
        "rewards.badges.equipped": "Equipped badges",
        "rewards.badges.noneEquipped": "No badges equipped yet.",
        "rewards.badges.unlocked": "Unlocked",
        "rewards.themes.title": "Scanner themes",
        "rewards.themes.description": "Choose from unlocked scanner looks.",
        "rewards.themes.selected": "Selected",
        "rewards.themes.unlocked": "Unlocked",
        "rewards.themes.locked": "Locked",
        "rewards.themes.options.default.title": "Classic",
        "rewards.themes.options.default.description": "Clean and familiar.",
        "rewards.themes.options.ocean.title": "Ocean",
        "rewards.themes.options.ocean.description": "Cool blues for focused scans.",
        "rewards.themes.options.forest.title": "Forest",
        "rewards.themes.options.forest.description": "Earn via longer streaks.",
        "rewards.themes.options.sunset.title": "Sunset",
        "rewards.themes.options.sunset.description": "Reserved for your top runs.",
        "rewards.privacy.title": "Leaderboard privacy",
        "rewards.privacy.description": "Control whether your progress can appear publicly.",
        "rewards.privacy.leaderboardOptIn": "Join the leaderboard",
        "rewards.privacy.leaderboardOptInHint": "Opt in before sharing your rank.",
        "rewards.privacy.displayMode": "Display mode",
        "rewards.privacy.displayModes.anonymous": "Anonymous",
        "rewards.privacy.displayModes.public": "Public",
        "rewards.privacy.displayModeHint": "Choose how your name appears when opted in.",
        "rewards.referrals.title": "Referral summary",
        "rewards.referrals.description": "Share your invite code and track successful referrals.",
        "rewards.referrals.code": "Referral code",
        "rewards.referrals.successfulReferrals": "Successful referrals",
        "rewards.referrals.pendingReferrals": "Pending rewards",
        "rewards.referrals.redeemedReferrals": "Rewards released",
        "rewards.referrals.copyLink": "Copy referral link",
        "rewards.referrals.copySuccess": "Referral link copied",
        "rewards.referrals.copyFailed": "Unable to copy referral link",
        "rewards.shareCards.title": "Shareable achievement cards",
        "rewards.shareCards.description": "Create milestone cards.",
        "rewards.shareCards.footer": "Track more milestones in MataResit.",
        "rewards.shareCards.shareSuccess": "Share card ready",
        "rewards.shareCards.downloadFallback": "Share card downloaded",
        "rewards.shareCards.shareFailed": "Unable to prepare the share card",
        "rewards.shareCards.level.button": "Share level card",
        "rewards.shareCards.level.title": `Level ${options?.level ?? 1} reached`,
        "rewards.shareCards.level.subtitle": "Built with every successful scan and review.",
        "rewards.shareCards.level.shareText": `Level ${options?.level ?? 1}`,
        "rewards.shareCards.streak.button": "Share streak card",
        "rewards.shareCards.streak.title": `${options?.days ?? 0}-day scan streak`,
        "rewards.shareCards.streak.subtitle": "Consistency keeps the rewards flowing.",
        "rewards.shareCards.streak.value": `${options?.days ?? 0} day streak`,
        "rewards.shareCards.streak.shareText": `${options?.days ?? 0} day streak`,
        "rewards.shareCards.badge.button": "Share badge card",
        "rewards.shareCards.badge.title": "Badge unlocked",
        "rewards.shareCards.badge.subtitle": "Another milestone added to my rewards shelf.",
        "rewards.shareCards.badge.shareText": `${options?.badge ?? "Badge"}`,
        "rewards.shareCards.deductible.button": "Share deductible total",
        "rewards.shareCards.deductible.title": "Deductible total tracked",
        "rewards.shareCards.deductible.subtitle": "Every tax-ready receipt makes the next filing easier.",
        "rewards.shareCards.deductible.shareText": `${options?.total ?? "MYR 0.00"}`,
      };

      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/services/gamificationService", () => ({
  buildReferralLink: (code: string | null) => (code ? `https://app.test/auth?ref=${code}` : null),
}));

vi.mock("@/lib/shareCards", () => ({
  shareAchievementCard: mocks.shareAchievementCard,
}));

function renderPanel() {
  return render(
    <MemoryRouter>
      <ProfileRewardsPanel />
    </MemoryRouter>,
  );
}

describe("ProfileRewardsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updatePreferences.mockResolvedValue(true);
    mocks.clipboardWriteText.mockResolvedValue(undefined);
    mocks.shareAchievementCard.mockResolvedValue("shared");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mocks.clipboardWriteText,
      },
    });
  });

  it("renders rewards sections and placeholder route links", async () => {
    renderPanel();

    expect(await screen.findByText("Rewards center")).toBeInTheDocument();
    expect(await screen.findByText("Level 4")).toBeInTheDocument();
    expect(screen.getByText("Badge collection")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute("href", "/missions");
    expect(screen.getByText("INVITE42")).toBeInTheDocument();
    expect(screen.getByText("Pending rewards")).toBeInTheDocument();
    expect(screen.getByText("Shareable achievement cards")).toBeInTheDocument();
  });

  it("updates privacy preferences", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("INVITE42");
    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mocks.updatePreferences).toHaveBeenCalledWith({ leaderboardOptIn: true });
    });
  });

  it("prepares a share card from the rewards panel", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /Share level card/i }));

    await waitFor(() => {
      expect(mocks.shareAchievementCard).toHaveBeenCalledWith(expect.objectContaining({
        fileName: "mataresit-level-4.svg",
        title: "Level 4 reached",
      }));
    });
  });
});