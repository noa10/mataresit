import { useState, useEffect } from "react";
import { motion } from "framer-motion";

import ReceiptCard from "@/components/ReceiptCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Upload, Search, Filter, SlidersHorizontal,
  PlusCircle, XCircle, Calendar as CalendarIcon, DollarSign, X,
  LayoutGrid, LayoutList, Table as TableIcon,
  Files, CheckSquare, Trash2, Loader2, Check, Crown, Zap, Tag
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useStripe } from "@/contexts/StripeContext";
import { ExportDropdown } from "@/components/export/ExportDropdown";
import { ExportFilters } from "@/lib/export";
import { useDashboardTranslation, useCommonTranslation } from "@/contexts/LanguageContext";
import { fetchReceipts } from "@/services/receiptService";
import { Badge } from "@/components/ui/badge";
import { Receipt, ReceiptStatus } from "@/types/receipt";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { BatchUploadModal } from "@/components/modals/BatchUploadModal";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteReceipt } from "@/services/receiptService";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, isAfter, isBefore, isValid, parseISO } from "date-fns";
import { fetchUserCategories, fetchCategoriesForDisplay, bulkAssignCategory } from "@/services/categoryService";
import { CategorySelector, CategoryDisplay } from "@/components/categories/CategorySelector";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

// Define view mode types
type ViewMode = "grid" | "list" | "table";

// Add this function before the Dashboard component
const calculateAggregateConfidence = (receipt: Receipt) => {
  if (!receipt.confidence_scores) return 0;

  // Define weights for each field (total = 1.0)
  const weights = {
    merchant: 0.3,  // 30% weight for merchant name
    date: 0.2,      // 20% weight for date
    total: 0.3,     // 30% weight for total amount
    payment_method: 0.1,  // 10% weight for payment method
    tax: 0.1        // 10% weight for tax
  };

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [field, weight] of Object.entries(weights)) {
    if (receipt.confidence_scores[field] !== undefined) {
      weightedSum += (receipt.confidence_scores[field] * weight);
      totalWeight += weight;
    }
  }

  // If we have no valid scores, return 0
  if (totalWeight === 0) return 0;

  // Return rounded percentage
  return Math.round((weightedSum / totalWeight) * 100);
};

export default function Dashboard() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { subscriptionData } = useStripe();
  const { t: tDash } = useDashboardTranslation();
  const { t: tCommon } = useCommonTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Read initial values from URL params or use defaults
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const [activeTab, setActiveTab] = useState<"all" | ReceiptStatus>(
    (searchParams.get('tab') as ReceiptStatus | null) || "all"
  );
  const [filterByCurrency, setFilterByCurrency] = useState<string | null>(
    searchParams.get('currency') || null
  );
  const [filterByCategory, setFilterByCategory] = useState<string | null>(
    searchParams.get('category') || null
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">(
    (searchParams.get('sort') as any) || "newest"
  );

  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (fromParam && isValid(parseISO(fromParam))) {
      if (toParam && isValid(parseISO(toParam))) {
        return {
          from: parseISO(fromParam),
          to: parseISO(toParam)
        };
      }
      return { from: parseISO(fromParam) };
    }
    return undefined;
  });

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    // Clear selections when exiting selection mode
    if (selectionMode) {
      setSelectedReceiptIds([]);
    }
  };

  // Handle selection of a receipt
  const handleSelectReceipt = (receiptId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedReceiptIds(prev => [...prev, receiptId]);
    } else {
      setSelectedReceiptIds(prev => prev.filter(id => id !== receiptId));
    }
  };

  // Select or deselect all receipts
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedReceiptIds(processedReceipts.map(receipt => receipt.id));
    } else {
      setSelectedReceiptIds([]);
    }
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (receiptIds: string[]) => {
      const results = await Promise.allSettled(
        receiptIds.map(id => deleteReceipt(id))
      );

      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failures = results.length - successes;

      return { successes, failures };
    },
    onSuccess: (result) => {
      // Show success message
      if (result.successes > 0) {
        toast.success(`Successfully deleted ${result.successes} receipt${result.successes !== 1 ? 's' : ''}`);
      }

      if (result.failures > 0) {
        toast.error(`Failed to delete ${result.failures} receipt${result.failures !== 1 ? 's' : ''}`);
      }

      // Clear selection and exit selection mode
      setSelectedReceiptIds([]);
      setSelectionMode(false);

      // Refresh the receipts data
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
    onError: (error) => {
      console.error('Bulk delete error:', error);
      toast.error('An error occurred while deleting receipts');
    }
  });

  // Bulk category assignment mutation
  const bulkCategoryMutation = useMutation({
    mutationFn: async ({ receiptIds, categoryId }: { receiptIds: string[]; categoryId: string | null }) => {
      return await bulkAssignCategory(receiptIds, categoryId);
    },
    onSuccess: (updatedCount) => {
      if (updatedCount > 0) {
        setSelectedReceiptIds([]);
        setBulkCategoryId(null);
        setSelectionMode(false);
        // Refresh the receipts data
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
      }
    },
    onError: (error) => {
      console.error('Bulk category assignment error:', error);
      toast.error('An error occurred while assigning category');
    }
  });

  // Read view mode from URL params first, then local storage, or use default
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (searchParams.get('view') as ViewMode) || (localStorage.getItem('dashboardViewMode') as ViewMode) || "grid";
  });

  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);

  // Helper function to update search parameters
  const updateSearchParams = (newValues: { [key: string]: string | null }) => {
    const currentParams = new URLSearchParams(searchParams);
    Object.entries(newValues).forEach(([key, value]) => {
      if (value === null || value === '') {
        // Remove param if value is null or empty
        currentParams.delete(key);
      } else {
        currentParams.set(key, value);
      }
    });
    // Use replace: true to update URL without adding new history entry
    setSearchParams(currentParams, { replace: true });
  };

  const { data: receipts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipts', currentTeam?.id],
    queryFn: () => fetchReceipts({ currentTeam }),
    enabled: !!user,
  });

  // TEAM COLLABORATION FIX: Include team context in categories query
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', currentTeam?.id],
    queryFn: () => fetchUserCategories({ currentTeam }),
    enabled: !!user,
  });

  // TEAM COLLABORATION FIX: Fetch categories for display (includes both team and personal for resolution)
  const { data: displayCategories = [] } = useQuery({
    queryKey: ['displayCategories', currentTeam?.id],
    queryFn: () => fetchCategoriesForDisplay({ currentTeam }),
    enabled: !!user,
  });

  const processedReceipts = receipts
    .filter(receipt => {
      const matchesSearch = receipt.merchant.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || receipt.status === activeTab;
      const matchesCurrency = !filterByCurrency || receipt.currency === filterByCurrency;

      // Category filtering
      const matchesCategory = !filterByCategory ||
        (filterByCategory === 'uncategorized' ? !receipt.custom_category_id : receipt.custom_category_id === filterByCategory);

      // Date range filtering
      let matchesDateRange = true;
      if (dateRange?.from) {
        const receiptDate = new Date(receipt.date);
        // Check if receipt date is after or equal to the start date
        matchesDateRange = isValid(receiptDate) && !isBefore(receiptDate, dateRange.from);

        // If end date is specified, check if receipt date is before or equal to the end date
        if (matchesDateRange && dateRange.to) {
          matchesDateRange = !isAfter(receiptDate, dateRange.to);
        }
      }

      return matchesSearch && matchesTab && matchesCurrency && matchesCategory && matchesDateRange;
    })
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortOrder === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortOrder === "highest") {
        return b.total - a.total;
      } else {
        return a.total - b.total;
      }
    });

  // Clean up selected receipt IDs when filters change
  // Remove any selected receipts that are no longer visible in the filtered results
  useEffect(() => {
    if (selectedReceiptIds.length > 0) {
      const visibleReceiptIds = new Set(processedReceipts.map(receipt => receipt.id));
      const validSelectedIds = selectedReceiptIds.filter(id => visibleReceiptIds.has(id));

      // Only update if there's a difference to avoid unnecessary re-renders
      if (validSelectedIds.length !== selectedReceiptIds.length) {
        setSelectedReceiptIds(validSelectedIds);
      }
    }
  }, [processedReceipts, selectedReceiptIds]);

  const currencies = [...new Set(receipts.map(r => r.currency))];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Format date range for display
  const formatDateRange = () => {
    if (!dateRange?.from) return "All dates";

    if (!dateRange.to) {
      return `From ${format(dateRange.from, "MMM d, yyyy")}`;
    }

    return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`;
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    updateSearchParams({ q: newQuery || null });
  };

  // Handle date range selection
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);

    // Update URL parameters
    if (!range || !range.from) {
      updateSearchParams({ from: null, to: null });
    } else {
      const fromParam = format(range.from, "yyyy-MM-dd");
      const toParam = range.to ? format(range.to, "yyyy-MM-dd") : null;
      updateSearchParams({ from: fromParam, to: toParam });
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("all");
    setFilterByCurrency(null);
    setFilterByCategory(null);
    setSortOrder("newest");
    setDateRange(undefined);
    // Don't reset view mode when clearing filters, just keep current value if any
    const currentViewMode = viewMode !== 'grid' ? viewMode : null;
    // Clear all search params except view if it's not the default
    setSearchParams(currentViewMode ? { view: currentViewMode } : {}, { replace: true });
  };

  // Prepare export filters
  const exportFilters: ExportFilters = {
    searchQuery: searchQuery || undefined,
    activeTab: activeTab !== 'all' ? activeTab : undefined,
    filterByCurrency: filterByCurrency || undefined,
    filterByCategory: filterByCategory || undefined,
    sortOrder: sortOrder !== 'newest' ? sortOrder : undefined,
    dateRange: dateRange || undefined
  };

  // Render different view modes
  const renderReceiptContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
        </div>
      );
    }

    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle size={24} className="text-destructive" />
          </div>
          <h3 className="text-xl font-medium mb-2">Error loading receipts</h3>
          <p className="text-muted-foreground mb-6">
            There was a problem loading your receipts. Please try again.
          </p>
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </motion.div>
      );
    }

    if (receipts.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PlusCircle size={24} className="text-primary" />
          </div>
                        <h3 className="text-xl font-medium mb-2">{tDash('empty.title')}</h3>
              <p className="text-muted-foreground mb-6">
                {tDash('empty.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => setIsBatchUploadModalOpen(true)} className="gap-2">
                  <PlusCircle size={16} />
                  {tDash('upload.button')}
                </Button>
              </div>
        </motion.div>
      );
    }

    if (processedReceipts.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="glass-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">{tDash('empty.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {tDash('empty.description')}
          </p>
          <Button variant="outline" onClick={clearFilters}>
            {tDash('filters.clear')}
          </Button>
        </motion.div>
      );
    }

    // Grid view (original card layout)
    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {processedReceipts.map((receipt, index) => {
            const confidenceScore = calculateAggregateConfidence(receipt);
            const isSelected = selectedReceiptIds.includes(receipt.id);

            return (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                className="relative"
              >
                {selectionMode && (
                  <div
                    className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm rounded-md p-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectReceipt(receipt.id, !isSelected);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>
                )}

                <div
                  className={`${selectionMode ? 'cursor-pointer' : ''} m-1 overflow-visible relative z-10 ${isSelected ? 'ring-2 ring-primary' : ''} h-full`}
                  onClick={(e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      handleSelectReceipt(receipt.id, !isSelected);
                    }
                  }}
                >
                  <Link
                    to={selectionMode ? '#' : `/receipt/${receipt.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
                    onClick={(e) => {
                      if (selectionMode) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <ReceiptCard
                      id={receipt.id}
                      merchant={receipt.merchant}
                      date={formatDate(receipt.date)}
                      total={receipt.total}
                      currency={receipt.currency}
                      imageUrl={receipt.image_url || "/placeholder.svg"}
                      status={receipt.status}
                      confidence={confidenceScore}
                      processingStatus={receipt.processing_status}
                      disableInternalLink={true} // Disable internal Link to prevent nesting
                      category={displayCategories.find(cat => cat.id === receipt.custom_category_id) || null}
                    />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    }

    // List view
    else if (viewMode === "list") {
      return (
        <div className="list-view-container overflow-x-auto overflow-y-visible">
          <div className="flex flex-col gap-3 min-w-full">
          {processedReceipts.map((receipt, index) => {
            const confidenceScore = calculateAggregateConfidence(receipt);
            const isSelected = selectedReceiptIds.includes(receipt.id);

            return (
              <motion.div
                key={receipt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 + index * 0.03 }}
                className={`m-1 border rounded-lg overflow-visible relative z-10 bg-card hover:bg-accent/5 transition-colors ${isSelected ? 'ring-2 ring-primary' : ''} min-w-0`}
              >
                {selectionMode ? (
                  <div
                    className="flex items-center p-2 md:p-4 gap-2 md:gap-4 cursor-pointer w-full md:min-w-max"
                    onClick={() => handleSelectReceipt(receipt.id, !isSelected)}
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Checkbox
                        checked={isSelected}
                        size="sm"
                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectReceipt(receipt.id, !isSelected);
                        }}
                      />
                    </div>

                    <div className="w-8 h-8 md:w-12 md:h-12 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={receipt.image_url || "/placeholder.svg"}
                        alt={receipt.merchant}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start gap-2 md:gap-4 min-w-max">
                        <h3 className="font-medium text-xs md:text-base whitespace-nowrap">{receipt.merchant}</h3>
                        <span className="font-semibold text-xs md:text-base whitespace-nowrap">
                          {receipt.currency} {receipt.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 gap-2 md:gap-4 min-w-max">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span>{formatDate(receipt.date)}</span>
                          {(() => {
                            const category = displayCategories.find(cat => cat.id === receipt.custom_category_id);
                            return <CategoryDisplay category={category} size="sm" />;
                          })()}
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            receipt.status === 'unreviewed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            receipt.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                          </span>
                          <span className={`text-xs ${
                            confidenceScore >= 80 ? 'text-green-600' :
                            confidenceScore >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {confidenceScore}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={`/receipt/${receipt.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
                    className="flex items-center p-2 md:p-4 gap-2 md:gap-4 min-w-max"
                  >
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={receipt.image_url || "/placeholder.svg"}
                        alt={receipt.merchant}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start gap-2 md:gap-4 min-w-max">
                        <h3 className="font-medium text-xs md:text-base whitespace-nowrap">{receipt.merchant}</h3>
                        <span className="font-semibold text-xs md:text-base whitespace-nowrap">
                          {receipt.currency} {receipt.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 gap-2 md:gap-4 min-w-max">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span>{formatDate(receipt.date)}</span>
                          {(() => {
                            const category = displayCategories.find(cat => cat.id === receipt.custom_category_id);
                            return <CategoryDisplay category={category} size="sm" />;
                          })()}
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            receipt.status === 'unreviewed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            receipt.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                          </span>
                          <span className={`text-xs ${
                            confidenceScore >= 80 ? 'text-green-600' :
                            confidenceScore >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {confidenceScore}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </motion.div>
            );
          })}
          </div>
        </div>
      );
    }

    // Table view
    else {
      return (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={processedReceipts.length > 0 && processedReceipts.every(receipt => selectedReceiptIds.includes(receipt.id))}
                      onCheckedChange={handleSelectAll}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </TableHead>
                )}
                <TableHead>Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedReceipts.map((receipt) => {
                const confidenceScore = calculateAggregateConfidence(receipt);
                const isSelected = selectedReceiptIds.includes(receipt.id);

                return (
                  <TableRow
                    key={receipt.id}
                    className={`hover:bg-accent/10 ${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                    onClick={(e) => {
                      if (selectionMode) {
                        handleSelectReceipt(receipt.id, !isSelected);
                      } else {
                        navigate(`/receipt/${receipt.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
                      }
                    }}
                  >
                    {selectionMode && (
                      <TableCell className="w-[50px]">
                        <Checkbox
                          checked={isSelected}
                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectReceipt(receipt.id, !isSelected);
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{receipt.merchant}</TableCell>
                    <TableCell>{formatDate(receipt.date)}</TableCell>
                    <TableCell>{receipt.currency} {receipt.total.toFixed(2)}</TableCell>
                    <TableCell>
                      {(() => {
                        const category = displayCategories.find(cat => cat.id === receipt.custom_category_id);
                        return <CategoryDisplay category={category} size="sm" />;
                      })()}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        receipt.status === 'unreviewed' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        receipt.status === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${
                        confidenceScore >= 80 ? 'text-green-600' :
                        confidenceScore >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {confidenceScore}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }
  };

  return (
    <div className="dashboard-container min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <main className="container px-4 py-8 w-full max-w-none lg:max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{tDash('title')}</h1>
              {subscriptionData?.tier && subscriptionData.tier !== 'free' && (
                <Badge className={`${
                  subscriptionData.tier === 'pro'
                    ? 'bg-blue-500 text-white'
                    : 'bg-purple-500 text-white'
                } text-sm px-2 py-1`}>
                  {subscriptionData.tier === 'pro' ? (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Pro
                    </>
                  ) : (
                    <>
                      <Crown className="h-3 w-3 mr-1" />
                      Max
                    </>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Manage and track all your receipts in one place
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex gap-3 flex-wrap"
          >
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value) {
                  const newMode = value as ViewMode;
                  setViewMode(newMode);
                  localStorage.setItem('dashboardViewMode', newMode);
                  updateSearchParams({ view: newMode === 'grid' ? null : newMode }); // Update URL params
                }
              }}
              className="border rounded-md bg-background/60 backdrop-blur-sm"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid view">
                <LayoutGrid size={18} />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" title="List view">
                <LayoutList size={18} />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view" title="Table view">
                <TableIcon size={18} />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              className="gap-2"
              onClick={() => setIsBatchUploadModalOpen(true)}
            >
              <Upload size={16} />
              Upload
            </Button>
          </motion.div>
        </div>

        {/* Filters and Tabs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="glass-card p-4 mb-8"
        >
          {/* Search and Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tDash('filters.search')}
                className="pl-9 bg-background/50"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Selection Mode Toggle */}
              <Button
                variant={selectionMode ? "default" : "outline"}
                className="gap-2 whitespace-nowrap"
                onClick={toggleSelectionMode}
              >
                {selectionMode ? (
                  <>
                    <X size={16} />
                    {tCommon('buttons.cancel')}
                  </>
                ) : (
                  <>
                    <CheckSquare size={16} />
                    {tDash('actions.select')}
                  </>
                )}
              </Button>

              {/* Bulk Actions (visible only in selection mode) */}
              {selectionMode && selectedReceiptIds.length > 0 && (
                <>
                  {/* Bulk Category Assignment */}
                  <div className="flex items-center gap-2">
                    <CategorySelector
                      value={bulkCategoryId}
                      onChange={setBulkCategoryId}
                      placeholder={tDash('actions.assignCategory')}
                      className="w-48"
                    />
                    <Button
                      variant="outline"
                      className="gap-2 whitespace-nowrap"
                      onClick={() => {
                        bulkCategoryMutation.mutate({
                          receiptIds: selectedReceiptIds,
                          categoryId: bulkCategoryId
                        });
                      }}
                      disabled={bulkCategoryMutation.isPending}
                    >
                      {bulkCategoryMutation.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {tCommon('messages.processing')}
                        </>
                      ) : (
                        <>
                          <Tag size={16} />
                          {tDash('actions.assign')} ({selectedReceiptIds.length})
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Bulk Delete */}
                  <Button
                    variant="destructive"
                    className="gap-2 whitespace-nowrap"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete ${selectedReceiptIds.length} receipt${selectedReceiptIds.length !== 1 ? 's' : ''}?`)) {
                        bulkDeleteMutation.mutate(selectedReceiptIds);
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    {bulkDeleteMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {tCommon('messages.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        {tDash('actions.delete')} ({selectedReceiptIds.length})
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Date Filter Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateRange ? "default" : "outline"}
                    className="gap-2 whitespace-nowrap"
                  >
                    <CalendarIcon size={16} />
                    {dateRange ? formatDateRange() : tDash('filters.dateRange')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeChange}
                      numberOfMonths={2}
                    />
                    {dateRange?.from && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => handleDateRangeChange(undefined)}
                      >
                        {tDash('filters.clear')}
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 whitespace-nowrap">
                    <SlidersHorizontal size={16} />
                    {tDash('filters.title')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-sm border border-border">
                  <div className="space-y-4">
                    {/* Sort By */}
                    <h4 className="font-medium">{tDash('sort.title')}</h4>
                    <ToggleGroup
                      type="single"
                      value={sortOrder}
                      onValueChange={(value) => {
                        if (value) {
                          const newSort = value as any;
                          setSortOrder(newSort);
                          updateSearchParams({ sort: newSort === 'newest' ? null : newSort });
                        }
                      }}
                      className="flex flex-wrap justify-start gap-2"
                    >
                      <ToggleGroupItem value="newest" aria-label="Sort by newest first" className="flex-grow-0">
                        <CalendarIcon className="h-4 w-4 mr-2" /> {tDash('sort.newest')}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="oldest" aria-label="Sort by oldest first" className="flex-grow-0">
                        <CalendarIcon className="h-4 w-4 mr-2" /> {tDash('sort.oldest')}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="highest" aria-label="Sort by highest amount" className="flex-grow-0">
                        <DollarSign className="h-4 w-4 mr-2" /> {tDash('sort.highest')}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="lowest" aria-label="Sort by lowest amount" className="flex-grow-0">
                        <DollarSign className="h-4 w-4 mr-2" /> {tDash('sort.lowest')}
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {/* Filter by Currency */}
                    {currencies.length > 0 && (
                      <>
                        <h4 className="font-medium pt-2">{tDash('filters.currency')}</h4>
                        <ToggleGroup
                          type="single"
                          value={filterByCurrency || "all"}
                          onValueChange={(value) => {
                            const newCurrency = value === "all" ? null : value;
                            setFilterByCurrency(newCurrency);
                            updateSearchParams({ currency: newCurrency });
                          }}
                          className="flex flex-wrap justify-start gap-2"
                        >
                          <ToggleGroupItem value="all" aria-label="Show all currencies" className="flex-grow-0">
                            All
                          </ToggleGroupItem>
                          {currencies.map(currency => (
                            <ToggleGroupItem
                              key={currency}
                              value={currency}
                              aria-label={`Filter by ${currency}`}
                              className="flex-grow-0"
                            >
                              {currency}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </>
                    )}

                    {/* Filter by Category */}
                    <h4 className="font-medium pt-2">{tDash('filters.category')}</h4>
                    <ToggleGroup
                      type="single"
                      value={filterByCategory || "all"}
                      onValueChange={(value) => {
                        const newCategory = value === "all" ? null : value;
                        setFilterByCategory(newCategory);
                        updateSearchParams({ category: newCategory });
                      }}
                      className="flex flex-wrap justify-start gap-2"
                    >
                      <ToggleGroupItem value="all" aria-label="Show all categories" className="flex-grow-0">
                        All
                      </ToggleGroupItem>
                      <ToggleGroupItem value="uncategorized" aria-label="Show uncategorized receipts" className="flex-grow-0">
                        Uncategorized
                      </ToggleGroupItem>
                      {categories.map(category => (
                        <ToggleGroupItem
                          key={category.id}
                          value={category.id}
                          aria-label={`Filter by ${category.name}`}
                          className="flex-grow-0"
                        >
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    {/* Clear Filters Button */}
                    <div className="pt-2">
                      <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                        {tDash('filters.clear')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Export Dropdown */}
              <ExportDropdown
                receipts={processedReceipts}
                filters={exportFilters}
                disabled={isLoading}
              />
            </div>
          </div>
          {/* Status Tabs */}
          <div className="mt-4">
            <Tabs defaultValue="all" value={activeTab} onValueChange={(value) => {
              const newTab = value as "all" | ReceiptStatus;
              setActiveTab(newTab);
              updateSearchParams({ tab: newTab === 'all' ? null : newTab });
            }}>
              <TabsList className="bg-background/50">
                <TabsTrigger value="all">{tDash('filters.all')}</TabsTrigger>
                <TabsTrigger value="unreviewed">{tDash('filters.unreviewed')}</TabsTrigger>
                <TabsTrigger value="reviewed">{tDash('filters.reviewed')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.div>

        {/* Main Content Area */}
        {renderReceiptContent()}
      </main>

      {/* Batch Upload Modal - Now handles both single and batch uploads */}
      <BatchUploadModal
        isOpen={isBatchUploadModalOpen}
        onClose={() => setIsBatchUploadModalOpen(false)}
        onUploadComplete={() => {
          // Don't close the modal, just refresh the data
          refetch();
        }}
      />

      <footer className="border-t border-border/40 mt-12">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} ReceiptScan. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
