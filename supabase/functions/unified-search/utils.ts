/**
 * Utility functions for unified search functionality
 */

import { UnifiedSearchParams, SearchFilters, ValidationResult, UnifiedSearchResult } from './types.ts';

/**
 * Validate search parameters
 */
export function validateSearchParams(params: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedParams: errors.length === 0 ? sanitizedParams : undefined
  };
}

/**
 * Validate search filters
 */
function validateFilters(filters: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

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
    if (typeof filters.amountRange.min !== 'number' || 
        typeof filters.amountRange.max !== 'number') {
      errors.push('Amount range min and max must be numbers');
    } else if (filters.amountRange.min < 0) {
      errors.push('Amount range min cannot be negative');
    } else if (filters.amountRange.min > filters.amountRange.max) {
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
  if (result.sourceType === 'custom_categories' && titleLower === queryLower) {
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
  if (hasMalay && (result.sourceType === 'business_directory' || result.sourceType === 'custom_categories')) {
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
