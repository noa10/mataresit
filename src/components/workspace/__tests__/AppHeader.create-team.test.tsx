import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/workspace/AppHeader";

const mocks = vi.hoisted(() => ({
  createTeam: vi.fn(),
  switchTeam: vi.fn(),
}));

vi.mock("@/components/notifications/NotificationCenter", () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "owner@example.com",
      user_metadata: { full_name: "Workspace Owner" },
    },
    signOut: vi.fn(),
    isAdmin: false,
  }),
}));

vi.mock("@/contexts/BackgroundUploadContext", () => ({
  useBackgroundUpload: () => ({ openModal: vi.fn() }),
}));

vi.mock("@/contexts/LanguageContext", () => {
  const translations: Record<string, string> = {
    "selector.switchWorkspace": "Switch workspace",
    "selector.personalWorkspace": "Personal workspace",
    "selector.teams": "Teams",
    "sidebar.personalWorkspace": "Personal workspace",
    "sidebar.backToSite": "Back to site",
    "userMenu.profile": "Profile",
    "userMenu.settings": "Settings",
    "userMenu.help": "Help",
    "userMenu.logout": "Sign out",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "workspace.overview.upload": "Upload",
    "actions.createTeam": "Create team",
    "create.title": "Create New Team",
    "create.description": "Create a new team to collaborate with others.",
    "create.fields.name": "Team Name",
    "create.fields.description": "Description (Optional)",
    "create.placeholders.name": "Enter team name",
    "create.placeholders.description": "Describe your team's purpose",
    "create.actions.cancel": "Cancel",
    "create.actions.create": "Create Team",
    "create.actions.creating": "Creating...",
  };

  const makeTranslation = () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      translations[key] ?? options?.defaultValue ?? key,
  });

  return {
    useCommonTranslation: makeTranslation,
    useDashboardTranslation: makeTranslation,
    useLanguage: () => ({ language: "en", changeLanguage: vi.fn() }),
    useNavigationTranslation: makeTranslation,
    useTeamTranslation: makeTranslation,
  };
});

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({
    currentTeam: null,
    currentTeamRole: null,
    userTeams: [],
    switchTeam: mocks.switchTeam,
    createTeam: mocks.createTeam,
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isDarkMode: false, toggleMode: vi.fn() }),
}));

vi.mock("@/services/avatarService", () => ({
  getAvatarUrl: () => null,
  getUserInitials: () => "WO",
}));

describe("AppHeader create team", () => {
  beforeEach(() => {
    mocks.createTeam.mockReset();
    mocks.switchTeam.mockReset();
    mocks.createTeam.mockResolvedValue("team-1");
    mocks.switchTeam.mockResolvedValue(undefined);
  });

  it("creates a team from the workspace menu and switches into it", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: "Switch workspace" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Create team" })
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Create New Team" })
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Team Name"), "Kedai Team");
    await user.type(
      within(dialog).getByLabelText("Description (Optional)"),
      "Shared household receipts"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create Team" })
    );

    await waitFor(() => {
      expect(mocks.createTeam).toHaveBeenCalledWith(
        "Kedai Team",
        "Shared household receipts"
      );
    });
    expect(mocks.switchTeam).toHaveBeenCalledWith("team-1");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
