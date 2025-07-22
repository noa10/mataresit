/**
 * Concurrent Modification Tests
 * 
 * This test suite validates proper handling of concurrent modifications
 * across all Phase 4 systems with race condition detection and resolution.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestReceiptData } from '../fixtures/test-data';

describe('Concurrent Modification Tests', () => {
  setupTestSuite('Concurrent Modification Testing');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('concurrent-mod-test@example.com');
    const team = await createTestTeam(user.id, 'Concurrent Modification Test Team');
    
    testUser = user;
    testTeam = team;
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

  describe('Receipt Concurrent Modifications', () => {
    it('should handle concurrent receipt status updates', async () => {
      const testState = getTestState();
      
      // Create test receipt
      const receiptId = `concurrent-receipt-${Date.now()}`;
      
      // Insert initial receipt
      await testState.supabase.from('receipts').insert({
        id: receiptId,
        file_name: 'concurrent-test.jpg',
        user_id: testUser.id,
        team_id: testTeam.id,
        status: 'pending',
        metadata: { test_data: true, concurrent_test: true }
      });

      // Define concurrent operations
      const concurrentOperations = [
        // Operation 1: Update status to processing
        async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return testState.supabase
            .from('receipts')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', receiptId);
        },
        
        // Operation 2: Update metadata
        async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return testState.supabase
            .from('receipts')
            .update({ 
              metadata: { test_data: true, concurrent_test: true, operation: 'metadata_update' },
              updated_at: new Date().toISOString()
            })
            .eq('id', receiptId);
        },
        
        // Operation 3: Update status to completed
        async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
          return testState.supabase
            .from('receipts')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', receiptId);
        },
        
        // Operation 4: Add processing metrics
        async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 80));
          return testState.supabase
            .from('receipts')
            .update({ 
              metadata: { test_data: true, concurrent_test: true, processing_time: 1500 },
              updated_at: new Date().toISOString()
            })
            .eq('id', receiptId);
        }
      ];

      // Execute concurrent operations
      const results = await Promise.allSettled(concurrentOperations.map(op => op()));

      // Wait for operations to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Validate final state
      const finalReceipt = await testState.supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      // Should have a valid final state
      expect(finalReceipt.data).toBeDefined();
      expect(finalReceipt.data.id).toBe(receiptId);
      expect(['pending', 'processing', 'completed']).toContain(finalReceipt.data.status);

      // Check that at least some operations succeeded
      const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
      expect(successfulOperations).toBeGreaterThan(0);

      // Validate data integrity
      expect(finalReceipt.data.user_id).toBe(testUser.id);
      expect(finalReceipt.data.team_id).toBe(testTeam.id);
      expect(finalReceipt.data.metadata.test_data).toBe(true);

      console.log(`✅ Concurrent Receipt Updates: ${successfulOperations}/4 operations succeeded`);
      console.log(`✅ Final Receipt Status: ${finalReceipt.data.status}`);
    }, 30000);

    it('should prevent data corruption during concurrent modifications', async () => {
      const testState = getTestState();
      
      // Create multiple receipts for concurrent testing
      const receiptCount = 10;
      const receiptIds: string[] = [];

      for (let i = 0; i < receiptCount; i++) {
        const receiptId = `concurrent-receipt-${Date.now()}-${i}`;
        receiptIds.push(receiptId);
        
        await testState.supabase.from('receipts').insert({
          id: receiptId,
          file_name: `concurrent-test-${i}.jpg`,
          user_id: testUser.id,
          team_id: testTeam.id,
          status: 'pending',
          metadata: { test_data: true, receipt_index: i }
        });
      }

      // Create concurrent modification operations for all receipts
      const allOperations: Promise<any>[] = [];

      for (const receiptId of receiptIds) {
        // Multiple operations per receipt
        allOperations.push(
          // Status update
          testState.supabase
            .from('receipts')
            .update({ status: 'processing' })
            .eq('id', receiptId),
          
          // Metadata update
          testState.supabase
            .from('receipts')
            .update({ metadata: { test_data: true, processed: true } })
            .eq('id', receiptId),
          
          // Final status update
          new Promise(resolve => setTimeout(async () => {
            const result = await testState.supabase
              .from('receipts')
              .update({ status: 'completed' })
              .eq('id', receiptId);
            resolve(result);
          }, Math.random() * 200))
        );
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(allOperations);

      // Wait for all operations to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Validate data integrity
      const finalReceipts = await testState.supabase
        .from('receipts')
        .select('*')
        .in('id', receiptIds)
        .order('id');

      // All receipts should exist and have valid data
      expect(finalReceipts.data?.length).toBe(receiptCount);

      let corruptedReceipts = 0;
      let validReceipts = 0;

      for (const receipt of finalReceipts.data || []) {
        // Check for data corruption
        if (!receipt.user_id || !receipt.team_id || !receipt.file_name) {
          corruptedReceipts++;
        } else {
          validReceipts++;
        }

        // Validate required fields
        expect(receipt.user_id).toBe(testUser.id);
        expect(receipt.team_id).toBe(testTeam.id);
        expect(receipt.file_name).toMatch(/concurrent-test-\d+\.jpg/);
      }

      // Should have no data corruption
      expect(corruptedReceipts).toBe(0);
      expect(validReceipts).toBe(receiptCount);

      const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
      console.log(`✅ Concurrent Operations: ${successfulOperations}/${allOperations.length} succeeded`);
      console.log(`✅ Data Integrity: ${validReceipts}/${receiptCount} receipts valid`);
      console.log(`✅ No Data Corruption: ${corruptedReceipts} corrupted receipts`);
    }, 45000);
  });

  describe('Queue Concurrent Modifications', () => {
    it('should handle concurrent queue operations', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Generate test data
      const testReceipts = generateTestReceiptData(20);
      
      // Create concurrent queue operations
      const queueOperations = [
        // Operation 1: Add first batch
        async () => {
          const items = testReceipts.slice(0, 10).map(receipt => ({
            source_type: 'receipts',
            source_id: receipt.id,
            operation: 'INSERT',
            priority: 'medium'
          }));
          return testState.utilities.addToQueue(items);
        },
        
        // Operation 2: Add second batch with delay
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          const items = testReceipts.slice(10, 20).map(receipt => ({
            source_type: 'receipts',
            source_id: receipt.id,
            operation: 'INSERT',
            priority: 'high'
          }));
          return testState.utilities.addToQueue(items);
        },
        
        // Operation 3: Check queue status
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return testState.utilities.getQueueStatus();
        },
        
        // Operation 4: Get metrics
        async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return testState.utilities.getEmbeddingMetrics();
        }
      ];

      // Execute concurrent queue operations
      const results = await Promise.allSettled(queueOperations);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 20;
        },
        120000, // 2 minutes
        3000
      );

      // Validate queue consistency
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // Should process all items
      expect(finalMetrics.totalAttempts).toBe(20);
      expect(finalMetrics.successfulAttempts + finalMetrics.failedAttempts).toBe(20);

      // Queue should be mostly empty
      expect(finalQueueStatus.pendingItems).toBeLessThan(5);

      const successfulQueueOps = results.filter(r => r.status === 'fulfilled').length;
      console.log(`✅ Concurrent Queue Operations: ${successfulQueueOps}/4 succeeded`);
      console.log(`✅ Final Queue State: ${finalQueueStatus.pendingItems} pending, ${finalQueueStatus.activeWorkers} workers`);
      console.log(`✅ Processing Results: ${finalMetrics.successfulAttempts}/${finalMetrics.totalAttempts} successful`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);

    it('should maintain queue integrity during worker failures', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Generate test data
      const testReceipts = generateTestReceiptData(25);
      const queueItems = testReceipts.map(receipt => ({
        source_type: 'receipts',
        source_id: receipt.id,
        operation: 'INSERT',
        priority: 'medium'
      }));

      // Add items to queue
      await testState.utilities.addToQueue(queueItems);

      // Simulate concurrent worker failures and queue operations
      const concurrentOperations = [
        // Operation 1: Kill some workers
        async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const workersToKill = workerIds.slice(0, 2);
          await testState.utilities.stopQueueWorkers(workersToKill);
          console.log('Killed 2 workers during processing');
        },
        
        // Operation 2: Add more items
        async () => {
          await new Promise(resolve => setTimeout(resolve, 8000));
          const additionalReceipts = generateTestReceiptData(10);
          const additionalItems = additionalReceipts.map(receipt => ({
            source_type: 'receipts',
            source_id: `additional-${receipt.id}`,
            operation: 'INSERT',
            priority: 'high'
          }));
          await testState.utilities.addToQueue(additionalItems);
          console.log('Added 10 additional items during worker failure');
        },
        
        // Operation 3: Restart workers
        async () => {
          await new Promise(resolve => setTimeout(resolve, 15000));
          const newWorkerIds = await testState.utilities.startQueueWorkers(3);
          workerIds.push(...newWorkerIds);
          console.log('Restarted 3 workers');
        }
      ];

      // Execute concurrent operations
      const operationResults = await Promise.allSettled(concurrentOperations);

      // Wait for all processing to complete
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 35; // 25 + 10 additional
        },
        180000, // 3 minutes
        5000
      );

      // Validate queue integrity
      const finalMetrics = await testState.utilities.getEmbeddingMetrics();
      const finalQueueStatus = await testState.utilities.getQueueStatus();

      // Should process all items despite worker failures
      expect(finalMetrics.totalAttempts).toBe(35);
      expect(finalMetrics.successfulAttempts / finalMetrics.totalAttempts).toBeGreaterThan(0.8); // 80% success rate

      // Queue should recover
      expect(finalQueueStatus.activeWorkers).toBeGreaterThan(0);
      expect(finalQueueStatus.pendingItems).toBeLessThan(10);

      console.log(`✅ Queue Integrity During Failures: ${finalMetrics.successfulAttempts}/${finalMetrics.totalAttempts} processed`);
      console.log(`✅ Final Queue State: ${finalQueueStatus.pendingItems} pending, ${finalQueueStatus.activeWorkers} workers`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 200000);
  });

  describe('Cross-System Concurrent Modifications', () => {
    it('should handle concurrent modifications across all systems', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(3);

      // Create test receipt for cross-system operations
      const receiptId = `cross-system-${Date.now()}`;
      
      // Define cross-system concurrent operations
      const crossSystemOperations = [
        // Operation 1: Create receipt
        async () => {
          return testState.supabase.from('receipts').insert({
            id: receiptId,
            file_name: 'cross-system-test.jpg',
            user_id: testUser.id,
            team_id: testTeam.id,
            status: 'pending',
            metadata: { test_data: true, cross_system: true }
          });
        },
        
        // Operation 2: Add to queue
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return testState.utilities.addToQueue([{
            source_type: 'receipts',
            source_id: receiptId,
            operation: 'INSERT',
            priority: 'medium'
          }]);
        },
        
        // Operation 3: Update receipt status
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return testState.supabase
            .from('receipts')
            .update({ status: 'processing' })
            .eq('id', receiptId);
        },
        
        // Operation 4: Create embedding metrics
        async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return testState.supabase.from('embedding_metrics').insert({
            operation_type: 'embedding_generation',
            source_type: 'receipts',
            source_id: receiptId,
            status: 'started',
            processing_time_ms: 0,
            metadata: { test_data: true, cross_system: true }
          });
        },
        
        // Operation 5: Update receipt metadata
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return testState.supabase
            .from('receipts')
            .update({ 
              metadata: { test_data: true, cross_system: true, processed: true }
            })
            .eq('id', receiptId);
        }
      ];

      // Execute all operations concurrently
      const results = await Promise.allSettled(crossSystemOperations);

      // Wait for operations to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate final state across all systems
      const finalReceipt = await testState.supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      const queueItem = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .eq('source_id', receiptId)
        .single();

      const metricsRecord = await testState.supabase
        .from('embedding_metrics')
        .select('*')
        .eq('source_id', receiptId)
        .single();

      // Validate cross-system consistency
      expect(finalReceipt.data).toBeDefined();
      expect(queueItem.data).toBeDefined();
      expect(metricsRecord.data).toBeDefined();

      // All records should reference the same receipt
      expect(finalReceipt.data.id).toBe(receiptId);
      expect(queueItem.data.source_id).toBe(receiptId);
      expect(metricsRecord.data.source_id).toBe(receiptId);

      // Metadata should be consistent
      expect(finalReceipt.data.metadata.test_data).toBe(true);
      expect(finalReceipt.data.metadata.cross_system).toBe(true);

      const successfulCrossSystemOps = results.filter(r => r.status === 'fulfilled').length;
      console.log(`✅ Cross-System Operations: ${successfulCrossSystemOps}/5 succeeded`);
      console.log(`✅ Receipt Status: ${finalReceipt.data.status}`);
      console.log(`✅ Queue Item Status: ${queueItem.data.status}`);
      console.log(`✅ Metrics Status: ${metricsRecord.data.status}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);

    it('should maintain data consistency during high concurrency', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(4);

      // Create multiple receipts for high concurrency testing
      const receiptCount = 15;
      const receiptIds: string[] = [];

      // Generate concurrent operations for multiple receipts
      const allOperations: Promise<any>[] = [];

      for (let i = 0; i < receiptCount; i++) {
        const receiptId = `high-concurrency-${Date.now()}-${i}`;
        receiptIds.push(receiptId);

        // Add operations for each receipt
        allOperations.push(
          // Create receipt
          testState.supabase.from('receipts').insert({
            id: receiptId,
            file_name: `high-concurrency-${i}.jpg`,
            user_id: testUser.id,
            team_id: testTeam.id,
            status: 'pending',
            metadata: { test_data: true, receipt_index: i }
          }),
          
          // Add to queue
          new Promise(resolve => setTimeout(async () => {
            const result = await testState.utilities.addToQueue([{
              source_type: 'receipts',
              source_id: receiptId,
              operation: 'INSERT',
              priority: 'medium'
            }]);
            resolve(result);
          }, Math.random() * 100)),
          
          // Update status
          new Promise(resolve => setTimeout(async () => {
            const result = await testState.supabase
              .from('receipts')
              .update({ status: 'processing' })
              .eq('id', receiptId);
            resolve(result);
          }, Math.random() * 200))
        );
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(allOperations);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.totalAttempts >= receiptCount;
        },
        120000, // 2 minutes
        3000
      );

      // Validate data consistency
      const finalReceipts = await testState.supabase
        .from('receipts')
        .select('*')
        .in('id', receiptIds);

      const queueItems = await testState.supabase
        .from('embedding_queue')
        .select('*')
        .in('source_id', receiptIds);

      // All receipts should exist
      expect(finalReceipts.data?.length).toBe(receiptCount);
      
      // All queue items should exist
      expect(queueItems.data?.length).toBe(receiptCount);

      // Validate data integrity
      let consistentRecords = 0;
      for (const receipt of finalReceipts.data || []) {
        const correspondingQueueItem = queueItems.data?.find(q => q.source_id === receipt.id);
        if (correspondingQueueItem) {
          consistentRecords++;
        }
      }

      const consistencyRate = consistentRecords / receiptCount;
      expect(consistencyRate).toBeGreaterThan(0.95); // 95% consistency

      const successfulHighConcurrencyOps = results.filter(r => r.status === 'fulfilled').length;
      console.log(`✅ High Concurrency Operations: ${successfulHighConcurrencyOps}/${allOperations.length} succeeded`);
      console.log(`✅ Data Consistency Rate: ${(consistencyRate * 100).toFixed(1)}%`);
      console.log(`✅ Consistent Records: ${consistentRecords}/${receiptCount}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);
  });
});
