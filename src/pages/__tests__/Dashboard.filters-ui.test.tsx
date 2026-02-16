import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";

import Dashboard from "@/pages/Dashboard";
import { Receipt } from "@/types/receipt";

const mocks = vi.hoisted(() => ({
  fetchReceipts: vi.fn(),
  deleteReceipt: vi.fn(),
  fetchUserCategories: vi.fn(),
  fetchCategoriesForDisplay: vi.fn(),
  bulkAssignCategory: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ currentTeam: null }),
}));

vi.mock("@/contexts/StripeContext", () => ({
  useStripe: () => ({ subscriptionData: null }),
}));

const translationMap: Record<string, string> = {
  "filters.title": "Filters",
  "filters.search": "Search receipts...",
  "filters.dateRange": "Date Range",
  "filters.all": "All Receipts",
  "filters.unreviewed": "Unreviewed",
  "filters.reviewed": "Reviewed",
  "filters.currency": "Currency",
  "filters.category": "Category",
  "filters.clear": "Clear Filters",
  "sort.title": "Sort By",
  "sort.newest": "Newest",
  "sort.oldest": "Oldest",
  "sort.highest": "Highest",
  "sort.lowest": "Lowest",
  "actions.select": "Select",
  "actions.assignCategory": "Assign category...",
  "actions.assign": "Assign",
  "actions.delete": "Delete",
  "empty.title": "No receipts found",
  "empty.description": "Upload your first receipt to get started",
  "upload.button": "Upload Receipt",
  "filtersSheet.subtitle": "Refine what you see with focused filters.",
  "filtersSheet.activeCount": "active",
  "filtersSheet.all": "All",
  "filtersSheet.allDates": "All dates",
  "filtersSheet.fromPrefix": "From",
  "filtersSheet.done": "Done",
  "filtersSheet.uncategorized": "Uncategorized",
  "filtersSheet.categorySearchPlaceholder": "Search categories...",
  "filtersSheet.noCategories": "No categories match your search.",
  "filtersSheet.datePresets.today": "Today",
  "filtersSheet.datePresets.last7": "Last 7 days",
  "filtersSheet.datePresets.month": "This month",
  "filtersSheet.datePresets.quarter": "This quarter",
  "filtersSheet.datePresets.year": "This year",
  "filtersSheet.groups.team": "Team",
  "filtersSheet.groups.personal": "Personal",
  "filtersSheet.aria.sortNewest": "Sort by newest",
  "filtersSheet.aria.sortOldest": "Sort by oldest",
  "filtersSheet.aria.sortHighest": "Sort by highest amount",
  "filtersSheet.aria.sortLowest": "Sort by lowest amount",
  "filtersSheet.aria.currencyAll": "Show all currencies",
  "filtersSheet.aria.categorySearch": "Search categories",
  "filtersSheet.aria.categoryAll": "Show all categories",
  "filtersSheet.aria.categoryUncategorized": "Show uncategorized receipts",
  "buttons.cancel": "Cancel",
};

const t = (key: string) => translationMap[key] ?? key;

vi.mock("@/contexts/LanguageContext", () => ({
  useDashboardTranslation: () => ({ t }),
  useCommonTranslation: () => ({ t }),
  useReceiptsTranslation: () => ({ t }),
}));

vi.mock("@/services/receiptService", () => ({
  fetchReceipts: mocks.fetchReceipts,
  deleteReceipt: mocks.deleteReceipt,
}));

vi.mock("@/services/categoryService", () => ({
  fetchUserCategories: mocks.fetchUserCategories,
  fetchCategoriesForDisplay: mocks.fetchCategoriesForDisplay,
  bulkAssignCategory: mocks.bulkAssignCategory,
}));

vi.mock("@/components/export/ExportDropdown", () => ({
  ExportDropdown: () => <button type="button">Export</button>,
}));

vi.mock("@/components/modals/BatchUploadModal", () => ({
  BatchUploadModal: () => null,
}));

vi.mock("@/components/ReceiptCard", () => ({
  default: ({ merchant }: { merchant: string }) => <div>{merchant}</div>,
}));

const mockReceipts: Receipt[] = [
  {
    id: "receipt-1",
    merchant: "99 SPEED MART SDN. BHD.",
    date: "2026-02-01",
    total: 32.1,
    currency: "MYR",
    status: "reviewed",
    payment_method: "card",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    custom_category_id: "cat-team",
    processing_status: "complete",
    image_url: "/placeholder.svg",
    confidence_scores: { merchant: 0.96 },
  },
  {
    id: "receipt-2",
    merchant: "OFFICE DEPOT",
    date: "2026-01-15",
    total: 128.5,
    currency: "USD",
    status: "unreviewed",
    payment_method: "cash",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    custom_category_id: null,
    processing_status: "complete",
    image_url: "/placeholder.svg",
    confidence_scores: { merchant: 0.89 },
  },
];

const mockCategories = [
  {
    id: "cat-team",
    user_id: "user-1",
    name: "Groceries",
    color: "#22c55e",
    icon: "tag",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    receipt_count: 12,
    team_id: "team-1",
    is_team_category: true,
  },
];

function LocationSearchObserver() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderDashboard(initialEntry = "/dashboard?view=table") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Dashboard />
        <LocationSearchObserver />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard filters UI", () => {
  beforeEach(() => {
    mocks.fetchReceipts.mockResolvedValue(mockReceipts);
    mocks.deleteReceipt.mockResolvedValue(true);
    mocks.fetchUserCategories.mockResolvedValue(mockCategories);
    mocks.fetchCategoriesForDisplay.mockResolvedValue(mockCategories);
    mocks.bulkAssignCategory.mockResolvedValue(0);
  });

  it("opens filters sheet from toolbar button", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByTestId("dashboard-filters-trigger"));

    expect(await screen.findByText("Refine what you see with focused filters.")).toBeInTheDocument();
  });

  it("updates active count when a sort filter is applied then removed", async () => {
    const user = userEvent.setup();
    renderDashboard();

    expect(screen.queryByTestId("dashboard-filters-active-count")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("dashboard-filters-trigger"));
    await user.click(await screen.findByRole("button", { name: "Sort by highest amount" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByTestId("dashboard-filters-active-count")).toHaveTextContent("1");

    await user.click(screen.getByTestId("dashboard-chip-sort"));

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-filters-active-count")).not.toBeInTheDocument();
    });
  });

  it("removes only the selected chip filter", async () => {
    const user = userEvent.setup();
    renderDashboard("/dashboard?view=table&sort=highest&currency=MYR&category=cat-team");

    expect(await screen.findByTestId("dashboard-chip-sort")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-chip-currency")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-chip-category")).toBeInTheDocument();

    await user.click(screen.getByTestId("dashboard-chip-currency"));

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-chip-currency")).not.toBeInTheDocument();
      expect(screen.getByTestId("dashboard-chip-sort")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-chip-category")).toBeInTheDocument();
    });
  });

  it("updates from and to URL params when choosing a date preset", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByTestId("dashboard-filters-trigger"));
    await user.click(await screen.findByText("Today"));

    await waitFor(() => {
      const search = screen.getByTestId("location-search").textContent ?? "";
      expect(search).toContain("from=");
      expect(search).toContain("to=");
    });
  });

  it("clears filter controls without resetting search query or tab", async () => {
    const user = userEvent.setup();
    renderDashboard("/dashboard?view=table&q=speed&tab=reviewed&currency=MYR");

    expect(await screen.findByDisplayValue("speed")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reviewed" })).toHaveAttribute("data-state", "active");

    await user.click(screen.getByTestId("dashboard-clear-filter-controls"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("speed")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Reviewed" })).toHaveAttribute("data-state", "active");
      expect(screen.queryByTestId("dashboard-filters-active-count")).not.toBeInTheDocument();
    });
  });

  it("full clear action in empty state resets search, tab, and filters", async () => {
    const user = userEvent.setup();
    renderDashboard("/dashboard?view=table&q=zzzzzz&tab=reviewed&currency=MYR");

    const clearButton = await screen.findByTestId("dashboard-empty-clear-all");
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search receipts...")).toHaveValue("");
      expect(screen.getByRole("tab", { name: "All Receipts" })).toHaveAttribute("data-state", "active");
      expect(screen.queryByTestId("dashboard-filters-active-count")).not.toBeInTheDocument();
    });
  });
});
