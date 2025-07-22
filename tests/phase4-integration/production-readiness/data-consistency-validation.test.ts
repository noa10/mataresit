/**
 * Data Consistency Validation Tests
 * 
 * This test suite validates data consistency across all Phase 4 systems
 * using the comprehensive data consistency validation framework.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { DataConsistencyValidator, ValidationContext } from './data-consistency-framework';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Data Consistency Validation Tests', () => {
  setupTestSuite('Data Consistency Validation');
  setupTest();

  let validator: DataConsistencyValidator;
  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('data-consistency-test@example.com');
    const team = await createTestTeam(user.id, 'Data Consistency Test Team');
    
    testUser = user;
    testTeam = team;
    validator = new DataConsistencyValidator();
  });

  beforeEach(async () => {
    const testState = getTestState();
    
    // Reset mock services for consistent testing
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

  describe('Monitoring Data Consistency', () => {
    it('should validate monitoring metrics accuracy against actual data', async () => {
      const testState = getTestState();
      
      // Start workers for processing
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data and process it
      const testReceipts = generateTestReceiptData(25);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        120000, // 2 minutes
        3000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run monitoring consistency checks
      const report = await validator.runCategoryChecks('monitoring', context);

      // Validate monitoring data consistency
      expect(report.overallScore).toBeGreaterThan(0.95); // 95% accuracy
      expect(report.summary.passedChecks).toBeGreaterThan(0);
      expect(report.criticalIssues.length).toBe(0);

      // Validate specific monitoring checks
      const metricsAccuracy = report.checkResults['monitoring_metrics_accuracy'];
      expect(metricsAccuracy.passed).toBe(true);
      expect(metricsAccuracy.score).toBeGreaterThan(0.95);

      const realTimeConsistency = report.checkResults['real_time_update_consistency'];
      expect(realTimeConsistency.passed).toBe(true);
      expect(realTimeConsistency.details.actual.updateLatency).toBeLessThan(2000);

      console.log(`✅ Monitoring Data Consistency Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`✅ Metrics Accuracy: ${(metricsAccuracy.score * 100).toFixed(1)}%`);
      console.log(`✅ Real-time Update Latency: ${realTimeConsistency.details.actual.updateLatency}ms`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);

    it('should detect and report monitoring data discrepancies', async () => {
      const testState = getTestState();
      
      // Create scenario with potential discrepancies
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data
      const testReceipts = generateTestReceiptData(15);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Introduce some failures to create discrepancies
      setTimeout(() => {
        testState.mockServices.geminiMock.setFailureRate(0.2); // 20% failure rate
      }, 5000);

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 15;
        },
        90000, // 1.5 minutes
        3000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run monitoring consistency checks
      const report = await validator.runCategoryChecks('monitoring', context);

      // Should still maintain reasonable accuracy despite failures
      expect(report.overallScore).toBeGreaterThan(0.85); // 85% accuracy with failures

      // Check that discrepancies are properly detected and reported
      if (report.summary.failedChecks > 0) {
        expect(report.recommendations.length).toBeGreaterThan(0);
        console.log(`⚠️  Detected ${report.summary.failedChecks} monitoring discrepancies`);
        console.log(`📋 Recommendations: ${report.recommendations.join(', ')}`);
      }

      console.log(`✅ Monitoring Consistency with Failures: ${(report.overallScore * 100).toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 120000);
  });

  describe('Queue System Consistency', () => {
    it('should validate queue state consistency', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate test data
      const testReceipts = generateTestReceiptData(30);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for partial processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles >= 15; // Half processed
        },
        60000, // 1 minute
        2000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run queue consistency checks
      const report = await validator.runCategoryChecks('queue', context);

      // Validate queue consistency
      expect(report.overallScore).toBeGreaterThan(0.90); // 90% accuracy
      expect(report.criticalIssues.length).toBe(0);

      // Validate specific queue checks
      const queueStateConsistency = report.checkResults['queue_state_consistency'];
      expect(queueStateConsistency.passed).toBe(true);
      expect(queueStateConsistency.score).toBeGreaterThan(0.90);

      const workerStatusAccuracy = report.checkResults['worker_status_accuracy'];
      expect(workerStatusAccuracy.passed).toBe(true);

      console.log(`✅ Queue System Consistency Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`✅ Queue State Accuracy: ${(queueStateConsistency.score * 100).toFixed(1)}%`);
      console.log(`✅ Worker Status Accuracy: ${(workerStatusAccuracy.score * 100).toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 90000);

    it('should handle queue overflow consistency', async () => {
      const testState = getTestState();
      
      // Start limited workers to create overflow
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate large number of items
      const testReceipts = generateTestReceiptData(50);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Check consistency during overflow
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: Date.now() }
      };

      const report = await validator.runCategoryChecks('queue', context);

      // Should maintain consistency even during overflow
      expect(report.overallScore).toBeGreaterThan(0.85); // 85% accuracy during overflow

      const queueStateConsistency = report.checkResults['queue_state_consistency'];
      expect(queueStateConsistency.details.actual.pendingItems).toBeGreaterThan(30); // Should show overflow

      console.log(`✅ Queue Overflow Consistency: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`✅ Pending Items During Overflow: ${queueStateConsistency.details.actual.pendingItems}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);
  });

  describe('Storage Data Consistency', () => {
    it('should validate embedding-receipt consistency', async () => {
      const testState = getTestState();
      
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

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        120000, // 2 minutes
        3000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run storage consistency checks
      const report = await validator.runCategoryChecks('storage', context);

      // Validate storage consistency
      expect(report.overallScore).toBeGreaterThan(0.95); // 95% accuracy
      expect(report.criticalIssues.length).toBe(0);

      // Validate specific storage checks
      const embeddingConsistency = report.checkResults['embedding_receipt_consistency'];
      expect(embeddingConsistency.passed).toBe(true);
      expect(embeddingConsistency.score).toBeGreaterThan(0.99); // 99% consistency

      const metadataIntegrity = report.checkResults['metadata_integrity'];
      expect(metadataIntegrity.passed).toBe(true);
      expect(metadataIntegrity.score).toBeGreaterThan(0.95);

      console.log(`✅ Storage Data Consistency Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`✅ Embedding-Receipt Consistency: ${(embeddingConsistency.score * 100).toFixed(1)}%`);
      console.log(`✅ Metadata Integrity: ${(metadataIntegrity.score * 100).toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);

    it('should detect orphaned embeddings', async () => {
      const testState = getTestState();
      
      // Create scenario with potential orphaned embeddings
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data
      const testReceipts = generateTestReceiptData(10);
      
      // Create some receipts
      for (const receipt of testReceipts.slice(0, 8)) {
        await testState.supabase.from('receipts').insert({
          id: receipt.id,
          file_name: receipt.fileName,
          user_id: testUser.id,
          team_id: testTeam.id,
          metadata: { test_data: true }
        });
      }

      // Create embeddings for all receipts (including non-existent ones)
      for (const receipt of testReceipts) {
        await testState.supabase.from('embeddings').insert({
          receipt_id: receipt.id,
          embedding_data: new Array(1536).fill(0.1),
          metadata: { test_data: true }
        });
      }

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: Date.now() - 60000, end: Date.now() }
      };

      // Run storage consistency checks
      const report = await validator.runCategoryChecks('storage', context);

      // Should detect orphaned embeddings
      const embeddingConsistency = report.checkResults['embedding_receipt_consistency'];
      expect(embeddingConsistency.passed).toBe(false); // Should fail due to orphaned embeddings
      expect(embeddingConsistency.details.discrepancies.length).toBeGreaterThan(0);

      console.log(`⚠️  Detected orphaned embeddings: ${embeddingConsistency.details.discrepancies.length} issues`);
      console.log(`📋 Recommendations: ${embeddingConsistency.recommendations?.join(', ')}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);
  });

  describe('Cross-System Consistency', () => {
    it('should validate cross-system transaction consistency', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(15);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 15;
        },
        90000, // 1.5 minutes
        3000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run cross-system consistency checks
      const report = await validator.runCategoryChecks('cross-system', context);

      // Validate cross-system consistency
      expect(report.overallScore).toBeGreaterThan(0.90); // 90% accuracy
      expect(report.criticalIssues.length).toBe(0);

      // Validate specific cross-system checks
      const transactionConsistency = report.checkResults['cross_system_transaction_consistency'];
      expect(transactionConsistency.passed).toBe(true);
      expect(transactionConsistency.score).toBeGreaterThan(0.95);

      const concurrentModificationHandling = report.checkResults['concurrent_modification_handling'];
      expect(concurrentModificationHandling.passed).toBe(true);

      console.log(`✅ Cross-System Consistency Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`✅ Transaction Consistency: ${(transactionConsistency.score * 100).toFixed(1)}%`);
      console.log(`✅ Concurrent Modification Handling: ${(concurrentModificationHandling.score * 100).toFixed(1)}%`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 120000);

    it('should handle concurrent modifications correctly', async () => {
      const testState = getTestState();
      
      // Create validation context for concurrent modification test
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: {},
        timeWindow: { start: Date.now(), end: Date.now() + 60000 }
      };

      // Run concurrent modification test multiple times
      const concurrentTests = 5;
      const results: boolean[] = [];

      for (let i = 0; i < concurrentTests; i++) {
        const report = await validator.runCategoryChecks('cross-system', context);
        const concurrentHandling = report.checkResults['concurrent_modification_handling'];
        results.push(concurrentHandling.passed);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Should pass most concurrent modification tests
      const successRate = results.filter(r => r).length / results.length;
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate for concurrent operations

      console.log(`✅ Concurrent Modification Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`✅ Successful Tests: ${results.filter(r => r).length}/${results.length}`);
    }, 60000);
  });

  describe('Complete Data Consistency Validation', () => {
    it('should run complete data consistency validation suite', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate comprehensive test data
      const testReceipts = generateTestReceiptData(30);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      const startTime = Date.now();
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        180000, // 3 minutes
        5000
      );

      const endTime = Date.now();

      // Create validation context
      const context: ValidationContext = {
        supabase: testState.supabase,
        utilities: testState.utilities,
        testData: { receipts: testReceipts },
        timeWindow: { start: startTime, end: endTime }
      };

      // Run complete consistency validation
      const report = await validator.runAllChecks(context);

      // Validate overall consistency
      expect(report.overallScore).toBeGreaterThan(0.90); // 90% overall consistency
      expect(report.criticalIssues.length).toBe(0);
      expect(report.summary.passedChecks).toBeGreaterThan(report.summary.failedChecks);

      // Validate category scores
      expect(report.categoryScores.monitoring).toBeGreaterThan(0.90);
      expect(report.categoryScores.queue).toBeGreaterThan(0.85);
      expect(report.categoryScores.storage).toBeGreaterThan(0.95);
      expect(report.categoryScores['cross-system']).toBeGreaterThan(0.85);

      console.log(`\n📊 Complete Data Consistency Validation Results:`);
      console.log(`Overall Score: ${(report.overallScore * 100).toFixed(1)}%`);
      console.log(`Monitoring: ${(report.categoryScores.monitoring * 100).toFixed(1)}%`);
      console.log(`Queue: ${(report.categoryScores.queue * 100).toFixed(1)}%`);
      console.log(`Storage: ${(report.categoryScores.storage * 100).toFixed(1)}%`);
      console.log(`Cross-System: ${(report.categoryScores['cross-system'] * 100).toFixed(1)}%`);
      console.log(`Passed Checks: ${report.summary.passedChecks}/${report.summary.totalChecks}`);
      
      if (report.criticalIssues.length > 0) {
        console.log(`❌ Critical Issues: ${report.criticalIssues.join(', ')}`);
      }
      
      if (report.recommendations.length > 0) {
        console.log(`📋 Recommendations: ${report.recommendations.slice(0, 3).join(', ')}`);
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000); // 3+ minutes timeout
  });
});
