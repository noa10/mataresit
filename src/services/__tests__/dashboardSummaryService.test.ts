import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

import {
  buildDashboardSummary,
  type DashboardSummaryRow,
} from "@/services/dashboardSummaryService";

const makeRow = (overrides: Partial<DashboardSummaryRow> = {}): DashboardSummaryRow => ({
  id: "receipt-1",
  merchant: "Kedai Kopi",
  date: "2026-10-04",
  total: 25,
  tax: 1.5,
  currency: "MYR",
  status: "reviewed",
  predicted_category: "Meals",
  created_at: "2026-10-04T08:00:00.000Z",
  confidence_scores: {
    merchant: 0.95,
    date: 0.95,
    total: 0.95,
    payment_method: 0.95,
    tax: 0.95,
  },
  custom_categories: null,
  ...overrides,
});

const lowConfidence = {
  merchant: 0.6,
  date: 0.6,
  total: 0.6,
  payment_method: 0.6,
  tax: 0.6,
};

describe("buildDashboardSummary", () => {
  it("groups totals by currency and picks the dominant currency", () => {
    const summary = buildDashboardSummary(
      [
        makeRow({ id: "a", total: 100, tax: 6 }),
        makeRow({ id: "b", total: 50, tax: 3 }),
        makeRow({ id: "c", total: 20, tax: 1, currency: "USD" }),
      ],
      "2026-10-01",
      "2026-10-31"
    );

    expect(summary.primaryCurrency).toBe("MYR");
    expect(summary.totalSpend).toBe(150);
    expect(summary.totalTax).toBe(9);
    expect(summary.receiptCount).toBe(3);
    expect(summary.otherCurrencyCount).toBe(1);
    expect(summary.totals.map((entry) => entry.currency)).toEqual(["MYR", "USD"]);
  });

  it("builds the category breakdown from the primary currency only", () => {
    const summary = buildDashboardSummary(
      [
        makeRow({ id: "a", total: 40, predicted_category: "Meals" }),
        makeRow({ id: "b", total: 10, predicted_category: "Meals" }),
        makeRow({
          id: "c",
          total: 25,
          predicted_category: null,
          custom_categories: { name: "Office supplies" },
        }),
        makeRow({ id: "d", total: 10, currency: "USD", predicted_category: "Travel" }),
      ],
      "2026-10-01",
      "2026-10-31"
    );

    expect(summary.categories).toEqual([
      { name: "Meals", total: 50 },
      { name: "Office supplies", total: 25 },
    ]);
  });

  it("falls back to Uncategorized when no category is present", () => {
    const summary = buildDashboardSummary(
      [makeRow({ predicted_category: null, custom_categories: null })],
      "2026-10-01",
      "2026-10-31"
    );

    expect(summary.categories[0]).toEqual({ name: "Uncategorized", total: 25 });
  });

  it("sorts the review preview by confidence, unknown scores last", () => {
    const summary = buildDashboardSummary(
      [
        makeRow({ id: "reviewed", status: "reviewed" }),
        makeRow({ id: "low", status: "unreviewed", confidence_scores: lowConfidence }),
        makeRow({ id: "unknown", status: "unreviewed", confidence_scores: null }),
        makeRow({ id: "mid", status: "unreviewed", confidence_scores: { ...lowConfidence, merchant: 0.74, total: 0.74 } }),
      ],
      "2026-10-01",
      "2026-10-31"
    );

    expect(summary.reviewCount).toBe(3);
    expect(summary.reviewPreview.map((receipt) => receipt.id)).toEqual([
      "low",
      "mid",
      "unknown",
    ]);
  });

  it("returns the five most recent receipts", () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      makeRow({
        id: `receipt-${index}`,
        date: `2026-10-0${index + 1}`,
      })
    );

    const summary = buildDashboardSummary(rows, "2026-10-01", "2026-10-31");

    expect(summary.recent).toHaveLength(5);
    expect(summary.recent.map((receipt) => receipt.id)).toEqual([
      "receipt-6",
      "receipt-5",
      "receipt-4",
      "receipt-3",
      "receipt-2",
    ]);
  });

  it("treats missing totals as zero", () => {
    const summary = buildDashboardSummary(
      [makeRow({ total: null, tax: null })],
      "2026-10-01",
      "2026-10-31"
    );

    expect(summary.totalSpend).toBe(0);
    expect(summary.totalTax).toBe(0);
    expect(summary.receiptCount).toBe(1);
  });
});
