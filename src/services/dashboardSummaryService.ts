import { endOfMonth, format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getReceiptConfidence } from "@/lib/receipts/confidence";
import type { Receipt, ReceiptStatus } from "@/types/receipt";

/**
 * Aggregated data for the workspace overview.
 *
 * The receipts table is read with a narrow column list and aggregated on the
 * client. Every query mirrors the team scoping used by `fetchReceiptsPage`:
 * a team workspace reads `team_id = currentTeam.id`, otherwise personal
 * receipts are `user_id = auth.uid()` with `team_id IS NULL`.
 */

export interface WorkspaceCurrencyTotal {
  currency: string;
  amount: number;
  tax: number;
  count: number;
}

export interface WorkspaceCategoryTotal {
  name: string;
  total: number;
}

export interface WorkspaceReceiptSummary {
  id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  status: ReceiptStatus;
  category: string | null;
  confidence: number | null;
}

export interface DashboardSummary {
  period: { from: string; to: string };
  /** Currency used for the headline totals and the category breakdown. */
  primaryCurrency: string;
  totals: WorkspaceCurrencyTotal[];
  totalSpend: number;
  totalTax: number;
  receiptCount: number;
  /** Receipts awaiting review within the period. */
  reviewCount: number;
  /** Receipts counted in a currency other than `primaryCurrency`. */
  otherCurrencyCount: number;
  categories: WorkspaceCategoryTotal[];
  recent: WorkspaceReceiptSummary[];
  reviewPreview: WorkspaceReceiptSummary[];
}

export interface DashboardSummaryRow {
  id: string;
  merchant: string | null;
  date: string;
  total: number | string | null;
  tax: number | string | null;
  currency: string | null;
  status: string | null;
  predicted_category: string | null;
  created_at: string;
  confidence_scores: Record<string, number | null | undefined> | null;
  custom_categories: { name: string | null } | { name: string | null }[] | null;
}

interface DashboardSummaryParams {
  currentTeam?: { id: string } | null;
  /** Inclusive ISO date (yyyy-MM-dd). Defaults to the current month. */
  fromDate?: string;
  toDate?: string;
  /** Month used when fromDate/toDate are omitted. */
  month?: Date;
}

const SUMMARY_COLUMNS = `
  id,
  merchant,
  date,
  total,
  tax,
  currency,
  status,
  predicted_category,
  created_at,
  confidence_scores,
  custom_categories (
    name
  )
`;

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveCategoryName = (row: DashboardSummaryRow): string => {
  const relation = Array.isArray(row.custom_categories)
    ? row.custom_categories[0]
    : row.custom_categories;
  return relation?.name?.trim() || row.predicted_category?.trim() || "Uncategorized";
};

const toReceiptSummary = (row: DashboardSummaryRow): WorkspaceReceiptSummary => ({
  id: row.id,
  merchant: row.merchant?.trim() || "Unknown merchant",
  date: row.date,
  total: toNumber(row.total),
  currency: row.currency?.toUpperCase() || "MYR",
  status: (row.status === "reviewed" ? "reviewed" : "unreviewed") as ReceiptStatus,
  category: resolveCategoryName(row),
  confidence: getReceiptConfidence({
    confidence_scores: (row.confidence_scores ?? undefined) as unknown as Receipt["confidence_scores"],
  }),
});

/**
 * Fetch every receipt row in the period, paging past Supabase's default
 * 1000-row response cap. Capped at MAX_ROWS to keep the overview responsive.
 */
const fetchSummaryRows = async (
  params: DashboardSummaryParams,
  fromDate: string,
  toDate: string
): Promise<DashboardSummaryRow[]> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) return [];

  const rows: DashboardSummaryRow[] = [];

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = supabase
      .from("receipts")
      .select(SUMMARY_COLUMNS)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (params.currentTeam?.id) {
      query = query.eq("team_id", params.currentTeam.id);
    } else {
      query = query.eq("user_id", userId).is("team_id", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching dashboard summary rows:", error);
      throw new Error("Could not load the workspace overview");
    }

    const page = (data ?? []) as unknown as DashboardSummaryRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
};

export const getMonthRange = (month: Date = new Date()) => ({
  fromDate: format(startOfMonth(month), "yyyy-MM-dd"),
  toDate: format(endOfMonth(month), "yyyy-MM-dd"),
});

/**
 * Pure aggregation step, exported separately so it can be unit tested without
 * mocking Supabase.
 */
export const buildDashboardSummary = (
  rows: DashboardSummaryRow[],
  fromDate: string,
  toDate: string
): DashboardSummary => {
  const totalsByCurrency = new Map<string, WorkspaceCurrencyTotal>();
  const categoryTotals = new Map<string, number>();
  const summaries = rows.map(toReceiptSummary);

  for (const row of rows) {
    const currency = row.currency?.toUpperCase() || "MYR";
    const total = toNumber(row.total);
    const tax = toNumber(row.tax);

    const bucket = totalsByCurrency.get(currency) ?? {
      currency,
      amount: 0,
      tax: 0,
      count: 0,
    };
    bucket.amount += total;
    bucket.tax += tax;
    bucket.count += 1;
    totalsByCurrency.set(currency, bucket);
  }

  const totals = Array.from(totalsByCurrency.values()).sort(
    (a, b) => b.amount - a.amount
  );
  const primaryCurrency = totals[0]?.currency ?? "MYR";
  const primary = totals[0];
  const otherCurrencyCount = rows.length - (primary?.count ?? 0);

  for (const row of rows) {
    const currency = row.currency?.toUpperCase() || "MYR";
    if (currency !== primaryCurrency) continue;
    const name = resolveCategoryName(row);
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + toNumber(row.total));
  }

  const categories = Array.from(categoryTotals.entries())
    .map(([name, total]) => ({ name, total }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const reviewPreview = summaries
    .filter((receipt) => receipt.status === "unreviewed")
    .sort((a, b) => {
      // Unknown confidence sorts after known scores.
      if (a.confidence === null && b.confidence === null) {
        return b.date.localeCompare(a.date);
      }
      if (a.confidence === null) return 1;
      if (b.confidence === null) return -1;
      if (a.confidence !== b.confidence) return a.confidence - b.confidence;
      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);

  const recent = [...summaries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return {
    period: { from: fromDate, to: toDate },
    primaryCurrency,
    totals,
    totalSpend: primary?.amount ?? 0,
    totalTax: primary?.tax ?? 0,
    receiptCount: rows.length,
    reviewCount: summaries.filter((receipt) => receipt.status === "unreviewed").length,
    otherCurrencyCount,
    categories,
    recent,
    reviewPreview,
  };
};

export const fetchDashboardSummary = async (
  params: DashboardSummaryParams = {}
): Promise<DashboardSummary> => {
  const range = params.month ?? new Date();
  const fromDate = params.fromDate ?? getMonthRange(range).fromDate;
  const toDate = params.toDate ?? getMonthRange(range).toDate;

  const rows = await fetchSummaryRows(params, fromDate, toDate);
  return buildDashboardSummary(rows, fromDate, toDate);
};

export interface WorkspaceReceiptCounts {
  all: number;
  review: number;
}

/**
 * Lightweight counts for the workspace navigation. Uses head-only count
 * queries so it never downloads receipt rows.
 */
export const fetchWorkspaceReceiptCounts = async (
  currentTeam?: { id: string } | null
): Promise<WorkspaceReceiptCounts> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) return { all: 0, review: 0 };

  const buildQuery = () => {
    let query = supabase
      .from("receipts")
      .select("id", { count: "exact", head: true });

    if (currentTeam?.id) {
      query = query.eq("team_id", currentTeam.id);
    } else {
      query = query.eq("user_id", userId).is("team_id", null);
    }

    return query;
  };

  const [allResult, reviewResult] = await Promise.all([
    buildQuery(),
    buildQuery().eq("status", "unreviewed"),
  ]);

  if (allResult.error) throw allResult.error;
  if (reviewResult.error) throw reviewResult.error;

  return {
    all: allResult.count ?? 0,
    review: reviewResult.count ?? 0,
  };
};

/** React Query keys used by the workspace overview. */
export const dashboardSummaryQueryKey = (
  currentTeam: { id: string } | null | undefined,
  fromDate: string
) => ["dashboard-summary", currentTeam?.id ?? null, fromDate] as const;

export const workspaceCountsQueryKey = (
  currentTeam: { id: string } | null | undefined
) => ["receipt-counts", currentTeam?.id ?? null] as const;

