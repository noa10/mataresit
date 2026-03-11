import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LeaderboardPage from "@/pages/LeaderboardPage";

const mocks = vi.hoisted(() => ({
  useGamification: vi.fn(),
  language: "en",
}));

vi.mock("@/contexts/GamificationContext", () => ({
  useGamification: mocks.useGamification,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useNavigationTranslation: () => ({
    language: mocks.language,
    t: (key: string, options?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "mainMenu.leaderboard": "Leaderboard",
        "gamification.backToDashboard": "Back to dashboard",
        "gamification.leaderboardDescription": "Compare your current rewards progress across weekly XP, monthly receipts, and deductible totals.",
        "gamification.leaderboard.privacyBadge": "Privacy-aware rankings",
        "gamification.leaderboard.settingsCta": "Manage rewards privacy",
        "gamification.leaderboard.emptyTitle": "No leaderboard activity yet",
        "gamification.leaderboard.emptyDescription": "Opted-in members will appear here after they start earning progress for this metric.",
        "gamification.leaderboard.privacyGateTitle": "Join the leaderboard when you're ready",
        "gamification.leaderboard.privacyGateDescription": "Turn on leaderboard participation from your rewards settings to compare weekly XP, monthly receipts, and deductible totals.",
        "gamification.leaderboard.privacyGateStatus": "Your rewards profile is currently hidden from the leaderboard.",
        "gamification.leaderboard.privacyGateAction": "Open rewards settings",
        "gamification.leaderboard.currentUserTitle": "Your position",
        "gamification.leaderboard.currentUserTopTen": "You're currently inside the top 10.",
        "gamification.leaderboard.currentUserUnranked": "You're not ranked for this view yet.",
        "gamification.leaderboard.scopeGlobal": "Global",
        "gamification.leaderboard.scopeMalaysia": "Malaysia",
        "gamification.leaderboard.topThreeTitle": "Top performers",
        "gamification.leaderboard.topThreeDescription": "The leading opted-in members for this view.",
        "gamification.leaderboard.tableTitle": "Top 100 leaderboard",
        "gamification.leaderboard.tableDescription": "Only opted-in members appear here. Anonymous mode hides personal names.",
        "gamification.leaderboard.rankHeader": "Rank",
        "gamification.leaderboard.memberHeader": "Member",
        "gamification.leaderboard.metricHeader": "Metric",
        "gamification.leaderboard.badgeYou": "You",
        "gamification.leaderboard.badgeAnonymous": "Anonymous",
        "gamification.leaderboard.units.weeklyXp": `${options?.count ?? 0} XP`,
        "gamification.leaderboard.units.monthlyReceipts": `${options?.count ?? 0} receipts`,
        "gamification.leaderboard.metrics.weekly_xp.label": "Weekly XP",
        "gamification.leaderboard.metrics.weekly_xp.description": "XP earned during the last 7 days.",
        "gamification.leaderboard.metrics.monthly_receipts.label": "Monthly receipts",
        "gamification.leaderboard.metrics.monthly_receipts.description": "Completed receipts counted in the current month.",
        "gamification.leaderboard.metrics.deductible_total.label": "Deductible total",
        "gamification.leaderboard.metrics.deductible_total.description": "Current deductible amount tracked in your rewards profile.",
        "ms.mainMenu.leaderboard": "Papan pendahulu",
        "ms.gamification.backToDashboard": "Kembali ke papan pemuka",
        "ms.gamification.leaderboardDescription": "Bandingkan kemajuan ganjaran anda merentas XP mingguan, resit bulanan, dan jumlah boleh ditolak.",
        "ms.gamification.leaderboard.privacyBadge": "Kedudukan peka privasi",
        "ms.gamification.leaderboard.settingsCta": "Urus privasi ganjaran",
        "ms.gamification.leaderboard.emptyTitle": "Belum ada aktiviti papan pendahulu",
        "ms.gamification.leaderboard.emptyDescription": "Ahli yang memilih untuk menyertai akan muncul di sini selepas mula mengumpul kemajuan untuk metrik ini.",
        "ms.gamification.leaderboard.privacyGateTitle": "Sertai papan pendahulu apabila anda bersedia",
        "ms.gamification.leaderboard.privacyGateDescription": "Hidupkan penyertaan papan pendahulu dalam tetapan ganjaran anda untuk membandingkan XP mingguan, resit bulanan, dan jumlah boleh ditolak.",
        "ms.gamification.leaderboard.privacyGateStatus": "Profil ganjaran anda kini disembunyikan daripada papan pendahulu.",
        "ms.gamification.leaderboard.privacyGateAction": "Buka tetapan ganjaran",
        "ms.gamification.leaderboard.currentUserTitle": "Kedudukan anda",
        "ms.gamification.leaderboard.currentUserTopTen": "Anda kini berada dalam 10 teratas.",
        "ms.gamification.leaderboard.currentUserUnranked": "Anda belum berada dalam ranking untuk paparan ini.",
        "ms.gamification.leaderboard.scopeGlobal": "Global",
        "ms.gamification.leaderboard.scopeMalaysia": "Malaysia",
        "ms.gamification.leaderboard.topThreeTitle": "Peneraju teratas",
        "ms.gamification.leaderboard.topThreeDescription": "Ahli terpilih yang mendahului bagi paparan ini.",
        "ms.gamification.leaderboard.tableTitle": "Papan pendahulu 100 teratas",
        "ms.gamification.leaderboard.tableDescription": "Hanya ahli yang memilih untuk menyertai dipaparkan di sini. Mod anonim menyembunyikan nama peribadi.",
        "ms.gamification.leaderboard.rankHeader": "Kedudukan",
        "ms.gamification.leaderboard.memberHeader": "Ahli",
        "ms.gamification.leaderboard.metricHeader": "Metrik",
        "ms.gamification.leaderboard.badgeYou": "Anda",
        "ms.gamification.leaderboard.badgeAnonymous": "Anonim",
        "ms.gamification.leaderboard.units.weeklyXp": `${options?.count ?? 0} XP`,
        "ms.gamification.leaderboard.units.monthlyReceipts": `${options?.count ?? 0} resit`,
        "ms.gamification.leaderboard.metrics.weekly_xp.label": "XP mingguan",
        "ms.gamification.leaderboard.metrics.weekly_xp.description": "XP yang diperoleh dalam 7 hari terakhir.",
        "ms.gamification.leaderboard.metrics.monthly_receipts.label": "Resit bulanan",
        "ms.gamification.leaderboard.metrics.monthly_receipts.description": "Resit lengkap yang dikira dalam bulan semasa.",
        "ms.gamification.leaderboard.metrics.deductible_total.label": "Jumlah boleh ditolak",
        "ms.gamification.leaderboard.metrics.deductible_total.description": "Jumlah boleh ditolak semasa yang dijejaki dalam profil ganjaran anda.",
      };

      const resolvedKey = mocks.language === "ms" ? `ms.${key}` : key;

      if (key === "gamification.leaderboard.currentUserRank") {
        return mocks.language === "ms"
          ? `Anda berada di #${options?.rank ?? "?"}`
          : `You are #${options?.rank ?? "?"}`;
      }

      if (key === "gamification.leaderboard.currentUserGap") {
        return mocks.language === "ms"
          ? `${options?.amount ?? "0"} untuk memasuki 10 teratas`
          : `${options?.amount ?? "0"} to enter the top 10`;
      }

      return map[resolvedKey] ?? key;
    },
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.language = "en";
  });

  it("shows the privacy gate when leaderboard participation is disabled", async () => {
    const getLeaderboard = vi.fn();

    mocks.useGamification.mockReturnValue({
      snapshot: { profile: { leaderboardOptIn: false } },
      isLoading: false,
      getLeaderboard,
    });

    renderPage();

    expect(await screen.findByText("Join the leaderboard when you're ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open rewards settings" })).toHaveAttribute("href", "/profile?tab=rewards");
    await waitFor(() => {
      expect(getLeaderboard).not.toHaveBeenCalled();
    });
  });

  it("loads leaderboard rows and supports switching to the Malaysia view", async () => {
    const getLeaderboard = vi.fn().mockImplementation(async (metric: string, options?: { countryCode?: string | null; limit?: number }) => {
      if (metric === "weekly_xp" && options?.countryCode === "MY") {
        return [{
          rank: 1,
          userId: "user-2",
          displayName: "Anonymous #1",
          isCurrentUser: false,
          isAnonymous: true,
          metric,
          value: 980,
          gapToTopTen: 0,
        }];
      }

      return [{
        rank: 12,
        userId: "user-1",
        displayName: "You",
        isCurrentUser: true,
        isAnonymous: false,
        metric,
        value: 845,
        gapToTopTen: 35,
      }, {
        rank: 1,
        userId: "user-9",
        displayName: "Top User",
        isCurrentUser: false,
        isAnonymous: false,
        metric,
        value: 1450,
        gapToTopTen: 0,
      }];
    });

    mocks.useGamification.mockReturnValue({
      snapshot: { profile: { leaderboardOptIn: true } },
      isLoading: false,
      getLeaderboard,
    });

    renderPage();

    expect(await screen.findByText("Your position")).toBeInTheDocument();
    expect(screen.getByText("You are #12")).toBeInTheDocument();
    expect(screen.getByText("35 XP to enter the top 10")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /#12 You You 845 XP/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Malaysia" }));

    await waitFor(() => {
      expect(getLeaderboard).toHaveBeenCalledWith("weekly_xp", { countryCode: null, limit: 100 });
      expect(getLeaderboard).toHaveBeenCalledWith("weekly_xp", { countryCode: "MY", limit: 100 });
    });

    expect((await screen.findAllByText("Anonymous #1")).length).toBeGreaterThanOrEqual(2);
  });

  it("renders translated leaderboard units for Malay monthly receipt views", async () => {
    mocks.language = "ms";

    const getLeaderboard = vi.fn().mockResolvedValue([
      {
        rank: 12,
        userId: "user-1",
        displayName: "Anda",
        isCurrentUser: true,
        isAnonymous: false,
        metric: "monthly_receipts",
        value: 12,
        gapToTopTen: 3,
      },
      {
        rank: 1,
        userId: "user-2",
        displayName: "Pengguna Teratas",
        isCurrentUser: false,
        isAnonymous: false,
        metric: "monthly_receipts",
        value: 25,
        gapToTopTen: 0,
      },
    ]);

    mocks.useGamification.mockReturnValue({
      snapshot: { profile: { leaderboardOptIn: true } },
      isLoading: false,
      getLeaderboard,
    });

    renderPage();

    await userEvent.click(await screen.findByRole("tab", { name: "Resit bulanan" }));

    expect(await screen.findByText("Kedudukan anda")).toBeInTheDocument();
    expect(screen.getByText("Anda berada di #12")).toBeInTheDocument();
    expect(screen.getByText("3 resit untuk memasuki 10 teratas")).toBeInTheDocument();
    expect(screen.getAllByText("12 resit").length).toBeGreaterThanOrEqual(2);
  });
});