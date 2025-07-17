/**
 * Smart Date Range Suggestions System
 * 
 * Analyzes available receipt dates and provides intelligent suggestions
 * when temporal queries return zero results.
 */

export interface DateSuggestion {
  type: 'expand' | 'alternative' | 'specific';
  suggestion: string;
  dateRange: {
    start: string;
    end: string;
  };
  confidence: number;
  reason: string;
}

export interface DateAnalysis {
  availableDates: string[];
  dateRange: {
    earliest: string;
    latest: string;
  };
  monthDistribution: Record<string, number>;
  weekDistribution: Record<string, number>;
  suggestions: DateSuggestion[];
}

/**
 * Analyze available receipt dates and generate smart suggestions
 */
export function analyzeAvailableDates(
  receipts: any[],
  requestedRange: { start: string; end: string },
  originalQuery: string
): DateAnalysis {
  console.log('🔍 Analyzing available dates for smart suggestions:', {
    receiptsCount: receipts.length,
    requestedRange,
    originalQuery
  });

  // Extract and normalize dates
  const availableDates = receipts
    .map(receipt => {
      const date = receipt.metadata?.date || receipt.createdAt;
      return date ? new Date(date).toISOString().split('T')[0] : null;
    })
    .filter(Boolean)
    .sort();

  if (availableDates.length === 0) {
    return {
      availableDates: [],
      dateRange: { earliest: '', latest: '' },
      monthDistribution: {},
      weekDistribution: {},
      suggestions: [{
        type: 'alternative',
        suggestion: 'Try searching without date restrictions',
        dateRange: { start: '', end: '' },
        confidence: 0.8,
        reason: 'No receipts found with dates'
      }]
    };
  }

  const uniqueDates = [...new Set(availableDates)];
  const earliest = uniqueDates[0];
  const latest = uniqueDates[uniqueDates.length - 1];

  // Analyze month distribution
  const monthDistribution: Record<string, number> = {};
  const weekDistribution: Record<string, number> = {};

  uniqueDates.forEach(date => {
    const dateObj = new Date(date);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const weekKey = getWeekKey(dateObj);
    
    monthDistribution[monthKey] = (monthDistribution[monthKey] || 0) + 1;
    weekDistribution[weekKey] = (weekDistribution[weekKey] || 0) + 1;
  });

  // Generate smart suggestions
  const suggestions = generateSmartSuggestions(
    uniqueDates,
    requestedRange,
    originalQuery,
    monthDistribution,
    weekDistribution
  );

  return {
    availableDates: uniqueDates,
    dateRange: { earliest, latest },
    monthDistribution,
    weekDistribution,
    suggestions
  };
}

/**
 * Generate smart date range suggestions based on analysis
 */
function generateSmartSuggestions(
  availableDates: string[],
  requestedRange: { start: string; end: string },
  originalQuery: string,
  monthDistribution: Record<string, number>,
  weekDistribution: Record<string, number>
): DateSuggestion[] {
  const suggestions: DateSuggestion[] = [];
  const now = new Date();
  const requestedStart = new Date(requestedRange.start);
  const requestedEnd = new Date(requestedRange.end);

  // Find the month with most receipts
  const topMonth = Object.entries(monthDistribution)
    .sort(([,a], [,b]) => b - a)[0];

  if (topMonth) {
    const [monthKey, count] = topMonth;
    const [year, month] = monthKey.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    suggestions.push({
      type: 'specific',
      suggestion: `Try "receipts from ${monthName}" (${count} receipts available)`,
      dateRange: {
        start: `${year}-${month}-01`,
        end: `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`
      },
      confidence: 0.9,
      reason: `Most receipts (${count}) are from ${monthName}`
    });
  }

  // Suggest expanding to last month if query was for "last week"
  if (originalQuery.toLowerCase().includes('last week')) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthCount = monthDistribution[lastMonthKey] || 0;

    if (lastMonthCount > 0) {
      const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      suggestions.push({
        type: 'expand',
        suggestion: `Expand to "receipts from last month" (${lastMonthCount} receipts)`,
        dateRange: {
          start: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
          end: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`
        },
        confidence: 0.8,
        reason: `${lastMonthCount} receipts available in ${monthName}`
      });
    }
  }

  // Suggest recent receipts if available
  const recentDates = availableDates.filter(date => {
    const dateObj = new Date(date);
    const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30; // Last 30 days
  });

  if (recentDates.length > 0) {
    suggestions.push({
      type: 'alternative',
      suggestion: `Show recent receipts (${recentDates.length} from last 30 days)`,
      dateRange: {
        start: recentDates[0],
        end: recentDates[recentDates.length - 1]
      },
      confidence: 0.7,
      reason: `${recentDates.length} receipts found in the last 30 days`
    });
  }

  // Suggest all available data if nothing else works
  if (suggestions.length === 0 && availableDates.length > 0) {
    suggestions.push({
      type: 'expand',
      suggestion: `Show all available receipts (${availableDates.length} total)`,
      dateRange: {
        start: availableDates[0],
        end: availableDates[availableDates.length - 1]
      },
      confidence: 0.6,
      reason: `${availableDates.length} receipts available from ${availableDates[0]} to ${availableDates[availableDates.length - 1]}`
    });
  }

  // Sort by confidence and return top 3
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Get week key for grouping (ISO week)
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Convert suggestions to follow-up suggestions format
 */
export function convertToFollowUpSuggestions(suggestions: DateSuggestion[]): string[] {
  return suggestions.map(suggestion => suggestion.suggestion);
}

/**
 * Generate enhanced content message for zero results with suggestions
 */
export function generateZeroResultsMessage(
  originalQuery: string,
  requestedRange: { start: string; end: string },
  analysis: DateAnalysis
): string {
  const { suggestions, availableDates } = analysis;
  
  if (availableDates.length === 0) {
    return `No receipts found for "${originalQuery}". It looks like there are no receipts in your system yet.`;
  }

  const topSuggestion = suggestions[0];
  const dateRangeText = `${requestedRange.start} to ${requestedRange.end}`;
  
  let message = `No receipts found for those dates (${dateRangeText}). `;
  
  if (topSuggestion) {
    message += `${topSuggestion.reason}. `;
  }
  
  if (suggestions.length > 0) {
    message += `Here are some alternatives you can try:`;
  }

  return message;
}
