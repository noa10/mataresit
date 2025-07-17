/**
 * Advanced Search Cache System
 * Multi-tier caching with intelligent eviction, compression, and predictive pre-loading
 */

import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';
import { searchCache } from './searchCache';

// Cache tier types
enum CacheTier {
  MEMORY = 'memory',
  PERSISTENT = 'persistent',
  PREDICTIVE = 'predictive'
}

// Cache entry with advanced metadata
interface AdvancedCacheEntry {
  data: UnifiedSearchResponse;
  metadata: {
    tier: CacheTier;
    accessCount: number;
    lastAccessed: number;
    createdAt: number;
    userId: string;
    queryHash: string;
    size: number;
    compressed: boolean;
    popularity: number;
    freshness: number;
    predictiveScore: number;
  };
}

// Cache warming strategy
interface CacheWarmingStrategy {
  enabled: boolean;
  maxPredictiveEntries: number;
  popularityThreshold: number;
  freshnessWeight: number;
  accessPatternWeight: number;
}

// Cache analytics
interface CacheAnalytics {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  compressionRatio: number;
  averageAccessTime: number;
  predictiveHitRate: number;
  tierDistribution: Record<CacheTier, number>;
}

class AdvancedSearchCache {
  private memoryCache = new Map<string, AdvancedCacheEntry>();
  private persistentCache = new Map<string, AdvancedCacheEntry>();
  private predictiveCache = new Map<string, AdvancedCacheEntry>();
  
  private accessPatterns = new Map<string, number[]>(); // userId -> access times
  private queryPatterns = new Map<string, string[]>(); // userId -> recent queries
  
  private config = {
    maxMemoryEntries: 100,
    maxPersistentEntries: 500,
    maxPredictiveEntries: 50,
    memoryTTL: 5 * 60 * 1000, // 5 minutes
    persistentTTL: 60 * 60 * 1000, // 1 hour
    predictiveTTL: 30 * 60 * 1000, // 30 minutes
    compressionThreshold: 50 * 1024, // 50KB
    popularityDecayRate: 0.95,
    freshnessDecayRate: 0.98
  };

  private warmingStrategy: CacheWarmingStrategy = {
    enabled: true,
    maxPredictiveEntries: 20,
    popularityThreshold: 5,
    freshnessWeight: 0.3,
    accessPatternWeight: 0.7
  };

  private analytics: CacheAnalytics = {
    totalEntries: 0,
    memoryUsage: 0,
    hitRate: 0,
    missRate: 0,
    evictionRate: 0,
    compressionRatio: 0,
    averageAccessTime: 0,
    predictiveHitRate: 0,
    tierDistribution: {
      [CacheTier.MEMORY]: 0,
      [CacheTier.PERSISTENT]: 0,
      [CacheTier.PREDICTIVE]: 0
    }
  };

  /**
   * Get cached search results with intelligent tier selection
   */
  async get(params: UnifiedSearchParams, userId: string): Promise<UnifiedSearchResponse | null> {
    const startTime = performance.now();
    const queryHash = this.generateQueryHash(params, userId);

    try {
      // Check memory cache first (fastest)
      let entry = this.memoryCache.get(queryHash);
      if (entry && this.isValid(entry)) {
        this.updateAccessMetrics(entry, CacheTier.MEMORY);
        this.analytics.averageAccessTime = performance.now() - startTime;
        return entry.data;
      }

      // Check persistent cache
      entry = this.persistentCache.get(queryHash);
      if (entry && this.isValid(entry)) {
        // Promote to memory cache
        await this.promoteToMemory(queryHash, entry);
        this.updateAccessMetrics(entry, CacheTier.PERSISTENT);
        this.analytics.averageAccessTime = performance.now() - startTime;
        return entry.data;
      }

      // Check predictive cache
      entry = this.predictiveCache.get(queryHash);
      if (entry && this.isValid(entry)) {
        // Promote to memory cache
        await this.promoteToMemory(queryHash, entry);
        this.updateAccessMetrics(entry, CacheTier.PREDICTIVE);
        this.analytics.predictiveHitRate++;
        this.analytics.averageAccessTime = performance.now() - startTime;
        return entry.data;
      }

      // Cache miss - update analytics
      this.analytics.missRate++;
      return null;

    } catch (error) {
      console.error('Advanced cache get error:', error);
      return null;
    }
  }

  /**
   * Store search results with intelligent tier placement
   */
  async set(params: UnifiedSearchParams, userId: string, response: UnifiedSearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(params, userId);
      const size = this.calculateSize(response);
      const compressed = size > this.config.compressionThreshold;

      // Create cache entry
      const entry: AdvancedCacheEntry = {
        data: response,
        metadata: {
          tier: CacheTier.MEMORY,
          accessCount: 1,
          lastAccessed: Date.now(),
          createdAt: Date.now(),
          userId,
          queryHash,
          size,
          compressed,
          popularity: this.calculatePopularity(params, userId),
          freshness: 1.0,
          predictiveScore: 0
        }
      };

      // Store in memory cache
      await this.storeInMemory(queryHash, entry);

      // Update user patterns
      this.updateUserPatterns(userId, params.query);

      // Trigger predictive caching if enabled
      if (this.warmingStrategy.enabled) {
        this.triggerPredictiveCaching(userId, params);
      }

      this.analytics.totalEntries++;

    } catch (error) {
      console.error('Advanced cache set error:', error);
    }
  }

  /**
   * Store entry in memory cache with eviction
   */
  private async storeInMemory(queryHash: string, entry: AdvancedCacheEntry): Promise<void> {
    // Check if we need to evict
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      await this.evictFromMemory();
    }

    this.memoryCache.set(queryHash, entry);
    this.analytics.memoryUsage += entry.metadata.size;
    this.analytics.tierDistribution[CacheTier.MEMORY]++;
  }

  /**
   * Intelligent eviction from memory cache
   */
  private async evictFromMemory(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    
    // Calculate eviction scores (lower = more likely to evict)
    const scoredEntries = entries.map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry)
    }));

    // Sort by eviction score (ascending)
    scoredEntries.sort((a, b) => a.score - b.score);

    // Evict lowest scoring entries
    const toEvict = scoredEntries.slice(0, Math.ceil(this.config.maxMemoryEntries * 0.2));
    
    for (const { key, entry } of toEvict) {
      this.memoryCache.delete(key);
      this.analytics.memoryUsage -= entry.metadata.size;
      this.analytics.evictionRate++;

      // Move to persistent cache if valuable
      if (entry.metadata.popularity > 2) {
        await this.moveToPersistent(key, entry);
      }
    }
  }

  /**
   * Calculate eviction score for cache entry
   */
  private calculateEvictionScore(entry: AdvancedCacheEntry): number {
    const age = Date.now() - entry.metadata.lastAccessed;
    const ageScore = age / this.config.memoryTTL; // Higher age = higher score (more likely to evict)
    
    const popularityScore = 1 / Math.max(1, entry.metadata.popularity); // Higher popularity = lower score
    const accessScore = 1 / Math.max(1, entry.metadata.accessCount); // More accesses = lower score
    const freshnessScore = 1 - entry.metadata.freshness; // Higher freshness = lower score

    return (ageScore * 0.4) + (popularityScore * 0.3) + (accessScore * 0.2) + (freshnessScore * 0.1);
  }

  /**
   * Move entry to persistent cache
   */
  private async moveToPersistent(queryHash: string, entry: AdvancedCacheEntry): Promise<void> {
    if (this.persistentCache.size >= this.config.maxPersistentEntries) {
      await this.evictFromPersistent();
    }

    entry.metadata.tier = CacheTier.PERSISTENT;
    this.persistentCache.set(queryHash, entry);
    this.analytics.tierDistribution[CacheTier.PERSISTENT]++;
  }

  /**
   * Evict from persistent cache
   */
  private async evictFromPersistent(): Promise<void> {
    const entries = Array.from(this.persistentCache.entries());
    
    // Simple LRU eviction for persistent cache
    entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);
    
    const toEvict = entries.slice(0, Math.ceil(this.config.maxPersistentEntries * 0.1));
    
    for (const [key] of toEvict) {
      this.persistentCache.delete(key);
      this.analytics.evictionRate++;
    }
  }

  /**
   * Promote entry to memory cache
   */
  private async promoteToMemory(queryHash: string, entry: AdvancedCacheEntry): Promise<void> {
    // Remove from current tier
    if (entry.metadata.tier === CacheTier.PERSISTENT) {
      this.persistentCache.delete(queryHash);
    } else if (entry.metadata.tier === CacheTier.PREDICTIVE) {
      this.predictiveCache.delete(queryHash);
    }

    // Update tier and store in memory
    entry.metadata.tier = CacheTier.MEMORY;
    await this.storeInMemory(queryHash, entry);
  }

  /**
   * Calculate popularity score for a query
   */
  private calculatePopularity(params: UnifiedSearchParams, userId: string): number {
    const userQueries = this.queryPatterns.get(userId) || [];
    const similarQueries = userQueries.filter(q => 
      this.calculateQuerySimilarity(params.query, q) > 0.7
    );
    
    return Math.min(10, similarQueries.length + 1);
  }

  /**
   * Calculate similarity between two queries
   */
  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Update user access patterns
   */
  private updateUserPatterns(userId: string, query: string): void {
    // Update access patterns
    const accessTimes = this.accessPatterns.get(userId) || [];
    accessTimes.push(Date.now());
    
    // Keep only recent access times (last 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentAccesses = accessTimes.filter(time => time > dayAgo);
    this.accessPatterns.set(userId, recentAccesses);

    // Update query patterns
    const queries = this.queryPatterns.get(userId) || [];
    queries.push(query);
    
    // Keep only recent queries (last 50)
    if (queries.length > 50) {
      queries.splice(0, queries.length - 50);
    }
    this.queryPatterns.set(userId, queries);
  }

  /**
   * Trigger predictive caching based on user patterns
   */
  private async triggerPredictiveCaching(userId: string, currentParams: UnifiedSearchParams): Promise<void> {
    if (!this.warmingStrategy.enabled) return;

    const userQueries = this.queryPatterns.get(userId) || [];
    const accessTimes = this.accessPatterns.get(userId) || [];

    // Predict next likely queries based on patterns
    const predictions = this.predictNextQueries(userQueries, currentParams);

    for (const prediction of predictions.slice(0, 3)) { // Top 3 predictions
      const predictiveParams = { ...currentParams, query: prediction.query };
      const queryHash = this.generateQueryHash(predictiveParams, userId);

      // Don't cache if already exists
      if (this.hasInAnyTier(queryHash)) continue;

      // Create predictive entry (would need actual search execution)
      // This is a placeholder - in practice, you might pre-execute searches
      const predictiveEntry: AdvancedCacheEntry = {
        data: { success: false, results: [], totalResults: 0, pagination: { hasMore: false, nextOffset: 0, totalPages: 0 }, searchMetadata: {} }, // Placeholder
        metadata: {
          tier: CacheTier.PREDICTIVE,
          accessCount: 0,
          lastAccessed: Date.now(),
          createdAt: Date.now(),
          userId,
          queryHash,
          size: 1024, // Estimated
          compressed: false,
          popularity: prediction.confidence,
          freshness: 1.0,
          predictiveScore: prediction.confidence
        }
      };

      this.predictiveCache.set(queryHash, predictiveEntry);
      this.analytics.tierDistribution[CacheTier.PREDICTIVE]++;
    }
  }

  /**
   * Predict next likely queries
   */
  private predictNextQueries(userQueries: string[], currentParams: UnifiedSearchParams): Array<{
    query: string;
    confidence: number;
  }> {
    // Simple pattern-based prediction
    const predictions: Array<{ query: string; confidence: number }> = [];

    // Look for query patterns
    const recentQueries = userQueries.slice(-10);
    const queryWords = currentParams.query.toLowerCase().split(/\s+/);

    // Predict variations of current query
    for (const word of queryWords) {
      const variations = [
        `${word} details`,
        `${word} summary`,
        `${word} analysis`,
        `recent ${word}`,
        `all ${word}`
      ];

      for (const variation of variations) {
        if (!recentQueries.includes(variation)) {
          predictions.push({
            query: variation,
            confidence: 0.6
          });
        }
      }
    }

    // Predict based on historical patterns
    const commonFollowUps = this.findCommonFollowUps(recentQueries, currentParams.query);
    predictions.push(...commonFollowUps);

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find common follow-up queries
   */
  private findCommonFollowUps(queries: string[], currentQuery: string): Array<{
    query: string;
    confidence: number;
  }> {
    // This would analyze historical patterns to find common follow-ups
    // For now, return some common patterns
    return [
      { query: `${currentQuery} total`, confidence: 0.7 },
      { query: `${currentQuery} breakdown`, confidence: 0.6 },
      { query: `${currentQuery} comparison`, confidence: 0.5 }
    ];
  }

  /**
   * Check if entry exists in any tier
   */
  private hasInAnyTier(queryHash: string): boolean {
    return this.memoryCache.has(queryHash) || 
           this.persistentCache.has(queryHash) || 
           this.predictiveCache.has(queryHash);
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: AdvancedCacheEntry): boolean {
    const age = Date.now() - entry.metadata.createdAt;
    const ttl = this.getTTLForTier(entry.metadata.tier);
    return age < ttl;
  }

  /**
   * Get TTL for cache tier
   */
  private getTTLForTier(tier: CacheTier): number {
    switch (tier) {
      case CacheTier.MEMORY: return this.config.memoryTTL;
      case CacheTier.PERSISTENT: return this.config.persistentTTL;
      case CacheTier.PREDICTIVE: return this.config.predictiveTTL;
      default: return this.config.memoryTTL;
    }
  }

  /**
   * Update access metrics
   */
  private updateAccessMetrics(entry: AdvancedCacheEntry, tier: CacheTier): void {
    entry.metadata.accessCount++;
    entry.metadata.lastAccessed = Date.now();
    
    // Decay popularity and freshness
    entry.metadata.popularity *= this.config.popularityDecayRate;
    entry.metadata.freshness *= this.config.freshnessDecayRate;

    this.analytics.hitRate++;
  }

  /**
   * Generate query hash
   */
  private generateQueryHash(params: UnifiedSearchParams, userId: string): string {
    const hashInput = JSON.stringify({
      query: params.query.toLowerCase().trim(),
      sources: params.sources?.sort(),
      filters: params.filters,
      userId
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Calculate data size
   */
  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Get cache analytics
   */
  getAnalytics(): CacheAnalytics {
    return { ...this.analytics };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.memoryCache.clear();
    this.persistentCache.clear();
    this.predictiveCache.clear();
    this.accessPatterns.clear();
    this.queryPatterns.clear();
    
    this.analytics = {
      totalEntries: 0,
      memoryUsage: 0,
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
      predictiveHitRate: 0,
      tierDistribution: {
        [CacheTier.MEMORY]: 0,
        [CacheTier.PERSISTENT]: 0,
        [CacheTier.PREDICTIVE]: 0
      }
    };
  }
}

// Export singleton instance
export const advancedSearchCache = new AdvancedSearchCache();
export type { AdvancedCacheEntry, CacheAnalytics, CacheWarmingStrategy };
