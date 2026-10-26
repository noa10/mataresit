import {
  ArrowRight,
  ClipboardList,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";

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
  const isResults = mode === "results";
  const addDisabled = atCapacity || isCompressing;

  const note = isResults
    ? failed > 0
      ? "Failed receipts stay in this batch until they post."
      : "Every receipt in this batch is posted."
    : isProcessing
      ? "Uploads keep running if you close this sheet."
      : allComplete
        ? "Review the batch before opening the receipts."
        : "Images are optimised before upload.";

  const primary = isResults ? (
    ready > 0 ? (
      <Button
        type="button"
        variant="accent"
        size="sm"
        className="batch-primary-btn"
        onClick={onOpenReceipts}
      >
        Open {ready} receipt{ready === 1 ? "" : "s"}
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
        Retry failed
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
      Review batch
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
      Pause uploads
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
      {isPaused ? "Resume uploads" : "Start processing"}
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
      Upload more
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
      <span className="batch-add-label">Add receipts</span>
    </Button>
  );

  return (
    <footer className="batch-footer">
      <div className="batch-footer-meta">
        <p className="batch-micro">
          {batchName} · {batchDate} · {fileCount} file{fileCount === 1 ? "" : "s"}
        </p>
        <p className="batch-footer-note">{note}</p>
      </div>

      <div className="batch-footer-progress" aria-hidden="true">
        <span className="mono">{percent}%</span>
        <span className="batch-micro">
          {etaText ||
            (isResults && failed > 0
              ? `${failed} failed`
              : `${ready} of ${total} ready`)}
        </span>
      </div>

      <div className="batch-footer-actions">
        {secondary}
        {primary}
      </div>
    </footer>
  );
}
