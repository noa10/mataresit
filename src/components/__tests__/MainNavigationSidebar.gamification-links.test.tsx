import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MainNavigationSidebar } from "@/components/MainNavigationSidebar";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "user@example.com" }, isAdmin: false }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useNavigationTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "sidebar.navigation": "Navigation",
        "mainMenu.dashboard": "Dashboard",
        "mainMenu.leaderboard": "Leaderboard",
        "mainMenu.missions": "Missions",
        "mainMenu.search": "Search",
        "mainMenu.analysis": "Analysis",
        "mainMenu.teams": "Teams",
        "mainMenu.claims": "Claims",
        "mainMenu.pricing": "Pricing",
        "mainMenu.apiReference": "API Reference",
        "mainMenu.settings": "Settings",
      };

      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useSidebarAccessibility", () => ({
  useSidebarAccessibility: () => ({ sidebarProps: {} }),
}));

vi.mock("@/components/team/TeamSelector", () => ({
  TeamSelector: () => <div>Team selector</div>,
}));

describe("MainNavigationSidebar rewards links", () => {
  it("shows leaderboard and missions links in the app shell", () => {
    window.innerWidth = 1440;

    render(
      <MemoryRouter>
        <MainNavigationSidebar isOpen onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute("href", "/missions");
  });
});