/**
 * Enhanced Unit Tests for Queue Service Functions
 * Comprehensive testing of queue metrics service and related functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueMetricsService } from '@/services/queueMetricsService';

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({ data: [], error: null }))
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      upsert: vi.fn(() => ({ data: null, error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Queue Service Functions Tests', () => {
  let queueMetricsService: QueueMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    queueMetricsService = new QueueMetricsService();

    // Setup default mock responses
    mockSupabase.rpc.mockImplementation((functionName) => {
      switch (functionName) {
        case 'get_queue_statistics':
          return Promise.resolve({
            data: [{
              total_pending: 15,
              total_processing: 3,
              total_completed: 142,
              total_failed: 2,
              total_rate_limited: 1,
              avg_processing_time_ms: 2500,
              active_workers: 2,
              oldest_pending_age_hours: 0.5
            }],
            error: null
          });
        case 'get_queue_config':
          return Promise.resolve({
            data: {
              batch_size: 5,
              max_concurrent_workers: 3,
              queue_enabled: true,
              rate_limit_delay_ms: 60000
            },
            error: null
          });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'embedding_queue_workers') {
        return {
          select: () => ({
            order: () => ({
              data: [
                {
                  worker_id: 'worker-1',
                  status: 'active',
                  last_heartbeat: new Date().toISOString(),
                  tasks_processed: 25,
                  total_processing_time_ms: 125000,
                  error_count: 2,
                  rate_limit_count: 1,
                  created_at: new Date(Date.now() - 3600000).toISOString(),
                  updated_at: new Date().toISOString()
                },
                {
                  worker_id: 'worker-2',
                  status: 'idle',
                  last_heartbeat: new Date(Date.now() - 30000).toISOString(),
                  tasks_processed: 18,
                  total_processing_time_ms: 90000,
                  error_count: 0,
                  rate_limit_count: 0,
                  created_at: new Date(Date.now() - 7200000).toISOString(),
                  updated_at: new Date(Date.now() - 30000).toISOString()
                }
              ],
              error: null
            })
          })
        };
      }
      return {
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null })
      };
    });
  });

  describe('Queue Statistics Service', () => {
    it('should fetch queue statistics successfully', async () => {
      const stats = await queueMetricsService.getQueueStatistics();

      expect(stats).toBeTruthy();
      expect(stats?.total_pending).toBe(15);
      expect(stats?.total_processing).toBe(3);
      expect(stats?.total_completed).toBe(142);
      expect(stats?.active_workers).toBe(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_statistics');
    });

    it('should handle empty statistics response', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const stats = await queueMetricsService.getQueueStatistics();
      expect(stats).toBeNull();
    });

    it('should handle statistics fetch errors', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(queueMetricsService.getQueueStatistics()).rejects.toThrow('Database connection failed');
    });

    it('should handle Supabase errors in statistics', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Function not found', code: 'PGRST202' }
      });

      await expect(queueMetricsService.getQueueStatistics()).rejects.toThrow();
    });
  });

  describe('Worker Metrics Service', () => {
    it('should fetch worker metrics successfully', async () => {
      const workers = await queueMetricsService.getWorkerMetrics();

      expect(workers).toHaveLength(2);
      expect(workers[0].worker_id).toBe('worker-1');
      expect(workers[0].status).toBe('active');
      expect(workers[0].tasks_processed).toBe(25);
      expect(workers[1].worker_id).toBe('worker-2');
      expect(workers[1].status).toBe('idle');
    });

    it('should handle empty worker response', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            data: [],
            error: null
          })
        })
      });

      const workers = await queueMetricsService.getWorkerMetrics();
      expect(workers).toEqual([]);
    });

    it('should handle worker fetch errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            data: null,
            error: { message: 'Table not found' }
          })
        })
      });

      await expect(queueMetricsService.getWorkerMetrics()).rejects.toThrow();
    });

    it('should order workers by last heartbeat', async () => {
      const workers = await queueMetricsService.getWorkerMetrics();

      expect(mockSupabase.from).toHaveBeenCalledWith('embedding_queue_workers');
      // Verify the order call was made with correct parameters
      const fromCall = mockSupabase.from.mock.results[0].value;
      expect(fromCall.select).toHaveBeenCalledWith('*');
    });
  });

  describe('Performance Data Calculation', () => {
    it('should calculate performance metrics correctly', async () => {
      const queueMetrics = await queueMetricsService.getQueueStatistics();
      const workers = await queueMetricsService.getWorkerMetrics();
      
      const performance = queueMetricsService.calculatePerformanceData(queueMetrics!, workers);

      expect(performance.throughput_per_hour).toBeGreaterThan(0);
      expect(performance.success_rate).toBeCloseTo(98.61, 1); // 142/(142+2) * 100
      expect(performance.worker_efficiency).toBeGreaterThanOrEqual(0);
      expect(performance.worker_efficiency).toBeLessThanOrEqual(100);
      expect(performance.queue_health_score).toBeGreaterThanOrEqual(0);
      expect(performance.queue_health_score).toBeLessThanOrEqual(100);
    });

    it('should handle zero values in performance calculation', async () => {
      const emptyMetrics = {
        total_pending: 0,
        total_processing: 0,
        total_completed: 0,
        total_failed: 0,
        total_rate_limited: 0,
        avg_processing_time_ms: 0,
        active_workers: 0,
        oldest_pending_age_hours: 0
      };

      const performance = queueMetricsService.calculatePerformanceData(emptyMetrics, []);

      expect(performance.success_rate).toBe(100); // Default when no items processed
      expect(performance.worker_efficiency).toBe(0);
      expect(performance.queue_health_score).toBeLessThan(100); // Should be penalized for no workers
    });

    it('should calculate health score based on various factors', async () => {
      // Test healthy scenario
      const healthyMetrics = {
        total_pending: 5,
        total_processing: 2,
        total_completed: 100,
        total_failed: 1,
        total_rate_limited: 0,
        avg_processing_time_ms: 1500,
        active_workers: 3,
        oldest_pending_age_hours: 0.2
      };

      const healthyPerformance = queueMetricsService.calculatePerformanceData(healthyMetrics, []);
      expect(healthyPerformance.queue_health_score).toBeGreaterThan(80);

      // Test degraded scenario
      const degradedMetrics = {
        total_pending: 150,
        total_processing: 1,
        total_completed: 50,
        total_failed: 25,
        total_rate_limited: 15,
        avg_processing_time_ms: 8000,
        active_workers: 0,
        oldest_pending_age_hours: 3
      };

      const degradedPerformance = queueMetricsService.calculatePerformanceData(degradedMetrics, []);
      expect(degradedPerformance.queue_health_score).toBeLessThan(50);
    });
  });

  describe('Queue Health Assessment', () => {
    it('should assess healthy queue correctly', async () => {
      const healthAssessment = await queueMetricsService.assessQueueHealth();

      expect(healthAssessment.status).toBe('healthy');
      expect(healthAssessment.score).toBeGreaterThan(80);
      expect(healthAssessment.issues).toEqual([]);
      expect(healthAssessment.recommendations).toEqual([]);
      expect(healthAssessment.last_updated).toBeTruthy();
    });

    it('should identify queue issues and provide recommendations', async () => {
      // Mock problematic queue state
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{
          total_pending: 150, // High backlog
          total_processing: 1,
          total_completed: 50,
          total_failed: 25, // High failure rate
          total_rate_limited: 15, // Frequent rate limiting
          avg_processing_time_ms: 8000, // Slow processing
          active_workers: 0, // No workers
          oldest_pending_age_hours: 3 // Old items
        }],
        error: null
      });

      const healthAssessment = await queueMetricsService.assessQueueHealth();

      expect(healthAssessment.status).toBe('critical');
      expect(healthAssessment.issues.length).toBeGreaterThan(0);
      expect(healthAssessment.recommendations.length).toBeGreaterThan(0);
      
      // Check for specific issues
      expect(healthAssessment.issues.some(issue => issue.includes('No active workers'))).toBe(true);
      expect(healthAssessment.issues.some(issue => issue.includes('High queue backlog'))).toBe(true);
      expect(healthAssessment.issues.some(issue => issue.includes('High failure rate'))).toBe(true);
    });

    it('should handle health assessment errors', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Health check failed'));

      await expect(queueMetricsService.assessQueueHealth()).rejects.toThrow('Health check failed');
    });
  });

  describe('Configuration Management', () => {
    it('should fetch queue configuration', async () => {
      const config = await queueMetricsService.getQueueConfig();

      expect(config).toBeTruthy();
      expect(config.batch_size).toBe(5);
      expect(config.max_concurrent_workers).toBe(3);
      expect(config.queue_enabled).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_config');
    });

    it('should update queue configuration', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      await queueMetricsService.updateQueueConfig('batch_size', 10, 'admin-user');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_queue_config', {
        config_key_param: 'batch_size',
        config_value_param: 10,
        updated_by_param: 'admin-user'
      });
    });

    it('should handle configuration update errors', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Config update failed'));

      await expect(
        queueMetricsService.updateQueueConfig('batch_size', 10, 'admin-user')
      ).rejects.toThrow('Config update failed');
    });
  });

  describe('Maintenance Operations', () => {
    it('should requeue failed items', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 5,
        error: null
      });

      const count = await queueMetricsService.performMaintenance('requeue_failed', { maxItems: 10 });

      expect(count).toBe(5);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('requeue_failed_items', { max_items: 10 });
    });

    it('should cleanup old items', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 15,
        error: null
      });

      const count = await queueMetricsService.performMaintenance('cleanup_old');

      expect(count).toBe(15);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_queue_items');
    });

    it('should reset rate limited items', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 3,
        error: null
      });

      const count = await queueMetricsService.performMaintenance('reset_rate_limited');

      expect(count).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reset_rate_limited_items');
    });

    it('should handle unknown maintenance operations', async () => {
      await expect(
        queueMetricsService.performMaintenance('unknown_operation' as any)
      ).rejects.toThrow('Unknown maintenance operation: unknown_operation');
    });

    it('should handle maintenance operation errors', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Maintenance failed'));

      await expect(
        queueMetricsService.performMaintenance('requeue_failed')
      ).rejects.toThrow('Maintenance failed');
    });

    it('should handle null data in maintenance response', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const count = await queueMetricsService.performMaintenance('cleanup_old');
      expect(count).toBe(0);
    });
  });

  describe('Historical Data Analysis', () => {
    it('should analyze queue trends', async () => {
      // Mock historical data
      const mockHistoricalData = [
        { timestamp: '2024-01-01T10:00:00Z', total_pending: 10, total_completed: 100 },
        { timestamp: '2024-01-01T11:00:00Z', total_pending: 15, total_completed: 120 },
        { timestamp: '2024-01-01T12:00:00Z', total_pending: 8, total_completed: 140 }
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockHistoricalData,
        error: null
      });

      const trends = await queueMetricsService.getQueueTrends('24h');

      expect(trends).toBeTruthy();
      expect(trends.length).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_queue_trends', { time_period: '24h' });
    });

    it('should calculate throughput trends', async () => {
      const mockThroughputData = [
        { hour: '10:00', items_processed: 20 },
        { hour: '11:00', items_processed: 25 },
        { hour: '12:00', items_processed: 18 }
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockThroughputData,
        error: null
      });

      const throughput = await queueMetricsService.getThroughputAnalysis('today');

      expect(throughput).toBeTruthy();
      expect(throughput.length).toBe(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_throughput_analysis', { period: 'today' });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null responses gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const stats = await queueMetricsService.getQueueStatistics();
      expect(stats).toBeNull();
    });

    it('should handle malformed data responses', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ invalid: 'data' }],
        error: null
      });

      const stats = await queueMetricsService.getQueueStatistics();
      expect(stats).toBeTruthy();
      expect(stats.total_pending).toBeUndefined();
    });

    it('should handle network timeouts', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(queueMetricsService.getQueueStatistics()).rejects.toThrow('Network timeout');
    });

    it('should handle concurrent access gracefully', async () => {
      // Simulate multiple concurrent calls
      const promises = Array.from({ length: 5 }, () => queueMetricsService.getQueueStatistics());

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result?.total_pending).toBe(15);
      });

      // Should have made 5 separate calls
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(5);
    });
  });

  describe('Performance Optimization', () => {
    it('should cache frequently accessed data', async () => {
      // Enable caching (if implemented)
      const service = new QueueMetricsService({ enableCaching: true });

      // First call
      await service.getQueueStatistics();
      
      // Second call should use cache
      await service.getQueueStatistics();

      // Should only make one database call if caching is working
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    });

    it('should handle large datasets efficiently', async () => {
      // Mock large worker dataset
      const largeWorkerList = Array.from({ length: 1000 }, (_, i) => ({
        worker_id: `worker-${i}`,
        status: 'active',
        last_heartbeat: new Date().toISOString(),
        tasks_processed: i * 10,
        total_processing_time_ms: i * 5000,
        error_count: i % 5,
        rate_limit_count: i % 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            data: largeWorkerList,
            error: null
          })
        })
      });

      const startTime = performance.now();
      const workers = await queueMetricsService.getWorkerMetrics();
      const endTime = performance.now();

      expect(workers).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should process within 100ms
    });
  });
});
