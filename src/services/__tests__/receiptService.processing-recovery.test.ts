import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const receiptSingle = vi.fn();
  const latestLogMaybeSingle = vi.fn();
  const receiptUpdateEq = vi.fn();
  const updatePayloads: Array<Record<string, unknown>> = [];

  const receiptSelectBuilder = {
    eq: vi.fn(() => ({
      single: receiptSingle,
    })),
  };

  const processingLogsSelectBuilder = {
    eq: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: latestLogMaybeSingle,
        })),
      })),
    })),
  };

  const receiptUpdateBuilder = {
    eq: receiptUpdateEq,
  };

  const receiptTable = {
    select: vi.fn(() => receiptSelectBuilder),
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayloads.push(payload);
      return receiptUpdateBuilder;
    }),
  };

  const processingLogsTable = {
    select: vi.fn(() => processingLogsSelectBuilder),
  };

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "receipts") return receiptTable;
      if (table === "processing_logs") return processingLogsTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    receiptSingle,
    latestLogMaybeSingle,
    receiptUpdateEq,
    updatePayloads,
    receiptTable,
    processingLogsTable,
    supabase,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabase,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import {
  cancelReceiptProcessing,
  recoverStuckReceiptProcessing,
} from "@/services/receiptService";

describe("receipt processing recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.updatePayloads.length = 0;
    hoisted.receiptUpdateEq.mockResolvedValue({ error: null });
    hoisted.latestLogMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("recovers to failed when latest processing log is an error", async () => {
    hoisted.receiptSingle.mockResolvedValue({
      data: {
        processing_status: "processing",
        processing_error: null,
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    hoisted.latestLogMaybeSingle.mockResolvedValue({
      data: {
        created_at: new Date().toISOString(),
        step_name: "ERROR",
        status_message: "OpenRouter request failed",
      },
      error: null,
    });

    const result = await recoverStuckReceiptProcessing("receipt-1");

    expect(result).toEqual({ recovered: true, reason: "error_log_detected" });
    expect(hoisted.updatePayloads.at(-1)).toMatchObject({
      processing_status: "failed",
      processing_error: "OpenRouter request failed",
    });
    expect(hoisted.receiptUpdateEq).toHaveBeenCalledWith("id", "receipt-1");
  });

  it("recovers to failed when activity is stale for over 3 minutes", async () => {
    const staleTimestamp = new Date(Date.now() - 4 * 60 * 1000).toISOString();

    hoisted.receiptSingle.mockResolvedValue({
      data: {
        processing_status: "processing",
        processing_error: null,
        updated_at: staleTimestamp,
      },
      error: null,
    });
    hoisted.latestLogMaybeSingle.mockResolvedValue({
      data: {
        created_at: staleTimestamp,
        step_name: "PROCESSING",
        status_message: "Analyzing receipt content",
      },
      error: null,
    });

    const result = await recoverStuckReceiptProcessing("receipt-2");

    expect(result).toEqual({ recovered: true, reason: "stale_timeout" });
    expect(hoisted.updatePayloads.at(-1)).toMatchObject({
      processing_status: "failed",
    });
    expect(String(hoisted.updatePayloads.at(-1)?.processing_error)).toContain("interrupted");
  });

  it("does not recover when recent non-error activity exists", async () => {
    const freshTimestamp = new Date(Date.now() - 30 * 1000).toISOString();

    hoisted.receiptSingle.mockResolvedValue({
      data: {
        processing_status: "processing",
        processing_error: null,
        updated_at: freshTimestamp,
      },
      error: null,
    });
    hoisted.latestLogMaybeSingle.mockResolvedValue({
      data: {
        created_at: freshTimestamp,
        step_name: "PROCESSING",
        status_message: "Still running",
      },
      error: null,
    });

    const result = await recoverStuckReceiptProcessing("receipt-3");

    expect(result).toEqual({ recovered: false, reason: "fresh_activity" });
    expect(hoisted.receiptTable.update).not.toHaveBeenCalled();
  });

  it("does nothing for terminal statuses", async () => {
    const terminalStatuses = ["complete", "failed", "failed_ai", "failed_ocr"] as const;

    for (const status of terminalStatuses) {
      hoisted.receiptSingle.mockResolvedValue({
        data: {
          processing_status: status,
          processing_error: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await recoverStuckReceiptProcessing(`receipt-${status}`);

      expect(result).toEqual({ recovered: false, reason: "terminal_status" });
    }

    expect(hoisted.receiptTable.update).not.toHaveBeenCalled();
  });

  it("cancelReceiptProcessing writes failed status with cancellation reason", async () => {
    const cancelled = await cancelReceiptProcessing("receipt-cancel", "Cancelled by user");

    expect(cancelled).toBe(true);
    expect(hoisted.updatePayloads.at(-1)).toMatchObject({
      processing_status: "failed",
      processing_error: "Cancelled by user",
    });
    expect(hoisted.receiptUpdateEq).toHaveBeenCalledWith("id", "receipt-cancel");
  });
});
