/**
 * Utility functions for unified search functionality
 */

import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';
import {
  UnifiedSearchParams,
  SearchFilters,
  ValidationResult,
  UnifiedSearchResult,
  LLMPreprocessResult,
  ReRankingParams,
  ReRankingResult,
  ReRankingCandidate
} from './types.ts';

/**
 * Validate search parameters
 */
export function validateSearchParams(params: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 🔍 ENHANCED LOGGING: Log validation input
  console.log('🔍 VALIDATION: Starting parameter validation:', {
    hasQuery: !!params.query,
    queryType: typeof params.query,
    queryLength: params.query?.length,
    hasSources: !!params.sources,
    sources: params.sources,
    hasFilters: !!params.filters,
    filters: params.filters,
    allParams: Object.keys(params)
  });

  // Validate required fields
  if (!params.query || typeof params.query !== 'string') {
    errors.push('Query is required and must be a string');
  } else if (params.query.trim().length === 0) {
    errors.push('Query cannot be empty');
  } else if (params.query.length > 1000) {
    errors.push('Query is too long (max 1000 characters)');
  }

  // Validate sources
  if (params.sources && !Array.isArray(params.sources)) {
    errors.push('Sources must be an array');
  } else if (params.sources) {
    const validSources = ['receipt', 'claim', 'team_member', 'custom_category', 'business_directory', 'conversation'];
    const invalidSources = params.sources.filter((s: string) => !validSources.includes(s));
    if (invalidSources.length > 0) {
      errors.push(`Invalid sources: ${invalidSources.join(', ')}`);
    }
  }

  // Validate limit
  if (params.limit !== undefined) {
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100) {
      errors.push('Limit must be a number between 1 and 100');
    }
  }

  // Validate offset
  if (params.offset !== undefined) {
    if (typeof params.offset !== 'number' || params.offset < 0) {
      errors.push('Offset must be a non-negative number');
    }
  }

  // Validate similarity threshold
  if (params.similarityThreshold !== undefined) {
    if (typeof params.similarityThreshold !== 'number' || 
        params.similarityThreshold < 0 || 
        params.similarityThreshold > 1) {
      errors.push('Similarity threshold must be a number between 0 and 1');
    }
  }

  // Validate filters
  if (params.filters) {
    const filterValidation = validateFilters(params.filters);
    errors.push(...filterValidation.errors);
    warnings.push(...filterValidation.warnings);
  }

  // Sanitize parameters
  const sanitizedParams: UnifiedSearchParams = {
    query: params.query?.trim(),
    sources: params.sources || ['receipt', 'business_directory'],
    contentTypes: params.contentTypes,
    limit: Math.min(Math.max(1, params.limit || 20), 100),
    offset: Math.max(0, params.offset || 0),
    filters: params.filters || {},
    similarityThreshold: Math.max(0.1, Math.min(1.0, params.similarityThreshold || 0.2)),
    includeMetadata: params.includeMetadata !== false,
    aggregationMode: params.aggregationMode || 'relevance'
  };

  // 🔍 ENHANCED LOGGING: Log validation result
  const result = {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedParams: errors.length === 0 ? sanitizedParams : undefined
  };

  console.log('🔍 VALIDATION RESULT:', {
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors: errors,
    warnings: warnings,
    hasSanitizedParams: !!result.sanitizedParams
  });

  if (!result.isValid) {
    console.error('❌ VALIDATION FAILED:', {
      errors: errors,
      originalParams: params
    });
  }

  return result;
}

/**
 * Validate search filters
 */
function validateFilters(filters: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 🔍 ENHANCED LOGGING: Log filter validation
  console.log('🔍 FILTER VALIDATION: Starting filter validation:', {
    hasDateRange: !!filters.dateRange,
    hasAmountRange: !!filters.amountRange,
    amountRange: filters.amountRange,
    dateRange: filters.dateRange,
    allFilters: filters
  });

  // Validate date range
  if (filters.dateRange) {
    if (!filters.dateRange.start || !filters.dateRange.end) {
      errors.push('Date range must include both start and end dates');
    } else {
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('Invalid date format in date range');
      } else if (start > end) {
        errors.push('Date range start must be before end');
      } else if (end > new Date()) {
        warnings.push('Date range end is in the future');
      }
    }
  }

  // Validate amount range
  if (filters.amountRange) {
    console.log('💰 AMOUNT RANGE VALIDATION:', {
      amountRange: filters.amountRange,
      min: filters.amountRange.min,
      max: filters.amountRange.max,
      minType: typeof filters.amountRange.min,
      maxType: typeof filters.amountRange.max
    });

    // CRITICAL FIX: Allow either min OR max to be specified (not both required)
    const hasMin = filters.amountRange.min !== undefined && filters.amountRange.min !== null;
    const hasMax = filters.amountRange.max !== undefined && filters.amountRange.max !== null;

    if (!hasMin && !hasMax) {
      errors.push('Amount range must specify at least min or max value');
    }

    if (hasMin && typeof filters.amountRange.min !== 'number') {
      errors.push('Amount range min must be a number');
    }

    if (hasMax && typeof filters.amountRange.max !== 'number') {
      errors.push('Amount range max must be a number');
    }

    if (hasMin && filters.amountRange.min < 0) {
      errors.push('Amount range min cannot be negative');
    }

    if (hasMax && filters.amountRange.max < 0) {
      errors.push('Amount range max cannot be negative');
    }

    if (hasMin && hasMax && filters.amountRange.min > filters.amountRange.max) {
      errors.push('Amount range min must be less than or equal to max');
    }
  }

  // Validate language
  if (filters.language && !['en', 'ms'].includes(filters.language)) {
    errors.push('Language must be "en" or "ms"');
  }

  // Validate priority
  if (filters.priority && !['low', 'medium', 'high'].includes(filters.priority)) {
    errors.push('Priority must be "low", "medium", or "high"');
  }

  return { errors, warnings };
}

/**
 * Sanitize and preprocess search query with enhanced normalization
 * This ensures semantically similar queries generate similar embeddings
 */
export function preprocessQuery(query: string): string {
  console.log(`Preprocessing query: "${query}"`);

  // Remove extra whitespace
  let processed = query.trim().replace(/\s+/g, ' ');

  // Remove numerical qualifiers that don't affect search content
  const numericalQualifiers = [
    /\b(top|first|latest|recent|show\s+me|find\s+me|get\s+me)\s+\d+\s*/gi,
    /\b(show|find|get)\s+(me\s+)?(all|any)\s*/gi,
    /\b(all|any)\s+(of\s+)?(the\s+)?/gi,
    /\b(receipts?|purchases?|expenses?|transactions?)\s+(from|at|in)\s+/gi
  ];

  // Apply normalization patterns
  for (const pattern of numericalQualifiers) {
    processed = processed.replace(pattern, '');
  }

  // Clean up extra spaces and common words
  processed = processed
    .replace(/\s+/g, ' ')
    .replace(/\b(receipts?|purchases?|expenses?|transactions?)\b/gi, '')
    .trim();

  // Handle Malaysian-specific terms
  processed = processed.replace(/\bRM\b/gi, 'MYR');
  processed = processed.replace(/\bringgit\b/gi, 'MYR');

  // Normalize common business terms
  processed = processed.replace(/\bsdn\.?\s*bhd\.?\b/gi, 'Sdn Bhd');
  processed = processed.replace(/\bpte\.?\s*ltd\.?\b/gi, 'Pte Ltd');

  // If the processed query is too short, fall back to original (minus numerical qualifiers)
  if (processed.length < 3) {
    processed = query.toLowerCase().trim();
    // Still remove numerical qualifiers from fallback
    for (const pattern of numericalQualifiers) {
      processed = processed.replace(pattern, '');
    }
    processed = processed.trim();
  }

  console.log(`Preprocessed query result: "${processed}"`);
  return processed;
}

/**
 * Generate cache key for search results
 */
export function generateCacheKey(params: UnifiedSearchParams, userId: string): string {
  const keyData = {
    query: params.query.toLowerCase(),
    sources: params.sources?.sort(),
    contentTypes: params.contentTypes?.sort(),
    filters: JSON.stringify(params.filters),
    userId,
    language: params.filters?.language || 'en'
  };
  
  return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
}

/**
 * Calculate advanced search result relevance score based on quality validation findings
 */
export function calculateRelevanceScore(
  result: UnifiedSearchResult,
  query: string,
  sourceWeights: Record<string, number> = {}
): number {
  // Quality validation findings - source performance scores
  const sourceQualityScores = {
    'custom_categories': 0.95,    // A+ grade, perfect exact matching
    'business_directory': 0.92,   // A+ grade, excellent cross-language
    'receipts': 1.0,             // A+ grade after content fix
    'claims': 0.80,              // Estimated performance
    'conversations': 0.75,        // Estimated performance
    'team_members': 0.85         // Estimated performance
  };

  // Content type weights based on validation findings
  const contentTypeWeights = {
    'merchant': 2.0,             // Excellent for business searches
    'title': 1.8,               // Strong exact matching
    'keywords': 1.7,            // Perfect cross-language matching
    'business_name': 1.9,       // Outstanding business directory
    'category_name': 2.0,       // Perfect category matching
    'description': 1.4,         // Good semantic relationships
    'full_text': 1.3,          // Good when content available
    'line_item': 1.2,          // Specific receipt details
    'fallback': 1.0            // Baseline performance
  };

  let score = result.similarity;

  // 1. Apply source quality multiplier (based on validation findings)
  const sourceQuality = sourceQualityScores[result.sourceType] || 0.7;
  score *= sourceQuality;

  // 2. Apply content type weighting
  const contentWeight = contentTypeWeights[result.contentType] || 1.0;
  score *= contentWeight;

  // 3. Apply source type weighting (user preference)
  const sourceWeight = sourceWeights[result.sourceType] || 1.0;
  score *= sourceWeight;

  // 4. Exact match boosts (based on perfect 1.0 similarity findings)
  const queryLower = query.toLowerCase();
  const titleLower = result.title.toLowerCase();

  if (titleLower === queryLower) {
    score *= 3.0; // Exact title match
  } else if (titleLower.includes(queryLower)) {
    score *= 1.5; // Partial title match
  }

  // Exact merchant match boost
  if (result.metadata.merchant && result.metadata.merchant.toLowerCase() === queryLower) {
    score *= 2.5;
  }

  // Category exact match boost (perfect category performance)
  if (result.sourceType === 'custom_category' && titleLower === queryLower) {
    score *= 2.8;
  }

  // Business directory exact match boost (outstanding performance)
  if (result.sourceType === 'business_directory' &&
      (result.metadata.business_name?.toLowerCase() === queryLower || titleLower === queryLower)) {
    score *= 2.6;
  }

  // 5. Cross-language boost (excellent 0.7597 avg performance)
  const malayWords = ['sdn', 'bhd', 'kedai', 'restoran', 'pasar', 'mamak'];
  const hasMalay = malayWords.some(word => queryLower.includes(word));
  if (hasMalay && (result.sourceType === 'business_directory' || result.sourceType === 'custom_category')) {
    score *= 1.8;
  }

  // 6. High confidence boost (similarity > 0.8)
  if (result.similarity > 0.8) {
    score *= 1.4;
  }

  // 7. Recency boost (enhanced for recent content)
  const daysSinceCreated = (Date.now() - new Date(result.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  let recencyBoost = 1.0;
  if (daysSinceCreated <= 30) {
    recencyBoost = 1.3 * (1 - daysSinceCreated / 30); // Strong boost for recent content
  } else {
    recencyBoost = Math.max(0.8, 1 - (daysSinceCreated / 365)); // Gradual decay over a year
  }
  score *= recencyBoost;

  // 8. Access level boost (user content is more relevant)
  const accessLevelBoost = {
    'user': 1.2,   // Increased boost for user content
    'team': 1.1,   // Increased boost for team content
    'public': 0.9
  };
  score *= accessLevelBoost[result.accessLevel] || 1.0;

  return Math.min(1.0, score); // Cap at 1.0 for consistency
}

/**
 * Group search results by source type
 */
export function groupResultsBySource(results: UnifiedSearchResult[]): Record<string, UnifiedSearchResult[]> {
  return results.reduce((groups, result) => {
    const sourceType = result.sourceType;
    if (!groups[sourceType]) {
      groups[sourceType] = [];
    }
    groups[sourceType].push(result);
    return groups;
  }, {} as Record<string, UnifiedSearchResult[]>);
}

/**
 * Group search results by date
 */
export function groupResultsByDate(results: UnifiedSearchResult[]): Record<string, UnifiedSearchResult[]> {
  return results.reduce((groups, result) => {
    const date = new Date(result.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(result);
    return groups;
  }, {} as Record<string, UnifiedSearchResult[]>);
}

/**
 * Extract search terms from query
 */
export function extractSearchTerms(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'dari', 'ke', 'di', 'dan', 'atau', 'untuk', 'dengan', 'pada', 'yang', 'adalah'
  ]);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term))
    .slice(0, 10); // Limit to 10 terms
}

/**
 * Format search result for display
 */
export function formatSearchResult(result: UnifiedSearchResult): {
  displayTitle: string;
  displayDescription: string;
  displayMetadata: Record<string, string>;
} {
  const displayMetadata: Record<string, string> = {};
  
  // Format based on source type
  switch (result.sourceType) {
    case 'receipt':
      if (result.metadata.total && result.metadata.currency) {
        displayMetadata.amount = `${result.metadata.currency} ${result.metadata.total}`;
      }
      if (result.metadata.date) {
        displayMetadata.date = new Date(result.metadata.date).toLocaleDateString();
      }
      break;
      
    case 'claim':
      if (result.metadata.status) {
        displayMetadata.status = result.metadata.status;
      }
      if (result.metadata.priority) {
        displayMetadata.priority = result.metadata.priority;
      }
      break;
      
    case 'team_member':
      if (result.metadata.role) {
        displayMetadata.role = result.metadata.role;
      }
      if (result.metadata.email) {
        displayMetadata.email = result.metadata.email;
      }
      break;
      
    case 'business_directory':
      if (result.metadata.business_type) {
        displayMetadata.type = result.metadata.business_type;
      }
      if (result.metadata.state) {
        displayMetadata.location = result.metadata.state;
      }
      break;
  }
  
  return {
    displayTitle: result.title,
    displayDescription: result.description,
    displayMetadata
  };
}

/**
 * Check if search should use fallback method
 */
export function shouldUseFallback(error: any): boolean {
  // Use fallback for embedding generation failures
  if (error.message?.includes('embedding') || error.message?.includes('GEMINI_API_KEY')) {
    return true;
  }
  
  // Use fallback for database connection issues
  if (error.message?.includes('connection') || error.message?.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Generate search suggestions based on query
 */
export function generateSearchSuggestions(query: string, results: UnifiedSearchResult[]): string[] {
  const suggestions: Set<string> = new Set();
  
  // Extract common terms from successful results
  results.slice(0, 5).forEach(result => {
    // Add merchant names from receipts
    if (result.sourceType === 'receipt' && result.metadata.merchant) {
      suggestions.add(result.metadata.merchant);
    }
    
    // Add business names from directory
    if (result.sourceType === 'business_directory' && result.metadata.business_name) {
      suggestions.add(result.metadata.business_name);
    }
    
    // Add category names
    if (result.sourceType === 'custom_category' && result.metadata.name) {
      suggestions.add(result.metadata.name);
    }
  });
  
  return Array.from(suggestions).slice(0, 5);
}

/**
 * LLM-powered query preprocessing to understand intent and expand queries
 */
export async function llmPreprocessQuery(query: string): Promise<LLMPreprocessResult> {
  const startTime = Date.now();
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY not available, using basic preprocessing');
    return {
      expandedQuery: query,
      intent: 'general_search',
      entities: {},
      confidence: 0.5,
      queryType: 'conversational',
      processingTime: Date.now() - startTime
    };
  }

  let result: any = null;
  let responseText: string = '';

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Analyze this search query for a receipt management system and extract structured information.

Query: "${query}"

Please provide a JSON response with the following structure:
{
  "expandedQuery": "Enhanced version of the query with synonyms and related terms",
  "intent": "document_retrieval|data_analysis|general_search|financial_analysis",
  "entities": {
    "merchants": ["extracted merchant names"],
    "dates": ["extracted dates in YYYY-MM-DD format"],
    "categories": ["extracted categories"],
    "amounts": [extracted numerical amounts],
    "locations": ["extracted locations"]
  },
  "confidence": 0.0-1.0,
  "queryType": "specific|broad|analytical|conversational",
  "suggestedSources": ["receipt", "claim", "business_directory", "custom_category", "team_member"]
}

Guidelines for Intent Detection:
- Set intent to "financial_analysis" for queries about:
  * Spending patterns, trends, or analysis
  * Category breakdowns or comparisons
  * Monthly/yearly spending summaries
  * Merchant analysis or frequency
  * Budget analysis or expense tracking
  * Anomalies, unusual transactions, or outliers (but NOT simple amount filtering)
  * Time-based spending patterns
  * Payment method analysis
  * Business vs personal expense ratios
  * Examples: "how much did I spend on food", "monthly spending trends", "top merchants", "unusual transactions"
  * NOTE: Simple monetary filtering queries like "receipts less than X" or "receipts over Y" should be classified as document_retrieval, not financial_analysis

- Set intent to "document_retrieval" for queries about:
  * Finding specific receipts or documents
  * Searching for particular transactions
  * Looking up receipt details
  * Monetary filtering queries (receipts with specific amount criteria)
  * Examples: "McDonald's receipt from last week", "receipt for laptop purchase", "receipts less than 5", "receipts over 100", "receipts between 10 and 50"

- Set intent to "data_analysis" for queries about:
  * General data exploration
  * Non-financial analysis
  * Team collaboration insights
  * Examples: "team expense reports", "claim status analysis"

- For merchant searches, include "receipt" and "business_directory" in suggestedSources
- For team/collaboration queries, include "team_member" and "claim"
- Expand the query with relevant synonyms and Malaysian business terms
- Extract Malaysian business entities (Sdn Bhd, Pte Ltd, etc.)
- Handle both English and Malay terms

Return only valid JSON, no explanation.`;

    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
      },
    });

    responseText = result.response.text();

    // Extract JSON from markdown code blocks if present
    let jsonText = responseText.trim();

    // Check if response is wrapped in markdown code blocks
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }

    // Remove any leading/trailing non-JSON content
    const jsonStartIndex = jsonText.indexOf('{');
    const jsonEndIndex = jsonText.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      jsonText = jsonText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    const parsed = JSON.parse(jsonText);

    return {
      expandedQuery: parsed.expandedQuery || query,
      intent: parsed.intent || 'general_search',
      entities: parsed.entities || {},
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      queryType: parsed.queryType || 'conversational',
      suggestedSources: parsed.suggestedSources,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('LLM preprocessing error:', error);

    // Log the raw response for debugging if it's a JSON parsing error
    if (error instanceof SyntaxError && error.message.includes('JSON') && responseText) {
      console.error('Raw LLM response that failed to parse:', responseText);
    }

    return {
      expandedQuery: query,
      intent: 'general_search',
      entities: {},
      confidence: 0.3,
      queryType: 'conversational',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Re-rank search results using a more powerful LLM for contextual relevance
 */
export async function reRankSearchResults(params: ReRankingParams): Promise<ReRankingResult> {
  const startTime = Date.now();
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  // Validate inputs and provide fallback
  if (!geminiApiKey) {
    console.warn('Cannot perform re-ranking: missing GEMINI_API_KEY');
    return {
      rerankedResults: params.candidates.map(c => c.result),
      reRankingMetadata: {
        modelUsed: 'none-no-api-key',
        processingTime: Date.now() - startTime,
        candidatesCount: params.candidates.length,
        reRankingScore: 0,
        confidenceLevel: 'low'
      }
    };
  }

  console.log('🔑 DEBUG: GEMINI_API_KEY present:', !!geminiApiKey);
  console.log('🔑 DEBUG: API key length:', geminiApiKey.length);
  console.log('🔑 DEBUG: API key prefix:', geminiApiKey.substring(0, 10) + '...');

  if (params.candidates.length === 0) {
    console.warn('Cannot perform re-ranking: no candidates provided');
    return {
      rerankedResults: [],
      reRankingMetadata: {
        modelUsed: 'none-no-candidates',
        processingTime: Date.now() - startTime,
        candidatesCount: 0,
        reRankingScore: 0,
        confidenceLevel: 'low'
      }
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    // Use Gemini 1.5 Flash for re-ranking (stable model)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Validate candidates before processing
    const invalidSimilarities = params.candidates.filter(c =>
      typeof c.result.similarity !== 'number' || isNaN(c.result.similarity)
    );

    if (invalidSimilarities.length > 0) {
      console.warn(`⚠️ Found ${invalidSimilarities.length} candidates with invalid similarity scores, using fallback values`);
    }

    // Prepare candidates for re-ranking
    const candidateDescriptions = params.candidates.map((candidate, index) => {
      const result = candidate.result;
      // Ensure similarity is a valid number before calling toFixed
      const similarity = typeof result.similarity === 'number' && !isNaN(result.similarity)
        ? result.similarity
        : 0;

      return `${index + 1}. [${result.sourceType}] ${result.title}
   Description: ${result.description}
   Similarity: ${similarity.toFixed(3)}
   Metadata: ${JSON.stringify(result.metadata)}`;
    }).join('\n\n');

    const prompt = `
You are an expert search result ranker for a receipt management system. Re-rank these search results based on contextual relevance to the user's query.

Original Query: "${params.originalQuery}"

Search Results to Re-rank:
${candidateDescriptions}

Please analyze each result's relevance to the query considering:
1. Direct relevance to the search intent
2. Quality and completeness of information
3. Practical usefulness to the user
4. Contextual appropriateness

Provide a JSON response with the re-ranked order:
{
  "rankedOrder": [1, 3, 2, 4, 5, ...],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of ranking decisions"
}

The rankedOrder should list the result numbers (1-${params.candidates.length}) in order of relevance (most relevant first).
Return only valid JSON, no explanation outside the JSON.`;

    console.log('🤖 Sending re-ranking request to Gemini with', params.candidates.length, 'candidates');
    console.log('📝 DEBUG: Prompt length:', prompt.length);
    console.log('📝 DEBUG: Prompt preview:', prompt.substring(0, 200) + '...');

    // Retry logic for Gemini API calls
    let result;
    let lastError;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            // responseMimeType removed - not supported in older API versions
          },
        });
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        console.warn(`🔄 Gemini API attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!result) {
      throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    }

    const responseText = result.response.text();
    console.log('🤖 Raw Gemini response for re-ranking:', responseText);

    // Enhanced response validation
    if (!responseText || responseText.trim().length === 0) {
      console.log('📄 Raw response text: ', responseText);
      console.warn('⚠️ Gemini returned empty response, using original order');
      throw new Error('Empty response from Gemini API');
    }

    // Check for API error messages
    if (responseText.includes('RATE_LIMIT_EXCEEDED') ||
        responseText.includes('QUOTA_EXCEEDED') ||
        responseText.includes('API_KEY_INVALID') ||
        responseText.includes('PERMISSION_DENIED')) {
      console.warn('⚠️ Gemini API error detected:', responseText);
      throw new Error(`Gemini API error: ${responseText}`);
    }

    // Check for model overload or temporary unavailability
    if (responseText.includes('OVERLOADED') ||
        responseText.includes('UNAVAILABLE') ||
        responseText.includes('INTERNAL_ERROR')) {
      console.warn('⚠️ Gemini API temporarily unavailable:', responseText);
      throw new Error(`Gemini API temporarily unavailable: ${responseText}`);
    }

    // Robust JSON parsing with fallback
    let parsed;
    try {
      // Clean the response text to handle potential formatting issues
      const cleanedResponse = responseText.trim();

      // Try to extract JSON if it's wrapped in markdown or other text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : cleanedResponse;

      parsed = JSON.parse(jsonText);

      // Validate the parsed response has required fields
      if (!parsed.rankedOrder || !Array.isArray(parsed.rankedOrder)) {
        throw new Error('Invalid response structure: missing or invalid rankedOrder');
      }

    } catch (parseError) {
      console.error('❌ Failed to parse Gemini re-ranking response:', parseError);
      console.error('📄 Raw response text:', responseText);

      // Fallback to original order
      parsed = {
        rankedOrder: params.candidates.map((_, i) => i + 1),
        confidence: 0.3,
        reasoning: 'Fallback to original order due to parsing error'
      };
    }

    // Apply the re-ranking
    const rankedOrder = parsed.rankedOrder || params.candidates.map((_, i) => i + 1);
    const rerankedResults: UnifiedSearchResult[] = [];

    for (const rank of rankedOrder) {
      const candidateIndex = rank - 1;
      if (candidateIndex >= 0 && candidateIndex < params.candidates.length) {
        const candidate = params.candidates[candidateIndex];
        // Ensure similarity is a valid number before calculations
        const baseSimilarity = typeof candidate.result.similarity === 'number' && !isNaN(candidate.result.similarity)
          ? candidate.result.similarity
          : 0;

        // Boost similarity score based on re-ranking position
        const positionBoost = 1 + (rankedOrder.length - rankedOrder.indexOf(rank)) * 0.05;
        rerankedResults.push({
          ...candidate.result,
          similarity: Math.min(1.0, baseSimilarity * positionBoost)
        });
      }
    }

    // Limit results if specified
    const finalResults = params.maxResults
      ? rerankedResults.slice(0, params.maxResults)
      : rerankedResults;

    const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.8));
    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';

    return {
      rerankedResults: finalResults,
      reRankingMetadata: {
        modelUsed: 'gemini-1.5-flash',
        processingTime: Date.now() - startTime,
        candidatesCount: params.candidates.length,
        reRankingScore: confidence,
        confidenceLevel
      }
    };

  } catch (error) {
    console.error('❌ Re-ranking error:', error);
    console.error('🔍 Error details:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      candidatesCount: params.candidates?.length || 0,
      originalQuery: params.originalQuery || 'No query',
      errorType: typeof error,
      errorConstructor: error?.constructor?.name || 'Unknown'
    });

    // Ensure we have valid candidates array
    const validCandidates = Array.isArray(params.candidates) ? params.candidates : [];

    // Fallback to original order with proper similarity handling
    const fallbackResults = validCandidates.map(c => {
      // Ensure candidate has proper structure
      if (!c || !c.result) {
        console.warn('Invalid candidate structure, creating minimal result');
        return {
          id: 'error-result',
          title: 'Error in search result',
          description: 'An error occurred processing this result',
          sourceType: 'error',
          similarity: 0,
          metadata: {}
        };
      }

      const baseSimilarity = typeof c.result.similarity === 'number' && !isNaN(c.result.similarity)
        ? c.result.similarity
        : 0;

      return {
        ...c.result,
        similarity: baseSimilarity
      };
    });

    return {
      rerankedResults: fallbackResults,
      reRankingMetadata: {
        modelUsed: 'fallback-error',
        processingTime: Date.now() - startTime,
        candidatesCount: validCandidates.length,
        reRankingScore: 0.3,
        confidenceLevel: 'low'
      }
    };
  }
}
