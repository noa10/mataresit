/**
 * Optimized Intent Detection System
 * High-performance intent detection with caching and pattern matching
 */

// Intent patterns with confidence scores
interface IntentPattern {
  pattern: RegExp;
  intent: string;
  confidence: number;
  priority: number; // Higher priority patterns are checked first
}

// Pre-compiled intent patterns sorted by priority
const INTENT_PATTERNS: IntentPattern[] = [
  // High priority - exact matches
  { pattern: /^(help|how|what|guide|explain)$/i, intent: 'help', confidence: 0.95, priority: 10 },
  { pattern: /^(hi|hello|hey)$/i, intent: 'greeting', confidence: 0.95, priority: 10 },
  
  // Medium-high priority - clear indicators
  { pattern: /\b(show\s+more|more\s+results|load\s+more|see\s+more|additional\s+results)\b/i, intent: 'show_more', confidence: 0.9, priority: 9 },
  { pattern: /\b(help|how\s+do\s+i|how\s+to|what\s+is|explain|guide)\b/i, intent: 'help', confidence: 0.8, priority: 8 },
  { pattern: /\b(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings)\b/i, intent: 'greeting', confidence: 0.8, priority: 8 },
  
  // Medium priority - search intents
  { pattern: /\b(search|find|show|get|list|display)\s+(me\s+)?(all\s+)?(my\s+)?(receipts?|purchases?|expenses?|transactions?)\b/i, intent: 'search', confidence: 0.7, priority: 7 },
  { pattern: /\b(receipts?|purchases?|expenses?|transactions?)\s+(from|at|in|over|under|above|below)\b/i, intent: 'search', confidence: 0.75, priority: 7 },
  
  // Lower priority - general patterns
  { pattern: /\b(thank\s+you|thanks|thx)\b/i, intent: 'thanks', confidence: 0.8, priority: 6 },
  { pattern: /\b(bye|goodbye|see\s+you|farewell)\b/i, intent: 'goodbye', confidence: 0.8, priority: 6 },
  { pattern: /\b(yes|yeah|yep|ok|okay|sure)\b/i, intent: 'confirmation', confidence: 0.6, priority: 5 },
  { pattern: /\b(no|nope|nah|cancel|stop)\b/i, intent: 'negation', confidence: 0.6, priority: 5 },
  
  // Fallback - anything with search terms
  { pattern: /\b(\$|rm|myr|\d+|starbucks|mcdonalds?|tesco|grab)\b/i, intent: 'search', confidence: 0.5, priority: 1 }
];

// Sort patterns by priority (highest first)
INTENT_PATTERNS.sort((a, b) => b.priority - a.priority);

// Cache for intent detection results
interface IntentCacheEntry {
  intent: string;
  confidence: number;
  timestamp: number;
  accessCount: number;
}

const intentCache = new Map<string, IntentCacheEntry>();
const INTENT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_INTENT_CACHE_SIZE = 300;

/**
 * Optimized intent detection with caching and fast pattern matching
 */
export function detectIntentOptimized(query: string): {
  intent: string;
  confidence: number;
  processingTime: number;
  fromCache: boolean;
} {
  const startTime = performance.now();
  
  // Normalize query for consistent caching
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check cache first
  const cached = intentCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < INTENT_CACHE_TTL) {
    cached.accessCount++;
    return {
      intent: cached.intent,
      confidence: cached.confidence,
      processingTime: performance.now() - startTime,
      fromCache: true
    };
  }

  // Fast path for empty queries
  if (!normalizedQuery || normalizedQuery.length === 0) {
    return {
      intent: 'unknown',
      confidence: 0,
      processingTime: performance.now() - startTime,
      fromCache: false
    };
  }

  // Pattern matching with early termination
  let bestMatch = { intent: 'search', confidence: 0.3 }; // Default to search
  
  for (const { pattern, intent, confidence } of INTENT_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      bestMatch = { intent, confidence };
      break; // Early termination on first match (patterns are sorted by priority)
    }
  }

  const processingTime = performance.now() - startTime;

  // Cache the result
  cacheIntentResult(normalizedQuery, bestMatch.intent, bestMatch.confidence);

  return {
    intent: bestMatch.intent,
    confidence: bestMatch.confidence,
    processingTime,
    fromCache: false
  };
}

/**
 * Cache intent detection result
 */
function cacheIntentResult(query: string, intent: string, confidence: number): void {
  // Implement LRU eviction if cache is full
  if (intentCache.size >= MAX_INTENT_CACHE_SIZE) {
    const entries = Array.from(intentCache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount);
    
    const toRemove = entries.slice(0, Math.floor(MAX_INTENT_CACHE_SIZE * 0.2)); // Remove 20%
    toRemove.forEach(([key]) => intentCache.delete(key));
  }

  intentCache.set(query, {
    intent,
    confidence,
    timestamp: Date.now(),
    accessCount: 1
  });
}

/**
 * Batch intent detection for multiple queries
 */
export function batchDetectIntents(queries: string[]): Array<{
  query: string;
  intent: string;
  confidence: number;
  processingTime: number;
}> {
  const startTime = performance.now();
  const results: Array<{
    query: string;
    intent: string;
    confidence: number;
    processingTime: number;
  }> = [];

  // Process in batches to avoid blocking
  const batchSize = 20;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    
    for (const query of batch) {
      const result = detectIntentOptimized(query);
      results.push({
        query,
        intent: result.intent,
        confidence: result.confidence,
        processingTime: result.processingTime
      });
    }

    // Yield control between batches
    if (i + batchSize < queries.length) {
      setTimeout(() => {}, 0);
    }
  }

  const totalTime = performance.now() - startTime;
  console.log(`Batch processed ${queries.length} intent detections in ${totalTime.toFixed(2)}ms`);

  return results;
}

/**
 * Enhanced intent detection with context awareness
 */
export function detectIntentWithContext(
  query: string,
  conversationHistory?: string[],
  userPreferences?: any
): {
  intent: string;
  confidence: number;
  contextualBoost: number;
  processingTime: number;
} {
  const startTime = performance.now();
  
  // Get base intent
  const baseResult = detectIntentOptimized(query);
  let { intent, confidence } = baseResult;
  let contextualBoost = 0;

  // Apply contextual adjustments
  if (conversationHistory && conversationHistory.length > 0) {
    const recentQueries = conversationHistory.slice(-3); // Last 3 queries
    
    // If recent queries were searches, boost search intent
    const recentSearches = recentQueries.filter(q => 
      detectIntentOptimized(q).intent === 'search'
    ).length;
    
    if (recentSearches >= 2 && intent === 'search') {
      contextualBoost = 0.1;
      confidence = Math.min(confidence + contextualBoost, 1.0);
    }
    
    // If user just asked for help, boost help-related intents
    const lastQuery = recentQueries[recentQueries.length - 1];
    if (lastQuery && detectIntentOptimized(lastQuery).intent === 'help') {
      if (intent === 'search' || intent === 'help') {
        contextualBoost = 0.05;
        confidence = Math.min(confidence + contextualBoost, 1.0);
      }
    }
  }

  // Apply user preference adjustments
  if (userPreferences?.preferredIntents) {
    if (userPreferences.preferredIntents.includes(intent)) {
      contextualBoost += 0.05;
      confidence = Math.min(confidence + contextualBoost, 1.0);
    }
  }

  return {
    intent,
    confidence,
    contextualBoost,
    processingTime: performance.now() - startTime
  };
}

/**
 * Get intent detection statistics
 */
export function getIntentDetectionStats(): {
  cacheSize: number;
  hitRate: number;
  averageProcessingTime: number;
  intentDistribution: Record<string, number>;
} {
  const entries = Array.from(intentCache.values());
  const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
  const cacheHits = entries.filter(entry => entry.accessCount > 1).length;

  // Calculate intent distribution
  const intentCounts: Record<string, number> = {};
  entries.forEach(entry => {
    intentCounts[entry.intent] = (intentCounts[entry.intent] || 0) + entry.accessCount;
  });

  return {
    cacheSize: intentCache.size,
    hitRate: totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0,
    averageProcessingTime: 0, // Would need separate tracking
    intentDistribution: intentCounts
  };
}

/**
 * Clear intent detection cache
 */
export function clearIntentCache(): void {
  intentCache.clear();
}

/**
 * Cleanup expired intent cache entries
 */
export function cleanupIntentCache(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [key, entry] of intentCache.entries()) {
    if (now - entry.timestamp > INTENT_CACHE_TTL) {
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach(key => intentCache.delete(key));
}

/**
 * Validate and optimize intent patterns
 */
export function validateIntentPatterns(): {
  validPatterns: number;
  invalidPatterns: number;
  duplicatePatterns: number;
  optimizationSuggestions: string[];
} {
  const suggestions: string[] = [];
  let validPatterns = 0;
  let invalidPatterns = 0;
  let duplicatePatterns = 0;

  const seenPatterns = new Set<string>();

  for (const { pattern, intent, confidence, priority } of INTENT_PATTERNS) {
    try {
      // Test pattern validity
      pattern.test('test');
      validPatterns++;

      // Check for duplicates
      const patternStr = pattern.source;
      if (seenPatterns.has(patternStr)) {
        duplicatePatterns++;
        suggestions.push(`Duplicate pattern found: ${patternStr}`);
      } else {
        seenPatterns.add(patternStr);
      }

      // Check confidence ranges
      if (confidence < 0 || confidence > 1) {
        suggestions.push(`Invalid confidence for ${intent}: ${confidence}`);
      }

      // Check priority ranges
      if (priority < 1 || priority > 10) {
        suggestions.push(`Invalid priority for ${intent}: ${priority}`);
      }

    } catch (error) {
      invalidPatterns++;
      suggestions.push(`Invalid regex pattern: ${pattern.source}`);
    }
  }

  return {
    validPatterns,
    invalidPatterns,
    duplicatePatterns,
    optimizationSuggestions: suggestions
  };
}

// Auto cleanup every 10 minutes
setInterval(cleanupIntentCache, 10 * 60 * 1000);
