/**
 * Consolidated Temporal Query Parser
 * 
 * This module provides a unified, consistent temporal parsing system
 * that replaces the multiple conflicting implementations across the codebase.
 * 
 * Key improvements:
 * - Single source of truth for temporal patterns
 * - Consistent date range calculations
 * - Better timezone handling
 * - Enhanced logging and debugging
 * - Support for hybrid temporal-semantic queries
 */

export interface DateRange {
  start: string;
  end: string;
  preset?: string;
}

export interface ParsedTemporalQuery {
  originalQuery: string;
  searchTerms: string[];
  dateRange?: DateRange;
  amountRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  merchants?: string[];
  categories?: string[];
  queryType: 'temporal' | 'merchant' | 'category' | 'amount' | 'general' | 'mixed' | 'hybrid_temporal';
  confidence: number;
  filters: Record<string, any>;
  temporalIntent?: {
    isTemporalQuery: boolean;
    hasSemanticContent: boolean;
    routingStrategy: 'date_filter_only' | 'semantic_only' | 'hybrid_temporal_semantic';
    temporalConfidence: number;
    semanticTerms: string[];
  };
}

interface TemporalPattern {
  pattern: RegExp;
  handler: (match?: RegExpMatchArray) => DateRange;
  priority: number;
  isHybridCapable: boolean;
  description: string;
}

/**
 * Consolidated temporal patterns with consistent priority and hybrid support
 */
const TEMPORAL_PATTERNS: TemporalPattern[] = [
  // High priority - specific time references
  {
    pattern: /\b(today|today's)\s*(receipts?|purchases?|expenses?)?\b/i,
    handler: () => getTodayRange(),
    priority: 1,
    isHybridCapable: true,
    description: 'Today references'
  },
  {
    pattern: /\b(yesterday|yesterday's)\s*(receipts?|purchases?|expenses?)?\b/i,
    handler: () => getYesterdayRange(),
    priority: 1,
    isHybridCapable: true,
    description: 'Yesterday references'
  },

  // High priority - time-based patterns (hours and minutes)
  {
    pattern: /\b(last|past)\s+(hour)\b/i,
    handler: () => getRelativeDateRange(1, 'hour'),
    priority: 1,
    isHybridCapable: true,
    description: 'Last hour (singular)'
  },
  {
    pattern: /\b(last|past)\s+(minute)\b/i,
    handler: () => getRelativeDateRange(1, 'minute'),
    priority: 1,
    isHybridCapable: true,
    description: 'Last minute (singular)'
  },
  {
    pattern: /\b(last|past)\s+(\d+)\s+(minutes?)\b/i,
    handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[2]), match[3]),
    priority: 1,
    isHybridCapable: true,
    description: 'Last X minutes'
  },
  {
    pattern: /\b(last|past)\s+(\d+)\s+(hours?)\b/i,
    handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[2]), match[3]),
    priority: 1,
    isHybridCapable: true,
    description: 'Last X hours'
  },

  // Specific date patterns with month names (high priority)
  // Handle "from Month Day" format
  {
    pattern: /\bfrom\s+(january|jan)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(1, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From January specific dates'
  },
  {
    pattern: /\bfrom\s+(february|feb)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(2, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From February specific dates'
  },
  {
    pattern: /\bfrom\s+(march|mar)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(3, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From March specific dates'
  },
  {
    pattern: /\bfrom\s+(april|apr)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(4, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From April specific dates'
  },
  {
    pattern: /\bfrom\s+(may)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(5, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From May specific dates'
  },
  {
    pattern: /\bfrom\s+(june|jun)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(6, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From June specific dates'
  },
  {
    pattern: /\bfrom\s+(july|jul)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(7, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From July specific dates'
  },
  {
    pattern: /\bfrom\s+(august|aug)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(8, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From August specific dates'
  },
  {
    pattern: /\bfrom\s+(september|sep)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(9, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From September specific dates'
  },
  {
    pattern: /\bfrom\s+(october|oct)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(10, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From October specific dates'
  },
  {
    pattern: /\bfrom\s+(november|nov)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(11, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From November specific dates'
  },
  {
    pattern: /\bfrom\s+(december|dec)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(12, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'From December specific dates'
  },
  // "On" specific date patterns (highest priority for exact date queries)
  {
    pattern: /\bon\s+(\d{1,2})\s+(january|jan)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(1, parseInt(match[1])),
    priority: 0, // Highest priority
    isHybridCapable: true,
    description: 'On day January (e.g., "on 27 january")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(february|feb)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(2, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day February (e.g., "on 27 february")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(march|mar)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(3, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day March (e.g., "on 27 march")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(april|apr)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(4, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day April (e.g., "on 27 april")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(may)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(5, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day May (e.g., "on 27 may")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(june|jun)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(6, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day June (e.g., "on 27 june")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(july|jul)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(7, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day July (e.g., "on 27 july")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(august|aug)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(8, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day August (e.g., "on 27 august")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(september|sep)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(9, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day September (e.g., "on 27 september")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(october|oct)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(10, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day October (e.g., "on 27 october")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(november|nov)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(11, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day November (e.g., "on 27 november")'
  },
  {
    pattern: /\bon\s+(\d{1,2})\s+(december|dec)(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(12, parseInt(match[1])),
    priority: 0,
    isHybridCapable: true,
    description: 'On day December (e.g., "on 27 december")'
  },

  // "On" month day patterns (alternative format)
  {
    pattern: /\bon\s+(january|jan)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(1, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On January day (e.g., "on january 27")'
  },
  {
    pattern: /\bon\s+(february|feb)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(2, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On February day (e.g., "on february 27")'
  },
  {
    pattern: /\bon\s+(march|mar)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(3, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On March day (e.g., "on march 27")'
  },
  {
    pattern: /\bon\s+(april|apr)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(4, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On April day (e.g., "on april 27")'
  },
  {
    pattern: /\bon\s+(may)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(5, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On May day (e.g., "on may 27")'
  },
  {
    pattern: /\bon\s+(june|jun)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(6, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On June day (e.g., "on june 27")'
  },
  {
    pattern: /\bon\s+(july|jul)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(7, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On July day (e.g., "on july 27")'
  },
  {
    pattern: /\bon\s+(august|aug)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(8, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On August day (e.g., "on august 27")'
  },
  {
    pattern: /\bon\s+(september|sep)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(9, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On September day (e.g., "on september 27")'
  },
  {
    pattern: /\bon\s+(october|oct)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(10, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On October day (e.g., "on october 27")'
  },
  {
    pattern: /\bon\s+(november|nov)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(11, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On November day (e.g., "on november 27")'
  },
  {
    pattern: /\bon\s+(december|dec)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(12, parseInt(match[2])),
    priority: 0,
    isHybridCapable: true,
    description: 'On December day (e.g., "on december 27")'
  },

  // Original patterns without "from"
  {
    pattern: /\b(january|jan)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(1, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'January specific dates'
  },
  {
    pattern: /\b(february|feb)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(2, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'February specific dates'
  },
  {
    pattern: /\b(march|mar)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(3, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'March specific dates'
  },
  {
    pattern: /\b(april|apr)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(4, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'April specific dates'
  },
  {
    pattern: /\b(may)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(5, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'May specific dates'
  },
  {
    pattern: /\b(june|jun)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(6, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'June specific dates'
  },
  {
    pattern: /\b(july|jul)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(7, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'July specific dates'
  },
  {
    pattern: /\b(august|aug)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(8, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'August specific dates'
  },
  {
    pattern: /\b(september|sep)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(9, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'September specific dates'
  },
  {
    pattern: /\b(october|oct)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(10, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'October specific dates'
  },
  {
    pattern: /\b(november|nov)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(11, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'November specific dates'
  },
  {
    pattern: /\b(december|dec)\s+(\d{1,2})\b/i,
    handler: (match: RegExpMatchArray) => getSpecificDateRange(12, parseInt(match[2])),
    priority: 1,
    isHybridCapable: true,
    description: 'December specific dates'
  },

  // Medium priority - relative time references
  {
    pattern: /\b(recent|latest|last)\s+(receipts?|purchases?|expenses?)\b/i,
    handler: () => getRecentDateRange(7),
    priority: 2,
    isHybridCapable: false,
    description: 'Recent/latest references'
  },
  {
    pattern: /\b(this\s+week|current\s+week)\b/i,
    handler: () => getThisWeekRange(),
    priority: 2,
    isHybridCapable: true,
    description: 'This week references'
  },
  {
    pattern: /\b(last\s+week|previous\s+week)\b/i,
    handler: () => getLastWeekRange(),
    priority: 2,
    isHybridCapable: true,
    description: 'Last week references'
  },
  {
    pattern: /\b(this\s+month|current\s+month)\b/i,
    handler: () => getThisMonthRange(),
    priority: 2,
    isHybridCapable: true,
    description: 'This month references'
  },
  {
    pattern: /\b(last\s+month|previous\s+month)\b/i,
    handler: () => getLastMonthRange(),
    priority: 2,
    isHybridCapable: true,
    description: 'Last month references'
  },

  // Lower priority - numeric relative dates (including hours and minutes)
  {
    pattern: /\b(last|past)\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\b/i,
    handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[2]), match[3]),
    priority: 3,
    isHybridCapable: true,
    description: 'Numeric relative dates (last X minutes/hours/days/weeks/months)'
  },
  {
    pattern: /\b(within|in)\s+the\s+(last|past)\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\b/i,
    handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[3]), match[4]),
    priority: 3,
    isHybridCapable: true,
    description: 'Within/in the last X period (including minutes/hours)'
  },

  // Critical missing patterns - "X time ago" format (high priority)
  // Handle "from X time ago" as range queries
  {
    pattern: /\bfrom\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\s+ago\b/i,
    handler: (match: RegExpMatchArray) => getFromDaysAgoRange(parseInt(match[1]), match[2]),
    priority: 1,
    isHybridCapable: true,
    description: 'From X time ago (range query from X time ago to today)'
  },
  // Handle "from X time back" as range queries (same as "from X time ago")
  {
    pattern: /\bfrom\s+(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\s+back\b/i,
    handler: (match: RegExpMatchArray) => getFromDaysAgoRange(parseInt(match[1]), match[2]),
    priority: 1,
    isHybridCapable: true,
    description: 'From X time back (range query from X time back to today)'
  },
  // Handle exact "X time ago" as single date queries
  {
    pattern: /\b(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\s+ago\b/i,
    handler: (match: RegExpMatchArray) => getExactDaysAgoRange(parseInt(match[1]), match[2]),
    priority: 2,
    isHybridCapable: true,
    description: 'Exact time ago (X minutes/hours/days/weeks/months ago)'
  },
  // Handle exact "X time back" as single date queries
  {
    pattern: /\b(\d+)\s+(minutes?|hours?|days?|weeks?|months?)\s+back\b/i,
    handler: (match: RegExpMatchArray) => getExactDaysAgoRange(parseInt(match[1]), match[2]),
    priority: 2,
    isHybridCapable: true,
    description: 'Exact time back (X minutes/hours/days/weeks/months back)'
  },
  // Handle "from a/one day ago" as range queries
  {
    pattern: /\bfrom\s+(a|one)\s+(day|week|month)\s+ago\b/i,
    handler: (match: RegExpMatchArray) => getFromDaysAgoRange(1, match[2]),
    priority: 1,
    isHybridCapable: true,
    description: 'From a/one unit ago (range query from a day ago to today)'
  },
  // Handle "from a/one day back" as range queries
  {
    pattern: /\bfrom\s+(a|one)\s+(day|week|month)\s+back\b/i,
    handler: (match: RegExpMatchArray) => getFromDaysAgoRange(1, match[2]),
    priority: 1,
    isHybridCapable: true,
    description: 'From a/one unit back (range query from a day back to today)'
  },
  // Handle exact "a/one day ago" as single date queries
  {
    pattern: /\b(a|one)\s+(day|week|month)\s+ago\b/i,
    handler: (match: RegExpMatchArray) => getExactDaysAgoRange(1, match[2]),
    priority: 2,
    isHybridCapable: true,
    description: 'Single unit ago (a day ago, one week ago, etc.)'
  },
  // Handle exact "a/one day back" as single date queries
  {
    pattern: /\b(a|one)\s+(day|week|month)\s+back\b/i,
    handler: (match: RegExpMatchArray) => getExactDaysAgoRange(1, match[2]),
    priority: 2,
    isHybridCapable: true,
    description: 'Single unit back (a day back, one week back, etc.)'
  },

  // Enhanced hybrid patterns - HIGH PRIORITY for common query formats
  {
    pattern: /\b(find|get|show|give)\s+(me\s+)?(all\s+)?(receipts?|purchases?|expenses?)\s+(from|in|during)\s+(last\s+week|this\s+week|last\s+month|this\s+month)\b/i,
    handler: (match: RegExpMatchArray) => detectTemporalFromContext(match[6]),
    priority: 1,
    isHybridCapable: true,
    description: 'Find/get receipts from temporal period'
  },
  {
    pattern: /\b(receipts?|purchases?|expenses?)\s+(from|in|during)\s+(last\s+week|this\s+week|last\s+month|this\s+month)\b/i,
    handler: (match: RegExpMatchArray) => detectTemporalFromContext(match[3]),
    priority: 2,
    isHybridCapable: true,
    description: 'Receipts from temporal period'
  },
  {
    pattern: /\b(recent|latest)\s+([a-zA-Z\s]+)\s+(receipts?|purchases?|expenses?)\b/i,
    handler: () => getRecentDateRange(7),
    priority: 4,
    isHybridCapable: true,
    description: 'Recent semantic content'
  },
  {
    pattern: /\b([a-zA-Z\s]+)\s+(from|in|during)\s+(last\s+week|this\s+week|last\s+month|this\s+month)\b/i,
    handler: (match: RegExpMatchArray) => detectTemporalFromContext(match[3]),
    priority: 4,
    isHybridCapable: true,
    description: 'Semantic content with temporal context'
  },

  // Malay language support
  {
    pattern: /\b(hari\s+ini|semalam|minggu\s+lepas|bulan\s+lepas)\b/i,
    handler: (match: RegExpMatchArray) => {
      const phrase = match[1].toLowerCase();
      if (phrase.includes('hari ini')) return getTodayRange();
      if (phrase.includes('semalam')) return getYesterdayRange();
      if (phrase.includes('minggu lepas')) return getLastWeekRange();
      if (phrase.includes('bulan lepas')) return getLastMonthRange();
      return getRecentDateRange(7);
    },
    priority: 2,
    isHybridCapable: true,
    description: 'Malay temporal expressions'
  }
];

/**
 * Main temporal query parser function
 */
export function parseTemporalQuery(query: string, timezone: string = 'Asia/Kuala_Lumpur'): ParsedTemporalQuery {
  console.log('🕐 DEBUG: Starting temporal parsing for query:', query);
  console.log('🔍 DEBUG: Query type:', typeof query);
  console.log('🔍 DEBUG: Query length:', query.length);
  const normalizedQuery = query.toLowerCase().trim();
  console.log('🔍 DEBUG: Normalized query:', normalizedQuery);

  // ENHANCED DEBUG: Test specific patterns manually
  const testPattern = /\b(\d+)\s+(days?|weeks?|months?)\s+ago\b/i;
  const testMatch = normalizedQuery.match(testPattern);
  console.log('🔍 DEBUG: Manual pattern test for "X days ago":', {
    pattern: testPattern.toString(),
    match: testMatch ? testMatch[0] : null,
    groups: testMatch ? testMatch.slice(1) : null
  });

  // ENHANCED DEBUG: Test the new "find receipts from last week" pattern
  const findReceiptsPattern = /\b(find|get|show|give)\s+(me\s+)?(all\s+)?(receipts?|purchases?|expenses?)\s+(from|in|during)\s+(last\s+week|this\s+week|last\s+month|this\s+month)\b/i;
  const findReceiptsMatch = normalizedQuery.match(findReceiptsPattern);
  console.log('🔍 DEBUG: Manual pattern test for "find receipts from temporal":', {
    pattern: findReceiptsPattern.toString(),
    match: findReceiptsMatch ? findReceiptsMatch[0] : null,
    groups: findReceiptsMatch ? findReceiptsMatch.slice(1) : null,
    query: normalizedQuery
  });

  const result: ParsedTemporalQuery = {
    originalQuery: query,
    searchTerms: [],
    queryType: 'general',
    confidence: 0.5,
    filters: {}
  };

  console.log('🕐 Parsing temporal query:', { query, timezone });

  // Parse temporal expressions with priority ordering
  let temporalMatch: RegExpMatchArray | null = null;
  let matchedPattern: TemporalPattern | null = null;
  let highestPriority = 999;

  console.log('🔍 DEBUG: Testing', TEMPORAL_PATTERNS.length, 'temporal patterns...');

  for (const pattern of TEMPORAL_PATTERNS) {
    const match = normalizedQuery.match(pattern.pattern);
    console.log('🔍 DEBUG: Testing pattern:', {
      description: pattern.description,
      pattern: pattern.pattern.toString(),
      matched: !!match,
      matchResult: match ? match[0] : null
    });

    if (match && pattern.priority < highestPriority) {
      temporalMatch = match;
      matchedPattern = pattern;
      highestPriority = pattern.priority;

      console.log('🎯 Temporal pattern matched:', {
        pattern: pattern.description,
        priority: pattern.priority,
        match: match[0],
        isHybridCapable: pattern.isHybridCapable,
        fullMatch: match
      });
    }
  }

  // Apply the best temporal match
  if (temporalMatch && matchedPattern) {
    try {
      result.dateRange = matchedPattern.handler(temporalMatch);
      result.queryType = 'temporal';
      result.confidence += 0.3;

      console.log('📅 Date range calculated:', result.dateRange);
      console.log('🔍 DEBUG: Temporal handler result details:', {
        pattern: matchedPattern.description,
        match: temporalMatch[0],
        dateRangeStart: result.dateRange?.start,
        dateRangeEnd: result.dateRange?.end,
        queryType: result.queryType,
        confidence: result.confidence
      });

      // Detect hybrid temporal queries
      const semanticTerms = extractSemanticTermsFromQuery(normalizedQuery, temporalMatch);
      const hasSemanticContent = semanticTerms.length > 0;

      // Special handling for "from X days ago" queries - always use hybrid routing
      const isFromQuery = matchedPattern.description.includes('From X days ago') ||
                          matchedPattern.description.includes('From a/one unit ago');
      const shouldUseHybrid = (hasSemanticContent && matchedPattern.isHybridCapable) || isFromQuery;

      result.temporalIntent = {
        isTemporalQuery: true,
        hasSemanticContent: hasSemanticContent || isFromQuery, // Treat "from" queries as having semantic content
        routingStrategy: shouldUseHybrid
          ? 'hybrid_temporal_semantic'
          : hasSemanticContent
          ? 'semantic_only'
          : 'date_filter_only',
        temporalConfidence: 0.8,
        semanticTerms: isFromQuery ? [...semanticTerms, 'receipts'] : semanticTerms // Add 'receipts' for from queries
      };

      if (shouldUseHybrid && matchedPattern.isHybridCapable) {
        result.queryType = 'hybrid_temporal';
        result.confidence += 0.2;
      }

      console.log('🔀 Temporal routing strategy:', result.temporalIntent.routingStrategy);
    } catch (error) {
      console.error('❌ Error processing temporal match:', error);
    }
  }

  // Parse monetary expressions (add monetary parsing logic)
  console.log('💰 DEBUG: Starting monetary parsing for query:', normalizedQuery);

  // Enhanced amount patterns with better currency detection
  const amountPatterns = [
    // "over $100", "above RM50", "more than $25", "over $100 USD"
    {
      pattern: /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(usd|myr|rm|dollars?|ringgit)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseFloat(match[3]);
        // Parsed "over" amount
        return {
          min: amount,
          currency: 'MYR', // Default to MYR for Malaysian context
          originalAmount: amount,
          originalCurrency: 'MYR'
        };
      }
    },
    // "under $50", "below RM100", "less than $30 USD"
    {
      pattern: /\b(under|below|less\s+than|cheaper\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(usd|myr|rm|dollars?|ringgit)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseFloat(match[3]);
        // Parsed "under" amount
        return {
          max: amount,
          currency: 'MYR', // Default to MYR for Malaysian context
          originalAmount: amount,
          originalCurrency: 'MYR'
        };
      }
    },
    // "$20 to $50", "RM100-RM200"
    {
      pattern: /\b(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(?:to|[-–])\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        const minAmount = parseFloat(match[2]);
        const maxAmount = parseFloat(match[4]);
        // Parsed range amounts
        return {
          min: minAmount,
          max: maxAmount,
          currency: 'MYR', // Default to MYR for Malaysian context
          originalAmount: minAmount,
          originalCurrency: 'MYR'
        };
      }
    },
    // "between $20 and $50"
    {
      pattern: /\bbetween\s+(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s+and\s+(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        const minAmount = parseFloat(match[2]);
        const maxAmount = parseFloat(match[4]);
        console.log('💰 DEBUG: Parsed "between" amounts:', { minAmount, maxAmount });
        return {
          min: minAmount,
          max: maxAmount,
          currency: 'MYR', // Default to MYR for Malaysian context
          originalAmount: minAmount,
          originalCurrency: 'MYR'
        };
      }
    }
  ];

  // Parse amount expressions
  console.log('💰 DEBUG: Testing amount patterns against query:', normalizedQuery);
  console.log('💰 DEBUG: Available amount patterns:', amountPatterns.length);

  for (let i = 0; i < amountPatterns.length; i++) {
    const { pattern, handler } = amountPatterns[i];
    console.log(`💰 DEBUG: Testing pattern ${i + 1}/${amountPatterns.length}:`, pattern.source);

    const match = normalizedQuery.match(pattern);
    if (match) {
      console.log('💰 ✅ AMOUNT PATTERN MATCHED:', {
        patternIndex: i + 1,
        patternSource: pattern.source,
        matchedText: match[0],
        fullMatch: match,
        groups: match.slice(1),
        query: normalizedQuery
      });

      const amountRange = handler(match);
      result.amountRange = amountRange;
      result.queryType = result.queryType === 'general' ? 'amount' : 'mixed';
      result.confidence += 0.3;

      console.log('💰 ✅ AMOUNT RANGE EXTRACTED:', {
        amountRange,
        min: amountRange.min,
        max: amountRange.max,
        currency: amountRange.currency,
        originalAmount: amountRange.originalAmount,
        originalCurrency: amountRange.originalCurrency
      });
      break; // Use first match
    } else {
      console.log(`💰 ❌ Pattern ${i + 1} did not match`);
    }
  }

  if (!result.amountRange) {
    console.log('💰 ⚠️ NO AMOUNT PATTERNS MATCHED for query:', normalizedQuery);
  }

  // Extract search terms (excluding temporal expressions)
  result.searchTerms = extractSemanticTermsFromQuery(normalizedQuery, temporalMatch);

  // 🔧 FIX: Enable enhanced search routing for monetary queries
  // Monetary queries need enhanced search path for threshold adjustment
  if (result.amountRange && !result.temporalIntent) {
    console.log('💰 DEBUG: Enabling enhanced search routing for monetary query');
    const hasSemanticContent = result.searchTerms.length > 0;

    result.temporalIntent = {
      isTemporalQuery: true, // Enable enhanced search path
      hasSemanticContent,
      routingStrategy: hasSemanticContent ? 'semantic_only' : 'date_filter_only',
      temporalConfidence: 0.8,
      semanticTerms: result.searchTerms
    };

    console.log('💰 DEBUG: Set temporal intent for monetary query:', result.temporalIntent);
  }

  console.log('✅ Temporal parsing complete:', {
    queryType: result.queryType,
    confidence: result.confidence,
    hasDateRange: !!result.dateRange,
    hasAmountRange: !!result.amountRange,
    hasTemporalIntent: !!result.temporalIntent,
    isTemporalQuery: result.temporalIntent?.isTemporalQuery || false,
    routingStrategy: result.temporalIntent?.routingStrategy || 'none',
    dateRange: result.dateRange || 'none',
    amountRange: result.amountRange || 'none',
    searchTermsCount: result.searchTerms.length
  });

  console.log('🔍 DEBUG: Full temporal parsing result:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * Extract semantic terms from query after removing temporal expressions
 */
function extractSemanticTermsFromQuery(query: string, temporalMatch: RegExpMatchArray | null): string[] {
  let cleanQuery = query;

  // Remove temporal expressions
  if (temporalMatch) {
    cleanQuery = cleanQuery.replace(temporalMatch[0], '');
  }

  // CRITICAL FIX: Don't remove semantic content words like "receipts", "purchases", "expenses"
  // These are important for determining hasSemanticContent for temporal routing
  const semanticContentWords = ['receipts', 'purchases', 'expenses', 'receipt', 'purchase', 'expense'];
  const foundSemanticWords = semanticContentWords.filter(word =>
    query.toLowerCase().includes(word)
  );

  // Remove only stop words and action words, but preserve semantic content
  cleanQuery = cleanQuery
    .replace(/\b(show|me|all|list|find|get|give)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into meaningful terms and add back semantic content words
  const terms = cleanQuery
    .split(/\s+/)
    .filter(term => term.length > 2)
    .filter(term => !/^\d+$/.test(term))
    .filter(term => !['and', 'or', 'the', 'for', 'with', 'from', 'all'].includes(term.toLowerCase()));

  // Always include found semantic content words
  const allTerms = [...new Set([...terms, ...foundSemanticWords])];

  console.log('🔍 DEBUG: Semantic term extraction:', {
    originalQuery: query,
    cleanQuery,
    foundSemanticWords,
    extractedTerms: terms,
    finalTerms: allTerms
  });

  return allTerms;
}

/**
 * Helper function to detect temporal context from matched patterns
 */
function detectTemporalFromContext(temporalPhrase: string): DateRange {
  const phrase = temporalPhrase.toLowerCase().trim();
  
  if (phrase.includes('last week')) return getLastWeekRange();
  if (phrase.includes('this week')) return getThisWeekRange();
  if (phrase.includes('last month')) return getLastMonthRange();
  if (phrase.includes('this month')) return getThisMonthRange();
  
  return getRecentDateRange(7);
}

// Helper function to format date to YYYY-MM-DD without timezone issues
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Date range calculation functions (consolidated and consistent)
function getRecentDateRange(days: number): DateRange {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  
  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    preset: `recent_${days}_days`
  };
}

function getTodayRange(): DateRange {
  const today = formatDateToYYYYMMDD(new Date());
  return {
    start: today,
    end: today,
    preset: 'today'
  };
}

function getYesterdayRange(): DateRange {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = formatDateToYYYYMMDD(yesterday);

  return {
    start: dateStr,
    end: dateStr,
    preset: 'yesterday'
  };
}

function getThisWeekRange(): DateRange {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  
  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    preset: 'this_week'
  };
}

function getLastWeekRange(): DateRange {
  const now = new Date();

  // FIXED: Use proper Monday-to-Sunday week calculation
  // Get the start of this week (Monday)
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert Sunday to 6

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - daysFromMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  // CORRECTED: Last week starts exactly 7 days before start of this week
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  // End of last week = 6 days after start of last week (Sunday)
  const endOfLastWeek = new Date(startOfLastWeek);
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
  endOfLastWeek.setHours(23, 59, 59, 999);

  // FIXED: Use local date formatting to avoid timezone issues
  const result = {
    start: formatDateToYYYYMMDD(startOfLastWeek),
    end: formatDateToYYYYMMDD(endOfLastWeek),
    preset: 'last_week'
  };

  // Verify the calculation is correct (should be exactly 7 days)
  const startDate = new Date(result.start);
  const endDate = new Date(result.end);
  const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  console.log('🔍 DEBUG: getLastWeekRange calculation:', {
    currentDate: now.toISOString(),
    currentDayOfWeek,
    daysFromMonday,
    startOfThisWeek: startOfThisWeek.toISOString(),
    startOfLastWeek: startOfLastWeek.toISOString(),
    endOfLastWeek: endOfLastWeek.toISOString(),
    result,
    verification: {
      daysDifference: daysDiff,
      totalDays: daysDiff + 1,
      isCorrect: daysDiff === 6 // 6 days difference = 7 days total
    }
  });

  return result;
}

function getThisMonthRange(): DateRange {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return {
    start: startOfMonth.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    preset: 'this_month'
  };
}

function getLastMonthRange(): DateRange {
  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  return {
    start: startOfLastMonth.toISOString().split('T')[0],
    end: endOfLastMonth.toISOString().split('T')[0],
    preset: 'last_month'
  };
}

function getRelativeDateRange(amount: number, unit: string): DateRange {
  const now = new Date();
  const start = new Date();

  switch (unit.toLowerCase()) {
    case 'minute':
    case 'minutes':
      start.setMinutes(start.getMinutes() - amount);
      break;
    case 'hour':
    case 'hours':
      start.setHours(start.getHours() - amount);
      break;
    case 'day':
    case 'days':
      start.setDate(start.getDate() - amount);
      break;
    case 'week':
    case 'weeks':
      start.setDate(start.getDate() - (amount * 7));
      break;
    case 'month':
    case 'months':
      start.setMonth(start.getMonth() - amount);
      break;
    default:
      start.setDate(start.getDate() - amount);
  }

  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
    preset: `last_${amount}_${unit.toLowerCase()}`
  };
}

/**
 * Get date range for "from X days ago" queries
 * Returns receipts from X days ago to today (range query)
 */
function getFromDaysAgoRange(amount: number, unit: string): DateRange {
  const today = new Date();
  const startDate = new Date();

  switch (unit.toLowerCase()) {
    case 'minute':
    case 'minutes':
      startDate.setMinutes(startDate.getMinutes() - amount);
      break;
    case 'hour':
    case 'hours':
      startDate.setHours(startDate.getHours() - amount);
      break;
    case 'day':
    case 'days':
      startDate.setDate(startDate.getDate() - amount);
      break;
    case 'week':
    case 'weeks':
      startDate.setDate(startDate.getDate() - (amount * 7));
      break;
    case 'month':
    case 'months':
      startDate.setMonth(startDate.getMonth() - amount);
      break;
    default:
      startDate.setDate(startDate.getDate() - amount);
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = today.toISOString().split('T')[0];

  console.log(`📅 Date range calculated for "from ${amount} ${unit} ago": ${startDateStr} to ${endDateStr}`);

  return {
    start: startDateStr,
    end: endDateStr,
    preset: `from_${amount}_${unit.toLowerCase()}_ago`
  };
}

/**
 * Get exact date range for "X days ago" queries
 * Returns receipts from exactly X days ago (single day), not a range
 */
function getExactDaysAgoRange(amount: number, unit: string): DateRange {
  const targetDate = new Date();

  switch (unit.toLowerCase()) {
    case 'minute':
    case 'minutes':
      targetDate.setMinutes(targetDate.getMinutes() - amount);
      break;
    case 'hour':
    case 'hours':
      targetDate.setHours(targetDate.getHours() - amount);
      break;
    case 'day':
    case 'days':
      targetDate.setDate(targetDate.getDate() - amount);
      break;
    case 'week':
    case 'weeks':
      targetDate.setDate(targetDate.getDate() - (amount * 7));
      break;
    case 'month':
    case 'months':
      targetDate.setMonth(targetDate.getMonth() - amount);
      break;
    default:
      targetDate.setDate(targetDate.getDate() - amount);
  }

  const dateStr = targetDate.toISOString().split('T')[0];

  console.log(`📅 Exact date calculated for "${amount} ${unit} ago": ${dateStr}`);

  return {
    start: dateStr,
    end: dateStr,
    preset: `exact_${amount}_${unit.toLowerCase()}_ago`
  };
}

/**
 * Get date range for a specific date (month and day)
 * Assumes current year if not specified
 */
function getSpecificDateRange(month: number, day: number): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Create the target date
  const targetDate = new Date(currentYear, month - 1, day); // month is 0-indexed

  console.log(`🔍 DEBUG: Date comparison - now: ${now.toISOString()}, targetDate: ${targetDate.toISOString()}`);
  console.log(`🔍 DEBUG: targetDate > now? ${targetDate > now}`);

  // If the target date is in the future, use previous year
  if (targetDate > now) {
    console.log(`📅 DEBUG: Target date is in future, using previous year`);
    targetDate.setFullYear(currentYear - 1);
  } else {
    console.log(`📅 DEBUG: Target date is in past/present, using current year`);
  }

  const dateStr = targetDate.toISOString().split('T')[0];

  console.log(`📅 Specific date calculated: ${month}/${day} -> ${dateStr} (year: ${targetDate.getFullYear()})`);

  return {
    start: dateStr,
    end: dateStr,
    preset: `specific_date_${month}_${day}`
  };
}
