import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

import { cn } from "@/lib/utils";
// Import Shadcn UI Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import Lucide icons
import { Calendar as CalendarIcon, Terminal, Download, CreditCard, TrendingUp, Receipt, Eye, BarChart2, Loader2 } from "lucide-react";

// Import services and types
import { fetchDailyExpenses, fetchExpensesByCategory, DailyExpenseData, CategoryExpenseData, fetchReceiptDetailsForRange, ReceiptSummary } from '@/services/supabase/analysis';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Area, BarChart, Bar, RadialBarChart, RadialBar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// Import ReceiptViewer and related types/functions
import ReceiptViewer from '@/components/ReceiptViewer';
import { fetchReceiptById } from '@/services/receiptService';
import { ReceiptWithDetails } from '@/types/receipt';

import { supabase } from '@/integrations/supabase/client'; // Corrected supabase client import path

// Import the new DailyReceiptBrowserModal
import DailyReceiptBrowserModal from '@/components/DailyReceiptBrowserModal';

// Import currency utility
import { formatCurrencySafe } from '@/utils/currency';

// Import download utility
import { downloadDailyExpenseReport } from '@/lib/export/dailyExpenseReportDownload';

// Currency formatting function
const formatCurrency = (amount: number, currencyCode: string = 'MYR') => {
  return formatCurrencySafe(amount, currencyCode, 'en-US', 'MYR');
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
type EnhancedDailyExpenseData = {
  date: string;
  total: number;
  receiptIds: string[];
  topMerchant: string;
  paymentMethod: string;
};

// ExpenseStats Component
interface ExpenseStatsProps {
  totalExpenses: number;
  totalReceipts: number;
  averagePerReceipt: number;
  dateRange: DateRange | undefined;
  onDateRangeClick: (range: DateRange | undefined) => void;
}

const ExpenseStats: React.FC<ExpenseStatsProps> = ({ totalExpenses, totalReceipts, averagePerReceipt, dateRange, onDateRangeClick }) => {
  // Format date range for display
  const formattedDateRange = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'All time';

  // Handle date selection
  const handleDateSelect = React.useCallback((range: DateRange | undefined) => {
    if (onDateRangeClick) {
      onDateRangeClick(range);
    }
  }, [onDateRangeClick]);

  const stats = [
    {
      title: "Total Expenses",
      value: formatCurrency(totalExpenses),
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
            <div className="p-3">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  console.log('Calendar onSelect called with:', range);
                  console.log('Current dateRange:', dateRange);
                  handleDateSelect(range);
                }}
                numberOfMonths={2}
                showOutsideDays={true}
              />
              {dateRange?.from && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => handleDateSelect(undefined)}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-2">
        <div className="grid gap-4 sm:gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-start justify-between">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground break-words">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.period}</p>
                {stat.trend && (
                  <p className={`text-sm flex items-center gap-1 ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp className={`w-4 h-4 ${stat.trendUp ? '' : 'rotate-180'}`} />
                    {stat.trend}
                  </p>
                )}
              </div>
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0 ml-3">
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// CategoryPieChart Component
interface CategoryPieChartProps {
  categoryData: CategoryExpenseData[];
  isLoading?: boolean;
  dateCaption?: string;
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ categoryData, isLoading, dateCaption }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <div>
            <CardTitle>Expenses by Category</CardTitle>
            {dateCaption && (
              <CardDescription className="text-xs sm:text-sm mt-1 text-muted-foreground">
                {dateCaption}
              </CardDescription>
            )}
          </div>
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
        <div>
          <CardTitle>Expenses by Category</CardTitle>
          {dateCaption && (
            <CardDescription className="text-xs sm:text-sm mt-1 text-muted-foreground">
              {dateCaption}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] sm:h-[300px]">
          {chartData.length > 0 ? (
            <ChartContainer config={{}} className="h-full w-full" style={{ aspectRatio: 'auto' }}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent className="bg-background text-foreground" />}
                  formatter={(value: any, name: any, item: any) => [
                    formatCurrency(value as number),
                    item?.payload?.name ?? name
                  ]}
                  labelFormatter={(label: any) => label}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ChartContainer>
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

// CategoryRadialChart Component (Shadcn UI pattern)
interface CategoryRadialChartProps {
  categoryData: CategoryExpenseData[];
  isLoading?: boolean;
  dateCaption?: string;
}

const CategoryRadialChart: React.FC<CategoryRadialChartProps> = ({ categoryData, isLoading, dateCaption }) => {
  // Use same date caption as Financial Summary for consistency
  const formatDateRangeForCaption = dateCaption || ''
  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Category Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Transform category data for stacked radial: top 3 concentric rings
  const sorted = [...categoryData].sort((a, b) => b.total_spent - a.total_spent)
  const top3 = sorted.slice(0, 3)
  const total = categoryData.reduce((s, c) => s + c.total_spent, 0)

  const ringData = top3.map((c, idx) => ({
    name: c.category || 'Uncategorized',
    value: total > 0 ? Math.round((c.total_spent / total) * 100) : 0,
    color: COLORS[idx % COLORS.length]
  }))

  // Individual arrays for each ring (one datum per RadialBar)
  const ring1 = ringData[0] ? [{ ...ringData[0], index: 0 }] : []
  const ring2 = ringData[1] ? [{ ...ringData[1], index: 1 }] : []
  const ring3 = ringData[2] ? [{ ...ringData[2], index: 2 }] : []

  const radialChartConfig = {
    ring1: { label: ringData[0]?.name, color: ringData[0]?.color },
    ring2: { label: ringData[1]?.name, color: ringData[1]?.color },
    ring3: { label: ringData[2]?.name, color: ringData[2]?.color },
  } as const;

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader>
        <div>
          <CardTitle>Category Analysis</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1 text-muted-foreground">
            {formatDateRangeForCaption}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] sm:h-[300px]">
          {categoryData.length > 0 ? (
            <ChartContainer className="h-full w-full" style={{ aspectRatio: 'auto' }} config={radialChartConfig}>
              <RadialBarChart data={ringData} cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" startAngle={90} endAngle={-270}>
                {/* Center label */}
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-sm">
                  Top 3
                </text>
                {/* Ring 1: Top category */}
                <RadialBar data={ring1} dataKey="value" nameKey="name" cornerRadius={10}
                  innerRadius="65%" outerRadius="90%"
                  fill={ringData[0]?.color || 'hsl(var(--primary))'} />
                {/* Ring 2: Second top category */}
                <RadialBar data={ring2} dataKey="value" nameKey="name" cornerRadius={10}
                  innerRadius="45%" outerRadius="65%"
                  fill={ringData[1]?.color || 'hsl(var(--muted-foreground))'} />
                {/* Ring 3: Third top category */}
                <RadialBar data={ring3} dataKey="value" nameKey="name" cornerRadius={10}
                  innerRadius="25%" outerRadius="45%"
                  fill={ringData[2]?.color || 'hsl(var(--accent))'} />
                <ChartTooltip
                  content={<ChartTooltipContent className="bg-background text-foreground" />}
                  formatter={(value: any, _name: any, item: any) => [
                    `${value}%`, item?.payload?.name ?? 'Category'
                  ]}
                  labelFormatter={() => ''}
                />
              </RadialBarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No category data available</p>
            </div>
          )}
        </div>

        {/* Legend */}
        {ringData.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 text-xs">
            {ringData.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: r.color }} />
                <span className="text-foreground truncate">{r.name}</span>
                <span className="ml-auto font-mono tabular-nums text-muted-foreground">{r.value}%</span>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
};

// ExpenseChart Component
interface ExpenseChartProps {
  dailyData: EnhancedDailyExpenseData[];
  isLoading?: boolean;
  dateRange: DateRange | undefined; // Add dateRange prop
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ dailyData, isLoading, dateRange }) => {
  // Add state for chart type toggle
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  if (isLoading) {
    return (
      <Card className="border border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle>Daily Expense Trend</CardTitle>
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
  const totalExpenses = chartData.reduce((sum, day) => sum + day.amount, 0);
  const avgExpenses = totalExpenses / (chartData.length || 1);
  const maxExpenses = Math.max(...chartData.map(d => d.amount), 0);
  const peakDay = chartData.find(d => d.amount === maxExpenses);

  // Custom tooltip to display more information
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-popover border border-border rounded-md shadow-md">
          <p className="font-medium text-sm mb-1 text-popover-foreground">{format(new Date(data.fullDate), 'MMM d, yyyy')}</p>
          <p className="text-sm text-popover-foreground mb-1">
            <span className="font-medium">Expenses:</span> {formatCurrency(data.amount)}
          </p>
          <p className="text-xs text-popover-foreground/80">
            {data.receipts} {data.receipts === 1 ? 'receipt' : 'receipts'}
          </p>
          {data.amount > avgExpenses && (
            <p className="text-xs text-destructive mt-1">
              {((data.amount / avgExpenses - 1) * 100).toFixed(0)}% above average
            </p>
          )}
          {data.amount < avgExpenses && (
            <p className="text-xs text-green-500 mt-1">
              {((1 - data.amount / avgExpenses) * 100).toFixed(0)}% below average
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

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg sm:text-xl">Daily Expense Trend</CardTitle>
          {chartData.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 break-words">
              Average daily expenses: {formatCurrency(avgExpenses)}
              {dateRange?.from && dateRange?.to && (
                <span className="hidden sm:inline">
                  {` (${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')})`}
                </span>
              )}
            </p>
          )}
        </div>
        {/* Add chart type toggle button */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleChartType}
          className="flex items-center gap-1 flex-shrink-0 self-start sm:self-auto"
        >
          {chartType === 'line' ? (
            <>
              <BarChart2 className="h-4 w-4" />
              <span className="text-xs hidden xs:inline">Bar View</span>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs hidden xs:inline">Line View</span>
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px]">
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
                    tickFormatter={(value) => `MYR ${value}`}
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

                  {/* Average expenses reference line */}
                  <ReferenceLine
                    y={avgExpenses}
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
                  {chartData.map((entry, index) => (
                    <ReferenceLine
                      key={`ref-line-${index}`}
                      x={entry.date}
                      stroke="var(--primary)"
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                      segment={[{ y: 0 }, { y: entry.amount }]}
                      className="dark:opacity-60"
                    />
                  ))}

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
                    tickFormatter={(value) => `MYR ${value}`}
                    tick={{
                      fill: 'var(--foreground)',
                      className: 'fill-foreground fill-opacity-100 dark:fill-gray-300'
                    }}
                    className="stroke-border stroke-opacity-80 dark:stroke-gray-600 dark:stroke-opacity-100"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={avgExpenses}
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
                        fill={entry.amount > avgExpenses ? 'var(--destructive)' : 'var(--primary)'}
                        className={cn(
                          'fill-opacity-95',
                          'stroke-gray-200 stroke-width-1',
                          'dark:fill-opacity-100',
                          'dark:brightness-125',
                          entry.amount > avgExpenses ? 'dark:fill-red-300' : 'dark:fill-blue-300',
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
              <p className="text-muted-foreground">No expense data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ExpenseTable Component
interface ExpenseTableProps {
  sortedData: EnhancedDailyExpenseData[];
  onViewReceipts: (date: string, receiptIds: string[]) => void;
  isLoading?: boolean;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({
  sortedData,
  onViewReceipts,
  isLoading
}) => {
  // State to track which download button is currently loading
  const [downloadingDate, setDownloadingDate] = useState<string | null>(null);

  // Handle download report for a specific date
  const handleDownloadReport = async (dateString: string) => {
    try {
      setDownloadingDate(dateString);

      // Validate and convert date string to Date object
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }

      // Call the download utility function
      const result = await downloadDailyExpenseReport(date, {
        includeImages: true,
        onLoadingChange: (isLoading) => {
          // The utility function handles its own toast notifications
          // We keep our button loading state until the operation completes
        }
      });

      // Log the result for debugging
      if (result.success) {
        console.log(`Successfully downloaded report for ${dateString}`);
      } else {
        console.error(`Failed to download report for ${dateString}:`, result.error);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      // The utility function already shows error toasts, so we don't need to show another one
    } finally {
      setDownloadingDate(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Daily Expense Details</CardTitle>
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
        <CardTitle>Daily Expense Details</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="rounded-md border overflow-x-auto">
          <Table className="relative">
            <TableHeader>
              <TableRow className="border-b border-border/50">
                <TableHead className="min-w-[100px] font-semibold text-foreground/90 py-3 px-4">Date</TableHead>
                <TableHead className="min-w-[120px] font-semibold text-foreground/90 py-3 px-4">Receipts</TableHead>
                <TableHead className="min-w-[120px] hidden sm:table-cell font-semibold text-foreground/90 py-3 px-4">Top Merchant</TableHead>
                <TableHead className="min-w-[100px] hidden md:table-cell font-semibold text-foreground/90 py-3 px-4">Payment Method</TableHead>
                <TableHead className="text-right min-w-[100px] font-semibold text-foreground/90 py-3 px-4">Total Expenses</TableHead>
                <TableHead className="text-center min-w-[80px] w-[80px] hidden xs:table-cell font-semibold text-foreground/90 py-3 px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length > 0 ? sortedData.map(({ date, total, receiptIds = [], topMerchant, paymentMethod }, index) => (
                <TableRow
                  key={date}
                  className={`
                    ${index % 2 === 0 ? 'bg-muted/20 dark:bg-muted/50' : ''}
                    hover:bg-muted/30 dark:hover:bg-muted/60 transition-colors duration-150
                    border-b border-border/30 last:border-b-0
                  `}
                >
                  <TableCell data-label="Date" className="font-medium py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{formatFullDate(date)}</span>
                        {/* Show download button on very small screens (xs) */}
                        {receiptIds.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReport(date)}
                            disabled={downloadingDate === date}
                            className="h-6 w-6 p-0 xs:hidden hover:bg-primary/10 hover:text-primary transition-all duration-200 rounded-md disabled:opacity-50 ml-2"
                            title={downloadingDate === date ? 'Generating report...' : `Download report for ${formatFullDate(date)}`}
                          >
                            {downloadingDate === date ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      {/* Show merchant and payment method on mobile when hidden columns */}
                      <div className="sm:hidden text-xs text-muted-foreground mt-1">
                        <div>{topMerchant}</div>
                        <div className="md:hidden">{paymentMethod}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="Receipts" className="py-3 px-4">
                    {receiptIds.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewReceipts(date, receiptIds)}
                        className="h-auto py-1 px-2 text-xs flex items-center gap-1"
                        title={`View ${receiptIds.length} receipts for ${formatFullDate(date)}`}
                      >
                        <Receipt className="w-3 h-3" />
                        <span className="hidden xs:inline">{receiptIds.length} Receipt{receiptIds.length !== 1 ? 's' : ''}</span>
                        <span className="xs:hidden">{receiptIds.length}</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No Receipts</span>
                    )}
                  </TableCell>
                  <TableCell data-label="Top Merchant" className="hidden sm:table-cell py-3 px-4">{topMerchant}</TableCell>
                  <TableCell data-label="Payment Method" className="hidden md:table-cell py-3 px-4">{paymentMethod}</TableCell>
                  <TableCell data-label="Total Expenses" className="text-right font-medium py-3 px-4">{formatCurrency(total)}</TableCell>
                  <TableCell data-label="Actions" className="text-center hidden xs:table-cell py-3 px-4">
                    {receiptIds.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadReport(date)}
                        disabled={downloadingDate === date}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-all duration-200 rounded-md disabled:opacity-50"
                        title={downloadingDate === date ? 'Generating report...' : `Download report for ${formatFullDate(date)}`}
                      >
                        {downloadingDate === date ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    No expense data available for this period
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
  const queryClient = useQueryClient();

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

  // Handle date change
  const handleDateChange = React.useCallback((newDate: DateRange | undefined) => {
    setDate(newDate);
  }, []);

  // State for managing the active tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'details'

  // NEW STATE: For the DailyReceiptBrowserModal
  const [dailyReceiptBrowserData, setDailyReceiptBrowserData] = useState<{ date: string; receiptIds: string[] } | null>(null);

  // Prepare ISO strings for API calls
  const startDateISO = date?.from ? date.from.toISOString() : null;
  const endDateISO = date?.to ? startOfDay(addDays(date.to, 1)).toISOString() : null;

  // Fetch daily expense data - using new function and select transformation
  const { data: enhancedDailyExpenseData, isLoading: isLoadingDaily, error: dailyError } = useQuery<
    ReceiptSummary[], // Fetch raw summaries
    Error,
    EnhancedDailyExpenseData[] // Select transforms to this
  >({
    queryKey: ['dailyExpenseDetails', startDateISO, endDateISO], // Updated queryKey
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

      const dailyData: EnhancedDailyExpenseData[] = Object.entries(grouped).map(([date, dayReceipts]) => {
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

  // Fetch category breakdown data (updated to use new function)
  const { data: categoryData, isLoading: isLoadingCategories, error: categoriesError } = useQuery<CategoryExpenseData[], Error>({
    queryKey: ['expensesByCategory', startDateISO, endDateISO],
    queryFn: () => fetchExpensesByCategory(startDateISO, endDateISO),
    enabled: !!date,
  });

  const totalCategoryExpenses = React.useMemo(() => categoryData?.reduce((sum, entry) => sum + entry.total_spent, 0) || 0, [categoryData]);

  // Data for the line chart (needs adjustment if data source changes)
  const aggregatedChartData = React.useMemo(() => {
    // Create data suitable for the chart (date, total) from enhanced data
    // Ensure it's sorted chronologically for the line chart
    return [...(enhancedDailyExpenseData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [enhancedDailyExpenseData]);

  // Calculate total expenses from transformed data
  const totalExpenses = React.useMemo(() => {
    return enhancedDailyExpenseData?.reduce((sum, item) => sum + item.total, 0) || 0;
  }, [enhancedDailyExpenseData]);

  // Calculate average per receipt from transformed data
  const averagePerReceipt = React.useMemo(() => {
    const totalReceipts = enhancedDailyExpenseData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0;
    if (totalReceipts === 0) return 0;
    return totalExpenses / totalReceipts;
  }, [enhancedDailyExpenseData, totalExpenses]);

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

  // Sort the daily expense data for the table (default descending by date)
  const sortedDailyExpenseDataForTable = React.useMemo(() => {
    // Data is already sorted descending in the select transformation,
    // but we can re-sort here if needed for future sorting features.
    return [...(enhancedDailyExpenseData || [])];
  }, [enhancedDailyExpenseData]);

  // UPDATED: Handler for viewing receipts - now opens the DailyReceiptBrowserModal
  const handleViewReceipts = (date: string, receiptIds: string[]) => {
    // Set the data needed for the browser modal
    setDailyReceiptBrowserData({ date, receiptIds });
  };

  // Handler to close the receipt browser modal
  const handleCloseDailyReceiptBrowser = () => {
    setDailyReceiptBrowserData(null);
  };

  // Handler for when a receipt is deleted from the modal
  const handleReceiptDeleted = (deletedId: string) => {
    // Invalidate the daily expense queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ['dailyExpenseDetails'] });
    queryClient.invalidateQueries({ queryKey: ['expensesByCategory'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Responsive layout that adapts to sidebar width */}
      <main
        className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8"
        style={{
          width: 'calc(100vw - var(--sidebar-width, 0px))',
          maxWidth: 'calc(1400px + var(--sidebar-width, 0px))',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}
      >
        {/* Dashboard Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Expense Analysis</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Track and analyze your expense patterns</p>
        </div>

        {/* Display errors if any */}
        {(dailyError || categoriesError) && (
          <Alert variant="destructive" className="mb-6 sm:mb-8">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-sm">
              {dailyError?.message || categoriesError?.message || "An unknown error occurred."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 sm:py-3">
              <span className="hidden xs:inline">Expense Overview</span>
              <span className="xs:hidden">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm py-2 sm:py-3">
              <span className="hidden xs:inline">Daily Expense Details</span>
              <span className="xs:hidden">Details</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Responsive Grid Layout */}
            <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              {/* First Row: Expense Chart */}
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <ExpenseChart
                  dailyData={aggregatedChartData}
                  isLoading={isLoadingDaily}
                  dateRange={date}
                />
              </div>

              {/* Second Row: Category Charts and Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Category Pie Chart */}
                <div className="lg:col-span-1">
                  <CategoryPieChart
                    categoryData={categoryData || []}
                    isLoading={isLoadingCategories}
                    dateCaption={formattedDateRange}
                  />
                </div>

                {/* Category Radial Chart (Shadcn pattern) */}
                <div className="lg:col-span-1">
                  <CategoryRadialChart
                    categoryData={categoryData || []}
                    isLoading={isLoadingCategories}
                    dateCaption={formattedDateRange}
                  />
                </div>

                {/* Expense Stats - Takes 2 columns on large screens */}
                <div className="md:col-span-2 lg:col-span-2">
                  <ExpenseStats
                    totalExpenses={totalExpenses}
                    totalReceipts={enhancedDailyExpenseData?.reduce((count, day) => count + (day.receiptIds?.length || 0), 0) || 0}
                    averagePerReceipt={averagePerReceipt}
                    dateRange={date}
                    onDateRangeClick={handleDateChange}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details">
            {/* Daily Expense Details Table */}
            <div className="mt-4 sm:mt-6">
              <ExpenseTable
                sortedData={sortedDailyExpenseDataForTable}
                onViewReceipts={handleViewReceipts}
                isLoading={isLoadingDaily}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Daily Receipt Browser Modal */}
        {dailyReceiptBrowserData && (
          <DailyReceiptBrowserModal
            isOpen={!!dailyReceiptBrowserData}
            onClose={handleCloseDailyReceiptBrowser}
            date={dailyReceiptBrowserData.date}
            receiptIds={dailyReceiptBrowserData.receiptIds}
            onReceiptDeleted={handleReceiptDeleted}
          />
        )}
      </main>
    </div>
  );
};
export default AnalysisPage;
