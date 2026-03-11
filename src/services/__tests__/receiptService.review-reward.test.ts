import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  generateEmbeddingsForReceipt: vi.fn(),
  receiptsTable: {
    update: vi.fn(),
  },
  receiptUpdateQuery: {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  },
  lineItemsTable: {
    delete: vi.fn(),
    insert: vi.fn(),
  },
  lineItemsDeleteQuery: {
    eq: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabase,
}));

vi.mock("@/lib/ai-search", () => ({
  generateEmbeddingsForReceipt: hoisted.generateEmbeddingsForReceipt,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { updateReceiptWithLineItems } from "@/services/receiptService";

describe("updateReceiptWithLineItems review reward integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hoisted.receiptUpdateQuery.eq.mockReturnValue(hoisted.receiptUpdateQuery);
    hoisted.receiptUpdateQuery.select.mockReturnValue(hoisted.receiptUpdateQuery);
    hoisted.receiptUpdateQuery.single.mockResolvedValue({
      data: {
        id: "receipt-1",
        merchant: "Coffee Shop",
        date: "2026-03-01",
        total: 12.5,
        payment_method: "card",
        status: "reviewed",
        currency: "MYR",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      error: null,
    });
    hoisted.receiptsTable.update.mockReturnValue(hoisted.receiptUpdateQuery);

    hoisted.lineItemsDeleteQuery.eq.mockResolvedValue({ error: null });
    hoisted.lineItemsTable.delete.mockReturnValue(hoisted.lineItemsDeleteQuery);
    hoisted.lineItemsTable.insert.mockResolvedValue({ error: null });

    hoisted.supabase.from.mockImplementation((table: string) => {
      if (table === "receipts") {
        return hoisted.receiptsTable;
      }

      if (table === "line_items") {
        return hoisted.lineItemsTable;
      }

      throw new Error(`Unexpected table ${table}`);
    });

    hoisted.supabase.rpc.mockResolvedValue({ error: null });
    hoisted.generateEmbeddingsForReceipt.mockResolvedValue(undefined);
  });

  it("records the review reward after a successful reviewed save", async () => {
    await updateReceiptWithLineItems(
      "receipt-1",
      { status: "reviewed" },
      [{ id: "line-1", receipt_id: "receipt-1", description: "Latte", amount: 12.5 }]
    );

    expect(hoisted.supabase.rpc).toHaveBeenCalledWith("record_receipt_review", {
      _receipt_id: "receipt-1",
    });
  });

  it("does not record the review reward when the save fails", async () => {
    hoisted.receiptUpdateQuery.single.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      updateReceiptWithLineItems("receipt-1", { status: "reviewed" })
    ).rejects.toEqual(expect.objectContaining({ message: "boom" }));

    expect(hoisted.supabase.rpc).not.toHaveBeenCalled();
  });

  it("skips the review reward for non-reviewed saves", async () => {
    hoisted.receiptUpdateQuery.single.mockResolvedValueOnce({
      data: {
        id: "receipt-1",
        merchant: "Coffee Shop",
        date: "2026-03-01",
        total: 12.5,
        payment_method: "card",
        status: "unreviewed",
        currency: "MYR",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      error: null,
    });

    await updateReceiptWithLineItems("receipt-1", { status: "unreviewed" });

    expect(hoisted.supabase.rpc).not.toHaveBeenCalled();
  });
});