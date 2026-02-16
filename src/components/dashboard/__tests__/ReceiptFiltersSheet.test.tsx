import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReceiptFiltersSheet } from "@/components/dashboard/ReceiptFiltersSheet";
import { CustomCategory } from "@/types/receipt";

const tMap: Record<string, string> = {
  "filters.title": "Filters",
  "filters.dateRange": "Date Range",
  "filters.currency": "Currency",
  "filters.category": "Category",
  "filters.clear": "Clear Filters",
  "sort.title": "Sort By",
  "sort.newest": "Newest",
  "sort.oldest": "Oldest",
  "sort.highest": "Highest",
  "sort.lowest": "Lowest",
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
};

const tDash = (key: string) => tMap[key] ?? key;

const categories: CustomCategory[] = [
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
  {
    id: "cat-personal",
    user_id: "user-1",
    name: "Office Supplies",
    color: "#3b82f6",
    icon: "tag",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    receipt_count: 4,
    team_id: null,
    is_team_category: false,
  },
];

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  sortOrder: "newest" as const,
  onSortChange: vi.fn(),
  filterByCurrency: null,
  onCurrencyChange: vi.fn(),
  filterByCategory: null,
  onCategoryChange: vi.fn(),
  currencies: ["MYR", "USD"],
  categories,
  dateRange: undefined,
  onDateRangeChange: vi.fn(),
  onResetFilters: vi.fn(),
  activeFilterCount: 2,
  tDash,
};

describe("ReceiptFiltersSheet", () => {
  it("opens and renders core sections", async () => {
    render(<ReceiptFiltersSheet {...baseProps} />);

    expect(await screen.findByText("Refine what you see with focused filters.")).toBeInTheDocument();
    expect(screen.getByText("Sort By")).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("calls onSortChange when selecting a new sort option", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    render(<ReceiptFiltersSheet {...baseProps} onSortChange={onSortChange} />);

    await user.click(screen.getByRole("button", { name: "Sort by highest amount" }));

    expect(onSortChange).toHaveBeenCalledWith("highest");
  });

  it("calls onCurrencyChange with null when selecting All currency", async () => {
    const user = userEvent.setup();
    const onCurrencyChange = vi.fn();

    render(
      <ReceiptFiltersSheet
        {...baseProps}
        filterByCurrency="MYR"
        onCurrencyChange={onCurrencyChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all currencies" }));

    expect(onCurrencyChange).toHaveBeenCalledWith(null);
  });

  it("filters category results when searching", async () => {
    const user = userEvent.setup();
    render(<ReceiptFiltersSheet {...baseProps} />);

    const searchInput = screen.getByRole("textbox", { name: "Search categories" });
    await user.type(searchInput, "groc");

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Office Supplies")).not.toBeInTheDocument();
  });

  it("calls onCategoryChange when selecting a category", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();

    render(<ReceiptFiltersSheet {...baseProps} onCategoryChange={onCategoryChange} />);

    const teamSection = screen.getByText("Team").closest("div");
    expect(teamSection).toBeTruthy();
    await user.click(within(teamSection as HTMLElement).getByRole("button", { name: "Category: Groceries" }));

    expect(onCategoryChange).toHaveBeenCalledWith("cat-team");
  });

  it("calls onResetFilters from reset button", async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();

    render(<ReceiptFiltersSheet {...baseProps} onResetFilters={onResetFilters} />);

    await user.click(screen.getByRole("button", { name: "Clear Filters" }));

    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking Done", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<ReceiptFiltersSheet {...baseProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
