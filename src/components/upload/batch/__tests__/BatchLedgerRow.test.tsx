/**
 * @vitest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReceiptUpload } from "@/types/receipt";
import { BatchLedgerRow } from "../BatchLedgerRow";

const batchMessages: Record<string, string> = {
  "batch.row.view": "View",
  "batch.row.posted": "Posted",
  "batch.row.retry": "Retry",
  "batch.row.viewAria": "View {{name}}",
  "batch.row.retryAria": "Retry {{name}}",
  "batch.row.removeAria": "Remove {{name}}",
  "batch.row.cancelAria": "Cancel {{name}}",
  "batch.row.failedMeta": "Failed · {{detail}}",
  "batch.row.readyMeta": "Ready · {{date}} · {{amount}}",
  "batch.row.workingMeta": "Working · {{detail}}",
  "batch.row.queuedMeta": "Queued · Waiting for a free slot",
  "batch.row.readyFileMeta": "Ready · {{kind}} · {{size}}",
  "batch.row.statusReady": "Ready",
  "batch.row.statusUploading": "Uploading",
  "batch.row.statusWorking": "Working",
  "batch.row.statusFailed": "Failed",
  "batch.row.statusQueued": "Queued",
  "batch.row.stageUploading": "Uploading to cloud storage",
  "batch.row.stageProcessing": "AI processing and analysis",
  "batch.row.stageEmbedding": "Generating embeddings",
  "batch.row.stageStoring": "Storing receipt data",
  "batch.row.stageCompleted": "Posted to the ledger",
  "batch.row.waiting": "Waiting for a free slot",
  "batch.row.postedOn": "Posted · {{date}}",
  "batch.row.postedLedger": "Posted to the ledger",
  "batch.row.uploadFailed": "Upload failed. Try again.",
  "batch.row.etaUnder": "under {{seconds}}s left",
  "batch.row.etaMinutes": "~{{minutes}} min left",
};

vi.mock("@/contexts/LanguageContext", () => ({
  useReceiptsTranslation: () => ({
    language: "en",
    t: (key: string, options: Record<string, unknown> = {}) =>
      (batchMessages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) =>
        options[name] === undefined ? "" : String(options[name])
      ),
  }),
}));

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
