import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GamificationProgressCard } from "@/components/gamification/GamificationProgressCard";

const mocks = vi.hoisted(() => ({
  dismissInstallPrompt: vi.fn(),
  mockSnapshot: {
    profile: {
      totalXp: 920,
      currentLevel: 3,
      xpIntoLevel: 420,
      xpForNextLevel: 500,
      progressPercent: 84,
      loginStreakDays: 5,
      scanStreakDays: 7,
      totalReceiptsScanned: 1,
      dailyGoalCompletedToday: true,
    },
    badges: [
      { id: "badge-1", unlockedAt: "2026-03-01T00:00:00Z" },
      { id: "badge-2", unlockedAt: "2026-03-02T00:00:00Z" },
    ],
  },
  promptToInstall: vi.fn(),
}));

vi.mock("@/contexts/GamificationContext", () => ({
  useGamification: () => ({ snapshot: mocks.mockSnapshot, isLoading: false }),
}));

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({
    dismissInstallPrompt: mocks.dismissInstallPrompt,
    isInstallPromptAvailable: true,
    promptToInstall: mocks.promptToInstall,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useDashboardTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "rewards.title": "Rewards progress",
        "rewards.description": "Track your level, streaks, and bonus state.",
        "rewards.actions.leaderboard": "Leaderboard",
        "rewards.actions.missions": "Missions",
        "rewards.xpLabel": "Experience",
        "rewards.levelBadge": `Level ${options?.level ?? 1}`,
        "rewards.dailyGoalComplete": "Bonus claimed",
        "rewards.dailyGoalReady": "Bonus ready",
        "rewards.progressLabel": "Progress to next level",
        "rewards.progressHint": "Keep scanning to unlock more rewards.",
        "rewards.loginStreak": "Login streak",
        "rewards.scanStreak": "Scan streak",
        "rewards.badgesUnlocked": "Badges unlocked",
        "rewards.footer": "Leaderboard and missions pages are now reachable from your rewards surface.",
        "rewards.install.title": "Install MataResit",
        "rewards.install.description": "Install prompt description.",
        "rewards.install.installCta": "Install app",
        "rewards.install.dismissCta": "Not now",
      };

      return map[key] ?? key;
    },
  }),
}));

function renderCard() {
  return render(
    <MemoryRouter>
      <GamificationProgressCard />
    </MemoryRouter>,
  );
}

describe("GamificationProgressCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard rewards summary and route affordances", async () => {
    renderCard();

    expect(await screen.findByText("Rewards progress")).toBeInTheDocument();
    expect(await screen.findByText("Level 3")).toBeInTheDocument();
    expect(screen.getByText("920")).toBeInTheDocument();
    expect(screen.getByText("Bonus claimed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute("href", "/missions");
    expect(screen.getByTestId("dashboard-install-cta")).toBeInTheDocument();
  });
});