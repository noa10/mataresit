import { describe, expect, it } from "vitest";
import type { ReceiptUpload } from "@/types/receipt";
import {
  fileKind,
  formatAmount,
  formatEta,
  formatFileSize,
  rowDetail,
  rowState,
  rowStateLabel,
} from "../utils";

const makeUpload = (overrides: Partial<ReceiptUpload> = {}): ReceiptUpload => ({
  id: "upload-1",
  file: new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }),
  status: "pending",
  uploadProgress: 0,
  ...overrides,
});

describe("batch ledger utils", () => {
  it("formats file sizes for the ledger", () => {
    expect(formatFileSize(0)).toBe("0 MB");
    expect(formatFileSize(512 * 1024)).toBe("512 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("formats ETA copy", () => {
    expect(formatEta(15_000)).toBe("under 15s left");
    expect(formatEta(120_000)).toBe("~2 min left");
    expect(formatEta(null)).toBeNull();
  });

  it("formats MYR totals with the currency code", () => {
    expect(formatAmount(24.15, "MYR")).toContain("24.15");
    expect(formatAmount(24.15, "MYR")).toContain("MYR");
    expect(formatAmount(undefined, "MYR")).toBe("—");
  });

  it("maps upload status to ledger states", () => {
    expect(rowState(makeUpload({ status: "pending" }))).toBe("queued");
    expect(rowState(makeUpload({ status: "uploading" }))).toBe("working");
    expect(rowState(makeUpload({ status: "processing" }))).toBe("working");
    expect(rowState(makeUpload({ status: "completed" }))).toBe("ready");
    expect(rowState(makeUpload({ status: "error" }))).toBe("failed");
  });

  it("uses human labels for active stages", () => {
    expect(rowStateLabel(makeUpload({ status: "uploading" }))).toBe("Uploading");
    expect(rowStateLabel(makeUpload({ status: "processing" }))).toBe("Working");
    expect(rowStateLabel(makeUpload({ status: "completed" }))).toBe("Ready");
    expect(rowStateLabel(makeUpload({ status: "error" }))).toBe("Failed");
  });

  it("describes queued, failed, and completed rows", () => {
    expect(rowDetail(makeUpload())).toBe("Waiting for a free slot");
    expect(
      rowDetail(
        makeUpload({
          status: "error",
          error: { code: "PROCESSING_FAILED", message: "Upload timed out after 30s" },
        })
      )
    ).toBe("Upload timed out after 30s");
    expect(
      rowDetail(
        makeUpload({
          status: "completed",
          summary: { merchant: "Village Grocer Bangsar", total: 186.4, currency: "MYR" },
        })
      )
    ).toBe("Village Grocer Bangsar");
  });

  it("labels file types", () => {
    expect(fileKind("image/jpeg")).toBe("JPG");
    expect(fileKind("image/png")).toBe("PNG");
    expect(fileKind("application/pdf")).toBe("PDF");
  });
});
