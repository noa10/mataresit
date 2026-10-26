/**
 * @vitest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReceiptUpload } from "@/types/receipt";
import { BatchLedgerRow } from "../BatchLedgerRow";

const file = new File(["receipt"], "village-grocer.jpg", { type: "image/jpeg" });

const baseUpload: ReceiptUpload = {
  id: "upload-1",
  file,
  status: "completed",
  uploadProgress: 100,
  summary: {
    merchant: "Village Grocer Bangsar",
    total: 186.4,
    currency: "MYR",
    date: "2026-10-24",
  },
};

function renderRow(
  upload: ReceiptUpload,
  mode: "queue" | "results" = "queue",
  props: Partial<React.ComponentProps<typeof BatchLedgerRow>> = {}
) {
  return render(
    <ul>
      <BatchLedgerRow upload={upload} index={0} mode={mode} {...props} />
    </ul>
  );
}

describe("BatchLedgerRow", () => {
  it("renders a completed row with its amount and view action", () => {
    const onView = vi.fn();
    renderRow(baseUpload, "queue", { receiptId: "receipt-1", onView });

    expect(screen.getByText("village-grocer.jpg")).toBeInTheDocument();
    expect(screen.getByText(/186\.40/)).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /View village-grocer.jpg/i }));
    expect(onView).toHaveBeenCalledWith("receipt-1");
  });

  it("shows the failed row error and retries it", () => {
    const onRetry = vi.fn();
    renderRow(
      {
        ...baseUpload,
        status: "error",
        uploadProgress: 0,
        summary: undefined,
        error: { code: "PROCESSING_FAILED", message: "Upload timed out after 30s" },
      },
      "queue",
      { onRetry }
    );

    expect(screen.getByText("Upload timed out after 30s")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Retry village-grocer.jpg/i }));
    expect(onRetry).toHaveBeenCalledWith("upload-1");
  });

  it("shows a working progress bar and cancels the active row", () => {
    const onCancel = vi.fn();
    renderRow(
      {
        ...baseUpload,
        status: "processing",
        uploadProgress: 62,
        summary: undefined,
      },
      "queue",
      { onCancel }
    );

    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancel village-grocer.jpg/i }));
    expect(onCancel).toHaveBeenCalledWith("upload-1");
  });

  it("removes a queued row", () => {
    const onRemove = vi.fn();
    renderRow(
      {
        ...baseUpload,
        status: "pending",
        uploadProgress: 0,
        summary: undefined,
      },
      "queue",
      { onRemove }
    );

    expect(screen.getByText("Queued")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remove village-grocer.jpg/i }));
    expect(onRemove).toHaveBeenCalledWith("upload-1");
  });

  it("uses the merchant name and date in results mode", () => {
    renderRow(baseUpload, "results", { receiptId: "receipt-1", onView: vi.fn() });

    expect(screen.getByText("Village Grocer Bangsar")).toBeInTheDocument();
    expect(screen.getByText("24 Oct 2026")).toBeInTheDocument();
    expect(screen.getAllByText(/186\.40/).length).toBeGreaterThan(0);
  });
});
