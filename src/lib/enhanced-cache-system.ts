/**
 * Enhanced Cache System
 * Advanced caching with intelligent eviction, compression, and performance monitoring
 */

import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';
import { compress, decompress } from 'lz-string';

// Enhanced cache configuration
interface EnhancedCacheConfig {
  memoryTTL: number;
  persistentTTL: number;
  maxMemoryEntries: number;
  maxMemorySize: number; // MB
  compressionThreshold: number; // bytes
  compressionLevel: 'fast' | 'balanced' | 'max';
  evictionPolicy: 'lru' | 'lfu' | 'adaptive' | 'intelligent';
  enablePredictiveLoading: boolean;
  enableCompressionAnalytics: boolean;
  enablePerformanceMonitoring: boolean;
  warmupStrategies: string[];
}

// Cache entry with enhanced metadata
interface EnhancedCacheEntry {
  data: UnifiedSearchResponse;
  metadata: {
    key: string;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    accessFrequency: number;
    size: number;
    compressedSize: number;
    compressed: boolean;
    compressionRatio: number;
    ttl: number;
    priority: number;
    tags: string[];
    userId: string;
    queryComplexity: number;
    resultQuality: number;
    accessPattern: number[];
    evictionScore: number;
  };
}

// Cache performance metrics
interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  compressionRate: number;
  averageCompressionRatio: number;
  averageAccessTime: number;
  memoryUtilization: number;
  cacheEfficiency: number;
  predictiveHitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  totalCompressions: number;
  averageEntrySize: number;
  peakMemoryUsage: number;
  compressionSavings: number;
}

// Cache analytics
interface CacheAnalytics {
  topQueries: Array<{ query: string; hits: number; avgResponseTime: number }>;
  userPatterns: Array<{ userId: string; accessCount: number; hitRate: number }>;
  compressionStats: {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageRatio: number;
    bestRatio: number;
    worstRatio: number;
  };
  evictionStats: {
    byPolicy: Record<string, number>;
    byReason: Record<string, number>;
    averageLifetime: number;
  };
  performanceTrends: Array<{
    timestamp: number;
    hitRate: number;
    avgAccessTime: number;
    memoryUsage: number;
  }>;
}

class EnhancedCacheSystem {
  private memoryCache = new Map<string, EnhancedCacheEntry>();
  private accessHistory = new Map<string, number[]>();
  private queryPatterns = new Map<string, string[]>();
  private compressionCache = new Map<string, string>();
  
  private config: EnhancedCacheConfig = {
    memoryTTL: 10 * 60 * 1000, // 10 minutes
    persistentTTL: 60 * 60 * 1000, // 1 hour
    maxMemoryEntries: 200,
    maxMemorySize: 100, // 100MB
    compressionThreshold: 5 * 1024, // 5KB
    compressionLevel: 'balanced',
    evictionPolicy: 'intelligent',
    enablePredictiveLoading: true,
    enableCompressionAnalytics: true,
    enablePerformanceMonitoring: true,
    warmupStrategies: ['popular_queries', 'user_patterns', 'temporal_patterns']
  };

  private metrics: CachePerformanceMetrics = {
    hitRate: 0,
    missRate: 0,
    evictionRate: 0,
    compressionRate: 0,
    averageCompressionRatio: 0,
    averageAccessTime: 0,
    memoryUtilization: 0,
    cacheEfficiency: 0,
    predictiveHitRate: 0,
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
    totalCompressions: 0,
    averageEntrySize: 0,
    peakMemoryUsage: 0,
    compressionSavings: 0
  };

  private currentMemoryUsage = 0;
  private performanceHistory: Array<{ timestamp: number; metrics: Partial<CachePerformanceMetrics> }> = [];

  /**
   * Get cached search results with enhanced intelligence
   */
  async get(params: UnifiedSearchParams, userId: string): Promise<UnifiedSearchResponse | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      const cacheKey = this.generateEnhancedCacheKey(params, userId);
      const entry = this.memoryCache.get(cacheKey);

      if (entry && this.isValid(entry)) {
        // Update access patterns
        this.updateAccessPatterns(entry, userId);
        
        // Decompress if needed
        const data = entry.metadata.compressed ? 
          await this.decompressData(entry.data) : entry.data;

        this.metrics.totalHits++;
        this.updateMetrics(performance.now() - startTime, true);

        console.log(`🎯 Enhanced cache hit: ${cacheKey} (${entry.metadata.accessCount} accesses)`);
        return data;
      }

      // Cache miss
      this.metrics.totalMisses++;
      this.updateMetrics(performance.now() - startTime, false);

      // Check for predictive cache opportunities
      if (this.config.enablePredictiveLoading) {
        this.triggerPredictiveLoading(params, userId);
      }

      return null;

    } catch (error) {
      console.error('Enhanced cache get error:', error);
      return null;
    }
  }

  /**
   * Store search results with intelligent compression and metadata
   */
  async set(params: UnifiedSearchParams, userId: string, response: UnifiedSearchResponse): Promise<void> {
    try {
      const cacheKey = this.generateEnhancedCacheKey(params, userId);
      const originalSize = this.calculateDataSize(response);
      
      // Determine if compression is beneficial
      const shouldCompress = originalSize > this.config.compressionThreshold;
      let compressedData = response;
      let compressedSize = originalSize;
      let compressionRatio = 1;

      if (shouldCompress) {
        const compressionResult = await this.compressData(response);
        compressedData = compressionResult.data;
        compressedSize = compressionResult.size;
        compressionRatio = originalSize / compressedSize;
        this.metrics.totalCompressions++;
      }

      // Create enhanced cache entry
      const entry: EnhancedCacheEntry = {
        data: compressedData,
        metadata: {
          key: cacheKey,
          timestamp: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 1,
          accessFrequency: 0,
          size: originalSize,
          compressedSize,
          compressed: shouldCompress,
          compressionRatio,
          ttl: this.config.memoryTTL,
          priority: this.calculatePriority(params, response),
          tags: this.generateTags(params, response),
          userId,
          queryComplexity: this.calculateQueryComplexity(params),
          resultQuality: this.calculateResultQuality(response),
          accessPattern: [],
          evictionScore: 0
        }
      };

      // Check if eviction is needed
      await this.ensureCapacity(compressedSize);

      // Store in cache
      this.memoryCache.set(cacheKey, entry);
      this.currentMemoryUsage += compressedSize / (1024 * 1024); // Convert to MB

      // Update user patterns
      this.updateUserPatterns(userId, params.query);

      // Update compression metrics
      if (shouldCompress) {
        this.updateCompressionMetrics(originalSize, compressedSize);
      }

      console.log(`💾 Enhanced cache set: ${cacheKey} (${shouldCompress ? 'compressed' : 'uncompressed'})`);

    } catch (error) {
      console.error('Enhanced cache set error:', error);
    }
  }

  /**
   * Intelligent eviction based on multiple factors
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    const requiredSizeMB = requiredSize / (1024 * 1024);
    
    // Check if we need to evict by size
    if (this.currentMemoryUsage + requiredSizeMB > this.config.maxMemorySize) {
      await this.evictBySize(requiredSizeMB);
    }

    // Check if we need to evict by count
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      await this.evictByCount();
    }
  }

  /**
   * Evict entries by size using intelligent scoring
   */
  private async evictBySize(requiredSizeMB: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    
    // Calculate eviction scores for all entries
    const scoredEntries = entries.map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry)
    }));

    // Sort by eviction score (higher score = more likely to evict)
    scoredEntries.sort((a, b) => b.score - a.score);

    let freedSpace = 0;
    const toEvict: string[] = [];

    // Evict entries until we have enough space
    for (const { key, entry } of scoredEntries) {
      if (freedSpace >= requiredSizeMB) break;
      
      toEvict.push(key);
      freedSpace += entry.metadata.compressedSize / (1024 * 1024);
    }

    // Perform evictions
    for (const key of toEvict) {
      await this.evictEntry(key, 'size_pressure');
    }
  }

  /**
   * Evict entries by count using intelligent scoring
   */
  private async evictByCount(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    const evictCount = Math.ceil(this.config.maxMemoryEntries * 0.1); // Evict 10%

    // Calculate eviction scores
    const scoredEntries = entries.map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry)
    }));

    // Sort and evict lowest scoring entries
    scoredEntries.sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < evictCount && i < scoredEntries.length; i++) {
      await this.evictEntry(scoredEntries[i].key, 'count_limit');
    }
  }

  /**
   * Calculate intelligent eviction score
   */
  private calculateEvictionScore(entry: EnhancedCacheEntry): number {
    const now = Date.now();
    const age = now - entry.metadata.lastAccessed;
    const lifetime = now - entry.metadata.timestamp;

    // Normalize factors (0-1 scale)
    const ageScore = Math.min(1, age / this.config.memoryTTL);
    const accessScore = 1 / Math.max(1, entry.metadata.accessCount);
    const frequencyScore = 1 / Math.max(1, entry.metadata.accessFrequency);
    const sizeScore = entry.metadata.compressedSize / (1024 * 1024); // Size in MB
    const qualityScore = 1 - entry.metadata.resultQuality;
    const priorityScore = 1 - entry.metadata.priority;

    // Weighted combination
    return (
      ageScore * 0.25 +
      accessScore * 0.20 +
      frequencyScore * 0.15 +
      sizeScore * 0.15 +
      qualityScore * 0.15 +
      priorityScore * 0.10
    );
  }

  /**
   * Evict a specific entry
   */
  private async evictEntry(key: string, reason: string): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (!entry) return;

    // Move to persistent storage if valuable
    if (entry.metadata.accessCount > 3 || entry.metadata.priority > 0.7) {
      await this.moveToPersistentStorage(key, entry);
    }

    // Remove from memory cache
    this.memoryCache.delete(key);
    this.currentMemoryUsage -= entry.metadata.compressedSize / (1024 * 1024);
    this.metrics.totalEvictions++;

    console.log(`🗑️ Evicted cache entry: ${key} (reason: ${reason})`);
  }

  /**
   * Compress data using selected algorithm
   */
  private async compressData(data: UnifiedSearchResponse): Promise<{ data: any; size: number }> {
    try {
      const jsonString = JSON.stringify(data);
      let compressed: string;

      switch (this.config.compressionLevel) {
        case 'fast':
          compressed = compress(jsonString);
          break;
        case 'max':
          compressed = compress(jsonString);
          break;
        case 'balanced':
        default:
          compressed = compress(jsonString);
          break;
      }

      const compressedSize = new Blob([compressed]).size;
      
      return {
        data: { __compressed: true, __data: compressed },
        size: compressedSize
      };
    } catch (error) {
      console.error('Compression failed:', error);
      return { data, size: this.calculateDataSize(data) };
    }
  }

  /**
   * Decompress data
   */
  private async decompressData(data: any): Promise<UnifiedSearchResponse> {
    try {
      if (data.__compressed) {
        const decompressed = decompress(data.__data);
        return JSON.parse(decompressed);
      }
      return data;
    } catch (error) {
      console.error('Decompression failed:', error);
      return data;
    }
  }

  /**
   * Calculate data size in bytes
   */
  private calculateDataSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Generate enhanced cache key with context
   */
  private generateEnhancedCacheKey(params: UnifiedSearchParams, userId: string): string {
    const keyComponents = {
      query: params.query.toLowerCase().trim(),
      sources: params.sources?.sort().join(',') || '',
      filters: JSON.stringify(params.filters || {}),
      limit: params.limit || 20,
      userId: userId,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets for temporal queries
    };

    const keyString = JSON.stringify(keyComponents);
    return this.hashString(keyString);
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Calculate query complexity score
   */
  private calculateQueryComplexity(params: UnifiedSearchParams): number {
    let complexity = 0;
    
    // Query length factor
    complexity += Math.min(1, params.query.length / 100);
    
    // Filters factor
    const filterCount = Object.keys(params.filters || {}).length;
    complexity += Math.min(0.5, filterCount * 0.1);
    
    // Sources factor
    const sourceCount = params.sources?.length || 1;
    complexity += Math.min(0.3, sourceCount * 0.1);
    
    return Math.min(1, complexity);
  }

  /**
   * Calculate result quality score
   */
  private calculateResultQuality(response: UnifiedSearchResponse): number {
    if (!response.success || !response.results) return 0;
    
    const resultCount = response.results.length;
    const avgSimilarity = response.results.reduce((sum, r) => sum + (r.similarity || 0), 0) / resultCount;
    
    // Quality based on result count and similarity
    const countScore = Math.min(1, resultCount / 20);
    const similarityScore = avgSimilarity;
    
    return (countScore + similarityScore) / 2;
  }

  /**
   * Calculate entry priority
   */
  private calculatePriority(params: UnifiedSearchParams, response: UnifiedSearchResponse): number {
    const complexity = this.calculateQueryComplexity(params);
    const quality = this.calculateResultQuality(response);
    
    return (complexity + quality) / 2;
  }

  /**
   * Generate cache tags for categorization
   */
  private generateTags(params: UnifiedSearchParams, response: UnifiedSearchResponse): string[] {
    const tags: string[] = [];
    
    // Source tags
    if (params.sources) {
      tags.push(...params.sources.map(s => `source:${s}`));
    }
    
    // Filter tags
    if (params.filters?.categories) {
      tags.push(...params.filters.categories.map(c => `category:${c}`));
    }
    
    // Result count tag
    const resultCount = response.results?.length || 0;
    if (resultCount > 0) {
      tags.push(`results:${Math.ceil(resultCount / 10) * 10}`);
    }
    
    return tags;
  }

  /**
   * Update access patterns for an entry
   */
  private updateAccessPatterns(entry: EnhancedCacheEntry, userId: string): void {
    const now = Date.now();
    entry.metadata.lastAccessed = now;
    entry.metadata.accessCount++;
    entry.metadata.accessPattern.push(now);
    
    // Keep only recent access patterns (last 10)
    if (entry.metadata.accessPattern.length > 10) {
      entry.metadata.accessPattern = entry.metadata.accessPattern.slice(-10);
    }
    
    // Calculate access frequency (accesses per hour)
    const hourAgo = now - 60 * 60 * 1000;
    const recentAccesses = entry.metadata.accessPattern.filter(time => time > hourAgo);
    entry.metadata.accessFrequency = recentAccesses.length;
  }

  /**
   * Update user query patterns
   */
  private updateUserPatterns(userId: string, query: string): void {
    const patterns = this.queryPatterns.get(userId) || [];
    patterns.push(query);
    
    // Keep only recent patterns (last 50)
    if (patterns.length > 50) {
      patterns.splice(0, patterns.length - 50);
    }
    
    this.queryPatterns.set(userId, patterns);
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: EnhancedCacheEntry): boolean {
    const age = Date.now() - entry.metadata.timestamp;
    return age < entry.metadata.ttl;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(responseTime: number, isHit: boolean): void {
    // Update hit/miss rates
    this.metrics.hitRate = (this.metrics.totalHits / this.metrics.totalRequests) * 100;
    this.metrics.missRate = (this.metrics.totalMisses / this.metrics.totalRequests) * 100;
    
    // Update average access time
    this.metrics.averageAccessTime = 
      (this.metrics.averageAccessTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    // Update memory utilization
    this.metrics.memoryUtilization = (this.currentMemoryUsage / this.config.maxMemorySize) * 100;
    
    // Update peak memory usage
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, this.currentMemoryUsage);
    
    // Update cache efficiency
    this.metrics.cacheEfficiency = this.metrics.hitRate * (1 - this.metrics.memoryUtilization / 100);
  }

  /**
   * Update compression metrics
   */
  private updateCompressionMetrics(originalSize: number, compressedSize: number): void {
    const ratio = originalSize / compressedSize;
    const savings = originalSize - compressedSize;
    
    this.metrics.averageCompressionRatio = 
      (this.metrics.averageCompressionRatio * (this.metrics.totalCompressions - 1) + ratio) / 
      this.metrics.totalCompressions;
    
    this.metrics.compressionSavings += savings;
    this.metrics.compressionRate = (this.metrics.totalCompressions / this.metrics.totalRequests) * 100;
  }

  /**
   * Trigger predictive loading based on patterns
   */
  private async triggerPredictiveLoading(params: UnifiedSearchParams, userId: string): Promise<void> {
    if (!this.config.enablePredictiveLoading) return;

    const userPatterns = this.queryPatterns.get(userId) || [];
    const predictions = this.generateQueryPredictions(params.query, userPatterns);

    // Warm cache with predicted queries
    for (const prediction of predictions.slice(0, 3)) {
      const predictedParams = { ...params, query: prediction.query };
      await this.warmCacheEntry(predictedParams, userId, prediction.confidence);
    }

    console.log(`🔮 Predictive loading triggered for user ${userId}: ${predictions.length} predictions`);
  }

  /**
   * Generate query predictions based on patterns
   */
  private generateQueryPredictions(currentQuery: string, userPatterns: string[]): Array<{
    query: string;
    confidence: number;
  }> {
    const predictions: Array<{ query: string; confidence: number }> = [];
    const queryWords = currentQuery.toLowerCase().split(/\s+/);

    // Pattern 1: Common follow-up queries
    const followUps = [
      `${currentQuery} details`,
      `${currentQuery} summary`,
      `${currentQuery} total`,
      `recent ${currentQuery}`,
      `all ${currentQuery}`
    ];

    followUps.forEach(query => {
      predictions.push({ query, confidence: 0.6 });
    });

    // Pattern 2: Similar queries from user history
    userPatterns.forEach(pattern => {
      const patternWords = pattern.toLowerCase().split(/\s+/);
      const similarity = this.calculateQuerySimilarity(queryWords, patternWords);

      if (similarity > 0.5 && pattern !== currentQuery) {
        predictions.push({ query: pattern, confidence: similarity * 0.8 });
      }
    });

    // Pattern 3: Query expansions
    queryWords.forEach(word => {
      if (word.length > 3) {
        predictions.push({
          query: `${word} analysis`,
          confidence: 0.4
        });
        predictions.push({
          query: `${word} breakdown`,
          confidence: 0.4
        });
      }
    });

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Calculate similarity between query word arrays
   */
  private calculateQuerySimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Warm cache with a predicted entry
   */
  private async warmCacheEntry(params: UnifiedSearchParams, userId: string, confidence: number): Promise<void> {
    // This would integrate with the search service to pre-execute queries
    // For now, we'll create a placeholder entry
    const cacheKey = this.generateEnhancedCacheKey(params, userId);

    if (!this.memoryCache.has(cacheKey)) {
      console.log(`🔥 Cache warming: ${params.query} (confidence: ${confidence.toFixed(2)})`);
      // Would trigger actual search execution here
    }
  }

  /**
   * Move entry to persistent storage
   */
  private async moveToPersistentStorage(key: string, entry: EnhancedCacheEntry): Promise<void> {
    try {
      const persistentKey = `enhanced_cache_${key}`;
      const persistentData = {
        ...entry,
        persistentTimestamp: Date.now()
      };
      
      localStorage.setItem(persistentKey, JSON.stringify(persistentData));
      console.log(`💾 Moved to persistent storage: ${key}`);
    } catch (error) {
      console.error('Failed to move to persistent storage:', error);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): CachePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache analytics
   */
  getAnalytics(): CacheAnalytics {
    const entries = Array.from(this.memoryCache.values());
    
    // Calculate top queries
    const queryStats = new Map<string, { hits: number; totalTime: number }>();
    entries.forEach(entry => {
      const query = entry.metadata.key;
      const existing = queryStats.get(query) || { hits: 0, totalTime: 0 };
      existing.hits += entry.metadata.accessCount;
      queryStats.set(query, existing);
    });

    const topQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        hits: stats.hits,
        avgResponseTime: stats.totalTime / stats.hits
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      topQueries,
      userPatterns: [],
      compressionStats: {
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        averageRatio: this.metrics.averageCompressionRatio,
        bestRatio: 0,
        worstRatio: 0
      },
      evictionStats: {
        byPolicy: {},
        byReason: {},
        averageLifetime: 0
      },
      performanceTrends: this.performanceHistory.map(h => ({
        timestamp: h.timestamp,
        hitRate: h.metrics.hitRate || 0,
        avgAccessTime: h.metrics.averageAccessTime || 0,
        memoryUsage: h.metrics.memoryUtilization || 0
      }))
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.currentMemoryUsage = 0;
    this.accessHistory.clear();
    this.queryPatterns.clear();
    this.compressionCache.clear();
    
    // Reset metrics
    this.metrics = {
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      compressionRate: 0,
      averageCompressionRatio: 0,
      averageAccessTime: 0,
      memoryUtilization: 0,
      cacheEfficiency: 0,
      predictiveHitRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      totalCompressions: 0,
      averageEntrySize: 0,
      peakMemoryUsage: 0,
      compressionSavings: 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EnhancedCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const enhancedCacheSystem = new EnhancedCacheSystem();
export type { EnhancedCacheConfig, CachePerformanceMetrics, CacheAnalytics };
