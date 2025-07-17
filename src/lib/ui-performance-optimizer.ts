/**
 * UI Performance Optimizer
 * Advanced React performance optimization with intelligent rendering strategies
 */

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

// Performance monitoring configuration
interface PerformanceConfig {
  enableVirtualization: boolean;
  virtualizationThreshold: number;
  enableLazyLoading: boolean;
  lazyLoadingThreshold: number;
  enableMemoization: boolean;
  memoizationTTL: number;
  enableIntersectionObserver: boolean;
  intersectionThreshold: number;
  enableFrameThrottling: boolean;
  frameThrottleMs: number;
}

// Component performance metrics
interface ComponentMetrics {
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
  memoryUsage: number;
  lastRender: number;
  isVisible: boolean;
  intersectionRatio: number;
}

// Render optimization strategies
enum RenderStrategy {
  IMMEDIATE = 'immediate',
  THROTTLED = 'throttled',
  LAZY = 'lazy',
  VIRTUALIZED = 'virtualized',
  MEMOIZED = 'memoized'
}

// Performance optimization result
interface OptimizationResult {
  strategy: RenderStrategy;
  shouldRender: boolean;
  renderPriority: number;
  estimatedRenderTime: number;
  optimizations: string[];
}

class UIPerformanceOptimizer {
  private config: PerformanceConfig = {
    enableVirtualization: true,
    virtualizationThreshold: 50,
    enableLazyLoading: true,
    lazyLoadingThreshold: 10,
    enableMemoization: true,
    memoizationTTL: 5 * 60 * 1000, // 5 minutes
    enableIntersectionObserver: true,
    intersectionThreshold: 0.1,
    enableFrameThrottling: true,
    frameThrottleMs: 16 // 60fps
  };

  private componentMetrics = new Map<string, ComponentMetrics>();
  private memoCache = new Map<string, { data: any; timestamp: number; hits: number }>();
  private renderQueue: Array<{ id: string; priority: number; callback: () => void }> = [];
  private isProcessingQueue = false;

  /**
   * Determine optimal rendering strategy for a component
   */
  determineRenderStrategy(
    componentId: string,
    itemCount: number,
    isVisible: boolean,
    complexity: number
  ): OptimizationResult {
    const metrics = this.componentMetrics.get(componentId);
    const optimizations: string[] = [];
    let strategy = RenderStrategy.IMMEDIATE;
    let renderPriority = 1;
    let estimatedRenderTime = 16; // 1 frame

    // Virtualization strategy
    if (this.config.enableVirtualization && itemCount > this.config.virtualizationThreshold) {
      strategy = RenderStrategy.VIRTUALIZED;
      renderPriority = 3;
      estimatedRenderTime = Math.min(16, itemCount * 0.1);
      optimizations.push('virtualization');
    }

    // Lazy loading strategy
    else if (this.config.enableLazyLoading && !isVisible && itemCount > this.config.lazyLoadingThreshold) {
      strategy = RenderStrategy.LAZY;
      renderPriority = 0;
      estimatedRenderTime = 0;
      optimizations.push('lazy_loading');
    }

    // Memoization strategy
    else if (this.config.enableMemoization && metrics && metrics.renderCount > 3) {
      strategy = RenderStrategy.MEMOIZED;
      renderPriority = 2;
      estimatedRenderTime = metrics.averageRenderTime * 0.1; // 90% reduction
      optimizations.push('memoization');
    }

    // Frame throttling strategy
    else if (this.config.enableFrameThrottling && complexity > 5) {
      strategy = RenderStrategy.THROTTLED;
      renderPriority = 1;
      estimatedRenderTime = Math.max(16, complexity * 3);
      optimizations.push('frame_throttling');
    }

    // Adjust priority based on visibility
    if (isVisible) {
      renderPriority = Math.min(3, renderPriority + 1);
    }

    // Adjust priority based on performance history
    if (metrics && metrics.averageRenderTime > 50) {
      renderPriority = Math.max(0, renderPriority - 1);
      optimizations.push('performance_degradation_detected');
    }

    return {
      strategy,
      shouldRender: strategy !== RenderStrategy.LAZY,
      renderPriority,
      estimatedRenderTime,
      optimizations
    };
  }

  /**
   * Schedule a render operation with priority
   */
  scheduleRender(
    componentId: string,
    renderCallback: () => void,
    priority: number = 1
  ): void {
    // Add to render queue
    this.renderQueue.push({
      id: componentId,
      priority,
      callback: renderCallback
    });

    // Sort by priority (higher priority first)
    this.renderQueue.sort((a, b) => b.priority - a.priority);

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processRenderQueue();
    }
  }

  /**
   * Process the render queue with frame-based scheduling
   */
  private async processRenderQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.renderQueue.length > 0) {
      const frameStart = performance.now();
      const frameTimeLimit = this.config.frameThrottleMs;

      // Process renders within frame time limit
      while (this.renderQueue.length > 0 && (performance.now() - frameStart) < frameTimeLimit) {
        const renderTask = this.renderQueue.shift()!;
        
        try {
          const renderStart = performance.now();
          renderTask.callback();
          const renderTime = performance.now() - renderStart;
          
          // Update metrics
          this.updateComponentMetrics(renderTask.id, renderTime);
          
        } catch (error) {
          console.error(`Render error for component ${renderTask.id}:`, error);
        }
      }

      // Yield to browser if more renders pending
      if (this.renderQueue.length > 0) {
        await new Promise(resolve => requestAnimationFrame(() => resolve(void 0)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Update component performance metrics
   */
  private updateComponentMetrics(componentId: string, renderTime: number): void {
    const existing = this.componentMetrics.get(componentId);
    
    if (existing) {
      const newRenderCount = existing.renderCount + 1;
      const newAverageRenderTime = 
        (existing.averageRenderTime * existing.renderCount + renderTime) / newRenderCount;

      this.componentMetrics.set(componentId, {
        ...existing,
        renderTime,
        renderCount: newRenderCount,
        averageRenderTime: newAverageRenderTime,
        lastRender: Date.now(),
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      });
    } else {
      this.componentMetrics.set(componentId, {
        renderTime,
        renderCount: 1,
        averageRenderTime: renderTime,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        lastRender: Date.now(),
        isVisible: true,
        intersectionRatio: 1
      });
    }
  }

  /**
   * Get or create memoized data
   */
  getMemoizedData<T>(
    key: string,
    factory: () => T,
    dependencies: any[] = []
  ): T {
    const depKey = `${key}_${JSON.stringify(dependencies)}`;
    const cached = this.memoCache.get(depKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.memoizationTTL) {
      cached.hits++;
      return cached.data;
    }

    // Generate new data
    const data = factory();
    
    // Cache with LRU eviction
    if (this.memoCache.size >= 1000) {
      const oldestKey = Array.from(this.memoCache.keys())[0];
      this.memoCache.delete(oldestKey);
    }

    this.memoCache.set(depKey, {
      data,
      timestamp: Date.now(),
      hits: 1
    });

    return data;
  }

  /**
   * Update component visibility
   */
  updateComponentVisibility(
    componentId: string,
    isVisible: boolean,
    intersectionRatio: number = 1
  ): void {
    const metrics = this.componentMetrics.get(componentId);
    if (metrics) {
      this.componentMetrics.set(componentId, {
        ...metrics,
        isVisible,
        intersectionRatio
      });
    }
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(): {
    totalComponents: number;
    averageRenderTime: number;
    slowComponents: Array<{ id: string; averageRenderTime: number }>;
    cacheHitRate: number;
    memoryUsage: number;
    renderQueueLength: number;
  } {
    const components = Array.from(this.componentMetrics.values());
    const cacheEntries = Array.from(this.memoCache.values());

    const totalRenderTime = components.reduce((sum, c) => sum + c.averageRenderTime, 0);
    const averageRenderTime = components.length > 0 ? totalRenderTime / components.length : 0;

    const slowComponents = Array.from(this.componentMetrics.entries())
      .filter(([, metrics]) => metrics.averageRenderTime > 50)
      .map(([id, metrics]) => ({ id, averageRenderTime: metrics.averageRenderTime }))
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
      .slice(0, 10);

    const totalCacheAccesses = cacheEntries.reduce((sum, entry) => sum + entry.hits, 0);
    const cacheHitRate = totalCacheAccesses > 0 ? 
      (totalCacheAccesses - cacheEntries.length) / totalCacheAccesses * 100 : 0;

    const memoryUsage = components.length > 0 ? 
      components.reduce((sum, c) => sum + c.memoryUsage, 0) / components.length : 0;

    return {
      totalComponents: components.length,
      averageRenderTime,
      slowComponents,
      cacheHitRate,
      memoryUsage,
      renderQueueLength: this.renderQueue.length
    };
  }

  /**
   * Clear performance data
   */
  clearMetrics(): void {
    this.componentMetrics.clear();
    this.memoCache.clear();
    this.renderQueue = [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(componentId: string): ComponentMetrics | null {
    return this.componentMetrics.get(componentId) || null;
  }
}

// Export singleton instance
export const uiPerformanceOptimizer = new UIPerformanceOptimizer();

// React hooks for UI performance optimization
export function useRenderOptimization(
  componentId: string,
  itemCount: number = 1,
  complexity: number = 1
) {
  const [isVisible, setIsVisible] = useState(true);
  const elementRef = useRef<HTMLElement>(null);

  // Intersection observer for visibility detection
  useEffect(() => {
    if (!uiPerformanceOptimizer['config'].enableIntersectionObserver || !elementRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting;
          const ratio = entry.intersectionRatio;
          
          setIsVisible(visible);
          uiPerformanceOptimizer.updateComponentVisibility(componentId, visible, ratio);
        });
      },
      {
        threshold: uiPerformanceOptimizer['config'].intersectionThreshold
      }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [componentId]);

  // Get optimization strategy
  const optimization = uiPerformanceOptimizer.determineRenderStrategy(
    componentId,
    itemCount,
    isVisible,
    complexity
  );

  // Optimized render function
  const optimizedRender = useCallback((renderCallback: () => void) => {
    if (!optimization.shouldRender) {
      return;
    }

    uiPerformanceOptimizer.scheduleRender(
      componentId,
      renderCallback,
      optimization.renderPriority
    );
  }, [componentId, optimization]);

  return {
    elementRef,
    isVisible,
    optimization,
    optimizedRender,
    shouldRender: optimization.shouldRender
  };
}

// Hook for memoized data with performance tracking
export function useOptimizedMemo<T>(
  factory: () => T,
  dependencies: any[],
  key?: string
): T {
  const memoKey = key || `memo_${Math.random().toString(36).substr(2, 9)}`;
  
  return uiPerformanceOptimizer.getMemoizedData(memoKey, factory, dependencies);
}

// Hook for virtualized list optimization
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    visibleRange,
    totalHeight,
    handleScroll,
    offsetY: visibleRange.startIndex * itemHeight
  };
}

export type { PerformanceConfig, ComponentMetrics, OptimizationResult, RenderStrategy };
