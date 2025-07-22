/**
 * Cross-System Integration Tests
 * 
 * This test suite validates the complete integration of all three Phase 4 systems:
 * - Monitoring Dashboard
 * - Queue System
 * - Batch Upload Optimization
 * 
 * Tests end-to-end workflows and system interactions.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { simulateAPIRateLimit, simulateRandomFailures, setResponseDelays } from '../setup/mock-services';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Cross-System Integration Tests', () => {
  setupTestSuite('Cross-System Integration');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('cross-system-test@example.com');
    const team = await createTestTeam(user.id, 'Cross-System Test Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset all mock services
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
    
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

  describe('End-to-End Batch Processing Workflow', () => {
    it('should complete full batch processing workflow with all systems active', async () => {
      const testState = getTestState();
      
      // Step 1: Create batch session (Batch Upload System)
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 25,
        processingStrategy: 'balanced',
        maxConcurrent: 4,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Step 2: Start queue workers (Queue System)
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Step 3: Generate test data and add to queue
      const testReceipts = generateTestReceiptData(25);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Step 4: Monitor the complete workflow
      const workflowStartTime = performance.now();
      let monitoringUpdates = 0;
      let lastQueueDepth = 0;
      let lastCompletedCount = 0;

      // Start monitoring
      const monitoringInterval = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          monitoringUpdates++;
          lastQueueDepth = queueStatus.pendingItems;
          lastCompletedCount = metrics.completedFiles;
          
          console.log(`Workflow Progress: ${metrics.completedFiles}/25 completed, Queue: ${queueStatus.pendingItems} pending`);
          
          if (metrics.completedFiles + metrics.failedAttempts >= 25) {
            clearInterval(monitoringInterval);
          }
        } catch (error) {
          console.warn('Workflow monitoring error:', error);
        }
      }, 2000);

      // Step 5: Start processing
      await testState.utilities.addToQueue(queueItems);

      // Step 6: Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        180000, // 3 minutes
        3000
      );

      clearInterval(monitoringInterval);
      const workflowEndTime = performance.now();
      const totalWorkflowTime = workflowEndTime - workflowStartTime;

      // Step 7: Validate complete workflow
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // Validate batch processing
      expect(finalMetrics.totalAttempts).toBe(25);
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.95);

      // Validate queue processing
      expect(finalQueueStatus.pendingItems).toBeLessThan(5); // Should be mostly empty

      // Validate monitoring
      expect(monitoringUpdates).toBeGreaterThan(5); // Should have multiple updates
      expect(totalWorkflowTime).toBeLessThan(180000); // Should complete within 3 minutes

      // Validate system integration
      expect(finalMetrics.averageProcessingTime).toBeLessThan(8000); // 8 seconds per item
      expect(finalMetrics.rateLimitHits).toBe(0); // No rate limiting issues

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);

    it('should handle mixed processing strategies across concurrent batches', async () => {
      const testState = getTestState();
      
      // Create multiple batch sessions with different strategies
      const strategies = ['conservative', 'balanced', 'aggressive', 'adaptive'];
      const batchSessions = await Promise.all(
        strategies.map(async (strategy, index) => {
          const session = await testState.utilities.createBatchSession({
            totalFiles: 15,
            processingStrategy: strategy,
            maxConcurrent: index + 2, // 2, 3, 4, 5
            userId: testUser.id,
            teamId: testTeam.id
          });
          return session;
        })
      );

      testSessions.push(...batchSessions);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(6);

      // Generate test data for each batch
      const allQueueItems: any[] = [];
      for (let i = 0; i < batchSessions.length; i++) {
        const testReceipts = generateTestReceiptData(15);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-strategy-${i}`,
          operation: 'INSERT',
          priority: i % 2 === 0 ? 'high' : 'medium' // Mix priorities
        }));
        allQueueItems.push(...queueItems);
      }

      // Process all batches simultaneously
      await testState.utilities.addToQueue(allQueueItems);

      // Wait for all processing to complete
      const totalExpectedItems = strategies.length * 15;
      
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= totalExpectedItems;
        },
        240000, // 4 minutes
        3000
      );

      // Validate mixed strategy processing
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      
      expect(finalMetrics.totalAttempts).toBe(totalExpectedItems);
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 260000);
  });

  describe('System Resilience and Recovery', () => {
    it('should maintain system stability during API fluctuations', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 30,
        processingStrategy: 'adaptive',
        maxConcurrent: 4,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(30);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Simulate API fluctuations during processing
      setTimeout(() => {
        // Introduce 10% failure rate after 10 seconds
        simulateRandomFailures(testState.mockServices, 0.1);
      }, 10000);

      setTimeout(() => {
        // Add response delays after 20 seconds
        setResponseDelays(testState.mockServices, 2000);
      }, 20000);

      setTimeout(() => {
        // Simulate rate limiting after 30 seconds
        simulateAPIRateLimit(testState.mockServices, 'gemini', 30000);
      }, 30000);

      setTimeout(() => {
        // Reset to normal after 60 seconds
        testState.mockServices.geminiMock.reset();
        testState.mockServices.openrouterMock.reset();
      }, 60000);

      // Wait for completion despite fluctuations
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        300000, // 5 minutes to handle delays and retries
        5000
      );

      // Validate system handled fluctuations
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete despite API issues (with retries)
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.85);
      
      // Should show some rate limiting and retries
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000);

    it('should provide accurate monitoring during system stress', async () => {
      const testState = getTestState();
      
      // Create high-stress scenario
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 40,
        processingStrategy: 'aggressive',
        maxConcurrent: 8,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start maximum workers
      const workerIds = await testState.utilities.startQueueWorkers(8);

      // Generate test data
      const testReceipts = generateTestReceiptData(40);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'high'
      }));

      // Track monitoring accuracy during stress
      const monitoringSnapshots: any[] = [];
      
      const monitoringInterval = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          monitoringSnapshots.push({
            timestamp: Date.now(),
            completedFiles: metrics.completedFiles,
            failedAttempts: metrics.failedAttempts,
            pendingItems: queueStatus.pendingItems,
            activeWorkers: queueStatus.activeWorkers
          });
          
          if (metrics.completedFiles + metrics.failedAttempts >= 40) {
            clearInterval(monitoringInterval);
          }
        } catch (error) {
          console.warn('Stress monitoring error:', error);
        }
      }, 1500);

      // Start processing under stress
      await testState.utilities.addToQueue(queueItems);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 40;
        },
        240000, // 4 minutes
        3000
      );

      clearInterval(monitoringInterval);

      // Validate monitoring accuracy under stress
      expect(monitoringSnapshots.length).toBeGreaterThan(10); // Multiple snapshots
      
      const finalSnapshot = monitoringSnapshots[monitoringSnapshots.length - 1];
      expect(finalSnapshot.completedFiles + finalSnapshot.failedAttempts).toBe(40);
      expect(finalSnapshot.activeWorkers).toBe(8);

      // Validate monitoring consistency
      let consistentSnapshots = 0;
      for (let i = 1; i < monitoringSnapshots.length; i++) {
        const current = monitoringSnapshots[i];
        const previous = monitoringSnapshots[i - 1];
        
        // Progress should be monotonic (non-decreasing)
        if (current.completedFiles >= previous.completedFiles) {
          consistentSnapshots++;
        }
      }
      
      const consistencyRate = consistentSnapshots / (monitoringSnapshots.length - 1);
      expect(consistencyRate).toBeGreaterThan(0.95); // 95% consistency

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 260000);
  });
});
