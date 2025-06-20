/**
 * React Hook for Search Performance Monitoring
 * Provides real-time search performance metrics and cache management
 */

import { useState, useEffect, useCallback } from 'react';
import { searchCache } from '@/lib/searchCache';
import { searchPerformanceMonitor } from '@/lib/searchPerformanceMonitor';
import type { CacheMetrics } from '@/lib/searchCache';
import type { PerformanceAlert } from '@/lib/searchPerformanceMonitor';

interface SearchPerformanceState {
  // Cache metrics
  cacheMetrics: CacheMetrics & { memoryUsage: number; entryCount: number };
  
  // Performance summary
  performanceSummary: {
    averageQueryTime: number;
    averageResultCount: number;
    cacheHitRate: number;
    totalQueries: number;
    recentAlerts: PerformanceAlert[];
    trends: {
      queryTimeImproving: boolean;
      resultQualityImproving: boolean;
      cacheEfficiencyImproving: boolean;
    };
  };
  
  // Real-time alerts
  activeAlerts: PerformanceAlert[];
  
  // Loading states
  loading: boolean;
  error: string | null;
}

interface UseSearchPerformanceReturn extends SearchPerformanceState {
  // Cache management
  clearCache: () => void;
  invalidateCache: (pattern?: string) => void;
  warmCache: (queries: string[]) => Promise<void>;
  
  // Performance monitoring
  refreshMetrics: () => void;
  setMonitoringEnabled: (enabled: boolean) => void;
  
  // Alert management
  dismissAlert: (alertIndex: number) => void;
  clearAllAlerts: () => void;
  
  // Performance optimization
  getOptimizationSuggestions: () => string[];
}

export function useSearchPerformance(): UseSearchPerformanceReturn {
  const [state, setState] = useState<SearchPerformanceState>({
    cacheMetrics: {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      cacheEfficiency: 0,
      memoryUsage: 0,
      entryCount: 0
    },
    performanceSummary: {
      averageQueryTime: 0,
      averageResultCount: 0,
      cacheHitRate: 0,
      totalQueries: 0,
      recentAlerts: [],
      trends: {
        queryTimeImproving: false,
        resultQualityImproving: false,
        cacheEfficiencyImproving: false
      }
    },
    activeAlerts: [],
    loading: false,
    error: null
  });

  /**
   * Refresh performance metrics
   */
  const refreshMetrics = useCallback(() => {
    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null
      }));

      // Get cache metrics
      const cacheMetrics = searchCache.getMetrics();
      
      // Get performance summary
      const performanceSummary = searchPerformanceMonitor.getPerformanceSummary();

      setState(prev => ({
        ...prev,
        cacheMetrics,
        performanceSummary,
        activeAlerts: performanceSummary.recentAlerts.filter(alert => 
          // Show alerts from last 5 minutes
          Date.now() - new Date(alert.timestamp).getTime() < 5 * 60 * 1000
        ),
        loading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh metrics'
      }));
    }
  }, []);

  /**
   * Clear all cache
   */
  const clearCache = useCallback(() => {
    try {
      searchCache.invalidate();
      refreshMetrics();
      console.log('🗑️ Search cache cleared');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear cache'
      }));
    }
  }, [refreshMetrics]);

  /**
   * Invalidate cache with pattern
   */
  const invalidateCache = useCallback((pattern?: string) => {
    try {
      searchCache.invalidate(pattern);
      refreshMetrics();
      console.log(`🗑️ Cache invalidated${pattern ? ` for pattern: ${pattern}` : ''}`);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to invalidate cache'
      }));
    }
  }, [refreshMetrics]);

  /**
   * Warm cache with popular queries
   */
  const warmCache = useCallback(async (queries: string[]) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      // Note: This would typically involve calling the search function for each query
      // For now, we'll just log the intent
      console.log(`🔥 Cache warming requested for ${queries.length} queries:`, queries);
      
      // In a real implementation, you would:
      // for (const query of queries) {
      //   await unifiedSearch({ query, sources: ['receipts', 'business_directory'] });
      // }

      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to warm cache'
      }));
    }
  }, []);

  /**
   * Set monitoring enabled/disabled
   */
  const setMonitoringEnabled = useCallback((enabled: boolean) => {
    searchPerformanceMonitor.setEnabled(enabled);
    console.log(`📊 Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  /**
   * Dismiss a specific alert
   */
  const dismissAlert = useCallback((alertIndex: number) => {
    setState(prev => ({
      ...prev,
      activeAlerts: prev.activeAlerts.filter((_, index) => index !== alertIndex)
    }));
  }, []);

  /**
   * Clear all alerts
   */
  const clearAllAlerts = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeAlerts: []
    }));
    searchPerformanceMonitor.clear();
  }, []);

  /**
   * Get optimization suggestions based on current metrics
   */
  const getOptimizationSuggestions = useCallback((): string[] => {
    const suggestions: string[] = [];
    const { cacheMetrics, performanceSummary } = state;

    // Cache efficiency suggestions
    if (cacheMetrics.cacheEfficiency < 50) {
      suggestions.push('Cache hit rate is low. Consider increasing cache TTL or warming cache with popular queries.');
    }

    // Query time suggestions
    if (performanceSummary.averageQueryTime > 1000) {
      suggestions.push('Average query time is high. Consider optimizing search parameters or database indexes.');
    }

    // Memory usage suggestions
    if (cacheMetrics.memoryUsage > 40) {
      suggestions.push('Cache memory usage is high. Consider reducing cache size or implementing more aggressive eviction.');
    }

    // Result quality suggestions
    if (performanceSummary.averageResultCount < 3) {
      suggestions.push('Average result count is low. Consider lowering similarity threshold or expanding search sources.');
    }

    // Trend-based suggestions
    if (!performanceSummary.trends.queryTimeImproving) {
      suggestions.push('Query performance is not improving. Monitor for system bottlenecks or consider scaling.');
    }

    if (!performanceSummary.trends.cacheEfficiencyImproving) {
      suggestions.push('Cache efficiency is not improving. Review cache strategy and popular query patterns.');
    }

    // Default suggestion if everything looks good
    if (suggestions.length === 0) {
      suggestions.push('Performance metrics look good! Continue monitoring for any changes.');
    }

    return suggestions;
  }, [state]);

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    refreshMetrics(); // Initial load
    
    const interval = setInterval(refreshMetrics, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return {
    ...state,
    clearCache,
    invalidateCache,
    warmCache,
    refreshMetrics,
    setMonitoringEnabled,
    dismissAlert,
    clearAllAlerts,
    getOptimizationSuggestions
  };
}

export default useSearchPerformance;
