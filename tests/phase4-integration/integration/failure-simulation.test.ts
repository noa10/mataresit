/**
 * Comprehensive Failure Simulation Tests
 * 
 * This test suite simulates various real-world failure scenarios
 * to validate system resilience and recovery mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { simulateAPIRateLimit, simulateRandomFailures, setResponseDelays } from '../setup/mock-services';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Comprehensive Failure Simulation Tests', () => {
  setupTestSuite('Failure Simulation');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('failure-simulation-test@example.com');
    const team = await createTestTeam(user.id, 'Failure Simulation Test Team');
    
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

  describe('Network and API Failures', () => {
    it('should handle intermittent network failures', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 20,
        processingStrategy: 'adaptive',
        maxConcurrent: 3,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Simulate intermittent network failures
      const networkFailurePattern = [
        { delay: 5000, action: () => simulateRandomFailures(testState.mockServices, 0.3) },
        { delay: 15000, action: () => simulateRandomFailures(testState.mockServices, 0.0) }, // Recovery
        { delay: 25000, action: () => simulateRandomFailures(testState.mockServices, 0.5) },
        { delay: 35000, action: () => simulateRandomFailures(testState.mockServices, 0.0) }, // Recovery
        { delay: 45000, action: () => setResponseDelays(testState.mockServices, 3000) },
        { delay: 55000, action: () => setResponseDelays(testState.mockServices, 0) } // Recovery
      ];

      networkFailurePattern.forEach(pattern => {
        setTimeout(pattern.action, pattern.delay);
      });

      // Wait for processing to complete despite network issues
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        180000, // 3 minutes
        5000
      );

      // Validate resilience to network failures
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete despite intermittent failures
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.85);
      expect(finalMetrics.totalAttempts).toBe(20);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);

    it('should handle API provider outages with failover', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 25,
        processingStrategy: 'balanced',
        maxConcurrent: 4,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

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

      // Simulate primary API provider outage
      setTimeout(() => {
        console.log('Simulating Gemini API outage');
        simulateAPIRateLimit(testState.mockServices, 'gemini', 60000); // 1 minute outage
        testState.mockServices.geminiMock.setFailureRate(1.0); // 100% failure
      }, 8000);

      // Simulate secondary provider issues
      setTimeout(() => {
        console.log('Simulating OpenRouter API issues');
        simulateRandomFailures(testState.mockServices, 0.4); // 40% failure rate
      }, 20000);

      // Simulate recovery
      setTimeout(() => {
        console.log('Simulating API recovery');
        testState.mockServices.geminiMock.reset();
        testState.mockServices.openrouterMock.reset();
      }, 45000);

      // Wait for processing to complete with failover
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        180000, // 3 minutes
        5000
      );

      // Validate API failover handling
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete despite API outages
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.8);
      
      // Should show evidence of rate limiting and failures
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);
      expect(finalMetrics.failedAttempts).toBeGreaterThan(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure gracefully', async () => {
      const testState = getTestState();
      
      // Create large batch to simulate memory pressure
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 50,
        processingStrategy: 'conservative', // Use conservative to manage resources
        maxConcurrent: 2, // Lower concurrency to simulate resource constraints
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start limited workers to simulate resource constraints
      const workerIds = await testState.utilities.startQueueWorkers(2);

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

      // Simulate memory pressure by adding delays and reducing throughput
      setTimeout(() => {
        console.log('Simulating memory pressure');
        setResponseDelays(testState.mockServices, 2000); // Slower processing
        simulateRandomFailures(testState.mockServices, 0.1); // Some failures due to resource issues
      }, 10000);

      // Wait for processing to complete under resource pressure
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 50;
        },
        300000, // 5 minutes for resource-constrained processing
        5000
      );

      // Validate graceful handling of resource pressure
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete despite resource constraints
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);
      expect(finalMetrics.totalAttempts).toBe(50);

      // Processing should be slower but stable
      expect(finalMetrics.averageProcessingTime).toBeGreaterThan(3000); // Slower due to constraints

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000);

    it('should handle queue overflow scenarios', async () => {
      const testState = getTestState();
      
      // Start minimal workers to create overflow
      const workerIds = await testState.utilities.startQueueWorkers(1);

      // Generate large amount of test data to overflow queue
      const overflowSize = 100;
      const testReceipts = generateTestReceiptData(overflowSize);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Add all items at once to create overflow
      await testState.utilities.addToQueue(queueItems);

      // Verify queue overflow
      const initialQueueStatus = await testState.utilities.getQueueStatus();
      expect(initialQueueStatus.pendingItems).toBeGreaterThan(80); // Should have significant backlog

      // Gradually add more workers to handle overflow
      setTimeout(async () => {
        console.log('Adding workers to handle overflow');
        const additionalWorkers = await testState.utilities.startQueueWorkers(3);
        workerIds.push(...additionalWorkers);
      }, 10000);

      setTimeout(async () => {
        console.log('Adding more workers');
        const moreWorkers = await testState.utilities.startQueueWorkers(2);
        workerIds.push(...moreWorkers);
      }, 30000);

      // Wait for queue to drain
      await waitForCondition(
        async () => {
          const depth = await testState.utilities.getQueueDepth();
          return depth < 10; // Most items processed
        },
        240000, // 4 minutes
        5000
      );

      // Validate overflow handling
      const finalQueueStatus = await testState.utilities.getQueueStatus();
      expect(finalQueueStatus.pendingItems).toBeLessThan(initialQueueStatus.pendingItems);
      expect(finalQueueStatus.activeWorkers).toBeGreaterThan(1); // More workers added

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 260000);
  });

  describe('Cascading Failure Scenarios', () => {
    it('should handle cascading system failures', async () => {
      const testState = getTestState();
      
      // Create batch session for cascading failure test
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 35,
        processingStrategy: 'adaptive',
        maxConcurrent: 5,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(5);

      // Generate test data
      const testReceipts = generateTestReceiptData(35);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Orchestrate cascading failures
      const cascadingFailures = [
        // Stage 1: API issues (10s)
        {
          delay: 10000,
          action: () => {
            console.log('Cascading failure stage 1: API issues');
            simulateRandomFailures(testState.mockServices, 0.3);
          }
        },
        // Stage 2: Worker failures (20s)
        {
          delay: 20000,
          action: async () => {
            console.log('Cascading failure stage 2: Worker failures');
            const workersToKill = workerIds.slice(0, 3);
            await testState.utilities.stopQueueWorkers(workersToKill);
          }
        },
        // Stage 3: Network degradation (30s)
        {
          delay: 30000,
          action: () => {
            console.log('Cascading failure stage 3: Network degradation');
            setResponseDelays(testState.mockServices, 5000);
            simulateRandomFailures(testState.mockServices, 0.5);
          }
        },
        // Stage 4: Partial recovery (50s)
        {
          delay: 50000,
          action: async () => {
            console.log('Cascading failure stage 4: Partial recovery');
            const recoveryWorkers = await testState.utilities.startQueueWorkers(2);
            workerIds.push(...recoveryWorkers);
            simulateRandomFailures(testState.mockServices, 0.2);
          }
        },
        // Stage 5: Full recovery (70s)
        {
          delay: 70000,
          action: async () => {
            console.log('Cascading failure stage 5: Full recovery');
            const finalWorkers = await testState.utilities.startQueueWorkers(3);
            workerIds.push(...finalWorkers);
            testState.mockServices.geminiMock.reset();
            testState.mockServices.openrouterMock.reset();
          }
        }
      ];

      // Execute cascading failure scenario
      cascadingFailures.forEach(failure => {
        setTimeout(failure.action, failure.delay);
      });

      // Wait for system to recover and complete processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 35;
        },
        300000, // 5 minutes for cascading failure recovery
        5000
      );

      // Validate cascading failure recovery
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // System should eventually recover
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.75);
      expect(finalQueueStatus.activeWorkers).toBeGreaterThan(0);
      expect(finalMetrics.totalAttempts).toBe(35);

      // Should show evidence of multiple failure types
      expect(finalMetrics.failedAttempts).toBeGreaterThan(5);
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);

      console.log(`Cascading failure test: ${finalMetrics.successfulAttempts}/${finalMetrics.totalAttempts} successful`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000);
  });
});
