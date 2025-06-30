/**
 * Cache Key Generator
 *
 * Provides consistent, secure, and hierarchical cache key generation
 * for the Mataresit caching system.
 */

import { CacheKeyParams, CacheKeyGenerator, CacheSource } from './types';

// Cache key configuration
const CACHE_KEY_CONFIG = {
  prefix: 'mataresit',
  version: 'v1',
  separator: ':',
  hashAlgorithm: 'sha256',
  maxKeyLength: 250, // Redis key length limit
  encoding: 'hex' as const,
};

// TTL configurations for different cache sources (in milliseconds)
export const CACHE_TTL_CONFIG: Record<CacheSource, number> = {
  llm_preprocessing: 60 * 60 * 1000,      // 1 hour
  unified_search: 15 * 60 * 1000,         // 15 minutes
  financial_aggregation: 5 * 60 * 1000,   // 5 minutes
  embedding_generation: 24 * 60 * 60 * 1000, // 24 hours
  reranking_results: 30 * 60 * 1000,      // 30 minutes
  ui_components: 60 * 60 * 1000,          // 1 hour
  conversation_history: 7 * 24 * 60 * 60 * 1000, // 7 days
  user_preferences: 24 * 60 * 60 * 1000,  // 24 hours
};

/**
 * Default Cache Key Generator Implementation
 */
export class DefaultCacheKeyGenerator implements CacheKeyGenerator {
  /**
   * Generate a cache key from parameters
   */
  generate(params: CacheKeyParams): string {
    const {
      source,
      userId,
      query,
      filters,
      timestamp,
      version = CACHE_KEY_CONFIG.version
    } = params;

    // Build key components
    const components: string[] = [
      CACHE_KEY_CONFIG.prefix,
      version,
      source
    ];

    // Add user ID if provided
    if (userId) {
      components.push(`user:${this.hashValueSync(userId)}`);
    }

    // Add query hash if provided
    if (query) {
      components.push(`query:${this.hashValueSync(query)}`);
    }

    // Add filters hash if provided
    if (filters && Object.keys(filters).length > 0) {
      const filtersString = this.normalizeFilters(filters);
      components.push(`filters:${this.hashValueSync(filtersString)}`);
    }

    // Add timestamp for time-sensitive caches
    if (timestamp) {
      const timeWindow = this.getTimeWindow(timestamp, source);
      components.push(`time:${timeWindow}`);
    }

    // Join components and ensure key length limit
    const key = components.join(CACHE_KEY_CONFIG.separator);
    
    if (key.length > CACHE_KEY_CONFIG.maxKeyLength) {
      // If key is too long, hash the entire key
      return `${CACHE_KEY_CONFIG.prefix}:${version}:${source}:${this.hashValueSync(key)}`;
    }

    return key;
  }

  /**
   * Parse a cache key back to parameters
   */
  parse(key: string): CacheKeyParams | null {
    try {
      const parts = key.split(CACHE_KEY_CONFIG.separator);
      
      if (parts.length < 3 || parts[0] !== CACHE_KEY_CONFIG.prefix) {
        return null;
      }

      const result: CacheKeyParams = {
        source: parts[2] as CacheSource,
        version: parts[1],
      };

      // Parse additional components
      for (let i = 3; i < parts.length; i++) {
        const part = parts[i];
        const [type, value] = part.split(':');

        switch (type) {
          case 'user':
            result.userId = value;
            break;
          case 'query':
            // Note: We can't reverse the hash, so we store the hash
            break;
          case 'filters':
            // Note: We can't reverse the hash, so we store the hash
            break;
          case 'time':
            result.timestamp = parseInt(value, 10);
            break;
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to parse cache key:', error);
      return null;
    }
  }

  /**
   * Validate a cache key format
   */
  validate(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (key.length > CACHE_KEY_CONFIG.maxKeyLength) {
      return false;
    }

    const parts = key.split(CACHE_KEY_CONFIG.separator);
    
    // Must have at least prefix, version, and source
    if (parts.length < 3) {
      return false;
    }

    // Check prefix
    if (parts[0] !== CACHE_KEY_CONFIG.prefix) {
      return false;
    }

    // Check version format
    if (!parts[1].startsWith('v')) {
      return false;
    }

    // Check source is valid
    const validSources: string[] = [
      'llm_preprocessing',
      'unified_search',
      'financial_aggregation',
      'embedding_generation',
      'reranking_results',
      'ui_components',
      'conversation_history',
      'user_preferences'
    ];

    if (!validSources.includes(parts[2])) {
      return false;
    }

    return true;
  }

  /**
   * Generate cache key for LLM preprocessing
   */
  generateLLMKey(query: string, userId?: string): string {
    return this.generate({
      source: 'llm_preprocessing',
      query,
      userId,
    });
  }

  /**
   * Generate cache key for unified search
   */
  generateSearchKey(
    query: string, 
    userId: string, 
    filters?: Record<string, any>
  ): string {
    return this.generate({
      source: 'unified_search',
      query,
      userId,
      filters,
    });
  }

  /**
   * Generate cache key for financial aggregation
   */
  generateFinancialKey(
    functionName: string,
    userId: string,
    params?: Record<string, any>
  ): string {
    return this.generate({
      source: 'financial_aggregation',
      query: functionName,
      userId,
      filters: params,
      timestamp: Date.now(), // Financial data should be time-sensitive
    });
  }

  /**
   * Generate cache key for conversation history
   */
  generateConversationKey(conversationId: string, userId: string): string {
    return this.generate({
      source: 'conversation_history',
      query: conversationId,
      userId,
    });
  }

  /**
   * Hash a value using the configured algorithm (browser-compatible)
   */
  private async hashValue(value: string): Promise<string> {
    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return hashHex.substring(0, 16); // Truncate for shorter keys
  }

  /**
   * Synchronous hash fallback for cases where async is not possible
   */
  private hashValueSync(value: string): string {
    // Simple hash function for fallback (not cryptographically secure but deterministic)
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive hex string and pad
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    return hexHash.substring(0, 16);
  }

  /**
   * Normalize filters object to a consistent string representation
   */
  private normalizeFilters(filters: Record<string, any>): string {
    // Sort keys for consistent ordering
    const sortedKeys = Object.keys(filters).sort();
    const normalized = sortedKeys.map(key => {
      const value = filters[key];
      if (typeof value === 'object') {
        return `${key}:${JSON.stringify(value)}`;
      }
      return `${key}:${value}`;
    });
    
    return normalized.join('|');
  }

  /**
   * Get time window for time-sensitive caches
   */
  private getTimeWindow(timestamp: number, source: CacheSource): string {
    const ttl = CACHE_TTL_CONFIG[source];
    const windowSize = Math.max(ttl / 4, 60000); // At least 1 minute windows
    const window = Math.floor(timestamp / windowSize);
    return window.toString();
  }

  /**
   * Generate pattern for cache invalidation
   */
  generatePattern(source: CacheSource, userId?: string): string {
    const components = [
      CACHE_KEY_CONFIG.prefix,
      '*', // Any version
      source
    ];

    if (userId) {
      components.push(`user:${this.hashValueSync(userId)}`);
      components.push('*'); // Any additional components
    } else {
      components.push('*'); // Any user or additional components
    }

    return components.join(CACHE_KEY_CONFIG.separator);
  }

  /**
   * Get TTL for a cache source
   */
  getTTL(source: CacheSource): number {
    return CACHE_TTL_CONFIG[source];
  }
}

// Export singleton instance
export const cacheKeyGenerator = new DefaultCacheKeyGenerator();
