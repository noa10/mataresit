import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MissionsPage from "@/pages/MissionsPage";

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
    t: (key: string, options?: { count?: string }) => {
      const translations: Record<string, Record<string, string>> = {
        en: {
        "mainMenu.missions": "Missions",
        "gamification.backToDashboard": "Back to dashboard",
        "gamification.missionsDescription": "Track onboarding, weekly, and community missions tied directly to your rewards progress.",
        "gamification.missions.liveBadge": "Live mission progress",
        "gamification.missions.emptyTitle": "No active missions right now",
        "gamification.missions.emptyDescription": "New missions will appear here as the rewards calendar rotates.",
        "gamification.missions.personalProgress": "Your progress",
        "gamification.missions.communityProgress": "Community progress",
        "gamification.missions.windowLabel": "Active window",
        "gamification.missions.windowLifetime": "Lifetime mission",
        "gamification.missions.rewardLabel": "Reward preview",
        "gamification.missions.communityContributionTitle": "Your contribution",
        "gamification.missions.communityContributionBody": "You've contributed",
        "gamification.missions.units.scanStreakDays": "{{count}} days",
        "gamification.missions.tabs.one_time": "One-time",
        "gamification.missions.tabs.weekly": "Weekly",
        "gamification.missions.tabs.community": "Community",
        "gamification.missions.status.inProgress": "In progress",
        "gamification.missions.status.complete": "Completed",
        "gamification.missions.status.community": "Community goal",
        "gamification.missions.summary.active": "Active missions",
        "gamification.missions.summary.completed": "Completed",
        "gamification.missions.summary.rewards": "Available XP",
        },
        ms: {
          "mainMenu.missions": "Misi",
          "gamification.backToDashboard": "Kembali ke papan pemuka",
          "gamification.missionsDescription": "Jejaki misi onboarding, mingguan, dan komuniti yang terhubung terus dengan kemajuan ganjaran anda.",
          "gamification.missions.liveBadge": "Kemajuan misi langsung",
          "gamification.missions.emptyTitle": "Tiada misi aktif sekarang",
          "gamification.missions.emptyDescription": "Misi baharu akan muncul di sini apabila kalendar ganjaran berubah.",
          "gamification.missions.personalProgress": "Kemajuan anda",
          "gamification.missions.communityProgress": "Kemajuan komuniti",
          "gamification.missions.windowLabel": "Tempoh aktif",
          "gamification.missions.windowLifetime": "Misi sepanjang masa",
          "gamification.missions.rewardLabel": "Pratonton ganjaran",
          "gamification.missions.communityContributionTitle": "Sumbangan anda",
          "gamification.missions.communityContributionBody": "Anda telah menyumbang",
          "gamification.missions.units.scanStreakDays": "{{count}} hari",
          "gamification.missions.tabs.one_time": "Sekali sahaja",
          "gamification.missions.tabs.weekly": "Mingguan",
          "gamification.missions.tabs.community": "Komuniti",
          "gamification.missions.status.inProgress": "Sedang berjalan",
          "gamification.missions.status.complete": "Selesai",
          "gamification.missions.status.community": "Matlamat komuniti",
          "gamification.missions.summary.active": "Misi aktif",
          "gamification.missions.summary.completed": "Selesai",
          "gamification.missions.summary.rewards": "XP tersedia",
        },
      };

      const template = translations[mocks.language]?.[key] ?? key;

      return template.replace("{{count}}", String(options?.count ?? ""));
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
        <MissionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MissionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.language = "en";
  });

  it("renders mission summaries and supports switching tabs", async () => {
    const missions = [{
      id: "mission-progress-1",
      missionId: "mission-1",
      currentValue: 1,
      targetValue: 3,
      completedAt: null,
      claimedAt: null,
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
      communityCurrentValue: null,
      communityTargetValue: null,
      communityCompletedAt: null,
    }, {
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
        metadata: {},
      },
      communityCurrentValue: null,
      communityTargetValue: null,
      communityCompletedAt: null,
    }, {
      id: "mission-progress-3",
      missionId: "mission-3",
      currentValue: 420,
      targetValue: 2500,
      completedAt: null,
      claimedAt: null,
      mission: {
        id: "mission-3",
        code: "monthly_community_xp_push",
        title: "Monthly community XP push",
        description: "As a community, earn 2,500 XP during the current month.",
        missionType: "community",
        objectiveType: "xp_earned",
        targetValue: 2500,
        rewardXp: 120,
        startsAt: "2026-03-01T00:00:00Z",
        endsAt: "2026-03-31T23:59:59Z",
        metadata: {},
      },
      communityCurrentValue: 1600,
      communityTargetValue: 2500,
      communityCompletedAt: null,
    }];

    const getMissions = vi.fn().mockResolvedValue(missions);

    mocks.useGamification.mockReturnValue({
      snapshot: { profile: { userId: "user-1" }, activeMissions: missions },
      isLoading: false,
      getMissions,
    });

    renderPage();

    expect(await screen.findByText("First receipt complete")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("+240 XP")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Weekly" }));
    expect(await screen.findByText("Weekly tax focus")).toBeInTheDocument();
    expect(screen.getByText(/RM.*245.*RM.*250/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Community" }));
    expect(await screen.findByText("Monthly community XP push")).toBeInTheDocument();
    expect(screen.getByText(/You've contributed: 420 XP/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getMissions).toHaveBeenCalledTimes(1);
    });
  });

  it("uses Malay mission units and date formatting when the active language is Malay", async () => {
    mocks.language = "ms";

    const missions = [{
      id: "mission-progress-ms-1",
      missionId: "mission-ms-1",
      currentValue: 7,
      targetValue: 10,
      completedAt: null,
      claimedAt: null,
      mission: {
        id: "mission-ms-1",
        code: "seven_day_scan_streak",
        title: "Rentetan imbasan tujuh hari",
        description: "Capai rentetan imbasan 7 hari.",
        missionType: "one_time",
        objectiveType: "scan_streak_days",
        targetValue: 10,
        rewardXp: 90,
        startsAt: "2026-03-09T00:00:00Z",
        endsAt: "2026-03-15T23:59:59Z",
        metadata: {},
      },
      communityCurrentValue: null,
      communityTargetValue: null,
      communityCompletedAt: null,
    }];

    mocks.useGamification.mockReturnValue({
      snapshot: { profile: { userId: "user-ms" }, activeMissions: missions },
      isLoading: false,
      getMissions: vi.fn().mockResolvedValue(missions),
    });

    renderPage();

    expect(await screen.findByText("Rentetan imbasan tujuh hari")).toBeInTheDocument();
    expect(screen.getByText("7 hari / 10 hari")).toBeInTheDocument();

    const expectedWindow = `${new Intl.DateTimeFormat("ms-MY", { month: "short", day: "numeric" }).format(new Date("2026-03-09T00:00:00Z"))} – ${new Intl.DateTimeFormat("ms-MY", { month: "short", day: "numeric" }).format(new Date("2026-03-15T23:59:59Z"))}`;
    expect(screen.getByText(expectedWindow)).toBeInTheDocument();
  });
});