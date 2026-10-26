import type { DragEvent } from "react";

interface BatchTrayDropProps {
  isDragging: boolean;
  isCompressing: boolean;
  disabled: boolean;
  error: string | null;
  capacityUsed: number;
  batchLimit: number;
  onChoose: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export function BatchTrayDrop({
  isDragging,
  isCompressing,
  disabled,
  error,
  capacityUsed,
  batchLimit,
  onChoose,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: BatchTrayDropProps) {
  const heading = disabled
    ? "This batch is full"
    : isCompressing
      ? "Optimising your receipts"
      : isDragging
        ? "Drop them on the ledger"
        : "Lay the receipts on the ledger";

  const description = disabled
    ? "Post this batch or clear it to make room for more receipts."
    : isCompressing
      ? "We’re preparing the files before they join the queue."
      : isDragging
        ? "Release to add these receipts to the batch."
        : "One receipt per photo or PDF. We read the merchant, date and total, then post each one.";

  return (
    <div
      className="batch-empty"
      data-dragging={isDragging || undefined}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="batch-tray"
        data-dragging={isDragging || undefined}
        disabled={disabled || isCompressing}
        onClick={onChoose}
        aria-label="Choose receipt files. JPG, PNG or PDF, up to 5 MB each."
      >
        <svg
          className="batch-tray-art"
          viewBox="0 0 96 72"
          aria-hidden="true"
          fill="none"
        >
          <g opacity=".45" stroke="currentColor" strokeWidth="1.2">
            <rect x="18" y="16" width="38" height="48" rx="2" transform="rotate(-7 18 16)" />
            <path d="M28 28h18M28 35h18M28 42h12" transform="rotate(-7 18 16)" />
          </g>
          <g opacity=".7" stroke="currentColor" strokeWidth="1.2">
            <rect x="48" y="10" width="36" height="50" rx="2" transform="rotate(6 48 10)" />
            <path d="M57 23h17M57 30h17M57 37h11" transform="rotate(6 48 10)" />
          </g>
          <rect x="30" y="8" width="38" height="54" rx="2" fill="var(--ledger-surface)" stroke="currentColor" strokeWidth="1.2" />
          <path d="M40 24h18M40 31h18M40 38h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M40 49h18" stroke="var(--ledger-accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <span className="batch-tray-title">{heading}</span>
        <span className="batch-tray-copy">{description}</span>
        <span className="batch-tray-cta">
          {disabled ? "Batch full" : isCompressing ? "Optimising…" : "Choose receipts"}
        </span>
        <span className="batch-tray-note mono">
          {capacityUsed} of {batchLimit} used · JPG, PNG, PDF · 5 MB each
        </span>
      </button>

      {error && (
        <p className="batch-tray-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
