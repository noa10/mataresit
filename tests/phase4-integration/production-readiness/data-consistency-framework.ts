/**
 * Data Consistency Validation Framework
 * 
 * This framework provides comprehensive data consistency validation
 * across all Phase 4 systems including monitoring, queue, and storage.
 */

export interface DataConsistencyCheck {
  name: string;
  description: string;
  category: 'monitoring' | 'queue' | 'storage' | 'cross-system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  validator: (context: ValidationContext) => Promise<ValidationResult>;
}

export interface ValidationContext {
  supabase: any;
  utilities: any;
  testData: any;
  timeWindow: {
    start: number;
    end: number;
  };
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-1, where 1 is perfect consistency
  details: {
    expected: any;
    actual: any;
    discrepancies: string[];
    metrics: Record<string, number>;
  };
  recommendations?: string[];
}

export interface ConsistencyReport {
  timestamp: number;
  overallScore: number;
  categoryScores: Record<string, number>;
  checkResults: Record<string, ValidationResult>;
  criticalIssues: string[];
  recommendations: string[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    averageScore: number;
  };
}

/**
 * Data Consistency Validation Framework
 */
export class DataConsistencyValidator {
  private checks: Map<string, DataConsistencyCheck> = new Map();

  constructor() {
    this.registerDefaultChecks();
  }

  /**
   * Register a consistency check
   */
  registerCheck(check: DataConsistencyCheck): void {
    this.checks.set(check.name, check);
  }

  /**
   * Run all consistency checks
   */
  async runAllChecks(context: ValidationContext): Promise<ConsistencyReport> {
    const results: Record<string, ValidationResult> = {};
    const categoryScores: Record<string, number[]> = {};
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    // Run all checks
    for (const [name, check] of this.checks) {
      try {
        const result = await check.validator(context);
        results[name] = result;

        // Collect category scores
        if (!categoryScores[check.category]) {
          categoryScores[check.category] = [];
        }
        categoryScores[check.category].push(result.score);

        // Collect critical issues
        if (!result.passed && check.severity === 'critical') {
          criticalIssues.push(`${name}: ${result.details.discrepancies.join(', ')}`);
        }

        // Collect recommendations
        if (result.recommendations) {
          recommendations.push(...result.recommendations);
        }

      } catch (error) {
        console.error(`Consistency check failed: ${name}`, error);
        results[name] = {
          passed: false,
          score: 0,
          details: {
            expected: null,
            actual: null,
            discrepancies: [`Check execution failed: ${error.message}`],
            metrics: {}
          }
        };
      }
    }

    // Calculate overall scores
    const allScores = Object.values(results).map(r => r.score);
    const overallScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

    const finalCategoryScores: Record<string, number> = {};
    for (const [category, scores] of Object.entries(categoryScores)) {
      finalCategoryScores[category] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // Generate summary
    const passedChecks = Object.values(results).filter(r => r.passed).length;
    const totalChecks = Object.values(results).length;

    return {
      timestamp: Date.now(),
      overallScore,
      categoryScores: finalCategoryScores,
      checkResults: results,
      criticalIssues,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      summary: {
        totalChecks,
        passedChecks,
        failedChecks: totalChecks - passedChecks,
        averageScore: overallScore
      }
    };
  }

  /**
   * Run checks for a specific category
   */
  async runCategoryChecks(category: string, context: ValidationContext): Promise<ConsistencyReport> {
    const categoryChecks = new Map();
    for (const [name, check] of this.checks) {
      if (check.category === category) {
        categoryChecks.set(name, check);
      }
    }

    const originalChecks = this.checks;
    this.checks = categoryChecks;
    
    try {
      return await this.runAllChecks(context);
    } finally {
      this.checks = originalChecks;
    }
  }

  /**
   * Register default consistency checks
   */
  private registerDefaultChecks(): void {
    // Monitoring data consistency checks
    this.registerCheck({
      name: 'monitoring_metrics_accuracy',
      description: 'Validates accuracy of monitoring metrics against actual data',
      category: 'monitoring',
      severity: 'critical',
      validator: this.validateMonitoringMetricsAccuracy.bind(this)
    });

    this.registerCheck({
      name: 'real_time_update_consistency',
      description: 'Validates real-time updates reflect actual system state',
      category: 'monitoring',
      severity: 'high',
      validator: this.validateRealTimeUpdateConsistency.bind(this)
    });

    // Queue system consistency checks
    this.registerCheck({
      name: 'queue_state_consistency',
      description: 'Validates queue state matches processing results',
      category: 'queue',
      severity: 'critical',
      validator: this.validateQueueStateConsistency.bind(this)
    });

    this.registerCheck({
      name: 'worker_status_accuracy',
      description: 'Validates worker status reporting accuracy',
      category: 'queue',
      severity: 'medium',
      validator: this.validateWorkerStatusAccuracy.bind(this)
    });

    // Storage consistency checks
    this.registerCheck({
      name: 'embedding_receipt_consistency',
      description: 'Validates embeddings match their corresponding receipts',
      category: 'storage',
      severity: 'critical',
      validator: this.validateEmbeddingReceiptConsistency.bind(this)
    });

    this.registerCheck({
      name: 'metadata_integrity',
      description: 'Validates metadata integrity across related records',
      category: 'storage',
      severity: 'high',
      validator: this.validateMetadataIntegrity.bind(this)
    });

    // Cross-system consistency checks
    this.registerCheck({
      name: 'cross_system_transaction_consistency',
      description: 'Validates transaction consistency across all systems',
      category: 'cross-system',
      severity: 'critical',
      validator: this.validateCrossSystemTransactionConsistency.bind(this)
    });

    this.registerCheck({
      name: 'concurrent_modification_handling',
      description: 'Validates proper handling of concurrent modifications',
      category: 'cross-system',
      severity: 'high',
      validator: this.validateConcurrentModificationHandling.bind(this)
    });
  }

  /**
   * Validate monitoring metrics accuracy
   */
  private async validateMonitoringMetricsAccuracy(context: ValidationContext): Promise<ValidationResult> {
    const { supabase, utilities, timeWindow } = context;

    // Get monitoring metrics
    const monitoringMetrics = await utilities.getEmbeddingMetrics();

    // Get actual data from database
    const actualReceipts = await supabase
      .from('receipts')
      .select('*')
      .gte('created_at', new Date(timeWindow.start).toISOString())
      .lte('created_at', new Date(timeWindow.end).toISOString());

    const actualEmbeddings = await supabase
      .from('embeddings')
      .select('*')
      .gte('created_at', new Date(timeWindow.start).toISOString())
      .lte('created_at', new Date(timeWindow.end).toISOString());

    const actualQueueItems = await supabase
      .from('embedding_queue')
      .select('*')
      .gte('created_at', new Date(timeWindow.start).toISOString())
      .lte('created_at', new Date(timeWindow.end).toISOString());

    // Calculate expected metrics
    const expectedMetrics = {
      totalAttempts: actualQueueItems.data?.length || 0,
      successfulAttempts: actualEmbeddings.data?.length || 0,
      failedAttempts: (actualQueueItems.data?.filter(q => q.status === 'failed').length || 0),
      completedFiles: actualEmbeddings.data?.length || 0
    };

    // Compare metrics
    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    const totalAttemptsAccuracy = this.calculateAccuracy(expectedMetrics.totalAttempts, monitoringMetrics.totalAttempts);
    const successfulAttemptsAccuracy = this.calculateAccuracy(expectedMetrics.successfulAttempts, monitoringMetrics.successfulAttempts);
    const failedAttemptsAccuracy = this.calculateAccuracy(expectedMetrics.failedAttempts, monitoringMetrics.failedAttempts);

    metrics.totalAttemptsAccuracy = totalAttemptsAccuracy;
    metrics.successfulAttemptsAccuracy = successfulAttemptsAccuracy;
    metrics.failedAttemptsAccuracy = failedAttemptsAccuracy;

    if (totalAttemptsAccuracy < 0.95) {
      discrepancies.push(`Total attempts accuracy: ${(totalAttemptsAccuracy * 100).toFixed(1)}% (expected: ≥95%)`);
    }

    if (successfulAttemptsAccuracy < 0.95) {
      discrepancies.push(`Successful attempts accuracy: ${(successfulAttemptsAccuracy * 100).toFixed(1)}% (expected: ≥95%)`);
    }

    if (failedAttemptsAccuracy < 0.90) {
      discrepancies.push(`Failed attempts accuracy: ${(failedAttemptsAccuracy * 100).toFixed(1)}% (expected: ≥90%)`);
    }

    const overallAccuracy = (totalAttemptsAccuracy + successfulAttemptsAccuracy + failedAttemptsAccuracy) / 3;

    return {
      passed: discrepancies.length === 0,
      score: overallAccuracy,
      details: {
        expected: expectedMetrics,
        actual: {
          totalAttempts: monitoringMetrics.totalAttempts,
          successfulAttempts: monitoringMetrics.successfulAttempts,
          failedAttempts: monitoringMetrics.failedAttempts,
          completedFiles: monitoringMetrics.completedFiles
        },
        discrepancies,
        metrics
      },
      recommendations: discrepancies.length > 0 ? [
        'Review monitoring metrics calculation logic',
        'Check for race conditions in metrics updates',
        'Validate database query consistency'
      ] : undefined
    };
  }

  /**
   * Validate real-time update consistency
   */
  private async validateRealTimeUpdateConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { utilities } = context;

    // Trigger a known event
    await utilities.triggerEmbeddingEvent();

    // Wait for real-time update
    const updateStartTime = Date.now();
    let updateDetected = false;
    let updateLatency = 0;

    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const metrics = await utilities.getEmbeddingMetrics();
      
      if (metrics.totalAttempts > 0) {
        updateDetected = true;
        updateLatency = Date.now() - updateStartTime;
        break;
      }
    }

    const discrepancies: string[] = [];
    const metrics: Record<string, number> = { updateLatency };

    if (!updateDetected) {
      discrepancies.push('Real-time update not detected within 5 seconds');
    }

    if (updateLatency > 2000) {
      discrepancies.push(`Update latency too high: ${updateLatency}ms (expected: <2000ms)`);
    }

    const score = updateDetected ? Math.max(0, 1 - (updateLatency / 5000)) : 0;

    return {
      passed: discrepancies.length === 0,
      score,
      details: {
        expected: { updateDetected: true, maxLatency: 2000 },
        actual: { updateDetected, updateLatency },
        discrepancies,
        metrics
      },
      recommendations: discrepancies.length > 0 ? [
        'Check real-time update mechanism',
        'Optimize database triggers and subscriptions',
        'Review caching strategies'
      ] : undefined
    };
  }

  /**
   * Validate queue state consistency
   */
  private async validateQueueStateConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { supabase, utilities } = context;

    // Get queue status from monitoring
    const queueStatus = await utilities.getQueueStatus();

    // Get actual queue data
    const actualQueueItems = await supabase
      .from('embedding_queue')
      .select('*');

    const actualPendingItems = actualQueueItems.data?.filter(q => 
      q.status === 'pending' || q.status === 'processing'
    ).length || 0;

    const actualCompletedItems = actualQueueItems.data?.filter(q => 
      q.status === 'completed'
    ).length || 0;

    const actualFailedItems = actualQueueItems.data?.filter(q => 
      q.status === 'failed'
    ).length || 0;

    // Compare queue states
    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    const pendingAccuracy = this.calculateAccuracy(actualPendingItems, queueStatus.pendingItems);
    metrics.pendingItemsAccuracy = pendingAccuracy;

    if (pendingAccuracy < 0.95) {
      discrepancies.push(`Pending items accuracy: ${(pendingAccuracy * 100).toFixed(1)}% (expected: ≥95%)`);
    }

    if (Math.abs(actualPendingItems - queueStatus.pendingItems) > 5) {
      discrepancies.push(`Pending items mismatch: expected ${actualPendingItems}, got ${queueStatus.pendingItems}`);
    }

    return {
      passed: discrepancies.length === 0,
      score: pendingAccuracy,
      details: {
        expected: {
          pendingItems: actualPendingItems,
          completedItems: actualCompletedItems,
          failedItems: actualFailedItems
        },
        actual: {
          pendingItems: queueStatus.pendingItems,
          activeWorkers: queueStatus.activeWorkers
        },
        discrepancies,
        metrics
      },
      recommendations: discrepancies.length > 0 ? [
        'Review queue status calculation logic',
        'Check for stale queue item statuses',
        'Validate worker status reporting'
      ] : undefined
    };
  }

  /**
   * Validate worker status accuracy
   */
  private async validateWorkerStatusAccuracy(context: ValidationContext): Promise<ValidationResult> {
    const { supabase, utilities } = context;

    // Get worker status from monitoring
    const queueStatus = await utilities.getQueueStatus();

    // Get actual worker data
    const actualWorkers = await supabase
      .from('embedding_queue_workers')
      .select('*')
      .eq('status', 'active');

    const expectedActiveWorkers = actualWorkers.data?.length || 0;
    const reportedActiveWorkers = queueStatus.activeWorkers;

    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    const workerAccuracy = this.calculateAccuracy(expectedActiveWorkers, reportedActiveWorkers);
    metrics.workerStatusAccuracy = workerAccuracy;

    if (workerAccuracy < 0.90) {
      discrepancies.push(`Worker status accuracy: ${(workerAccuracy * 100).toFixed(1)}% (expected: ≥90%)`);
    }

    return {
      passed: discrepancies.length === 0,
      score: workerAccuracy,
      details: {
        expected: { activeWorkers: expectedActiveWorkers },
        actual: { activeWorkers: reportedActiveWorkers },
        discrepancies,
        metrics
      }
    };
  }

  /**
   * Validate embedding-receipt consistency
   */
  private async validateEmbeddingReceiptConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { supabase } = context;

    // Get all embeddings and their corresponding receipts
    const embeddings = await supabase
      .from('embeddings')
      .select('receipt_id, embedding_data, metadata');

    const receipts = await supabase
      .from('receipts')
      .select('id, file_name, metadata')
      .in('id', embeddings.data?.map(e => e.receipt_id) || []);

    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    let consistentEmbeddings = 0;
    const totalEmbeddings = embeddings.data?.length || 0;

    for (const embedding of embeddings.data || []) {
      const correspondingReceipt = receipts.data?.find(r => r.id === embedding.receipt_id);
      
      if (!correspondingReceipt) {
        discrepancies.push(`Orphaned embedding found for receipt_id: ${embedding.receipt_id}`);
      } else {
        consistentEmbeddings++;
      }
    }

    const consistencyRate = totalEmbeddings > 0 ? consistentEmbeddings / totalEmbeddings : 1;
    metrics.embeddingReceiptConsistency = consistencyRate;

    if (consistencyRate < 0.99) {
      discrepancies.push(`Embedding-receipt consistency: ${(consistencyRate * 100).toFixed(1)}% (expected: ≥99%)`);
    }

    return {
      passed: discrepancies.length === 0,
      score: consistencyRate,
      details: {
        expected: { consistencyRate: 1.0 },
        actual: { consistencyRate, totalEmbeddings, consistentEmbeddings },
        discrepancies,
        metrics
      },
      recommendations: discrepancies.length > 0 ? [
        'Review embedding creation process',
        'Check for race conditions in receipt-embedding creation',
        'Implement referential integrity constraints'
      ] : undefined
    };
  }

  /**
   * Validate metadata integrity
   */
  private async validateMetadataIntegrity(context: ValidationContext): Promise<ValidationResult> {
    const { supabase } = context;

    // Check metadata consistency across related tables
    const receipts = await supabase
      .from('receipts')
      .select('id, metadata, team_id, user_id');

    const embeddings = await supabase
      .from('embeddings')
      .select('receipt_id, metadata');

    const queueItems = await supabase
      .from('embedding_queue')
      .select('source_id, metadata');

    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    let consistentMetadata = 0;
    let totalChecked = 0;

    for (const receipt of receipts.data || []) {
      const relatedEmbedding = embeddings.data?.find(e => e.receipt_id === receipt.id);
      const relatedQueueItem = queueItems.data?.find(q => q.source_id === receipt.id);

      totalChecked++;

      // Check if metadata is consistent
      let isConsistent = true;

      if (relatedEmbedding && receipt.metadata?.test_data !== relatedEmbedding.metadata?.test_data) {
        isConsistent = false;
      }

      if (relatedQueueItem && receipt.metadata?.test_data !== relatedQueueItem.metadata?.test_data) {
        isConsistent = false;
      }

      if (isConsistent) {
        consistentMetadata++;
      }
    }

    const metadataConsistency = totalChecked > 0 ? consistentMetadata / totalChecked : 1;
    metrics.metadataIntegrity = metadataConsistency;

    if (metadataConsistency < 0.95) {
      discrepancies.push(`Metadata integrity: ${(metadataConsistency * 100).toFixed(1)}% (expected: ≥95%)`);
    }

    return {
      passed: discrepancies.length === 0,
      score: metadataConsistency,
      details: {
        expected: { metadataConsistency: 1.0 },
        actual: { metadataConsistency, totalChecked, consistentMetadata },
        discrepancies,
        metrics
      }
    };
  }

  /**
   * Validate cross-system transaction consistency
   */
  private async validateCrossSystemTransactionConsistency(context: ValidationContext): Promise<ValidationResult> {
    const { supabase } = context;

    // Check for transactions that should be atomic across systems
    const recentReceipts = await supabase
      .from('receipts')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: false })
      .limit(100);

    const discrepancies: string[] = [];
    const metrics: Record<string, number> = {};

    let consistentTransactions = 0;
    const totalTransactions = recentReceipts.data?.length || 0;

    for (const receipt of recentReceipts.data || []) {
      // Check if receipt has corresponding queue entry
      const queueEntry = await supabase
        .from('embedding_queue')
        .select('*')
        .eq('source_id', receipt.id)
        .single();

      if (queueEntry.data) {
        consistentTransactions++;
      } else {
        discrepancies.push(`Receipt ${receipt.id} missing queue entry`);
      }
    }

    const transactionConsistency = totalTransactions > 0 ? consistentTransactions / totalTransactions : 1;
    metrics.transactionConsistency = transactionConsistency;

    if (transactionConsistency < 0.98) {
      discrepancies.push(`Transaction consistency: ${(transactionConsistency * 100).toFixed(1)}% (expected: ≥98%)`);
    }

    return {
      passed: discrepancies.length === 0,
      score: transactionConsistency,
      details: {
        expected: { transactionConsistency: 1.0 },
        actual: { transactionConsistency, totalTransactions, consistentTransactions },
        discrepancies,
        metrics
      },
      recommendations: discrepancies.length > 0 ? [
        'Review transaction boundaries',
        'Implement proper rollback mechanisms',
        'Check for race conditions in multi-system operations'
      ] : undefined
    };
  }

  /**
   * Validate concurrent modification handling
   */
  private async validateConcurrentModificationHandling(context: ValidationContext): Promise<ValidationResult> {
    const { supabase, utilities } = context;

    // Simulate concurrent modifications
    const testReceiptId = `concurrent-test-${Date.now()}`;
    
    // Create concurrent operations
    const operations = [
      // Operation 1: Create receipt
      supabase.from('receipts').insert({
        id: testReceiptId,
        file_name: 'concurrent-test.jpg',
        status: 'processing',
        metadata: { test_data: true, concurrent_test: true }
      }),
      
      // Operation 2: Add to queue
      utilities.addToQueue([{
        source_type: 'receipts',
        source_id: testReceiptId,
        operation: 'INSERT',
        priority: 'medium'
      }]),
      
      // Operation 3: Update receipt status
      new Promise(resolve => setTimeout(async () => {
        await supabase.from('receipts')
          .update({ status: 'completed' })
          .eq('id', testReceiptId);
        resolve(null);
      }, 100))
    ];

    try {
      await Promise.all(operations);
      
      // Wait for operations to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Validate final state
      const finalReceipt = await supabase
        .from('receipts')
        .select('*')
        .eq('id', testReceiptId)
        .single();

      const queueItem = await supabase
        .from('embedding_queue')
        .select('*')
        .eq('source_id', testReceiptId)
        .single();

      const discrepancies: string[] = [];
      const metrics: Record<string, number> = {};

      let concurrencyScore = 1.0;

      if (!finalReceipt.data) {
        discrepancies.push('Receipt not created during concurrent operations');
        concurrencyScore -= 0.5;
      }

      if (!queueItem.data) {
        discrepancies.push('Queue item not created during concurrent operations');
        concurrencyScore -= 0.5;
      }

      if (finalReceipt.data && finalReceipt.data.status !== 'completed') {
        discrepancies.push('Receipt status not updated correctly during concurrent operations');
        concurrencyScore -= 0.3;
      }

      metrics.concurrentModificationHandling = concurrencyScore;

      return {
        passed: discrepancies.length === 0,
        score: Math.max(0, concurrencyScore),
        details: {
          expected: { receiptCreated: true, queueItemCreated: true, statusUpdated: true },
          actual: { 
            receiptCreated: !!finalReceipt.data,
            queueItemCreated: !!queueItem.data,
            statusUpdated: finalReceipt.data?.status === 'completed'
          },
          discrepancies,
          metrics
        },
        recommendations: discrepancies.length > 0 ? [
          'Implement proper locking mechanisms',
          'Review transaction isolation levels',
          'Add optimistic concurrency control'
        ] : undefined
      };

    } catch (error) {
      return {
        passed: false,
        score: 0,
        details: {
          expected: { operationsSuccessful: true },
          actual: { operationsSuccessful: false },
          discrepancies: [`Concurrent operations failed: ${error.message}`],
          metrics: { concurrentModificationHandling: 0 }
        },
        recommendations: [
          'Review error handling in concurrent scenarios',
          'Implement proper retry mechanisms',
          'Check for deadlock conditions'
        ]
      };
    }
  }

  /**
   * Calculate accuracy between expected and actual values
   */
  private calculateAccuracy(expected: number, actual: number): number {
    if (expected === 0 && actual === 0) return 1.0;
    if (expected === 0) return actual === 0 ? 1.0 : 0.0;
    
    const difference = Math.abs(expected - actual);
    const accuracy = Math.max(0, 1 - (difference / expected));
    return accuracy;
  }
}
