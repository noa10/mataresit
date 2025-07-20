/**
 * Performance and Load Tests for Queue System
 * Tests queue performance under various load conditions
 */

import { performance } from 'perf_hooks';

// Configuration for load testing
const LOAD_TEST_CONFIG = {
  // Test scenarios
  scenarios: {
    light: {
      concurrent_workers: 1,
      items_per_batch: 5,
      total_items: 50,
      duration_minutes: 2
    },
    moderate: {
      concurrent_workers: 2,
      items_per_batch: 10,
      total_items: 200,
      duration_minutes: 5
    },
    heavy: {
      concurrent_workers: 3,
      items_per_batch: 15,
      total_items: 500,
      duration_minutes: 10
    },
    stress: {
      concurrent_workers: 5,
      items_per_batch: 20,
      total_items: 1000,
      duration_minutes: 15
    }
  },
  
  // Performance thresholds
  thresholds: {
    max_queue_processing_time_ms: 5000,
    max_batch_retrieval_time_ms: 1000,
    max_item_completion_time_ms: 500,
    min_throughput_items_per_minute: 10,
    max_error_rate_percent: 5,
    max_memory_usage_mb: 512
  }
};

// Mock Supabase client for performance testing
class MockSupabaseClient {
  constructor() {
    this.callCount = 0;
    this.totalLatency = 0;
    this.errors = 0;
  }

  async rpc(functionName, params = {}) {
    const startTime = performance.now();
    this.callCount++;

    // Simulate network latency
    await this.simulateLatency(50, 200);

    // Simulate occasional errors (5% error rate)
    if (Math.random() < 0.05) {
      this.errors++;
      throw new Error(`Simulated database error for ${functionName}`);
    }

    const endTime = performance.now();
    this.totalLatency += (endTime - startTime);

    // Return mock data based on function
    return this.getMockResponse(functionName, params);
  }

  async simulateLatency(min, max) {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  getMockResponse(functionName, params) {
    switch (functionName) {
      case 'get_next_embedding_batch':
        return {
          data: this.generateMockBatch(params.batch_size_param || 5),
          error: null
        };
      
      case 'complete_embedding_queue_item':
        return { data: null, error: null };
      
      case 'get_queue_statistics':
        return {
          data: [{
            total_pending: Math.floor(Math.random() * 100),
            total_processing: Math.floor(Math.random() * 10),
            total_completed: Math.floor(Math.random() * 1000),
            total_failed: Math.floor(Math.random() * 20),
            active_workers: Math.floor(Math.random() * 5) + 1,
            avg_processing_time_ms: Math.random() * 3000 + 1000
          }],
          error: null
        };
      
      default:
        return { data: null, error: null };
    }
  }

  generateMockBatch(size) {
    const batch = [];
    for (let i = 0; i < size; i++) {
      batch.push({
        id: `item-${Date.now()}-${i}`,
        source_type: 'receipts',
        source_id: `receipt-${i}`,
        operation: 'INSERT',
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        metadata: { test: true, batch_id: `batch-${Date.now()}` },
        estimated_tokens: Math.floor(Math.random() * 2000) + 500
      });
    }
    return batch;
  }

  getStats() {
    return {
      totalCalls: this.callCount,
      averageLatency: this.callCount > 0 ? this.totalLatency / this.callCount : 0,
      errorRate: this.callCount > 0 ? (this.errors / this.callCount) * 100 : 0,
      totalErrors: this.errors
    };
  }

  reset() {
    this.callCount = 0;
    this.totalLatency = 0;
    this.errors = 0;
  }
}

// Performance test runner
class QueuePerformanceTester {
  constructor() {
    this.supabase = new MockSupabaseClient();
    this.results = {};
  }

  async runLoadTest(scenario) {
    console.log(`\n🚀 Running ${scenario} load test...`);
    console.log('='.repeat(50));
    
    const config = LOAD_TEST_CONFIG.scenarios[scenario];
    const startTime = performance.now();
    
    this.supabase.reset();
    
    const results = {
      scenario,
      config,
      startTime: new Date().toISOString(),
      metrics: {
        totalItemsProcessed: 0,
        totalBatchesRetrieved: 0,
        totalCompletions: 0,
        averageProcessingTime: 0,
        throughputPerMinute: 0,
        errorRate: 0,
        peakMemoryUsage: 0
      },
      performance: {
        batchRetrievalTimes: [],
        itemCompletionTimes: [],
        queueStatsTimes: []
      },
      passed: false
    };

    try {
      // Simulate concurrent workers
      const workerPromises = [];
      for (let i = 0; i < config.concurrent_workers; i++) {
        workerPromises.push(this.simulateWorker(`worker-${i}`, config, results));
      }

      // Run workers concurrently
      await Promise.all(workerPromises);

      const endTime = performance.now();
      const totalDuration = (endTime - startTime) / 1000; // seconds

      // Calculate final metrics
      results.metrics.averageProcessingTime = results.performance.itemCompletionTimes.length > 0
        ? results.performance.itemCompletionTimes.reduce((a, b) => a + b, 0) / results.performance.itemCompletionTimes.length
        : 0;

      results.metrics.throughputPerMinute = (results.metrics.totalItemsProcessed / totalDuration) * 60;
      
      const dbStats = this.supabase.getStats();
      results.metrics.errorRate = dbStats.errorRate;
      
      results.endTime = new Date().toISOString();
      results.totalDuration = totalDuration;
      
      // Check if test passed thresholds
      results.passed = this.evaluatePerformance(results);
      
      this.results[scenario] = results;
      this.printResults(results);
      
    } catch (error) {
      console.error(`❌ Load test failed: ${error.message}`);
      results.error = error.message;
      results.passed = false;
    }

    return results;
  }

  async simulateWorker(workerId, config, results) {
    const itemsPerWorker = Math.ceil(config.total_items / config.concurrent_workers);
    let processedItems = 0;

    while (processedItems < itemsPerWorker) {
      try {
        // Simulate batch retrieval
        const batchStartTime = performance.now();
        const { data: batch } = await this.supabase.rpc('get_next_embedding_batch', {
          worker_id_param: workerId,
          batch_size_param: config.items_per_batch
        });
        const batchEndTime = performance.now();
        
        results.performance.batchRetrievalTimes.push(batchEndTime - batchStartTime);
        results.metrics.totalBatchesRetrieved++;

        if (!batch || batch.length === 0) {
          // No more items, worker goes idle
          await this.sleep(100);
          continue;
        }

        // Process each item in the batch
        for (const item of batch) {
          const itemStartTime = performance.now();
          
          // Simulate embedding generation (variable processing time)
          await this.simulateEmbeddingGeneration(item);
          
          // Complete the item
          await this.supabase.rpc('complete_embedding_queue_item', {
            item_id: item.id,
            worker_id_param: workerId,
            success: Math.random() > 0.05, // 95% success rate
            actual_tokens_param: item.estimated_tokens + Math.floor(Math.random() * 200),
            error_message_param: null
          });
          
          const itemEndTime = performance.now();
          results.performance.itemCompletionTimes.push(itemEndTime - itemStartTime);
          results.metrics.totalItemsProcessed++;
          results.metrics.totalCompletions++;
          processedItems++;
        }

        // Simulate worker heartbeat and brief pause
        await this.sleep(50);

      } catch (error) {
        console.warn(`Worker ${workerId} encountered error: ${error.message}`);
        await this.sleep(1000); // Longer pause on error
      }
    }
  }

  async simulateEmbeddingGeneration(item) {
    // Simulate variable processing time based on estimated tokens
    const baseTime = 500; // Base processing time
    const tokenFactor = item.estimated_tokens / 1000; // Additional time per 1000 tokens
    const variability = Math.random() * 1000; // Random variability
    
    const processingTime = baseTime + (tokenFactor * 200) + variability;
    await this.sleep(processingTime);
  }

  evaluatePerformance(results) {
    const thresholds = LOAD_TEST_CONFIG.thresholds;
    const metrics = results.metrics;
    
    const checks = [
      metrics.averageProcessingTime <= thresholds.max_queue_processing_time_ms,
      metrics.throughputPerMinute >= thresholds.min_throughput_items_per_minute,
      metrics.errorRate <= thresholds.max_error_rate_percent,
      results.performance.batchRetrievalTimes.every(time => time <= thresholds.max_batch_retrieval_time_ms),
      results.performance.itemCompletionTimes.every(time => time <= thresholds.max_item_completion_time_ms)
    ];

    return checks.every(check => check);
  }

  printResults(results) {
    console.log(`\n📊 ${results.scenario.toUpperCase()} Load Test Results`);
    console.log('-'.repeat(40));
    console.log(`Status: ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Duration: ${results.totalDuration?.toFixed(2)}s`);
    console.log(`Items Processed: ${results.metrics.totalItemsProcessed}`);
    console.log(`Batches Retrieved: ${results.metrics.totalBatchesRetrieved}`);
    console.log(`Throughput: ${results.metrics.throughputPerMinute.toFixed(2)} items/min`);
    console.log(`Avg Processing Time: ${results.metrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`Error Rate: ${results.metrics.errorRate.toFixed(2)}%`);
    
    if (results.performance.batchRetrievalTimes.length > 0) {
      const avgBatchTime = results.performance.batchRetrievalTimes.reduce((a, b) => a + b, 0) / results.performance.batchRetrievalTimes.length;
      console.log(`Avg Batch Retrieval: ${avgBatchTime.toFixed(2)}ms`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('🧪 Queue System Performance Testing Suite');
    console.log('==========================================');
    
    const scenarios = Object.keys(LOAD_TEST_CONFIG.scenarios);
    const results = {};
    
    for (const scenario of scenarios) {
      results[scenario] = await this.runLoadTest(scenario);
      await this.sleep(2000); // Brief pause between tests
    }
    
    this.printSummary(results);
    return results;
  }

  printSummary(results) {
    console.log('\n📈 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(50));
    
    Object.entries(results).forEach(([scenario, result]) => {
      const status = result.passed ? '✅' : '❌';
      const throughput = result.metrics?.throughputPerMinute?.toFixed(1) || 'N/A';
      const errorRate = result.metrics?.errorRate?.toFixed(1) || 'N/A';
      
      console.log(`${status} ${scenario.padEnd(10)} | ${throughput.padStart(8)} items/min | ${errorRate.padStart(5)}% errors`);
    });
    
    const passedTests = Object.values(results).filter(r => r.passed).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All performance tests passed!');
    } else {
      console.log('⚠️  Some performance tests failed. Review thresholds and system capacity.');
    }
  }
}

// Export for use in test runners
export { QueuePerformanceTester, LOAD_TEST_CONFIG };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new QueuePerformanceTester();
  tester.runAllTests().catch(console.error);
}
