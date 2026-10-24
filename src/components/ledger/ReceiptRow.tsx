import { format, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
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
}

const formatRowDate = (value: string): string => {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM");
};

/** Single receipt line used by the overview and the receipts inbox. */
export function ReceiptRow({ receipt, onOpen, className }: ReceiptRowProps) {
  const { t } = useDashboardTranslation();
  const dateLabel = formatRowDate(receipt.date);
  const isReviewed = receipt.status === "reviewed";
  const statusLabel = (isReviewed
    ? t("workspace.status.approved")
    : t("workspace.status.review")) as string;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(receipt.id)}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-ledger-line px-[18px] py-[11px] text-left transition-colors first:border-t-0 hover:bg-ledger-surface-2 focus-visible:bg-ledger-surface-2 focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_84px_108px_104px_20px] md:gap-y-0",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-[11px]">
        <MonogramTile name={receipt.merchant} />
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-semibold leading-[1.35] text-ledger-ink">
            {receipt.merchant}
          </span>
          <span className="block truncate text-xs leading-[1.35] text-ledger-muted">
            {receipt.category}
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
    </button>
  );
}
