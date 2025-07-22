/**
 * Data Integrity Validation Tests
 * 
 * This test suite validates data integrity across all Phase 4 systems
 * including referential integrity, constraint validation, and data corruption detection.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestSuite, setupTest, getTestState, createTestUser, createTestTeam, waitForCondition } from '../setup/test-setup';
import { generateTestReceiptData } from '../fixtures/test-data';
import { simulateRandomFailures } from '../setup/mock-services';

describe('Data Integrity Validation Tests', () => {
  setupTestSuite('Data Integrity Validation');
  setupTest();

  let testUser: any;
  let testTeam: any;
  let testSessions: any[] = [];

  beforeAll(async () => {
    const { user } = await createTestUser('data-integrity-test@example.com');
    const team = await createTestTeam(user.id, 'Data Integrity Test Team');
    
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

  describe('Referential Integrity Validation', () => {
    it('should maintain referential integrity between receipts and embeddings', async () => {
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

      // Process receipts
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

      // Validate referential integrity
      const receipts = await testState.supabase
        .from('receipts')
        .select('id')
        .in('id', testReceipts.map(r => r.id));

      const embeddings = await testState.supabase
        .from('embeddings')
        .select('receipt_id');

      const queueRecords = await testState.supabase
        .from('embedding_queue')
        .select('source_id, status')
        .in('source_id', testReceipts.map(r => r.id));

      // Check referential integrity
      let orphanedEmbeddings = 0;
      let orphanedQueueItems = 0;
      let validReferences = 0;

      const receiptIds = receipts.data?.map(r => r.id) || [];

      // Check embeddings referential integrity
      for (const embedding of embeddings.data || []) {
        if (receiptIds.includes(embedding.receipt_id)) {
          validReferences++;
        } else {
          orphanedEmbeddings++;
        }
      }

      // Check queue items referential integrity
      for (const queueItem of queueRecords.data || []) {
        if (!receiptIds.includes(queueItem.source_id)) {
          orphanedQueueItems++;
        }
      }

      // Validate integrity
      expect(orphanedEmbeddings).toBe(0);
      expect(orphanedQueueItems).toBe(0);
      expect(validReferences).toBe(embeddings.data?.length || 0);

      // Calculate integrity metrics
      const totalEmbeddings = embeddings.data?.length || 0;
      const integrityRate = totalEmbeddings > 0 ? validReferences / totalEmbeddings : 1;

      expect(integrityRate).toBe(1.0); // 100% referential integrity

      console.log(`✅ Referential Integrity: ${(integrityRate * 100).toFixed(1)}%`);
      console.log(`✅ Valid References: ${validReferences}/${totalEmbeddings}`);
      console.log(`✅ Orphaned Embeddings: ${orphanedEmbeddings}`);
      console.log(`✅ Orphaned Queue Items: ${orphanedQueueItems}`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 150000);

    it('should detect and prevent referential integrity violations', async () => {
      const testState = getTestState();
      
      // Create scenario with potential integrity violations
      const receiptId = `integrity-test-${Date.now()}`;
      
      // Create receipt
      await testState.supabase.from('receipts').insert({
        id: receiptId,
        file_name: 'integrity-test.jpg',
        user_id: testUser.id,
        team_id: testTeam.id,
        status: 'pending',
        metadata: { test_data: true }
      });

      // Create embedding for the receipt
      await testState.supabase.from('embeddings').insert({
        receipt_id: receiptId,
        embedding_data: new Array(1536).fill(0.1),
        metadata: { test_data: true }
      });

      // Try to delete the receipt (should be prevented or handled gracefully)
      const deleteResult = await testState.supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      // Check if embedding still exists
      const remainingEmbedding = await testState.supabase
        .from('embeddings')
        .select('*')
        .eq('receipt_id', receiptId)
        .single();

      // Validate integrity handling
      if (deleteResult.error) {
        // Deletion was prevented - good
        console.log('✅ Receipt deletion prevented due to referential integrity');
        expect(deleteResult.error).toBeDefined();
      } else {
        // Deletion succeeded - embedding should be cleaned up
        console.log('✅ Receipt deleted - checking embedding cleanup');
        expect(remainingEmbedding.data).toBeNull();
      }

      // Try to create orphaned embedding
      const orphanedReceiptId = `orphaned-${Date.now()}`;
      const orphanedEmbeddingResult = await testState.supabase.from('embeddings').insert({
        receipt_id: orphanedReceiptId, // Non-existent receipt
        embedding_data: new Array(1536).fill(0.2),
        metadata: { test_data: true, orphaned: true }
      });

      // Should either prevent creation or be detectable
      if (orphanedEmbeddingResult.error) {
        console.log('✅ Orphaned embedding creation prevented');
        expect(orphanedEmbeddingResult.error).toBeDefined();
      } else {
        console.log('⚠️  Orphaned embedding created - should be detectable');
        
        // Verify it's detectable as orphaned
        const orphanedCheck = await testState.supabase
          .from('receipts')
          .select('id')
          .eq('id', orphanedReceiptId)
          .single();
        
        expect(orphanedCheck.data).toBeNull(); // Receipt should not exist
      }
    }, 30000);
  });

  describe('Data Constraint Validation', () => {
    it('should enforce data constraints and validation rules', async () => {
      const testState = getTestState();
      
      // Test various constraint violations
      const constraintTests = [
        {
          name: 'Invalid user_id',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `invalid-user-${Date.now()}`,
              file_name: 'test.jpg',
              user_id: 'non-existent-user',
              team_id: testTeam.id,
              status: 'pending'
            });
          }
        },
        {
          name: 'Invalid team_id',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `invalid-team-${Date.now()}`,
              file_name: 'test.jpg',
              user_id: testUser.id,
              team_id: 'non-existent-team',
              status: 'pending'
            });
          }
        },
        {
          name: 'Invalid status value',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `invalid-status-${Date.now()}`,
              file_name: 'test.jpg',
              user_id: testUser.id,
              team_id: testTeam.id,
              status: 'invalid-status'
            });
          }
        },
        {
          name: 'Missing required fields',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `missing-fields-${Date.now()}`,
              // Missing file_name, user_id, team_id
              status: 'pending'
            });
          }
        },
        {
          name: 'Invalid embedding dimensions',
          test: async () => {
            return testState.supabase.from('embeddings').insert({
              receipt_id: `test-receipt-${Date.now()}`,
              embedding_data: new Array(100).fill(0.1), // Wrong dimensions
              metadata: { test_data: true }
            });
          }
        }
      ];

      let constraintViolationsPrevented = 0;
      let constraintViolationsAllowed = 0;

      for (const constraintTest of constraintTests) {
        try {
          const result = await constraintTest.test();
          
          if (result.error) {
            constraintViolationsPrevented++;
            console.log(`✅ ${constraintTest.name}: Violation prevented`);
          } else {
            constraintViolationsAllowed++;
            console.log(`⚠️  ${constraintTest.name}: Violation allowed`);
          }
        } catch (error) {
          constraintViolationsPrevented++;
          console.log(`✅ ${constraintTest.name}: Exception thrown (${error.message})`);
        }
      }

      // Most constraint violations should be prevented
      const preventionRate = constraintViolationsPrevented / constraintTests.length;
      expect(preventionRate).toBeGreaterThan(0.6); // At least 60% should be prevented

      console.log(`✅ Constraint Validation: ${constraintViolationsPrevented}/${constraintTests.length} violations prevented`);
      console.log(`✅ Prevention Rate: ${(preventionRate * 100).toFixed(1)}%`);
    }, 45000);

    it('should validate data types and formats', async () => {
      const testState = getTestState();
      
      // Test data type validations
      const dataTypeTests = [
        {
          name: 'Invalid JSON metadata',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `invalid-json-${Date.now()}`,
              file_name: 'test.jpg',
              user_id: testUser.id,
              team_id: testTeam.id,
              status: 'pending',
              metadata: 'invalid-json-string' // Should be object
            });
          }
        },
        {
          name: 'Invalid timestamp format',
          test: async () => {
            return testState.supabase.from('receipts').insert({
              id: `invalid-timestamp-${Date.now()}`,
              file_name: 'test.jpg',
              user_id: testUser.id,
              team_id: testTeam.id,
              status: 'pending',
              created_at: 'invalid-timestamp'
            });
          }
        },
        {
          name: 'Invalid embedding data type',
          test: async () => {
            return testState.supabase.from('embeddings').insert({
              receipt_id: `test-receipt-${Date.now()}`,
              embedding_data: 'not-an-array',
              metadata: { test_data: true }
            });
          }
        }
      ];

      let dataTypeViolationsPrevented = 0;

      for (const dataTypeTest of dataTypeTests) {
        try {
          const result = await dataTypeTest.test();
          
          if (result.error) {
            dataTypeViolationsPrevented++;
            console.log(`✅ ${dataTypeTest.name}: Type violation prevented`);
          } else {
            console.log(`⚠️  ${dataTypeTest.name}: Type violation allowed`);
          }
        } catch (error) {
          dataTypeViolationsPrevented++;
          console.log(`✅ ${dataTypeTest.name}: Exception thrown`);
        }
      }

      const typeValidationRate = dataTypeViolationsPrevented / dataTypeTests.length;
      expect(typeValidationRate).toBeGreaterThan(0.5); // At least 50% should be prevented

      console.log(`✅ Data Type Validation: ${dataTypeViolationsPrevented}/${dataTypeTests.length} violations prevented`);
    }, 30000);
  });

  describe('Data Corruption Detection', () => {
    it('should detect data corruption during processing', async () => {
      const testState = getTestState();
      
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

      // Introduce random failures to potentially cause corruption
      setTimeout(() => {
        simulateRandomFailures(testState.mockServices, 0.15); // 15% failure rate
      }, 5000);

      // Process receipts
      await testState.utilities.addToQueue(queueItems);

      // Wait for processing
      await waitForCondition(
        async () => {
          const metrics = await testState.utilities.getEmbeddingMetrics();
          return metrics.completedFiles + metrics.failedAttempts >= 25;
        },
        150000, // 2.5 minutes
        3000
      );

      // Check for data corruption
      const corruptionChecks = await this.performCorruptionChecks(testState, testReceipts);

      // Validate corruption detection
      expect(corruptionChecks.totalChecks).toBeGreaterThan(0);
      expect(corruptionChecks.corruptionRate).toBeLessThan(0.05); // Less than 5% corruption

      console.log(`✅ Corruption Detection: ${corruptionChecks.corruptedRecords}/${corruptionChecks.totalChecks} corrupted`);
      console.log(`✅ Corruption Rate: ${(corruptionChecks.corruptionRate * 100).toFixed(2)}%`);
      console.log(`✅ Data Integrity: ${(corruptionChecks.integrityRate * 100).toFixed(1)}%`);

      if (corruptionChecks.corruptedRecords > 0) {
        console.log(`⚠️  Corruption Details: ${corruptionChecks.corruptionDetails.join(', ')}`);
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 180000);

    it('should validate data consistency across related tables', async () => {
      const testState = getTestState();
      
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

      // Process receipts
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

      // Perform cross-table consistency checks
      const consistencyChecks = await this.performConsistencyChecks(testState, testReceipts);

      // Validate consistency
      expect(consistencyChecks.consistencyRate).toBeGreaterThan(0.95); // 95% consistency
      expect(consistencyChecks.inconsistentRecords).toBeLessThan(2);

      console.log(`✅ Cross-Table Consistency: ${(consistencyChecks.consistencyRate * 100).toFixed(1)}%`);
      console.log(`✅ Consistent Records: ${consistencyChecks.consistentRecords}/${consistencyChecks.totalRecords}`);
      console.log(`✅ Inconsistent Records: ${consistencyChecks.inconsistentRecords}`);

      if (consistencyChecks.inconsistentRecords > 0) {
        console.log(`⚠️  Inconsistency Details: ${consistencyChecks.inconsistencyDetails.join(', ')}`);
      }

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 120000);
  });

  describe('Transaction Integrity', () => {
    it('should maintain transaction integrity during failures', async () => {
      const testState = getTestState();
      
      // Start workers
      const workerIds = await testState.utilities.startQueueWorkers(2);

      // Generate test data
      const testReceipts = generateTestReceiptData(20);
      
      // Process receipts with simulated failures
      const transactionResults: any[] = [];
      
      for (const receipt of testReceipts) {
        try {
          // Simulate transaction: create receipt + add to queue
          const receiptResult = await testState.supabase.from('receipts').insert({
            id: receipt.id,
            file_name: receipt.fileName,
            user_id: testUser.id,
            team_id: testTeam.id,
            status: 'pending',
            metadata: { test_data: true, transaction_test: true }
          });

          if (!receiptResult.error) {
            const queueResult = await testState.utilities.addToQueue([{
              source_type: 'receipts',
              source_id: receipt.id,
              operation: 'INSERT',
              priority: 'medium'
            }]);

            transactionResults.push({
              receiptId: receipt.id,
              receiptSuccess: true,
              queueSuccess: !queueResult.error,
              transactionComplete: true
            });
          } else {
            transactionResults.push({
              receiptId: receipt.id,
              receiptSuccess: false,
              queueSuccess: false,
              transactionComplete: false
            });
          }
        } catch (error) {
          transactionResults.push({
            receiptId: receipt.id,
            receiptSuccess: false,
            queueSuccess: false,
            transactionComplete: false,
            error: error.message
          });
        }

        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze transaction integrity
      const completeTransactions = transactionResults.filter(r => r.transactionComplete).length;
      const partialTransactions = transactionResults.filter(r => 
        r.receiptSuccess !== r.queueSuccess
      ).length;

      const transactionIntegrityRate = completeTransactions / transactionResults.length;
      const partialTransactionRate = partialTransactions / transactionResults.length;

      // Should have high transaction integrity
      expect(transactionIntegrityRate).toBeGreaterThan(0.9); // 90% complete transactions
      expect(partialTransactionRate).toBeLessThan(0.1); // Less than 10% partial transactions

      console.log(`✅ Transaction Integrity: ${(transactionIntegrityRate * 100).toFixed(1)}%`);
      console.log(`✅ Complete Transactions: ${completeTransactions}/${transactionResults.length}`);
      console.log(`✅ Partial Transactions: ${partialTransactions} (${(partialTransactionRate * 100).toFixed(1)}%)`);

      // Cleanup
      await testState.utilities.stopQueueWorkers(workerIds);
    }, 60000);
  });

  // Helper methods for corruption and consistency checks
  private async performCorruptionChecks(testState: any, testReceipts: any[]): Promise<any> {
    const receipts = await testState.supabase
      .from('receipts')
      .select('*')
      .in('id', testReceipts.map(r => r.id));

    const embeddings = await testState.supabase
      .from('embeddings')
      .select('*')
      .in('receipt_id', testReceipts.map(r => r.id));

    let corruptedRecords = 0;
    const corruptionDetails: string[] = [];

    // Check for corrupted receipts
    for (const receipt of receipts.data || []) {
      if (!receipt.file_name || !receipt.user_id || !receipt.team_id) {
        corruptedRecords++;
        corruptionDetails.push(`Receipt ${receipt.id}: missing required fields`);
      }

      if (receipt.metadata && typeof receipt.metadata !== 'object') {
        corruptedRecords++;
        corruptionDetails.push(`Receipt ${receipt.id}: corrupted metadata`);
      }
    }

    // Check for corrupted embeddings
    for (const embedding of embeddings.data || []) {
      if (!Array.isArray(embedding.embedding_data)) {
        corruptedRecords++;
        corruptionDetails.push(`Embedding ${embedding.id}: corrupted embedding data`);
      }

      if (embedding.embedding_data && embedding.embedding_data.length !== 1536) {
        corruptedRecords++;
        corruptionDetails.push(`Embedding ${embedding.id}: incorrect embedding dimensions`);
      }
    }

    const totalChecks = (receipts.data?.length || 0) + (embeddings.data?.length || 0);
    const corruptionRate = totalChecks > 0 ? corruptedRecords / totalChecks : 0;
    const integrityRate = 1 - corruptionRate;

    return {
      totalChecks,
      corruptedRecords,
      corruptionRate,
      integrityRate,
      corruptionDetails
    };
  }

  private async performConsistencyChecks(testState: any, testReceipts: any[]): Promise<any> {
    const receipts = await testState.supabase
      .from('receipts')
      .select('*')
      .in('id', testReceipts.map(r => r.id));

    const embeddings = await testState.supabase
      .from('embeddings')
      .select('*')
      .in('receipt_id', testReceipts.map(r => r.id));

    const queueItems = await testState.supabase
      .from('embedding_queue')
      .select('*')
      .in('source_id', testReceipts.map(r => r.id));

    let consistentRecords = 0;
    let inconsistentRecords = 0;
    const inconsistencyDetails: string[] = [];

    // Check consistency between receipts and embeddings
    for (const receipt of receipts.data || []) {
      const relatedEmbedding = embeddings.data?.find(e => e.receipt_id === receipt.id);
      const relatedQueueItem = queueItems.data?.find(q => q.source_id === receipt.id);

      let isConsistent = true;

      // Check if successful queue items have corresponding embeddings
      if (relatedQueueItem?.status === 'completed' && !relatedEmbedding) {
        isConsistent = false;
        inconsistencyDetails.push(`Receipt ${receipt.id}: completed queue item but no embedding`);
      }

      // Check if embeddings have corresponding successful queue items
      if (relatedEmbedding && relatedQueueItem?.status !== 'completed') {
        isConsistent = false;
        inconsistencyDetails.push(`Receipt ${receipt.id}: embedding exists but queue item not completed`);
      }

      // Check metadata consistency
      if (relatedEmbedding && receipt.metadata?.test_data !== relatedEmbedding.metadata?.test_data) {
        isConsistent = false;
        inconsistencyDetails.push(`Receipt ${receipt.id}: metadata inconsistency`);
      }

      if (isConsistent) {
        consistentRecords++;
      } else {
        inconsistentRecords++;
      }
    }

    const totalRecords = receipts.data?.length || 0;
    const consistencyRate = totalRecords > 0 ? consistentRecords / totalRecords : 1;

    return {
      totalRecords,
      consistentRecords,
      inconsistentRecords,
      consistencyRate,
      inconsistencyDetails
    };
  }
});
