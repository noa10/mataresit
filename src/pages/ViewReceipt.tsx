
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import ReceiptViewer from "@/components/ReceiptViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { fetchReceiptById, fetchReceiptNeighbors, deleteReceipt } from "@/services/receiptService";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatCurrencySafe } from "@/utils/currency";
import { useEffect, useState, useCallback, useRef } from "react";

const DASHBOARD_PARAM_KEYS = [
  "q",
  "tab",
  "currency",
  "category",
  "paidBy",
  "ps",
  "sort",
  "page",
  "limit",
  "from",
  "to",
  "view"
] as const;

export default function ViewReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { t } = useReceiptsTranslation();
  const queryClient = useQueryClient();

  // Track if we have history to go back to
  const [canGoBack, setCanGoBack] = useState(false);
  const [isReceiptDirty, setIsReceiptDirty] = useState(false);
  const initialCanGoBackRef = useRef<boolean | null>(null);

  const getDashboardPathWithFilters = useCallback(() => {
    const currentParams = new URLSearchParams(location.search);
    const dashboardParams = new URLSearchParams();

    DASHBOARD_PARAM_KEYS.forEach((key) => {
      const value = currentParams.get(key);
      if (value) {
        dashboardParams.set(key, value);
      }
    });

    const queryString = dashboardParams.toString();
    return queryString ? `/receipts?${queryString}` : "/receipts";
  }, [location.search]);

  // Capture the entry's initial history state once. Replace navigations generate
  // a new location.key and must not turn a direct visit into an in-app Back.
  useEffect(() => {
    if (initialCanGoBackRef.current !== null) return;
    initialCanGoBackRef.current =
      window.history.length > 1 && location.key !== "default";
    setCanGoBack(initialCanGoBackRef.current);
  }, [location.key]);

  // Handle back navigation using browser history
  const handleBack = useCallback(() => {
    if (canGoBack) {
      // Use browser history back to preserve the previous page state
      navigate(-1);
    } else {
      // Fallback to dashboard if no history (direct access/bookmark)
      navigate(getDashboardPathWithFilters());
    }
  }, [canGoBack, navigate, getDashboardPathWithFilters]);

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['receipt', id, currentTeam?.id], // Include team context in cache key
    queryFn: () => fetchReceiptById(id!, { currentTeam }),
    enabled: !!id && !!user,
    staleTime: 0, // Don't cache the data to ensure fresh data is loaded
    retry: 1,     // Only retry once to avoid excessive requests if there's a problem
  });

  const {
    data: neighbors,
    error: neighborsError,
    refetch: refetchNeighbors,
  } = useQuery({
    queryKey: ['receipts', 'neighbors', id, receipt?.team_id, currentTeam?.id],
    queryFn: () => fetchReceiptNeighbors(receipt!, { currentTeam }),
    enabled: !!receipt,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (receiptId: string) => deleteReceipt(receiptId),
    onSuccess: (success) => {
      if (success) {
        toast.success("Receipt deleted successfully");
        // Invalidate the receipts query to refresh the dashboard data
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
        navigate(getDashboardPathWithFilters());
      }
    },
    onError: (error) => {
      toast.error("Failed to delete receipt");
      console.error("Delete error:", error);
    }
  });

  const handleDelete = () => {
    if (!id) return;

    // Ask for confirmation
    if (window.confirm("Are you sure you want to delete this receipt?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNavigateNeighbor = (neighborId: string | null | undefined) => {
    if (!neighborId || neighborId === id) return;
    if (isReceiptDirty && !window.confirm(t("navigation.unsavedChanges"))) return;
    // Replace rather than push so the header Back button returns to the page
    // the user came from instead of stepping back through each receipt.
    navigate(`/receipt/${neighborId}${location.search}`, { replace: true });
  };

  const handleReceiptDirtyChange = useCallback((isDirty: boolean) => {
    setIsReceiptDirty(isDirty);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <div className="container flex items-center justify-center min-h-[80vh]">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-ledger-paper">
        <div className="container flex flex-col items-center justify-center min-h-[80vh] text-center">
          <h2 className="text-2xl font-bold mb-4 text-ledger-ink">Receipt Not Found</h2>
          <p className="text-ledger-muted mb-6">
            The receipt you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <a href="/receipts">Go Back to Receipts</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header Section - Constrained to container width */}
      <header className="container px-4 py-8 pb-4">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              title={canGoBack ? "Go back" : "Back to dashboard"}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-ledger-ink">{receipt.merchant || "Unnamed Receipt"}</h1>
              <p className="text-ledger-muted">
                {receipt.date ? new Date(receipt.date).toLocaleDateString('en-GB') : "No date"} • {receipt.total ? formatCurrencySafe(receipt.total, receipt.currency, 'en-US', 'MYR') : formatCurrencySafe(0, 'MYR')}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-wrap items-center gap-2"
          >
            {neighborsError ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchNeighbors()}
              >
                {t("navigation.retry")}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleNavigateNeighbor(neighbors?.previous?.id)}
                  disabled={!neighbors?.previous}
                  aria-describedby="receipt-navigation-order"
                  title={
                    neighbors?.previous
                      ? t("navigation.previousTitle", {
                          merchant:
                            neighbors.previous.merchant ||
                            t("navigation.untitledReceipt"),
                        })
                      : t("navigation.noPrevious")
                  }
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  {t("navigation.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleNavigateNeighbor(neighbors?.next?.id)}
                  disabled={!neighbors?.next}
                  aria-describedby="receipt-navigation-order"
                  title={
                    neighbors?.next
                      ? t("navigation.nextTitle", {
                          merchant:
                            neighbors.next.merchant ||
                            t("navigation.untitledReceipt"),
                        })
                      : t("navigation.noNext")
                  }
                >
                  {t("navigation.next")}
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Delete Receipt
            </Button>
            {!neighborsError ? (
              <p
                id="receipt-navigation-order"
                className="basis-full text-right text-xs text-ledger-muted"
              >
                {t("navigation.ledgerOrder")}
              </p>
            ) : null}
          </motion.div>
        </div>
      </header>

      {/* Main Content Section - Full width for receipt viewer */}
      <main className="receipt-viewer-main px-4 md:px-6 lg:px-8 pb-8">
        {/* Receipt Viewer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <ReceiptViewer
            receipt={receipt}
            onDirtyChange={handleReceiptDirtyChange}
            onDelete={(_) => {
              toast.success("Receipt deleted successfully");
              // Invalidate the receipts query to refresh the dashboard data
              queryClient.invalidateQueries({ queryKey: ['receipts'] });
              navigate(getDashboardPathWithFilters());
            }}
          />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-ledger-line mt-12">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-ledger-muted">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
