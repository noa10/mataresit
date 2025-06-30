/**
 * Enhanced Natural Language Query Parser for Mataresit
 * Handles temporal expressions, merchant names, categories, and amount ranges
 */

import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { detectCurrencyFromInput, normalizeMonetaryQuery } from './currency-converter';

export interface ParsedQuery {
  originalQuery: string;
  searchTerms: string[];
  dateRange?: {
    start: string;
    end: string;
    preset?: string;
  };
  amountRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  merchants?: string[];
  categories?: string[];
  queryType: 'temporal' | 'merchant' | 'category' | 'amount' | 'general' | 'mixed' | 'hybrid_temporal';
  confidence: number;
  filters: {
    [key: string]: any;
  };
  // Enhanced temporal query routing
  temporalIntent?: {
    isTemporalQuery: boolean;
    hasSemanticContent: boolean;
    routingStrategy: 'date_filter_only' | 'semantic_only' | 'hybrid_temporal_semantic';
    temporalConfidence: number;
    semanticTerms: string[];
  };
}

/**
 * Enhanced natural language query parser with better temporal understanding
 */
export function parseNaturalLanguageQuery(query: string, userTimezone: string = 'Asia/Kuala_Lumpur'): ParsedQuery {
  const normalizedQuery = query.toLowerCase().trim();
  const now = new Date();
  
  const result: ParsedQuery = {
    originalQuery: query,
    searchTerms: [],
    queryType: 'general',
    confidence: 0.5,
    filters: {}
  };

  // Enhanced temporal expression patterns with hybrid detection
  const temporalPatterns = [
    // Recent/Last patterns
    { pattern: /\b(recent|latest|last)\s+(receipts?|purchases?|expenses?)\b/i, handler: () => getRecentDateRange(7), isHybridCapable: false },
    { pattern: /\b(today|today's)\s*(receipts?|purchases?|expenses?)?\b/i, handler: () => getTodayRange(), isHybridCapable: false },
    { pattern: /\b(yesterday|yesterday's)\s*(receipts?|purchases?|expenses?)?\b/i, handler: () => getYesterdayRange(), isHybridCapable: false },
    { pattern: /\b(this\s+week|current\s+week)\b/i, handler: () => getThisWeekRange(), isHybridCapable: true },
    { pattern: /\b(last\s+week|previous\s+week)\b/i, handler: () => getLastWeekRange(), isHybridCapable: true },
    { pattern: /\b(this\s+month|current\s+month)\b/i, handler: () => getThisMonthRange(), isHybridCapable: true },
    { pattern: /\b(last\s+month|previous\s+month)\b/i, handler: () => getLastMonthRange(), isHybridCapable: true },
    { pattern: /\b(this\s+year|current\s+year)\b/i, handler: () => getThisYearRange(), isHybridCapable: true },
    { pattern: /\b(last\s+year|previous\s+year)\b/i, handler: () => getLastYearRange(), isHybridCapable: true },

    // Specific time periods
    { pattern: /\b(last|past)\s+(\d+)\s+(days?|weeks?|months?)\b/i, handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[2]), match[3]), isHybridCapable: true },
    { pattern: /\b(in\s+the\s+last|within\s+the\s+last|over\s+the\s+last)\s+(\d+)\s+(days?|weeks?|months?)\b/i, handler: (match: RegExpMatchArray) => getRelativeDateRange(parseInt(match[2]), match[3]), isHybridCapable: true },

    // Enhanced hybrid patterns that combine temporal + semantic
    { pattern: /\b(recent|latest)\s+([a-zA-Z\s]+)\s+(receipts?|purchases?|expenses?)\b/i, handler: () => getRecentDateRange(7), isHybridCapable: true },
    { pattern: /\b([a-zA-Z\s]+)\s+(from|in|during)\s+(last\s+week|this\s+week|last\s+month|this\s+month)\b/i, handler: (match: RegExpMatchArray) => detectTemporalFromContext(match[3]), isHybridCapable: true },
    { pattern: /\b(last\s+week|this\s+week|last\s+month|this\s+month)\s+([a-zA-Z\s]+)\s+(receipts?|purchases?|expenses?)\b/i, handler: (match: RegExpMatchArray) => detectTemporalFromContext(match[1]), isHybridCapable: true },
  ];

  // Enhanced amount patterns with better currency detection
  const amountPatterns = [
    // "over $100", "above RM50", "more than $25", "over $100 USD"
    {
      pattern: /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(usd|myr|rm|dollars?|ringgit)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseFloat(match[3]);
        // Use the full match to get better currency context
        const fullMatch = match[0] + (match[4] ? ` ${match[4]}` : '');
        const currencyDetection = detectCurrencyFromInput(fullMatch);
        const normalized = normalizeMonetaryQuery(fullMatch, amount, currencyDetection.currency);

        return {
          min: normalized.normalizedAmount,
          currency: normalized.targetCurrency,
          originalAmount: amount,
          originalCurrency: currencyDetection.currency,
          conversionInfo: normalized.conversionInfo
        };
      }
    },
    // "under $50", "below RM100", "less than $30 USD"
    {
      pattern: /\b(under|below|less\s+than|cheaper\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(usd|myr|rm|dollars?|ringgit)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseFloat(match[3]);
        // Use the full match to get better currency context
        const fullMatch = match[0] + (match[4] ? ` ${match[4]}` : '');
        const currencyDetection = detectCurrencyFromInput(fullMatch);
        const normalized = normalizeMonetaryQuery(fullMatch, amount, currencyDetection.currency);

        return {
          max: normalized.normalizedAmount,
          currency: normalized.targetCurrency,
          originalAmount: amount,
          originalCurrency: currencyDetection.currency,
          conversionInfo: normalized.conversionInfo
        };
      }
    },
    // "$20 to $50", "RM100-RM200"
    {
      pattern: /\b(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(?:to|[-–])\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        const minAmount = parseFloat(match[2]);
        const maxAmount = parseFloat(match[4]);
        const currencyDetection = detectCurrencyFromInput(match[0]);
        const normalizedMin = normalizeMonetaryQuery(match[0], minAmount, currencyDetection.currency);
        const normalizedMax = normalizeMonetaryQuery(match[0], maxAmount, currencyDetection.currency);

        return {
          min: normalizedMin.normalizedAmount,
          max: normalizedMax.normalizedAmount,
          currency: normalizedMin.targetCurrency,
          originalMinAmount: minAmount,
          originalMaxAmount: maxAmount,
          originalCurrency: currencyDetection.currency,
          conversionInfo: normalizedMin.conversionInfo
        };
      }
    },
    // "between $20 and $50"
    {
      pattern: /\bbetween\s+(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s+and\s+(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        const minAmount = parseFloat(match[2]);
        const maxAmount = parseFloat(match[4]);
        const currencyDetection = detectCurrencyFromInput(match[0]);
        const normalizedMin = normalizeMonetaryQuery(match[0], minAmount, currencyDetection.currency);
        const normalizedMax = normalizeMonetaryQuery(match[0], maxAmount, currencyDetection.currency);

        return {
          min: normalizedMin.normalizedAmount,
          max: normalizedMax.normalizedAmount,
          currency: normalizedMin.targetCurrency,
          originalMinAmount: minAmount,
          originalMaxAmount: maxAmount,
          originalCurrency: currencyDetection.currency,
          conversionInfo: normalizedMin.conversionInfo
        };
      }
    },
  ];



  // Merchant patterns (common Malaysian businesses)
  const merchantPatterns = [
    /\b(starbucks|coffee\s+bean|old\s+town|kopitiam)\b/i,
    /\b(mcdonalds?|kfc|burger\s+king|subway|pizza\s+hut)\b/i,
    /\b(tesco|giant|aeon|jaya\s+grocer|village\s+grocer)\b/i,
    /\b(shell|petronas|bhp|caltex)\b/i,
    /\b(grab|foodpanda|shopee|lazada)\b/i,
    /\b(uniqlo|h&m|zara|cotton\s+on)\b/i,
  ];

  // Category patterns
  const categoryPatterns = [
    { pattern: /\b(food|restaurant|dining|meal|lunch|dinner|breakfast)\b/i, category: 'Food & Dining' },
    { pattern: /\b(grocery|groceries|supermarket|market)\b/i, category: 'Groceries' },
    { pattern: /\b(fuel|gas|petrol|gasoline)\b/i, category: 'Fuel' },
    { pattern: /\b(transport|transportation|taxi|grab|bus|train)\b/i, category: 'Transportation' },
    { pattern: /\b(shopping|clothes|clothing|fashion|retail)\b/i, category: 'Shopping' },
    { pattern: /\b(office|supplies|stationery|equipment)\b/i, category: 'Office Supplies' },
    { pattern: /\b(travel|hotel|flight|vacation|holiday)\b/i, category: 'Travel' },
    { pattern: /\b(medical|health|pharmacy|doctor|clinic)\b/i, category: 'Healthcare' },
    { pattern: /\b(entertainment|movie|cinema|game|leisure)\b/i, category: 'Entertainment' },
  ];

  // Enhanced temporal expression parsing with hybrid detection
  let temporalMatch = null;
  let isHybridCapable = false;

  for (const { pattern, handler, isHybridCapable: hybridCapable } of temporalPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      result.dateRange = handler(match);
      temporalMatch = match;
      isHybridCapable = hybridCapable;
      result.queryType = result.queryType === 'general' ? 'temporal' : 'mixed';
      result.confidence += 0.3;
      break;
    }
  }

  // Detect if this is a hybrid temporal query (has both temporal and semantic content)
  if (temporalMatch) {
    const semanticTerms = extractSemanticTermsFromQuery(normalizedQuery, temporalMatch);
    const hasSemanticContent = semanticTerms.length > 0;

    result.temporalIntent = {
      isTemporalQuery: true,
      hasSemanticContent,
      routingStrategy: hasSemanticContent && isHybridCapable ? 'hybrid_temporal_semantic' :
                      hasSemanticContent ? 'semantic_only' : 'date_filter_only',
      temporalConfidence: 0.8,
      semanticTerms
    };

    // Update query type for hybrid queries
    if (hasSemanticContent && isHybridCapable) {
      result.queryType = 'hybrid_temporal';
      result.confidence += 0.2; // Bonus for hybrid understanding
    }
  } else {
    result.temporalIntent = {
      isTemporalQuery: false,
      hasSemanticContent: true,
      routingStrategy: 'semantic_only',
      temporalConfidence: 0.0,
      semanticTerms: []
    };
  }

  // Parse amount expressions
  console.log('💰 DEBUG: Starting amount pattern matching for query:', normalizedQuery);
  for (const { pattern, handler } of amountPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      console.log('💰 DEBUG: Amount pattern matched:', {
        pattern: pattern.source,
        match: match[0],
        fullMatch: match,
        groups: match.slice(1)
      });

      result.amountRange = handler(match);
      result.queryType = result.queryType === 'general' ? 'amount' : 'mixed';
      result.confidence += 0.2;

      console.log('💰 DEBUG: Amount range extracted by parser:', {
        amountRange: result.amountRange,
        min: result.amountRange?.min,
        max: result.amountRange?.max,
        minType: typeof result.amountRange?.min,
        maxType: typeof result.amountRange?.max,
        currency: result.amountRange?.currency,
        originalAmount: result.amountRange?.originalAmount,
        originalCurrency: result.amountRange?.originalCurrency
      });
      break;
    }
  }

  if (!result.amountRange) {
    console.log('💰 DEBUG: No amount patterns matched for query:', normalizedQuery);
  }

  // Parse merchant names
  const foundMerchants: string[] = [];
  for (const pattern of merchantPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      foundMerchants.push(match[0]);
      result.queryType = result.queryType === 'general' ? 'merchant' : 'mixed';
      result.confidence += 0.25;
    }
  }
  if (foundMerchants.length > 0) {
    result.merchants = foundMerchants;
  }

  // Parse categories
  const foundCategories: string[] = [];
  for (const { pattern, category } of categoryPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      foundCategories.push(category);
      result.queryType = result.queryType === 'general' ? 'category' : 'mixed';
      result.confidence += 0.2;
    }
  }
  if (foundCategories.length > 0) {
    result.categories = foundCategories;
  }

  // Extract remaining search terms (remove temporal, amount, and known merchant/category words)
  let cleanQuery = normalizedQuery;
  
  // Remove temporal expressions
  cleanQuery = cleanQuery.replace(/\b(recent|latest|last|today|yesterday|this|current|previous|past|within|over|in\s+the)\s+(week|month|year|days?|weeks?|months?|receipts?|purchases?|expenses?)\b/gi, '');
  
  // Remove amount expressions
  cleanQuery = cleanQuery.replace(/\b(over|above|more\s+than|greater\s+than|under|below|less\s+than|cheaper\s+than|between)\s*[rm$€£¥]?\d+(?:\.\d{2})?\b/gi, '');
  cleanQuery = cleanQuery.replace(/\b[rm$€£¥]?\d+(?:\.\d{2})?\s*(?:to|[-–])\s*[rm$€£¥]?\d+(?:\.\d{2})?\b/gi, '');
  
  // Remove category words
  cleanQuery = cleanQuery.replace(/\b(food|restaurant|dining|meal|grocery|groceries|fuel|gas|transport|shopping|office|supplies|travel|medical|entertainment)\b/gi, '');
  
  // Extract meaningful search terms
  const searchTerms = cleanQuery
    .split(/\s+/)
    .filter(term => term.length > 2 && !['the', 'and', 'or', 'from', 'for', 'with', 'show', 'find', 'get', 'all'].includes(term))
    .map(term => term.trim());

  result.searchTerms = searchTerms;

  // Adjust confidence based on how much we understood
  if (result.dateRange) result.confidence += 0.2;
  if (result.amountRange) result.confidence += 0.15;
  if (result.merchants && result.merchants.length > 0) result.confidence += 0.15;
  if (result.categories && result.categories.length > 0) result.confidence += 0.1;
  if (searchTerms.length > 0) result.confidence += 0.1;

  // Cap confidence at 1.0
  result.confidence = Math.min(result.confidence, 1.0);

  return result;
}

// Test function for debugging (can be removed in production)
export function testQueryParsing() {
  const testQueries = [
    "receipts over $100",
    "receipts under RM50",
    "receipts between $20 and $50",
    "all receipts over $100",
    "show me receipts above RM200"
  ];

  console.log('🧪 Testing query parsing:');
  testQueries.forEach(query => {
    const result = parseNaturalLanguageQuery(query);
    console.log(`Query: "${query}"`);
    console.log(`Result:`, result);
    console.log('---');
  });
}

// Helper functions for date range calculations
function getRecentDateRange(days: number = 7) {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), days));
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    preset: `last_${days}_days`
  };
}

function getTodayRange() {
  const today = new Date();
  return {
    start: format(startOfDay(today), 'yyyy-MM-dd'),
    end: format(endOfDay(today), 'yyyy-MM-dd'),
    preset: 'today'
  };
}

function getYesterdayRange() {
  const yesterday = subDays(new Date(), 1);
  return {
    start: format(startOfDay(yesterday), 'yyyy-MM-dd'),
    end: format(endOfDay(yesterday), 'yyyy-MM-dd'),
    preset: 'yesterday'
  };
}

function getThisWeekRange() {
  const now = new Date();
  return {
    start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    preset: 'this_week'
  };
}

function getLastWeekRange() {
  const lastWeek = subWeeks(new Date(), 1);
  return {
    start: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    preset: 'last_week'
  };
}

function getThisMonthRange() {
  const now = new Date();
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
    preset: 'this_month'
  };
}

function getLastMonthRange() {
  const lastMonth = subMonths(new Date(), 1);
  return {
    start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
    end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
    preset: 'last_month'
  };
}

function getThisYearRange() {
  const now = new Date();
  return {
    start: format(startOfYear(now), 'yyyy-MM-dd'),
    end: format(endOfYear(now), 'yyyy-MM-dd'),
    preset: 'this_year'
  };
}

function getLastYearRange() {
  const lastYear = new Date(new Date().getFullYear() - 1, 0, 1);
  return {
    start: format(startOfYear(lastYear), 'yyyy-MM-dd'),
    end: format(endOfYear(lastYear), 'yyyy-MM-dd'),
    preset: 'last_year'
  };
}

function getRelativeDateRange(amount: number, unit: string) {
  const now = new Date();
  let start: Date;

  switch (unit.toLowerCase()) {
    case 'day':
    case 'days':
      start = startOfDay(subDays(now, amount));
      break;
    case 'week':
    case 'weeks':
      start = startOfDay(subWeeks(now, amount));
      break;
    case 'month':
    case 'months':
      start = startOfDay(subMonths(now, amount));
      break;
    default:
      start = startOfDay(subDays(now, amount));
  }

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(endOfDay(now), 'yyyy-MM-dd'),
    preset: `last_${amount}_${unit}`
  };
}

/**
 * Helper function to detect temporal context from matched patterns
 */
function detectTemporalFromContext(temporalPhrase: string) {
  const phrase = temporalPhrase.toLowerCase().trim();

  if (phrase.includes('last week')) return getLastWeekRange();
  if (phrase.includes('this week')) return getThisWeekRange();
  if (phrase.includes('last month')) return getLastMonthRange();
  if (phrase.includes('this month')) return getThisMonthRange();

  // Default to recent if unclear
  return getRecentDateRange(7);
}

/**
 * Extract semantic terms from query after removing temporal expressions
 */
function extractSemanticTermsFromQuery(query: string, temporalMatch: RegExpMatchArray): string[] {
  let cleanQuery = query;

  // Remove the temporal expression that was matched
  cleanQuery = cleanQuery.replace(temporalMatch[0], '');

  // Remove common temporal words
  cleanQuery = cleanQuery.replace(/\b(recent|latest|last|today|yesterday|this|current|previous|past|within|over|in\s+the|from|during|receipts?|purchases?|expenses?)\b/gi, '');

  // Remove extra whitespace and split into terms
  const terms = cleanQuery
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 2) // Filter out short words
    .filter(term => !/^\d+$/.test(term)) // Filter out pure numbers
    .filter(term => !['and', 'or', 'the', 'for', 'with', 'from', 'all'].includes(term.toLowerCase()));

  return terms;
}
