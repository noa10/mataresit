import { AnimatePresence } from "framer-motion";

import type { ReceiptUpload } from "@/types/receipt";
import type { FileProgressDetail } from "@/lib/progress-tracking";
import { BatchLedgerRow } from "./BatchLedgerRow";

interface BatchLedgerProps {
  uploads: ReceiptUpload[];
  mode: "queue" | "results";
  receiptIds: Record<string, string>;
  details?: Record<string, FileProgressDetail>;
  emptyMessage?: string;
  onRemove?: (uploadId: string) => void;
  onCancel?: (uploadId: string) => void;
  onRetry?: (uploadId: string) => void;
  onView?: (receiptId: string) => void;
}

export function BatchLedger({
  uploads,
  mode,
  receiptIds,
  details,
  emptyMessage = "No receipts in this view.",
  onRemove,
  onCancel,
  onRetry,
  onView,
}: BatchLedgerProps) {
  const isResults = mode === "results";

  return (
    <section
      className={`batch-ledger${isResults ? " is-results" : ""}`}
      aria-label="Batch receipt ledger"
    >
      <div
        className="batch-scroll"
        tabIndex={0}
        role="region"
        aria-label="Batch receipts"
      >
        <div className="batch-ledger-head" aria-hidden="true">
          <span>#</span>
          <span>Receipt</span>
          <span>{isResults ? "Date" : "Size"}</span>
          <span>Status</span>
          <span>{isResults ? "Total" : "Total"}</span>
          <span />
        </div>

        {uploads.length === 0 ? (
          <div className="batch-filter-empty">{emptyMessage}</div>
        ) : (
          <ul className="batch-rows">
            <AnimatePresence initial={false}>
              {uploads.map((upload, index) => (
                <BatchLedgerRow
                  key={upload.id}
                  upload={upload}
                  index={index}
                  mode={mode}
                  receiptId={receiptIds[upload.id]}
                  detail={details?.[upload.id]}
                  onRemove={onRemove}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  onView={onView}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
