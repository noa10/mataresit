/**
 * React Hooks for Caching
 * 
 * Provides React hooks for easy integration of the caching system
 * with React components and state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CacheSource, CacheStats } from '@/lib/cache/types';
import { 
  llmCache, 
  searchCache, 
  financialCache, 
  conversationCache,
  GenericCache 
} from '@/lib/cache/cache-utils';
import { cacheManager } from '@/lib/cache/cache-manager';

/**
 * Hook for caching and retrieving data with automatic loading states
 */
export function useCache<T>(
  source: CacheSource,
  key: string,
  fetcher: () => Promise<T>,
  options: {
    enabled?: boolean;
    ttl?: number;
    refreshInterval?: number;
    onError?: (error: Error) => void;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  const cache = useRef(new GenericCache<T>(source));
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    enabled = true,
    ttl,
    refreshInterval,
    onError
  } = options;

  /**
   * Fetch data with caching
   */
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedData = await cache.current.get({ customKey: key });
        if (cachedData !== null) {
          setData(cachedData);
          setIsLoading(false);
          setLastFetch(Date.now());
          return cachedData;
        }
      }

      // Fetch fresh data
      const freshData = await fetcher();
      
      // Cache the result
      await cache.current.set(freshData, { customKey: key, ttl });
      
      setData(freshData);
      setLastFetch(Date.now());
      return freshData;

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, enabled, ttl, onError]);

  /**
   * Invalidate cache and refetch
   */
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  /**
   * Clear cache entry
   */
  const clearCache = useCallback(async () => {
    await cache.current.delete({ customKey: key });
    setData(null);
  }, [key]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [fetchData, enabled]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    lastFetch,
    refresh,
    clearCache,
  };
}

/**
 * Hook for LLM preprocessing cache
 */
export function useLLMCache(
  query: string,
  userId?: string,
  options: { enabled?: boolean } = {}
) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { enabled = true } = options;

  const getCachedResult = useCallback(async () => {
    if (!enabled || !query) return null;

    setIsLoading(true);
    try {
      const result = await llmCache.get(query, userId);
      setData(result);
      return result;
    } catch (error) {
      console.error('LLM cache error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [query, userId, enabled]);

  const setCachedResult = useCallback(async (result: any) => {
    if (!enabled || !query) return;

    try {
      await llmCache.set(query, result, userId);
      setData(result);
    } catch (error) {
      console.error('LLM cache set error:', error);
    }
  }, [query, userId, enabled]);

  useEffect(() => {
    getCachedResult();
  }, [getCachedResult]);

  return {
    data,
    isLoading,
    getCachedResult,
    setCachedResult,
  };
}

/**
 * Hook for search results cache
 */
export function useSearchCache(
  query: string,
  userId: string,
  filters?: Record<string, any>,
  options: { enabled?: boolean } = {}
) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { enabled = true } = options;

  const getCachedResult = useCallback(async () => {
    if (!enabled || !query || !userId) return null;

    setIsLoading(true);
    try {
      const result = await searchCache.get(query, userId, filters);
      setData(result);
      return result;
    } catch (error) {
      console.error('Search cache error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [query, userId, filters, enabled]);

  const setCachedResult = useCallback(async (result: any) => {
    if (!enabled || !query || !userId) return;

    try {
      await searchCache.set(query, result, userId, filters);
      setData(result);
    } catch (error) {
      console.error('Search cache set error:', error);
    }
  }, [query, userId, filters, enabled]);

  const invalidateCache = useCallback(async () => {
    try {
      await searchCache.invalidateUser(userId);
      setData(null);
    } catch (error) {
      console.error('Search cache invalidation error:', error);
    }
  }, [userId]);

  useEffect(() => {
    getCachedResult();
  }, [getCachedResult]);

  return {
    data,
    isLoading,
    getCachedResult,
    setCachedResult,
    invalidateCache,
  };
}

/**
 * Hook for financial aggregation cache
 */
export function useFinancialCache(
  functionName: string,
  userId: string,
  params?: Record<string, any>,
  options: { enabled?: boolean } = {}
) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { enabled = true } = options;

  const getCachedResult = useCallback(async () => {
    if (!enabled || !functionName || !userId) return null;

    setIsLoading(true);
    try {
      const result = await financialCache.get(functionName, userId, params);
      setData(result);
      return result;
    } catch (error) {
      console.error('Financial cache error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [functionName, userId, params, enabled]);

  const setCachedResult = useCallback(async (result: any) => {
    if (!enabled || !functionName || !userId) return;

    try {
      await financialCache.set(functionName, result, userId, params);
      setData(result);
    } catch (error) {
      console.error('Financial cache set error:', error);
    }
  }, [functionName, userId, params, enabled]);

  const invalidateCache = useCallback(async () => {
    try {
      await financialCache.invalidateUser(userId);
      setData(null);
    } catch (error) {
      console.error('Financial cache invalidation error:', error);
    }
  }, [userId]);

  useEffect(() => {
    getCachedResult();
  }, [getCachedResult]);

  return {
    data,
    isLoading,
    getCachedResult,
    setCachedResult,
    invalidateCache,
  };
}

/**
 * Hook for conversation history cache
 */
export function useConversationCache(
  conversationId: string,
  userId: string,
  options: { enabled?: boolean } = {}
) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { enabled = true } = options;

  const getCachedConversation = useCallback(async () => {
    if (!enabled || !conversationId || !userId) return null;

    setIsLoading(true);
    try {
      const result = await conversationCache.get(conversationId, userId);
      setData(result);
      return result;
    } catch (error) {
      console.error('Conversation cache error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, userId, enabled]);

  const setCachedConversation = useCallback(async (conversation: any) => {
    if (!enabled || !conversationId || !userId) return;

    try {
      await conversationCache.set(conversationId, conversation, userId);
      setData(conversation);
    } catch (error) {
      console.error('Conversation cache set error:', error);
    }
  }, [conversationId, userId, enabled]);

  const deleteCachedConversation = useCallback(async () => {
    try {
      await conversationCache.delete(conversationId, userId);
      setData(null);
    } catch (error) {
      console.error('Conversation cache delete error:', error);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    getCachedConversation();
  }, [getCachedConversation]);

  return {
    data,
    isLoading,
    getCachedConversation,
    setCachedConversation,
    deleteCachedConversation,
  };
}

/**
 * Hook for cache statistics
 */
export function useCacheStats(source?: CacheSource) {
  const [stats, setStats] = useState<CacheStats | Record<CacheSource, CacheStats> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      if (source) {
        const cache = cacheManager.getCache(source);
        const cacheStats = await cache.getStats();
        setStats(cacheStats);
      } else {
        const globalStats = await cacheManager.getGlobalStats();
        setStats(globalStats);
      }
    } catch (error) {
      console.error('Cache stats error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    refresh: fetchStats,
  };
}
