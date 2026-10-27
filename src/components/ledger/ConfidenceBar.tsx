import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/receipts/confidence";
import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  /** Percentage 0–100, or null when the receipt has no confidence data. */
  value: number | null;
  className?: string;
  showLabel?: boolean;
}

/**
 * Field-match indicator. Green when above the review threshold, amber below.
 * When the receipt has no confidence data the bar is replaced by an em dash
 * instead of pretending the score is zero.
 */
export function ConfidenceBar({ value, className, showLabel = true }: ConfidenceBarProps) {
  const { t } = useDashboardTranslation();

  if (value === null) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-ledger-muted", className)}>
        <span className="h-1.5 w-16 rounded-full bg-ledger-line" aria-hidden="true" />
        <span>{t("workspace.confidence.noScore")}</span>
      </div>
    );
  }

  const tone = value >= REVIEW_CONFIDENCE_THRESHOLD ? "bg-ledger-accent" : "bg-ledger-amber";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-ledger-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={t("workspace.confidence.ariaLabel")}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      {showLabel && (
        <p className="font-data text-[0.62rem] uppercase tracking-[0.12em] text-ledger-muted">
          {t("workspace.confidence.fieldMatch", { value })}
        </p>
      )}
    </div>
  );
}
