/**
 * React Hook for Performance Optimizations
 * Provides caching, metrics, and optimization utilities for Malaysian multi-language features
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PerformanceMetric {
  metric_name: string;
  metric_type: string;
  metric_value: number;
  metric_unit: string;
  context?: any;
  created_at: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  useMemoryCache?: boolean;
}

interface UsePerformanceOptimizationReturn {
  // Caching functions
  getCachedData: (key: string) => Promise<any>;
  setCachedData: (key: string, value: any, options?: CacheOptions) => Promise<void>;
  invalidateCache: (pattern?: string) => Promise<void>;
  
  // Performance metrics
  logMetric: (name: string, type: string, value: number, unit: string, context?: any) => Promise<void>;
  getMetrics: (type?: string, startDate?: string, endDate?: string) => Promise<PerformanceMetric[]>;
  
  // Optimized search functions
  searchMalaysianBusiness: (term: string, limit?: number, useCache?: boolean) => Promise<any[]>;
  detectContentLanguage: (text: string) => Promise<any>;
  getOptimalAIModel: (text: string, processingType?: string) => Promise<any>;
  
  // Materialized view management
  refreshViews: () => Promise<void>;
  
  // State
  loading: boolean;
  error: string | null;
}

export function usePerformanceOptimization(): UsePerformanceOptimizationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Call performance cache Edge Function
  const callCacheFunction = useCallback(async (action: string, params: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke('performance-cache', {
        body: { action, ...params }
      });

      if (error) {
        throw error;
      }

      return data?.data;
    } catch (err) {
      console.error('Cache function error:', err);
      throw err;
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback(async (key: string): Promise<any> => {
    try {
      setError(null);
      const result = await callCacheFunction('get', { key });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get cached data');
      return null;
    }
  }, [callCacheFunction]);

  // Set cached data
  const setCachedData = useCallback(async (
    key: string, 
    value: any, 
    options: CacheOptions = {}
  ): Promise<void> => {
    try {
      setError(null);
      await callCacheFunction('set', { 
        key, 
        value, 
        ttl: options.ttl || 3600 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set cached data');
      throw err;
    }
  }, [callCacheFunction]);

  // Invalidate cache
  const invalidateCache = useCallback(async (pattern?: string): Promise<void> => {
    try {
      setError(null);
      await callCacheFunction('invalidate', { key: pattern });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invalidate cache');
      throw err;
    }
  }, [callCacheFunction]);

  // Log performance metric
  const logMetric = useCallback(async (
    name: string,
    type: string,
    value: number,
    unit: string,
    context?: any
  ): Promise<void> => {
    try {
      setError(null);
      const { error } = await supabase.rpc('log_performance_metric', {
        p_metric_name: name,
        p_metric_type: type,
        p_metric_value: value,
        p_metric_unit: unit,
        p_context: context || null,
        p_user_id: null
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log metric');
      // Don't throw here as logging failures shouldn't break the app
      console.error('Failed to log performance metric:', err);
    }
  }, []);

  // Get performance metrics
  const getMetrics = useCallback(async (
    type?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceMetric[]> => {
    try {
      setError(null);
      const result = await callCacheFunction('get_metrics', {
        metric_type: type,
        start_date: startDate,
        end_date: endDate
      });
      return result || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get metrics');
      return [];
    }
  }, [callCacheFunction]);

  // Optimized Malaysian business search
  const searchMalaysianBusiness = useCallback(async (
    term: string,
    limit: number = 10,
    useCache: boolean = true
  ): Promise<any[]> => {
    try {
      setLoading(true);
      setError(null);

      const startTime = performance.now();

      const { data, error } = await supabase.rpc('search_malaysian_business_optimized', {
        search_term: term,
        limit_results: limit,
        use_cache: useCache
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log search performance
      await logMetric('business_search', 'query_time', duration, 'ms', {
        search_term: term,
        use_cache: useCache,
        result_count: data?.length || 0
      });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search businesses');
      return [];
    } finally {
      setLoading(false);
    }
  }, [logMetric]);

  // Detect content language
  const detectContentLanguage = useCallback(async (text: string): Promise<any> => {
    try {
      setError(null);

      const { data, error } = await supabase.rpc('detect_content_language', {
        content_text: text
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect language');
      return null;
    }
  }, []);

  // Get optimal AI model
  const getOptimalAIModel = useCallback(async (
    text: string,
    processingType: string = 'receipt_processing'
  ): Promise<any> => {
    try {
      setError(null);

      const { data, error } = await supabase.rpc('get_optimal_ai_model', {
        content_text: text,
        processing_type: processingType
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get optimal AI model');
      return null;
    }
  }, []);

  // Refresh materialized views
  const refreshViews = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await callCacheFunction('refresh_views');

      // Also invalidate related cache entries
      await invalidateCache('malaysian_business');
      await invalidateCache('malaysian_reference');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh views');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [callCacheFunction, invalidateCache]);

  return {
    // Caching functions
    getCachedData,
    setCachedData,
    invalidateCache,
    
    // Performance metrics
    logMetric,
    getMetrics,
    
    // Optimized search functions
    searchMalaysianBusiness,
    detectContentLanguage,
    getOptimalAIModel,
    
    // Materialized view management
    refreshViews,
    
    // State
    loading,
    error
  };
}

export default usePerformanceOptimization;
