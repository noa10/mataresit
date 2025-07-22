/**
 * Test Script for Rate Limiting Integration
 * Phase 3: Batch Upload Optimization
 * 
 * Tests the rate limiting functionality in the generate-embeddings function.
 */

import { EdgeRateLimitingManager, ProcessingStrategy } from './rateLimitingManager.ts';
import { 
  generateEmbeddingWithRateLimit,
  estimateTokensForContent,
  processBatchWithRateLimit
} from './rateLimitingUtils.ts';

// Mock embedding function for testing
async function mockGenerateEmbedding(text: string): Promise<number[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Simulate occasional rate limiting
  if (Math.random() < 0.1) { // 10% chance of rate limiting
    throw new Error('Rate limit exceeded (429)');
  }
  
  // Return mock embedding
  return new Array(1536).fill(0).map(() => Math.random());
}

/**
 * Test basic rate limiting functionality
 */
async function testBasicRateLimiting() {
  console.log('🧪 Testing basic rate limiting functionality...');
  
  const rateLimiter = new EdgeRateLimitingManager('conservative');
  
  // Test permission requests
  const permission1 = await rateLimiter.acquirePermission('test-1', 1000);
  console.log('Permission 1:', permission1);
  
  const permission2 = await rateLimiter.acquirePermission('test-2', 1000);
  console.log('Permission 2:', permission2);
  
  // Test concurrent limit
  const permission3 = await rateLimiter.acquirePermission('test-3', 1000);
  console.log('Permission 3 (should be denied for conservative):', permission3);
  
  // Test success recording
  rateLimiter.recordSuccess('test-1', 1200, 150);
  
  // Test error recording
  rateLimiter.recordError('test-2', 'rate_limit');
  
  // Check status
  const status = rateLimiter.getStatus();
  console.log('Rate limiter status:', status);
  
  console.log('✅ Basic rate limiting test completed\n');
}

/**
 * Test token estimation
 */
async function testTokenEstimation() {
  console.log('🧪 Testing token estimation...');
  
  const testCases = [
    { text: 'Short receipt', type: 'receipt_summary' },
    { text: 'This is a longer receipt with multiple line items and detailed information about the purchase', type: 'receipt_full' },
    { text: 'Coffee - $4.50', type: 'line_item' },
    { text: 'Starbucks', type: 'merchant' },
    { text: 'Food & Dining', type: 'category' }
  ];
  
  testCases.forEach(testCase => {
    const tokens = estimateTokensForContent(testCase.text, testCase.type);
    console.log(`"${testCase.text}" (${testCase.type}): ${tokens} tokens`);
  });
  
  console.log('✅ Token estimation test completed\n');
}

/**
 * Test rate-limited embedding generation
 */
async function testRateLimitedEmbedding() {
  console.log('🧪 Testing rate-limited embedding generation...');
  
  const rateLimiter = new EdgeRateLimitingManager('balanced');
  
  try {
    const result = await generateEmbeddingWithRateLimit(
      'Test receipt content for embedding generation',
      'receipt_full',
      mockGenerateEmbedding,
      rateLimiter
    );
    
    console.log('Embedding result:', {
      embeddingLength: result.embedding.length,
      rateLimited: result.rateLimited,
      tokensUsed: result.tokensUsed
    });
  } catch (error) {
    console.error('Error in rate-limited embedding:', error);
  }
  
  console.log('✅ Rate-limited embedding test completed\n');
}

/**
 * Test batch processing with rate limiting
 */
async function testBatchProcessing() {
  console.log('🧪 Testing batch processing with rate limiting...');
  
  const rateLimiter = new EdgeRateLimitingManager('aggressive');
  
  const testItems = [
    'Receipt 1 content',
    'Receipt 2 content',
    'Receipt 3 content',
    'Receipt 4 content',
    'Receipt 5 content'
  ];
  
  const processFn = async (text: string) => {
    return await generateEmbeddingWithRateLimit(
      text,
      'receipt_full',
      mockGenerateEmbedding,
      rateLimiter
    );
  };
  
  try {
    const result = await processBatchWithRateLimit(
      testItems,
      processFn,
      rateLimiter,
      2 // Batch size
    );
    
    console.log('Batch processing result:', {
      successfulResults: result.results.filter(r => r).length,
      errors: result.errors.filter(e => e).length,
      rateLimitHits: result.rateLimitHits
    });
  } catch (error) {
    console.error('Error in batch processing:', error);
  }
  
  console.log('✅ Batch processing test completed\n');
}

/**
 * Test strategy switching
 */
async function testStrategySwitching() {
  console.log('🧪 Testing strategy switching...');
  
  const rateLimiter = new EdgeRateLimitingManager('conservative');
  
  console.log('Initial status (conservative):');
  console.log(rateLimiter.getStatus());
  
  rateLimiter.updateStrategy('aggressive');
  
  console.log('Status after switching to aggressive:');
  console.log(rateLimiter.getStatus());
  
  console.log('✅ Strategy switching test completed\n');
}

/**
 * Test rate limiting under load
 */
async function testRateLimitingUnderLoad() {
  console.log('🧪 Testing rate limiting under load...');
  
  const rateLimiter = new EdgeRateLimitingManager('balanced');
  
  // Create multiple concurrent requests
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      generateEmbeddingWithRateLimit(
        `Test content ${i}`,
        'receipt_full',
        mockGenerateEmbedding,
        rateLimiter
      ).catch(error => ({ error: error.message }))
    );
  }
  
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => !r.error).length;
  const rateLimited = results.filter(r => r.rateLimited).length;
  const errors = results.filter(r => r.error).length;
  
  console.log('Load test results:', {
    total: results.length,
    successful,
    rateLimited,
    errors
  });
  
  console.log('Final rate limiter status:');
  console.log(rateLimiter.getStatus());
  
  console.log('✅ Load test completed\n');
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting rate limiting integration tests...\n');
  
  try {
    await testBasicRateLimiting();
    await testTokenEstimation();
    await testRateLimitedEmbedding();
    await testBatchProcessing();
    await testStrategySwitching();
    await testRateLimitingUnderLoad();
    
    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export for use in other modules
export {
  testBasicRateLimiting,
  testTokenEstimation,
  testRateLimitedEmbedding,
  testBatchProcessing,
  testStrategySwitching,
  testRateLimitingUnderLoad,
  runAllTests
};

// Run tests if this file is executed directly
if (import.meta.main) {
  runAllTests();
}
