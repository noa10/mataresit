import type { ReceiptUpload } from "@/types/receipt";

export type BatchRowState = "ready" | "working" | "queued" | "failed";
export type BatchFilter = "all" | "ready" | "failed";

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatBatchDate(value?: Date | string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatBatchDate();
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatAmount(
  total?: number | null,
  currency?: string | null
): string {
  if (typeof total !== "number" || Number.isNaN(total)) return "—";
  const code = (currency || "MYR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total);
  } catch {
    return `${code} ${total.toFixed(2)}`;
  }
}

export function formatEta(ms?: number | null): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 60_000) return `under ${Math.max(1, Math.round(ms / 1000))}s left`;
  return `~${Math.ceil(ms / 60_000)} min left`;
}

export function fileKind(type: string): string {
  if (type === "application/pdf") return "PDF";
  if (type === "image/png") return "PNG";
  if (type === "image/jpeg") return "JPG";
  return "FILE";
}

export function rowState(upload: ReceiptUpload): BatchRowState {
  if (upload.status === "completed") return "ready";
  if (upload.status === "error") return "failed";
  if (upload.status === "pending") return "queued";
  return "working";
}

export function rowStateLabel(upload: ReceiptUpload): string {
  switch (rowState(upload)) {
    case "ready":
      return "Ready";
    case "working":
      return upload.status === "uploading" ? "Uploading" : "Working";
    case "failed":
      return "Failed";
    default:
      return "Queued";
  }
}

const STAGE_COPY: Record<string, string> = {
  uploading: "Uploading to cloud storage",
  processing: "AI processing and analysis",
  embedding: "Generating embeddings",
  storing: "Storing receipt data",
  completed: "Posted to the ledger",
};

export function rowDetail(
  upload: ReceiptUpload,
  detail?: { stage?: string } | null
): string {
  if (upload.status === "error") {
    return upload.error?.message || "Upload failed. Try again.";
  }
  if (upload.status === "pending") {
    return "Waiting for a free slot";
  }
  if (upload.status === "completed") {
    return (
      upload.summary?.merchant ||
      (upload.summary?.date
        ? `Posted · ${formatBatchDate(upload.summary.date)}`
        : "Posted to the ledger")
    );
  }
  const stage = detail?.stage ? STAGE_COPY[detail.stage] : null;
  if (stage) return stage;
  return upload.status === "uploading"
    ? STAGE_COPY.uploading
    : STAGE_COPY.processing;
}

export function summaryDate(upload: ReceiptUpload): string {
  if (!upload.summary?.date) return "—";
  return formatBatchDate(upload.summary.date);
}
