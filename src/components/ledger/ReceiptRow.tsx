import { format, parseISO } from "date-fns";
import { Check, ChevronRight } from "lucide-react";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { MonogramTile } from "@/components/ledger/MonogramTile";
import { StatusChip } from "@/components/ledger/StatusChip";
import type { WorkspaceReceiptSummary } from "@/services/dashboardSummaryService";
import { formatCurrencySafe } from "@/utils/currency";
import { cn } from "@/lib/utils";

interface ReceiptRowProps {
  receipt: WorkspaceReceiptSummary;
  onOpen?: (id: string) => void;
  className?: string;
  /** Selection mode: a checkbox leads the row and clicks toggle instead of open. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, selected: boolean) => void;
}

const formatRowDate = (value: string): string => {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM");
};

/** Single receipt line used by the overview and the receipts inbox. */
export function ReceiptRow({
  receipt,
  onOpen,
  className,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ReceiptRowProps) {
  const { t } = useDashboardTranslation();
  const dateLabel = formatRowDate(receipt.date);
  const merchantLabel = receipt.merchant || t("workspace.detail.unknownMerchant");
  const categoryLabel = receipt.category || t("workspace.detail.uncategorized");

  const isReviewed = receipt.status === "reviewed";
  const statusLabel = (isReviewed
    ? t("workspace.status.approved")
    : t("workspace.status.review")) as string;

  return (
    <div
      role={selectable ? undefined : "button"}
      tabIndex={selectable ? undefined : 0}
      onClick={() => (selectable ? onToggleSelect?.(receipt.id, !selected) : onOpen?.(receipt.id))}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectable) onToggleSelect?.(receipt.id, !selected);
          else onOpen?.(receipt.id);
        }
      }}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-ledger-line px-[18px] py-[11px] text-left transition-colors first:border-t-0 hover:bg-ledger-surface-2 focus-visible:bg-ledger-surface-2 focus-visible:outline-none md:gap-y-0",
        selectable
          ? "md:grid-cols-[18px_minmax(0,1fr)_84px_108px_104px_20px]"
          : "md:grid-cols-[minmax(0,1fr)_84px_108px_104px_20px]",
        selectable && "cursor-pointer",
        selected && "bg-ledger-accent-soft/60",
        className
      )}
    >
      {selectable && (
        <span
          className={cn(
            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
            selected
              ? "border-ledger-accent bg-ledger-accent text-white"
              : "border-ledger-line-strong bg-ledger-surface"
          )}
          aria-hidden="true"
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      )}
      <span className="flex min-w-0 items-center gap-[11px]">
        <MonogramTile name={merchantLabel} />
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-semibold leading-[1.35] text-ledger-ink">
            {merchantLabel}
          </span>
          <span className="block truncate text-xs leading-[1.35] text-ledger-muted">
            {categoryLabel}
          </span>
        </span>
      </span>

      <span className="hidden font-data text-xs tabular-nums text-ledger-muted md:block">
        {dateLabel}
      </span>

      <span className="hidden md:block">
        <StatusChip
          tone={isReviewed ? "reviewed" : "unreviewed"}
          label={statusLabel}
        />
      </span>

      <span className="text-right font-data text-[0.8125rem] font-medium tabular-nums text-ledger-ink">
        {formatCurrencySafe(receipt.total, receipt.currency)}
      </span>

      <ChevronRight
        aria-hidden="true"
        className="hidden h-4 w-4 justify-self-end text-ledger-line-strong transition-colors md:block"
      />

      <span className="col-span-2 flex items-center gap-2 md:hidden">
        <StatusChip
          tone={isReviewed ? "reviewed" : "unreviewed"}
          label={statusLabel}
        />
        <span className="font-data text-[0.65rem] uppercase tracking-[0.1em] text-ledger-muted">
          {dateLabel}
        </span>
      </span>
    </div>
  );
}
