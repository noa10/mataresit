import { supabase } from './supabase';
import { callEdgeFunction } from './edge-function-utils';
import { UnifiedSearchParams, UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';
import { searchCache } from './searchCache';
import { searchPerformanceMonitor } from './searchPerformanceMonitor';
import { searchParameterOptimizer } from './searchParameterOptimizer';
import { advancedSearchRanking } from './advancedSearchRanking';
import { optimizedSearchExecutor } from './optimized-search-executor';
import { optimizedEdgeFunctionCaller } from './optimized-edge-function-caller';

/**
 * Normalize query to extract core search terms and remove numerical qualifiers
 * This ensures semantically similar queries generate similar embeddings
 */
function normalizeSearchQuery(query: string): string {
  console.log(`Normalizing query: "${query}"`);

  let normalizedQuery = query.toLowerCase().trim();

  // Remove numerical qualifiers that don't affect search content
  const numericalQualifiers = [
    /\b(top|first|latest|recent|show\s+me|find\s+me|get\s+me)\s+\d+\s*/gi,
    /\b(show|find|get)\s+(me\s+)?(all|any)\s*/gi,
    /\b(all|any)\s+(of\s+)?(the\s+)?/gi,
    /\b(receipts?|purchases?|expenses?|transactions?)\s+(from|at|in)\s+/gi
  ];

  // Apply normalization patterns
  for (const pattern of numericalQualifiers) {
    normalizedQuery = normalizedQuery.replace(pattern, '');
  }

  // Clean up extra spaces and common words
  normalizedQuery = normalizedQuery
    .replace(/\s+/g, ' ')
    .replace(/\b(receipts?|purchases?|expenses?|transactions?)\b/gi, '')
    .trim();

  // If the normalized query is too short, fall back to original
  if (normalizedQuery.length < 3) {
    normalizedQuery = query.toLowerCase().trim();
  }

  console.log(`Normalized query result: "${normalizedQuery}"`);
  return normalizedQuery;
}

/**
 * Type definitions for semantic search
 */
export interface SearchParams {
  query: string;
  contentType?: 'fullText' | 'merchant' | 'notes';
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  categories?: string[];
  merchants?: string[];
  isNaturalLanguage?: boolean;
  isVectorSearch?: boolean; // Indicates whether vector search was used
  searchTarget?: 'receipts' | 'line_items' | 'all'; // Target for search (receipts, line_items, or all)
}

export interface ReceiptWithSimilarity {
  id: string;
  merchant: string;
  date: string;
  total: number;
  notes?: string;
  raw_text?: string;
  predicted_category?: string;
  similarity_score: number;
  // Other receipt properties
}

export interface LineItemSearchResult {
  line_item_id: string;
  receipt_id: string;
  line_item_description: string;
  line_item_quantity?: number;
  line_item_price?: number;
  line_item_amount?: number;
  parent_receipt_merchant: string;
  parent_receipt_date: string;
  parent_receipt_id?: string; // Ensure this field is specified and documented
  receipt?: {  // Add optional receipt object that might be returned from the API
    id: string;
    merchant?: string;
    date?: string;
  };
  similarity: number;
}

export interface SearchResult {
  receipts?: ReceiptWithSimilarity[]; // Optional: results for receipts (legacy support)
  lineItems?: LineItemSearchResult[]; // Optional: results for line items (legacy support)
  results?: (ReceiptWithSimilarity | LineItemSearchResult | any)[]; // Combined results for unified search (any for UnifiedSearchResult)
  count: number;
  total: number;
  searchParams: SearchParams | any; // Allow any for unified search params
  searchMetadata?: any; // Optional metadata from unified search
}

/**
 * Perform semantic search on receipts
 * 🚨 DEPRECATED: This function is being phased out in favor of unified-search Edge Function
 * Only use this for fallback scenarios (CORS errors, authentication issues)
 */
export async function semanticSearch(params: SearchParams): Promise<SearchResult> {
  try {
    console.log('🔍 FALLBACK: Starting ai-search.ts semantic search with params:', params);
    console.log('⚠️  NOTE: Consider using unified-search Edge Function instead for better performance');

    // Log monetary query parameters specifically
    if (params.minAmount !== undefined || params.maxAmount !== undefined) {
      console.log('💰 FALLBACK: Monetary search detected in semanticSearch:', {
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
        minAmountType: typeof params.minAmount,
        maxAmountType: typeof params.maxAmount,
        query: params.query
      });
    }

    // Check if query is empty
    if (!params.query || params.query.trim() === '') {
      console.error('Empty search query');
      return {
        receipts: [],
        lineItems: [],
        results: [],
        count: 0,
        total: 0,
        searchParams: params,
      };
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('User is not authenticated');
      return {
        receipts: [],
        lineItems: [],
        results: [],
        count: 0,
        total: 0,
        searchParams: params,
      };
    }

    // Helper function to process search results from the edge function
    function handleSearchResults(data: any, searchTarget: string): SearchResult {
      console.log('Processing search results from API:', {
        target: searchTarget,
        hasLineItems: !!data.results.lineItems,
        hasReceipts: !!data.results.receipts,
        raw: data.results
      });

      const results: SearchResult = {
        receipts: [],
        lineItems: [],
        results: [],
        count: data.results?.count || 0,
        total: data.results?.total || 0,
        searchParams: data.searchParams,
      };

      // Handle line item search results
      if (searchTarget === 'line_items') {
        // Try various possible response formats
        if (data.results.lineItems && Array.isArray(data.results.lineItems)) {
          console.log('Using lineItems array directly from results');

          // Add validation for receipt_id before assigning
          results.lineItems = data.results.lineItems.map((item: any) => {
            // Check for receipt_id from various sources
            let effectiveReceiptId = item.receipt_id;

            // Try to find the receipt_id from various possible locations
            if (!effectiveReceiptId && item.parent_receipt_id) {
              effectiveReceiptId = item.parent_receipt_id;
              console.log(`Using parent_receipt_id for line item:`, item.line_item_id);
            }

            // Check if receipt_id is missing and log it
            if (!effectiveReceiptId) {
              console.warn('Line item missing receipt_id:', item);
            }

            return {
              line_item_id: item.line_item_id || item.id || `item-${Math.random().toString(36).substring(2, 10)}`,
              receipt_id: effectiveReceiptId || '', // Use the effective receipt ID, ensuring at least empty string
              line_item_description: item.line_item_description || item.description || 'Unknown item',
              line_item_quantity: item.line_item_quantity || item.quantity || 1,
              line_item_price: item.line_item_price || item.price || item.amount || 0,
              line_item_amount: item.line_item_amount || item.amount || item.price || 0,
              parent_receipt_merchant: item.parent_receipt_merchant || item.merchant || 'Unknown merchant',
              parent_receipt_date: item.parent_receipt_date || item.date || '',
              parent_receipt_id: item.parent_receipt_id || effectiveReceiptId || '', // Ensure parent_receipt_id is set
              similarity: item.similarity || item.similarity_score || 0
            };
          });
        }
        else if (data.results.receipts && Array.isArray(data.results.receipts) && searchTarget === 'line_items') {
          console.log('Converting receipts format to lineItems format');

          results.lineItems = data.results.receipts.map((item: any) => {
            // Check for receipt_id from various sources
            const effectiveReceiptId = item.receipt_id || item.id;

            // Check if receipt_id is missing and log it
            if (!effectiveReceiptId) {
              console.warn('Line item (from receipts format) missing receipt_id:', item);
            }

            return {
              line_item_id: item.id || item.line_item_id || `item-${Math.random().toString(36).substring(2, 10)}`,
              receipt_id: effectiveReceiptId || '', // Use the effective receipt ID, ensuring at least empty string
              line_item_description: item.description || item.line_item_description || 'Unknown item',
              line_item_price: item.amount || item.line_item_price || item.price || 0,
              line_item_quantity: item.quantity || 1,
              parent_receipt_merchant: item.parent_receipt_merchant || item.merchant || 'Unknown merchant',
              parent_receipt_date: item.parent_receipt_date || item.date || '',
              parent_receipt_id: effectiveReceiptId || '', // Ensure parent_receipt_id is set
              similarity: item.similarity_score || item.similarity || 0
            };
          });
        }
      }
      // Handle receipt search results
      else if (data.results.receipts) {
        results.receipts = data.results.receipts;
      }

      // Add validation check for lineItems with missing receipt_id
      if (results.lineItems && results.lineItems.length > 0) {
        // Direct count of missing ids instead of complex filtering
        let missingCount = 0;

        // Attempt to repair missing receipt_ids based on other data
        for (let i = 0; i < results.lineItems.length; i++) {
          const item = results.lineItems[i];

          // If receipt_id is missing, try to extract it from line_item_id if possible
          if (!item.receipt_id) {
            missingCount++;

            // Some line item IDs might be formatted as "receipt_id:line_number"
            if (item.line_item_id && item.line_item_id.includes(':')) {
              const parts = item.line_item_id.split(':');
              if (parts.length > 1) {
                console.log(`Repairing missing receipt_id for item ${item.line_item_id} -> ${parts[0]}`);
                results.lineItems[i].receipt_id = parts[0];
              }
            }
          }
        }

        if (missingCount > 0) {
          console.error(`Warning: ${missingCount} out of ${results.lineItems.length} line items are missing receipt_id`);
        }
      }

      // Populate the unified results array for all search types
      if (searchTarget === 'all') {
        // Combine receipts and line items into a single array
        results.results = [
          ...(results.receipts || []),
          ...(results.lineItems || [])
        ];

        // Sort by similarity score (highest first)
        results.results.sort((a, b) => {
          const scoreA = 'similarity_score' in a ? a.similarity_score : ('similarity' in a ? a.similarity : 0);
          const scoreB = 'similarity_score' in b ? b.similarity_score : ('similarity' in b ? b.similarity : 0);
          return scoreB - scoreA;
        });

        // Update the count and total to reflect the combined results
        results.count = results.results.length;
        results.total = (results.receipts?.length || 0) + (results.lineItems?.length || 0);
      } else if (searchTarget === 'receipts') {
        // For backward compatibility, populate results with receipts
        results.results = [...(results.receipts || [])];
      } else if (searchTarget === 'line_items') {
        // For backward compatibility, populate results with line items
        results.results = [...(results.lineItems || [])];
      }

      console.log('Processed results:', {
        type: searchTarget,
        lineItemsCount: results.lineItems?.length || 0,
        receiptsCount: results.receipts?.length || 0,
        unifiedResultsCount: results.results?.length || 0,
        total: results.total
      });

      return results;
    }

    try {
      console.log('Performing semantic search using utility function...', params);

      // Try the unified search approach first (using the working unified-search Edge Function)
      try {
        // Normalize the query for consistent search results
        const normalizedQuery = normalizeSearchQuery(params.query);
        console.log(`Using normalized query for unified search: "${normalizedQuery}"`);

        // Convert legacy params to unified params (using frontend naming)
        const unifiedParams: UnifiedSearchParams = {
          query: normalizedQuery,
          sources: params.searchTarget === 'all'
            ? ['receipts', 'business_directory']
            : params.searchTarget === 'line_items'
            ? ['receipts'] // Line items are part of receipts
            : ['receipts'],
          contentTypes: params.contentType ? [params.contentType] : undefined,
          limit: params.limit || 10,
          offset: params.offset || 0,
          filters: {
            dateRange: params.startDate && params.endDate ? {
              start: params.startDate,
              end: params.endDate
            } : undefined,
            amountRange: params.minAmount && params.maxAmount ? {
              min: params.minAmount,
              max: params.maxAmount,
              currency: 'MYR'
            } : undefined,
            categories: params.categories,
            merchants: params.merchants
          },
          similarityThreshold: 0.2,
          includeMetadata: true,
          aggregationMode: 'relevance'
        };

        // Use the unified search function which handles proper parameter mapping
        const data = await unifiedSearch(unifiedParams);
        console.log('Unified search response:', data);

        if (!data || !data.success) {
          throw new Error(data?.error || 'Unknown error in unified search');
        }

        // Convert unified response to legacy format
        const receipts: ReceiptWithSimilarity[] = [];
        const lineItems: LineItemSearchResult[] = [];

        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((result: any) => {
            if (result.sourceType === 'receipt') {
              receipts.push({
                id: result.sourceId,
                merchant: result.metadata?.merchant || result.title,
                date: result.metadata?.date || result.createdAt,
                total: result.metadata?.total || 0,
                notes: result.metadata?.notes,
                raw_text: result.metadata?.raw_text,
                predicted_category: result.metadata?.predicted_category,
                similarity_score: result.similarity
              });
            }
            // Handle line items if they're in the results
            else if (result.contentType === 'line_items') {
              lineItems.push({
                line_item_id: result.id,
                receipt_id: result.sourceId,
                line_item_description: result.description,
                line_item_quantity: result.metadata?.quantity || 1,
                line_item_price: result.metadata?.price || 0,
                line_item_amount: result.metadata?.amount || 0,
                parent_receipt_merchant: result.metadata?.parent_receipt_merchant || result.title,
                parent_receipt_date: result.metadata?.parent_receipt_date || result.createdAt,
                parent_receipt_id: result.sourceId,
                similarity: result.similarity
              });
            }
          });
        }

        // Combine results for 'all' search target
        const combinedResults = params.searchTarget === 'all'
          ? [...receipts, ...lineItems]
          : params.searchTarget === 'line_items'
          ? lineItems
          : receipts;

        const results: SearchResult = {
          receipts,
          lineItems,
          results: combinedResults,
          count: combinedResults.length,
          total: data.totalResults || combinedResults.length,
          searchParams: params
        };

        console.log('Converted unified search results:', {
          receipts: receipts.length,
          lineItems: lineItems.length,
          total: results.total
        });

        // If we got results, return them
        if (results.results && results.results.length > 0) {
          return results;
        }

        // If no results found, try fallback search (only for receipts)
        // Note: We previously skipped fallback for merchant similarity searches,
        // but now we allow fallback to ensure similar receipts are found

        if (params.searchTarget === 'all') {
          // For 'all' search, check if both receipts and line items are empty
          if ((!results.receipts || results.receipts.length === 0) &&
              (!results.lineItems || results.lineItems.length === 0)) {
            console.log('No results from unified search, trying fallback search');
            return await fallbackBasicSearch(params);
          }
        } else if ((params.searchTarget === 'receipts' && (!results.receipts || results.receipts.length === 0)) ||
                  (params.searchTarget === 'line_items' && (!results.lineItems || results.lineItems.length === 0))) {
          console.log('No results from vector search, trying fallback search');
          // Use fallback for all search types to improve recall
          return await fallbackBasicSearch(params);
        }

        return results;
      } catch (unifiedSearchError) {
        console.warn('Unified search failed, checking if it\'s a CORS error:', unifiedSearchError);

        // Check if this is a CORS error (common in hybrid development)
        const isCorsError = unifiedSearchError instanceof Error &&
          (unifiedSearchError.message.includes('Failed to fetch') ||
           unifiedSearchError.message.includes('CORS') ||
           unifiedSearchError.message.includes('Network error'));

        if (isCorsError) {
          console.log('CORS error detected, skipping Edge Functions and using direct database search');
          console.log('Calling fallbackBasicSearch with params:', params);
          const fallbackResult = await fallbackBasicSearch(params);
          console.log('Fallback search completed with result:', fallbackResult);
          return fallbackResult;
        }

        // For non-CORS errors, try the legacy semantic-search Edge Function
        try {
          // Apply query normalization to legacy search as well
          const normalizedParams = {
            ...params,
            query: normalizeSearchQuery(params.query)
          };
          console.log(`Using normalized query for legacy search: "${normalizedParams.query}"`);

          const legacyData = await callEdgeFunction('semantic-search', 'POST', normalizedParams);
          console.log('Legacy semantic search response:', legacyData);

          if (!legacyData || !legacyData.success) {
            throw new Error(legacyData?.error || 'Unknown error in legacy semantic search');
          }

          // Process results using our helper function
          const legacyResults = handleSearchResults(legacyData, params.searchTarget || 'receipts');

          // If we got results from legacy search, return them
          if (legacyResults.results && legacyResults.results.length > 0) {
            return legacyResults;
          }

          // If still no results, fall back to basic search
          throw new Error('No results from legacy search');
        } catch (legacyError) {
          console.warn('Legacy semantic search also failed, trying basic fallback search:', legacyError);

          // Skip the database function altogether and go straight to the JavaScript fallback
          return await fallbackBasicSearch(params);
        }
      }
    } catch (vectorError) {
      console.warn('All vector search methods failed, falling back to basic search:', vectorError);

      // Fallback to basic text search if vector search fails
      return await fallbackBasicSearch(params);
    }
  } catch (error) {
    console.error('Error in semanticSearch:', error);
    throw error;
  }
}

/**
 * Fallback to basic text search when vector search is unavailable
 */
async function fallbackBasicSearch(params: SearchParams): Promise<SearchResult> {
  const { query, limit = 10, offset = 0 } = params;

  // Support fallback search for all search targets
  const isLineItemSearch = params.searchTarget === 'line_items';
  const isUnifiedSearch = params.searchTarget === 'all';

  console.log(`Fallback search for target: ${params.searchTarget}`);

  // We'll always search receipts, and optionally line items based on search target

  // Check if user is authenticated
  console.log('Checking authentication for fallback search...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('Session check result:', {
    hasSession: !!session,
    userId: session?.user?.id,
    error: sessionError?.message
  });

  if (!session) {
    console.error('User is not authenticated for fallback search');
    return {
      receipts: [],
      lineItems: [],
      results: [],
      count: 0,
      total: 0,
      searchParams: params,
    };
  }

  console.log('Starting fallback search with query:', query);

  try {
    // Enhanced query parsing for monetary queries in fallback search
    const enhancedParams = { ...params };

    // Check if this looks like a monetary query
    const monetaryPatterns = [
      /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
      /\b(under|below|less\s+than|cheaper\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
      /\b(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(?:to|[-–])\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i
    ];

    const isMonetaryQuery = monetaryPatterns.some(pattern => pattern.test(query));

    if (isMonetaryQuery) {
      console.log('💰 Detected monetary query in fallback search, applying enhanced parsing');

      // Import the enhanced query parser dynamically to avoid circular dependencies
      try {
        const { parseNaturalLanguageQuery } = await import('./enhanced-query-parser');
        const parsedQuery = parseNaturalLanguageQuery(query);
        console.log('📊 Parsed query result in fallback:', parsedQuery);

        // Apply parsed filters to search parameters
        if (parsedQuery.amountRange) {
          console.log('💰 Applying amount range to fallback search:', parsedQuery.amountRange);
          enhancedParams.minAmount = parsedQuery.amountRange.min;
          enhancedParams.maxAmount = parsedQuery.amountRange.max;
        }

        if (parsedQuery.dateRange) {
          console.log('📅 Applying date range to fallback search:', parsedQuery.dateRange);
          enhancedParams.startDate = parsedQuery.dateRange.start;
          enhancedParams.endDate = parsedQuery.dateRange.end;
        }

        if (parsedQuery.merchants && parsedQuery.merchants.length > 0) {
          console.log('🏪 Applying merchants to fallback search:', parsedQuery.merchants);
          enhancedParams.merchants = parsedQuery.merchants;
        }

        if (parsedQuery.categories && parsedQuery.categories.length > 0) {
          console.log('📂 Applying categories to fallback search:', parsedQuery.categories);
          enhancedParams.categories = parsedQuery.categories;
        }
      } catch (parseError) {
        console.warn('Failed to parse monetary query in fallback, using basic search:', parseError);
      }
    }

    // Apply query normalization for consistent fallback search
    // For monetary queries, skip text matching and rely on amount filtering
    const normalizedQuery = normalizeSearchQuery(query);
    let skipTextSearch = false;

    if (isMonetaryQuery && (enhancedParams.minAmount !== undefined || enhancedParams.maxAmount !== undefined)) {
      // For monetary queries with amount filters, skip text search and get all receipts
      // then rely on amount filtering to narrow down results
      skipTextSearch = true;
      console.log(`💰 Skipping text search for monetary query, will use amount filtering only`);
    } else {
      console.log(`Using normalized query for fallback search: "${normalizedQuery}"`);
    }

    // Parse natural language queries for date ranges
    const lowerQuery = query.toLowerCase();
    let dateFilter: { start?: string; end?: string } | null = null;

    // 🚨 EMERGENCY FIX: Add support for "from June 27" patterns
    console.log('🔍 DEBUG: Checking for temporal patterns in query:', lowerQuery);

    // Check for specific date patterns like "from June 27", "May 15", etc.
    const monthPatterns = [
      { pattern: /\b(?:from\s+)?(?:january|jan)\s+(\d{1,2})\b/i, month: 0 },
      { pattern: /\b(?:from\s+)?(?:february|feb)\s+(\d{1,2})\b/i, month: 1 },
      { pattern: /\b(?:from\s+)?(?:march|mar)\s+(\d{1,2})\b/i, month: 2 },
      { pattern: /\b(?:from\s+)?(?:april|apr)\s+(\d{1,2})\b/i, month: 3 },
      { pattern: /\b(?:from\s+)?(?:may)\s+(\d{1,2})\b/i, month: 4 },
      { pattern: /\b(?:from\s+)?(?:june|jun)\s+(\d{1,2})\b/i, month: 5 },
      { pattern: /\b(?:from\s+)?(?:july|jul)\s+(\d{1,2})\b/i, month: 6 },
      { pattern: /\b(?:from\s+)?(?:august|aug)\s+(\d{1,2})\b/i, month: 7 },
      { pattern: /\b(?:from\s+)?(?:september|sep)\s+(\d{1,2})\b/i, month: 8 },
      { pattern: /\b(?:from\s+)?(?:october|oct)\s+(\d{1,2})\b/i, month: 9 },
      { pattern: /\b(?:from\s+)?(?:november|nov)\s+(\d{1,2})\b/i, month: 10 },
      { pattern: /\b(?:from\s+)?(?:december|dec)\s+(\d{1,2})\b/i, month: 11 }
    ];

    let monthMatch = null;
    let matchedMonth = -1;

    for (const { pattern, month } of monthPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        monthMatch = match;
        matchedMonth = month;
        break;
      }
    }

    if (monthMatch && matchedMonth >= 0) {
      const day = parseInt(monthMatch[1]);
      const currentYear = new Date().getFullYear();
      const targetDate = new Date(currentYear, matchedMonth, day);

      // If the target date is in the future, use previous year
      if (targetDate > new Date()) {
        targetDate.setFullYear(currentYear - 1);
      }

      const dateStr = targetDate.toISOString().split('T')[0];
      dateFilter = { start: dateStr, end: dateStr };
      console.log('🎯 EMERGENCY FIX: Detected month/day pattern:', {
        match: monthMatch[0],
        month: matchedMonth,
        day,
        calculatedDate: dateStr,
        dateFilter
      });
    }
    // Check for other time-based queries
    else if (lowerQuery.includes('last week') || lowerQuery.includes('this week')) {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = {
        start: oneWeekAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      };
      console.log('Detected date filter for last week:', dateFilter);
    } else if (lowerQuery.includes('today')) {
      const today = new Date().toISOString().split('T')[0];
      dateFilter = { start: today, end: today };
      console.log('Detected date filter for today:', dateFilter);
    } else if (lowerQuery.includes('yesterday')) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      dateFilter = { start: yesterday, end: yesterday };
      console.log('Detected date filter for yesterday:', dateFilter);
    }

    // Build a basic text search query
    let textQuery = supabase
      .from('receipts')
      .select('*')
      .limit(limit)
      .order('date', { ascending: false });

    // Store filters to apply later (after textQuery is finalized)
    const finalDateFilter = dateFilter || (enhancedParams.startDate && enhancedParams.endDate ? {
      start: enhancedParams.startDate,
      end: enhancedParams.endDate
    } : null);

    // Store amount filters to apply after textQuery is built
    const amountFilters = {
      minAmount: enhancedParams.minAmount,
      maxAmount: enhancedParams.maxAmount
    };

    // Store other filters to apply later
    const otherFilters = {
      merchants: enhancedParams.merchants,
      categories: enhancedParams.categories
    };

    // If we have a specific query and it's not just a time-based query, use it to filter
    const isTimeOnlyQuery = lowerQuery.includes('all receipts') ||
                           lowerQuery.includes('receipts from') ||
                           lowerQuery.match(/^(last week|this week|today|yesterday)$/) ||
                           // 🎯 EMERGENCY FIX: Include month/day patterns as time-only queries
                           /\b(?:from\s+)?(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\s+\d{1,2}\b/i.test(lowerQuery);

    // For time-only queries or "all receipts" queries, just execute the base query with date filters
    if (isTimeOnlyQuery || !query || query.trim() === '') {
      console.log('Executing query for all receipts with date filters:', { dateFilter, query });

      // Execute the query with any date filters applied
      console.log('Executing all receipts query with date filters...');
      const { data, error, count } = await textQuery;
      console.log('All receipts query results:', {
        count: data?.length || 0,
        totalCount: count,
        error: error?.message || 'none',
        sampleData: data?.slice(0, 2)?.map(r => ({ id: r.id, merchant: r.merchant, date: r.date }))
      });

      if (error) {
        console.error('All receipts query error:', error);
        throw error;
      }

      // Add similarity_score to make receipts compatible with ReceiptWithSimilarity type
      const receiptsWithScores = (data || []).map(receipt => ({
        ...receipt,
        similarity_score: 0 // No meaningful similarity score in fallback search
      }));

      const results: SearchResult = {
        receipts: receiptsWithScores,
        lineItems: [],
        results: receiptsWithScores,
        count: receiptsWithScores.length,
        total: count || data?.length || 0,
        searchParams: {
          ...params,
          isVectorSearch: false,
        },
      };

      console.log('Returning all receipts results:', results.count);
      return results;
    }

    if (normalizedQuery && normalizedQuery.trim() !== '' && !isTimeOnlyQuery && !skipTextSearch) {
      console.log('Performing text search with normalized query:', normalizedQuery);

      try {
        // Try individual filter approach (more reliable but potentially slower)
        const { data: merchantData, error: merchantError } = await supabase
          .from('receipts')
          .select('*')
          .ilike('merchant', `%${normalizedQuery}%`)
          .order('date', { ascending: false })
          .limit(limit);

        const { data: categoryData, error: categoryError } = await supabase
          .from('receipts')
          .select('*')
          .ilike('predicted_category', `%${normalizedQuery}%`)
          .order('date', { ascending: false })
          .limit(limit);

        // Note: fullText column is case-sensitive, so use ilike directly
        const { data: fullTextData, error: fullTextError } = await supabase
          .from('receipts')
          .select('*')
          .ilike('fullText', `%${normalizedQuery}%`)
          .order('date', { ascending: false })
          .limit(limit);

        // Combine results and remove duplicates
        const combinedResults = [...(merchantData || []), ...(categoryData || []), ...(fullTextData || [])];
        const uniqueResults = Array.from(new Map(combinedResults.map(item => [item.id, item])).values());

        console.log(`Found results: merchant(${merchantData?.length || 0}), category(${categoryData?.length || 0}), fullText(${fullTextData?.length || 0})`);

        // If we found results with individual queries, return them
        if (uniqueResults.length > 0) {
          // Sort by date
          uniqueResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Apply pagination
          const paginatedResults = uniqueResults.slice(offset, offset + limit);

          // Add similarity score
          const receiptsWithScores = paginatedResults.map(receipt => ({
            ...receipt,
            similarity_score: 0 // No meaningful similarity score in fallback search
          }));

          const results: SearchResult = {
            receipts: receiptsWithScores,
            lineItems: [],
            results: receiptsWithScores, // Add to unified results array
            count: receiptsWithScores.length,
            total: uniqueResults.length,
            searchParams: {
              ...params,
              isVectorSearch: false,
            },
          };

          console.log('Returning combined fallback results:', results.count);
          return results;
        }
      } catch (individualQueryError) {
        console.error('Error with individual query approach:', individualQueryError);
      }

      // If individual queries didn't work or didn't find results, try simpler approach
      textQuery = supabase
        .from('receipts')
        .select('*')
        .ilike('merchant', `%${normalizedQuery}%`)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
    } else if (skipTextSearch) {
      // For monetary queries, get all receipts and rely on amount filtering
      console.log('💰 Performing monetary-only search (no text filtering)');
      textQuery = supabase
        .from('receipts')
        .select('*')
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
    }

    if (skipTextSearch) {
      console.log('💰 Monetary search - applying amount filters only');
    } else {
      console.log('Fallback to simple merchant search with normalized query:', normalizedQuery);
    }

    // Apply date filters if present
    if (params.startDate) {
      textQuery = textQuery.gte('date', params.startDate);
    }

    if (params.endDate) {
      textQuery = textQuery.lte('date', params.endDate);
    }

    // Apply date filters from enhanced parsing
    if (finalDateFilter) {
      if (finalDateFilter.start) {
        textQuery = textQuery.gte('date', finalDateFilter.start);
      }
      if (finalDateFilter.end) {
        textQuery = textQuery.lte('date', finalDateFilter.end);
      }
      console.log('Applied date filter to fallback search:', finalDateFilter);
    }

    // Apply amount filters from enhanced parsing (CRITICAL: Apply after textQuery is finalized)
    if (amountFilters.minAmount !== undefined && amountFilters.minAmount > 0) {
      console.log('💰 DEBUG: Applying minimum amount filter to final query:', {
        minAmount: amountFilters.minAmount,
        type: typeof amountFilters.minAmount,
        isNumber: !isNaN(Number(amountFilters.minAmount))
      });

      // Ensure the amount is a number for proper comparison
      const numericAmount = Number(amountFilters.minAmount);
      textQuery = textQuery.gte('total', numericAmount);
      console.log('💰 Applied minimum amount filter to final query:', numericAmount);
    }

    if (amountFilters.maxAmount !== undefined && amountFilters.maxAmount < Number.MAX_SAFE_INTEGER) {
      console.log('💰 DEBUG: Applying maximum amount filter to final query:', {
        maxAmount: amountFilters.maxAmount,
        type: typeof amountFilters.maxAmount,
        isNumber: !isNaN(Number(amountFilters.maxAmount))
      });

      // Ensure the amount is a number for proper comparison
      const numericAmount = Number(amountFilters.maxAmount);
      textQuery = textQuery.lte('total', numericAmount);
      console.log('💰 Applied maximum amount filter to final query:', numericAmount);
    }

    // Apply merchant filters from enhanced parsing
    if (otherFilters.merchants && otherFilters.merchants.length > 0) {
      // Use ilike for case-insensitive partial matching
      const merchantConditions = otherFilters.merchants.map(merchant =>
        `merchant.ilike.%${merchant}%`
      ).join(',');
      textQuery = textQuery.or(merchantConditions);
      console.log('Applied merchant filters to final query:', otherFilters.merchants);
    }

    // Apply category filters from enhanced parsing
    if (otherFilters.categories && otherFilters.categories.length > 0) {
      textQuery = textQuery.in('predicted_category', otherFilters.categories);
      console.log('Applied category filters to final query:', otherFilters.categories);
    }

    // Execute the query
    const { data, error, count } = await textQuery;
    console.log('Simple fallback search results:', { count: data?.length || 0, error: error?.message || 'none' });

    if (error) {
      console.error('Fallback search error:', error);
      throw error;
    }

    // Add similarity_score to make receipts compatible with ReceiptWithSimilarity type
    const receiptsWithScores = (data || []).map(receipt => ({
      ...receipt,
      similarity_score: 0 // No meaningful similarity score in fallback search
    }));

    // If we're searching for line items or all, also search line items
    let lineItems: any[] = [];

    if (isLineItemSearch || isUnifiedSearch) {
      try {
        console.log('Performing fallback line item search with normalized query:', normalizedQuery);

        // Search line items by description
        // Use a simpler query to avoid relationship issues
        const { data: lineItemData, error: lineItemError } = await supabase
          .from('line_items')
          .select('id, receipt_id, description, amount, created_at')
          .ilike('description', `%${normalizedQuery}%`)
          .order('created_at', { ascending: false })
          .limit(limit);

        // If we found line items, get the receipt data separately
        let receiptData = {};
        if (lineItemData && lineItemData.length > 0) {
          const receiptIds = lineItemData.map(item => item.receipt_id);
          const { data: receipts } = await supabase
            .from('receipts')
            .select('id, merchant, date')
            .in('id', receiptIds);

          // Create a lookup map for receipts
          if (receipts) {
            receiptData = receipts.reduce((acc, receipt) => {
              acc[receipt.id] = receipt;
              return acc;
            }, {});
          }
        }

        if (lineItemError) {
          console.error('Line item fallback search error:', lineItemError);
        } else if (lineItemData && lineItemData.length > 0) {
          console.log(`Found ${lineItemData.length} line items in fallback search`);

          // Format line items to match the expected structure
          lineItems = lineItemData.map(item => {
            const receipt = receiptData[item.receipt_id] || {};
            return {
              line_item_id: item.id,
              receipt_id: item.receipt_id,
              line_item_description: item.description || 'Unknown item',
              line_item_amount: item.amount || 0,
              parent_receipt_merchant: receipt.merchant || 'Unknown merchant',
              parent_receipt_date: receipt.date || '',
              similarity: 0 // No meaningful similarity score in fallback search
            };
          });
        }
      } catch (lineItemError) {
        console.error('Error in line item fallback search:', lineItemError);
      }
    }

    // Combine results based on search target
    const combinedResults = isLineItemSearch ? lineItems :
                         isUnifiedSearch ? [...receiptsWithScores, ...lineItems] :
                         receiptsWithScores;

    // Add monetary filter metadata if enhanced parsing was applied
    const searchMetadata: any = {};
    if (enhancedParams.minAmount !== undefined || enhancedParams.maxAmount !== undefined) {
      searchMetadata.monetaryFilter = {
        min: enhancedParams.minAmount,
        max: enhancedParams.maxAmount,
        originalAmount: enhancedParams.minAmount, // For display purposes
        originalCurrency: 'MYR', // Default currency
        conversionInfo: {
          conversionApplied: false,
          reasoning: 'No conversion needed - same currency'
        }
      };
      console.log('💰 Added monetary filter metadata to fallback search results:', searchMetadata.monetaryFilter);
    }

    const results: SearchResult = {
      receipts: isLineItemSearch ? [] : receiptsWithScores,
      lineItems: isLineItemSearch || isUnifiedSearch ? lineItems : [],
      results: combinedResults,
      count: combinedResults.length,
      total: (isLineItemSearch ? 0 : (count || data?.length || 0)) +
             (isLineItemSearch || isUnifiedSearch ? lineItems.length : 0),
      searchParams: {
        ...params,
        isVectorSearch: false,
      },
      searchMetadata
    };

    console.log('Formatted simple fallback results:', results.count);
    return results;
  } catch (error) {
    console.error('Error in fallback search:', error);
    return {
      receipts: [],
      lineItems: [],
      results: [],
      count: 0,
      total: 0,
      searchParams: params,
    };
  }
}

/**
 * Check if embeddings exist for a specific receipt
 */
export async function checkEmbeddings(receiptId: string): Promise<{exists: boolean, count: number}> {
  try {
    // Call the edge function to check embeddings
    const response = await callEdgeFunction('generate-embeddings', 'GET', { receiptId });

    console.log('Embedding check result:', response);

    if (response && response.success) {
      return {
        exists: response.count > 0,
        count: response.count || 0
      };
    }

    return { exists: false, count: 0 };
  } catch (error) {
    console.error('Error checking embeddings:', error);
    return { exists: false, count: 0 };
  }
}

/**
 * Generate embeddings for a specific receipt
 */
export async function generateEmbeddings(receiptId: string, model: string = 'gemini-2.0-flash-lite'): Promise<boolean> {
  try {
    console.log(`Generating embeddings for receipt ${receiptId} using model ${model}`);
    const response = await callEdgeFunction('generate-embeddings', 'POST', {
      receiptId,
      model,
      processAllFields: true, // This flag tells the edge function to process all fields
      // Removed contentTypes as it's not recognized by the edge function
    });

    return response && response.success;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return false;
  }
}

/**
 * Generate embeddings for multiple receipts
 */
export async function generateAllEmbeddings(model: string = 'gemini-2.0-flash-lite', forceRegenerate: boolean = false): Promise<{
  success: boolean;
  count: number;
  total: number;
  processed: number;
  message: string;
}> {
  try {
    console.log(`Starting generateAllEmbeddings with model: ${model}, forceRegenerate: ${forceRegenerate}`);

    // First get all receipts
    const { data: allReceipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id');

    if (receiptError) {
      console.error('Error fetching all receipts:', receiptError);
      throw receiptError;
    }

    if (!allReceipts || allReceipts.length === 0) {
      console.log('No receipts found in the database');
      return { success: true, count: 0, total: 0, processed: 0, message: 'No receipts found' };
    }

    console.log(`Found ${allReceipts.length} total receipts in database`);

    // If we're not forcing regeneration, identify receipts that already have embeddings
    let receiptsToProcess = [...allReceipts]; // Create a copy to avoid mutation issues

    if (!forceRegenerate) {
      console.log('Not forcing regeneration, identifying receipts without embeddings');

      // Query for existing embeddings in receipt_embeddings table
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id')
        .not('receipt_id', 'is', null);

      if (embeddingsError) {
        console.error('Error checking for existing embeddings:', embeddingsError);
        throw embeddingsError;
      }

      if (existingEmbeddings && existingEmbeddings.length > 0) {
        // Create a set of receipt IDs that already have embeddings
        const existingIds = new Set(existingEmbeddings.map(e => e.receipt_id));
        console.log(`Found ${existingIds.size} receipts with existing embeddings`);

        // Filter to only process receipts without embeddings
        receiptsToProcess = allReceipts.filter(r => !existingIds.has(r.id));
        console.log(`Will process ${receiptsToProcess.length} receipts without embeddings`);
      } else {
        console.log('No existing embeddings found, will process all receipts');
      }
    } else {
      console.log(`Forcing regeneration of all ${allReceipts.length} receipts`);
    }

    if (receiptsToProcess.length === 0) {
      return {
        success: true,
        count: 0,
        total: allReceipts.length,
        processed: 0,
        message: 'All receipts already have embeddings'
      };
    }

    // Process each receipt
    console.log(`Starting batch processing of ${receiptsToProcess.length} receipts`);
    const results = await Promise.all(
      receiptsToProcess.map(receipt =>
        generateEmbeddings(receipt.id, model)
      )
    );

    const successCount = results.filter(r => r === true).length;
    const failedCount = results.filter(r => r === false).length;

    console.log(`Embedding generation complete: ${successCount} successful, ${failedCount} failed`);

    return {
      success: true,
      count: successCount,
      total: allReceipts.length,
      processed: receiptsToProcess.length,
      message: `Generated embeddings for ${successCount} receipts out of ${receiptsToProcess.length} attempted.`
    };
  } catch (error) {
    console.error('Error generating all embeddings:', error);
    return {
      success: false,
      count: 0,
      total: 0,
      processed: 0,
      message: `Error generating embeddings: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Check if line item embeddings exist in the receipt_embeddings table
 */
export async function checkLineItemEmbeddings(): Promise<{
  exists: boolean,
  count: number,
  total: number,
  withEmbeddings: number,
  withoutEmbeddings: number
}> {
  try {
    // First check if embeddings column exists by getting total count of line items with descriptions
    // Only count line items with descriptions since those are the only ones we can generate embeddings for
    const { count: totalLineItems, error: countError } = await supabase
      .from('line_items')
      .select('id', { count: 'exact' })
      .not('description', 'is', null);

    if (countError) throw countError;

    // Count line item embeddings in the receipt_embeddings table
    // This is the current schema where all embeddings are stored
    const { count: embeddingsCount, error: embedError } = await supabase
      .from('receipt_embeddings')
      .select('id', { count: 'exact' })
      .eq('content_type', 'line_item');

    if (embedError) {
      console.error('Error counting line item embeddings:', embedError);
      throw embedError;
    }

    // Calculate those without embeddings
    const withoutEmbeddings = Math.max(0, (totalLineItems || 0) - (embeddingsCount || 0));

    console.log('Line item embedding stats:', {
      total: totalLineItems || 0,
      withEmbeddings: embeddingsCount || 0,
      withoutEmbeddings
    });

    return {
      exists: (embeddingsCount || 0) > 0,
      count: embeddingsCount || 0,
      total: totalLineItems || 0,
      withEmbeddings: embeddingsCount || 0,
      withoutEmbeddings
    };
  } catch (error) {
    console.error('Error checking line item embeddings:', error);
    return { exists: false, count: 0, total: 0, withEmbeddings: 0, withoutEmbeddings: 0 };
  }
}

/**
 * Generate line item embeddings for multiple line items.
 *
 * @param limit The maximum number of line items to process.
 * @param forceRegenerate Whether to regenerate embeddings even if they already exist.
 *
 * @returns A promise that resolves with an object containing the results of the operation.
 */
export async function generateLineItemEmbeddings(limit: number = 50, forceRegenerate: boolean = false): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    // Get the status of line item embeddings
    const status = await checkLineItemEmbeddings();

    if (!forceRegenerate && status.withoutEmbeddings === 0) {
      return {
        success: true,
        processed: 0,
        total: status.total,
        withEmbeddings: status.withEmbeddings,
        withoutEmbeddings: 0
      };
    }

    // Get receipts that actually have line items without embeddings
    // Use a more targeted approach to find receipts that need processing
    let receipts: { id: string }[] = [];

    if (forceRegenerate) {
      // If force regenerating, get all receipts that have line items
      const { data, error: receiptsError } = await supabase
        .from('receipts')
        .select('id')
        .order('date', { ascending: false })
        .limit(limit);

      if (receiptsError) throw receiptsError;
      receipts = data || [];
    } else {
      // Get receipts that have line items without embeddings
      // Use a raw SQL query to efficiently find these receipts
      const { data, error } = await supabase.rpc('get_receipts_with_missing_line_item_embeddings', {
        p_limit: limit
      });

      if (error) {
        console.warn('RPC function not available, falling back to alternative method:', error);

        // Fallback: Use a more comprehensive approach to find receipts with missing embeddings
        // Since the RPC function failed, we'll use a different strategy
        console.log('Using comprehensive fallback method to find receipts with missing embeddings...');

        // Get a larger set of receipts to check
        const { data: allReceipts, error: fallbackError } = await supabase
          .from('receipts')
          .select('id, date')
          .order('date', { ascending: false })
          .limit(limit * 10); // Get many more receipts to ensure we find ones with missing embeddings

        if (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          throw fallbackError;
        }

        console.log(`Checking ${allReceipts?.length || 0} receipts for missing line item embeddings...`);

        // Filter to only receipts that have line items without embeddings
        const receiptsWithMissingEmbeddings = [];
        let checkedCount = 0;

        for (const receipt of allReceipts || []) {
          checkedCount++;

          // Check if this receipt has any line items without embeddings
          const { data: missingLineItems, error: rpcError } = await supabase.rpc('get_line_items_without_embeddings_for_receipt', {
            p_receipt_id: receipt.id
          });

          if (rpcError) {
            console.warn(`RPC error for receipt ${receipt.id}:`, rpcError);
            continue;
          }

          if (missingLineItems && missingLineItems.length > 0) {
            receiptsWithMissingEmbeddings.push({ id: receipt.id });
            console.log(`Found receipt ${receipt.id} with ${missingLineItems.length} missing line item embeddings`);

            if (receiptsWithMissingEmbeddings.length >= limit) {
              console.log(`Found enough receipts (${limit}), stopping search`);
              break;
            }
          }

          // Log progress every 50 receipts
          if (checkedCount % 50 === 0) {
            console.log(`Checked ${checkedCount} receipts, found ${receiptsWithMissingEmbeddings.length} with missing embeddings`);
          }
        }

        console.log(`Fallback method: checked ${checkedCount} receipts, found ${receiptsWithMissingEmbeddings.length} with missing embeddings`);
        receipts = receiptsWithMissingEmbeddings;
      } else {
        receipts = data || [];
      }
    }

    console.log(`Found ${receipts?.length || 0} receipts to process for line item embeddings`);

    if (!receipts || receipts.length === 0) {
      return {
        success: true,
        processed: 0,
        total: status.total,
        withEmbeddings: status.withEmbeddings,
        withoutEmbeddings: status.withoutEmbeddings
      };
    }

    let processedCount = 0;

    // Process line items for each receipt
    for (const receipt of receipts) {
      try {
        // Call the edge function to generate line item embeddings
        const response = await callEdgeFunction('generate-embeddings', 'POST', {
          receiptId: receipt.id,
          processLineItems: true,
          forceRegenerate: forceRegenerate // Pass along the regenerate flag
        });

        if (response && response.success) {
          processedCount += response.count || 0;
        }
      } catch (err) {
        console.error(`Error generating line item embeddings for receipt ${receipt.id}:`, err);
      }
    }

    // Get updated status after processing
    const newStatus = await checkLineItemEmbeddings();

    return {
      success: true,
      processed: processedCount,
      total: newStatus.total,
      withEmbeddings: newStatus.withEmbeddings,
      withoutEmbeddings: newStatus.withoutEmbeddings
    };
  } catch (error) {
    console.error('Error generating line item embeddings:', error);
    return {
      success: false,
      processed: 0,
      total: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0
    };
  }
}

/**
 * Generate all embeddings (receipts and line items)
 */
export async function generateAllTypeEmbeddings(limit: number = 10, model: string = 'gemini-2.0-flash-lite', forceRegenerate: boolean = false): Promise<{
  success: boolean;
  message: string;
  receiptResults: {
    processed: number;
    count: number;
    total: number;
  };
  lineItemResults: {
    processed: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  };
}> {
  try {
    console.log(`Generating all embeddings for receipts and line items with model: ${model}, forceRegenerate: ${forceRegenerate}`);

    // First generate receipts
    const receiptResults = await generateAllEmbeddings(model, forceRegenerate);

    // Then generate line items
    const lineItemResults = await generateLineItemEmbeddings(limit, forceRegenerate);

    return {
      success: true,
      message: `Generated embeddings for ${receiptResults.count} receipts and ${lineItemResults.withEmbeddings} line items`,
      receiptResults: {
        processed: receiptResults.processed,
        count: receiptResults.count,
        total: receiptResults.total
      },
      lineItemResults: {
        processed: lineItemResults.processed,
        withEmbeddings: lineItemResults.withEmbeddings,
        withoutEmbeddings: lineItemResults.withoutEmbeddings
      }
    };
  } catch (error) {
    console.error('Error generating all type embeddings:', error);
    return {
      success: false,
      message: 'Error generating all type embeddings',
      receiptResults: {
        processed: 0,
        count: 0,
        total: 0
      },
      lineItemResults: {
        processed: 0,
        withEmbeddings: 0,
        withoutEmbeddings: 0
      }
    };
  }
}

/**
 * Get similar receipts based on a receipt ID
 */
export async function getSimilarReceipts(receiptId: string, limit: number = 5): Promise<any[]> {
  try {
    console.log(`Getting similar receipts for receipt ID: ${receiptId}, limit: ${limit}`);

    // First, get the receipt to access its data
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError) {
      console.error('Error fetching receipt:', receiptError);
      throw receiptError;
    }

    if (!receipt) {
      console.error('Receipt not found');
      throw new Error('Receipt not found');
    }

    // Use merchant name as query to find similar receipts
    const searchQuery = receipt.merchant || '';
    console.log(`Using merchant name as search query: "${searchQuery}"`);

    if (!searchQuery) {
      console.log('Empty merchant name, returning empty results');
      return [];
    }

    // Increase the limit to account for filtering out the current receipt
    const searchLimit = limit + 1;

    // Use a more flexible search approach that allows fallback to text search
    const result = await semanticSearch({
      query: searchQuery,
      contentType: 'merchant',
      limit: searchLimit,
      searchTarget: 'receipts', // Explicitly specify we want receipts
      // Don't set isVectorSearch to true to allow fallback to text search if needed
    });

    console.log(`Semantic search returned ${result.receipts?.length || 0} results (using ${result.searchParams?.isVectorSearch ? 'vector' : 'text'} search)`);

    // Filter out the current receipt and limit to requested number
    const filteredResults = (result.receipts || [])
      .filter(r => r.id !== receiptId)
      .slice(0, limit);

    // Add similarity scores if they're missing (for text search results)
    const resultsWithScores = filteredResults.map(receipt => {
      if (receipt.similarity_score === undefined) {
        return {
          ...receipt,
          similarity_score: 0.5 // Default score for text search results
        };
      }
      return receipt;
    });

    console.log(`Returning ${resultsWithScores.length} similar receipts after filtering`);

    return resultsWithScores;
  } catch (error) {
    console.error('Error getting similar receipts:', error);
    return [];
  }
}

/**
 * Check if a database table/schema exists
 */
async function checkDbSchema(tableName: 'receipts' | 'receipt_embeddings' | 'line_items'): Promise<{ exists: boolean }> {
  try {
    // Try to query the table structure
    const { error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    // If no error, the table exists
    return { exists: !error };
  } catch (e) {
    console.error(`Error checking if schema ${tableName} exists:`, e);
    return { exists: false };
  }
}

/**
 * Check if receipt embeddings exist in the database
 */
export async function checkReceiptEmbeddings(): Promise<{
  exists: boolean,
  count: number,
  total: number,
  withEmbeddings: number,
  withoutEmbeddings: number
}> {
  try {
    // Get total receipt count
    const { count: totalReceipts, error: countError } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error("Error fetching total receipts count:", countError);
      throw countError;
    }

    // Count distinct receipts that have embeddings
    let distinctReceiptsWithEmbeddings = 0;
    try {
      // Get count of distinct receipt_ids in receipt_embeddings table
      const { data, error: distinctError } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id')
        .not('receipt_id', 'is', null);

      if (distinctError) {
        console.error('Error getting distinct receipt_ids:', distinctError);
      } else if (data) {
        // Count distinct receipt_ids from the returned data
        const uniqueReceiptIds = new Set(data.map(item => item.receipt_id));
        distinctReceiptsWithEmbeddings = uniqueReceiptIds.size;
        console.log('Distinct receipts with embeddings count:', distinctReceiptsWithEmbeddings);
      }
    } catch (e) {
      console.error('Exception checking distinct receipt embeddings:', e);
      // Default to 0 for calculation
    }

    const withEmbeddings = distinctReceiptsWithEmbeddings;
    // Ensure withoutEmbeddings is not negative
    const withoutEmbeddings = Math.max(0, (totalReceipts || 0) - withEmbeddings);

    console.log('Calculated Receipt Stats:', { total: totalReceipts, withEmbeddings, withoutEmbeddings });

    return {
      exists: withEmbeddings > 0,
      count: withEmbeddings, // Report the count of distinct receipts with embeddings
      total: totalReceipts || 0,
      withEmbeddings: withEmbeddings,
      withoutEmbeddings: withoutEmbeddings
    };
  } catch (error) {
    console.error('Error in checkReceiptEmbeddings:', error);
    return { exists: false, count: 0, total: 0, withEmbeddings: 0, withoutEmbeddings: 0 };
  }
}

/**
 * Regenerate all embeddings with the improved dimension handling algorithm
 * This is needed after updating the generateEmbedding function in the edge function
 */
export async function regenerateAllEmbeddings(batchSize: number = 20): Promise<{
  success: boolean;
  receiptsProcessed: number;
  lineItemsProcessed: number;
  errors: string[];
  message: string;
}> {
  try {
    console.log('Starting regeneration of all embeddings with improved dimension handling');
    const errors: string[] = [];

    // Check if user is authenticated as admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to regenerate embeddings');
    }

    // Step 1: Get stats before regeneration
    const beforeStats = await Promise.all([
      checkReceiptEmbeddings(),
      checkLineItemEmbeddings()
    ]);

    console.log('Current embedding stats before regeneration:', {
      receipts: beforeStats[0],
      lineItems: beforeStats[1]
    });

    // Step 2: Get all receipts with existing embeddings
    let receiptsWithEmbeddings: any[] = [];
    try {
      const { data, error } = await supabase
        .from('receipt_embeddings')
        .select('receipt_id')
        .eq('source_type', 'receipt')
        .not('embedding', 'is', null);

      if (error) {
        console.error('Error fetching receipts with embeddings:', error);
        errors.push(`Error fetching receipts: ${error.message}`);
      } else if (data) {
        receiptsWithEmbeddings = data;
      }
    } catch (e) {
      console.error('Exception fetching receipts with embeddings:', e);
      errors.push(`Exception fetching receipts: ${e.message}`);
    }

    // Process receipts in batches
    let receiptsProcessed = 0;
    if (receiptsWithEmbeddings && receiptsWithEmbeddings.length > 0) {
      const uniqueReceiptIds = [...new Set(receiptsWithEmbeddings.map(r => r.receipt_id).filter(Boolean))];
      console.log(`Found ${uniqueReceiptIds.length} receipts with existing embeddings to regenerate`);

      // Process in batches to avoid overloading the system
      for (let i = 0; i < uniqueReceiptIds.length; i += batchSize) {
        const batch = uniqueReceiptIds.slice(i, i + batchSize);
        console.log(`Processing receipt batch ${i/batchSize + 1} of ${Math.ceil(uniqueReceiptIds.length/batchSize)}`);

        // Process each receipt in the batch concurrently
        await Promise.all(
          batch.map(async (receiptId) => {
            try {
              const response = await callEdgeFunction('generate-embeddings', 'POST', {
                receiptId,
                forceRegenerate: true, // Important: force regeneration of embeddings
                processAllFields: true,
                useImprovedDimensionHandling: true // Signal to use the improved algorithm
              });

              if (response && response.success) {
                receiptsProcessed++;
              } else {
                console.error(`Failed to regenerate embeddings for receipt ${receiptId}:`, response?.error);
                errors.push(`Receipt ${receiptId}: ${response?.error || 'Unknown error'}`);
              }
            } catch (err) {
              console.error(`Error regenerating embeddings for receipt ${receiptId}:`, err);
              errors.push(`Receipt ${receiptId}: ${err.message}`);
            }
          })
        );
      }
    }

    // Step 3: Regenerate line item embeddings
    // Get all line item embeddings
    let lineItemsWithEmbeddings: any[] = [];
    try {
      const { data, error } = await supabase
        .from('receipt_embeddings')
        .select('source_id, receipt_id')
        .eq('source_type', 'line_item')
        .not('embedding', 'is', null);

      if (error) {
        console.error('Error fetching line items with embeddings:', error);
        errors.push(`Error fetching line items: ${error.message}`);
      } else if (data) {
        lineItemsWithEmbeddings = data;
      }
    } catch (e) {
      console.error('Exception fetching line items with embeddings:', e);
      errors.push(`Exception fetching line items: ${e.message}`);
    }

    // Process line items grouped by receipt_id to avoid overwhelming the system
    let lineItemsProcessed = 0;
    if (lineItemsWithEmbeddings && lineItemsWithEmbeddings.length > 0) {
      console.log(`Found ${lineItemsWithEmbeddings.length} line items with existing embeddings to regenerate`);

      // Group line items by receipt_id for more efficient processing
      const lineItemsByReceipt: Record<string, string[]> = {};
      
      // Process each line item and build the groups
      for (const item of lineItemsWithEmbeddings) {
        if (item && item.receipt_id && item.source_id) {
          if (!lineItemsByReceipt[item.receipt_id]) {
            lineItemsByReceipt[item.receipt_id] = [];
          }
          lineItemsByReceipt[item.receipt_id].push(item.source_id);
        }
      }

      const receiptIds = Object.keys(lineItemsByReceipt);
      console.log(`Line items belong to ${receiptIds.length} different receipts`);

      // Process receipts in batches
      for (let i = 0; i < receiptIds.length; i += batchSize) {
        const batchReceiptIds = receiptIds.slice(i, i + batchSize);
        console.log(`Processing line item batch ${i/batchSize + 1} of ${Math.ceil(receiptIds.length/batchSize)}`);

        // Process each receipt's line items
        await Promise.all(
          batchReceiptIds.map(async (receiptId) => {
            try {
              const response = await callEdgeFunction('generate-embeddings', 'POST', {
                receiptId,
                processLineItems: true,
                forceRegenerate: true, // Important: force regeneration
                useImprovedDimensionHandling: true, // Signal to use the improved algorithm
                lineItemIds: lineItemsByReceipt[receiptId] // Only regenerate specific line items
              });

              if (response && response.success) {
                lineItemsProcessed += lineItemsByReceipt[receiptId].length;
              } else {
                console.error(`Failed to regenerate line item embeddings for receipt ${receiptId}:`, response?.error);
                errors.push(`Line items for receipt ${receiptId}: ${response?.error || 'Unknown error'}`);
              }
            } catch (err) {
              console.error(`Error regenerating line item embeddings for receipt ${receiptId}:`, err);
              errors.push(`Line items for receipt ${receiptId}: ${err.message}`);
            }
          })
        );
      }
    }

    // Step 4: Get stats after regeneration
    const afterStats = await Promise.all([
      checkReceiptEmbeddings(),
      checkLineItemEmbeddings()
    ]);

    console.log('Embedding stats after regeneration:', {
      receipts: afterStats[0],
      lineItems: afterStats[1]
    });

    return {
      success: true,
      receiptsProcessed,
      lineItemsProcessed,
      errors,
      message: `Successfully regenerated embeddings for ${receiptsProcessed} receipts and ${lineItemsProcessed} line items.${errors.length > 0 ? ' Some errors occurred.' : ''}`
    };
  } catch (error) {
    console.error('Error in regenerateAllEmbeddings:', error);
    return {
      success: false,
      receiptsProcessed: 0,
      lineItemsProcessed: 0,
      errors: [error.message],
      message: `Failed to regenerate embeddings: ${error.message}`
    };
  }
}

/**
 * Generate embeddings for receipts with the specified batch size and regeneration flag
 * @param batchSize The number of receipts to process in each batch
 * @param forceRegenerate Whether to regenerate embeddings for receipts that already have them
 */
export async function generateReceiptEmbeddings(batchSize: number = 10, forceRegenerate: boolean = false): Promise<{
  success: boolean;
  processed: number;
  total: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
}> {
  try {
    // Use the existing generateAllEmbeddings function
    const result = await generateAllEmbeddings('gemini-2.0-flash-lite', forceRegenerate);

    // Get the current status of embeddings
    const stats = await checkReceiptEmbeddings();

    return {
      success: result.success,
      processed: result.processed,
      total: stats.total,
      withEmbeddings: stats.withEmbeddings,
      withoutEmbeddings: stats.withoutEmbeddings
    };
  } catch (error) {
    console.error('Error generating receipt embeddings:', error);
    return {
      success: false,
      processed: 0,
      total: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0
    };
  }
}

/**
 * Generates embeddings for a single receipt, including both receipt text and line items
 * @param receiptId The ID of the receipt to generate embeddings for
 * @returns Promise<void>
 */
export async function generateEmbeddingsForReceipt(receiptId: string): Promise<void> {
  try {
    // Get the receipt data
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      throw new Error(`Failed to fetch receipt: ${receiptError?.message || 'Receipt not found'}`);
    }

    // Generate embeddings for receipt text
    await generateEmbeddings(receiptId);

    // Process line items
    try {
      // Call the edge function to generate line item embeddings
      await callEdgeFunction('generate-embeddings', 'POST', {
        receiptId,
        processLineItems: true
      });
    } catch (lineItemError) {
      console.error(`Error generating line item embeddings: ${lineItemError}`);
      // Continue even if line item embedding fails
    }

    // Update receipt with embedding status using any to bypass type checking
    // This is necessary because the database schema may have evolved ahead of the TypeScript types
    try {
      const { error: updateError } = await supabase
        .from('receipts')
        .update({ embedding_status: 'complete' } as any)
        .eq('id', receiptId);

      if (updateError) {
        console.error(`Failed to update receipt embedding status: ${updateError.message}`);
      }
    } catch (updateError) {
      console.error(`Error updating receipt status: ${updateError}`);
    }
  } catch (error) {
    console.error('Error generating embeddings for receipt:', error);
    // Update receipt to indicate embedding failure using any to bypass type checking
    try {
      await supabase
        .from('receipts')
        .update({ embedding_status: 'failed' } as any)
        .eq('id', receiptId);
    } catch (updateError) {
      console.error(`Error updating receipt status after failure: ${updateError}`);
    }
    throw error;
  }
}

/**
 * Map frontend source names (plural) to backend source names (singular)
 */
function mapFrontendSourcesToBackend(frontendSources: string[]): string[] {
  const sourceMapping: Record<string, string> = {
    'receipts': 'receipt',
    'claims': 'claim',
    'team_members': 'team_member',
    'custom_categories': 'custom_category',
    'business_directory': 'business_directory', // Same
    'conversations': 'conversation'
  };

  return frontendSources.map(source => sourceMapping[source] || source);
}

/**
 * Unified Search Function - Calls the unified-search Edge Function with caching and performance monitoring
 * This is the PREFERRED search interface that supports multiple data sources
 * 🚀 Use this instead of semanticSearch for new implementations
 */
export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResponse> {
  console.log('🚀 UNIFIED-SEARCH: Starting optimized unified search at', new Date().toISOString(), 'with params:', params);

  // Log monetary query parameters specifically
  if (params.filters?.amountRange) {
    console.log('💰 DEBUG: Monetary search detected in unifiedSearch:', {
      amountRange: params.filters.amountRange,
      min: params.filters.amountRange.min,
      max: params.filters.amountRange.max,
      minType: typeof params.filters.amountRange.min,
      maxType: typeof params.filters.amountRange.max,
      currency: params.filters.amountRange.currency,
      query: params.query
    });
  }

  // 🔍 DEBUG: Log the complete search flow path
  console.log('🔍 DEBUG: UnifiedSearch function entry point:', {
    query: params.query,
    sources: params.sources,
    useEnhancedPrompting: params.useEnhancedPrompting,
    hasFilters: !!params.filters,
    filterKeys: params.filters ? Object.keys(params.filters) : []
  });

  const startTime = performance.now();

  try {
    console.log('Performing optimized unified search...', params);

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User is not authenticated');
    }

    const userId = session.user.id;

    // Use optimized search executor
    const result = await optimizedSearchExecutor.executeSearch(params, userId);

    // Log performance metrics
    const totalTime = performance.now() - startTime;
    console.log(`🚀 Optimized unified search completed in ${totalTime.toFixed(2)}ms`);

    return result;

  } catch (error) {
    console.error('Optimized unified search failed:', error);

    // Return error response
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      results: [],
      totalResults: 0,
      pagination: {
        hasMore: false,
        nextOffset: 0,
        totalPages: 0
      },
      searchMetadata: {
        queryTime: performance.now() - startTime,
        sourcesSearched: params.sources || ['receipts'],
        fallbackUsed: true,
        searchMethod: 'error_fallback',
        fallbackReason: 'search_execution_error'
      }
    };
  }
}

/**
 * Legacy search function wrapper for backward compatibility
 * Converts old SearchParams to new UnifiedSearchParams and calls unifiedSearch
 */
export async function legacySemanticSearch(params: SearchParams): Promise<SearchResult> {
  try {
    // Convert legacy params to unified params
    const unifiedParams: UnifiedSearchParams = {
      query: params.query,
      sources: params.searchTarget === 'all'
        ? ['receipts', 'business_directory']
        : params.searchTarget === 'line_items'
        ? ['receipts'] // Line items are part of receipts
        : ['receipts'],
      contentTypes: params.contentType ? [params.contentType] : undefined,
      limit: params.limit,
      offset: params.offset,
      filters: {
        dateRange: params.startDate && params.endDate ? {
          start: params.startDate,
          end: params.endDate
        } : undefined,
        amountRange: params.minAmount && params.maxAmount ? {
          min: params.minAmount,
          max: params.maxAmount,
          currency: 'MYR'
        } : undefined,
        categories: params.categories,
        merchants: params.merchants
      },
      similarityThreshold: 0.2,
      includeMetadata: true,
      aggregationMode: 'relevance'
    };

    // Call unified search
    const unifiedResponse = await unifiedSearch(unifiedParams);

    if (!unifiedResponse.success) {
      throw new Error(unifiedResponse.error || 'Search failed');
    }

    // Convert unified response back to legacy format
    const receipts: ReceiptWithSimilarity[] = [];
    const lineItems: LineItemSearchResult[] = [];

    unifiedResponse.results.forEach(result => {
      if (result.sourceType === 'receipt') {
        receipts.push({
          id: result.sourceId,
          merchant: result.metadata.merchant || result.title,
          date: result.metadata.date || result.createdAt,
          total: result.metadata.total || 0,
          notes: result.metadata.notes,
          raw_text: result.metadata.raw_text,
          predicted_category: result.metadata.predicted_category,
          similarity_score: result.similarity
        });
      }
      // Handle line items if they're in the results
      else if (result.contentType === 'line_items') {
        lineItems.push({
          line_item_id: result.id,
          receipt_id: result.sourceId,
          line_item_description: result.description,
          line_item_quantity: result.metadata.quantity || 1,
          line_item_price: result.metadata.price || 0,
          line_item_amount: result.metadata.amount || 0,
          parent_receipt_merchant: result.metadata.parent_receipt_merchant || result.title,
          parent_receipt_date: result.metadata.parent_receipt_date || result.createdAt,
          parent_receipt_id: result.sourceId,
          similarity: result.similarity
        });
      }
    });

    // Combine results for 'all' search target
    const combinedResults = params.searchTarget === 'all'
      ? [...receipts, ...lineItems]
      : params.searchTarget === 'line_items'
      ? lineItems
      : receipts;

    return {
      receipts,
      lineItems,
      results: combinedResults,
      count: combinedResults.length,
      total: unifiedResponse.totalResults,
      searchParams: params
    };

  } catch (error) {
    console.error('Error in legacySemanticSearch:', error);
    // Fall back to original semantic search if unified search fails
    return await semanticSearch(params);
  }
}
