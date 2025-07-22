/**
 * Queue System Performance Tests
 * 
 * This test suite benchmarks queue system performance including
 * throughput, worker efficiency, and latency metrics.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestReceiptData } from '../fixtures/test-data';
import { TARGET_METRICS, PERFORMANCE_THRESHOLDS, validatePerformanceThresholds, calculateImprovement, BASELINE_METRICS } from './performance-baseline';

describe('Queue System Performance Tests', () => {
  setupTestSuite('Queue System Performance');
  setupTest();

  let testUser: any;
  let testTeam: any;

  beforeAll(async () => {
    const { user } = await createTestUser('queue-perf-test@example.com');
    const team = await createTestTeam(user.id, 'Queue Performance Team');
    
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

  describe('Queue Throughput Performance', () => {
    it('should meet queue throughput targets', async () => {
      const testState = getTestState();
      
      // Start optimal number of workers for throughput testing
      const workerIds = await testState.utilities.startQueueWorkers(6);

      // Generate large number of items for throughput testing
      const itemCount = 100;
      const testReceipts = generateTestReceiptData(itemCount);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Track throughput metrics
      const throughputSnapshots: any[] = [];
      let lastCompletedCount = 0;

      const throughputMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          const queueStatus = await testState.utilities.getQueueStatus();
          const currentCompleted = metrics.completedFiles;
          const itemsProcessedSinceLastCheck = currentCompleted - lastCompletedCount;
          
          throughputSnapshots.push({
            timestamp: Date.now(),
            completedFiles: currentCompleted,
            pendingItems: queueStatus.pendingItems,
            activeWorkers: queueStatus.activeWorkers,
            itemsProcessedSinceLastCheck,
            throughputPerMinute: itemsProcessedSinceLastCheck * 12 // 5-second intervals * 12 = per minute
          });
          
          lastCompletedCount = currentCompleted;
          
          if (currentCompleted + metrics.failedAttempts >= itemCount) {
            clearInterval(throughputMonitor);
          }
        } catch (error) {
          console.warn('Throughput monitoring error:', error);
        }
      }, 5000); // 5-second intervals

      const startTime = performance.now();
      
      // Add all items to queue
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= itemCount;
        },
        300000, // 5 minutes timeout
        5000
      );

      clearInterval(throughputMonitor);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Calculate throughput metrics
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      const overallThroughput = (finalMetrics.successfulAttempts / (totalTime / 1000)) * 60; // items per minute
      const successRate = finalMetrics.successfulAttempts / finalMetrics.totalAttempts;
      const averageProcessingTime = totalTime / itemCount;

      // Calculate peak throughput from snapshots
      const peakThroughput = Math.max(...throughputSnapshots.map(s => s.throughputPerMinute));
      const avgThroughput = throughputSnapshots.reduce((sum, s) => sum + s.throughputPerMinute, 0) / throughputSnapshots.length;

      const performanceMetrics = {
        throughput: overallThroughput,
        peakThroughput,
        avgThroughput,
        successRate,
        averageProcessingTime,
        errorRate: 1 - successRate
      };

      // Validate against performance thresholds
      const validation = validatePerformanceThresholds('queueSystem', {
        ...performanceMetrics,
        workerEfficiency: 0.85, // Calculated separately
        queueLatency: 1000, // Calculated separately
        averageRetryCount: 0.5 // Calculated separately
      });

      // Assert performance targets
      expect(overallThroughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.queueSystem.minThroughput);
      expect(successRate).toBeGreaterThan(0.95);

      // Calculate improvements over baseline
      const throughputImprovement = calculateImprovement(BASELINE_METRICS.queueSystem.throughput, overallThroughput, true);
      const processingImprovement = calculateImprovement(BASELINE_METRICS.queueSystem.averageProcessingTime, averageProcessingTime);

      console.log(`\n📈 Queue Throughput Performance:`);
      console.log(`Overall Throughput: ${overallThroughput.toFixed(1)} items/min`);
      console.log(`Peak Throughput: ${peakThroughput.toFixed(1)} items/min`);
      console.log(`Average Throughput: ${avgThroughput.toFixed(1)} items/min`);
      console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`Throughput Improvement: ${throughputImprovement.toFixed(1)}%`);
      console.log(`Processing Time Improvement: ${processingImprovement.toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000); // 5+ minutes timeout

    it('should scale worker efficiency effectively', async () => {
      const testState = getTestState();
      
      // Test different worker counts
      const workerCounts = [2, 4, 6, 8];
      const workerEfficiencyResults: any[] = [];

      for (const workerCount of workerCounts) {
        console.log(`\nTesting worker efficiency with ${workerCount} workers`);
        
        // Start specific number of workers
        const workerIds = await testState.utilities.startQueueWorkers(workerCount);

        // Generate test data
        const itemCount = 40;
        const testReceipts = generateTestReceiptData(itemCount);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-workers-${workerCount}`,
          operation: 'INSERT',
          priority: 'medium'
        }));

        const startTime = performance.now();
        
        // Process items
        await testState.utilities.addToQueue(queueItems);

        // Wait for completion
        await waitForCondition(
          async () => {
            const metrics = await testState.utilities.getEmbeddingMetrics();
            return metrics.completedFiles + metrics.failedAttempts >= itemCount;
          },
          120000, // 2 minutes per worker test
          3000
        );

        const endTime = performance.now();
        const processingTime = endTime - startTime;
        const finalMetrics = await testState.utilities.getEmbeddingMetrics();

        // Calculate worker efficiency
        const actualThroughput = (finalMetrics.successfulAttempts / (processingTime / 1000)) * 60;
        const theoreticalMaxThroughput = workerCount * 15; // Assume 15 items/min per worker max
        const workerEfficiency = actualThroughput / theoreticalMaxThroughput;

        workerEfficiencyResults.push({
          workerCount,
          processingTime,
          throughput: actualThroughput,
          workerEfficiency,
          successRate: finalMetrics.successfulAttempts / finalMetrics.totalAttempts
        });

        console.log(`${workerCount} workers: ${actualThroughput.toFixed(1)} items/min, ${(workerEfficiency * 100).toFixed(1)}% efficiency`);

        // Cleanup workers
        await testState.utilities.stopQueueWorkers(workerIds);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Analyze worker scaling efficiency
      const bestEfficiency = Math.max(...workerEfficiencyResults.map(r => r.workerEfficiency));
      const optimalWorkerCount = workerEfficiencyResults.find(r => r.workerEfficiency === bestEfficiency)?.workerCount;

      // Worker efficiency should be reasonable
      expect(bestEfficiency).toBeGreaterThan(PERFORMANCE_THRESHOLDS.queueSystem.minWorkerEfficiency);

      // Throughput should scale with worker count (diminishing returns expected)
      const twoWorkerThroughput = workerEfficiencyResults.find(r => r.workerCount === 2)?.throughput || 0;
      const eightWorkerThroughput = workerEfficiencyResults.find(r => r.workerCount === 8)?.throughput || 0;
      expect(eightWorkerThroughput).toBeGreaterThan(twoWorkerThroughput * 2); // At least 2x improvement

      console.log(`\n📊 Worker Efficiency Analysis:`);
      workerEfficiencyResults.forEach(result => {
        console.log(`${result.workerCount} workers: ${result.throughput.toFixed(1)} items/min, ${(result.workerEfficiency * 100).toFixed(1)}% efficiency`);
      });
      console.log(`Optimal worker count: ${optimalWorkerCount} with ${(bestEfficiency * 100).toFixed(1)}% efficiency`);
    }, 600000); // 10 minutes timeout for all worker tests
  });

  describe('Queue Latency Performance', () => {
    it('should minimize queue latency', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Test queue latency with staggered item addition
      const latencyMeasurements: any[] = [];
      const itemCount = 20;

      for (let i = 0; i < itemCount; i++) {
        const receipt = generateTestReceiptData(1)[0];
        const queueItem = {
          source_type: 'receipts',
          source_id: `${receipt.id}-latency-${i}`,
          operation: 'INSERT',
          priority: 'medium'
        };

        const queueStartTime = performance.now();
        
        // Add single item to queue
        await testState.utilities.addToQueue([queueItem]);

        // Wait for item to start processing (not complete)
        await waitForCondition(
          async () => {
            const queueStatus = await testState.utilities.getQueueStatus();
            return queueStatus.pendingItems < (itemCount - i); // Item picked up by worker
          },
          10000, // 10 seconds timeout
          500
        );

        const queueEndTime = performance.now();
        const queueLatency = queueEndTime - queueStartTime;
        
        latencyMeasurements.push({
          itemIndex: i,
          queueLatency
        });

        console.log(`Item ${i + 1}: ${queueLatency.toFixed(0)}ms queue latency`);

        // Small delay between items
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Wait for all processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= itemCount;
        },
        120000, // 2 minutes
        3000
      );

      // Analyze queue latency
      const avgLatency = latencyMeasurements.reduce((sum, m) => sum + m.queueLatency, 0) / latencyMeasurements.length;
      const maxLatency = Math.max(...latencyMeasurements.map(m => m.queueLatency));
      const p95Latency = latencyMeasurements.sort((a, b) => a.queueLatency - b.queueLatency)[Math.floor(latencyMeasurements.length * 0.95)].queueLatency;

      // Assert latency targets
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.queueSystem.maxQueueLatency);
      expect(p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.queueSystem.maxQueueLatency * 1.5);

      console.log(`\n⚡ Queue Latency Performance:`);
      console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
      console.log(`P95 Latency: ${p95Latency.toFixed(0)}ms`);
      console.log(`Max Latency: ${maxLatency.toFixed(0)}ms`);

      // Calculate improvement over baseline
      const latencyImprovement = calculateImprovement(BASELINE_METRICS.queueSystem.queueLatency, avgLatency);
      console.log(`Latency Improvement: ${latencyImprovement.toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 180000); // 3 minutes timeout

    it('should handle queue overflow gracefully', async () => {
      const testState = getTestState();
      
      // Start limited workers to create overflow scenario
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Add large number of items quickly to create overflow
      const overflowItemCount = 80;
      const testReceipts = generateTestReceiptData(overflowItemCount);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const overflowStartTime = performance.now();
      
      // Add all items at once to create overflow
      await testState.utilities.addToQueue(queueItems);

      // Monitor queue depth over time
      const queueDepthSnapshots: any[] = [];
      const depthMonitor = setInterval(async () => {
        try {
          const queueStatus = await testState.utilities.getQueueStatus();
          const metrics = await testState.utilities.getEmbeddingMetrics();
          
          queueDepthSnapshots.push({
            timestamp: Date.now(),
            pendingItems: queueStatus.pendingItems,
            completedFiles: metrics.completedFiles,
            activeWorkers: queueStatus.activeWorkers
          });
          
          if (queueStatus.pendingItems < 10) { // Most items processed
            clearInterval(depthMonitor);
          }
        } catch (error) {
          console.warn('Queue depth monitoring error:', error);
        }
      }, 5000);

      // Add more workers after 30 seconds to handle overflow
      setTimeout(async () => {
        console.log('Adding additional workers to handle overflow');
        const additionalWorkers = await testState.utilities.startQueueWorkers(4);
        workerIds.push(...additionalWorkers);
      }, 30000);

      // Wait for queue to drain
      await waitForCondition(
        async () => {
          const queueStatus = await testState.utilities.getQueueStatus();
          return queueStatus.pendingItems < 10;
        },
        300000, // 5 minutes
        5000
      );

      clearInterval(depthMonitor);
      const overflowEndTime = performance.now();
      const totalOverflowTime = overflowEndTime - overflowStartTime;

      // Analyze overflow handling
      const maxQueueDepth = Math.max(...queueDepthSnapshots.map(s => s.pendingItems));
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      const overflowThroughput = (finalMetrics.successfulAttempts / (totalOverflowTime / 1000)) * 60;

      // System should handle overflow without crashing
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);
      expect(maxQueueDepth).toBeGreaterThan(60); // Should have had significant overflow
      expect(overflowThroughput).toBeGreaterThan(20); // Reasonable throughput despite overflow

      console.log(`\n🌊 Queue Overflow Performance:`);
      console.log(`Max Queue Depth: ${maxQueueDepth} items`);
      console.log(`Overflow Resolution Time: ${(totalOverflowTime / 1000).toFixed(1)} seconds`);
      console.log(`Overflow Throughput: ${overflowThroughput.toFixed(1)} items/min`);
      console.log(`Success Rate: ${((finalMetrics.successfulAttempts / finalMetrics.totalAttempts) * 100).toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000); // 5+ minutes timeout
  });
});
