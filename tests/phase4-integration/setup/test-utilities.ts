/**
 * Test Utilities for Phase 4 Integration Tests
 * 
 * This file provides common utilities and helper functions for integration testing
 * of the batch upload, queue, and monitoring systems.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { TestConfig } from './test-setup';

export class TestUtilities {
  constructor(
    private supabase: SupabaseClient,
    private config: TestConfig
  ) {}

  /**
   * Generate test receipt files for batch upload testing
   */
  generateTestReceiptFiles(count: number): File[] {
    const files: File[] = [];
    
    for (let i = 1; i <= count; i++) {
      // Create a simple test image blob
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 600;
      const ctx = canvas.getContext('2d')!;
      
      // Draw a simple receipt-like image
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 600);
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText(`Test Receipt ${i}`, 50, 50);
      ctx.fillText(`Merchant: Test Store ${i}`, 50, 100);
      ctx.fillText(`Amount: $${(Math.random() * 100).toFixed(2)}`, 50, 150);
      ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 50, 200);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `test-receipt-${i}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          files.push(file);
        }
      }, 'image/jpeg', 0.8);
    }
    
    return files;
  }

  /**
   * Create a batch upload session for testing
   */
  async createBatchSession(options: {
    totalFiles: number;
    processingStrategy?: string;
    maxConcurrent?: number;
    userId?: string;
    teamId?: string;
  }): Promise<any> {
    const sessionData = {
      user_id: options.userId || 'test-user-id',
      team_id: options.teamId || 'test-team-id',
      session_name: `test-batch-${Date.now()}`,
      total_files: options.totalFiles,
      files_completed: 0,
      files_failed: 0,
      files_pending: options.totalFiles,
      max_concurrent: options.maxConcurrent || 3,
      processing_strategy: options.processingStrategy || 'balanced',
      status: 'pending',
      rate_limit_config: {
        maxConcurrentRequests: options.maxConcurrent || 3,
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      }
    };

    const { data, error } = await this.supabase
      .from('batch_upload_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create batch session: ${error.message}`);
    }

    return data;
  }

  /**
   * Start queue workers for testing
   */
  async startQueueWorkers(count: number): Promise<string[]> {
    const workerIds: string[] = [];
    
    for (let i = 1; i <= count; i++) {
      const workerId = `test-worker-${Date.now()}-${i}`;
      
      const { error } = await this.supabase
        .from('embedding_queue_workers')
        .insert({
          worker_id: workerId,
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          current_task: null,
          processed_count: 0,
          error_count: 0,
          metadata: { test_worker: true }
        });

      if (error) {
        console.warn(`Failed to create worker ${workerId}:`, error.message);
        continue;
      }

      workerIds.push(workerId);
    }

    return workerIds;
  }

  /**
   * Stop queue workers
   */
  async stopQueueWorkers(workerIds?: string[]): Promise<void> {
    let query = this.supabase
      .from('embedding_queue_workers')
      .update({ status: 'stopped' });

    if (workerIds && workerIds.length > 0) {
      query = query.in('worker_id', workerIds);
    } else {
      query = query.eq('metadata->test_worker', true);
    }

    const { error } = await query;
    
    if (error) {
      console.warn('Failed to stop workers:', error.message);
    }
  }

  /**
   * Add items to the embedding queue
   */
  async addToQueue(items: Array<{
    source_type: string;
    source_id: string;
    operation: string;
    priority?: string;
  }>): Promise<any[]> {
    const queueItems = items.map(item => ({
      ...item,
      priority: item.priority || 'medium',
      status: 'pending',
      retry_count: 0,
      metadata: { test_data: true }
    }));

    const { data, error } = await this.supabase
      .from('embedding_queue')
      .insert(queueItems)
      .select();

    if (error) {
      throw new Error(`Failed to add items to queue: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get queue status and metrics
   */
  async getQueueStatus(): Promise<{
    pendingItems: number;
    processingItems: number;
    completedItems: number;
    failedItems: number;
    activeWorkers: number;
    rateLimitStatus: string;
  }> {
    // Get queue statistics
    const { data: queueStats, error: queueError } = await this.supabase
      .rpc('get_queue_statistics');

    if (queueError) {
      throw new Error(`Failed to get queue statistics: ${queueError.message}`);
    }

    // Get active workers
    const { data: workers, error: workersError } = await this.supabase
      .from('embedding_queue_workers')
      .select('*')
      .eq('status', 'active');

    if (workersError) {
      throw new Error(`Failed to get workers: ${workersError.message}`);
    }

    const stats = queueStats?.[0] || {};
    
    return {
      pendingItems: stats.total_pending || 0,
      processingItems: stats.total_processing || 0,
      completedItems: stats.total_completed || 0,
      failedItems: stats.total_failed || 0,
      activeWorkers: workers?.length || 0,
      rateLimitStatus: stats.total_rate_limited > 0 ? 'limited' : 'normal'
    };
  }

  /**
   * Get embedding metrics for a session
   */
  async getEmbeddingMetrics(sessionId?: string): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    completedFiles: number;
    totalFiles: number;
    apiQuotaViolations: number;
    rateLimitHits: number;
    averageProcessingTime: number;
  }> {
    let query = this.supabase
      .from('embedding_metrics')
      .select('*');

    if (sessionId) {
      query = query.eq('batch_session_id', sessionId);
    } else {
      query = query.eq('metadata->test_data', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get embedding metrics: ${error.message}`);
    }

    const metrics = data || [];
    
    return {
      totalAttempts: metrics.length,
      successfulAttempts: metrics.filter(m => m.status === 'completed').length,
      failedAttempts: metrics.filter(m => m.status === 'failed').length,
      completedFiles: metrics.filter(m => m.status === 'completed').length,
      totalFiles: metrics.length,
      apiQuotaViolations: metrics.filter(m => m.error_type === 'quota_exceeded').length,
      rateLimitHits: metrics.filter(m => m.error_type === 'rate_limit').length,
      averageProcessingTime: metrics.reduce((sum, m) => sum + (m.processing_time_ms || 0), 0) / metrics.length || 0
    };
  }

  /**
   * Get queue depth (number of pending items)
   */
  async getQueueDepth(): Promise<number> {
    const { count, error } = await this.supabase
      .from('embedding_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to get queue depth: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Wait for queue to empty
   */
  async waitForQueueEmpty(timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const depth = await this.getQueueDepth();
      if (depth === 0) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Queue did not empty within ${timeoutMs}ms timeout`);
  }

  /**
   * Generate test metrics data
   */
  async generateTestMetrics(count: number): Promise<void> {
    const metrics = [];
    
    for (let i = 1; i <= count; i++) {
      metrics.push({
        operation_type: 'embedding_generation',
        source_type: 'receipts',
        source_id: `test-receipt-${i}`,
        status: Math.random() > 0.1 ? 'completed' : 'failed',
        processing_time_ms: Math.floor(Math.random() * 10000) + 1000,
        tokens_used: Math.floor(Math.random() * 3000) + 500,
        api_provider: Math.random() > 0.5 ? 'gemini' : 'openrouter',
        model_used: 'test-model',
        error_type: Math.random() > 0.9 ? 'rate_limit' : null,
        metadata: { test_data: true }
      });
    }

    const { error } = await this.supabase
      .from('embedding_metrics')
      .insert(metrics);

    if (error) {
      throw new Error(`Failed to generate test metrics: ${error.message}`);
    }
  }

  /**
   * Load dashboard data for performance testing
   */
  async loadDashboardData(): Promise<{
    metrics: any[];
    aggregatedStats: any;
    queueStatus: any;
    workerStatus: any[];
  }> {
    const [metrics, queueStatus, workers] = await Promise.all([
      this.supabase.from('embedding_metrics').select('*').limit(1000),
      this.getQueueStatus(),
      this.supabase.from('embedding_queue_workers').select('*')
    ]);

    if (metrics.error) {
      throw new Error(`Failed to load metrics: ${metrics.error.message}`);
    }

    if (workers.error) {
      throw new Error(`Failed to load workers: ${workers.error.message}`);
    }

    const aggregatedStats = {
      totalOperations: metrics.data?.length || 0,
      successRate: metrics.data ? 
        metrics.data.filter(m => m.status === 'completed').length / metrics.data.length : 0,
      averageProcessingTime: metrics.data ?
        metrics.data.reduce((sum, m) => sum + (m.processing_time_ms || 0), 0) / metrics.data.length : 0,
      totalTokensUsed: metrics.data ?
        metrics.data.reduce((sum, m) => sum + (m.tokens_used || 0), 0) : 0
    };

    return {
      metrics: metrics.data || [],
      aggregatedStats,
      queueStatus,
      workerStatus: workers.data || []
    };
  }

  /**
   * Trigger an embedding event for real-time testing
   */
  async triggerEmbeddingEvent(): Promise<void> {
    const { error } = await this.supabase
      .from('embedding_metrics')
      .insert({
        operation_type: 'embedding_generation',
        source_type: 'receipts',
        source_id: `test-receipt-${Date.now()}`,
        status: 'completed',
        processing_time_ms: Math.floor(Math.random() * 5000) + 1000,
        tokens_used: Math.floor(Math.random() * 2000) + 500,
        api_provider: 'gemini',
        model_used: 'test-model',
        timestamp: new Date().toISOString(),
        metadata: { test_data: true, real_time_test: true }
      });

    if (error) {
      throw new Error(`Failed to trigger embedding event: ${error.message}`);
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    // Clean up test data in reverse dependency order
    const cleanupQueries = [
      'DELETE FROM embedding_metrics WHERE metadata->>\'test_data\' = \'true\'',
      'DELETE FROM embedding_queue WHERE metadata->>\'test_data\' = \'true\'',
      'DELETE FROM embedding_queue_workers WHERE metadata->>\'test_worker\' = \'true\'',
      'DELETE FROM batch_upload_sessions WHERE session_name LIKE \'test-%\'',
      'DELETE FROM receipts WHERE metadata->>\'test_data\' = \'true\''
    ];

    for (const query of cleanupQueries) {
      try {
        await this.supabase.rpc('execute_sql', { sql: query });
      } catch (error) {
        console.warn(`Cleanup query failed: ${query}`, error);
      }
    }
  }
}
