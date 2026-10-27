import {
  ArrowRight,
  ClipboardList,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

interface BatchFooterProps {
  mode: "queue" | "results";
  allComplete: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  queued: number;
  failed: number;
  ready: number;
  total: number;
  percent: number;
  etaText?: string | null;
  batchName: string;
  batchDate: string;
  fileCount: number;
  atCapacity: boolean;
  isCompressing: boolean;
  onStart: () => void;
  onPause: () => void;
  onReview: () => void;
  onAdd: () => void;
  onUploadMore: () => void;
  onOpenReceipts: () => void;
  onRetryAll: () => void;
}

export function BatchFooter({
  mode,
  allComplete,
  isProcessing,
  isPaused,
  queued,
  failed,
  ready,
  total,
  percent,
  etaText,
  batchName,
  batchDate,
  fileCount,
  atCapacity,
  isCompressing,
  onStart,
  onPause,
  onReview,
  onAdd,
  onUploadMore,
  onOpenReceipts,
  onRetryAll,
}: BatchFooterProps) {
  const { t } = useReceiptsTranslation();
  const isResults = mode === "results";
  const addDisabled = atCapacity || isCompressing;

  const note = isResults
    ? failed > 0
      ? t("batch.footer.failedStay")
      : t("batch.footer.allPosted")
    : isProcessing
      ? t("batch.footer.keepRunning")
      : allComplete
        ? t("batch.footer.review")
        : t("batch.footer.optimising");

  const primary = isResults ? (
    ready > 0 ? (
      <Button
        type="button"
        variant="accent"
        size="sm"
        className="batch-primary-btn"
        onClick={onOpenReceipts}
      >
        {ready === 1
          ? t("batch.footer.openReceiptOne", { count: ready })
          : t("batch.footer.openReceipts", { count: ready })}
        <ArrowRight className="batch-btn-icon" aria-hidden="true" />
      </Button>
    ) : failed > 0 ? (
      <Button
        type="button"
        variant="accent"
        size="sm"
        className="batch-primary-btn"
        onClick={onRetryAll}
      >
        {t("batch.footer.retryFailed")}
        <RotateCcw className="batch-btn-icon" aria-hidden="true" />
      </Button>
    ) : null
  ) : allComplete ? (
    <Button
      type="button"
      variant="accent"
      size="sm"
      className="batch-primary-btn"
      onClick={onReview}
    >
      {t("batch.footer.reviewBatch")}
      <ClipboardList className="batch-btn-icon" aria-hidden="true" />
    </Button>
  ) : isProcessing && !isPaused ? (
    <Button
      type="button"
      variant="accent"
      size="sm"
      className="batch-primary-btn"
      onClick={onPause}
    >
      {t("batch.footer.pause")}
      <Pause className="batch-btn-icon" aria-hidden="true" />
    </Button>
  ) : (
    <Button
      type="button"
      variant="accent"
      size="sm"
      className="batch-primary-btn"
      onClick={onStart}
      disabled={queued === 0 && failed === 0}
    >
      {isPaused ? t("batch.footer.resume") : t("batch.footer.start")}
      <Play className="batch-btn-icon" aria-hidden="true" />
    </Button>
  );

  const secondary = isResults ? (
    <Button
      type="button"
      variant="accent-outline"
      size="sm"
      className="batch-secondary-btn"
      onClick={onUploadMore}
    >
      {t("batch.footer.uploadMore")}
    </Button>
  ) : (
    <Button
      type="button"
      variant="accent-outline"
      size="sm"
      className="batch-secondary-btn batch-add-btn"
      onClick={onAdd}
      disabled={addDisabled}
    >
      <Plus className="batch-btn-icon" aria-hidden="true" />
      <span className="batch-add-label">{t("batch.footer.add")}</span>
    </Button>
  );

  return (
    <footer className="batch-footer">
      <div className="batch-footer-meta">
        <p className="batch-micro">
          {batchName} · {batchDate} ·{" "}
          {fileCount === 1
            ? t("batch.footer.fileOne", { count: fileCount })
            : t("batch.footer.files", { count: fileCount })}
        </p>
        <p className="batch-footer-note">{note}</p>
      </div>

      <div className="batch-footer-progress" aria-hidden="true">
        <span className="mono">{percent}%</span>
        <span className="batch-micro">
          {etaText ||
            (isResults && failed > 0
              ? t("batch.footer.failedCount", { count: failed })
              : t("batch.footer.readyOfTotal", { ready, total }))}
        </span>
      </div>

      <div className="batch-footer-actions">
        {secondary}
        {primary}
      </div>
    </footer>
  );
}
