import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import AdminLayout from "@/components/admin/AdminLayout";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  isMobile: false,
}));

const translationMap: Record<string, string> = {
  title: "Admin Panel",
  "navigation.dashboard": "Dashboard",
  "navigation.users": "Users",
  "navigation.receipts": "Receipts",
  "navigation.blog": "Blog",
  "navigation.analytics": "Analytics",
  "navigation.settings": "Settings",
  "actions.signedInAs": "Signed in as",
  "actions.signOut": "Sign out",
  "actions.exitAdmin": "Exit admin",
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: mocks.signOut,
    user: {
      email: "admin@example.com",
    },
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useAdminTranslation: () => ({
    t: (key: string) => translationMap[key] ?? key,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

function LocationObserver() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

function renderAdminLayout(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/admin/*"
          element={(
            <AdminLayout>
              <LocationObserver />
            </AdminLayout>
          )}
        />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobile = false;
  });

  it("highlights the active admin section on desktop", () => {
    renderAdminLayout("/admin/users");

    const usersLink = screen.getByRole("link", { name: "Users" });

    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Admin content" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to admin content" })).toBeInTheDocument();
    expect(usersLink).toHaveAttribute("aria-current", "page");
    expect(usersLink).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Manage user access, roles, and accounts.")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("uses a dashboard-style desktop shell with a sibling sidebar column", () => {
    renderAdminLayout("/admin/users");

    const main = screen.getByRole("main", { name: "Admin content" });
    const shell = main.parentElement;
    const scrollRegion = main.lastElementChild;
    const desktopSidebar = main.previousElementSibling as HTMLElement | null;

    expect(shell).toHaveClass("flex");
    expect(shell).toHaveClass("md:h-screen");
    expect(shell).toHaveClass("md:overflow-hidden");
    expect(desktopSidebar?.tagName).toBe("ASIDE");
    expect(desktopSidebar).toHaveClass("w-64");
    expect(desktopSidebar).toHaveClass("shrink-0");
    expect(main).toHaveClass("min-w-0");
    expect(main).toHaveClass("overflow-hidden");
    expect(scrollRegion).toBeInstanceOf(HTMLDivElement);
    expect(scrollRegion).toHaveClass("min-w-0");
    expect(scrollRegion).toHaveClass("overflow-y-auto");
    expect(scrollRegion).toHaveClass("overflow-x-hidden");
  });

  it("moves focus to the main admin content from the skip link", async () => {
    const user = userEvent.setup();

    renderAdminLayout("/admin/users");

    await user.click(screen.getByRole("link", { name: "Skip to admin content" }));

    expect(screen.getByRole("main", { name: "Admin content" })).toHaveFocus();
  });

  it("opens mobile navigation with the sidebar sheet pattern and closes after navigation", async () => {
    mocks.isMobile = true;

    const user = userEvent.setup();

    renderAdminLayout("/admin");

    const openMenuButton = screen.getByRole("button", { name: "Open admin navigation menu" });

    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(openMenuButton).toHaveAttribute("aria-controls", "admin-navigation");
    expect(openMenuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(openMenuButton);

    const navigationDialog = await screen.findByRole("dialog", {
      name: "Admin Panel navigation menu",
    });
    const closeMenuButton = within(navigationDialog).getByRole("button", {
      name: "Close admin navigation menu",
    });
    const usersLink = within(navigationDialog).getByRole("link", { name: "Users" });

    expect(closeMenuButton).toHaveAttribute("aria-controls", "admin-navigation");
    expect(usersLink).toBeInTheDocument();

    await user.click(usersLink);

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/users");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Admin Panel navigation menu" })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("main", { name: "Admin content" })).toHaveFocus();
    });
  });
});