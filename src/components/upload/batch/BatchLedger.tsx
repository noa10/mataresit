import { AnimatePresence } from "framer-motion";

import type { ReceiptUpload } from "@/types/receipt";
import type { FileProgressDetail } from "@/lib/progress-tracking";
import { BatchLedgerRow } from "./BatchLedgerRow";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

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
  emptyMessage,
  onRemove,
  onCancel,
  onRetry,
  onView,
}: BatchLedgerProps) {
  const { t } = useReceiptsTranslation();
  const isResults = mode === "results";
  const message = emptyMessage || t("batch.ledger.empty");

  return (
    <section
      className={`batch-ledger${isResults ? " is-results" : ""}`}
      aria-label={t("batch.ledger.label")}
    >
      <div
        className="batch-scroll"
        tabIndex={0}
        role="region"
        aria-label={t("batch.ledger.region")}
      >
        <div className="batch-ledger-head" aria-hidden="true">
          <span>#</span>
          <span>{t("batch.ledger.receipt")}</span>
          <span>{isResults ? t("batch.ledger.date") : t("batch.ledger.size")}</span>
          <span>{t("batch.ledger.status")}</span>
          <span>{t("batch.ledger.total")}</span>
          <span />
        </div>

        {uploads.length === 0 ? (
          <div className="batch-filter-empty">{message}</div>
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
