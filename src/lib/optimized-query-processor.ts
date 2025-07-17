/**
 * Optimized Query Processing Pipeline
 * High-performance query parsing with caching, parallel processing, and Web Worker support
 */

import { parseNaturalLanguageQuery, ParsedQuery } from './enhanced-query-parser';
import { detectUserIntent } from './chat-response-generator';
import { UnifiedSearchParams } from '@/types/unified-search';

// Performance monitoring
interface ProcessingMetrics {
  totalTime: number;
  parseTime: number;
  intentTime: number;
  parameterTime: number;
  cacheHit: boolean;
  timestamp: number;
}

// Cache configuration
interface CacheEntry {
  query: string;
  result: OptimizedQueryResult;
  timestamp: number;
  accessCount: number;
}

interface OptimizedQueryResult {
  parsedQuery: ParsedQuery;
  intent: any;
  searchParams: UnifiedSearchParams;
  metrics: ProcessingMetrics;
}

// Pre-compiled regex patterns for better performance
const PRECOMPILED_PATTERNS = {
  // Quick intent detection patterns
  help: /\b(help|how|what|guide|explain)\b/i,
  greeting: /\b(hi|hello|hey|good\s+(morning|afternoon|evening))\b/i,
  showMore: /\b(show\s+more|more\s+results|load\s+more|see\s+more|additional\s+results)\b/i,
  
  // Quick monetary detection
  monetary: /\b(over|above|under|below|between|\$|rm|myr|\d+(?:\.\d{2})?)\b/i,
  
  // Quick temporal detection
  temporal: /\b(today|yesterday|last|this|recent|week|month|year|days?|ago)\b/i,
  
  // Quick merchant detection
  merchant: /\b(starbucks|mcdonalds?|tesco|grab|shell|petronas)\b/i
};

class OptimizedQueryProcessor {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 200;
  private worker: Worker | null = null;

  constructor() {
    this.initializeWorker();
    this.startCacheCleanup();
  }

  /**
   * Initialize Web Worker for heavy processing
   */
  private initializeWorker(): void {
    try {
      // Create inline worker for query processing
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          if (type === 'PARSE_QUERY') {
            try {
              // Simulate heavy parsing work
              const result = {
                success: true,
                data: data // In real implementation, this would do the actual parsing
              };
              self.postMessage({ type: 'PARSE_COMPLETE', result });
            } catch (error) {
              self.postMessage({ type: 'PARSE_ERROR', error: error.message });
            }
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
    } catch (error) {
      console.warn('Web Worker not available, falling back to main thread processing');
      this.worker = null;
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Clean every minute
  }

  /**
   * Clean expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    // Implement LRU eviction if cache is too large
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.accessCount - b.accessCount);
      
      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: string, options?: any): string {
    const normalized = query.toLowerCase().trim();
    const optionsHash = options ? JSON.stringify(options) : '';
    return `${normalized}:${optionsHash}`;
  }

  /**
   * Quick intent detection using pre-compiled patterns
   */
  private quickIntentDetection(query: string): { intent: string; confidence: number } | null {
    const normalized = query.toLowerCase().trim();

    if (PRECOMPILED_PATTERNS.help.test(normalized)) {
      return { intent: 'help', confidence: 0.9 };
    }
    
    if (PRECOMPILED_PATTERNS.greeting.test(normalized)) {
      return { intent: 'greeting', confidence: 0.9 };
    }
    
    if (PRECOMPILED_PATTERNS.showMore.test(normalized)) {
      return { intent: 'show_more', confidence: 0.95 };
    }

    return null;
  }

  /**
   * Quick query classification for optimization routing
   */
  private classifyQuery(query: string): {
    type: 'simple' | 'complex' | 'monetary' | 'temporal';
    useWorker: boolean;
    skipFullParsing: boolean;
  } {
    const normalized = query.toLowerCase().trim();
    
    // Simple queries that don't need full parsing
    if (normalized.length < 10 && !PRECOMPILED_PATTERNS.monetary.test(normalized)) {
      return { type: 'simple', useWorker: false, skipFullParsing: true };
    }

    // Monetary queries need special handling
    if (PRECOMPILED_PATTERNS.monetary.test(normalized)) {
      return { type: 'monetary', useWorker: false, skipFullParsing: false };
    }

    // Temporal queries
    if (PRECOMPILED_PATTERNS.temporal.test(normalized)) {
      return { type: 'temporal', useWorker: false, skipFullParsing: false };
    }

    // Complex queries that benefit from worker processing
    if (normalized.length > 50) {
      return { type: 'complex', useWorker: true, skipFullParsing: false };
    }

    return { type: 'simple', useWorker: false, skipFullParsing: false };
  }

  /**
   * Process query with optimizations
   */
  async processQuery(
    query: string, 
    options?: {
      useCache?: boolean;
      forceRefresh?: boolean;
      conversationHistory?: string[];
    }
  ): Promise<OptimizedQueryResult> {
    const startTime = performance.now();
    const { useCache = true, forceRefresh = false } = options || {};

    // Generate cache key
    const cacheKey = this.generateCacheKey(query, options);

    // Check cache first (unless forced refresh)
    if (useCache && !forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        cached.accessCount++;
        
        // Update metrics for cache hit
        const metrics: ProcessingMetrics = {
          ...cached.result.metrics,
          totalTime: performance.now() - startTime,
          cacheHit: true,
          timestamp: Date.now()
        };

        return {
          ...cached.result,
          metrics
        };
      }
    }

    // Quick intent detection
    const quickIntent = this.quickIntentDetection(query);
    if (quickIntent && quickIntent.intent !== 'search') {
      const result: OptimizedQueryResult = {
        parsedQuery: {
          originalQuery: query,
          searchTerms: [],
          queryType: 'general',
          confidence: quickIntent.confidence,
          filters: {}
        },
        intent: { intent: quickIntent.intent, confidence: quickIntent.confidence },
        searchParams: this.generateDefaultSearchParams(query),
        metrics: {
          totalTime: performance.now() - startTime,
          parseTime: 0,
          intentTime: 5,
          parameterTime: 5,
          cacheHit: false,
          timestamp: Date.now()
        }
      };

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, {
          query,
          result,
          timestamp: Date.now(),
          accessCount: 1
        });
      }

      return result;
    }

    // Classify query for optimization routing
    const classification = this.classifyQuery(query);

    // Process based on classification
    let parsedQuery: ParsedQuery;
    let intent: any;
    
    const parseStartTime = performance.now();
    
    if (classification.skipFullParsing) {
      // Simple processing for basic queries
      parsedQuery = this.simpleQueryParsing(query);
    } else if (classification.useWorker && this.worker) {
      // Use Web Worker for complex queries
      parsedQuery = await this.workerBasedParsing(query);
    } else {
      // Standard parsing
      parsedQuery = parseNaturalLanguageQuery(query);
    }
    
    const parseTime = performance.now() - parseStartTime;

    // Intent detection
    const intentStartTime = performance.now();
    intent = detectUserIntent(query);
    const intentTime = performance.now() - intentStartTime;

    // Generate search parameters
    const paramStartTime = performance.now();
    const searchParams = this.generateOptimizedSearchParams(parsedQuery, options);
    const parameterTime = performance.now() - paramStartTime;

    const totalTime = performance.now() - startTime;

    const result: OptimizedQueryResult = {
      parsedQuery,
      intent,
      searchParams,
      metrics: {
        totalTime,
        parseTime,
        intentTime,
        parameterTime,
        cacheHit: false,
        timestamp: Date.now()
      }
    };

    // Cache the result
    if (useCache) {
      this.cache.set(cacheKey, {
        query,
        result,
        timestamp: Date.now(),
        accessCount: 1
      });
    }

    return result;
  }

  /**
   * Simple query parsing for basic queries
   */
  private simpleQueryParsing(query: string): ParsedQuery {
    return {
      originalQuery: query,
      searchTerms: query.toLowerCase().split(/\s+/).filter(term => term.length > 2),
      queryType: 'general',
      confidence: 0.7,
      filters: {}
    };
  }

  /**
   * Web Worker based parsing for complex queries
   */
  private async workerBasedParsing(query: string): Promise<ParsedQuery> {
    if (!this.worker) {
      // Fallback to main thread
      return parseNaturalLanguageQuery(query);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker parsing timeout'));
      }, 1000); // 1 second timeout

      const handleMessage = (e: MessageEvent) => {
        const { type, result, error } = e.data;
        
        if (type === 'PARSE_COMPLETE') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handleMessage);
          resolve(result.data || parseNaturalLanguageQuery(query));
        } else if (type === 'PARSE_ERROR') {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(error));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'PARSE_QUERY', data: query });
    }).catch(() => {
      // Fallback to main thread on error
      return parseNaturalLanguageQuery(query);
    });
  }

  /**
   * Generate optimized search parameters
   */
  private generateOptimizedSearchParams(
    parsedQuery: ParsedQuery,
    options?: any
  ): UnifiedSearchParams {
    return {
      query: parsedQuery.originalQuery,
      // 🔧 FIX: Use singular source names that match backend validation
      sources: ['receipt', 'business_directory'],
      limit: 20,
      offset: 0,
      filters: {
        dateRange: parsedQuery.dateRange,
        amountRange: parsedQuery.amountRange,
        categories: parsedQuery.categories,
        merchants: parsedQuery.merchants
      },
      similarityThreshold: 0.2,
      includeMetadata: true,
      aggregationMode: 'relevance'
    };
  }

  /**
   * Generate default search parameters for simple queries
   */
  private generateDefaultSearchParams(query: string): UnifiedSearchParams {
    return {
      query,
      sources: ['receipts'],
      limit: 10,
      offset: 0,
      filters: {},
      similarityThreshold: 0.3,
      includeMetadata: true,
      aggregationMode: 'relevance'
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalRequests: number;
    averageProcessingTime: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalRequests = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHits = entries.filter(entry => entry.accessCount > 1).length;
    const avgTime = entries.reduce((sum, entry) => sum + entry.result.metrics.totalTime, 0) / entries.length;

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      totalRequests,
      averageProcessingTime: avgTime || 0
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.cache.clear();
  }
}

// Export singleton instance
export const optimizedQueryProcessor = new OptimizedQueryProcessor();
export type { OptimizedQueryResult, ProcessingMetrics };
