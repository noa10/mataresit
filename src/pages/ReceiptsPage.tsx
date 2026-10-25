import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Loader2, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Panel } from "@/components/ledger/Panel";
import { ReceiptRow } from "@/components/ledger/ReceiptRow";
import { ReceiptDetailSheet } from "@/components/receipts/ReceiptDetailSheet";
import { ReceiptFiltersSheet } from "@/components/dashboard/ReceiptFiltersSheet";
import { DuplicateDetectionPanel } from "@/components/dashboard/DuplicateDetectionPanel";
import { ExportDropdown } from "@/components/export/ExportDropdown";
import type { ExportFilters } from "@/lib/export";
import { useAuth } from "@/contexts/AuthContext";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { fetchCategoriesForDisplay } from "@/services/categoryService";
import { fetchUserPayers } from "@/services/paidByService";
import {
  deleteReceipt,
  fetchReceiptCurrencies,
  fetchReceiptsPage,
  updateReceiptStatus,
  type ReceiptSortOrder,
} from "@/services/receiptService";
import type { Receipt, ReceiptStatus } from "@/types/receipt";
import type { WorkspaceReceiptSummary } from "@/services/dashboardSummaryService";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
type StatusFilter = "all" | "unreviewed" | "reviewed";

type ReceiptFiltersState = {
  currency: string | null;
  categoryId: string | null;
  paidById: string | null;
  processingStatus: string | null;
};

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filters, setFilters] = useState<ReceiptFiltersState>({
    currency: null,
    categoryId: null,
    paidById: null,
    processingStatus: null,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const duplicateRef = useRef<HTMLElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const fromDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
  const toDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;
  const activeFilterCount =
    (dateRange?.from ? 1 : 0) +
    (filters.currency ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.paidById ? 1 : 0) +
    (filters.processingStatus ? 1 : 0);

  const toggleSelect = (id: string, next: boolean) => {
    setSelectedIds((current) => {
      const nextSet = new Set(current);
      if (next) nextSet.add(id);
      else nextSet.delete(id);
      return nextSet;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

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
    fromDate,
    toDate,
    filters.currency,
    filters.categoryId,
    filters.paidById,
    filters.processingStatus,
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
          fromDate,
          toDate,
          currency: filters.currency,
          categoryId: filters.categoryId,
          paidById: filters.paidById,
          reprocessingPreset:
            filters.processingStatus === "all" || !filters.processingStatus
              ? null
              : filters.processingStatus === "failed_ai"
                ? "failed_ai"
                : filters.processingStatus === "no_data"
                  ? "no_data"
                  : "needs_reprocessing",
        },
        { currentTeam }
      ),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ["receiptCurrencies", currentTeam?.id ?? null],
    queryFn: () => fetchReceiptCurrencies({ currentTeam }),
    enabled: Boolean(user),
  });

  const { data: payers = [] } = useQuery({
    queryKey: ["payers", currentTeam?.id ?? null],
    queryFn: () => fetchUserPayers({ currentTeam }),
    enabled: Boolean(user),
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
  const hasFilters =
    searchQuery.length > 0 || status !== "all" || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatus("all");
    setPage(1);
  };

  const resetAllFilters = () => {
    clearFilters();
    setDateRange(undefined);
    setFilters({ currency: null, categoryId: null, paidById: null, processingStatus: null });
    setPage(1);
  };

  // Drop selections that are no longer in the current result set.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visible = new Set((data?.receipts ?? []).map((receipt) => receipt.id));
    const pruned = [...selectedIds].filter((id) => visible.has(id));
    if (pruned.length !== selectedIds.size) setSelectedIds(new Set(pruned));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const bulkMutation = useMutation({
    mutationFn: async ({ action }: { action: "review" | "delete" }) => {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map((id) =>
          action === "review"
            ? updateReceiptStatus(id, "reviewed" satisfies ReceiptStatus, { silent: true })
            : deleteReceipt(id)
        )
      );
      const successes = results.filter(
        (result) => result.status === "fulfilled" && result.value === true
      ).length;
      return { action, successes, failures: ids.length - successes };
    },
    onSuccess: async ({ action, successes, failures }) => {
      if (successes > 0) {
        toast.success(
          action === "review"
            ? t("workspace.receipts.bulkApprovedToast", { count: successes })
            : t("workspace.receipts.bulkDeletedToast", { count: successes })
        );
      }
      if (failures > 0) {
        toast.error(t("workspace.receipts.bulkFailedToast", { count: failures }));
      }
      exitSelectionMode();
      await queryClient.invalidateQueries({ queryKey: ["receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["receipt-counts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

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

        {/* Tools row: selection, date range, filters, export. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ledger-line px-[18px] py-3">
          <Button
            variant={selectionMode ? "accent" : "accent-outline"}
            size="sm"
            className="h-9 rounded-[7px] border-ledger-line-strong font-medium text-ledger-ink data-[variant=accent]:text-white"
            onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
          >
            {selectionMode ? <X className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {selectionMode ? t("workspace.receipts.cancel") : t("workspace.receipts.select")}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="accent-outline"
                size="sm"
                className="h-9 rounded-[7px] border-ledger-line-strong font-medium text-ledger-ink"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM")}`
                    : format(dateRange.from, "d MMM")
                  : t("filters.dateRange")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setPage(1);
                }}
                defaultMonth={dateRange?.from}
              />
              {dateRange?.from && (
                <div className="flex justify-end border-t border-ledger-line p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateRange(undefined);
                      setPage(1);
                    }}
                  >
                    {t("workspace.receipts.clearRange")}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="accent-outline"
            size="sm"
            className="h-9 rounded-[7px] border-ledger-line-strong font-medium text-ledger-ink"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {t("workspace.receipts.filters")}
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-ledger-accent px-1.5 font-data text-[0.6rem] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <Button
            variant="accent-outline"
            size="sm"
            className="h-9 rounded-[7px] border-ledger-line-strong font-medium text-ledger-ink"
            onClick={() => {
              setDupOpen(true);
              requestAnimationFrame(() => {
                duplicateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t("workspace.receipts.duplicateDetection")}
            {dupOpen && (
              <span aria-hidden="true" className="ml-2 h-1.5 w-1.5 rounded-full bg-ledger-accent" />
            )}
          </Button>

          <ExportDropdown
            receipts={(data?.receipts ?? []) as Receipt[]}
            filters={{
              searchQuery: searchQuery || undefined,
              activeTab: status,
              filterByCurrency: filters.currency ?? undefined,
              filterByCategory: filters.categoryId ?? undefined,
              filterByPayer: filters.paidById ?? undefined,
              sortOrder,
              dateRange: dateRange?.from
                ? { from: dateRange.from, to: dateRange.to }
                : undefined,
            }}
            totalCount={total}
            getReceiptsForExport={async () => {
              const all: Receipt[] = [];
              let cursor = 1;
              for (let guard = 0; guard < 40; guard += 1) {
                const result = await fetchReceiptsPage(
                  {
                    page: cursor,
                    limit: 100,
                    searchQuery,
                    status,
                    sortOrder,
                    fromDate,
                    toDate,
                    currency: filters.currency,
                    categoryId: filters.categoryId,
                    paidById: filters.paidById,
                  },
                  { currentTeam }
                );
                all.push(...(result.receipts as Receipt[]));
                if (!result.hasNextPage || result.receipts.length === 0) break;
                cursor += 1;
              }
              return all;
            }}
          />
        </div>

        {/* Bulk actions bar for selection mode. */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-ledger-line bg-ledger-accent-soft/60 px-[18px] py-2.5">
            <span className="font-data text-xs text-ledger-ink">
              {t("workspace.receipts.selectedCount", { count: selectedIds.size })}
            </span>
            <span className="flex-1" />
            <Button
              variant="accent-outline"
              size="sm"
              className="h-8 border-ledger-line-strong bg-ledger-surface"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ action: "review" })}
            >
              {bulkMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t("workspace.receipts.bulkApprove")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-ledger-danger/40 text-ledger-danger hover:bg-ledger-danger-soft"
              disabled={bulkMutation.isPending}
              onClick={() => {
                if (window.confirm(t("workspace.receipts.bulkDeleteConfirm"))) {
                  bulkMutation.mutate({ action: "delete" });
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("workspace.receipts.bulkDelete")}
            </Button>
          </div>
        )}

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
                <Button variant="accent-outline" size="app" onClick={resetAllFilters}>
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
                    selectable={selectionMode}
                    selected={selectedIds.has(receipt.id)}
                    onToggleSelect={toggleSelect}
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

      {/* Duplicate detection — self-contained panel behind a collapsible
          header, matching the old dashboard's capabilities. The toolbar's
          Duplicate detection button expands and scrolls here. */}
      <section
        ref={duplicateRef}
        className="mt-4 scroll-mt-24 overflow-hidden rounded-[10px] border border-ledger-line bg-ledger-surface"
      >
        <button
          type="button"
          aria-expanded={dupOpen}
          onClick={() => setDupOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-ledger-surface-2"
        >
          <span className="text-[0.9375rem] font-semibold text-ledger-ink">
            {t("workspace.receipts.duplicateDetection")}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 text-ledger-muted transition-transform",
              dupOpen && "rotate-180"
            )}
          />
        </button>
        {dupOpen && (
          <div className="border-t border-ledger-line p-4">
            <DuplicateDetectionPanel />
          </div>
        )}
      </section>

      <ReceiptFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        sortOrder={sortOrder}
        onSortChange={(value) => {
          setSortOrder(value as ReceiptSortOrder);
          setPage(1);
        }}
        filterByCurrency={filters.currency}
        onCurrencyChange={(value) => {
          setFilters((current) => ({ ...current, currency: value }));
          setPage(1);
        }}
        filterByCategory={filters.categoryId}
        onCategoryChange={(value) => {
          setFilters((current) => ({ ...current, categoryId: value }));
          setPage(1);
        }}
        filterByPayer={filters.paidById}
        onPayerChange={(value) => {
          setFilters((current) => ({ ...current, paidById: value }));
          setPage(1);
        }}
        processingStatusFilter={filters.processingStatus}
        onProcessingStatusChange={(value) => {
          setFilters((current) => ({ ...current, processingStatus: value }));
          setPage(1);
        }}
        currencies={currencies}
        categories={categories}
        payers={payers}
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          setPage(1);
        }}
        onResetFilters={resetAllFilters}
        activeFilterCount={activeFilterCount}
        tDash={t as unknown as (key: string, options?: unknown) => string}
      />

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
