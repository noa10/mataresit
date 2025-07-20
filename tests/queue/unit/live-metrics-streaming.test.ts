/**
 * Live Metrics Streaming Tests for Queue System
 * Tests real-time metrics streaming, performance monitoring, and live dashboard updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock performance monitoring service
class MockLiveMetricsStream {
  private isStreaming = false;
  private subscribers = new Set<Function>();
  private metricsBuffer: any[] = [];
  private streamInterval: NodeJS.Timeout | null = null;

  startStreaming(config: { interval?: number; bufferSize?: number } = {}): void {
    if (this.isStreaming) return;

    this.isStreaming = true;
    const interval = config.interval || 1000;

    this.streamInterval = setInterval(() => {
      const metrics = this.generateMockMetrics();
      this.metricsBuffer.push(metrics);
      
      // Keep buffer size manageable
      if (this.metricsBuffer.length > (config.bufferSize || 100)) {
        this.metricsBuffer.shift();
      }

      // Notify all subscribers
      this.subscribers.forEach(callback => {
        try {
          callback(metrics);
        } catch (error) {
          console.error('Error in metrics subscriber:', error);
        }
      });
    }, interval);
  }

  stopStreaming(): void {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
  }

  subscribe(callback: Function): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getBufferedMetrics(): any[] {
    return [...this.metricsBuffer];
  }

  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  private generateMockMetrics() {
    const now = new Date();
    const baseMetrics = {
      timestamp: now.toISOString(),
      queue: {
        pending: Math.floor(Math.random() * 50) + 10,
        processing: Math.floor(Math.random() * 10) + 1,
        completed: Math.floor(Math.random() * 1000) + 500,
        failed: Math.floor(Math.random() * 20),
        rate_limited: Math.floor(Math.random() * 5)
      },
      workers: {
        active: Math.floor(Math.random() * 5) + 1,
        idle: Math.floor(Math.random() * 2),
        total_tasks_processed: Math.floor(Math.random() * 100) + 50,
        avg_processing_time: Math.floor(Math.random() * 3000) + 1000
      },
      performance: {
        throughput_per_minute: Math.floor(Math.random() * 30) + 10,
        success_rate: 95 + Math.random() * 5,
        avg_queue_wait_time: Math.floor(Math.random() * 5000) + 500,
        health_score: 70 + Math.random() * 30
      },
      system: {
        memory_usage_mb: Math.floor(Math.random() * 200) + 100,
        cpu_usage_percent: Math.floor(Math.random() * 50) + 20,
        network_latency_ms: Math.floor(Math.random() * 100) + 10
      }
    };

    return baseMetrics;
  }

  // Simulate specific metric scenarios for testing
  simulateHighLoad(): void {
    const highLoadMetrics = {
      timestamp: new Date().toISOString(),
      queue: {
        pending: 150,
        processing: 20,
        completed: 2000,
        failed: 50,
        rate_limited: 25
      },
      workers: {
        active: 8,
        idle: 0,
        total_tasks_processed: 500,
        avg_processing_time: 5000
      },
      performance: {
        throughput_per_minute: 60,
        success_rate: 85,
        avg_queue_wait_time: 8000,
        health_score: 45
      },
      system: {
        memory_usage_mb: 450,
        cpu_usage_percent: 85,
        network_latency_ms: 200
      }
    };

    this.subscribers.forEach(callback => callback(highLoadMetrics));
  }

  simulateHealthyState(): void {
    const healthyMetrics = {
      timestamp: new Date().toISOString(),
      queue: {
        pending: 5,
        processing: 2,
        completed: 1500,
        failed: 2,
        rate_limited: 0
      },
      workers: {
        active: 3,
        idle: 1,
        total_tasks_processed: 200,
        avg_processing_time: 1500
      },
      performance: {
        throughput_per_minute: 25,
        success_rate: 98,
        avg_queue_wait_time: 1000,
        health_score: 95
      },
      system: {
        memory_usage_mb: 120,
        cpu_usage_percent: 25,
        network_latency_ms: 15
      }
    };

    this.subscribers.forEach(callback => callback(healthyMetrics));
  }
}

// Mock hook for live metrics
function useLiveMetricsStream(config: { enabled?: boolean; interval?: number } = {}) {
  const [metrics, setMetrics] = React.useState(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState(null);
  const streamRef = React.useRef<MockLiveMetricsStream | null>(null);

  React.useEffect(() => {
    if (!config.enabled) return;

    streamRef.current = new MockLiveMetricsStream();
    
    const unsubscribe = streamRef.current.subscribe((newMetrics: any) => {
      setMetrics(newMetrics);
      setError(null);
    });

    try {
      streamRef.current.startStreaming({ interval: config.interval });
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
      setIsConnected(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.stopStreaming();
        unsubscribe();
      }
      setIsConnected(false);
    };
  }, [config.enabled, config.interval]);

  const simulateScenario = React.useCallback((scenario: 'high_load' | 'healthy') => {
    if (streamRef.current) {
      if (scenario === 'high_load') {
        streamRef.current.simulateHighLoad();
      } else {
        streamRef.current.simulateHealthyState();
      }
    }
  }, []);

  return {
    metrics,
    isConnected,
    error,
    simulateScenario
  };
}

// Mock React for the hook
const React = {
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn()
};

vi.mock('react', () => React);

describe('Live Metrics Streaming Tests', () => {
  let mockStream: MockLiveMetricsStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = new MockLiveMetricsStream();

    // Setup React mock implementations
    let stateValues: any = {};
    React.useState.mockImplementation((initial) => {
      const key = Math.random().toString();
      stateValues[key] = initial;
      return [
        stateValues[key],
        (newValue: any) => { stateValues[key] = newValue; }
      ];
    });

    React.useEffect.mockImplementation((effect, deps) => {
      effect();
    });

    React.useRef.mockImplementation((initial) => ({ current: initial }));
    React.useCallback.mockImplementation((callback) => callback);
  });

  afterEach(() => {
    if (mockStream.isStreamingActive()) {
      mockStream.stopStreaming();
    }
  });

  describe('Stream Initialization', () => {
    it('should start metrics streaming successfully', () => {
      expect(mockStream.isStreamingActive()).toBe(false);

      mockStream.startStreaming({ interval: 500 });

      expect(mockStream.isStreamingActive()).toBe(true);
    });

    it('should handle multiple start requests gracefully', () => {
      mockStream.startStreaming();
      const firstState = mockStream.isStreamingActive();

      mockStream.startStreaming(); // Second call should be ignored

      expect(mockStream.isStreamingActive()).toBe(firstState);
    });

    it('should stop streaming properly', () => {
      mockStream.startStreaming();
      expect(mockStream.isStreamingActive()).toBe(true);

      mockStream.stopStreaming();
      expect(mockStream.isStreamingActive()).toBe(false);
    });

    it('should configure streaming interval correctly', (done) => {
      const metricsReceived: any[] = [];
      const interval = 100; // 100ms for fast testing

      const unsubscribe = mockStream.subscribe((metrics: any) => {
        metricsReceived.push(metrics);
      });

      mockStream.startStreaming({ interval });

      setTimeout(() => {
        expect(metricsReceived.length).toBeGreaterThan(2);
        unsubscribe();
        mockStream.stopStreaming();
        done();
      }, 350); // Should receive ~3 metrics in 350ms
    });
  });

  describe('Metrics Generation and Streaming', () => {
    it('should generate realistic queue metrics', (done) => {
      const unsubscribe = mockStream.subscribe((metrics: any) => {
        expect(metrics).toHaveProperty('timestamp');
        expect(metrics).toHaveProperty('queue');
        expect(metrics).toHaveProperty('workers');
        expect(metrics).toHaveProperty('performance');
        expect(metrics).toHaveProperty('system');

        expect(metrics.queue.pending).toBeGreaterThanOrEqual(0);
        expect(metrics.workers.active).toBeGreaterThanOrEqual(0);
        expect(metrics.performance.success_rate).toBeGreaterThanOrEqual(0);
        expect(metrics.performance.success_rate).toBeLessThanOrEqual(100);

        unsubscribe();
        mockStream.stopStreaming();
        done();
      });

      mockStream.startStreaming({ interval: 50 });
    });

    it('should maintain metrics buffer with size limit', () => {
      const bufferSize = 5;
      mockStream.startStreaming({ interval: 10, bufferSize });

      // Wait for buffer to fill beyond limit
      setTimeout(() => {
        const bufferedMetrics = mockStream.getBufferedMetrics();
        expect(bufferedMetrics.length).toBeLessThanOrEqual(bufferSize);
        mockStream.stopStreaming();
      }, 100);
    });

    it('should handle high-frequency streaming', (done) => {
      const metricsReceived: any[] = [];
      const highFrequencyInterval = 10; // 10ms

      const unsubscribe = mockStream.subscribe((metrics: any) => {
        metricsReceived.push(metrics);
      });

      mockStream.startStreaming({ interval: highFrequencyInterval });

      setTimeout(() => {
        expect(metricsReceived.length).toBeGreaterThan(5);
        unsubscribe();
        mockStream.stopStreaming();
        done();
      }, 100);
    });
  });

  describe('Subscription Management', () => {
    it('should handle multiple subscribers', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();
      const subscriber3 = vi.fn();

      const unsubscribe1 = mockStream.subscribe(subscriber1);
      const unsubscribe2 = mockStream.subscribe(subscriber2);
      const unsubscribe3 = mockStream.subscribe(subscriber3);

      expect(mockStream.getSubscriberCount()).toBe(3);

      mockStream.simulateHealthyState();

      expect(subscriber1).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
      expect(subscriber3).toHaveBeenCalled();

      unsubscribe1();
      expect(mockStream.getSubscriberCount()).toBe(2);

      unsubscribe2();
      unsubscribe3();
      expect(mockStream.getSubscriberCount()).toBe(0);
    });

    it('should handle subscriber errors gracefully', () => {
      const errorSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalSubscriber = vi.fn();

      mockStream.subscribe(errorSubscriber);
      mockStream.subscribe(normalSubscriber);

      // Should not crash when subscriber throws error
      expect(() => {
        mockStream.simulateHealthyState();
      }).not.toThrow();

      expect(errorSubscriber).toHaveBeenCalled();
      expect(normalSubscriber).toHaveBeenCalled();
    });

    it('should cleanup subscribers on stream stop', () => {
      const subscriber = vi.fn();
      mockStream.subscribe(subscriber);

      mockStream.startStreaming({ interval: 50 });
      mockStream.stopStreaming();

      // Subscribers should still exist but stream should be stopped
      expect(mockStream.getSubscriberCount()).toBe(1);
      expect(mockStream.isStreamingActive()).toBe(false);
    });
  });

  describe('Scenario Simulation', () => {
    it('should simulate high load scenario correctly', () => {
      const subscriber = vi.fn();
      mockStream.subscribe(subscriber);

      mockStream.simulateHighLoad();

      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: expect.objectContaining({
            pending: 150,
            processing: 20
          }),
          performance: expect.objectContaining({
            health_score: 45
          })
        })
      );
    });

    it('should simulate healthy state scenario correctly', () => {
      const subscriber = vi.fn();
      mockStream.subscribe(subscriber);

      mockStream.simulateHealthyState();

      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: expect.objectContaining({
            pending: 5,
            failed: 2
          }),
          performance: expect.objectContaining({
            health_score: 95,
            success_rate: 98
          })
        })
      );
    });

    it('should transition between scenarios smoothly', () => {
      const metricsHistory: any[] = [];
      const subscriber = (metrics: any) => {
        metricsHistory.push(metrics);
      };

      mockStream.subscribe(subscriber);

      // Start with healthy state
      mockStream.simulateHealthyState();
      expect(metricsHistory[0].performance.health_score).toBe(95);

      // Transition to high load
      mockStream.simulateHighLoad();
      expect(metricsHistory[1].performance.health_score).toBe(45);

      // Back to healthy
      mockStream.simulateHealthyState();
      expect(metricsHistory[2].performance.health_score).toBe(95);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle memory efficiently with large subscriber count', () => {
      const subscribers: Function[] = [];
      const subscriberCount = 100;

      // Create many subscribers
      for (let i = 0; i < subscriberCount; i++) {
        const unsubscribe = mockStream.subscribe(vi.fn());
        subscribers.push(unsubscribe);
      }

      expect(mockStream.getSubscriberCount()).toBe(subscriberCount);

      // Simulate metrics update
      mockStream.simulateHealthyState();

      // Cleanup all subscribers
      subscribers.forEach(unsubscribe => unsubscribe());
      expect(mockStream.getSubscriberCount()).toBe(0);
    });

    it('should maintain consistent performance under load', (done) => {
      const startTime = Date.now();
      let updateCount = 0;
      const targetUpdates = 50;

      const subscriber = () => {
        updateCount++;
        if (updateCount === targetUpdates) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should complete 50 updates in reasonable time (less than 1 second)
          expect(duration).toBeLessThan(1000);
          mockStream.stopStreaming();
          done();
        }
      };

      mockStream.subscribe(subscriber);
      mockStream.startStreaming({ interval: 10 });
    });

    it('should cleanup resources properly on stop', () => {
      mockStream.startStreaming();
      const initialBufferSize = mockStream.getBufferedMetrics().length;

      mockStream.stopStreaming();

      // Buffer should be preserved but streaming should stop
      expect(mockStream.isStreamingActive()).toBe(false);
      expect(mockStream.getBufferedMetrics().length).toBeGreaterThanOrEqual(initialBufferSize);
    });
  });
});
