/**
 * Data Consistency Validation Tests
 * 
 * This test suite validates data consistency across all Phase 4 systems:
 * - Consistency between monitoring data and actual data
 * - Concurrent modification handling
 * - Data integrity across system boundaries
 * - Transaction consistency during failures
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { simulateRandomFailures } from '../setup/mock-services';
import { generateTestReceiptData, generateTestEmbeddingMetrics } from '../fixtures/test-data';

describe('Data Consistency Validation Tests', () => {
  setupTestSuite('Data Consistency Validation');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('data-consistency-test@example.com');
    const team = await createTestTeam(user.id, 'Data Consistency Test Team');
    
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

  describe('Monitoring Data Consistency', () => {
    it('should maintain consistency between monitoring and actual data', async () => {
      const testState = getTestState();
      
      // Create batch session
      const batchSession = await testState.utilities.createBatchSession({
        totalFiles: 25,
        processingStrategy: 'balanced',
        maxConcurrent: 3,
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

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        120000, // 2 minutes
        3000
      );

      // Get data from different sources
      const monitoringMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      const actualReceipts = await testState.supabase
        .from('receipts')
        .select('*')
        .in('id', testReceipts.map(r => r.id));

      const queueRecords = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .in('source_id', testReceipts.map(r => r.id));

      const embeddingRecords = await testState.supabase
        .from('embeddings')
        .select('*')
        .in('receipt_id', testReceipts.map(r => r.id));

      // Validate consistency between monitoring and actual data
      expect(monitoringMetrics.totalAttempts).toBe(25);
      expect(monitoringMetrics.totalAttempts).toBe(queueRecords.data?.length || 0);

      // Successful attempts should match completed queue items
      const completedQueueItems = queueRecords.data?.filter(q => q.status === 'completed') || [];
      expect(monitoringMetrics.successfulAttempts).toBe(completedQueueItems.length);

      // Completed queue items should have corresponding embeddings
      const embeddingReceiptIds = embeddingRecords.data?.map(e => e.receipt_id) || [];
      const completedReceiptIds = completedQueueItems.map(q => q.source_id);
      
      const embeddingConsistency = completedReceiptIds.filter(id => 
        embeddingReceiptIds.includes(id)
      ).length / completedReceiptIds.length;

      expect(embeddingConsistency).toBeGreaterThan(0.99); // 99% consistency

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 140000);

    it('should handle concurrent modifications correctly', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Create test receipt ID for concurrent operations
      const receiptId = `concurrent-test-${Date.now()}`;

      // Simulate concurrent operations on the same receipt
      const concurrentOperations = [
        // Operation 1: Add to queue
        async () => {
          await testState.utilities.addToQueue([{
            source_type: 'receipts',
            source_id: receiptId,
            operation: 'INSERT',
            priority: 'medium'
          }]);
        },
        
        // Operation 2: Update receipt status
        async () => {
          await testState.supabase
            .from('receipts')
            .upsert({
              id: receiptId,
              user_id: testUser.id,
              team_id: testTeam.id,
              file_name: 'concurrent-test.jpg',
              status: 'processing',
              metadata: { test_data: true, concurrent_test: true }
            });
        },
        
        // Operation 3: Record metrics
        async () => {
          await testState.supabase
            .from('embedding_metrics')
            .insert({
              operation_type: 'embedding_generation',
              source_type: 'receipts',
              source_id: receiptId,
              status: 'started',
              processing_time_ms: 0,
              metadata: { test_data: true, concurrent_test: true }
            });
        },
        
        // Operation 4: Update receipt status again
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          await testState.supabase
            .from('receipts')
            .update({ status: 'completed' })
            .eq('id', receiptId);
        },
        
        // Operation 5: Update metrics
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
          await testState.supabase
            .from('embedding_metrics')
            .update({ 
              status: 'completed',
              processing_time_ms: 3500,
              tokens_used: 1200
            })
            .eq('source_id', receiptId);
        }
      ];

      // Execute all operations concurrently
      await Promise.all(concurrentOperations);

      // Wait for operations to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate final state consistency
      const receipt = await testState.supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      const queueItem = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .eq('source_id', receiptId)
        .single();

      const metrics = await testState.supabase
        .from('embedding_metrics')
        .select('*')
        .eq('source_id', receiptId)
        .single();

      // All records should exist and be consistent
      expect(receipt.data?.status).toBe('completed');
      expect(queueItem.data?.source_id).toBe(receiptId);
      expect(metrics.data?.status).toBe('completed');
      expect(metrics.data?.source_id).toBe(receiptId);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);
  });

  describe('Cross-System Data Integrity', () => {
    it('should maintain data integrity across system boundaries', async () => {
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
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(20);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Track data flow across systems
      const dataFlowSnapshots: any[] = [];
      
      const dataFlowMonitor = setInterval(async () => {
        try {
          const batchMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          const queueStatus = await testState.utilities.getQueueStatus();
          
          const queueData = await testState.supabase
            .from('embedding_queue')
            .select('status')
            .in('source_id', testReceipts.map(r => r.id));

          const embeddingData = await testState.supabase
            .from('embeddings')
            .select('*')
            .in('receipt_id', testReceipts.map(r => r.id));

          dataFlowSnapshots.push({
            timestamp: Date.now(),
            batchCompleted: batchMetrics.completedFiles,
            batchFailed: batchMetrics.failedAttempts,
            queuePending: queueStatus.pendingItems,
            queueCompleted: queueData.data?.filter(q => q.status === 'completed').length || 0,
            embeddingsCreated: embeddingData.data?.length || 0
          });
          
          if (batchMetrics.completedFiles + batchMetrics.failedAttempts >= 20) {
            clearInterval(dataFlowMonitor);
          }
        } catch (error) {
          console.warn('Data flow monitoring error:', error);
        }
      }, 2000);

      // Start processing
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        120000, // 2 minutes
        3000
      );

      clearInterval(dataFlowMonitor);

      // Validate data integrity across systems
      const finalSnapshot = dataFlowSnapshots[dataFlowSnapshots.length - 1];
      
      // Data should flow consistently across systems
      expect(finalSnapshot.batchCompleted + finalSnapshot.batchFailed).toBe(20);
      expect(finalSnapshot.queueCompleted).toBe(finalSnapshot.embeddingsCreated);
      expect(finalSnapshot.batchCompleted).toBe(finalSnapshot.embeddingsCreated);

      // Data flow should be monotonic (non-decreasing)
      for (let i = 1; i < dataFlowSnapshots.length; i++) {
        const current = dataFlowSnapshots[i];
        const previous = dataFlowSnapshots[i - 1];
        
        expect(current.batchCompleted).toBeGreaterThanOrEqual(previous.batchCompleted);
        expect(current.embeddingsCreated).toBeGreaterThanOrEqual(previous.embeddingsCreated);
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 140000);

    it('should handle data consistency during system failures', async () => {
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
      const workerIds = await testState.utilities.startQueueWorkers(4);

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

      // Introduce failures during processing
      setTimeout(() => {
        console.log('Introducing failures for consistency testing');
        simulateRandomFailures(testState.mockServices, 0.2); // 20% failure rate
        
        // Kill some workers
        setTimeout(async () => {
          const workersToKill = workerIds.slice(0, 2);
          await testState.utilities.stopQueueWorkers(workersToKill);
        }, 5000);
      }, 10000);

      // Wait for processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
          return metrics.completedFiles + metrics.failedAttempts >= 30;
        },
        180000, // 3 minutes
        5000
      );

      // Validate data consistency despite failures
      const finalMetrics = await testState.utilities.getEmbeddingMetrics(batchSession.id);
      
      const queueRecords = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .in('source_id', testReceipts.map(r => r.id));

      const embeddingRecords = await testState.supabase
        .from('embeddings')
        .select('*')
        .in('receipt_id', testReceipts.map(r => r.id));

      const metricsRecords = await testState.supabase
        .from('embedding_metrics')
        .select('*')
        .in('source_id', testReceipts.map(r => r.id));

      // Data consistency checks
      const completedQueueItems = queueRecords.data?.filter(q => q.status === 'completed') || [];
      const completedMetrics = metricsRecords.data?.filter(m => m.status === 'completed') || [];
      
      // Every completed queue item should have corresponding embedding and metrics
      expect(completedQueueItems.length).toBe(embeddingRecords.data?.length || 0);
      expect(completedQueueItems.length).toBe(completedMetrics.length);
      
      // Monitoring should match actual data
      expect(finalMetrics.successfulAttempts).toBe(completedQueueItems.length);
      expect(finalMetrics.totalAttempts).toBe(30);

      // No orphaned records
      const embeddingReceiptIds = embeddingRecords.data?.map(e => e.receipt_id) || [];
      const completedReceiptIds = completedQueueItems.map(q => q.source_id);
      
      const orphanedEmbeddings = embeddingReceiptIds.filter(id => 
        !completedReceiptIds.includes(id)
      );
      expect(orphanedEmbeddings.length).toBe(0);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds.slice(2)); // Stop remaining workers
    }, 200000);
  });
});
