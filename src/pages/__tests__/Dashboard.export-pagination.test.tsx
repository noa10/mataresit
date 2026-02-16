import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "@/pages/Dashboard";
import { Receipt } from "@/types/receipt";

const mocks = vi.hoisted(() => ({
  fetchReceiptsPage: vi.fn(),
  fetchReceiptCurrencies: vi.fn(),
  deleteReceipt: vi.fn(),
  fetchUserCategories: vi.fn(),
  fetchCategoriesForDisplay: vi.fn(),
  bulkAssignCategory: vi.fn(),
  captureExportPayload: vi.fn(),
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
  "title": "Receipts Dashboard",
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
  "pagination.showing": "Showing {{start}}-{{end}} of {{total}}",
  "pagination.pageOf": "Page {{page}} of {{totalPages}}",
  "pagination.perPage": "Per page",
  "buttons.cancel": "Cancel",
};

const t = (key: string, options?: Record<string, string | number>) => {
  const template = translationMap[key] ?? key;
  if (!options) return template;
  return Object.entries(options).reduce(
    (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
    template,
  );
};

vi.mock("@/contexts/LanguageContext", () => ({
  useDashboardTranslation: () => ({ t }),
  useCommonTranslation: () => ({ t }),
  useReceiptsTranslation: () => ({ t }),
}));

vi.mock("@/services/receiptService", () => ({
  fetchReceiptsPage: mocks.fetchReceiptsPage,
  fetchReceiptCurrencies: mocks.fetchReceiptCurrencies,
  deleteReceipt: mocks.deleteReceipt,
}));

vi.mock("@/services/categoryService", () => ({
  fetchUserCategories: mocks.fetchUserCategories,
  fetchCategoriesForDisplay: mocks.fetchCategoriesForDisplay,
  bulkAssignCategory: mocks.bulkAssignCategory,
}));

vi.mock("@/components/export/ExportDropdown", () => ({
  ExportDropdown: ({ getReceiptsForExport }: { getReceiptsForExport?: () => Promise<Receipt[]> }) => (
    <button
      type="button"
      onClick={async () => {
        const receipts = getReceiptsForExport ? await getReceiptsForExport() : [];
        mocks.captureExportPayload(receipts);
      }}
    >
      Export all
    </button>
  ),
}));

vi.mock("@/components/modals/BatchUploadModal", () => ({
  BatchUploadModal: () => null,
}));

vi.mock("@/components/ReceiptCard", () => ({
  default: ({ merchant }: { merchant: string }) => <div>{merchant}</div>,
}));

const mockReceipts: Receipt[] = Array.from({ length: 120 }).map((_, index) => ({
  id: `receipt-${index + 1}`,
  merchant: `Merchant ${index + 1}`,
  date: `2026-02-${String((index % 28) + 1).padStart(2, "0")}`,
  total: index + 1,
  currency: "MYR",
  status: "reviewed",
  payment_method: "card",
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  custom_category_id: null,
  processing_status: "complete",
  image_url: "/placeholder.svg",
  confidence_scores: { merchant: 0.95 },
}));

function buildPage(params: any = {}) {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 25);
  const offset = (page - 1) * limit;
  const total = mockReceipts.length;
  const totalPages = Math.ceil(total / limit);

  return {
    receipts: mockReceipts.slice(offset, offset + limit),
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard?view=table&page=1&limit=25"]}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard export with paginated data", () => {
  beforeEach(() => {
    mocks.fetchReceiptsPage.mockImplementation(async (params: any = {}) => buildPage(params));
    mocks.fetchReceiptCurrencies.mockResolvedValue(["MYR"]);
    mocks.deleteReceipt.mockResolvedValue(true);
    mocks.fetchUserCategories.mockResolvedValue([]);
    mocks.fetchCategoriesForDisplay.mockResolvedValue([]);
    mocks.bulkAssignCategory.mockResolvedValue(0);
    mocks.captureExportPayload.mockReset();
  });

  it("fetches all filtered pages when export provider is used", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(mocks.fetchReceiptsPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 25 }),
        expect.anything(),
      );
    });

    await user.click(screen.getByRole("button", { name: "Export all" }));

    await waitFor(() => {
      expect(mocks.captureExportPayload).toHaveBeenCalledTimes(1);
      expect(mocks.captureExportPayload.mock.calls[0][0]).toHaveLength(120);
    });

    const exportCalls = mocks.fetchReceiptsPage.mock.calls
      .map((args) => args[0])
      .filter((params) => params.limit === 50);

    expect(exportCalls.map((params) => params.page)).toEqual([1, 2, 3]);
  });
});
