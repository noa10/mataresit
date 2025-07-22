/**
 * Monitoring and Queue System Integration Tests
 * 
 * This test suite validates the integration between the monitoring dashboard,
 * queue system, and batch upload optimization working together in real-time.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestReceiptData, generateTestEmbeddingMetrics } from '../fixtures/test-data';

describe('Monitoring and Queue System Integration', () => {
  setupTestSuite('Monitoring-Queue Integration');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('monitoring-test@example.com');
    const team = await createTestTeam(user.id, 'Monitoring Test Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    testSessions.length = 0;
  });

  afterEach(async () => {
    const testState = getTestState();
    
    // Clean up test sessions
    for (const session of testSessions) {
      try {
        await testState.supabase
          .from('batch_upload_sessions')
          .delete()
          .eq('id', session.id);
      } catch (error) {
        console.warn(`Failed to cleanup session ${session.id}:`, error);
      }
    }
  });

  describe('Real-time Monitoring Integration', () => {
    it('should provide real-time updates during batch processing', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 20,
        processingStrategy: 'balanced',
        maxConcurrent: 3,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Track real-time updates
      const updateLatencies: number[] = [];
      let updateCount = 0;

      // Simulate real-time monitoring subscription
      const monitoringInterval = setInterval(async () => {
        const updateStartTime = Date.now();
        
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          const updateEndTime = Date.now();
          const latency = updateEndTime - updateStartTime;
          updateLatencies.push(latency);
          updateCount++;
          
          // Stop monitoring when processing is complete
          if (metrics.completedFiles + metrics.failedAttempts >= 20) {
            clearInterval(monitoringInterval);
          }
        } catch (error) {
          console.warn('Monitoring update error:', error);
        }
      }, 1000); // 1-second intervals

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        120000, // 2 minutes
        2000
      );

      clearInterval(monitoringInterval);

      // Validate real-time monitoring performance
      expect(updateCount).toBeGreaterThan(0);
      
      const avgLatency = updateLatencies.reduce((sum, l) => sum + l, 0) / updateLatencies.length;
      expect(avgLatency).toBeLessThan(750); // Target: 500ms, allow up to 750ms

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);

    it('should maintain monitoring accuracy during high-volume processing', async () => {
      const testState = getTestState();
      
      // Create larger batch for accuracy testing
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 50,
        processingStrategy: 'adaptive',
        maxConcurrent: 5,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(50);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 50;
        },
        300000, // 5 minutes
        3000
      );

      // Validate data consistency between monitoring and actual data
      const monitoringMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const queueStatus = await testState.utilities.getQueueStatus();

      // Check that monitoring data matches actual processing results
      expect(monitoringMetrics.totalAttempts).toBe(50);
      expect(monitoringMetrics.successfulAttempts + monitoringMetrics.failedAttempts).toBe(50);

      // Validate monitoring accuracy (>99%)
      const accuracy = monitoringMetrics.successfulAttempts / monitoringMetrics.totalAttempts;
      expect(accuracy).toBeGreaterThan(0.99);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000);
  });

  describe('Queue Performance Monitoring', () => {
    it('should track queue throughput and worker efficiency', async () => {
      const testState = getTestState();
      
      // Start workers with known capacity
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Create multiple small batches to measure throughput
      const batchCount = 5;
      const itemsPerBatch = 10;
      const totalItems = batchCount * itemsPerBatch;

      for (let i = 0; i < batchCount; i++) {
        const testReceipts = generateTestReceiptData(itemsPerBatch);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-batch-${i}`,
          operation: 'INSERT',
          priority: 'medium'
        }));
        
        await testState.utilities.addToQueue(queueItems);
      }

      const startTime = Date.now();

      // Wait for all processing to complete
      await waitForCondition(
        async () => {
          const depth = await testState.utilities.getQueueDepth();
          return depth === 0;
        },
        180000, // 3 minutes
        2000
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughputPerMinute = (totalItems / totalTime) * 60000;

      // Validate queue performance targets
      expect(throughputPerMinute).toBeGreaterThan(45); // Target: 50 items/minute

      // Check worker efficiency
      const queueStatus = await testState.utilities.getQueueStatus();
      expect(queueStatus.activeWorkers).toBe(4);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);

    it('should handle queue overflow gracefully', async () => {
      const testState = getTestState();
      
      // Start limited workers to create overflow scenario
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Add large number of items quickly to create queue buildup
      const overflowItems = 100;
      const testReceipts = generateTestReceiptData(overflowItems);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Add all items at once to create overflow
      await testState.utilities.addToQueue(queueItems);

      // Check that queue handles overflow without crashing
      const initialQueueStatus = await testState.utilities.getQueueStatus();
      expect(initialQueueStatus.pendingItems).toBeGreaterThan(50); // Should have significant backlog

      // Add more workers to handle overflow
      const additionalWorkerIds = await testState.utilities.startQueueWorkers(3);
      const allWorkerIds = [...workerIds, ...additionalWorkerIds];

      // Wait for queue to drain
      await waitForCondition(
        async () => {
          const depth = await testState.utilities.getQueueDepth();
          return depth < 10; // Allow some items to remain
        },
        300000, // 5 minutes
        5000
      );

      // Validate system handled overflow gracefully
      const finalQueueStatus = await testState.utilities.getQueueStatus();
      expect(finalQueueStatus.activeWorkers).toBe(5);
      expect(finalQueueStatus.pendingItems).toBeLessThan(initialQueueStatus.pendingItems);

      // Cleanup
      await testState.utilities.stopQueueWorkers(allWorkerIds);
    }, 320000);
  });

  describe('Dashboard Performance Integration', () => {
    it('should load dashboard within time limits during active processing', async () => {
      const testState = getTestState();
      
      // Generate test metrics data
      await testState.utilities.generateTestMetrics(1000);

      // Start active processing to simulate real load
      const workerIds = await testState.utilities.startQueueWorkers(3);
      
      const testReceipts = generateTestReceiptData(30);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));
      
      await testState.utilities.addToQueue(queueItems);

      // Test dashboard load performance during active processing
      const startTime = performance.now();
      const dashboardData = await testState.utilities.loadDashboardData();
      const endTime = performance.now();
      
      const loadTime = endTime - startTime;

      // Validate dashboard performance
      expect(loadTime).toBeLessThan(2500); // Target: 2000ms, allow up to 2500ms
      expect(dashboardData.metrics.length).toBeGreaterThan(1000);
      expect(dashboardData.aggregatedStats).toBeDefined();
      expect(dashboardData.queueStatus).toBeDefined();
      expect(dashboardData.workerStatus.length).toBeGreaterThan(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);

    it('should provide efficient real-time updates during batch processing', async () => {
      const testState = getTestState();
      
      // Start processing
      const workerIds = await testState.utilities.startQueueWorkers(2);
      
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));
      
      await testState.utilities.addToQueue(queueItems);

      // Test real-time update efficiency
      const updateLatencies: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        // Trigger embedding event
        await testState.utilities.triggerEmbeddingEvent();
        
        // Measure update latency
        const updateStartTime = Date.now();
        const metrics = await testState.utilities.getEmbeddingMetrics();
        const updateEndTime = Date.now();
        
        const latency = updateEndTime - updateStartTime;
        updateLatencies.push(latency);
        
        // Wait between updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgLatency = updateLatencies.reduce((sum, l) => sum + l, 0) / updateLatencies.length;
      expect(avgLatency).toBeLessThan(750); // Target: 500ms

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);
  });
});
