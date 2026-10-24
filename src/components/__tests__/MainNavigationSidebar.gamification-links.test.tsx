import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MainNavigationSidebar } from "@/components/MainNavigationSidebar";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "user@example.com" }, isAdmin: false }),
}));

vi.mock("@/hooks/useDashboardSummary", () => ({
  useWorkspaceReceiptCounts: () => ({ data: { all: 12, review: 3 } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useNavigationTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "sidebar.navigation": "Navigation",
        "sidebar.groups.workspace": "Workspace",
        "sidebar.groups.tools": "Tools",
        "sidebar.groups.rewards": "Rewards",
        "sidebar.groups.account": "Account",
        "sidebar.backToSite": "Back to site",
        "mainMenu.overview": "Overview",
        "mainMenu.receipts": "Receipts",
        "mainMenu.review": "Needs review",
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
        "brand.name": "Mataresit",
        "brand.tagline": "Smart Receipt Management",
      };

      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useSidebarAccessibility", () => ({
  useSidebarAccessibility: () => ({ sidebarProps: {} }),
}));

vi.mock("@/services/avatarService", () => ({
  getAvatarUrl: () => null,
  getUserInitials: () => "U",
}));

describe("MainNavigationSidebar rewards links", () => {
  it("shows leaderboard and missions links in the app shell", () => {
    window.innerWidth = 1440;

    render(
      <MemoryRouter>
        <MainNavigationSidebar isOpen onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "href",
      "/leaderboard",
    );
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute(
      "href",
      "/missions",
    );
  });

  it("renders the workspace routes with live review count", () => {
    window.innerWidth = 1440;

    render(
      <MemoryRouter>
        <MainNavigationSidebar isOpen onToggle={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Overview/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /Receipts/ })).toHaveAttribute(
      "href",
      "/receipts",
    );

    const reviewLink = screen.getByRole("link", { name: /Needs review/ });
    expect(reviewLink).toHaveAttribute("href", "/review");
    expect(reviewLink).toHaveTextContent("3");
  });
});
