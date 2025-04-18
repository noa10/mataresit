import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { format, addDays, startOfDay } from 'date-fns'; // Import date-fns functions
import { DateRange } from 'react-day-picker'; // Import DateRange type
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css'; // Import calendar styles

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { Calendar as CalendarIcon, Terminal } from "lucide-react"; // Import Calendar icon
import { cn } from "@/lib/utils"; // Import cn utility
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Import Dialog components
import { DailyPDFReportGenerator } from "@/components/DailyPDFReportGenerator";

import { fetchDailySpending, fetchSpendingByCategory, DailySpendingData, CategorySpendingData, fetchReceiptDetailsForRange, ReceiptSummary } from '@/services/supabase/analysis';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

// Import ReceiptViewer and related types/functions
import ReceiptViewer from '@/components/ReceiptViewer';
import { fetchReceiptById } from '@/services/receiptService';
import { ReceiptWithDetails } from '@/types/receipt';
import Navbar from '@/components/Navbar'; // Import Navbar
import { supabase } from '@/integrations/supabase/client'; // Corrected supabase client import path

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#DD8888', '#82CA9D']; // Define COLORS array

// Define ReceiptModalContent component here for simplicity
interface ReceiptModalContentProps {
  receiptId: string;
}

const ReceiptModalContent = ({ receiptId }: ReceiptModalContentProps) => {
  const { data: receipt, isLoading, error } = useQuery<ReceiptWithDetails | null>({ // Allow null return
    queryKey: ["receipt", receiptId],
    queryFn: () => fetchReceiptById(receiptId), // Function to fetch receipt by ID
    enabled: !!receiptId, // Only fetch if receiptId is valid
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) return <div className="p-4 min-h-[300px] flex items-center justify-center"><p>Loading receipt...</p></div>;
  if (error) return <div className="p-4 min-h-[300px] flex items-center justify-center text-destructive"><p>Error loading receipt: {(error as Error).message}</p></div>;
  if (!receipt) return <div className="p-4 min-h-[300px] flex items-center justify-center"><p>Receipt not found.</p></div>;

  return <ReceiptViewer receipt={receipt} />;
};

// Define ReceiptListModalContent component
interface ReceiptListModalContentProps {
  receiptIds: string[];
  date: string;
  onReceiptSelect: (receiptId: string) => void;
}

const ReceiptListModalContent = ({ receiptIds, date, onReceiptSelect }: ReceiptListModalContentProps) => {
  // Define the expected type for the query data - using 'merchant' now
  type ReceiptInfo = { id: string; merchant: string | null };

  // Fetch merchant names for the given IDs
  const { data: receiptsInfo, isLoading, error } = useQuery<ReceiptInfo[], Error>({ // Use the updated type
    queryKey: ["receiptsInfoForList", receiptIds], // Changed query key slightly
    queryFn: async (): Promise<ReceiptInfo[]> => {
      if (!receiptIds || receiptIds.length === 0) {
        return [];
      }
      const { data, error: dbError } = await supabase
        .from('receipts')
        .select('id, merchant') // Select 'merchant' instead of 'merchant_name'
        .in('id', receiptIds);

      if (dbError) {
        console.error("Error fetching receipt info:", dbError);
        throw new Error('Failed to load receipt details for list.'); // Simplified error
      }

      // Cast might still be needed depending on exact types
      return (data as ReceiptInfo[] | null) || [];
    },
    enabled: receiptIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-4">
      <DialogHeader className="mb-4">
        <DialogTitle>Receipts for {formatFullDate(date)}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col space-y-1 max-h-[60vh] overflow-y-auto pr-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm p-4 text-center">Loading receipt list...</p>
        ) : error ? (
          <p className="text-destructive text-sm p-4 text-center">{(error as Error).message}</p>
        ) : receiptsInfo && receiptsInfo.length > 0 ? (
          receiptsInfo.map(info => (
            <Button
              key={info.id}
              variant="ghost"
              size="sm"
              onClick={() => onReceiptSelect(info.id)}
              className="justify-start text-sm h-auto py-1.5 text-left"
              title={`View details for ${info.merchant || 'receipt ' + info.id.substring(0,6)}`}
            >
              {/* Display merchant or fallback */}
              {info.merchant || <span className="text-muted-foreground italic">Receipt ({info.id.substring(0, 6)}...)</span>}
            </Button>
          ))
        ) : (
          <p className="text-muted-foreground text-sm p-4 text-center">No receipts found for this day.</p>
        )}
      </div>
    </div>
  );
};

// Define the enhanced data structure for the table
type EnhancedDailySpendingData = {
  date: string;
  total: number;
  receiptIds: string[];
  topMerchant: string;
  paymentMethod: string;
};

const AnalysisPage = () => {
  // State for date range picker
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    const today = startOfDay(new Date());
    return {
      from: addDays(today, -30),
      to: today,
    };
  });

  // State for table sorting
  const [sortColumn, setSortColumn] = React.useState<'date' | 'total'>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // State for Receipt Viewer Modal
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);

  // State for Receipt List Modal
  const [receiptsForDay, setReceiptsForDay] = useState<string[]>([]);
  const [selectedDateForList, setSelectedDateForList] = useState<string | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  // Prepare ISO strings for API calls
  const startDateISO = date?.from ? date.from.toISOString() : null;
  // Add 1 day to 'to' date and set to start of day for inclusive range in Supabase query
  const endDateISO = date?.to ? startOfDay(addDays(date.to, 1)).toISOString() : null;

  // Fetch daily spending data - using new function and select transformation
  const { data: enhancedDailySpendingData, isLoading: isLoadingDaily, error: dailyError } = useQuery<
    ReceiptSummary[], // Fetch raw summaries
    Error,
    EnhancedDailySpendingData[] // Select transforms to this
  >({
    queryKey: ['dailySpendingDetails', startDateISO, endDateISO], // Updated queryKey
    queryFn: () => fetchReceiptDetailsForRange(startDateISO, endDateISO), // Use the new fetch function
    select: (receipts) => { // Apply the transformation logic
      const grouped = receipts.reduce((acc, receipt) => {
        // Ensure date is handled correctly (extract date part)
        const date = (receipt.date || '').split('T')[0]; 
        if (!date) return acc; // Skip if date is invalid
        if (!acc[date]) acc[date] = [];
        acc[date].push(receipt);
        return acc;
      }, {} as Record<string, ReceiptSummary[]>);
  
      const dailyData: EnhancedDailySpendingData[] = Object.entries(grouped).map(([date, dayReceipts]) => {
        const total = dayReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const receiptIds = dayReceipts.map(r => r.id);
        
        // Find receipt with highest total (handle empty dayReceipts)
        const topReceipt = dayReceipts.length > 0 
          ? dayReceipts.reduce((max, r) => ((r.total || 0) > (max?.total || 0) ? r : max), dayReceipts[0])
          : null; // Handle cases with no receipts for a day
          
        const topMerchant = topReceipt?.merchant || 'Unknown';
        // Use payment_method from top receipt, default to N/A
        const paymentMethod = topReceipt?.payment_method || 'N/A';
        
        return { date, total, receiptIds, topMerchant, paymentMethod };
      });
  
      // Ensure data is sorted by date descending by default for the table view later
      // Although fetched ascending, the select output might not preserve order strictly
      return dailyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!date, // Only fetch if date range is set
  });

  // Fetch category breakdown data (remains the same)
  const { data: categoryData, isLoading: isLoadingCategories, error: categoriesError } = useQuery<CategorySpendingData[], Error>({ 
    queryKey: ['spendingByCategory', startDateISO, endDateISO],
    queryFn: () => fetchSpendingByCategory(startDateISO, endDateISO),
    enabled: !!date,
  });

  const totalCategorySpending = React.useMemo(() => categoryData?.reduce((sum, entry) => sum + entry.total_spent, 0) || 0, [categoryData]);

  // Data for the line chart (needs adjustment if data source changes)
  const aggregatedChartData = React.useMemo(() => {
    // Create data suitable for the chart (date, total) from enhanced data
    // Ensure it's sorted chronologically for the line chart
    return [...(enhancedDailySpendingData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [enhancedDailySpendingData]);

  // Data for the table (already transformed by select)
  // No need for aggregatedTableData anymore, use enhancedDailySpendingData directly for sorting

  // Calculate total spending from transformed data
  const totalSpending = React.useMemo(() => {
    return enhancedDailySpendingData?.reduce((sum, item) => sum + item.total, 0) || 0;
  }, [enhancedDailySpendingData]);

  // Calculate average per receipt from transformed data
  const averagePerReceipt = React.useMemo(() => {
    const totalReceipts = enhancedDailySpendingData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0;
    if (totalReceipts === 0) return 0;
    return totalSpending / totalReceipts;
  }, [enhancedDailySpendingData, totalSpending]);

  // Format selected date range for display
  const formattedDateRange = React.useMemo(() => {
    if (date?.from) {
      if (date.to) {
        return `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`;
      }
      return format(date.from, "LLL dd, y");
    }
    return "Select Date Range";
  }, [date]);

  // Sort data for the table based on current sort state
  const sortedData = React.useMemo(() => {
    // Use the already transformed enhancedDailySpendingData
    const data = [...(enhancedDailySpendingData || [])]; 
    data.sort((a, b) => {
      if (sortColumn === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        // Keep descending sort logic from select, but allow user override
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else { // sortColumn === 'total'
        return sortDirection === 'asc' ? a.total - b.total : b.total - a.total;
      }
    });
    return data;
  }, [enhancedDailySpendingData, sortColumn, sortDirection]); // Depend on transformed data

  // Handler to open the Receipt Viewer modal from the list modal
  const handleReceiptSelect = (receiptId: string) => {
    setIsListModalOpen(false); // Close list modal
    setSelectedReceiptId(receiptId);
    setIsViewerModalOpen(true); // Open viewer modal
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-accent/10">
      <Navbar />
      
      <main className="container px-4 py-8">
        <div className="flex flex-col gap-8">
          {/* Reports Section */}
          <section>
            <h2 className="text-3xl font-extrabold mb-4">Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <DailyPDFReportGenerator />
              
              {/* Add more report types here in the future */}
            </div>
          </section>

          {/* Existing Analysis Section */}
          <section>
            <h2 className="text-3xl font-extrabold mb-4">Spending Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Date Range Picker Card */}
              <Card className="border-2 border-secondary/30">
                <CardHeader>
                  <CardTitle>Select Date Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <DayPicker
                      mode="range"
                      selected={date}
                      onSelect={setDate}
                      numberOfMonths={2}
                      className="border rounded-lg p-4"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Cards */}
              <Card className="border-2 border-secondary/30">
                <CardHeader>
                  <CardTitle>Total Spending</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingDaily ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : dailyError ? (
                    <p className="text-sm text-destructive">Error</p>
                  ) : (
                    <p className="text-2xl font-semibold">{formatCurrency(totalSpending)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {date ? formattedDateRange : 'Selected Range'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-secondary/30">
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]"> {/* Give fixed height */}
                  {isLoadingCategories ? (
                    <p className="text-muted-foreground flex items-center justify-center h-full">Loading...</p>
                  ) : categoriesError ? (
                    <p className="text-destructive flex items-center justify-center h-full">Error loading categories</p>
                  ) : categoryData && categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="total_spent"
                          nameKey="category"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [
                          formatCurrency(value as number),
                          `${name}: ${((value as number) / totalCategorySpending * 100).toFixed(1)}%`
                        ]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground flex items-center justify-center h-full">No category data available.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-secondary/30">
                <CardHeader>
                  <CardTitle>Average Per Receipt</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingDaily ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : dailyError ? (
                    <p className="text-sm text-destructive">Error</p>
                  ) : (
                    <p className="text-2xl font-semibold">{formatCurrency(averagePerReceipt)}</p>
                  )}
                   <p className="text-xs text-muted-foreground">
                   {date ? formattedDateRange : 'Selected Range'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Spending Section */}
            <Card className="border-2 border-secondary/30">
              <CardHeader>
                <CardTitle>Daily Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDaily && <p className="text-muted-foreground">Loading daily spending...</p>}
                {dailyError && (
                  <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Failed to load daily spending data: {dailyError.message}</AlertDescription>
                  </Alert>
                )}
                {!isLoadingDaily && !dailyError && aggregatedChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={300} className="mb-6">
                    <LineChart data={aggregatedChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      {/* Use short date format for chart */}
                      <XAxis dataKey="date" tickFormatter={formatChartDate} />
                      <YAxis tickFormatter={(value) => formatCurrency(value as number, 'USD').replace(/\$/,'')} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <ReferenceLine y={Math.max(...aggregatedChartData.map(d => d.total))} stroke="red" label="Peak Spend" />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total Spent" dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
                 {!isLoadingDaily && !dailyError && enhancedDailySpendingData && enhancedDailySpendingData.length > 0 && (
                   <>
                    <Card className="mb-4 border-2 border-secondary/30">
                      <CardContent className="flex justify-between">
                        <p>Total Receipts: {enhancedDailySpendingData.reduce((sum, day) => sum + day.receiptIds.length, 0)}</p>
                        <p>Avg Daily Spend: {formatCurrency(totalSpending / enhancedDailySpendingData.length)}</p>
                      </CardContent>
                    </Card>
                    <h4 className="text-lg font-semibold mb-2">Daily Spending Details</h4>
                    <Table className="responsive-table">
                      <TableHeader>
                        <TableRow>
                          {/* Date Header (Sortable) */}
                          <TableHead
                            className="w-[150px] cursor-pointer"
                            onClick={() => {
                              const newDirection = sortColumn === 'date' && sortDirection === 'desc' ? 'asc' : 'desc';
                              setSortColumn('date');
                              setSortDirection(newDirection);
                            }}
                          >
                            Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          {/* Receipts Header */}
                          <TableHead>Receipts</TableHead>
                          {/* NEW: Top Merchant Header */}
                          <TableHead>Top Merchant</TableHead>
                          {/* NEW: Payment Method Header */}
                          <TableHead>Payment Method</TableHead>
                          {/* Total Spent Header (Sortable) */}
                          <TableHead
                            className="text-right cursor-pointer"
                            onClick={() => {
                              const newDirection = sortColumn === 'total' && sortDirection === 'desc' ? 'asc' : 'desc';
                              setSortColumn('total');
                              setSortDirection(newDirection);
                            }}
                          >
                            Total Spent {sortColumn === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map(({ date, total, receiptIds = [], topMerchant, paymentMethod }, index) => (
                          <TableRow key={date} className={index % 2 === 0 ? 'bg-muted/20 dark:bg-muted/50' : ''}>
                            <TableCell data-label="Date">{formatFullDate(date)}</TableCell>
                            <TableCell data-label="Receipts">
                              {receiptIds.length > 0 ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => {
                                    setReceiptsForDay(receiptIds);
                                    setSelectedDateForList(date);
                                    setIsListModalOpen(true);
                                  }}
                                  className="h-auto p-0 text-xs text-left"
                                  title={`View ${receiptIds.length} receipts for ${formatFullDate(date)}`}
                                >
                                  View {receiptIds.length} Receipt{receiptIds.length !== 1 ? 's' : ''}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">No Receipts</span>
                              )}
                            </TableCell>
                            {/* NEW: Top Merchant Cell */}
                            <TableCell data-label="Top Merchant">{topMerchant}</TableCell>
                            {/* NEW: Payment Method Cell */}
                            <TableCell data-label="Payment Method">{paymentMethod}</TableCell>
                            <TableCell data-label="Total Spent" className="text-right">{formatCurrency(total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                   </>
                 )}
                {!isLoadingDaily && !dailyError && (!enhancedDailySpendingData || enhancedDailySpendingData.length === 0) && (
                  <p className="text-muted-foreground">No spending data available for this period.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Receipt List Modal */}
        {isListModalOpen && selectedDateForList && (
          <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
            <DialogContent className="max-w-md">
              <ReceiptListModalContent
                receiptIds={receiptsForDay}
                date={selectedDateForList}
                onReceiptSelect={handleReceiptSelect}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Receipt Viewer Modal */}
        {isViewerModalOpen && selectedReceiptId && (
          <Dialog open={isViewerModalOpen} onOpenChange={setIsViewerModalOpen}>
            <DialogContent className="max-w-4xl p-0 max-h-[85vh] overflow-y-auto">
              <ReceiptModalContent receiptId={selectedReceiptId} />
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AnalysisPage; 