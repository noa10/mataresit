import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ledger/EmptyState";
import { ReceiptRow } from "@/components/ledger/ReceiptRow";
import { ReceiptDetailSheet } from "@/components/receipts/ReceiptDetailSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { fetchCategoriesForDisplay } from "@/services/categoryService";
import { fetchReceiptsPage, type ReceiptSortOrder } from "@/services/receiptService";
import type { WorkspaceReceiptSummary } from "@/services/dashboardSummaryService";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
type StatusFilter = "all" | "unreviewed" | "reviewed";

export default function ReceiptsPage() {
  const { t } = useDashboardTranslation();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { openModal } = useBackgroundUpload();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<ReceiptSortOrder>("newest");
  const [page, setPage] = useState(1);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const listKey = [
    "receipts",
    "inbox",
    currentTeam?.id ?? null,
    searchQuery,
    status,
    sortOrder,
    page,
  ] as const;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchReceiptsPage(
        {
          page,
          limit: PAGE_SIZE,
          searchQuery,
          status,
          sortOrder,
        },
        { currentTeam }
      ),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["displayCategories", currentTeam?.id],
    queryFn: () => fetchCategoriesForDisplay({ currentTeam }),
    enabled: Boolean(user),
  });

  const rows: WorkspaceReceiptSummary[] = useMemo(() => {
    return (data?.receipts ?? []).map((receipt) => {
      const category = receipt.custom_category_id
        ? categories.find((entry) => entry.id === receipt.custom_category_id)?.name
        : null;
      return {
        id: receipt.id,
        merchant: receipt.merchant || t("workspace.detail.unknown"),
        date: receipt.date,
        total: Number(receipt.total) || 0,
        currency: receipt.currency || "MYR",
        status: receipt.status,
        category: category || receipt.predicted_category || null,
        confidence: null,
      };
    });
  }, [data, categories, t]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const hasFilters = searchQuery.length > 0 || status !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatus("all");
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div>
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.receipts.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.receipts.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.receipts.lede")}
          </p>
        </div>
        <Button variant="accent" size="app" onClick={openModal}>
          <Upload className="mr-2 h-4 w-4" />
          {t("workspace.receipts.upload")}
        </Button>
      </header>

      <section className="mt-7 overflow-hidden rounded-[10px] border border-ledger-line bg-ledger-surface">
        <div className="flex flex-wrap items-end gap-3 border-b border-ledger-line px-[18px] py-3.5">
          <label className="grid min-w-0 flex-1 basis-[240px] gap-1.5">
            <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
              {t("workspace.receipts.search")}
            </span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-muted"
              />
              <input
                type="search"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("workspace.receipts.searchPlaceholder")}
                className="h-10 w-full rounded-[7px] border border-ledger-line-strong bg-ledger-surface pl-9 pr-3 text-sm text-ledger-ink placeholder:text-ledger-muted/80 focus:border-ledger-accent focus:outline-none focus:ring-[3px] focus:ring-ledger-accent/15"
              />
            </span>
          </label>

          <div className="grid gap-1.5">
            <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
              {t("workspace.receipts.status")}
            </span>
            <div className="inline-flex gap-[3px] rounded-[8px] border border-ledger-line bg-ledger-surface-2 p-[3px]">
              {(
                [
                  ["all", t("workspace.receipts.all")],
                  ["unreviewed", t("workspace.receipts.filterReview")],
                  ["reviewed", t("workspace.receipts.filterApproved")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => {
                    setStatus(value);
                    setPage(1);
                  }}
                  className={cn(
                    "min-h-[34px] rounded-[6px] px-[11px] text-[0.8125rem] font-medium transition-colors",
                    status === value
                      ? "bg-ledger-surface text-ledger-ink shadow-[0_1px_2px_rgba(18,23,21,0.08)]"
                      : "text-ledger-muted hover:text-ledger-ink"
                  )}
                >
                  {label}
                  {value === "all" && total > 0 && (
                    <span className="ml-1 font-data text-[0.6rem] tabular-nums opacity-60">
                      {total}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
              {t("workspace.receipts.sort")}
            </span>
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as ReceiptSortOrder);
                setPage(1);
              }}
              className="h-10 min-w-[150px] rounded-[7px] border border-ledger-line-strong bg-ledger-surface px-3 text-sm text-ledger-ink focus:border-ledger-accent focus:outline-none"
            >
              <option value="newest">{t("workspace.receipts.sortNewest")}</option>
              <option value="oldest">{t("workspace.receipts.sortOldest")}</option>
              <option value="highest">{t("workspace.receipts.sortHighest")}</option>
              <option value="lowest">{t("workspace.receipts.sortLowest")}</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-ledger-line px-[18px] py-3.5">
          <h2 className="text-[1rem] font-semibold text-ledger-ink">
            {t("workspace.receipts.listLabel")}
          </h2>
          <span className="font-data text-[0.6875rem] tracking-[0.04em] text-ledger-muted">
            {isFetching && !isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("workspace.receipts.showing", { count: rows.length, total })
            )}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-[57px] animate-pulse border-b border-ledger-line bg-ledger-surface-2/50 last:border-b-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? t("workspace.receipts.noResults") : t("workspace.receipts.emptyTitle")}
            description={
              hasFilters
                ? t("workspace.receipts.noResultsLede")
                : t("workspace.receipts.emptyDescription")
            }
            icon={<Search className="h-6 w-6" />}
            className="rounded-none border-0 bg-transparent py-14"
            action={
              hasFilters ? (
                <Button variant="accent-outline" size="app" onClick={clearFilters}>
                  {t("workspace.receipts.clearFilters")}
                </Button>
              ) : (
                <Button variant="accent" size="app" onClick={openModal}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("workspace.receipts.upload")}
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_84px_108px_104px_20px] gap-3 px-[18px] pb-2 pt-3 font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted md:grid">
              <span>{t("workspace.receipts.columns.merchant")}</span>
              <span>{t("workspace.receipts.columns.date")}</span>
              <span>{t("workspace.receipts.columns.status")}</span>
              <span className="text-right">{t("workspace.receipts.columns.amount")}</span>
              <span aria-hidden="true" />
            </div>
            <ul className="border-t border-ledger-line">
              {rows.map((receipt) => (
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-ledger-line px-[18px] py-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border border-ledger-line px-3 text-xs font-medium text-ledger-ink transition-colors hover:bg-ledger-surface-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("workspace.receipts.previous")}
            </button>
            <span className="font-data text-[0.65rem] text-ledger-muted">
              {t("workspace.receipts.pageOf", { page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={page >= totalPages}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border border-ledger-line px-3 text-xs font-medium text-ledger-ink transition-colors hover:bg-ledger-surface-2 disabled:opacity-40"
            >
              {t("workspace.receipts.next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      <ReceiptDetailSheet
        receiptId={selectedReceiptId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReceiptId(null);
            void refetch();
          }
        }}
      />
    </div>
  );
}
