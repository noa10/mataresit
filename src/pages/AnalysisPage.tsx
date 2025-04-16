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

import { fetchDailySpending, fetchSpendingByCategory, DailySpendingData, CategorySpendingData } from '@/services/supabase/analysis';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

// Import ReceiptViewer and related types/functions
import ReceiptViewer from '@/components/ReceiptViewer';
import { fetchReceiptById } from '@/services/receiptService';
import { ReceiptWithDetails } from '@/types/receipt';
import Navbar from '@/components/Navbar'; // Import Navbar
import { supabase } from '@/integrations/supabase/client'; // Corrected supabase client import path

// Currency formatting function
const formatCurrency = (amount: number, currencyCode: string = 'USD') => {
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

  // Fetch daily spending data - passing date range
  const { data: dailySpendingData, isLoading: isLoadingDaily, error: dailyError } = useQuery<DailySpendingData[], Error>({
    queryKey: ['dailySpending', startDateISO, endDateISO], // Use date range in key
    queryFn: () => fetchDailySpending(startDateISO, endDateISO), // Pass dates to fetch function
    enabled: !!date, // Only fetch if date range is set
  });

  // Fetch category breakdown data - passing date range
  const { data: categoryData, isLoading: isLoadingCategories, error: categoriesError } = useQuery<
    CategorySpendingData[],
    Error
  >({
    queryKey: ['spendingByCategory', startDateISO, endDateISO], // Use date range in key
    queryFn: () => fetchSpendingByCategory(startDateISO, endDateISO), // Pass dates to fetch function
    enabled: !!date, // Only fetch if date range is set
  });

  // Data for the line chart (already sorted by fetch function)
  const aggregatedChartData = React.useMemo(() => {
    return dailySpendingData || [];
  }, [dailySpendingData]);

  // Data for the table (original fetch order or reverse)
  const aggregatedTableData = React.useMemo(() => {
    // Return the raw data, sorting will be handled separately
    return dailySpendingData || [];
  }, [dailySpendingData]);

  // Calculate total spending from aggregated data
  const totalSpending = React.useMemo(() => {
    return dailySpendingData?.reduce((sum, item) => sum + item.total, 0) || 0;
  }, [dailySpendingData]);

  // Calculate average per receipt
  const averagePerReceipt = React.useMemo(() => {
    // Count total number of receipts across all days in the range
    const totalReceipts = dailySpendingData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0;
    if (totalReceipts === 0) return 0;
    return totalSpending / totalReceipts;
  }, [dailySpendingData, totalSpending]);

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
    const data = [...aggregatedTableData]; // Use the unsorted aggregated data
    data.sort((a, b) => {
      if (sortColumn === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else { // sortColumn === 'total'
        return sortDirection === 'asc' ? a.total - b.total : b.total - a.total;
      }
    });
    return data;
  }, [aggregatedTableData, sortColumn, sortDirection]);

  // Handler to open the Receipt Viewer modal from the list modal
  const handleReceiptSelect = (receiptId: string) => {
    setIsListModalOpen(false); // Close list modal
    setSelectedReceiptId(receiptId);
    setIsViewerModalOpen(true); // Open viewer modal
  };

  return (
    // Wrap content with a Fragment or Div if needed, add Navbar
    <>
      <Navbar />
      <div className="container mx-auto p-4 space-y-6 mt-4"> {/* Add margin-top */}
        <h1 className="text-3xl font-bold mb-6">Expense Analysis</h1>

        {/* Date Range Picker */}
        <div className="flex items-center space-x-2 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formattedDateRange}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2} // Show two months for easier range selection
                  showOutsideDays
                />
              </PopoverContent>
            </Popover>
             {/* Optional: Add a button to clear selection or set predefined ranges */}
             {date && (
               <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>Clear</Button>
             )}
          </div>

        {/* Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
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

          <Card>
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
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground flex items-center justify-center h-full">No category data available.</p>
              )}
            </CardContent>
          </Card>

          <Card>
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
        <Card>
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
                  <YAxis tickFormatter={(value) => formatCurrency(value as number, 'USD').replace(/\\$/,'')} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total Spent" dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            )}
             {!isLoadingDaily && !dailyError && aggregatedTableData.length > 0 && (
               <>
                <h4 className="text-lg font-semibold mb-2">Daily Spending Details</h4>
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow>
                      {/* Date Header */}
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
                      {/* Total Spent Header */}
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
                    {sortedData.map(({ date, total, receiptIds = [] }, index) => ( // Default receiptIds to []
                      <TableRow key={date} className={index % 2 === 0 ? 'bg-muted/20 dark:bg-muted/50' : ''}>
                        <TableCell data-label="Date">{formatFullDate(date)}</TableCell>
                        {/* Updated Receipts Cell */}
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
                        <TableCell data-label="Total Spent" className="text-right">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
               </>
             )}
            {!isLoadingDaily && !dailyError && aggregatedChartData.length === 0 && (
              <p className="text-muted-foreground">No spending data available for this period.</p>
            )}
          </CardContent>
        </Card>

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
      </div>
    </>
  );
};

export default AnalysisPage; 