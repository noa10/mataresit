import { describe, expect, it } from "vitest";

import {
  hasReceiptChanges,
  receiptValuesEqual,
} from "@/lib/receipts/receiptChanges";
import type { ReceiptWithDetails } from "@/types/receipt";

const asReceipt = (value: Record<string, unknown>) =>
  value as unknown as ReceiptWithDetails;

const baseReceipt = (overrides: Record<string, unknown> = {}) => ({
  id: "receipt-1",
  merchant: "ECONSAVE",
  date: "2026-03-14",
  total: 19.35,
  tax: null,
  subtotal: null,
  currency: null,
  payment_method: null,
  predicted_category: null,
  custom_category_id: null,
  paid_by_id: null,
  is_business_expense: null,
  line_items: null,
  created_at: "2026-03-14T10:00:00+00:00",
  updated_at: "2026-03-14T10:00:00+00:00",
  confidence_scores: null,
  processing_status: "complete",
  ...overrides,
});

describe("hasReceiptChanges", () => {
  it("treats the editor's defaults as equal to null server values", () => {
    const original = baseReceipt();
    const edited = {
      ...original,
      tax: 0,
      currency: "MYR",
      payment_method: "",
      predicted_category: "",
      is_business_expense: false,
    };

    expect(hasReceiptChanges(asReceipt(edited), asReceipt(original))).toBe(false);
  });

  it("detects a real edit", () => {
    const original = baseReceipt();

    expect(
      hasReceiptChanges(asReceipt({ ...original, total: 20 }), asReceipt(original))
    ).toBe(true);
  });

  it("compares numeric strings by value", () => {
    const original = baseReceipt({ total: 6.6 });

    expect(
      hasReceiptChanges(asReceipt({ ...original, total: "6.60" }), asReceipt(original))
    ).toBe(false);
  });

  it("ignores server-managed fields", () => {
    const original = baseReceipt();

    expect(
      hasReceiptChanges(
        asReceipt({
          ...original,
          updated_at: "2026-03-15T10:00:00+00:00",
          processing_status: "needs_review",
          confidence_scores: { total: 100 },
        }),
        asReceipt(original)
      )
    ).toBe(false);
  });
});

describe("receiptValuesEqual", () => {
  it.each([
    ["tax", 0, null],
    ["total", "20.40", 20.4],
    ["currency", "MYR", null],
    ["payment_method", "", null],
    ["is_business_expense", false, null],
  ])("treats %s defaults as equal", (key, left, right) => {
    expect(receiptValuesEqual(key, left, right)).toBe(true);
  });

  it("still sees different values", () => {
    expect(receiptValuesEqual("total", 19.35, 20.4)).toBe(false);
    expect(receiptValuesEqual("date", "2026-03-14", "2026-03-15")).toBe(false);
  });
});
