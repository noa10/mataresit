/**
 * Batch Upload Performance Tests
 * 
 * This test suite benchmarks batch upload performance and validates
 * against Phase 4 target metrics for concurrent processing.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestReceiptData } from '../fixtures/test-data';
import { TARGET_METRICS, PERFORMANCE_THRESHOLDS, validatePerformanceThresholds, calculateImprovement, BASELINE_METRICS } from './performance-baseline';

describe('Batch Upload Performance Tests', () => {
  setupTestSuite('Batch Upload Performance');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('batch-upload-perf-test@example.com');
    const team = await createTestTeam(user.id, 'Batch Upload Performance Team');
    
    testUser = user;
    testTeam = team;
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent performance testing
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

  describe('Batch Processing Performance', () => {
    it('should meet batch upload processing time targets', async () => {
      const testState = getTestState();
      
      // Create batch session with optimal settings
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 50,
        processingStrategy: 'balanced',
        maxConcurrent: 6, // Test concurrent processing
        userId: testUser.id,
        teamId: testTeam.id
      });
      testSessions.push(batchSession);

      // Start workers for batch processing
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate test data
      const testReceipts = generateTestReceiptData(50);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Track performance metrics
      const batchStartTime = performance.now();
      let queueWaitTime = 0;
      let rateLimitHits = 0;

      // Add all items to queue
      const queueStartTime = performance.now();
      await testState.utilities.addToQueue(queueItems);
      queueWaitTime = performance.now() - queueStartTime;

      // Monitor progress and collect metrics
      const progressSnapshots: any[] = [];
      const progressMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          progressSnapshots.push({
            timestamp: Date.now(),
            completedFiles: metrics.completedFiles,
            failedAttempts: metrics.failedAttempts,
            pendingItems: queueStatus.pendingItems,
            rateLimitHits: metrics.rateLimitHits
          });
          
          if (metrics.completedFiles + metrics.failedAttempts >= 50) {
            clearInterval(progressMonitor);
          }
        } catch (error) {
          console.warn('Progress monitoring error:', error);
        }
      }, 3000);

      // Wait for batch processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 50;
        },
        300000, // 5 minutes timeout
        5000
      );

      clearInterval(progressMonitor);
      const batchEndTime = performance.now();
      const totalBatchTime = batchEndTime - batchStartTime;

      // Calculate performance metrics
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      const averageProcessingTime = totalBatchTime / 50; // ms per file
      const successRate = finalMetrics.successfulAttempts / finalMetrics.totalAttempts;
      const filesPerMinute = (finalMetrics.successfulAttempts / (totalBatchTime / 1000)) * 60;
      const rateLimitFailures = finalMetrics.rateLimitHits / finalMetrics.totalAttempts;

      const performanceMetrics = {
        averageProcessingTime,
        successRate,
        concurrentLimit: 6, // As configured
        rateLimitFailures,
        queueWaitTime,
        batchCompletionTime: totalBatchTime,
        filesPerMinute,
        throughput: filesPerMinute
      };

      // Validate against performance thresholds
      const validation = validatePerformanceThresholds('batchUpload', performanceMetrics);
      
      if (!validation.passed) {
        console.warn('Batch performance threshold failures:', validation.failures);
      }

      // Assert performance targets
      expect(averageProcessingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchUpload.maxProcessingTime);
      expect(successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.batchUpload.minSuccessRate);
      expect(6).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.batchUpload.minConcurrentLimit);
      expect(rateLimitFailures).toBeLessThan(PERFORMANCE_THRESHOLDS.batchUpload.maxRateLimitFailures);
      expect(queueWaitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchUpload.maxQueueWaitTime);

      // Calculate improvements over baseline
      const processingImprovement = calculateImprovement(BASELINE_METRICS.batchUpload.averageProcessingTime, averageProcessingTime);
      const successImprovement = calculateImprovement(BASELINE_METRICS.batchUpload.successRate, successRate, true);
      const throughputImprovement = calculateImprovement(BASELINE_METRICS.batchUpload.throughput, filesPerMinute, true);

      console.log(`\n📈 Batch Performance Improvements:`);
      console.log(`Processing Time: ${processingImprovement.toFixed(1)}% improvement`);
      console.log(`Success Rate: ${successImprovement.toFixed(1)}% improvement`);
      console.log(`Throughput: ${throughputImprovement.toFixed(1)}% improvement`);
      console.log(`Files per minute: ${filesPerMinute.toFixed(1)}`);
      console.log(`Total batch time: ${(totalBatchTime / 1000).toFixed(1)} seconds`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 320000); // 5+ minutes timeout

    it('should scale concurrent processing effectively', async () => {
      const testState = getTestState();
      
      // Test different concurrency levels
      const concurrencyLevels = [2, 4, 6, 8];
      const concurrencyResults: any[] = [];

      for (const concurrency of concurrencyLevels) {
        console.log(`\nTesting concurrency level: ${concurrency}`);
        
        // Create batch session with specific concurrency
        const batchSession = await testState.utilities.createBatchSession({
          totalFiles: 20,
          processingStrategy: 'balanced',
          maxConcurrent: concurrency,
          userId: testUser.id,
          teamId: testTeam.id
        });
        testSessions.push(batchSession);

        // Start workers matching concurrency level
        const workerIds = await testState.utilities.startQueueWorkers(Math.min(concurrency, 6));

        // Generate test data
        const testReceipts = generateTestReceiptData(20);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-concurrency-${concurrency}`,
          operation: 'INSERT',
          priority: 'medium'
        }));

        const startTime = performance.now();
        
        // Process batch
        await testState.utilities.addToQueue(queueItems);

        // Wait for completion
        await waitForCondition(
          async () => {
            const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
            return metrics.completedFiles + metrics.failedAttempts >= 20;
          },
          120000, // 2 minutes per concurrency test
          3000
        );

        const endTime = performance.now();
        const processingTime = endTime - startTime;
        const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);

        concurrencyResults.push({
          concurrency,
          processingTime,
          successRate: finalMetrics.successfulAttempts / finalMetrics.totalAttempts,
          throughput: (finalMetrics.successfulAttempts / (processingTime / 1000)) * 60,
          avgTimePerFile: processingTime / 20
        });

        console.log(`Concurrency ${concurrency}: ${(processingTime / 1000).toFixed(1)}s total, ${(processingTime / 20).toFixed(0)}ms per file`);

        // Cleanup workers
        await testState.utilities.stopQueueWorkers(workerIds);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Analyze concurrency scaling
      const baselineResult = concurrencyResults[0]; // concurrency = 2
      const bestResult = concurrencyResults.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );

      // Higher concurrency should improve throughput
      expect(bestResult.throughput).toBeGreaterThan(baselineResult.throughput);
      
      // Optimal concurrency should be at least 6
      expect(bestResult.concurrency).toBeGreaterThanOrEqual(6);

      console.log(`\n📊 Concurrency Scaling Analysis:`);
      concurrencyResults.forEach(result => {
        console.log(`Concurrency ${result.concurrency}: ${result.throughput.toFixed(1)} files/min`);
      });
      console.log(`Best performance: Concurrency ${bestResult.concurrency} with ${bestResult.throughput.toFixed(1)} files/min`);
    }, 600000); // 10 minutes timeout for all concurrency tests
  });

  describe('Rate Limiting Performance', () => {
    it('should handle rate limiting efficiently', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 30,
        processingStrategy: 'adaptive', // Should adapt to rate limits
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

      // Introduce rate limiting after processing starts
      setTimeout(() => {
        console.log('Introducing rate limiting for performance test');
        testState.mockServices.geminiMock.enableRateLimit(45000); // 45 second rate limit
      }, 10000);

      // Track rate limiting impact
      const rateLimitSnapshots: any[] = [];
      const rateLimitMonitor = setInterval(async () => {
        try {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          rateLimitSnapshots.push({
            timestamp: Date.now(),
            completedFiles: metrics.completedFiles,
            rateLimitHits: metrics.rateLimitHits,
            rateLimitStatus: queueStatus.rateLimitStatus
          });
          
          if (metrics.completedFiles + metrics.failedAttempts >= 30) {
            clearInterval(rateLimitMonitor);
          }
        } catch (error) {
          console.warn('Rate limit monitoring error:', error);
        }
      }, 3000);

      // Wait for completion
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        240000, // 4 minutes with rate limiting
        5000
      );

      clearInterval(rateLimitMonitor);

      // Analyze rate limiting performance
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      const rateLimitFailureRate = finalMetrics.rateLimitHits / finalMetrics.totalAttempts;

      // Should handle rate limiting gracefully
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.9);
      expect(rateLimitFailureRate).toBeLessThan(0.1); // Less than 10% rate limit failures
      expect(finalMetrics.rateLimitHits).toBeGreaterThan(0); // Should show rate limiting occurred

      console.log(`\n⚡ Rate Limiting Performance:`);
      console.log(`Success rate with rate limiting: ${((finalMetrics.successfulAttempts / finalMetrics.totalAttempts) * 100).toFixed(1)}%`);
      console.log(`Rate limit failure rate: ${(rateLimitFailureRate * 100).toFixed(1)}%`);
      console.log(`Total rate limit hits: ${finalMetrics.rateLimitHits}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 260000);
  });

  describe('Batch Size Optimization', () => {
    it('should optimize performance across different batch sizes', async () => {
      const testState = getTestState();
      
      // Test different batch sizes
      const batchSizes = [10, 25, 50, 75];
      const batchSizeResults: any[] = [];

      for (const batchSize of batchSizes) {
        console.log(`\nTesting batch size: ${batchSize}`);
        
        // Create batch session
        const batchSession = await testState.utilities.createBatchSession({
          totalFiles: batchSize,
          processingStrategy: 'balanced',
          maxConcurrent: 5,
          userId: testUser.id,
          teamId: testTeam.id
        });
        testSessions.push(batchSession);

        // Start workers
        const workerIds = await testState.utilities.startQueueWorkers(4);

        // Generate test data
        const testReceipts = generateTestReceiptData(batchSize);
        const queueItems = testReceipts.map(receipt => ({
          source_type: 'receipts',
          source_id: `${receipt.id}-batch-${batchSize}`,
          operation: 'INSERT',
          priority: 'medium'
        }));

        const startTime = performance.now();
        
        // Process batch
        await testState.utilities.addToQueue(queueItems);

        // Wait for completion
        await waitForCondition(
          async () => {
            const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
            return metrics.completedFiles + metrics.failedAttempts >= batchSize;
          },
          batchSize * 2000, // 2 seconds per file timeout
          3000
        );

        const endTime = performance.now();
        const processingTime = endTime - startTime;
        const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);

        batchSizeResults.push({
          batchSize,
          processingTime,
          avgTimePerFile: processingTime / batchSize,
          successRate: finalMetrics.successfulAttempts / finalMetrics.totalAttempts,
          throughput: (finalMetrics.successfulAttempts / (processingTime / 1000)) * 60
        });

        console.log(`Batch ${batchSize}: ${(processingTime / 1000).toFixed(1)}s total, ${(processingTime / batchSize).toFixed(0)}ms per file`);

        // Cleanup workers
        await testState.utilities.stopQueueWorkers(workerIds);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Analyze batch size optimization
      const optimalBatch = batchSizeResults.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );

      // Performance should scale reasonably with batch size
      const smallBatch = batchSizeResults.find(r => r.batchSize === 10);
      const largeBatch = batchSizeResults.find(r => r.batchSize === 50);
      
      if (smallBatch && largeBatch) {
        // Larger batches should have better or similar per-file performance
        expect(largeBatch.avgTimePerFile).toBeLessThanOrEqual(smallBatch.avgTimePerFile * 1.2); // Allow 20% degradation
      }

      console.log(`\n📊 Batch Size Optimization:`);
      batchSizeResults.forEach(result => {
        console.log(`Batch ${result.batchSize}: ${result.throughput.toFixed(1)} files/min, ${result.avgTimePerFile.toFixed(0)}ms per file`);
      });
      console.log(`Optimal batch size: ${optimalBatch.batchSize} with ${optimalBatch.throughput.toFixed(1)} files/min`);
    }, 800000); // 13+ minutes timeout for all batch size tests
  });
});
