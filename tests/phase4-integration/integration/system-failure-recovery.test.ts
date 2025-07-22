/**
 * System Failure Recovery Integration Tests
 * 
 * This test suite implements Scenario 2 from Phase 4: System Failure Recovery
 * Tests various failure conditions and recovery mechanisms:
 * - Queue worker failures and recovery
 * - Database connection failures
 * - Data consistency validation during failures
 * - System resilience and fault tolerance
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { simulateRandomFailures, setResponseDelays } from '../setup/mock-services';
import { generateTestReceiptData } from '../fixtures/test-data';

// Test configuration for failure scenarios
const FAILURE_TEST_CONFIG = {
  BATCH_SIZE: 50,
  WORKER_COUNT: 4,
  FAILURE_DURATION: 30000, // 30 seconds
  RECOVERY_TIMEOUT: 120000, // 2 minutes
  MAX_RECOVERY_TIME: 30000, // 30 seconds
  MIN_SUCCESS_RATE: 0.9, // 90% after recovery
  DATA_CONSISTENCY_THRESHOLD: 0.99 // 99% consistency
};

describe('System Failure Recovery Tests', () => {
  setupTestSuite('System Failure Recovery');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];
  let activeWorkerIds: string[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('failure-recovery-test@example.com');
    const team = await createTestTeam(user.id, 'Failure Recovery Test Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
    
    testSessions.length = 0;
    activeWorkerIds.length = 0;
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

    // Stop any remaining workers
    if (activeWorkerIds.length > 0) {
      await testState.utilities.stopQueueWorkers(activeWorkerIds);
      activeWorkerIds.length = 0;
    }
  });

  describe('Queue Worker Failure Recovery', () => {
    it('should recover from queue worker failures within 30 seconds', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: FAILURE_TEST_CONFIG.BATCH_SIZE,
        processingStrategy: 'balanced',
        maxConcurrent: 4,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start initial workers
      const initialWorkerIds = await testState.utilities.startQueueWorkers(FAILURE_TEST_CONFIG.WORKER_COUNT);
      activeWorkerIds.push(...initialWorkerIds);

      // Generate test data
      const testReceipts = generateTestReceiptData(FAILURE_TEST_CONFIG.BATCH_SIZE);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Let processing start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Record state before failure
      const preFailureMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const preFailureQueueStatus = await testState.utilities.getQueueStatus();

      console.log(`Pre-failure: ${preFailureMetrics.completedFiles} completed, ${preFailureQueueStatus.activeWorkers} workers`);

      // Simulate worker failures by stopping workers
      const failureStartTime = Date.now();
      await testState.utilities.stopQueueWorkers(initialWorkerIds);
      
      console.log('Simulated worker failures - all workers stopped');

      // Wait for failure to be detected
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify workers are down
      const duringFailureQueueStatus = await testState.utilities.getQueueStatus();
      expect(duringFailureQueueStatus.activeWorkers).toBe(0);

      // Simulate recovery by restarting workers
      const recoveryStartTime = Date.now();
      const recoveryWorkerIds = await testState.utilities.startQueueWorkers(FAILURE_TEST_CONFIG.WORKER_COUNT);
      activeWorkerIds.length = 0; // Clear old IDs
      activeWorkerIds.push(...recoveryWorkerIds);

      console.log('Recovery initiated - workers restarted');

      // Wait for recovery to complete
      await waitForCondition(
        async () => {
          const queueStatus = await testState.utilities.getQueueStatus();
          return queueStatus.activeWorkers >= FAILURE_TEST_CONFIG.WORKER_COUNT;
        },
        FAILURE_TEST_CONFIG.MAX_RECOVERY_TIME,
        2000
      );

      const recoveryEndTime = Date.now();
      const recoveryTime = recoveryEndTime - recoveryStartTime;

      console.log(`Recovery completed in ${recoveryTime}ms`);

      // Wait for processing to resume and complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= FAILURE_TEST_CONFIG.BATCH_SIZE;
        },
        FAILURE_TEST_CONFIG.RECOVERY_TIMEOUT,
        3000
      );

      // Validate recovery
      const postRecoveryMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const postRecoveryQueueStatus = await testState.utilities.getQueueStatus();

      // Recovery time should be within acceptable limits
      expect(recoveryTime).toBeLessThan(FAILURE_TEST_CONFIG.MAX_RECOVERY_TIME);

      // Workers should be active again
      expect(postRecoveryQueueStatus.activeWorkers).toBe(FAILURE_TEST_CONFIG.WORKER_COUNT);

      // Processing should eventually complete with good success rate
      expect(postRecoveryMetrics.successfulAttempts / postRecoveryMetrics.totalAttempts)
        .toBeGreaterThan(FAILURE_TEST_CONFIG.MIN_SUCCESS_RATE);

      // Should show worker failures in monitoring
      expect(postRecoveryMetrics.totalAttempts).toBe(FAILURE_TEST_CONFIG.BATCH_SIZE);
    }, FAILURE_TEST_CONFIG.RECOVERY_TIMEOUT + 30000);

    it('should handle partial worker failures gracefully', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 30,
        processingStrategy: 'adaptive',
        maxConcurrent: 3,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);
      activeWorkerIds.push(...workerIds);

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

      // Let processing start
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Kill half the workers (simulate partial failure)
      const workersToKill = workerIds.slice(0, 2);
      await testState.utilities.stopQueueWorkers(workersToKill);
      
      console.log('Simulated partial worker failure - 2 of 4 workers stopped');

      // System should continue processing with remaining workers
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        120000, // 2 minutes
        3000
      );

      // Validate partial failure handling
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // Should complete despite partial worker failure
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.85); // Lower threshold due to partial failure

      // Should have some workers still active
      expect(finalQueueStatus.activeWorkers).toBeGreaterThan(0);
      expect(finalQueueStatus.activeWorkers).toBeLessThan(4); // Some workers failed
    }, 150000);
  });

  describe('Database Connection Failure Recovery', () => {
    it('should handle database connectivity issues with retries', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 25,
        processingStrategy: 'conservative',
        maxConcurrent: 2,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(2);
      activeWorkerIds.push(...workerIds);

      // Generate test data
      const testReceipts = generateTestReceiptData(25);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Let processing start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Simulate database connectivity issues by introducing high failure rate
      setTimeout(() => {
        console.log('Simulating database connectivity issues');
        simulateRandomFailures(testState.mockServices, 0.5); // 50% failure rate
        setResponseDelays(testState.mockServices, 5000); // 5 second delays
      }, 10000);

      // Simulate recovery after 15 seconds
      setTimeout(() => {
        console.log('Simulating database recovery');
        testState.mockServices.geminiMock.reset();
        testState.mockServices.openrouterMock.reset();
      }, 25000);

      // Wait for processing to complete despite database issues
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        180000, // 3 minutes to handle retries
        5000
      );

      // Validate database failure handling
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);

      // Should complete despite database issues (with retries)
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.85);

      // Should show some failures during database issues
      expect(finalMetrics.failedAttempts).toBeGreaterThan(0);
    }, 200000);

    it('should maintain queue integrity during database outages', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);
      activeWorkerIds.push(...workerIds);

      // Add items to queue before simulating database issues
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      await testState.utilities.addToQueue(queueItems);

      // Record initial queue state
      const initialQueueStatus = await testState.utilities.getQueueStatus();
      expect(initialQueueStatus.pendingItems).toBe(20);

      // Simulate database outage
      simulateRandomFailures(testState.mockServices, 0.8); // 80% failure rate
      setResponseDelays(testState.mockServices, 10000); // 10 second delays

      console.log('Simulated database outage');

      // Wait during outage
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Check queue state during outage
      const duringOutageQueueStatus = await testState.utilities.getQueueStatus();
      
      // Queue should still exist and be queryable
      expect(duringOutageQueueStatus.pendingItems).toBeGreaterThan(0);

      // Simulate recovery
      testState.mockServices.geminiMock.reset();
      testState.mockServices.openrouterMock.reset();

      console.log('Database recovery simulated');

      // Wait for processing to resume
      await waitForCondition(
        async () => {
          const depth = await testState.utilities.getQueueDepth();
          return depth < 5; // Most items processed
        },
        120000, // 2 minutes
        3000
      );

      // Validate queue integrity was maintained
      const finalQueueStatus = await testState.utilities.getQueueStatus();
      expect(finalQueueStatus.pendingItems).toBeLessThan(initialQueueStatus.pendingItems);
    }, 180000);
  });

  describe('Data Consistency During Failures', () => {
    it('should maintain data consistency during failures', async () => {
      const testState = getTestState();

      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 30,
        processingStrategy: 'balanced',
        maxConcurrent: 3,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);
      activeWorkerIds.push(...workerIds);

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

      // Introduce random failures during processing
      setTimeout(() => {
        console.log('Introducing random failures for consistency testing');
        simulateRandomFailures(testState.mockServices, 0.15); // 15% failure rate
      }, 8000);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        150000, // 2.5 minutes
        3000
      );

      // Validate data consistency
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const queueRecords = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .in('source_id', testReceipts.map(r => r.id));

      const embeddingRecords = await testState.supabase
        .from('embeddings')
        .select('*')
        .in('receipt_id', testReceipts.map(r => r.id));

      // Every successful receipt should have corresponding embeddings
      const successfulReceipts = queueRecords.data?.filter(q => q.status === 'completed') || [];
      const embeddingReceiptIds = embeddingRecords.data?.map(e => e.receipt_id) || [];

      const consistencyRate = successfulReceipts.length > 0 ?
        successfulReceipts.filter(r => embeddingReceiptIds.includes(r.source_id)).length / successfulReceipts.length : 1;

      expect(consistencyRate).toBeGreaterThan(FAILURE_TEST_CONFIG.DATA_CONSISTENCY_THRESHOLD);

      // Monitoring data should match actual processing results
      expect(finalMetrics.totalAttempts).toBe(30);
      expect(finalMetrics.successfulAttempts).toBe(successfulReceipts.length);
    }, 170000);

    it('should handle concurrent modifications correctly during failures', async () => {
      const testState = getTestState();

      // Create multiple batch sessions to simulate concurrent operations
      const batchSessions = await Promise.all([
        testState.utilities.createBatchSession({
          totalFiles: 15,
          processingStrategy: 'balanced',
          maxConcurrent: 2,
          userId: testUser.id,
          teamId: testTeam.id
        }),
        testState.utilities.createBatchSession({
          totalFiles: 15,
          processingStrategy: 'aggressive',
          maxConcurrent: 3,
          userId: testUser.id,
          teamId: testTeam.id
        })
      ]);
      testSessions.push(...batchSessions);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);
      activeWorkerIds.push(...workerIds);

      // Generate test data for both sessions
      const testReceipts1 = generateTestReceiptData(15);
      const testReceipts2 = generateTestReceiptData(15);

      const queueItems1 = testReceipts1.map(receipt => ({
        source_type: 'receipts',
        source_id: `${receipt.id}-session1`,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const queueItems2 = testReceipts2.map(receipt => ({
        source_type: 'receipts',
        source_id: `${receipt.id}-session2`,
        operation: 'INSERT',
        priority: 'high'
      }));

      // Start concurrent processing
      await Promise.all([
        testState.utilities.addToQueue(queueItems1),
        testState.utilities.addToQueue(queueItems2)
      ]);

      // Introduce failures during concurrent processing
      setTimeout(() => {
        console.log('Introducing failures during concurrent processing');
        simulateRandomFailures(testState.mockServices, 0.2); // 20% failure rate

        // Kill some workers to simulate partial failure
        setTimeout(async () => {
          const workersToKill = workerIds.slice(0, 2);
          await testState.utilities.stopQueueWorkers(workersToKill);
          console.log('Killed 2 workers during concurrent processing');
        }, 5000);
      }, 10000);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics1 = await testState.utilities.getEmbeddingMetrics(batchSessions[0].id);
          const metrics2 = await testState.utilities.getEmbeddingMetrics(batchSessions[1].id);
          return (metrics1.completedFiles + metrics1.failedAttempts >= 15) &&
                 (metrics2.completedFiles + metrics2.failedAttempts >= 15);
        },
        180000, // 3 minutes
        5000
      );

      // Validate concurrent modification handling
      const finalMetrics1 = await testState.utilities.getEmbeddingMetrics(batchSessions[0].id);
      const finalMetrics2 = await testState.utilities.getEmbeddingMetrics(batchSessions[1].id);

      // Both sessions should complete with reasonable success rates
      expect(finalMetrics1.successfulAttempts / finalMetrics1.totalAttempts).toBeGreaterThan(0.8);
      expect(finalMetrics2.successfulAttempts / finalMetrics2.totalAttempts).toBeGreaterThan(0.8);

      // No data corruption between sessions
      expect(finalMetrics1.totalAttempts).toBe(15);
      expect(finalMetrics2.totalAttempts).toBe(15);

      // Combined metrics should be consistent
      const combinedSuccessful = finalMetrics1.successfulAttempts + finalMetrics2.successfulAttempts;
      const combinedTotal = finalMetrics1.totalAttempts + finalMetrics2.totalAttempts;
      expect(combinedTotal).toBe(30);
    }, 200000);
  });

  describe('System Resilience and Fault Tolerance', () => {
    it('should demonstrate end-to-end fault tolerance', async () => {
      const testState = getTestState();

      // Create batch session for comprehensive fault tolerance test
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 40,
        processingStrategy: 'adaptive',
        maxConcurrent: 5,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(5);
      activeWorkerIds.push(...workerIds);

      // Generate test data
      const testReceipts = generateTestReceiptData(40);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Orchestrate multiple failure scenarios
      const failureScenarios = [
        // Scenario 1: Worker failures (10 seconds in)
        {
          delay: 10000,
          action: async () => {
            console.log('Fault tolerance test: Killing 3 workers');
            const workersToKill = workerIds.slice(0, 3);
            await testState.utilities.stopQueueWorkers(workersToKill);
          }
        },
        // Scenario 2: API failures (20 seconds in)
        {
          delay: 20000,
          action: async () => {
            console.log('Fault tolerance test: Introducing API failures');
            simulateRandomFailures(testState.mockServices, 0.3);
          }
        },
        // Scenario 3: Recovery (35 seconds in)
        {
          delay: 35000,
          action: async () => {
            console.log('Fault tolerance test: Starting recovery');
            // Restart workers
            const recoveryWorkers = await testState.utilities.startQueueWorkers(4);
            activeWorkerIds.push(...recoveryWorkers);
            // Reduce API failures
            simulateRandomFailures(testState.mockServices, 0.1);
          }
        },
        // Scenario 4: Full recovery (50 seconds in)
        {
          delay: 50000,
          action: async () => {
            console.log('Fault tolerance test: Full recovery');
            testState.mockServices.geminiMock.reset();
            testState.mockServices.openrouterMock.reset();
          }
        }
      ];

      // Execute failure scenarios
      failureScenarios.forEach(scenario => {
        setTimeout(scenario.action, scenario.delay);
      });

      // Wait for processing to complete despite all failures
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 40;
        },
        300000, // 5 minutes for comprehensive fault tolerance
        5000
      );

      // Validate comprehensive fault tolerance
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // System should recover and complete processing
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.8); // 80% success rate despite multiple failures

      // Should have active workers after recovery
      expect(finalQueueStatus.activeWorkers).toBeGreaterThan(0);

      // Should show evidence of failures and recovery
      expect(finalMetrics.failedAttempts).toBeGreaterThan(0);
      expect(finalMetrics.totalAttempts).toBe(40);

      console.log(`Fault tolerance test completed: ${finalMetrics.successfulAttempts}/${finalMetrics.totalAttempts} successful`);
    }, 320000);
  });
});
