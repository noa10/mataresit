/**
 * Monitoring Dashboard Performance Tests
 * 
 * This test suite benchmarks monitoring dashboard performance including
 * load times, real-time update latency, and metrics accuracy.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestEmbeddingMetrics } from '../fixtures/test-data';
import { TARGET_METRICS, PERFORMANCE_THRESHOLDS, validatePerformanceThresholds, calculateImprovement, BASELINE_METRICS } from './performance-baseline';

describe('Monitoring Dashboard Performance Tests', () => {
  setupTestSuite('Monitoring Dashboard Performance');
  setupTest();

  let testUser: any;
  let testTeam: any;

  beforeAll(async () => {
    const { user } = await createTestUser('dashboard-perf-test@example.com');
    const team = await createTestTeam(user.id, 'Dashboard Performance Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent performance testing
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
  });

  describe('Dashboard Load Performance', () => {
    it('should meet dashboard load time targets', async () => {
      const testState = getTestState();
      
      // Generate substantial test data to simulate real dashboard load
      await testState.utilities.generateTestMetrics(2000);

      // Test dashboard load performance multiple times
      const loadTests = 10;
      const loadTimes: number[] = [];

      for (let i = 0; i < loadTests; i++) {
        const loadStartTime = performance.now();
        
        // Simulate dashboard data loading
        const dashboardData = await testState.utilities.loadDashboardData();
        
        const loadEndTime = performance.now();
        const loadTime = loadEndTime - loadStartTime;
        loadTimes.push(loadTime);

        // Validate data completeness
        expect(dashboardData.metrics.length).toBeGreaterThan(1000);
        expect(dashboardData.aggregatedStats).toBeDefined();
        expect(dashboardData.queueStatus).toBeDefined();

        console.log(`Load test ${i + 1}: ${loadTime.toFixed(0)}ms`);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Calculate load performance metrics
      const avgLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
      const p95LoadTime = loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length * 0.95)];
      const maxLoadTime = Math.max(...loadTimes);
      const minLoadTime = Math.min(...loadTimes);

      const performanceMetrics = {
        dashboardLoadTime: avgLoadTime,
        p95LoadTime,
        maxLoadTime,
        minLoadTime,
        loadTimeVariability: (maxLoadTime - minLoadTime) / avgLoadTime
      };

      // Assert performance targets
      expect(avgLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.monitoring.maxDashboardLoadTime);
      expect(p95LoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.monitoring.maxDashboardLoadTime * 1.2);

      // Calculate improvement over baseline
      const loadTimeImprovement = calculateImprovement(BASELINE_METRICS.monitoring.dashboardLoadTime, avgLoadTime);

      console.log(`\n📊 Dashboard Load Performance:`);
      console.log(`Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
      console.log(`P95 Load Time: ${p95LoadTime.toFixed(0)}ms`);
      console.log(`Load Time Range: ${minLoadTime.toFixed(0)}ms - ${maxLoadTime.toFixed(0)}ms`);
      console.log(`Load Time Improvement: ${loadTimeImprovement.toFixed(1)}%`);
      console.log(`Load Time Variability: ${(performanceMetrics.loadTimeVariability * 100).toFixed(1)}%`);
    }, 60000);

    it('should maintain performance with large datasets', async () => {
      const testState = getTestState();
      
      // Test dashboard performance with increasing data sizes
      const dataSizes = [1000, 5000, 10000, 20000];
      const dataScaleResults: any[] = [];

      for (const dataSize of dataSizes) {
        console.log(`\nTesting dashboard with ${dataSize} metrics`);
        
        // Generate test data of specific size
        await testState.utilities.generateTestMetrics(dataSize);

        // Measure load time with this data size
        const loadStartTime = performance.now();
        const dashboardData = await testState.utilities.loadDashboardData();
        const loadEndTime = performance.now();
        const loadTime = loadEndTime - loadStartTime;

        dataScaleResults.push({
          dataSize,
          loadTime,
          metricsReturned: dashboardData.metrics.length
        });

        console.log(`${dataSize} metrics: ${loadTime.toFixed(0)}ms load time`);

        // Clean up test data for next iteration
        await testState.utilities.cleanup();
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze scaling performance
      const baselineResult = dataScaleResults[0]; // 1000 metrics
      const largestResult = dataScaleResults[dataScaleResults.length - 1]; // 20000 metrics

      // Load time should scale reasonably (not linearly)
      const scalingFactor = largestResult.dataSize / baselineResult.dataSize; // 20x data
      const loadTimeIncrease = largestResult.loadTime / baselineResult.loadTime;
      
      // Load time should not increase more than 3x for 20x data (sub-linear scaling)
      expect(loadTimeIncrease).toBeLessThan(3);
      
      // Even with large datasets, should meet performance targets
      expect(largestResult.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.monitoring.maxDashboardLoadTime * 1.5);

      console.log(`\n📈 Dashboard Scaling Performance:`);
      dataScaleResults.forEach(result => {
        console.log(`${result.dataSize} metrics: ${result.loadTime.toFixed(0)}ms`);
      });
      console.log(`Scaling factor: ${scalingFactor}x data, ${loadTimeIncrease.toFixed(1)}x load time`);
    }, 120000);
  });

  describe('Real-time Update Performance', () => {
    it('should meet real-time update latency targets', async () => {
      const testState = getTestState();
      
      // Start workers to generate real activity
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Track real-time update latencies
      const updateLatencies: number[] = [];
      const updateCount = 20;

      for (let i = 0; i < updateCount; i++) {
        // Trigger an embedding event
        const updateStartTime = performance.now();
        await testState.utilities.triggerEmbeddingEvent();
        
        // Measure time to reflect in monitoring
        await waitForCondition(
          async () => {
            const metrics = await testState.utilities.getEmbeddingMetrics();
            return metrics.totalAttempts > i; // New event reflected
          },
          5000, // 5 second timeout per update
          100
        );
        
        const updateEndTime = performance.now();
        const updateLatency = updateEndTime - updateStartTime;
        updateLatencies.push(updateLatency);

        console.log(`Update ${i + 1}: ${updateLatency.toFixed(0)}ms latency`);

        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Calculate real-time update metrics
      const avgUpdateLatency = updateLatencies.reduce((sum, latency) => sum + latency, 0) / updateLatencies.length;
      const p95UpdateLatency = updateLatencies.sort((a, b) => a - b)[Math.floor(updateLatencies.length * 0.95)];
      const maxUpdateLatency = Math.max(...updateLatencies);

      // Assert real-time performance targets
      expect(avgUpdateLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.monitoring.maxRealTimeLatency);
      expect(p95UpdateLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.monitoring.maxRealTimeLatency * 1.2);

      // Calculate improvement over baseline
      const latencyImprovement = calculateImprovement(BASELINE_METRICS.monitoring.realTimeLatency, avgUpdateLatency);

      console.log(`\n⚡ Real-time Update Performance:`);
      console.log(`Average Update Latency: ${avgUpdateLatency.toFixed(0)}ms`);
      console.log(`P95 Update Latency: ${p95UpdateLatency.toFixed(0)}ms`);
      console.log(`Max Update Latency: ${maxUpdateLatency.toFixed(0)}ms`);
      console.log(`Update Latency Improvement: ${latencyImprovement.toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 120000);

    it('should maintain update frequency under load', async () => {
      const testState = getTestState();
      
      // Start workers to create continuous activity
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate continuous load
      const loadItems = 50;
      const testReceipts = Array.from({ length: loadItems }, (_, i) => ({
        id: `load-test-${i}`,
        fileName: `load-test-${i}.jpg`
      }));

      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start continuous processing
      await testState.utilities.addToQueue(queueItems);

      // Monitor update frequency during load
      const updateFrequencySnapshots: any[] = [];
      let lastMetricsCount = 0;

      const frequencyMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          const currentCount = metrics.totalAttempts;
          const newUpdates = currentCount - lastMetricsCount;
          
          updateFrequencySnapshots.push({
            timestamp: Date.now(),
            totalMetrics: currentCount,
            newUpdates,
            updatesPerSecond: newUpdates / 3 // 3-second intervals
          });
          
          lastMetricsCount = currentCount;
          
          if (metrics.completedFiles + metrics.failedAttempts >= loadItems) {
            clearInterval(frequencyMonitor);
          }
        } catch (error) {
          console.warn('Update frequency monitoring error:', error);
        }
      }, 3000); // 3-second intervals

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= loadItems;
        },
        180000, // 3 minutes
        5000
      );

      clearInterval(frequencyMonitor);

      // Analyze update frequency
      const avgUpdatesPerSecond = updateFrequencySnapshots.reduce((sum, s) => sum + s.updatesPerSecond, 0) / updateFrequencySnapshots.length;
      const maxUpdatesPerSecond = Math.max(...updateFrequencySnapshots.map(s => s.updatesPerSecond));
      const updateFrequencyVariability = updateFrequencySnapshots.reduce((sum, s) => sum + Math.abs(s.updatesPerSecond - avgUpdatesPerSecond), 0) / updateFrequencySnapshots.length;

      // Update frequency should be consistent and reasonable
      expect(avgUpdatesPerSecond).toBeGreaterThan(1); // At least 1 update per second under load
      expect(updateFrequencyVariability).toBeLessThan(avgUpdatesPerSecond * 0.5); // Low variability

      console.log(`\n📊 Update Frequency Under Load:`);
      console.log(`Average Updates/Second: ${avgUpdatesPerSecond.toFixed(1)}`);
      console.log(`Max Updates/Second: ${maxUpdatesPerSecond.toFixed(1)}`);
      console.log(`Update Frequency Variability: ${updateFrequencyVariability.toFixed(1)}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);
  });

  describe('Metrics Accuracy Performance', () => {
    it('should maintain high metrics accuracy', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate known test data for accuracy testing
      const testItemCount = 30;
      const testReceipts = Array.from({ length: testItemCount }, (_, i) => ({
        id: `accuracy-test-${i}`,
        fileName: `accuracy-test-${i}.jpg`
      }));

      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Process items and track accuracy
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= testItemCount;
        },
        120000, // 2 minutes
        3000
      );

      // Validate metrics accuracy
      const monitoringMetrics = await testState.utilities.getEmbeddingMetrics();
      
      // Get actual data from database
      const actualQueueRecords = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .in('source_id', testReceipts.map(r => r.id));

      const actualEmbeddingRecords = await testState.supabase
        .from('embeddings')
        .select('*')
        .in('receipt_id', testReceipts.map(r => r.id));

      // Calculate accuracy metrics
      const actualCompletedCount = actualQueueRecords.data?.filter(q => q.status === 'completed').length || 0;
      const actualFailedCount = actualQueueRecords.data?.filter(q => q.status === 'failed').length || 0;
      const actualEmbeddingCount = actualEmbeddingRecords.data?.length || 0;

      const completedAccuracy = Math.abs(monitoringMetrics.successfulAttempts - actualCompletedCount) / actualCompletedCount;
      const failedAccuracy = actualFailedCount > 0 ? Math.abs(monitoringMetrics.failedAttempts - actualFailedCount) / actualFailedCount : 0;
      const embeddingAccuracy = Math.abs(monitoringMetrics.successfulAttempts - actualEmbeddingCount) / actualEmbeddingCount;

      const overallAccuracy = 1 - ((completedAccuracy + failedAccuracy + embeddingAccuracy) / 3);

      // Assert accuracy targets
      expect(overallAccuracy).toBeGreaterThan(PERFORMANCE_THRESHOLDS.monitoring.minMetricsAccuracy);
      expect(completedAccuracy).toBeLessThan(0.05); // 5% error tolerance
      expect(embeddingAccuracy).toBeLessThan(0.05); // 5% error tolerance

      console.log(`\n🎯 Metrics Accuracy Performance:`);
      console.log(`Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
      console.log(`Completed Count Accuracy: ${((1 - completedAccuracy) * 100).toFixed(1)}%`);
      console.log(`Embedding Count Accuracy: ${((1 - embeddingAccuracy) * 100).toFixed(1)}%`);
      console.log(`Monitoring: ${monitoringMetrics.successfulAttempts} completed, Actual: ${actualCompletedCount} completed`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 140000);

    it('should handle concurrent metric updates correctly', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate concurrent metric updates
      const concurrentBatches = 5;
      const itemsPerBatch = 10;
      const totalItems = concurrentBatches * itemsPerBatch;

      // Create concurrent processing batches
      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const batchReceipts = Array.from({ length: itemsPerBatch }, (_, i) => ({
          id: `concurrent-${batchIndex}-${i}`,
          fileName: `concurrent-${batchIndex}-${i}.jpg`
        }));

        const batchQueueItems = batchReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: receipt.id,
          operation: 'INSERT',
          priority: 'medium'
        }));

        // Add batch to queue with small delay
        await new Promise(resolve => setTimeout(resolve, batchIndex * 1000));
        await testState.utilities.addToQueue(batchQueueItems);
      });

      // Start all concurrent batches
      await Promise.all(batchPromises);

      // Wait for all processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= totalItems;
        },
        180000, // 3 minutes
        5000
      );

      // Validate concurrent update handling
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      
      // Should have processed all items
      expect(finalMetrics.totalAttempts).toBe(totalItems);
      
      // Success rate should be reasonable despite concurrency
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);

      console.log(`\n🔄 Concurrent Metrics Performance:`);
      console.log(`Total Items Processed: ${finalMetrics.totalAttempts}`);
      console.log(`Success Rate: ${((finalMetrics.successfulAttempts / finalMetrics.totalAttempts) * 100).toFixed(1)}%`);
      console.log(`Concurrent Batches: ${concurrentBatches}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);
  });
});
