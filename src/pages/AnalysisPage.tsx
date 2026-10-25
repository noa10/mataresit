import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AnalysisAdvancedView from "./AnalysisAdvancedPage";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
} from "date-fns";
import { BarChart3, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ledger/EmptyState";
import { KpiCard } from "@/components/ledger/KpiCard";
import { Panel } from "@/components/ledger/Panel";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { useDashboardTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { fetchUserPayers } from "@/services/paidByService";
import {
  fetchDailyExpenses,
  fetchExpensesByCategory,
  fetchReceiptDetailsForRange,
} from "@/services/supabase/analysis";
import type { ReceiptSummary } from "@/services/supabase/analysis";
import type { PaidBy } from "@/types/receipt";
import { cn } from "@/lib/utils";
import { formatCurrencySafe } from "@/utils/currency";

type RangeKey = "month" | "last30" | "quarter" | "year";

const RANGE_ORDER: RangeKey[] = ["month", "last30", "quarter", "year"];
const CURRENCY = "MYR";
const LOCALE_BY_LANGUAGE = {
  en: "en-MY",
  ms: "ms-MY",
} as const;

const getLocale = (language: string) => LOCALE_BY_LANGUAGE[language as keyof typeof LOCALE_BY_LANGUAGE] ?? "en-MY";

const monthName = (date: Date, language: string) => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), { month: "long", year: "numeric" }).format(date);
  } catch {
    return format(date, "MMMM yyyy");
  }
};

const shortMonth = (date: Date, language: string) => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), { month: "short" }).format(date);
  } catch {
    return format(date, "MMM");
  }
};

const dayLabel = (date: Date, language: string) => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), { day: "numeric", month: "short" }).format(date);
  } catch {
    return format(date, "d MMM");
  }
};

interface TrendPoint {
  key: string;
  label: string;
  caption: string;
  total: number;
}

function AnalysisSkeleton() {
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
      <div className="h-[240px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-[250px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
        <div className="h-[250px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const { currentTeam } = useTeam();
  const { openModal } = useBackgroundUpload();
  const [range, setRange] = useState<RangeKey>("month");

  const rangeConfig = useMemo(() => {
    const today = new Date();
    const end = endOfDay(today);
    switch (range) {
      case "last30":
        return { start: startOfDay(subDays(today, 29)), end, label: t("workspace.analysis.rangeLast30") };
      case "quarter":
        return {
          start: startOfQuarter(today),
          end,
          label: `${format(today, "QQQ")} ${format(today, "yyyy")}`,
        };
      case "year":
        return { start: startOfYear(today), end, label: format(today, "yyyy") };
      case "month":
      default:
        return { start: startOfMonth(today), end, label: monthName(today, language) };
    }
  }, [range, t, language]);

  const startISO = format(rangeConfig.start, "yyyy-MM-dd");
  const endISO = format(rangeConfig.end, "yyyy-MM-dd");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["workspace", "analysis", currentTeam?.id ?? null, startISO, endISO],
    queryFn: async () => {
      const [daily, categories, receipts, payers] = await Promise.all([
        fetchDailyExpenses(startISO, endISO, currentTeam?.id ?? null),
        fetchExpensesByCategory(startISO, endISO, currentTeam?.id ?? null),
        fetchReceiptDetailsForRange(startISO, endISO, currentTeam?.id ?? null),
        fetchUserPayers({ currentTeam: currentTeam ?? null }),
      ]);
      return { daily, categories, receipts, payers };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const receipts: ReceiptSummary[] = useMemo(() => data?.receipts ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const payers: PaidBy[] = useMemo(() => data?.payers ?? [], [data]);
  const daily = useMemo(() => data?.daily ?? [], [data]);

  const totals = useMemo(() => {
    const totalSpend = receipts.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0);
    const totalTax = receipts.reduce((sum, receipt) => sum + (Number(receipt.tax) || 0), 0);
    const receiptCount = receipts.length;
    return {
      totalSpend,
      totalTax,
      receiptCount,
      average: receiptCount > 0 ? totalSpend / receiptCount : 0,
    };
  }, [receipts]);

  const categoryRows = useMemo(() => {
    return [...categories]
      .map((entry) => ({
        key: entry.category ?? "__unassigned__",
        label: entry.category?.trim() || t("workspace.analysis.unassigned"),
        total: Number(entry.total_spent) || 0,
      }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [categories, t]);

  const topCategory = categoryRows[0];
  const topCategoryShare =
    topCategory && totals.totalSpend > 0
      ? Math.round((topCategory.total / totals.totalSpend) * 100)
      : 0;

  const payerRows = useMemo(() => {
    const byPayer = new Map<string, number>();
    for (const receipt of receipts) {
      const key = receipt.paid_by_id || "__unassigned__";
      byPayer.set(key, (byPayer.get(key) ?? 0) + (Number(receipt.total) || 0));
    }
    const names = new Map(payers.map((payer) => [payer.id, payer.name]));
    return [...byPayer.entries()]
      .map(([key, total]) => ({
        key,
        label:
          key === "__unassigned__"
            ? t("workspace.analysis.unassigned")
            : names.get(key) || t("workspace.analysis.unassigned"),
        total,
      }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [receipts, payers, t]);

  const isMonthlyTrend = range === "quarter" || range === "year";

  const trend = useMemo<TrendPoint[]>(() => {
    const totalsByDay = new Map<string, number>();
    for (const entry of daily) {
      totalsByDay.set(entry.date, (totalsByDay.get(entry.date) ?? 0) + (Number(entry.total) || 0));
    }

    if (isMonthlyTrend) {
      const months = eachMonthOfInterval({ start: rangeConfig.start, end: rangeConfig.end });
      return months.map((month) => {
        const key = format(month, "yyyy-MM");
        let total = 0;
        for (const [date, value] of totalsByDay.entries()) {
          if (date.startsWith(key)) total += value;
        }
        return {
          key,
          label: shortMonth(month, language),
          caption: shortMonth(month, language),
          total,
        };
      });
    }

    const days = eachDayOfInterval({ start: rangeConfig.start, end: rangeConfig.end });
    const every = days.length > 16 ? 5 : days.length > 10 ? 2 : 1;
    return days.map((day, index) => {
      const key = format(day, "yyyy-MM-dd");
      const label =
        range === "month"
          ? index % every === 0 || index === days.length - 1
            ? format(day, "d")
            : ""
          : index % every === 0 || index === days.length - 1
            ? dayLabel(day, language)
            : "";
      return {
        key,
        label,
        caption: dayLabel(day, language),
        total: totalsByDay.get(key) ?? 0,
      };
    });
  }, [daily, isMonthlyTrend, range, rangeConfig, language]);

  const trendMax = Math.max(...trend.map((point) => point.total), 0);
  const trendPeakKey = trend.find((point) => point.total === trendMax && trendMax > 0)?.key;
  const rangeCaption = `${dayLabel(rangeConfig.start, language)} – ${dayLabel(rangeConfig.end, language)}, ${format(rangeConfig.end, "yyyy")}`;

  const handleExport = () => {
    if (receipts.length === 0) return;
    const names = new Map(payers.map((payer) => [payer.id, payer.name]));
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Merchant", "Total", "Tax", "Payer"],
      ...receipts.map((receipt) => [
        receipt.date,
        receipt.merchant ?? "",
        (Number(receipt.total) || 0).toFixed(2),
        (Number(receipt.tax) || 0).toFixed(2),
        receipt.paid_by_id ? names.get(receipt.paid_by_id) ?? "" : "",
      ]),
    ];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mataresit-analysis-${startISO}-to-${endISO}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const kpiValueClass = "text-[1.625rem]";

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.analysis.eyebrow", { range: rangeConfig.label })}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.analysis.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.analysis.lede")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="accent"
            size="app"
            onClick={handleExport}
            disabled={receipts.length === 0}
            title={receipts.length === 0 ? t("workspace.analysis.exportEmpty") : undefined}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("workspace.analysis.exportCsv")}
          </Button>
        </div>
      </header>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="group"
        aria-label={t("workspace.analysis.dateRange")}
      >
        {RANGE_ORDER.map((key) => {
          const active = key === range;
          const labels: Record<RangeKey, string> = {
            month: t("workspace.analysis.rangeThisMonth"),
            last30: t("workspace.analysis.rangeLast30"),
            quarter: t("workspace.analysis.rangeQuarter"),
            year: t("workspace.analysis.rangeYear"),
          };
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setRange(key)}
              className={cn(
                "rounded-full border px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] transition-colors",
                active
                  ? "border-ledger-ink bg-ledger-ink text-ledger-paper"
                  : "border-ledger-line-strong text-ledger-ink-2 hover:border-ledger-accent hover:text-ledger-accent"
              )}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {isLoading ? (
          <AnalysisSkeleton />
        ) : isError ? (
          <Panel title={t("workspace.analysis.title")}>
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="text-sm text-ledger-muted">{t("workspace.analysis.noSpendLede")}</p>
              <Button variant="accent-outline" size="app" onClick={() => refetch()}>
                {t("workspace.analysis.retry")}
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label={t("workspace.analysis.totalSpend")}
                value={formatCurrencySafe(totals.totalSpend, CURRENCY)}
                meta={rangeConfig.label}
                valueClassName={kpiValueClass}
              />
              <KpiCard
                label={t("workspace.analysis.avgReceipt")}
                value={formatCurrencySafe(totals.average, CURRENCY)}
                meta={t("workspace.analysis.acrossReceipts", { count: totals.receiptCount })}
                valueClassName={kpiValueClass}
              />
              <KpiCard
                label={t("workspace.analysis.salesTax")}
                value={formatCurrencySafe(totals.totalTax, CURRENCY)}
                meta={t("workspace.analysis.recordedPerLine")}
                valueClassName={kpiValueClass}
              />
              <KpiCard
                label={t("workspace.analysis.topCategory")}
                value={topCategory?.label ?? "—"}
                meta={
                  topCategory
                    ? t("workspace.analysis.shareOfSpend", { percent: topCategoryShare })
                    : t("workspace.analysis.noSpend")
                }
                valueClassName="mt-2 truncate text-[1.35rem]"
              />
            </div>

            {totals.receiptCount === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<BarChart3 className="h-7 w-7" />}
                  title={t("workspace.analysis.noSpend")}
                  description={t("workspace.analysis.noSpendLede")}
                  action={
                    <Button variant="accent" size="app" onClick={openModal}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("workspace.overview.upload")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <Panel
                  className="mt-4"
                  title={
                    isMonthlyTrend
                      ? t("workspace.analysis.monthlyTrend")
                      : t("workspace.analysis.dailyTrend")
                  }
                  action={<span className="font-data text-[0.625rem] text-ledger-muted">{rangeCaption}</span>}
                >
                  <div
                    className="flex h-[150px] items-end gap-1"
                    role="img"
                    aria-label={`${isMonthlyTrend ? t("workspace.analysis.monthlyTrend") : t("workspace.analysis.dailyTrend")} — ${rangeCaption}`}
                  >
                    {trend.map((point) => {
                      const height = trendMax > 0 ? Math.max((point.total / trendMax) * 100, 1.5) : 1.5;
                      const peak = point.key === trendPeakKey;
                      return (
                        <div
                          key={point.key}
                          className="grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] gap-2"
                          title={`${point.caption} · ${formatCurrencySafe(point.total, CURRENCY)}`}
                        >
                          <div className="flex items-end">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "block w-full rounded-t-[4px]",
                                peak ? "bg-ledger-accent" : "bg-ledger-chart-3"
                              )}
                              style={{ height: `${height}%`, minHeight: 3 }}
                            />
                          </div>
                          <span className="truncate text-center font-data text-[0.5625rem] text-ledger-muted">
                            {point.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <Panel
                    title={t("workspace.analysis.categories")}
                    action={<span className="font-data text-[0.625rem] text-ledger-muted">{rangeConfig.label}</span>}
                  >
                    {categoryRows.length === 0 ? (
                      <p className="py-6 text-center text-sm text-ledger-muted">
                        {t("workspace.analysis.noSpend")}
                      </p>
                    ) : (
                      <div className="grid gap-2.5">
                        {categoryRows.slice(0, 6).map((row) => {
                          const max = categoryRows[0]?.total || 1;
                          return (
                            <div
                              key={row.key}
                              className="grid grid-cols-[128px_1fr_84px] items-center gap-3.5 max-sm:grid-cols-[92px_1fr_74px] max-sm:gap-2.5"
                            >
                              <span className="truncate text-sm text-ledger-ink-2">{row.label}</span>
                              <span className="h-2 overflow-hidden rounded-[4px] bg-ledger-surface-2">
                                <i
                                  className="block h-full rounded-[4px] bg-ledger-accent"
                                  style={{ width: `${Math.max((row.total / max) * 100, 2)}%` }}
                                />
                              </span>
                              <span className="text-right font-data text-[0.6875rem] text-ledger-ink">
                                {formatCurrencySafe(row.total, CURRENCY)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title={t("workspace.analysis.payers")}
                    action={
                      <span className="font-data text-[0.625rem] text-ledger-muted">
                        {t("workspace.analysis.payerMeta")}
                      </span>
                    }
                  >
                    {payerRows.length === 0 ? (
                      <p className="py-6 text-center text-sm text-ledger-muted">
                        {t("workspace.analysis.noSpend")}
                      </p>
                    ) : (
                      <div className="grid gap-2.5">
                        {payerRows.map((row) => {
                          const max = payerRows[0]?.total || 1;
                          return (
                            <div
                              key={row.key}
                              className="grid grid-cols-[128px_1fr_84px] items-center gap-3.5 max-sm:grid-cols-[92px_1fr_74px] max-sm:gap-2.5"
                            >
                              <span className="truncate text-sm text-ledger-ink-2">{row.label}</span>
                              <span className="h-2 overflow-hidden rounded-[4px] bg-ledger-surface-2">
                                <i
                                  className="block h-full rounded-[4px] bg-ledger-accent"
                                  style={{ width: `${Math.max((row.total / max) * 100, 2)}%` }}
                                />
                              </span>
                              <span className="text-right font-data text-[0.6875rem] text-ledger-ink">
                                {formatCurrencySafe(row.total, CURRENCY)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Deep dive: the former /analysis/advanced view — daily trends, category
          charts and the per-day expense table with receipt drill-down. */}
      <section className="mt-10">
        <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
          {t("workspace.analysis.deepDive", { defaultValue: "Deep dive" })}
        </p>
        <div className="mt-3">
          <AnalysisAdvancedView embedded />
        </div>
      </section>
    </div>
  );
}
