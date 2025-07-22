/**
 * Rate Limiting and API Management Integration Tests
 * 
 * This test suite validates the integration of rate limiting with the batch upload
 * and queue systems, ensuring proper API quota management and adaptive scaling.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { simulateAPIRateLimit, simulateRandomFailures } from '../setup/mock-services';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Rate Limiting and API Management Integration', () => {
  setupTestSuite('Rate Limiting Integration');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('rate-limit-test@example.com');
    const team = await createTestTeam(user.id, 'Rate Limit Test Team');
    
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

  describe('Adaptive Rate Limiting', () => {
    it('should adapt processing speed based on API rate limits', async () => {
      const testState = getTestState();
      
      // Create batch session with adaptive strategy
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 20,
        processingStrategy: 'adaptive',
        maxConcurrent: 6,
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

      // Track processing rate over time
      const processingRates: number[] = [];
      let lastCompletedCount = 0;
      let rateCheckCount = 0;

      const rateMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const currentCompleted = metrics.completedFiles;
          const rate = currentCompleted - lastCompletedCount;
          
          if (rateCheckCount > 0) { // Skip first measurement
            processingRates.push(rate);
          }
          
          lastCompletedCount = currentCompleted;
          rateCheckCount++;
          
          if (currentCompleted + metrics.failedAttempts >= 20) {
            clearInterval(rateMonitor);
          }
        } catch (error) {
          console.warn('Rate monitoring error:', error);
        }
      }, 5000); // Check every 5 seconds

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Introduce rate limiting after 10 seconds
      setTimeout(() => {
        simulateAPIRateLimit(testState.mockServices, 'gemini', 30000); // 30 second rate limit
      }, 10000);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        180000, // 3 minutes
        3000
      );

      clearInterval(rateMonitor);

      // Validate adaptive behavior
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete despite rate limiting
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);
      
      // Should show rate limiting occurred
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);
      
      // Processing rate should have adapted (slowed down during rate limiting)
      if (processingRates.length >= 4) {
        const earlyRate = processingRates.slice(0, 2).reduce((sum, r) => sum + r, 0) / 2;
        const lateRate = processingRates.slice(-2).reduce((sum, r) => sum + r, 0) / 2;
        
        // Rate should have decreased during rate limiting period
        expect(lateRate).toBeLessThan(earlyRate + 1); // Allow some variance
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);

    it('should prevent API quota exhaustion through intelligent throttling', async () => {
      const testState = getTestState();
      
      // Create batch session with conservative strategy for quota protection
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 30,
        processingStrategy: 'conservative',
        maxConcurrent: 2, // Low concurrency to test throttling
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Configure mock to track API usage
      let apiCallCount = 0;
      const originalGeminiHandler = testState.mockServices.geminiMock.createHandler();
      
      // Override to count calls
      testState.mockServices.geminiMock.createHandler = () => {
        return async (request: any) => {
          apiCallCount++;
          return originalGeminiHandler(request);
        };
      };

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

      // Simulate quota pressure after 15 seconds
      setTimeout(() => {
        // Simulate approaching quota limits
        testState.mockServices.geminiMock.setFailureRate(0.2); // 20% failure rate
      }, 15000);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        240000, // 4 minutes for conservative processing
        5000
      );

      // Validate quota protection
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should maintain reasonable success rate despite quota pressure
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.8);
      
      // API calls should be throttled (not excessive)
      const avgCallsPerItem = apiCallCount / finalMetrics.totalAttempts;
      expect(avgCallsPerItem).toBeLessThan(5); // Should not exceed reasonable retry limit

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 260000);
  });

  describe('Multi-Provider Rate Limiting', () => {
    it('should balance load across multiple API providers', async () => {
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

      // Track provider usage
      let geminiCalls = 0;
      let openrouterCalls = 0;

      // Override mock handlers to count provider usage
      const originalGeminiStats = testState.mockServices.geminiMock.getStats;
      const originalOpenRouterStats = testState.mockServices.openrouterMock.getStats;

      testState.mockServices.geminiMock.getStats = () => {
        const stats = originalGeminiStats.call(testState.mockServices.geminiMock);
        geminiCalls = stats.requestCount;
        return stats;
      };

      testState.mockServices.openrouterMock.getStats = () => {
        const stats = originalOpenRouterStats.call(testState.mockServices.openrouterMock);
        openrouterCalls = stats.requestCount;
        return stats;
      };

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

      // Simulate rate limiting on Gemini after 10 seconds
      setTimeout(() => {
        simulateAPIRateLimit(testState.mockServices, 'gemini', 45000); // 45 second rate limit
      }, 10000);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        180000, // 3 minutes
        3000
      );

      // Validate load balancing
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should complete successfully
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);
      
      // Should show rate limiting on Gemini
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0);
      
      // Load should have been balanced (both providers used)
      const geminiStats = testState.mockServices.geminiMock.getStats();
      const openrouterStats = testState.mockServices.openrouterMock.getStats();
      
      expect(geminiStats.requestCount + openrouterStats.requestCount).toBeGreaterThan(20);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);

    it('should handle cascading rate limits across providers', async () => {
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
      const workerIds = await testState.utilities.startQueueWorkers(2);

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

      // Simulate cascading rate limits
      setTimeout(() => {
        // Rate limit Gemini first
        simulateAPIRateLimit(testState.mockServices, 'gemini', 60000);
      }, 10000);

      setTimeout(() => {
        // Rate limit OpenRouter after 20 seconds
        simulateAPIRateLimit(testState.mockServices, 'openrouter', 40000);
      }, 20000);

      setTimeout(() => {
        // Release Gemini rate limit after 40 seconds
        testState.mockServices.geminiMock.disableRateLimit();
      }, 40000);

      // Wait for completion (should take longer due to cascading limits)
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        300000, // 5 minutes for cascading rate limits
        5000
      );

      // Validate handling of cascading rate limits
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      // Should eventually complete despite cascading limits
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.85);
      
      // Should show significant rate limiting
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(5);
      
      // Processing should have been significantly delayed
      expect(finalMetrics.averageProcessingTime).toBeGreaterThan(8000); // Longer due to delays

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000);
  });

  describe('Rate Limiting Monitoring Integration', () => {
    it('should provide accurate rate limiting metrics in monitoring dashboard', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 15,
        processingStrategy: 'balanced',
        maxConcurrent: 3,
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data
      const testReceipts = generateTestReceiptData(15);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Track rate limiting metrics
      const rateLimitSnapshots: any[] = [];

      const metricsMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          rateLimitSnapshots.push({
            timestamp: Date.now(),
            rateLimitHits: metrics.rateLimitHits,
            rateLimitStatus: queueStatus.rateLimitStatus,
            completedFiles: metrics.completedFiles
          });
          
          if (metrics.completedFiles + metrics.failedAttempts >= 15) {
            clearInterval(metricsMonitor);
          }
        } catch (error) {
          console.warn('Rate limit metrics monitoring error:', error);
        }
      }, 2000);

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Introduce rate limiting
      setTimeout(() => {
        simulateAPIRateLimit(testState.mockServices, 'gemini', 30000);
      }, 8000);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 15;
        },
        120000, // 2 minutes
        3000
      );

      clearInterval(metricsMonitor);

      // Validate rate limiting monitoring
      expect(rateLimitSnapshots.length).toBeGreaterThan(5);
      
      // Should show rate limiting status change
      const rateLimitStatuses = rateLimitSnapshots.map(s => s.rateLimitStatus);
      expect(rateLimitStatuses).toContain('limited');
      
      // Rate limit hits should increase over time during rate limiting
      const rateLimitHits = rateLimitSnapshots.map(s => s.rateLimitHits);
      const maxHits = Math.max(...rateLimitHits);
      expect(maxHits).toBeGreaterThan(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 140000);
  });
});
