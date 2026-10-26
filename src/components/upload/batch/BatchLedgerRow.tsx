import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";

import type { ReceiptUpload } from "@/types/receipt";
import {
  fileKind,
  formatAmount,
  formatFileSize,
  rowDetail,
  rowState,
  rowStateLabel,
  summaryDate,
} from "./utils";

interface BatchLedgerRowProps {
  upload: ReceiptUpload;
  index: number;
  mode: "queue" | "results";
  receiptId?: string;
  detail?: { stage?: string } | null;
  onRemove?: (uploadId: string) => void;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onView?: (receiptId: string) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function BatchLedgerRow({
  upload,
  index,
  mode,
  receiptId,
  detail,
  onRemove,
  onCancel,
  onRetry,
  onView,
}: BatchLedgerRowProps) {
  const reduceMotion = useReducedMotion();
  const state = rowState(upload);
  const statusLabel = rowStateLabel(upload);
  const kind = fileKind(upload.file.type);
  const size = formatFileSize(upload.file.size);
  const detailText = rowDetail(upload, detail);
  const name =
    mode === "results"
      ? upload.summary?.merchant || upload.file.name
      : upload.file.name;
  const sub = mode === "results" ? upload.file.name : detailText;
  const date = summaryDate(upload);
  const amount = formatAmount(upload.summary?.total, upload.summary?.currency);
  const progress = Math.max(0, Math.min(100, Math.round(upload.uploadProgress || 0)));

  const mobileMeta =
    mode === "results"
      ? state === "failed"
        ? `Failed · ${detailText}`
        : `Ready · ${date} · ${amount}`
      : state === "working"
        ? `Working · ${detailText}`
        : state === "queued"
          ? "Queued · Waiting for a free slot"
          : state === "failed"
            ? `Failed · ${detailText}`
            : `Ready · ${kind} · ${size}`;

  const action =
    state === "ready" ? (
      receiptId && onView ? (
        <button
          type="button"
          className="batch-row-action"
          onClick={() => onView(receiptId)}
          aria-label={`View ${name}`}
        >
          View
        </button>
      ) : (
        <span className="batch-row-posted">Posted</span>
      )
    ) : state === "failed" && onRetry ? (
      <button
        type="button"
        className="batch-row-action batch-row-action-danger"
        onClick={() => onRetry(upload.id)}
        aria-label={`Retry ${upload.file.name}`}
      >
        <RotateCcw className="batch-action-icon" aria-hidden="true" />
        Retry
      </button>
    ) : state === "queued" && onRemove ? (
      <button
        type="button"
        className="batch-row-action batch-row-action-icon"
        onClick={() => onRemove(upload.id)}
        aria-label={`Remove ${upload.file.name}`}
      >
        <X className="batch-action-icon" aria-hidden="true" />
      </button>
    ) : state === "working" && onCancel ? (
      <button
        type="button"
        className="batch-row-action batch-row-action-icon"
        onClick={() => onCancel(upload.id)}
        aria-label={`Cancel ${upload.file.name}`}
      >
        <X className="batch-action-icon" aria-hidden="true" />
      </button>
    ) : null;

  return (
    <motion.li
      className="batch-row"
      data-status={state}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
      transition={{
        duration: reduceMotion ? 0 : 0.18,
        delay: reduceMotion ? 0 : Math.min(index * 0.024, 0.168),
        ease: [0.2, 0.7, 0.3, 1],
      }}
      style={{ "--batch-row-index": index } as CSSProperties}
    >
      <span className="batch-index mono" aria-hidden="true">
        {pad(index + 1)}
      </span>

      <div className="batch-file">
        <span className="batch-glyph" aria-hidden="true">
          {kind}
        </span>
        <div className="batch-file-text">
          <span className="batch-name" title={name}>
            {name}
          </span>
          <span className="batch-sub" title={sub}>
            {sub}
          </span>
          <span className="batch-mobile-meta" title={mobileMeta}>
            {mobileMeta}
          </span>
          {state === "working" && (
            <span className="batch-mobile-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${progress / 100})` }} />
            </span>
          )}
        </div>
      </div>

      {mode === "results" ? (
        <span className="batch-date mono">{date}</span>
      ) : (
        <span className="batch-size mono">{size}</span>
      )}

      <span className="batch-status" data-status={state}>
        {state === "ready" && <Check className="batch-status-icon" aria-hidden="true" />}
        {state === "working" && (
          <Loader2 className="batch-status-icon batch-spin" aria-hidden="true" />
        )}
        {state === "queued" && <Clock className="batch-status-icon" aria-hidden="true" />}
        {state === "failed" && (
          <AlertTriangle className="batch-status-icon" aria-hidden="true" />
        )}
        {statusLabel}
      </span>

      <div className="batch-progress-cell">
        {state === "working" ? (
          <>
            <span className="batch-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${progress / 100})` }} />
            </span>
            <span className="batch-pct mono">{progress}%</span>
          </>
        ) : (
          <span className="batch-amount mono">
            {state === "ready" ? amount : "—"}
          </span>
        )}
      </div>

      <div className="batch-actions">{action}</div>
    </motion.li>
  );
}
