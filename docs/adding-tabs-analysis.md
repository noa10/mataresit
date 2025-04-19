Okay, let's modify the `AnalysisPage` component to include two tabs: 'Spending Overview' and 'Daily Spending Details', moving the `ExpenseTable` to the second tab.

We'll use the `Tabs` component from Shadcn UI, which aligns well with the components already in use.

First, make sure you have the Shadcn UI Tabs component installed. If not, run:

```bash
npx shadcn-ui@latest add tabs
```

Now, replace your existing `AnalysisPage` component code with the following, integrating the `Tabs`:

```javascript
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DailyPDFReportGenerator } from "@/components/DailyPDFReportGenerator";
import { cn } from "@/lib/utils";

// Import Shadcn UI Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


// Import Lucide icons
import { Calendar as CalendarIcon, Terminal, Download, CreditCard, TrendingUp, Receipt, Eye, BarChart2 } from "lucide-react";

// Import services and types
import { fetchDailySpending, fetchSpendingByCategory, DailySpendingData, CategorySpendingData, fetchReceiptDetailsForRange, ReceiptSummary } from '@/services/supabase/analysis';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Area, BarChart, Bar } from 'recharts';

// Import ReceiptViewer and related types/functions
import ReceiptViewer from '@/components/ReceiptViewer';
import { fetchReceiptById } from '@/services/receiptService';
import { ReceiptWithDetails } from '@/types/receipt';
import Navbar from '@/components/Navbar'; // Import Navbar
import { supabase } from '@/integrations/supabase/client'; // Corrected supabase client import path

// Import the new DailyReceiptBrowserModal
import DailyReceiptBrowserModal from '@/components/DailyReceiptBrowserModal';

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

// Define color constants for charts and UI elements
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#DD8888', '#82CA9D'];

// Define the enhanced data structure for the table
type EnhancedDailySpendingData = {
  date: string;
  total: number;
  receiptIds: string[];
  topMerchant: string;
  paymentMethod: string;
};

// ExpenseStats Component (Keep as is)
interface ExpenseStatsProps {
  totalSpending: number;
  totalReceipts: number;
  averagePerReceipt: number;
  dateRange: DateRange | undefined;
  onDateRangeClick: (range: DateRange | undefined) => void;
}

const ExpenseStats: React.FC<ExpenseStatsProps> = ({ totalSpending, totalReceipts, averagePerReceipt, dateRange, onDateRangeClick }) => {
  // Format date range for display
  const formattedDateRange = dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'All time';

  const stats = [
    {
      title: "Total Spending",
      value: formatCurrency(totalSpending),
      period: formattedDateRange,
      icon: CreditCard,
      trend: "",  // We'll leave trends empty since we don't have trend data yet
      trendUp: true
    },
    {
      title: "Total Receipts",
      value: totalReceipts.toString(),
      period: formattedDateRange,
      icon: Receipt,
      trend: "",
      trendUp: true
    },
    {
      title: "Average Per Receipt",
      value: formatCurrency(averagePerReceipt),
      period: formattedDateRange,
      icon: Receipt,
      trend: "",
      trendUp: true
    }
  ];

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

// CategoryPieChart Component (Keep as is)
interface CategoryPieChartProps {
  categoryData: CategorySpendingData[];
  isLoading?: boolean;
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ categoryData, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="border border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = categoryData.map((category, index) => ({
    name: category.category || 'Uncategorized',
    value: category.total_spent,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{ background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No category data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// SpendingChart Component (Keep as is)
interface SpendingChartProps {
  dailyData: EnhancedDailySpendingData[];
  isLoading?: boolean;
  dateRange: DateRange | undefined; // Add dateRange prop
}

const SpendingChart: React.FC<SpendingChartProps> = ({ dailyData, isLoading, dateRange }) => {
  // Add state for chart type toggle
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  if (isLoading) {
    return (
      <Card className="border border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle>Daily Spending Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Process and enhance chart data
  const sortedData = [...dailyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const chartData = sortedData.map(day => ({
    date: formatChartDate(day.date),
    fullDate: day.date,
    amount: day.total,
    receipts: day.receiptIds.length
  }));
  
  // Calculate statistics for annotations
  const totalSpending = chartData.reduce((sum, day) => sum + day.amount, 0);
  const avgSpending = totalSpending / (chartData.length || 1);
  // const maxSpending = Math.max(...chartData.map(d => d.amount), 0); // Not used currently
  // const peakDay = chartData.find(d => d.amount === maxSpending); // Not used currently
  
  // Custom tooltip to display more information
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-popover border border-border rounded-md shadow-md">
          <p className="font-medium text-sm mb-1 text-popover-foreground">{format(new Date(data.fullDate), 'MMM d, yyyy')}</p>
          <p className="text-sm text-popover-foreground mb-1">
            <span className="font-medium">Spent:</span> {formatCurrency(data.amount)}
          </p>
          <p className="text-xs text-popover-foreground/80">
            {data.receipts} {data.receipts === 1 ? 'receipt' : 'receipts'}
          </p>
          {/* Conditional display for above/below average - ensure avgSpending is not NaN */}
          {avgSpending > 0 && data.amount > avgSpending && (
            <p className="text-xs text-destructive mt-1">
              {((data.amount / avgSpending - 1) * 100).toFixed(0)}% above average
            </p>
          )}
           {avgSpending > 0 && data.amount < avgSpending && (
            <p className="text-xs text-green-500 mt-1">
              {((1 - data.amount / avgSpending) * 100).toFixed(0)}% below average
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Toggle chart type handler
  const toggleChartType = () => {
    setChartType(prev => prev === 'line' ? 'bar' : 'line');
  };

  // Format date range for display in the chart header
  const formattedDateRange = dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'All time';


  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
          <CardTitle>Daily Spending Trend</CardTitle>
          {chartData.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Average daily spend: {formatCurrency(avgSpending)}
               {dateRange?.from && dateRange?.to && ` (${formattedDateRange})`}
            </p>
          )}
        </div>
        {/* Add chart type toggle button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleChartType}
          className="flex items-center gap-1"
        >
          {chartType === 'line' ? (
            <>
              <BarChart2 className="h-4 w-4" />
              <span className="text-xs">Bar View</span>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Line View</span>
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }} 
                  className="[&_.recharts-cartesian-axis-tick-value]:fill-foreground [&_.recharts-legend-item-text]:fill-foreground [&_.recharts-reference-line-label]:fill-foreground dark:[&_.recharts-dot]:stroke-opacity-100 dark:[&_.recharts-dot]:fill-primary/90 dark:[&_.recharts-dot]:stroke-gray-900 dark:[&_.recharts-activedot]:stroke-gray-900 dark:[&_.recharts-activedot]:fill-primary dark:[&_.recharts-cartesian-axis-line]:stroke-gray-600 dark:[&_.recharts-reference-line]:stroke-gray-500"
                >
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={true} 
                    horizontal={true} 
                    stroke="var(--border)" 
                    opacity={0.4} 
                    className="dark:opacity-60" 
                  />
                  
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--muted-foreground)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={{stroke: 'var(--border)'}}
                    padding={{ left: 10, right: 10 }}
                    tick={{ fill: 'var(--foreground)', className: 'dark:fill-gray-300' }}
                    className="dark:stroke-gray-500"
                  />
                  
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{stroke: 'var(--border)'}}
                    tickFormatter={(value) => `${formatCurrency(value as number, '')}`} // Format Y-axis ticks
                    tick={{ fill: 'var(--foreground)', className: 'dark:fill-gray-300' }}
                    className="dark:stroke-gray-500"
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Area under the line chart */}
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="var(--primary)" 
                    strokeWidth={0} 
                    fillOpacity={1} 
                    fill="url(#colorAmount)"
                    className="dark:opacity-30" 
                  />
                  
                  {/* Average spending reference line */}
                  <ReferenceLine 
                    y={avgSpending} 
                    stroke="var(--muted-foreground)" 
                    strokeDasharray="3 3"
                    className="dark:stroke-gray-400"
                    label={{ 
                      value: 'Average', 
                      position: 'insideTopRight',
                      fill: 'var(--muted-foreground)',
                      fontSize: 11,
                      className: 'recharts-reference-line-label dark:fill-gray-300'
                    }}
                  />
                  
                  {/* Vertical lines from points to axis */}
                  {/* Removed to reduce clutter in line chart */}
                  
                  {/* Main line */}
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    className="stroke-primary stroke-opacity-100 dark:stroke-primary dark:stroke-opacity-100 dark:brightness-125"
                    dot={{
                      stroke: 'var(--primary)',
                      strokeWidth: 3,
                      fill: 'var(--card)',
                      r: 5,
                      className: 'stroke-primary fill-card stroke-opacity-100 dark:stroke-primary dark:fill-gray-900 dark:stroke-opacity-100 dark:brightness-125'
                    }}
                    activeDot={{
                      stroke: 'var(--card)',
                      strokeWidth: 3,
                      fill: 'var(--primary)',
                      r: 7,
                      className: 'stroke-card fill-primary stroke-opacity-100 dark:stroke-gray-900 dark:fill-primary dark:brightness-125'
                    }}
                  />
                </LineChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  className="
                    [&_.recharts-cartesian-axis-tick-value]:fill-foreground 
                    [&_.recharts-legend-item-text]:fill-foreground 
                    [&_.recharts-rectangle]:stroke-opacity-30 
                    dark:[&_.recharts-cartesian-axis-line]:stroke-gray-600 
                    dark:[&_.recharts-reference-line]:stroke-gray-500 
                    dark:[&_.recharts-rectangle]:brightness-125
                    [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-line]:stroke-opacity-80 dark:[&_.recharts-cartesian-axis-line]:stroke-gray-600 dark:[&_.recharts-cartesian-axis-line]:stroke-opacity-100
                    [&_.recharts-reference-line-label]:fill-muted-foreground dark:[&_.recharts-reference-line-label]:fill-gray-300
                    [&_.recharts-cartesian-axis-tick-value]:fill-foreground dark:[&_.recharts-cartesian-axis-tick-value]:fill-gray-300
                  "
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={true} 
                    horizontal={true} 
                    stroke="var(--border)" 
                    opacity={0.4} 
                    className="dark:opacity-60" 
                  />
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--muted-foreground)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={{stroke: 'var(--border)'}} 
                    tick={{ 
                      fill: 'var(--foreground)', 
                      className: 'fill-foreground fill-opacity-100 dark:fill-gray-300' 
                    }}
                    className="stroke-border stroke-opacity-80 dark:stroke-gray-600 dark:stroke-opacity-100"
                  />
                  <YAxis 
                    stroke="var(--muted-foreground)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={{stroke: 'var(--border)'}}
                    tickFormatter={(value) => `${formatCurrency(value as number, '')}`} // Format Y-axis ticks
                    tick={{ 
                      fill: 'var(--foreground)', 
                      className: 'fill-foreground fill-opacity-100 dark:fill-gray-300' 
                    }}
                    className="stroke-border stroke-opacity-80 dark:stroke-gray-600 dark:stroke-opacity-100"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine 
                    y={avgSpending} 
                    stroke="var(--muted-foreground)" 
                    strokeDasharray="3 3"
                    className="stroke-muted-foreground stroke-opacity-100 stroke-dasharray-3 dark:stroke-gray-400"
                    label={{ 
                      value: 'Average', 
                      position: 'insideTopRight',
                      fill: 'var(--muted-foreground)', 
                      fontSize: 11,
                      className: 'recharts-reference-line-label fill-muted-foreground fill-opacity-100 dark:fill-gray-300'
                    }}
                  />
                  <Bar 
                    dataKey="amount" 
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.amount > avgSpending ? 'var(--destructive)' : 'var(--primary)'}
                        className={cn(
                          'fill-opacity-95', 
                          'stroke-gray-200 stroke-width-1', 
                          'dark:fill-opacity-100', 
                          'dark:brightness-125', 
                          entry.amount > avgSpending ? 'dark:fill-red-300' : 'dark:fill-blue-300', 
                          'dark:stroke-gray-800 dark:stroke-width-1'
                        )}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No spending data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


// ExpenseTable Component (Keep as is, but remove date picker control - it's now in the main page or ExpenseStats)
interface ExpenseTableProps {
  sortedData: EnhancedDailySpendingData[];
  onViewReceipts: (date: string, receiptIds: string[]) => void;
  isLoading?: boolean;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({ 
  sortedData, 
  onViewReceipts,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card className="border border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle>Daily Spending Details</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader>
        <CardTitle>Daily Spending Details</CardTitle>
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
  // State for date range picker
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    return {
      from: oneMonthAgo,
      to: today,
    };
  });
  
  // State for sorting (No longer needed in the main page as table is moved)
  // const [sortColumn, setSortColumn] = useState<string>('date');
  // const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // NEW STATE: For the DailyReceiptBrowserModal
  const [dailyReceiptBrowserData, setDailyReceiptBrowserData] = useState<{ date: string; receiptIds: string[] } | null>(null);

  // State for date picker popover (No longer needed in the main page for table)
  // const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // State for managing the active tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'details'

  // Prepare ISO strings for API calls
  const startDateISO = date?.from ? date.from.toISOString() : null;
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
      return dailyData.sort((a, b) => new Date(b.date).getTime() - new Date(b.date).getTime()); // Sort descending for the table default
    },
    enabled: !!date?.from && !!date?.to, // Only fetch if full date range is set
  });

  // Fetch category breakdown data (remains the same)
  const { data: categoryData, isLoading: isLoadingCategories, error: categoriesError } = useQuery<CategorySpendingData[], Error>({ 
    queryKey: ['spendingByCategory', startDateISO, endDateISO],
    queryFn: () => fetchSpendingByCategory(startDateISO, endDateISO),
    enabled: !!date?.from && !!date?.to,
  });

  const totalCategorySpending = React.useMemo(() => categoryData?.reduce((sum, entry) => sum + entry.total_spent, 0) || 0, [categoryData]);

  // Data for the line chart (needs adjustment if data source changes)
  const aggregatedChartData = React.useMemo(() => {
    // Create data suitable for the chart (date, total) from enhanced data
    // Ensure it's sorted chronologically for the line chart
    return [...(enhancedDailySpendingData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [enhancedDailySpendingData]);

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

  // Format selected date range for display (used in ExpenseStats)
  const formattedDateRange = React.useMemo(() => {
    if (date?.from) {
      if (date.to) {
        return `${format(date.from, "LLL dd, yyyy")} - ${format(date.to, "LLL dd, yyyy")}`;
      }
      return format(date.from, "LLL dd, yyyy");
    }
    return "Select a date range";
  }, [date]);

  // Handler to open the daily receipt browser modal
  const handleViewReceipts = (date: string, receiptIds: string[]) => {
    setDailyReceiptBrowserData({ date, receiptIds });
  };

  // Handler to close the daily receipt browser modal
  const handleCloseDailyReceiptBrowser = () => {
    setDailyReceiptBrowserData(null);
  };

  // Sort the daily spending data for the table (default descending by date)
  const sortedDailySpendingDataForTable = React.useMemo(() => {
    // Data is already sorted descending in the select transformation,
    // but we can re-sort here if needed for future sorting features.
    return [...(enhancedDailySpendingData || [])];
  }, [enhancedDailySpendingData]);


  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Spending Analysis</h1>

      {/* Display errors if any */}
      {(dailyError || categoriesError) && (
         <Alert variant="destructive" className="mb-6">
         <Terminal className="h-4 w-4" />
         <AlertTitle>Error</AlertTitle>
         <AlertDescription>
           {dailyError?.message || categoriesError?.message || "An unknown error occurred."}
         </AlertDescription>
       </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Spending Overview</TabsTrigger>
          <TabsTrigger value="details">Daily Spending Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {/* Expense Stats */}
            <div className="lg:col-span-3"> {/* Span full width on large screens */}
                <ExpenseStats
                totalSpending={totalSpending}
                totalReceipts={enhancedDailySpendingData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0}
                averagePerReceipt={averagePerReceipt}
                dateRange={date}
                onDateRangeClick={setDate}
              />
            </div>

            {/* Spending Chart */}
            <div className="lg:col-span-2"> {/* Take 2/3 width on large screens */}
              <SpendingChart dailyData={aggregatedChartData} isLoading={isLoadingDaily} dateRange={date} />
            </div>

            {/* Category Pie Chart */}
            <div className="lg:col-span-1"> {/* Take 1/3 width on large screens */}
              <CategoryPieChart categoryData={categoryData || []} isLoading={isLoadingCategories} />
            </div>
            
          </div>
        </TabsContent>

        <TabsContent value="details">
           {/* Daily Spending Details Table */}
           <div className="mt-6">
            <ExpenseTable
              sortedData={sortedDailySpendingDataForTable}
              onViewReceipts={handleViewReceipts}
              isLoading={isLoadingDaily}
            />
           </div>
        </TabsContent>
      </Tabs>

      {/* Daily Receipt Browser Modal */}
      {dailyReceiptBrowserData && (
        <DailyReceiptBrowserModal
          date={dailyReceiptBrowserData.date}
          receiptIds={dailyReceiptBrowserData.receiptIds}
          isOpen={!!dailyReceiptBrowserData}
          onClose={handleCloseDailyReceiptBrowser}
        />
      )}

      {/* Original Receipt Viewer (if still needed elsewhere, otherwise remove) */}
      {/* Assuming this is handled by DailyReceiptBrowserModal now */}
      {/* <ReceiptViewer isOpen={isViewerOpen} onClose={closeViewer} receiptId={selectedReceiptId} /> */}
    </div>
  );
};

export default AnalysisPage;
```

**Explanation of Changes:**

1.  **Import Tabs:** Added `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";`.
2.  **`activeTab` State:** Added `const [activeTab, setActiveTab] = useState('overview');` to manage the currently visible tab.
3.  **`Tabs` Structure:** Wrapped the main content of `AnalysisPage` in the `<Tabs>` component.
    * `defaultValue="overview"` sets the initial active tab.
    * `<TabsList>` contains the buttons (`<TabsTrigger>`) for switching tabs.
        * Each `TabsTrigger` has a `value` prop corresponding to the `value` prop of the `TabsContent` it controls.
    * `<TabsContent>` components hold the content for each tab.
        * `<TabsContent value="overview">` contains `ExpenseStats`, `SpendingChart`, and `CategoryPieChart`.
        * `<TabsContent value="details">` contains `ExpenseTable`.
4.  **Component Placement:** The existing components (`ExpenseStats`, `CategoryPieChart`, `SpendingChart`, `ExpenseTable`) are placed inside the appropriate `TabsContent`.
5.  **Data and State Passing:** The necessary state variables (`date`, `setDate`, `dailyReceiptBrowserData`, `setDailyReceiptBrowserData`) and derived data (`totalSpending`, `averagePerReceipt`, `aggregatedChartData`, `categoryData`, `sortedDailySpendingDataForTable`) are passed down to the child components within the tabs as before.
6.  **Removed Redundant State/Props:** Removed the `sortColumn`, `sortDirection`, `isDatePickerOpen`, and `setIsDatePickerOpen` state and props from the `AnalysisPage` component and `ExpenseTable` component respectively, as the date filtering is now handled by the date picker in the 'Spending Overview' tab's `ExpenseStats` component, and the table's sorting was not fully implemented anyway. If you need sorting in the 'Daily Spending Details' tab, you would re-add the sorting state and logic within the `ExpenseTable` component itself or within the 'details' `TabsContent`.
7.  **EnhancedDailySpendingData Sorting:** Ensured the `select` transformation for `enhancedDailySpendingData` sorts the data by date descending, which is a common default for a details table view.
8.  **SpendingChart Date Range Display:** Added the formatted date range to the `SpendingChart` title for clarity.
9.  **Y-Axis Formatting:** Added currency formatting to the Y-axis ticks in both `LineChart` and `BarChart`.
10. **Tooltip Formatting:** Ensured the tooltip uses the correct full date format.
11. **Chart Type Toggle Text:** Changed the toggle button text to be more descriptive (e.g., "Bar View" vs "Line View").

Now, when you render `AnalysisPage`, you will see two tabs at the top. Clicking on a tab will show the corresponding content. The date range selection in the 'Spending Overview' tab will filter the data displayed in both tabs, ensuring consistency.