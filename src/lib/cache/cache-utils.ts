/**
 * Cache Utilities and Helper Functions
 * 
 * Provides high-level utility functions for common caching operations
 * in the Mataresit application.
 */

import { cacheManager } from './cache-manager';
import { cacheKeyGenerator } from './key-generator';
import { CacheSource } from './types';

/**
 * Cache wrapper for LLM preprocessing results
 */
export class LLMCache {
  private cache = cacheManager.getCache('llm_preprocessing');

  /**
   * Get cached LLM preprocessing result
   */
  async get(query: string, userId?: string): Promise<any | null> {
    const key = cacheKeyGenerator.generateLLMKey(query, userId);
    return this.cache.get(key);
  }

  /**
   * Cache LLM preprocessing result
   */
  async set(query: string, result: any, userId?: string): Promise<void> {
    const key = cacheKeyGenerator.generateLLMKey(query, userId);
    await this.cache.set(key, result);
  }

  /**
   * Invalidate LLM cache for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = cacheKeyGenerator.generatePattern('llm_preprocessing', userId);
    await this.cache.invalidatePattern(pattern);
  }
}

/**
 * Cache wrapper for unified search results
 */
export class SearchCache {
  private cache = cacheManager.getCache('unified_search');

  /**
   * Get cached search result
   */
  async get(
    query: string, 
    userId: string, 
    filters?: Record<string, any>
  ): Promise<any | null> {
    const key = cacheKeyGenerator.generateSearchKey(query, userId, filters);
    return this.cache.get(key);
  }

  /**
   * Cache search result
   */
  async set(
    query: string, 
    result: any, 
    userId: string, 
    filters?: Record<string, any>
  ): Promise<void> {
    const key = cacheKeyGenerator.generateSearchKey(query, userId, filters);
    await this.cache.set(key, result);
  }

  /**
   * Invalidate search cache for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = cacheKeyGenerator.generatePattern('unified_search', userId);
    await this.cache.invalidatePattern(pattern);
  }

  /**
   * Invalidate all search cache
   */
  async invalidateAll(): Promise<void> {
    await this.cache.clear();
  }
}

/**
 * Cache wrapper for financial aggregation results
 */
export class FinancialCache {
  private cache = cacheManager.getCache('financial_aggregation');

  /**
   * Get cached financial aggregation result
   */
  async get(
    functionName: string,
    userId: string,
    params?: Record<string, any>
  ): Promise<any | null> {
    const key = cacheKeyGenerator.generateFinancialKey(functionName, userId, params);
    return this.cache.get(key);
  }

  /**
   * Cache financial aggregation result
   */
  async set(
    functionName: string,
    result: any,
    userId: string,
    params?: Record<string, any>
  ): Promise<void> {
    const key = cacheKeyGenerator.generateFinancialKey(functionName, userId, params);
    await this.cache.set(key, result);
  }

  /**
   * Invalidate financial cache for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = cacheKeyGenerator.generatePattern('financial_aggregation', userId);
    await this.cache.invalidatePattern(pattern);
  }

  /**
   * Invalidate specific financial function cache
   */
  async invalidateFunction(functionName: string, userId?: string): Promise<void> {
    if (userId) {
      const pattern = cacheKeyGenerator.generatePattern('financial_aggregation', userId);
      const keys = await this.cache.keys(pattern);
      const functionKeys = keys.filter(key => key.includes(functionName));
      await this.cache.mdelete(functionKeys);
    } else {
      await this.cache.clear();
    }
  }
}

/**
 * Cache wrapper for conversation history
 */
export class ConversationCache {
  private cache = cacheManager.getCache('conversation_history');

  /**
   * Get cached conversation
   */
  async get(conversationId: string, userId: string): Promise<any | null> {
    const key = cacheKeyGenerator.generateConversationKey(conversationId, userId);
    return this.cache.get(key);
  }

  /**
   * Cache conversation
   */
  async set(conversationId: string, conversation: any, userId: string): Promise<void> {
    const key = cacheKeyGenerator.generateConversationKey(conversationId, userId);
    await this.cache.set(key, conversation);
  }

  /**
   * Delete conversation from cache
   */
  async delete(conversationId: string, userId: string): Promise<void> {
    const key = cacheKeyGenerator.generateConversationKey(conversationId, userId);
    await this.cache.delete(key);
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string): Promise<any[]> {
    const pattern = cacheKeyGenerator.generatePattern('conversation_history', userId);
    const keys = await this.cache.keys(pattern);
    const conversations = await this.cache.mget(keys);
    return conversations.filter(conv => conv !== null);
  }
}

/**
 * Generic cache wrapper with automatic key generation
 */
export class GenericCache<T = any> {
  constructor(private source: CacheSource) {}

  private get cache() {
    return cacheManager.getCache(this.source);
  }

  /**
   * Get cached value with automatic key generation
   */
  async get(params: {
    query?: string;
    userId?: string;
    filters?: Record<string, any>;
    customKey?: string;
  }): Promise<T | null> {
    const key = params.customKey || cacheKeyGenerator.generate({
      source: this.source,
      ...params,
    });
    return this.cache.get<T>(key);
  }

  /**
   * Set cached value with automatic key generation
   */
  async set(
    value: T,
    params: {
      query?: string;
      userId?: string;
      filters?: Record<string, any>;
      customKey?: string;
      ttl?: number;
    }
  ): Promise<void> {
    const key = params.customKey || cacheKeyGenerator.generate({
      source: this.source,
      query: params.query,
      userId: params.userId,
      filters: params.filters,
    });
    await this.cache.set(key, value, params.ttl);
  }

  /**
   * Delete cached value
   */
  async delete(params: {
    query?: string;
    userId?: string;
    filters?: Record<string, any>;
    customKey?: string;
  }): Promise<void> {
    const key = params.customKey || cacheKeyGenerator.generate({
      source: this.source,
      ...params,
    });
    await this.cache.delete(key);
  }

  /**
   * Clear all cache for this source
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return this.cache.getStats();
  }
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  /**
   * Warm up common search queries
   */
  static async warmSearchCache(userId: string, commonQueries: string[]): Promise<void> {
    const searchCache = new SearchCache();
    
    // This would typically make actual API calls to populate the cache
    // For now, we'll just log the warming process
    console.log(`Warming search cache for user ${userId} with ${commonQueries.length} queries`);
    
    // In a real implementation, you would:
    // 1. Make actual search API calls for each query
    // 2. Cache the results
    // 3. Handle errors gracefully
  }

  /**
   * Warm up financial aggregation cache
   */
  static async warmFinancialCache(userId: string): Promise<void> {
    const financialCache = new FinancialCache();
    
    const commonFunctions = [
      'get_spending_by_category',
      'get_monthly_spending_trends',
      'get_merchant_analysis',
    ];

    console.log(`Warming financial cache for user ${userId} with ${commonFunctions.length} functions`);
    
    // In a real implementation, you would:
    // 1. Call each financial function
    // 2. Cache the results
    // 3. Handle errors gracefully
  }
}

/**
 * Cache invalidation utilities
 */
export class CacheInvalidator {
  /**
   * Invalidate all user-related caches
   */
  static async invalidateUserCaches(userId: string): Promise<void> {
    const llmCache = new LLMCache();
    const searchCache = new SearchCache();
    const financialCache = new FinancialCache();

    await Promise.all([
      llmCache.invalidateUser(userId),
      searchCache.invalidateUser(userId),
      financialCache.invalidateUser(userId),
    ]);

    console.log(`Invalidated all caches for user ${userId}`);
  }

  /**
   * Invalidate caches when receipt data changes
   */
  static async invalidateReceiptCaches(userId: string): Promise<void> {
    const searchCache = new SearchCache();
    const financialCache = new FinancialCache();

    await Promise.all([
      searchCache.invalidateUser(userId),
      financialCache.invalidateUser(userId),
    ]);

    console.log(`Invalidated receipt-related caches for user ${userId}`);
  }

  /**
   * Invalidate all caches (admin operation)
   */
  static async invalidateAllCaches(): Promise<void> {
    await cacheManager.clearAll();
    console.log('Invalidated all caches');
  }
}

// Export singleton instances
export const llmCache = new LLMCache();
export const searchCache = new SearchCache();
export const financialCache = new FinancialCache();
export const conversationCache = new ConversationCache();
