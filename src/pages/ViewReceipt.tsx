
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ReceiptViewer from "@/components/ReceiptViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Loader2, Search } from "lucide-react";
import { fetchReceiptById, deleteReceipt } from "@/services/receiptService";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatCurrencySafe } from "@/utils/currency";

export default function ViewReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();

  // Check if we came from the search page
  const isFromSearch = location.state?.from === 'search' || searchParams.has('q');

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['receipt', id, currentTeam?.id], // Include team context in cache key
    queryFn: () => fetchReceiptById(id!, { currentTeam }),
    enabled: !!id && !!user,
    staleTime: 0, // Don't cache the data to ensure fresh data is loaded
    retry: 1,     // Only retry once to avoid excessive requests if there's a problem
  });

  const deleteMutation = useMutation({
    mutationFn: (receiptId: string) => deleteReceipt(receiptId),
    onSuccess: (success) => {
      if (success) {
        toast.success("Receipt deleted successfully");
        // Invalidate the receipts query to refresh the dashboard data
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
        navigate("/dashboard");
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
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <div className="container flex flex-col items-center justify-center min-h-[80vh] text-center">
          <h2 className="text-2xl font-bold mb-4">Receipt Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The receipt you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <a href="/dashboard">Go Back to Dashboard</a>
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
            {isFromSearch ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)}
                title="Back to search results"
              >
                <ArrowLeft size={20} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                title="Back to dashboard"
              >
                <ArrowLeft size={20} />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">{receipt.merchant || "Unnamed Receipt"}</h1>
              <p className="text-muted-foreground">
                {receipt.date ? new Date(receipt.date).toLocaleDateString() : "No date"} • {receipt.total ? formatCurrencySafe(receipt.total, receipt.currency, 'en-US', 'MYR') : formatCurrencySafe(0, 'MYR')}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex gap-2"
          >
            {isFromSearch && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate(`/search${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)}
              >
                <Search size={16} />
                Back to Search
              </Button>
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
            onDelete={(_) => {
              toast.success("Receipt deleted successfully");
              // Invalidate the receipts query to refresh the dashboard data
              queryClient.invalidateQueries({ queryKey: ['receipts'] });
              navigate("/dashboard");
            }}
          />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-12">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
