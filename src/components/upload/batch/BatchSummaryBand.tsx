import { CategorySelector } from "@/components/categories/CategorySelector";
import { formatFileSize } from "./utils";
import { BatchSettingsPopover } from "./BatchSettingsPopover";

interface BatchSummaryBandProps {
  batchName: string;
  batchDate: string;
  fileCount: number;
  capacityUsed: number;
  batchLimit: number;
  totalBytes: number;
  tierLabel: string;
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  categoryDisabled?: boolean;
  maxConcurrent: number;
  autoStart: boolean;
  timeoutSeconds: number;
  onOpenSettings: () => void;
}

export function BatchSummaryBand({
  batchName,
  batchDate,
  fileCount,
  capacityUsed,
  batchLimit,
  totalBytes,
  tierLabel,
  selectedCategoryId,
  onCategoryChange,
  categoryDisabled = false,
  maxConcurrent,
  autoStart,
  timeoutSeconds,
  onOpenSettings,
}: BatchSummaryBandProps) {
  const safeLimit = Math.max(1, batchLimit);
  const fill = Math.min(1, Math.max(0, capacityUsed / safeLimit));

  return (
    <section className="batch-summary" aria-label="Batch summary">
      <div className="batch-sum-cell batch-sum-batch">
        <span className="batch-micro">Batch</span>
        <span className="batch-sum-value" title={batchName}>
          {batchName}
        </span>
        <span className="batch-sum-sub mono">
          {batchDate} · {fileCount} files
        </span>
      </div>

      <div className="batch-sum-cell batch-sum-cap">
        <span className="batch-micro">Capacity · {tierLabel}</span>
        <span className="batch-sum-value">
          {capacityUsed} <span className="batch-sum-of">of {safeLimit}</span>
        </span>
        <span className="batch-cap-meter" aria-hidden="true">
          <i style={{ transform: `scaleX(${fill})` }} />
        </span>
      </div>

      <div className="batch-sum-cell batch-sum-size">
        <span className="batch-micro">Batch size</span>
        <span className="batch-sum-value mono">{formatFileSize(totalBytes)}</span>
      </div>

      <div className="batch-sum-cell batch-sum-cat">
        <span className="batch-micro">Category</span>
        <CategorySelector
          compact
          value={selectedCategoryId}
          onChange={onCategoryChange}
          placeholder="Uncategorised"
          disabled={categoryDisabled}
          className="batch-category-select"
        />
      </div>

      <div className="batch-sum-cell batch-sum-settings">
        <span className="batch-micro">Batch settings</span>
        <BatchSettingsPopover
          maxConcurrent={maxConcurrent}
          autoStart={autoStart}
          timeoutSeconds={timeoutSeconds}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </section>
  );
}
