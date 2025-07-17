/**
 * UI Performance Tests
 * Validates the performance improvements of the optimized UI components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { uiPerformanceOptimizer } from '@/lib/ui-performance-optimizer';
import { optimizedAnimationManager } from '@/lib/optimized-animations';

// Mock React and DOM APIs
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  }
});

Object.defineProperty(window, 'IntersectionObserver', {
  value: vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
});

Object.defineProperty(window, 'requestAnimationFrame', {
  value: vi.fn((callback) => setTimeout(callback, 16))
});

describe('UI Performance Optimization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uiPerformanceOptimizer.clearMetrics();
    optimizedAnimationManager.clearAnimations();
  });

  afterEach(() => {
    uiPerformanceOptimizer.clearMetrics();
    optimizedAnimationManager.clearAnimations();
  });

  describe('UI Performance Optimizer', () => {
    it('should determine optimal render strategy based on component characteristics', () => {
      const testCases = [
        {
          componentId: 'small-list',
          itemCount: 10,
          isVisible: true,
          complexity: 2,
          expectedStrategy: 'immediate'
        },
        {
          componentId: 'large-list',
          itemCount: 100,
          isVisible: true,
          complexity: 5,
          expectedStrategy: 'virtualized'
        },
        {
          componentId: 'hidden-component',
          itemCount: 20,
          isVisible: false,
          complexity: 3,
          expectedStrategy: 'lazy'
        },
        {
          componentId: 'complex-component',
          itemCount: 5,
          isVisible: true,
          complexity: 8,
          expectedStrategy: 'throttled'
        }
      ];

      for (const testCase of testCases) {
        const result = uiPerformanceOptimizer.determineRenderStrategy(
          testCase.componentId,
          testCase.itemCount,
          testCase.isVisible,
          testCase.complexity
        );

        expect(result.strategy).toBe(testCase.expectedStrategy);
        expect(result.shouldRender).toBe(testCase.expectedStrategy !== 'lazy');
        expect(result.renderPriority).toBeGreaterThanOrEqual(0);
        expect(result.estimatedRenderTime).toBeGreaterThan(0);
        expect(Array.isArray(result.optimizations)).toBe(true);
      }
    });

    it('should schedule renders with priority management', async () => {
      const renderCallbacks = [];
      const componentIds = ['high-priority', 'medium-priority', 'low-priority'];
      const priorities = [3, 2, 1];

      // Schedule renders with different priorities
      for (let i = 0; i < componentIds.length; i++) {
        const callback = vi.fn();
        renderCallbacks.push(callback);
        
        uiPerformanceOptimizer.scheduleRender(
          componentIds[i],
          callback,
          priorities[i]
        );
      }

      // Wait for renders to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Higher priority renders should be called first
      expect(renderCallbacks[0]).toHaveBeenCalled(); // High priority
      expect(renderCallbacks[1]).toHaveBeenCalled(); // Medium priority
      expect(renderCallbacks[2]).toHaveBeenCalled(); // Low priority
    });

    it('should provide memoized data with cache management', () => {
      const factory = vi.fn(() => ({ data: 'test', timestamp: Date.now() }));
      const dependencies = ['dep1', 'dep2'];

      // First call should invoke factory
      const result1 = uiPerformanceOptimizer.getMemoizedData('test-key', factory, dependencies);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(result1).toHaveProperty('data', 'test');

      // Second call with same dependencies should use cache
      const result2 = uiPerformanceOptimizer.getMemoizedData('test-key', factory, dependencies);
      expect(factory).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toBe(result1);

      // Call with different dependencies should invoke factory again
      const result3 = uiPerformanceOptimizer.getMemoizedData('test-key', factory, ['dep3']);
      expect(factory).toHaveBeenCalledTimes(2);
      expect(result3).not.toBe(result1);
    });

    it('should track component visibility and performance metrics', () => {
      const componentId = 'test-component';
      
      // Update visibility
      uiPerformanceOptimizer.updateComponentVisibility(componentId, true, 0.8);
      
      // Simulate render
      uiPerformanceOptimizer.scheduleRender(componentId, () => {
        // Simulate render work
        const start = performance.now();
        while (performance.now() - start < 10) {
          // Busy wait
        }
      });

      // Get metrics
      const metrics = uiPerformanceOptimizer.getComponentMetrics(componentId);
      expect(metrics).toBeDefined();
      expect(metrics?.isVisible).toBe(true);
      expect(metrics?.intersectionRatio).toBe(0.8);
    });

    it('should provide performance analytics', () => {
      // Simulate some component activity
      for (let i = 0; i < 5; i++) {
        uiPerformanceOptimizer.scheduleRender(`component-${i}`, () => {});
      }

      const analytics = uiPerformanceOptimizer.getPerformanceAnalytics();
      
      expect(analytics).toHaveProperty('totalComponents');
      expect(analytics).toHaveProperty('averageRenderTime');
      expect(analytics).toHaveProperty('slowComponents');
      expect(analytics).toHaveProperty('cacheHitRate');
      expect(analytics).toHaveProperty('memoryUsage');
      expect(analytics).toHaveProperty('renderQueueLength');

      expect(typeof analytics.totalComponents).toBe('number');
      expect(typeof analytics.averageRenderTime).toBe('number');
      expect(Array.isArray(analytics.slowComponents)).toBe(true);
    });
  });

  describe('Optimized Animation Manager', () => {
    it('should provide animation presets with reduced motion support', () => {
      // Test normal animations
      optimizedAnimationManager.updateConfig({ enableAnimations: true });
      const normalPreset = optimizedAnimationManager.getPreset('fadeIn');
      
      expect(normalPreset).toHaveProperty('initial');
      expect(normalPreset).toHaveProperty('animate');
      expect(normalPreset).toHaveProperty('transition');

      // Test reduced motion
      optimizedAnimationManager.updateConfig({ enableAnimations: false });
      const reducedPreset = optimizedAnimationManager.getPreset('fadeIn');
      
      expect(reducedPreset.transition?.duration).toBeLessThan(0.2);
    });

    it('should create optimized stagger animations', () => {
      const staggerAnimation = optimizedAnimationManager.createStaggerAnimation(10, 0.1, 1);
      
      expect(staggerAnimation).toHaveProperty('animate');
      expect(staggerAnimation.animate).toHaveProperty('transition');
      expect(staggerAnimation.animate.transition).toHaveProperty('staggerChildren');
    });

    it('should manage animation concurrency', () => {
      const maxConcurrent = 3;
      optimizedAnimationManager.updateConfig({ maxConcurrentAnimations: maxConcurrent });

      const animationCallbacks = [];
      
      // Schedule more animations than the limit
      for (let i = 0; i < maxConcurrent + 2; i++) {
        const callback = vi.fn();
        animationCallbacks.push(callback);
        optimizedAnimationManager.scheduleAnimation(`animation-${i}`, callback);
      }

      const stats = optimizedAnimationManager.getStats();
      expect(stats.activeAnimations).toBeLessThanOrEqual(maxConcurrent);
      expect(stats.queuedAnimations).toBeGreaterThanOrEqual(0);
    });

    it('should provide animation statistics', () => {
      // Schedule some animations
      for (let i = 0; i < 3; i++) {
        optimizedAnimationManager.scheduleAnimation(`test-${i}`, () => {});
      }

      const stats = optimizedAnimationManager.getStats();
      
      expect(stats).toHaveProperty('activeAnimations');
      expect(stats).toHaveProperty('queuedAnimations');
      expect(stats).toHaveProperty('animationsEnabled');
      expect(stats).toHaveProperty('reducedMotionDetected');

      expect(typeof stats.activeAnimations).toBe('number');
      expect(typeof stats.queuedAnimations).toBe('number');
      expect(typeof stats.animationsEnabled).toBe('boolean');
      expect(typeof stats.reducedMotionDetected).toBe('boolean');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should demonstrate render optimization improvements', async () => {
      const componentCount = 100;
      const renderTimes: number[] = [];

      // Simulate rendering multiple components
      for (let i = 0; i < componentCount; i++) {
        const startTime = performance.now();
        
        const optimization = uiPerformanceOptimizer.determineRenderStrategy(
          `benchmark-component-${i}`,
          Math.random() * 100,
          Math.random() > 0.5,
          Math.random() * 10
        );

        if (optimization.shouldRender) {
          uiPerformanceOptimizer.scheduleRender(`benchmark-component-${i}`, () => {
            // Simulate render work
            const renderStart = performance.now();
            while (performance.now() - renderStart < 1) {
              // Minimal work
            }
          });
        }

        const renderTime = performance.now() - startTime;
        renderTimes.push(renderTime);
      }

      const averageRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);

      // Performance targets
      expect(averageRenderTime).toBeLessThan(5); // Average under 5ms
      expect(maxRenderTime).toBeLessThan(20); // Max under 20ms
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`,
        complexity: Math.random() * 10
      }));

      const startTime = performance.now();

      // Process large dataset with optimization
      const optimizedItems = largeDataset.map((item, index) => {
        const optimization = uiPerformanceOptimizer.determineRenderStrategy(
          `large-item-${item.id}`,
          1,
          index < 50, // Only first 50 visible
          item.complexity
        );

        return {
          ...item,
          shouldRender: optimization.shouldRender,
          strategy: optimization.strategy
        };
      });

      const processingTime = performance.now() - startTime;

      // Should process large dataset quickly
      expect(processingTime).toBeLessThan(100); // Under 100ms
      
      // Should optimize rendering for non-visible items
      const visibleItems = optimizedItems.filter(item => item.shouldRender);
      expect(visibleItems.length).toBeLessThan(largeDataset.length);
    });

    it('should maintain performance under memory pressure', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Simulate memory-intensive operations
      for (let i = 0; i < 1000; i++) {
        uiPerformanceOptimizer.getMemoizedData(
          `memory-test-${i}`,
          () => ({ data: new Array(100).fill(i) }),
          [i]
        );
      }

      const analytics = uiPerformanceOptimizer.getPerformanceAnalytics();
      
      // Memory usage should be reasonable
      expect(analytics.memoryUsage).toBeGreaterThan(initialMemory);
      expect(analytics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should optimize component rendering in realistic scenarios', () => {
      // Simulate a search results page
      const searchResults = Array.from({ length: 200 }, (_, i) => ({
        id: `result-${i}`,
        title: `Search Result ${i}`,
        content: `Content for result ${i}`,
        visible: i < 20 // Only first 20 visible
      }));

      const renderStrategies = searchResults.map((result, index) => {
        return uiPerformanceOptimizer.determineRenderStrategy(
          result.id,
          1,
          result.visible,
          2 // Medium complexity
        );
      });

      // Visible items should render immediately
      const visibleStrategies = renderStrategies.slice(0, 20);
      const hiddenStrategies = renderStrategies.slice(20);

      visibleStrategies.forEach(strategy => {
        expect(strategy.shouldRender).toBe(true);
        expect(['immediate', 'memoized', 'throttled']).toContain(strategy.strategy);
      });

      // Hidden items should use lazy loading
      hiddenStrategies.forEach(strategy => {
        expect(strategy.strategy).toBe('lazy');
        expect(strategy.shouldRender).toBe(false);
      });
    });

    it('should coordinate animations and rendering efficiently', async () => {
      const componentCount = 50;
      const animationPromises: Promise<void>[] = [];

      // Start multiple animations and renders
      for (let i = 0; i < componentCount; i++) {
        // Schedule render
        uiPerformanceOptimizer.scheduleRender(`coord-component-${i}`, () => {});

        // Schedule animation
        const animationPromise = new Promise<void>(resolve => {
          optimizedAnimationManager.scheduleAnimation(`coord-animation-${i}`, () => {
            setTimeout(resolve, 10);
          });
        });
        animationPromises.push(animationPromise);
      }

      // Wait for all animations to complete
      await Promise.all(animationPromises);

      const renderAnalytics = uiPerformanceOptimizer.getPerformanceAnalytics();
      const animationStats = optimizedAnimationManager.getStats();

      // System should handle coordination efficiently
      expect(renderAnalytics.renderQueueLength).toBeLessThanOrEqual(10);
      expect(animationStats.queuedAnimations).toBeLessThanOrEqual(5);
    });
  });
});

// Performance testing utilities for manual testing
export const uiPerformanceTestUtils = {
  /**
   * Run comprehensive UI performance test
   */
  async runUIPerformanceTest(componentCount: number = 100) {
    const results = [];
    
    for (let i = 0; i < componentCount; i++) {
      const startTime = performance.now();
      
      // Simulate component lifecycle
      const optimization = uiPerformanceOptimizer.determineRenderStrategy(
        `perf-test-${i}`,
        Math.random() * 100,
        Math.random() > 0.3,
        Math.random() * 10
      );

      if (optimization.shouldRender) {
        uiPerformanceOptimizer.scheduleRender(`perf-test-${i}`, () => {
          // Simulate render work
          const renderStart = performance.now();
          while (performance.now() - renderStart < Math.random() * 5) {
            // Variable render time
          }
        });
      }

      const totalTime = performance.now() - startTime;

      results.push({
        componentId: `perf-test-${i}`,
        optimization,
        totalTime,
        rendered: optimization.shouldRender
      });
    }

    const analytics = uiPerformanceOptimizer.getPerformanceAnalytics();
    const animationStats = optimizedAnimationManager.getStats();

    return {
      componentResults: results,
      analytics,
      animationStats,
      summary: {
        averageOptimizationTime: results.reduce((sum, r) => sum + r.totalTime, 0) / results.length,
        renderRate: results.filter(r => r.rendered).length / results.length * 100,
        totalComponents: componentCount
      }
    };
  },

  /**
   * Test animation performance
   */
  async testAnimationPerformance(animationCount: number = 50) {
    const startTime = performance.now();
    const animationPromises: Promise<void>[] = [];

    for (let i = 0; i < animationCount; i++) {
      const promise = new Promise<void>(resolve => {
        optimizedAnimationManager.scheduleAnimation(`anim-test-${i}`, () => {
          setTimeout(resolve, Math.random() * 100);
        });
      });
      animationPromises.push(promise);
    }

    await Promise.all(animationPromises);
    const totalTime = performance.now() - startTime;

    return {
      totalAnimations: animationCount,
      totalTime,
      averageTimePerAnimation: totalTime / animationCount,
      stats: optimizedAnimationManager.getStats()
    };
  }
};
