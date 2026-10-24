import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardCheck, Upload } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConfidenceBar } from "@/components/ledger/ConfidenceBar";
import { EmptyState } from "@/components/ledger/EmptyState";
import { KpiCard } from "@/components/ledger/KpiCard";
import { MonogramTile } from "@/components/ledger/MonogramTile";
import { Panel } from "@/components/ledger/Panel";
import { ReceiptRow } from "@/components/ledger/ReceiptRow";
import { SpendDonut } from "@/components/ledger/SpendDonut";
import { ReceiptDetailSheet } from "@/components/receipts/ReceiptDetailSheet";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { useDashboardTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatCurrencySafe } from "@/utils/currency";

const monthLabel = (isoDate: string | undefined, language: string): string => {
  const date = isoDate ? parseISO(isoDate) : new Date();
  const locale = language === "ms" ? "ms-MY" : "en-MY";
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
  } catch {
    return format(date, "MMMM yyyy");
  }
};

function SummarySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[118px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.08fr_1fr]">
        <div className="h-[260px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
        <div className="h-[260px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const { openModal } = useBackgroundUpload();
  const location = useLocation();
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();

  // Old dashboard deep links carried filters in the query string. Send them to
  // the receipts inbox so bookmarks keep working after the route split.
  const hasLegacyReceiptParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return ["q", "tab", "currency", "category", "sort", "page", "limit", "from", "to", "view"].some(
      (key) => params.has(key)
    );
  }, [location.search]);

  if (hasLegacyReceiptParams) {
    return <Navigate to={`/receipts${location.search}`} replace />;
  }

  const periodLabel = monthLabel(summary?.period.from, language);
  const totalSpend = summary?.totalSpend ?? 0;
  const currency = summary?.primaryCurrency ?? "MYR";
  const receiptCount = summary?.receiptCount ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const totalTax = summary?.totalTax ?? 0;
  const categories = summary?.categories ?? [];
  const recent = summary?.recent ?? [];
  const reviewPreview = summary?.reviewPreview ?? [];
  const otherCurrencyCount = summary?.otherCurrencyCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.overview.eyebrow", { month: periodLabel, count: receiptCount })}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.overview.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.overview.lede")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/review">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {t("workspace.overview.reviewQueue")}
            </Link>
          </Button>
          <Button variant="accent" size="app" onClick={openModal}>
            <Upload className="mr-2 h-4 w-4" />
            {t("workspace.overview.upload")}
          </Button>
        </div>
      </header>

      <div className="mt-7">
        {isLoading ? (
          <SummarySkeleton />
        ) : isError ? (
          <Panel title={t("workspace.overview.title")}>
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="text-sm text-ledger-muted">
                {t("workspace.overview.loadError")}
              </p>
              <Button variant="accent-outline" size="app" onClick={() => refetch()}>
                {t("workspace.overview.tryAgain")}
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label={t("workspace.overview.kpi.spend")}
                value={formatCurrencySafe(totalSpend, currency)}
                meta={t("workspace.overview.kpiMeta.spend", { count: receiptCount })}
              />
              <KpiCard
                label={t("workspace.overview.kpi.receipts")}
                value={receiptCount}
                meta={t("workspace.overview.kpiMeta.receipts")}
              />
              <KpiCard
                label={t("workspace.overview.kpi.review")}
                value={reviewCount}
                tone={reviewCount > 0 ? "amber" : "default"}
                meta={t("workspace.overview.kpiMeta.review")}
              />
              <KpiCard
                label={t("workspace.overview.kpi.tax")}
                value={formatCurrencySafe(totalTax, currency)}
                meta={t("workspace.overview.kpiMeta.tax")}
              />
            </div>

            {otherCurrencyCount > 0 && (
              <p className="mt-2 font-data text-[0.62rem] uppercase tracking-[0.12em] text-ledger-muted">
                {t("workspace.overview.otherCurrencies", { count: otherCurrencyCount })}
              </p>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_1fr]">
              <Panel
                title={t("workspace.overview.categories")}
                action={
                  <span className="font-data text-[0.68rem] uppercase tracking-[0.04em] text-ledger-muted">
                    {periodLabel}
                  </span>
                }
              >
                <SpendDonut data={categories} currency={currency} total={totalSpend} />
              </Panel>

              <Panel
                title={t("workspace.overview.reviewPreview")}
                action={
                  <Link
                    to="/review"
                    className="text-[0.8125rem] font-semibold text-ledger-accent hover:underline"
                  >
                    {t("workspace.overview.openQueue")}
                  </Link>
                }
                flush
              >
                {reviewPreview.length === 0 ? (
                  <div className="px-5 pb-4">
                    <EmptyState
                      title={t("workspace.overview.allCaughtUp")}
                      description={t("workspace.overview.allCaughtUpLede")}
                      icon={<ClipboardCheck className="h-6 w-6" />}
                      className="border-0 bg-transparent py-8"
                    />
                  </div>
                ) : (
                  <ul>
                    {reviewPreview.map((receipt) => (
                      <li key={receipt.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptId(receipt.id)}
                          className="flex w-full items-center gap-3 border-t border-ledger-line px-5 py-3.5 text-left transition-colors first:border-t-0 hover:bg-ledger-surface-2"
                        >
                          <MonogramTile name={receipt.merchant} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.95rem] font-medium text-ledger-ink">
                              {receipt.merchant}
                            </span>
                            <ConfidenceBar
                              value={receipt.confidence}
                              showLabel={false}
                              className="mt-1.5"
                            />
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-data text-sm tabular-nums text-ledger-ink">
                              {formatCurrencySafe(receipt.total, receipt.currency)}
                            </span>
                            <span className="mt-1 block font-data text-[0.6rem] uppercase tracking-[0.1em] text-ledger-amber">
                              {receipt.confidence === null
                                ? t("workspace.review.noConfidence")
                                : `${receipt.confidence}%`}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="mt-4">
              <Panel
                title={t("workspace.overview.recent")}
                action={
                  <Link
                    to="/receipts"
                    className="text-[0.8125rem] font-semibold text-ledger-accent hover:underline"
                  >
                    {t("workspace.overview.viewAll")}
                  </Link>
                }
                flush
              >
                {recent.length === 0 ? (
                  <div className="px-5 pb-4">
                    <EmptyState
                      title={t("workspace.receipts.emptyTitle")}
                      description={t("workspace.receipts.emptyDescription")}
                      action={
                        <Button variant="accent" size="app" onClick={openModal}>
                          <Upload className="mr-2 h-4 w-4" />
                          {t("workspace.receipts.upload")}
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  </div>
                ) : (
                  <>
                    <div className="hidden grid-cols-[minmax(0,1fr)_84px_108px_104px_20px] gap-3 px-[18px] pb-2 pt-3 font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted md:grid">
                      <span>{t("workspace.receipts.columns.merchant")}</span>
                      <span>{t("workspace.receipts.columns.date")}</span>
                      <span>{t("workspace.receipts.columns.status")}</span>
                      <span className="text-right">{t("workspace.receipts.columns.amount")}</span>
                      <span aria-hidden="true" />
                    </div>
                    <ul>
                      {recent.map((receipt) => (
                        <li key={receipt.id}>
                          <ReceiptRow
                            receipt={receipt}
                            onOpen={(id) => setSelectedReceiptId(id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>

      <ReceiptDetailSheet
        receiptId={selectedReceiptId}
        onOpenChange={(open) => {
          if (!open) setSelectedReceiptId(null);
        }}
      />
    </div>
  );
}
