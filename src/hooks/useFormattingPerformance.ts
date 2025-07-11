/**
 * Performance optimization hooks for formatting pipeline
 * 
 * Provides memoization, lazy loading, and performance monitoring
 * for the formatting and rendering pipeline.
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { parseUIComponents, analyzeMarkdownContent } from '@/lib/ui-component-parser';
import type { UIComponent } from '@/types/ui-components';

// Performance monitoring interface
interface PerformanceMetrics {
  parseTime: number;
  renderTime: number;
  componentCount: number;
  contentLength: number;
  memoryUsage?: number;
}

// Cache for parsed components
const componentCache = new Map<string, {
  components: UIComponent[];
  cleanedContent: string;
  timestamp: number;
  metrics: PerformanceMetrics;
}>();

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Optimized UI component parsing with caching and performance monitoring
 */
export function useOptimizedParsing(content: string, options?: {
  enableCache?: boolean;
  maxCacheSize?: number;
  performanceTracking?: boolean;
}) {
  const {
    enableCache = true,
    maxCacheSize = 100,
    performanceTracking = true
  } = options || {};

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const parseStartTime = useRef<number>(0);

  // Generate cache key
  const cacheKey = useMemo(() => {
    if (!enableCache) return null;
    return `parse_${btoa(content).slice(0, 32)}`;
  }, [content, enableCache]);

  // Memoized parsing with caching
  const parseResult = useMemo(() => {
    const startTime = performance.now();
    parseStartTime.current = startTime;

    // Check cache first
    if (cacheKey && componentCache.has(cacheKey)) {
      const cached = componentCache.get(cacheKey)!;
      const now = Date.now();
      
      if (now - cached.timestamp < CACHE_TTL) {
        if (performanceTracking) {
          setMetrics({
            ...cached.metrics,
            parseTime: performance.now() - startTime // Cache hit time
          });
        }
        return {
          components: cached.components,
          cleanedContent: cached.cleanedContent,
          fromCache: true
        };
      } else {
        // Remove expired entry
        componentCache.delete(cacheKey);
      }
    }

    // Parse components
    const result = parseUIComponents(content);
    const parseTime = performance.now() - startTime;

    // Create performance metrics
    const newMetrics: PerformanceMetrics = {
      parseTime,
      renderTime: 0, // Will be updated during render
      componentCount: result.components.length,
      contentLength: content.length,
      memoryUsage: (performance as any).memory?.usedJSHeapSize
    };

    // Cache the result
    if (cacheKey && enableCache) {
      // Implement LRU eviction if cache is full
      if (componentCache.size >= maxCacheSize) {
        const oldestKey = Array.from(componentCache.keys())[0];
        componentCache.delete(oldestKey);
      }

      componentCache.set(cacheKey, {
        components: result.components,
        cleanedContent: result.cleanedContent,
        timestamp: Date.now(),
        metrics: newMetrics
      });
    }

    if (performanceTracking) {
      setMetrics(newMetrics);
    }

    return {
      components: result.components,
      cleanedContent: result.cleanedContent,
      fromCache: false
    };
  }, [content, cacheKey, enableCache, maxCacheSize, performanceTracking]);

  // Update render time when component mounts/updates
  useEffect(() => {
    if (performanceTracking && metrics) {
      const renderTime = performance.now() - parseStartTime.current;
      setMetrics(prev => prev ? { ...prev, renderTime } : null);
    }
  }, [parseResult, performanceTracking, metrics]);

  return {
    ...parseResult,
    metrics,
    clearCache: useCallback(() => {
      if (cacheKey) {
        componentCache.delete(cacheKey);
      }
    }, [cacheKey])
  };
}

/**
 * Debounced content analysis for real-time editing
 */
export function useDebouncedAnalysis(content: string, delay: number = 300) {
  const [analysis, setAnalysis] = useState(() => analyzeMarkdownContent(content));
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const newAnalysis = analyzeMarkdownContent(content);
      setAnalysis(newAnalysis);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, delay]);

  return analysis;
}

/**
 * Lazy loading hook for large component lists
 */
export function useLazyComponents(components: UIComponent[], batchSize: number = 5) {
  const [loadedCount, setLoadedCount] = useState(Math.min(batchSize, components.length));
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loadedCount >= components.length || isLoading) return;

    setIsLoading(true);
    
    // Simulate async loading with a small delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    setLoadedCount(prev => Math.min(prev + batchSize, components.length));
    setIsLoading(false);
  }, [loadedCount, components.length, batchSize, isLoading]);

  const visibleComponents = useMemo(() => 
    components.slice(0, loadedCount), 
    [components, loadedCount]
  );

  const hasMore = loadedCount < components.length;

  return {
    visibleComponents,
    hasMore,
    isLoading,
    loadMore,
    reset: useCallback(() => {
      setLoadedCount(Math.min(batchSize, components.length));
    }, [batchSize, components.length])
  };
}

/**
 * Performance monitoring for component rendering
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const [renderMetrics, setRenderMetrics] = useState<{
    renderTime: number;
    renderCount: number;
    averageRenderTime: number;
  }>({ renderTime: 0, renderCount: 0, averageRenderTime: 0 });

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    setRenderMetrics(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newAverageRenderTime = (prev.averageRenderTime * prev.renderCount + renderTime) / newRenderCount;
      
      return {
        renderTime,
        renderCount: newRenderCount,
        averageRenderTime: newAverageRenderTime
      };
    });

    // Log performance warnings
    if (renderTime > 100) {
      console.warn(`Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  }, [componentName]);

  return {
    startRender,
    endRender,
    metrics: renderMetrics
  };
}

/**
 * Memory usage monitoring
 */
export function useMemoryMonitoring() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ((performance as any).memory) {
        setMemoryInfo({
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

/**
 * Clear all performance caches
 */
export function clearAllCaches() {
  componentCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: componentCache.size,
    entries: Array.from(componentCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      componentCount: value.components.length,
      contentLength: value.cleanedContent.length,
      metrics: value.metrics
    }))
  };
}
