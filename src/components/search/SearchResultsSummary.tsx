import React from 'react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { 
  Receipt, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Store,
  Clock,
  Hash,
  BarChart3
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrencySafe } from '@/utils/currency';
import { cn } from '@/lib/utils';

interface SearchResultsSummaryProps {
  results: any[];
  searchQuery: string;
  totalResults: number;
  className?: string;
}

interface SummaryStats {
  totalAmount: number;
  currency: string;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  merchantCount: number;
  topMerchants: Array<{ name: string; count: number; amount: number }>;
  avgAmount: number;
}

export function SearchResultsSummary({ 
  results, 
  searchQuery, 
  totalResults, 
  className 
}: SearchResultsSummaryProps) {
  // Calculate summary statistics
  const stats = React.useMemo((): SummaryStats => {
    if (!results || results.length === 0) {
      return {
        totalAmount: 0,
        currency: 'MYR',
        dateRange: { earliest: null, latest: null },
        merchantCount: 0,
        topMerchants: [],
        avgAmount: 0
      };
    }

    let totalAmount = 0;
    let currency = 'MYR';
    let earliest: Date | null = null;
    let latest: Date | null = null;
    const merchantMap = new Map<string, { count: number; amount: number }>();

    results.forEach(result => {
      // Handle different result formats (receipt vs line item vs unified search result)
      const amount = result.total || result.total_amount || result.metadata?.total || 0;
      const resultCurrency = result.currency || result.metadata?.currency || 'MYR';
      const merchant = result.merchant || result.metadata?.merchant || 'Unknown Merchant';
      const dateStr = result.date || result.metadata?.date || result.createdAt;

      totalAmount += amount;
      currency = resultCurrency; // Use the last currency found

      // Process date
      if (dateStr) {
        try {
          const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
          if (!isNaN(date.getTime())) {
            if (!earliest || date < earliest) earliest = date;
            if (!latest || date > latest) latest = date;
          }
        } catch (error) {
          console.warn('Invalid date format:', dateStr);
        }
      }

      // Process merchant
      if (merchant && merchant !== 'Unknown Merchant') {
        const existing = merchantMap.get(merchant) || { count: 0, amount: 0 };
        merchantMap.set(merchant, {
          count: existing.count + 1,
          amount: existing.amount + amount
        });
      }
    });

    // Get top merchants by count
    const topMerchants = Array.from(merchantMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalAmount,
      currency,
      dateRange: { earliest, latest },
      merchantCount: merchantMap.size,
      topMerchants,
      avgAmount: results.length > 0 ? totalAmount / results.length : 0
    };
  }, [results]);

  // Format date range
  const formatDateRange = () => {
    if (!stats.dateRange.earliest || !stats.dateRange.latest) {
      return 'No date information';
    }

    if (stats.dateRange.earliest.getTime() === stats.dateRange.latest.getTime()) {
      return format(stats.dateRange.earliest, 'dd/MM/yyyy');
    }

    return `${format(stats.dateRange.earliest, 'dd/MM/yyyy')} - ${format(stats.dateRange.latest, 'dd/MM/yyyy')}`;
  };

  // Get time range description
  const getTimeRangeDescription = () => {
    if (!stats.dateRange.latest) return '';
    
    const timeAgo = formatDistanceToNow(stats.dateRange.latest, { addSuffix: true });
    return `Latest: ${timeAgo}`;
  };

  if (totalResults === 0) {
    return (
      <Card className={cn("border-dashed border-2", className)}>
        <CardContent className="p-6 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No results found for "{searchQuery}"
          </h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search terms or check your spelling
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4 border-l-primary", className)}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Found {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-muted-foreground">
                for "{searchQuery}"
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {getTimeRangeDescription()}
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Total Amount */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="font-semibold text-green-600">
                {formatCurrencySafe(stats.totalAmount, stats.currency)}
              </p>
            </div>
          </div>

          {/* Average Amount */}
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="font-semibold text-blue-600">
                {formatCurrencySafe(stats.avgAmount, stats.currency)}
              </p>
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs text-muted-foreground">Date Range</p>
              <p className="font-semibold text-purple-600 text-xs">
                {formatDateRange()}
              </p>
            </div>
          </div>

          {/* Merchant Count */}
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">Merchants</p>
              <p className="font-semibold text-orange-600">
                {stats.merchantCount}
              </p>
            </div>
          </div>
        </div>

        {/* Top Merchants */}
        {stats.topMerchants.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Merchants
              </h4>
              <div className="flex flex-wrap gap-2">
                {stats.topMerchants.map((merchant, index) => (
                  <Badge 
                    key={merchant.name} 
                    variant={index === 0 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    <Hash className="h-3 w-3 mr-1" />
                    {merchant.name} ({merchant.count})
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
