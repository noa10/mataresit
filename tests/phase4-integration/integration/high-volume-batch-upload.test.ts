/**
 * High-Volume Batch Upload Integration Tests
 * 
 * This test suite implements Scenario 1 from Phase 4: High-Volume Batch Upload with Full Monitoring
 * Tests 100 receipt images in a single batch upload with all three systems active:
 * - Monitoring Dashboard
 * - Queue System  
 * - Rate Limiting
 * - Multiple concurrent users performing batch uploads
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition, generateTestId } from '../setup/test-setup';
import { simulateAPIRateLimit, simulateRandomFailures, setResponseDelays } from '../setup/mock-services';
import { generateTestReceiptData } from '../fixtures/test-data';

// Test configuration
const TEST_CONFIG = {
  LARGE_BATCH_SIZE: 100,
  MEDIUM_BATCH_SIZE: 25,
  SMALL_BATCH_SIZE: 10,
  CONCURRENT_USERS: 5,
  MAX_PROCESSING_TIME: 30 * 60 * 1000, // 30 minutes
  SUCCESS_RATE_THRESHOLD: 0.95, // 95% success rate
  RATE_LIMIT_THRESHOLD: 0, // No rate limit violations expected
  MAX_CONCURRENT_LIMIT: 8
};

describe('High-Volume Batch Upload Integration Tests', () => {
  setupTestSuite('High-Volume Batch Upload');
  setupTest();

  let testUsers: any[] = [];
  let testTeams: any[] = [];
  let testSessions: any[] = [];

  beforeAll(async () => {
    const testState = getTestState();
    
    // Create test users and teams for concurrent testing
    for (let i = 1; i <= TEST_CONFIG.CONCURRENT_USERS; i++) {
      const { user } = await createTestUser(`test-batch-user-${i}@example.com`);
      const team = await createTestTeam(user.id, `Test Batch Team ${i}`);
      
      testUsers.push(user);
      testTeams.push(team);
    }
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services to clean state
    testState.mockServices.geminiMock.reset();
    testState.mockServices.openrouterMock.reset();
    testState.mockServices.rateLimitSimulator.clearSimulations();
    
    // Clear any existing test sessions
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

  describe('Single Large Batch Upload (100 files)', () => {
    it('should process 100 files with queue and rate limiting', async () => {
      const testState = getTestState();
      const user = testUsers[0];
      const team = testTeams[0];
      
      // Create test batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: TEST_CONFIG.LARGE_BATCH_SIZE,
        processingStrategy: 'adaptive',
        maxConcurrent: 5,
        userId: user.id,
        teamId: team.id
      });
      testSessions.push(batchSession);

      // Start queue workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test receipt files
      const testReceipts = generateTestReceiptData(TEST_CONFIG.LARGE_BATCH_SIZE);
      
      // Add items to queue to simulate batch upload
      const queueItems = testReceipts.map((receipt, index) => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = performance.now();
      
      // Add all items to queue
      await testState.utilities.addToQueue(queueItems);

      // Monitor progress in real-time
      let progressCheckCount = 0;
      const maxProgressChecks = 360; // 30 minutes with 5-second intervals
      
      const progressMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          console.log(`Progress: ${metrics.completedFiles}/${metrics.totalFiles}`);
          console.log(`Queue depth: ${queueStatus.pendingItems}`);
          console.log(`Rate limit status: ${queueStatus.rateLimitStatus}`);
          
          progressCheckCount++;
          
          // Check if processing is complete or timeout reached
          if (metrics.completedFiles + metrics.failedAttempts >= TEST_CONFIG.LARGE_BATCH_SIZE || 
              progressCheckCount >= maxProgressChecks) {
            clearInterval(progressMonitor);
          }
        } catch (error) {
          console.warn('Progress monitoring error:', error);
        }
      }, 5000);

      // Wait for completion or timeout
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= TEST_CONFIG.LARGE_BATCH_SIZE;
        },
        TEST_CONFIG.MAX_PROCESSING_TIME,
        5000
      );

      clearInterval(progressMonitor);
      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;

      // Validate results
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const queueMetrics = await testState.utilities.getQueueStatus();

      // Assert success rate
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(TEST_CONFIG.SUCCESS_RATE_THRESHOLD);

      // Assert processing time is reasonable (30 minutes max)
      expect(totalProcessingTime).toBeLessThan(TEST_CONFIG.MAX_PROCESSING_TIME);

      // Assert no API quota violations
      expect(finalMetrics.apiQuotaViolations).toBe(TEST_CONFIG.RATE_LIMIT_THRESHOLD);

      // Assert queue performance
      expect(finalMetrics.totalAttempts).toBe(TEST_CONFIG.LARGE_BATCH_SIZE);
      expect(finalMetrics.averageProcessingTime).toBeLessThan(10000); // 10 seconds per item

      // Cleanup workers
      await testState.utilities.stopQueueWorkers(workerIds);
    }, TEST_CONFIG.MAX_PROCESSING_TIME + 10000); // Add buffer to test timeout

    it('should handle API rate limiting gracefully', async () => {
      const testState = getTestState();
      const user = testUsers[0];
      const team = testTeams[0];

      // Simulate API rate limiting for 1 minute
      await simulateAPIRateLimit(testState.mockServices, 'gemini', 60000);

      // Create smaller batch for rate limit testing
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: TEST_CONFIG.SMALL_BATCH_SIZE,
        processingStrategy: 'conservative',
        maxConcurrent: 2,
        userId: user.id,
        teamId: team.id
      });
      testSessions.push(batchSession);

      // Start queue workers
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data and add to queue
      const testReceipts = generateTestReceiptData(TEST_CONFIG.SMALL_BATCH_SIZE);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= TEST_CONFIG.SMALL_BATCH_SIZE;
        },
        120000, // 2 minutes
        2000
      );

      // Validate results
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);

      // Should complete despite rate limiting (with retries)
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.9);

      // Should show rate limiting in metrics
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000); // 2.5 minutes timeout
  });

  describe('Multiple Concurrent Batch Uploads', () => {
    it('should handle multiple users uploading batches simultaneously', async () => {
      const testState = getTestState();
      
      // Start queue workers for concurrent processing
      const workerIds = await testState.utilities.startQueueWorkers(5);

      // Create concurrent batch sessions
      const concurrentSessions = await Promise.all(
        testUsers.map(async (user, index) => {
          const team = testTeams[index];
          return await testState.utilities.createBatchSession({
            totalFiles: TEST_CONFIG.MEDIUM_BATCH_SIZE,
            processingStrategy: 'balanced',
            maxConcurrent: 3,
            userId: user.id,
            teamId: team.id
          });
        })
      );

      testSessions.push(...concurrentSessions);

      // Generate test data for each session
      const allQueueItems: any[] = [];
      for (let i = 0; i < concurrentSessions.length; i++) {
        const testReceipts = generateTestReceiptData(TEST_CONFIG.MEDIUM_BATCH_SIZE);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-user-${i}`,
          operation: 'INSERT',
          priority: 'medium'
        }));
        allQueueItems.push(...queueItems);
      }

      const startTime = performance.now();

      // Add all items to queue simultaneously
      await testState.utilities.addToQueue(allQueueItems);

      // Wait for all processing to complete
      const totalExpectedItems = TEST_CONFIG.CONCURRENT_USERS * TEST_CONFIG.MEDIUM_BATCH_SIZE;
      
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= totalExpectedItems;
        },
        TEST_CONFIG.MAX_PROCESSING_TIME,
        5000
      );

      const endTime = performance.now();
      const totalProcessingTime = endTime - startTime;

      // Validate system performance under concurrent load
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      const queueStatus = await testState.utilities.getQueueStatus();

      // Assert overall success rate
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.9); // 90% success rate under concurrent load

      // Assert processing completed within reasonable time
      expect(totalProcessingTime).toBeLessThan(TEST_CONFIG.MAX_PROCESSING_TIME);

      // Assert system handled concurrent load
      expect(finalMetrics.totalAttempts).toBe(totalExpectedItems);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, TEST_CONFIG.MAX_PROCESSING_TIME + 10000);

    it('should maintain system stability under peak concurrent load', async () => {
      const testState = getTestState();

      // Start maximum number of workers
      const workerIds = await testState.utilities.startQueueWorkers(TEST_CONFIG.MAX_CONCURRENT_LIMIT);

      // Create even more concurrent sessions to stress test
      const stressTestUsers = Math.min(10, TEST_CONFIG.CONCURRENT_USERS * 2);
      const stressSessions: any[] = [];

      for (let i = 0; i < stressTestUsers; i++) {
        const user = testUsers[i % testUsers.length];
        const team = testTeams[i % testTeams.length];
        
        const session = await testState.utilities.createBatchSession({
          totalFiles: TEST_CONFIG.SMALL_BATCH_SIZE,
          processingStrategy: 'aggressive',
          maxConcurrent: TEST_CONFIG.MAX_CONCURRENT_LIMIT,
          userId: user.id,
          teamId: team.id
        });
        
        stressSessions.push(session);
      }

      testSessions.push(...stressSessions);

      // Generate and queue all items
      const allQueueItems: any[] = [];
      for (let i = 0; i < stressSessions.length; i++) {
        const testReceipts = generateTestReceiptData(TEST_CONFIG.SMALL_BATCH_SIZE);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-stress-${i}`,
          operation: 'INSERT',
          priority: 'high'
        }));
        allQueueItems.push(...queueItems);
      }

      await testState.utilities.addToQueue(allQueueItems);

      // Monitor system health during stress test
      const totalExpectedItems = stressTestUsers * TEST_CONFIG.SMALL_BATCH_SIZE;
      
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= totalExpectedItems;
        },
        180000, // 3 minutes for stress test
        3000
      );

      // Validate system didn't crash and maintained minimum service level
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();

      // System should not crash
      expect(finalMetrics.totalAttempts).toBeGreaterThan(0);

      // Should maintain minimum service level (70% success rate)
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts)
        .toBeGreaterThan(0.7);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000); // 3+ minutes timeout for stress test
  });
});
