import type { ReceiptUpload } from "@/types/receipt";

export type BatchRowState = "ready" | "working" | "queued" | "failed";
export type BatchFilter = "all" | "ready" | "failed";
export type Translate = (
  key: string,
  options?: Record<string, unknown>
) => string;

const ENGLISH: Record<string, string> = {
  "row.statusReady": "Ready",
  "row.statusUploading": "Uploading",
  "row.statusWorking": "Working",
  "row.statusFailed": "Failed",
  "row.statusQueued": "Queued",
  "row.stageUploading": "Uploading to cloud storage",
  "row.stageProcessing": "AI processing and analysis",
  "row.stageEmbedding": "Generating embeddings",
  "row.stageStoring": "Storing receipt data",
  "row.stageCompleted": "Posted to the ledger",
  "row.waiting": "Waiting for a free slot",
  "row.postedOn": "Posted · {{date}}",
  "row.postedLedger": "Posted to the ledger",
  "row.uploadFailed": "Upload failed. Try again.",
  "row.etaUnder": "under {{seconds}}s left",
  "row.etaMinutes": "~{{minutes}} min left",
};

function translate(
  t: Translate | undefined,
  key: string,
  options?: Record<string, unknown>
): string {
  if (t) return t(`batch.${key}`, options);
  const template = ENGLISH[key] ?? key;
  return Object.entries(options ?? {}).reduce(
    (text, [name, value]) =>
      text.replace(new RegExp(`{{${name}}}`, "g"), String(value)),
    template
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatBatchDate(
  value?: Date | string | null,
  locale = "en-MY"
): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatBatchDate(undefined, locale);
  return new Intl.DateTimeFormat(locale, {
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

export function formatEta(
  ms?: number | null,
  t?: Translate
): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 60_000) {
    return translate(t, "row.etaUnder", {
      seconds: Math.max(1, Math.round(ms / 1000)),
    });
  }
  return translate(t, "row.etaMinutes", { minutes: Math.ceil(ms / 60_000) });
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

export function rowStateLabel(
  upload: ReceiptUpload,
  t?: Translate
): string {
  switch (rowState(upload)) {
    case "ready":
      return translate(t, "row.statusReady");
    case "working":
      return translate(
        t,
        upload.status === "uploading"
          ? "row.statusUploading"
          : "row.statusWorking"
      );
    case "failed":
      return translate(t, "row.statusFailed");
    default:
      return translate(t, "row.statusQueued");
  }
}

const STAGE_KEYS: Record<string, string> = {
  uploading: "row.stageUploading",
  processing: "row.stageProcessing",
  embedding: "row.stageEmbedding",
  storing: "row.stageStoring",
  completed: "row.stageCompleted",
};

export function rowDetail(
  upload: ReceiptUpload,
  detail?: { stage?: string } | null,
  t?: Translate,
  locale = "en-MY"
): string {
  if (upload.status === "error") {
    return upload.error?.message || translate(t, "row.uploadFailed");
  }
  if (upload.status === "pending") {
    return translate(t, "row.waiting");
  }
  if (upload.status === "completed") {
    return (
      upload.summary?.merchant ||
      (upload.summary?.date
        ? translate(t, "row.postedOn", {
            date: formatBatchDate(upload.summary.date, locale),
          })
        : translate(t, "row.postedLedger"))
    );
  }
  const stageKey = detail?.stage ? STAGE_KEYS[detail.stage] : null;
  if (stageKey) return translate(t, stageKey);
  return translate(
    t,
    upload.status === "uploading"
      ? "row.stageUploading"
      : "row.stageProcessing"
  );
}

export function summaryDate(
  upload: ReceiptUpload,
  locale = "en-MY"
): string {
  if (!upload.summary?.date) return "—";
  return formatBatchDate(upload.summary.date, locale);
}
