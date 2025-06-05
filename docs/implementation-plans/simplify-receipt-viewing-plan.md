Okay, let's implement this simplified workflow by creating a new component, say `DailyReceiptBrowserModal`, that will replace the functionality of both `ReceiptListModalContent` and `ReceiptModalContent`.

This new modal will receive the list of receipt IDs for a specific day, fetch the details for all of them, display thumbnails or a list on one side for navigation, and the main `ReceiptViewer` content on the other for the currently selected receipt.

Here's the plan:

1.  **Create a New Component:** `DailyReceiptBrowserModal.tsx`. This will be the unified modal.
2.  **Modify `AnalysisPage`:**
    *   Remove the separate states and handlers for `isListModalOpen`, `selectedDateForList`, `receiptsForDay`, and `handleReceiptSelect`.
    *   Keep a single state to control the open state and pass the necessary data (date and receipt IDs) to the *new* modal. Let's use a state like `dailyReceiptBrowserData: { date: string; receiptIds: string[] } | null`.
    *   Update `handleViewReceipts` to set this new state.
    *   Update the `Dialog` render logic to conditionally show the `DailyReceiptBrowserModal` based on `dailyReceiptBrowserData`.
3.  **Create a New Data Fetching Function:** We need a function to fetch multiple receipts by their IDs. Let's add `fetchReceiptsByIds` to your service file (e.g., `analysis.ts` or `receiptService.ts`).
4.  **Implement `DailyReceiptBrowserModal`:**
    *   Accept `date`, `receiptIds`, and an `onClose` prop.
    *   Use `useQuery` to fetch all receipt details using `fetchReceiptsByIds`.
    *   Manage internal state for the `selectedReceiptId` within this modal.
    *   Render the layout: Dialog wrapper, Header, and a split view (e.g., using flexbox). One side for the thumbnail/list navigation, the other side for the main `ReceiptViewer`.
    *   Render the thumbnail/list based on the fetched `receiptsData`.
    *   Render `ReceiptViewer` using the data for the `selectedReceiptId`.
    *   Add click handlers to the thumbnails/list items to update `selectedReceiptId`.

Let's write the code.

**Step 1 & 3: Add `fetchReceiptsByIds` (in `receiptService.ts` or similar)**

Assuming you have a service file like `src/services/receiptService.ts` with `fetchReceiptById`, let's add the new function there.

```typescript
// src/services/receiptService.ts
import { supabase } from '@/integrations/supabase/client';
import { ReceiptWithDetails } from '@/types/receipt'; // Assuming this type exists and is correct

// Function to fetch a single receipt by ID (already exists or is needed)
export const fetchReceiptById = async (id: string): Promise<ReceiptWithDetails | null> => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      *,
      line_items (*)
    `) // Assuming line_items relationship is defined
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching receipt by ID:", error);
    // Optionally throw error or return null based on desired error handling
    return null; 
  }

  // Type casting for safety, ensure your ReceiptWithDetails matches the select
  return data as ReceiptWithDetails | null;
};

// NEW: Function to fetch multiple receipts by IDs
export const fetchReceiptsByIds = async (ids: string[]): Promise<ReceiptWithDetails[]> => {
  if (!ids || ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      *,
      line_items (*)
    `) // Fetch full details including line items
    .in('id', ids);

  if (error) {
    console.error("Error fetching receipts by IDs:", error);
    throw new Error('Failed to load receipts for the day.'); // Throw error for react-query
  }

  // Type casting
  return (data as ReceiptWithDetails[] | null) || [];
};
```

**Step 1 & 4: Create `DailyReceiptBrowserModal.tsx`**

```tsx
// src/components/DailyReceiptBrowserModal.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area"; // Assuming you have this or can use simple div with overflow
import { Button } from "@/components/ui/button";
import { formatFullDate } from '@/lib/utils'; // Assuming formatFullDate is available or add it
import { ReceiptWithDetails } from '@/types/receipt'; // Import your receipt type
import { fetchReceiptsByIds } from '@/services/receiptService'; // Import the new fetch function
import ReceiptViewer from './ReceiptViewer'; // Import the existing ReceiptViewer

// You might need a formatFullDate helper if not in utils
function formatFullDateHelper(dateString: string) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };
// Replace with actual import if available
const formatFullDate = typeof formatFullDate === 'function' ? formatFullDate : formatFullDateHelper;


interface DailyReceiptBrowserModalProps {
  date: string;
  receiptIds: string[];
  isOpen: boolean; // Prop to control modal visibility
  onClose: () => void;
}

const DailyReceiptBrowserModal: React.FC<DailyReceiptBrowserModalProps> = ({ date, receiptIds, isOpen, onClose }) => {
  // Fetch all receipts for the given IDs
  const { data: receiptsData, isLoading, error } = useQuery<ReceiptWithDetails[], Error>({
    queryKey: ['receiptsForDay', date, receiptIds], // Unique query key
    queryFn: () => fetchReceiptsByIds(receiptIds),
    enabled: isOpen && receiptIds.length > 0, // Only fetch when modal is open and there are IDs
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // State to track the currently selected receipt ID
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Effect to set the first receipt as selected when data loads or IDs change
  useEffect(() => {
    if (receiptsData && receiptsData.length > 0 && !selectedReceiptId) {
      setSelectedReceiptId(receiptsData[0].id);
    } else if ((!receiptsData || receiptsData.length === 0) && selectedReceiptId) {
        // Reset if data becomes empty while a receipt was selected
        setSelectedReceiptId(null);
    }
  }, [receiptsData, selectedReceiptId]); // Added selectedReceiptId to dependencies

  // Find the currently selected receipt data
  const currentReceipt = receiptsData?.find(r => r.id === selectedReceiptId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Receipts for {formatFullDate(date)}</DialogTitle>
        </DialogHeader>

        {/* Main content area: Sidebar (Thumbnails/List) + Viewer */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar for Receipt List/Thumbnails */}
          <div className="w-64 border-r border-border flex flex-col">
            <div className="p-4 text-sm font-medium text-muted-foreground border-b border-border">
                {receiptsData?.length || 0} Receipt{receiptsData?.length !== 1 ? 's' : ''}
            </div>
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading receipts...</div>
            ) : error ? (
              <div className="p-4 text-center text-destructive text-sm">Error: {(error as Error).message}</div>
            ) : receiptsData && receiptsData.length > 0 ? (
              <ScrollArea className="flex-1"> {/* Use ScrollArea if needed */}
                <div className="p-2 space-y-1">
                  {receiptsData.map((receipt) => (
                    <Button
                      key={receipt.id}
                      variant={selectedReceiptId === receipt.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 text-sm"
                      onClick={() => setSelectedReceiptId(receipt.id)}
                    >
                      {/* Display merchant, fallback to date/ID, add total for context */}
                      <div className="flex flex-col items-start">
                         <span className="font-medium">{receipt.merchant || `Receipt (${receipt.id.substring(0, 6)}...)`}</span>
                         <span className="text-xs text-muted-foreground/80">{receipt.date ? formatFullDateHelper(receipt.date) : 'Unknown Date'} - {receipt.total ? `MYR ${receipt.total.toFixed(2)}` : 'N/A'}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">No receipts found for this day.</div>
            )}
          </div>

          {/* Main Viewer Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
             {/* Render the ReceiptViewer component here */}
             {/* Pass the currently selected receipt data to ReceiptViewer */}
             {currentReceipt ? (
                 <ReceiptViewer receipt={currentReceipt} />
             ) : isLoading ? (
                 <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading receipt details...</div>
             ) : (
                 <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a receipt from the list.</div>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailyReceiptBrowserModal;
```
*Note: I've added a `ScrollArea` wrapper for the list of receipts to handle many receipts on a day. You might need to install `@radix-ui/react-scroll-area` and import `ScrollArea` from `@/components/ui/scroll-area`. I've also included a basic `formatFullDateHelper` in case your `@/lib/utils` doesn't export `formatFullDate` directly.*

**Step 2: Modify `AnalysisPage.tsx`**

Now, update `AnalysisPage` to use the new `DailyReceiptBrowserModal`.

```tsx
// src/pages/AnalysisPage.tsx
import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Dialog still needed for the new modal
import { DailyPDFReportGenerator } from "@/components/DailyPDFReportGenerator";
import { cn } from "@/lib/utils"; // Assuming cn is here
import { ScrollArea } from "@/components/ui/scroll-area"; // Assuming you use ScrollArea

// Import Lucide icons
import { Calendar as CalendarIcon, Terminal, Download, CreditCard, TrendingUp, Receipt, Eye } from "lucide-react";

// Import services and types
import { fetchDailySpending, fetchSpendingByCategory, DailySpendingData, CategorySpendingData, fetchReceiptDetailsForRange, ReceiptSummary } from '@/services/supabase/analysis';
// Assuming ReceiptWithDetails is correctly imported in receiptService
// import { ReceiptWithDetails } from '@/types/receipt'; // No longer needed directly here

// Import the NEW DailyReceiptBrowserModal
import DailyReceiptBrowserModal from '@/components/DailyReceiptBrowserModal';

// Assuming these components/services exist and work as before
import Navbar from '@/components/Navbar'; 
import { supabase } from '@/integrations/supabase/client'; 
import { fetchReceiptById } from '@/services/receiptService'; // Keep if used elsewhere, but not for daily browser now

// Currency formatting function
const formatCurrency = (amount: number, currencyCode: string = 'MYR') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
};

// Date formatting function for charts (short format)
const formatChartDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
};

// Date formatting function for table (full format)
const formatFullDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };


// Define color constants for charts and UI elements (keep existing)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#DD8888', '#82CA9D'];

// REMOVE or keep if used elsewhere: ReceiptModalContent and ReceiptListModalContent are replaced
// const ReceiptModalContent = ... (remove)
// const ReceiptListModalContent = ... (remove)


// Define the enhanced data structure for the table (keep existing)
type EnhancedDailySpendingData = {
  date: string;
  total: number;
  receiptIds: string[]; // Keep this
  topMerchant: string;
  paymentMethod: string;
};

// ExpenseStats Component (keep existing)
interface ExpenseStatsProps {
  totalSpending: number;
  totalReceipts: number;
  averagePerReceipt: number;
  dateRange: DateRange | undefined;
  onDateRangeClick: (range: DateRange | undefined) => void;
}
const ExpenseStats: React.FC<ExpenseStatsProps> = ({ totalSpending, totalReceipts, averagePerReceipt, dateRange, onDateRangeClick }) => {
    // ... (keep existing implementation)
     // Format date range for display
    const formattedDateRange = dateRange?.from && dateRange?.to 
        ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
        : 'All time';
    
    const stats = [ /* ... */ ]; // Keep existing stats data structure

    return (
        <Card className="border border-border/40 shadow-sm">
            <CardHeader className="flex flex-row justify-between items-start pb-2">
                <CardTitle className="text-lg">Financial Summary</CardTitle>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <CalendarIcon className="w-4 h-4" />
                            <span>{formattedDateRange}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={onDateRangeClick}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent className="p-6 pt-2">
                <div className="grid gap-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="flex items-start justify-between">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{stat.title}</p>
                                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                                <p className="text-xs text-muted-foreground">{stat.period}</p>
                                {stat.trend && (
                                <p className={`text-sm flex items-center gap-1 ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                                    <TrendingUp className={`w-4 h-4 ${stat.trendUp ? '' : 'rotate-180'}`} />
                                    {stat.trend}
                                </p>
                                )}
                            </div>
                            <div className="p-3 bg-primary/10 rounded-lg">
                                <stat.icon className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};


// CategoryPieChart Component (keep existing)
interface CategoryPieChartProps {
  categoryData: CategorySpendingData[];
  isLoading?: boolean;
}
const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ categoryData, isLoading }) => {
    // ... (keep existing implementation)
    if (isLoading) { /* ... */ }
    const chartData = categoryData.map((category, index) => ({ /* ... */ }));
    return ( /* ... */ );
};

// SpendingChart Component (keep existing)
interface SpendingChartProps {
  dailyData: EnhancedDailySpendingData[];
  isLoading?: boolean;
}
const SpendingChart: React.FC<SpendingChartProps> = ({ dailyData, isLoading }) => {
    // ... (keep existing implementation)
    if (isLoading) { /* ... */ }
    const sortedData = [...dailyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const chartData = sortedData.map(day => ({ /* ... */ }));
    // Calculate statistics for annotations (keep existing)
    const totalSpending = chartData.reduce((sum, day) => sum + day.amount, 0);
    const avgSpending = totalSpending / (chartData.length || 1);
    const maxSpending = Math.max(...chartData.map(d => d.amount), 0);
    const peakDay = chartData.find(d => d.amount === maxSpending);

    // Custom tooltip (keep existing)
    const CustomTooltip = ({ active, payload, label }: any) => { /* ... */ };

    return ( /* ... */ );
};


// ExpenseTable Component (keep existing props, update handler call)
interface ExpenseTableProps {
  sortedData: EnhancedDailySpendingData[];
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  // UPDATED: The handler now needs the date and list of IDs for the new modal
  onViewReceipts: (date: string, receiptIds: string[]) => void; 
  isLoading?: boolean;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (isOpen: boolean) => void;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({ 
  sortedData, 
  dateRange, 
  setDateRange, 
  onViewReceipts, // Keep this prop
  isLoading,
  isDatePickerOpen,
  setIsDatePickerOpen
}) => {
    if (isLoading) { /* ... */ }

    return (
        <Card className="border border-border/40 shadow-sm">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle>Daily Spending Details</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Analysis Period:</span>
                        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                    <span>
                                        {dateRange?.from && dateRange?.to ? (
                                            <>
                                                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                                            </>
                                        ) : (
                                            'Filter by date'
                                        )}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range) => {
                                        setDateRange(range);
                                        if (range?.from && range?.to) {
                                            setIsDatePickerOpen(false);
                                        }
                                    }}
                                    numberOfMonths={2}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Receipts</TableHead>
                                <TableHead>Top Merchant</TableHead>
                                <TableHead>Payment Method</TableHead>
                                <TableHead className="text-right">Total Spent</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length > 0 ? sortedData.map(({ date, total, receiptIds = [], topMerchant, paymentMethod }, index) => (
                                <TableRow key={date} className={index % 2 === 0 ? 'bg-muted/20 dark:bg-muted/50' : ''}>
                                    <TableCell data-label="Date">{formatFullDate(date)}</TableCell>
                                    <TableCell data-label="Receipts">
                                        {receiptIds.length > 0 ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                // UPDATED: Pass date and receiptIds directly to the handler
                                                onClick={() => onViewReceipts(date, receiptIds)} 
                                                className="h-auto py-1 px-2 text-xs flex items-center gap-1"
                                                title={`View ${receiptIds.length} receipts for ${formatFullDate(date)}`}
                                            >
                                                <Receipt className="w-3 h-3" />
                                                <span>{receiptIds.length} Receipt{receiptIds.length !== 1 ? 's' : ''}</span>
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No Receipts</span>
                                        )}
                                    </TableCell>
                                    <TableCell data-label="Top Merchant">{topMerchant}</TableCell>
                                    <TableCell data-label="Payment Method">{paymentMethod}</TableCell>
                                    <TableCell data-label="Total Spent" className="text-right">{formatCurrency(total)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                        No spending data available for this period
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


const AnalysisPage = () => {
  // State for date range picker (keep existing)
  const [date, setDate] = React.useState<DateRange | undefined>(() => { /* ... */ });

  // State for sorting (keep existing)
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // REMOVED: isListModalOpen, isViewerModalOpen, selectedReceiptId, receiptsForDay, selectedDateForList
  // NEW STATE: To control the DailyReceiptBrowserModal and pass data
  const [dailyReceiptBrowserData, setDailyReceiptBrowserData] = useState<{ date: string; receiptIds: string[] } | null>(null);

  // State for date picker popover (keep existing)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Prepare ISO strings for API calls (keep existing)
  const startDateISO = date?.from ? date.from.toISOString() : null;
  const endDateISO = date?.to ? startOfDay(addDays(date.to, 1)).toISOString() : null;

  // Fetch daily spending data (keep existing useQuery)
  const { data: enhancedDailySpendingData, isLoading: isLoadingDaily, error: dailyError } = useQuery<
    ReceiptSummary[], // Fetch raw summaries
    Error,
    EnhancedDailySpendingData[] // Select transforms to this
  >({
    queryKey: ['dailySpendingDetails', startDateISO, endDateISO],
    queryFn: () => fetchReceiptDetailsForRange(startDateISO, endDateISO),
    select: (receipts) => { /* ... (keep existing transformation logic) ... */
        const grouped = receipts.reduce((acc, receipt) => {
            const date = (receipt.date || '').split('T')[0]; 
            if (!date) return acc; 
            if (!acc[date]) acc[date] = [];
            acc[date].push(receipt);
            return acc;
          }, {} as Record<string, ReceiptSummary[]>);
      
          const dailyData: EnhancedDailySpendingData[] = Object.entries(grouped).map(([date, dayReceipts]) => {
            const total = dayReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
            const receiptIds = dayReceipts.map(r => r.id);
            
            const topReceipt = dayReceipts.length > 0 
              ? dayReceipts.reduce((max, r) => ((r.total || 0) > (max?.total || 0) ? r : max), dayReceipts[0])
              : null; 
              
            const topMerchant = topReceipt?.merchant || 'Unknown';
            const paymentMethod = topReceipt?.payment_method || 'N/A';
            
            return { date, total, receiptIds, topMerchant, paymentMethod };
          });
      
          return dailyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!date,
  });

  // Fetch category breakdown data (keep existing useQuery)
  const { data: categoryData, isLoading: isLoadingCategories, error: categoriesError } = useQuery<CategorySpendingData[], Error>({
    queryKey: ['spendingByCategory', startDateISO, endDateISO],
    queryFn: () => fetchSpendingByCategory(startDateISO, endDateISO),
    enabled: !!date,
  });

  const totalCategorySpending = React.useMemo(() => categoryData?.reduce((sum, entry) => sum + entry.total_spent, 0) || 0, [categoryData]);

  // Data for the line chart (keep existing logic)
  const aggregatedChartData = React.useMemo(() => { /* ... */
     return [...(enhancedDailySpendingData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [enhancedDailySpendingData]);

  // Calculate total spending from transformed data (keep existing)
  const totalSpending = React.useMemo(() => { /* ... */
    return enhancedDailySpendingData?.reduce((sum, item) => sum + item.total, 0) || 0;
  }, [enhancedDailySpendingData]);

  // Calculate average per receipt from transformed data (keep existing)
  const averagePerReceipt = React.useMemo(() => { /* ... */
    const totalReceipts = enhancedDailySpendingData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0;
    if (totalReceipts === 0) return 0;
    return totalSpending / totalReceipts;
  }, [enhancedDailySpendingData, totalSpending]);

  // Format selected date range for display (keep existing)
  const formattedDateRange = React.useMemo(() => { /* ... */
    if (date?.from) {
        if (date.to) {
          return `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`;
        }
        return format(date.from, "LLL dd, y");
      }
      return "Select Date Range";
  }, [date]);

  // Sort data for the table based on current sort state (keep existing)
  const sortedData = React.useMemo(() => { /* ... */
    const data = [...(enhancedDailySpendingData || [])]; 
    data.sort((a, b) => {
      if (sortColumn === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - a.date;
      } else { // sortColumn === 'total'
        return sortDirection === 'asc' ? a.total - b.total : b.total - a.total;
      }
    });
    return data;
  }, [enhancedDailySpendingData, sortColumn, sortDirection]);

  // REMOVED: handleReceiptSelect

  // Function to open date range picker (keep existing)
  const openDateRangePicker = (range: DateRange | undefined) => { /* ... */
     if (range) {
        setDate(range);
      }
      setIsDatePickerOpen(false);
  };

  // UPDATED Handler for viewing receipts - now opens the new modal
  const handleViewReceipts = (date: string, receiptIds: string[]) => {
    // Set the data needed for the new browser modal
    setDailyReceiptBrowserData({ date, receiptIds });
  };

  // Handler to close the new daily receipt browser modal
  const handleCloseDailyReceiptBrowser = () => {
    setDailyReceiptBrowserData(null); // Clear the state to close the modal
  };


  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Navbar />
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Dashboard Header (keep existing) */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Expense Analysis</h1>
          <p className="text-muted-foreground">Track and analyze your spending patterns</p>
        </div>

        {/* Grid Layout for PDF Report Generator and ExpenseStats (keep existing) */}
        <div className="grid md:grid-cols-2 gap-6">
          <DailyPDFReportGenerator />
          <ExpenseStats
            totalSpending={totalSpending}
            totalReceipts={enhancedDailySpendingData?.reduce((sum, day) => sum + day.receiptIds.length, 0) || 0}
            averagePerReceipt={averagePerReceipt}
            dateRange={date}
            onDateRangeClick={openDateRangePicker}
          />
        </div>

        {/* Grid Layout for Charts (keep existing) */}
        <div className="grid md:grid-cols-2 gap-6">
          <CategoryPieChart
            categoryData={categoryData || []}
            isLoading={isLoadingCategories}
          />
          <SpendingChart
            dailyData={aggregatedChartData}
            isLoading={isLoadingDaily}
          />
        </div>

        {/* Expense Table (keep existing component, its prop is updated) */}
        <ExpenseTable
          sortedData={sortedData}
          dateRange={date}
          setDateRange={setDate}
          // Pass the UPDATED handler
          onViewReceipts={handleViewReceipts} 
          isLoading={isLoadingDaily}
          isDatePickerOpen={isDatePickerOpen}
          setIsDatePickerOpen={setIsDatePickerOpen}
        />

        {/* REMOVED: Receipt List Modal */}
        {/* REMOVED: Receipt Viewer Modal */}

        {/* NEW: Daily Receipt Browser Modal */}
        {dailyReceiptBrowserData && (
            <DailyReceiptBrowserModal
                isOpen={!!dailyReceiptBrowserData} // Open when data is set
                onClose={handleCloseDailyReceiptBrowser} // Handler to clear data and close
                date={dailyReceiptBrowserData.date}
                receiptIds={dailyReceiptBrowserData.receiptIds}
            />
        )}

      </main>
    </div>
  );
};
export default AnalysisPage;
```

**Summary of Changes:**

1.  A new component `DailyReceiptBrowserModal` is introduced. It takes the `date` and `receiptIds` for a specific day.
2.  A new function `fetchReceiptsByIds` is added to fetch full details for multiple receipts efficiently.
3.  `DailyReceiptBrowserModal` uses `useQuery` with `fetchReceiptsByIds` to get all the data it needs.
4.  Inside `DailyReceiptBrowserModal`, it manages its own `selectedReceiptId` state and renders a layout with a list/thumbnail navigation and the main `ReceiptViewer`.
5.  `AnalysisPage` is simplified:
    *   Removed the separate states and handlers for the old two-modal workflow (`isListModalOpen`, etc.).
    *   Added a single state (`dailyReceiptBrowserData`) to trigger and pass data to the *new* modal.
    *   The `handleViewReceipts` function now directly sets the `dailyReceiptBrowserData` state.
    *   The render logic now conditionally renders the `DailyReceiptBrowserModal` based on the `dailyReceiptBrowserData` state.
    *   The `ReceiptListModalContent` and `ReceiptModalContent` components (and their usage in Dialogs) are removed.

This revised structure streamlines the user's interaction. Clicking the "Receipts" button in the table directly opens a single modal interface dedicated to browsing all receipts for that specific day, with easy switching via the list/thumbnails on the side.