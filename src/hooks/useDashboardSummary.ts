import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import {
  dashboardSummaryQueryKey,
  fetchDashboardSummary,
  fetchWorkspaceReceiptCounts,
  getMonthRange,
  workspaceCountsQueryKey,
  type DashboardSummary,
  type WorkspaceReceiptCounts,
} from "@/services/dashboardSummaryService";

const SUMMARY_STALE_TIME = 5 * 60 * 1000;
const COUNTS_STALE_TIME = 60 * 1000;

/**
 * Monthly KPIs, category breakdown and preview rows for the overview page.
 * `month` defaults to the current month.
 */
export function useDashboardSummary(month?: Date) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { fromDate, toDate } = getMonthRange(month);

  return useQuery<DashboardSummary>({
    queryKey: dashboardSummaryQueryKey(currentTeam, fromDate),
    queryFn: () => fetchDashboardSummary({ currentTeam, fromDate, toDate }),
    enabled: Boolean(user),
    staleTime: SUMMARY_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

/**
 * Receipt totals for the workspace navigation. Head-only count queries, so
 * this stays cheap on every page that renders the sidebar.
 */
export function useWorkspaceReceiptCounts() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();

  return useQuery<WorkspaceReceiptCounts>({
    queryKey: workspaceCountsQueryKey(currentTeam),
    queryFn: () => fetchWorkspaceReceiptCounts(currentTeam),
    enabled: Boolean(user),
    staleTime: COUNTS_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}
