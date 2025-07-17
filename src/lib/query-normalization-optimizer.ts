/**
 * Optimized Query Normalization
 * High-performance query normalization with caching and pre-compiled patterns
 */

// Pre-compiled regex patterns for better performance
const NORMALIZATION_PATTERNS = {
  // Remove numerical qualifiers
  numericalQualifiers: [
    /\b(top|first|latest|recent|show\s+me|find\s+me|get\s+me)\s+\d+\s*/gi,
    /\b(show|find|get)\s+(me\s+)?(all|any)\s*/gi,
    /\b(all|any)\s+(of\s+)?(the\s+)?/gi,
    /\b(receipts?|purchases?|expenses?|transactions?)\s+(from|at|in)\s+/gi
  ],

  // Common stop words to remove
  stopWords: /\b(receipts?|purchases?|expenses?|transactions?|show|find|get|me|all|any|the|and|or|from|at|in|for|with|of)\b/gi,

  // Whitespace normalization
  multipleSpaces: /\s+/g,
  leadingTrailingSpaces: /^\s+|\s+$/g,

  // Currency and amount patterns for preservation
  currencyAmounts: /(\$|rm|myr)?\s*\d+(?:\.\d{2})?(?:\s*(usd|myr|rm|dollars?|ringgit))?/gi,
  
  // Temporal expressions to preserve
  temporalExpressions: /\b(today|yesterday|last|this|recent|week|month|year|days?|weeks?|months?|ago)\b/gi,

  // Merchant names to preserve
  merchantNames: /\b(starbucks|mcdonalds?|kfc|tesco|grab|shell|petronas|coffee\s+bean|old\s+town)\b/gi
};

// Cache for normalized queries
const normalizationCache = new Map<string, {
  normalized: string;
  timestamp: number;
  accessCount: number;
}>();

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

/**
 * High-performance query normalization with caching
 */
export function optimizedNormalizeQuery(query: string): string {
  // Check cache first
  const cached = normalizationCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    cached.accessCount++;
    return cached.normalized;
  }

  const startTime = performance.now();
  
  // Fast path for empty or very short queries
  if (!query || query.length < 3) {
    return query.toLowerCase().trim();
  }

  let normalized = query.toLowerCase();

  // Preserve important elements before normalization
  const preservedElements = {
    amounts: [] as string[],
    temporal: [] as string[],
    merchants: [] as string[]
  };

  // Extract and preserve currency amounts
  let match;
  while ((match = NORMALIZATION_PATTERNS.currencyAmounts.exec(normalized)) !== null) {
    preservedElements.amounts.push(match[0]);
  }
  NORMALIZATION_PATTERNS.currencyAmounts.lastIndex = 0; // Reset regex

  // Extract and preserve temporal expressions
  while ((match = NORMALIZATION_PATTERNS.temporalExpressions.exec(normalized)) !== null) {
    preservedElements.temporal.push(match[0]);
  }
  NORMALIZATION_PATTERNS.temporalExpressions.lastIndex = 0; // Reset regex

  // Extract and preserve merchant names
  while ((match = NORMALIZATION_PATTERNS.merchantNames.exec(normalized)) !== null) {
    preservedElements.merchants.push(match[0]);
  }
  NORMALIZATION_PATTERNS.merchantNames.lastIndex = 0; // Reset regex

  // Apply normalization patterns
  for (const pattern of NORMALIZATION_PATTERNS.numericalQualifiers) {
    normalized = normalized.replace(pattern, '');
  }

  // Remove stop words but preserve important terms
  const words = normalized.split(/\s+/);
  const filteredWords = words.filter(word => {
    // Keep if it's a preserved element
    if (preservedElements.amounts.some(amount => amount.includes(word)) ||
        preservedElements.temporal.some(temporal => temporal.includes(word)) ||
        preservedElements.merchants.some(merchant => merchant.includes(word))) {
      return true;
    }
    
    // Keep if it's not a stop word and has meaningful length
    return word.length > 2 && !NORMALIZATION_PATTERNS.stopWords.test(word);
  });

  normalized = filteredWords.join(' ');

  // Clean up whitespace
  normalized = normalized
    .replace(NORMALIZATION_PATTERNS.multipleSpaces, ' ')
    .replace(NORMALIZATION_PATTERNS.leadingTrailingSpaces, '');

  // If normalized query is too short, fall back to original
  if (normalized.length < 3) {
    normalized = query.toLowerCase().trim();
  }

  const processingTime = performance.now() - startTime;

  // Cache the result
  if (normalizationCache.size >= MAX_CACHE_SIZE) {
    // Simple LRU eviction - remove least accessed entries
    const entries = Array.from(normalizationCache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount);
    
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove 20%
    toRemove.forEach(([key]) => normalizationCache.delete(key));
  }

  normalizationCache.set(query, {
    normalized,
    timestamp: Date.now(),
    accessCount: 1
  });

  // Log performance for monitoring
  if (processingTime > 10) {
    console.warn(`Slow query normalization: ${processingTime.toFixed(2)}ms for "${query}"`);
  }

  return normalized;
}

/**
 * Batch normalize multiple queries for efficiency
 */
export function batchNormalizeQueries(queries: string[]): string[] {
  const startTime = performance.now();
  const results: string[] = [];

  // Process in batches to avoid blocking
  const batchSize = 10;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = batch.map(query => optimizedNormalizeQuery(query));
    results.push(...batchResults);

    // Yield control to prevent blocking
    if (i + batchSize < queries.length) {
      // Use setTimeout to yield control
      setTimeout(() => {}, 0);
    }
  }

  const totalTime = performance.now() - startTime;
  console.log(`Batch normalized ${queries.length} queries in ${totalTime.toFixed(2)}ms`);

  return results;
}

/**
 * Smart query similarity detection for cache optimization
 */
export function areQueriesSimilar(query1: string, query2: string, threshold: number = 0.8): boolean {
  const normalized1 = optimizedNormalizeQuery(query1);
  const normalized2 = optimizedNormalizeQuery(query2);

  // Quick exact match
  if (normalized1 === normalized2) {
    return true;
  }

  // Length difference check
  const lengthDiff = Math.abs(normalized1.length - normalized2.length);
  if (lengthDiff > Math.max(normalized1.length, normalized2.length) * 0.5) {
    return false;
  }

  // Simple word overlap similarity
  const words1 = new Set(normalized1.split(/\s+/));
  const words2 = new Set(normalized2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

/**
 * Extract semantic keywords for search optimization
 */
export function extractSemanticKeywords(query: string): {
  keywords: string[];
  entities: {
    amounts: string[];
    temporal: string[];
    merchants: string[];
    categories: string[];
  };
  confidence: number;
} {
  const normalized = optimizedNormalizeQuery(query);
  
  // Extract entities using pre-compiled patterns
  const entities = {
    amounts: [] as string[],
    temporal: [] as string[],
    merchants: [] as string[],
    categories: [] as string[]
  };

  // Extract amounts
  let match;
  while ((match = NORMALIZATION_PATTERNS.currencyAmounts.exec(query)) !== null) {
    entities.amounts.push(match[0]);
  }
  NORMALIZATION_PATTERNS.currencyAmounts.lastIndex = 0;

  // Extract temporal expressions
  while ((match = NORMALIZATION_PATTERNS.temporalExpressions.exec(query)) !== null) {
    entities.temporal.push(match[0]);
  }
  NORMALIZATION_PATTERNS.temporalExpressions.lastIndex = 0;

  // Extract merchant names
  while ((match = NORMALIZATION_PATTERNS.merchantNames.exec(query)) !== null) {
    entities.merchants.push(match[0]);
  }
  NORMALIZATION_PATTERNS.merchantNames.lastIndex = 0;

  // Extract remaining keywords
  const keywords = normalized
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !entities.amounts.some(amount => amount.includes(word)))
    .filter(word => !entities.temporal.some(temporal => temporal.includes(word)))
    .filter(word => !entities.merchants.some(merchant => merchant.includes(word)));

  // Calculate confidence based on entity extraction
  let confidence = 0.5;
  if (entities.amounts.length > 0) confidence += 0.2;
  if (entities.temporal.length > 0) confidence += 0.15;
  if (entities.merchants.length > 0) confidence += 0.15;
  if (keywords.length > 0) confidence += 0.1;

  return {
    keywords,
    entities,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Get normalization cache statistics
 */
export function getNormalizationStats(): {
  cacheSize: number;
  hitRate: number;
  averageProcessingTime: number;
} {
  const entries = Array.from(normalizationCache.values());
  const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
  const cacheHits = entries.filter(entry => entry.accessCount > 1).length;

  return {
    cacheSize: normalizationCache.size,
    hitRate: totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0,
    averageProcessingTime: 0 // Would need to track this separately
  };
}

/**
 * Clear normalization cache
 */
export function clearNormalizationCache(): void {
  normalizationCache.clear();
}

/**
 * Cleanup expired cache entries
 */
export function cleanupNormalizationCache(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [key, entry] of normalizationCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach(key => normalizationCache.delete(key));
}

// Auto cleanup every 5 minutes
setInterval(cleanupNormalizationCache, 5 * 60 * 1000);
