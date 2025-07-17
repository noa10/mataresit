#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Performance benchmark test for enhanced embedding system
 * Measures performance impact of the AI vision embedding enhancements
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Load environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface BenchmarkResult {
  testName: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  throughput: number; // operations per second
}

/**
 * Benchmark content synthesis performance
 */
async function benchmarkContentSynthesis(iterations: number = 100): Promise<BenchmarkResult> {
  console.log(`🏃 Benchmarking content synthesis (${iterations} iterations)...`);
  
  const { generateSyntheticFullText, synthesizeReceiptContent } = await import('../supabase/functions/_shared/content-synthesis.ts');
  
  // Test data
  const testData = {
    merchant: 'Benchmark Coffee Shop',
    date: '2025-01-15',
    total: 15.75,
    tax: 1.25,
    currency: 'MYR',
    payment_method: 'Credit Card',
    predicted_category: 'Food & Dining',
    line_items: [
      { description: 'Large Latte', amount: 6.50 },
      { description: 'Croissant', amount: 4.25 },
      { description: 'Extra Shot', amount: 0.75 }
    ],
    ai_suggestions: {
      business_type: 'Coffee Shop'
    }
  };
  
  const times: number[] = [];
  let successful = 0;
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      const syntheticContent = generateSyntheticFullText(testData);
      const fullStrategy = synthesizeReceiptContent(testData);
      
      if (syntheticContent.length > 0 && Object.keys(fullStrategy).length > 0) {
        successful++;
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
    } catch (error) {
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const successRate = (successful / iterations) * 100;
  const throughput = 1000 / averageTime; // operations per second
  
  return {
    testName: 'Content Synthesis',
    iterations,
    totalTime,
    averageTime,
    minTime,
    maxTime,
    successRate,
    throughput
  };
}

/**
 * Benchmark embedding generation performance
 */
async function benchmarkEmbeddingGeneration(iterations: number = 10): Promise<BenchmarkResult> {
  console.log(`🏃 Benchmarking embedding generation (${iterations} iterations)...`);
  
  // Get test receipts
  const { data: testReceipts, error } = await supabase
    .from('receipts')
    .select('id, merchant, date, total, fullText, user_id')
    .not('merchant', 'is', null)
    .limit(iterations);
  
  if (error || !testReceipts || testReceipts.length === 0) {
    throw new Error('No test receipts available for benchmarking');
  }
  
  const times: number[] = [];
  let successful = 0;
  
  for (const receipt of testReceipts.slice(0, iterations)) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({
          receiptId: receipt.id,
          processAllFields: true,
          useImprovedDimensionHandling: true,
          mode: 'benchmark'
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        successful++;
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
    } catch (error) {
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const successRate = (successful / times.length) * 100;
  const throughput = 1000 / averageTime; // operations per second
  
  return {
    testName: 'Embedding Generation',
    iterations: times.length,
    totalTime,
    averageTime,
    minTime,
    maxTime,
    successRate,
    throughput
  };
}

/**
 * Benchmark search performance
 */
async function benchmarkSearchPerformance(iterations: number = 50): Promise<BenchmarkResult> {
  console.log(`🏃 Benchmarking search performance (${iterations} iterations)...`);
  
  const searchQueries = [
    'coffee',
    'restaurant',
    'grocery',
    'gas station',
    'pharmacy',
    'shopping',
    'food',
    'dining',
    'fuel',
    'medicine'
  ];
  
  const times: number[] = [];
  let successful = 0;
  
  for (let i = 0; i < iterations; i++) {
    const query = searchQueries[i % searchQueries.length];
    const startTime = performance.now();
    
    try {
      const { data: results, error } = await supabase
        .rpc('search_receipts_semantic', {
          query_text: query,
          similarity_threshold: 0.3,
          max_results: 10
        });
      
      if (!error && results) {
        successful++;
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
    } catch (error) {
      const endTime = performance.now();
      times.push(endTime - startTime);
    }
    
    // Small delay between searches
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const successRate = (successful / iterations) * 100;
  const throughput = 1000 / averageTime; // searches per second
  
  return {
    testName: 'Search Performance',
    iterations,
    totalTime,
    averageTime,
    minTime,
    maxTime,
    successRate,
    throughput
  };
}

/**
 * Run comprehensive performance benchmark
 */
async function runPerformanceBenchmark(): Promise<void> {
  console.log('🚀 Running Performance Benchmark Suite');
  console.log('=' .repeat(60));
  
  try {
    const results: BenchmarkResult[] = [
      await benchmarkContentSynthesis(100),
      await benchmarkEmbeddingGeneration(5), // Fewer iterations for expensive operations
      await benchmarkSearchPerformance(30)
    ];
    
    console.log('\n📊 Performance Benchmark Results');
    console.log('=' .repeat(60));
    
    results.forEach(result => {
      console.log(`\n🏃 ${result.testName}:`);
      console.log(`   Iterations: ${result.iterations}`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`   Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`   Min Time: ${result.minTime.toFixed(2)}ms`);
      console.log(`   Max Time: ${result.maxTime.toFixed(2)}ms`);
      console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log(`   Throughput: ${result.throughput.toFixed(2)} ops/sec`);
      
      // Performance assessment
      if (result.testName === 'Content Synthesis') {
        if (result.averageTime < 10) {
          console.log(`   ✅ Excellent performance (< 10ms)`);
        } else if (result.averageTime < 50) {
          console.log(`   ✅ Good performance (< 50ms)`);
        } else {
          console.log(`   ⚠️ Slow performance (> 50ms)`);
        }
      } else if (result.testName === 'Embedding Generation') {
        if (result.averageTime < 5000) {
          console.log(`   ✅ Acceptable performance (< 5s)`);
        } else if (result.averageTime < 10000) {
          console.log(`   ⚠️ Slow performance (< 10s)`);
        } else {
          console.log(`   ❌ Poor performance (> 10s)`);
        }
      } else if (result.testName === 'Search Performance') {
        if (result.averageTime < 500) {
          console.log(`   ✅ Fast search (< 500ms)`);
        } else if (result.averageTime < 1000) {
          console.log(`   ✅ Acceptable search (< 1s)`);
        } else {
          console.log(`   ⚠️ Slow search (> 1s)`);
        }
      }
    });
    
    // Overall assessment
    console.log('\n🎯 Overall Performance Assessment:');
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    const contentSynthesisPerf = results.find(r => r.testName === 'Content Synthesis');
    const embeddingGenPerf = results.find(r => r.testName === 'Embedding Generation');
    const searchPerf = results.find(r => r.testName === 'Search Performance');
    
    console.log(`   Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    
    if (avgSuccessRate >= 90 && 
        contentSynthesisPerf?.averageTime < 50 && 
        embeddingGenPerf?.averageTime < 10000 && 
        searchPerf?.averageTime < 1000) {
      console.log('   ✅ Performance is excellent - ready for production');
    } else if (avgSuccessRate >= 80) {
      console.log('   ✅ Performance is acceptable - monitor in production');
    } else {
      console.log('   ⚠️ Performance needs optimization before production');
    }
    
    // Recommendations
    console.log('\n💡 Performance Recommendations:');
    if (contentSynthesisPerf?.averageTime > 50) {
      console.log('   - Optimize content synthesis algorithms');
    }
    if (embeddingGenPerf?.averageTime > 10000) {
      console.log('   - Consider caching or batch processing for embeddings');
    }
    if (searchPerf?.averageTime > 1000) {
      console.log('   - Optimize database indexes for search queries');
    }
    if (avgSuccessRate < 90) {
      console.log('   - Investigate and fix reliability issues');
    }
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    throw error;
  }
}

// Main execution
if (import.meta.main) {
  try {
    await runPerformanceBenchmark();
    console.log('\n✅ Performance benchmark completed successfully!');
  } catch (error) {
    console.error('❌ Performance benchmark failed:', error.message);
    Deno.exit(1);
  }
}
