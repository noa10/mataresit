#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * End-to-end integration test for the complete AI vision embedding workflow
 * Tests the full pipeline from receipt processing to search functionality
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

interface WorkflowTestResult {
  step: string;
  success: boolean;
  details: string;
  data?: any;
  error?: string;
}

/**
 * Simulate AI vision processing result
 */
function createMockAIVisionResult(): any {
  return {
    merchant: 'E2E Test Restaurant',
    date: '2025-01-15',
    total: 42.50,
    tax: 3.50,
    currency: 'MYR',
    payment_method: 'Credit Card',
    predicted_category: 'Food & Dining',
    line_items: [
      { description: 'Grilled Chicken Salad', amount: 18.00 },
      { description: 'Fresh Orange Juice', amount: 8.50 },
      { description: 'Chocolate Cake', amount: 12.00 }
    ],
    ai_suggestions: {
      business_type: 'Restaurant',
      location_hint: 'Shopping Center',
      meal_type: 'Lunch'
    },
    confidence: {
      merchant: 95,
      total: 98,
      line_items: 92
    }
  };
}

/**
 * Step 1: Test receipt creation with AI vision data
 */
async function testReceiptCreation(): Promise<WorkflowTestResult> {
  console.log('🔄 Step 1: Testing receipt creation with AI vision data...');
  
  try {
    const mockVisionData = createMockAIVisionResult();
    
    // Create a test receipt with AI vision data
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        merchant: mockVisionData.merchant,
        date: mockVisionData.date,
        total: mockVisionData.total,
        tax: mockVisionData.tax,
        currency: mockVisionData.currency,
        payment_method: mockVisionData.payment_method,
        predicted_category: mockVisionData.predicted_category,
        fullText: '', // Simulate empty fullText from AI vision
        line_items: mockVisionData.line_items,
        ai_suggestions: mockVisionData.ai_suggestions,
        model_used: 'ai_vision_test',
        user_id: '00000000-0000-0000-0000-000000000000', // Test user ID
        processing_status: 'complete'
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Receipt creation failed: ${error.message}`);
    }
    
    return {
      step: 'Receipt Creation',
      success: true,
      details: `Created test receipt ${receipt.id} with empty fullText`,
      data: { receiptId: receipt.id, merchant: receipt.merchant }
    };
    
  } catch (error) {
    return {
      step: 'Receipt Creation',
      success: false,
      details: 'Failed to create test receipt',
      error: error.message
    };
  }
}

/**
 * Step 2: Test enhanced content synthesis
 */
async function testContentSynthesis(receiptId: string): Promise<WorkflowTestResult> {
  console.log('🔄 Step 2: Testing enhanced content synthesis...');
  
  try {
    // Get the created receipt
    const { data: receipt, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();
    
    if (error || !receipt) {
      throw new Error('Could not retrieve test receipt');
    }
    
    // Import and test content synthesis
    const { generateSyntheticFullText, synthesizeReceiptContent } = await import('../supabase/functions/_shared/content-synthesis.ts');
    
    const syntheticFullText = generateSyntheticFullText(receipt);
    const contentStrategy = synthesizeReceiptContent(receipt);
    
    // Validate synthesis results
    const hasContent = syntheticFullText.length > 50;
    const containsMerchant = syntheticFullText.includes(receipt.merchant);
    const containsLineItems = syntheticFullText.includes('Grilled Chicken Salad');
    const hasMultipleContentTypes = Object.keys(contentStrategy).length >= 6;
    
    const success = hasContent && containsMerchant && containsLineItems && hasMultipleContentTypes;
    
    return {
      step: 'Content Synthesis',
      success,
      details: `Generated ${syntheticFullText.length} chars synthetic content with ${Object.keys(contentStrategy).length} content types`,
      data: {
        syntheticFullTextLength: syntheticFullText.length,
        contentTypes: Object.keys(contentStrategy),
        preview: syntheticFullText.substring(0, 100) + '...'
      }
    };
    
  } catch (error) {
    return {
      step: 'Content Synthesis',
      success: false,
      details: 'Failed to synthesize content',
      error: error.message
    };
  }
}

/**
 * Step 3: Test embedding generation
 */
async function testEmbeddingGeneration(receiptId: string): Promise<WorkflowTestResult> {
  console.log('🔄 Step 3: Testing embedding generation...');
  
  try {
    // Call the enhanced embedding generation function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        receiptId,
        processAllFields: true,
        useImprovedDimensionHandling: true,
        mode: 'e2e_test'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Embedding generation failed');
    }
    
    // Validate embedding results
    const hasResults = result.results && result.results.length > 0;
    const hasQualityMetrics = result.qualityMetrics && typeof result.qualityMetrics.overallQualityScore === 'number';
    const qualityScoreGood = result.qualityMetrics?.overallQualityScore >= 60;
    
    const success = hasResults && hasQualityMetrics && qualityScoreGood;
    
    return {
      step: 'Embedding Generation',
      success,
      details: `Generated ${result.results?.length || 0} embeddings with quality score ${result.qualityMetrics?.overallQualityScore || 0}`,
      data: {
        embeddingsCount: result.results?.length || 0,
        qualityScore: result.qualityMetrics?.overallQualityScore || 0,
        syntheticContentUsed: result.qualityMetrics?.syntheticContentUsed || false,
        processingMethod: result.qualityMetrics?.processingMethod || 'unknown'
      }
    };
    
  } catch (error) {
    return {
      step: 'Embedding Generation',
      success: false,
      details: 'Failed to generate embeddings',
      error: error.message
    };
  }
}

/**
 * Step 4: Test search functionality
 */
async function testSearchFunctionality(receiptId: string): Promise<WorkflowTestResult> {
  console.log('🔄 Step 4: Testing search functionality...');
  
  try {
    // Wait a moment for embeddings to be indexed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test various search queries that should find our test receipt
    const searchQueries = [
      'E2E Test Restaurant',
      'Grilled Chicken Salad',
      'restaurant food dining',
      'chicken salad lunch'
    ];
    
    let foundInSearches = 0;
    const searchResults: any[] = [];
    
    for (const query of searchQueries) {
      try {
        const { data: results, error } = await supabase
          .rpc('search_receipts_semantic', {
            query_text: query,
            similarity_threshold: 0.2,
            max_results: 10
          });
        
        if (!error && results) {
          const foundTestReceipt = results.some((r: any) => r.receipt_id === receiptId);
          if (foundTestReceipt) {
            foundInSearches++;
          }
          
          searchResults.push({
            query,
            resultsCount: results.length,
            foundTestReceipt,
            topResult: results[0]?.content_text?.substring(0, 50) + '...' || 'No results'
          });
        }
        
      } catch (searchError) {
        console.warn(`Search failed for "${query}":`, searchError.message);
      }
    }
    
    // Also test basic merchant search
    const { data: basicResults, error: basicError } = await supabase
      .from('receipts')
      .select('id, merchant')
      .eq('id', receiptId);
    
    const basicSearchWorks = !basicError && basicResults && basicResults.length > 0;
    const searchSuccessRate = searchQueries.length > 0 ? foundInSearches / searchQueries.length : 0;
    
    const success = searchSuccessRate >= 0.5 && basicSearchWorks; // At least 50% of searches should find the receipt
    
    return {
      step: 'Search Functionality',
      success,
      details: `Found test receipt in ${foundInSearches}/${searchQueries.length} searches (${(searchSuccessRate * 100).toFixed(1)}%)`,
      data: {
        searchQueries: searchQueries.length,
        foundInSearches,
        searchSuccessRate: Math.round(searchSuccessRate * 100),
        basicSearchWorks,
        searchResults: searchResults.slice(0, 2) // Include sample results
      }
    };
    
  } catch (error) {
    return {
      step: 'Search Functionality',
      success: false,
      details: 'Failed to test search functionality',
      error: error.message
    };
  }
}

/**
 * Step 5: Test quality metrics tracking
 */
async function testQualityMetricsTracking(receiptId: string): Promise<WorkflowTestResult> {
  console.log('🔄 Step 5: Testing quality metrics tracking...');
  
  try {
    // Check if quality metrics were recorded for our test receipt
    const { data: qualityMetrics, error } = await supabase
      .from('embedding_quality_metrics')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      throw new Error(`Quality metrics query failed: ${error.message}`);
    }
    
    const hasQualityMetrics = qualityMetrics && qualityMetrics.length > 0;
    const qualityScore = hasQualityMetrics ? qualityMetrics[0].overall_quality_score : 0;
    const syntheticContentUsed = hasQualityMetrics ? qualityMetrics[0].synthetic_content_used : false;
    
    const success = hasQualityMetrics && qualityScore > 0;
    
    return {
      step: 'Quality Metrics Tracking',
      success,
      details: `Quality metrics ${hasQualityMetrics ? 'recorded' : 'missing'} with score ${qualityScore}`,
      data: {
        hasQualityMetrics,
        qualityScore,
        syntheticContentUsed,
        processingMethod: hasQualityMetrics ? qualityMetrics[0].processing_method : 'unknown'
      }
    };
    
  } catch (error) {
    return {
      step: 'Quality Metrics Tracking',
      success: false,
      details: 'Failed to check quality metrics',
      error: error.message
    };
  }
}

/**
 * Cleanup: Remove test receipt
 */
async function cleanupTestReceipt(receiptId: string): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Remove quality metrics
    await supabase
      .from('embedding_quality_metrics')
      .delete()
      .eq('receipt_id', receiptId);
    
    // Remove embeddings
    await supabase
      .from('unified_embeddings')
      .delete()
      .eq('source_id', receiptId)
      .eq('source_type', 'receipt');
    
    // Remove receipt
    await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId);
    
    console.log('✅ Test data cleaned up successfully');
    
  } catch (error) {
    console.warn('⚠️ Cleanup failed:', error.message);
  }
}

/**
 * Run complete end-to-end workflow test
 */
async function runEndToEndTest(): Promise<void> {
  console.log('🚀 Running End-to-End Workflow Test');
  console.log('=' .repeat(60));
  
  let receiptId: string | null = null;
  const results: WorkflowTestResult[] = [];
  
  try {
    // Step 1: Create test receipt
    const step1 = await testReceiptCreation();
    results.push(step1);
    
    if (!step1.success) {
      throw new Error('Cannot proceed without test receipt');
    }
    
    receiptId = step1.data?.receiptId;
    
    // Step 2: Test content synthesis
    const step2 = await testContentSynthesis(receiptId);
    results.push(step2);
    
    // Step 3: Test embedding generation
    const step3 = await testEmbeddingGeneration(receiptId);
    results.push(step3);
    
    // Step 4: Test search functionality
    const step4 = await testSearchFunctionality(receiptId);
    results.push(step4);
    
    // Step 5: Test quality metrics
    const step5 = await testQualityMetricsTracking(receiptId);
    results.push(step5);
    
  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    results.push({
      step: 'Test Execution',
      success: false,
      details: 'Test execution failed',
      error: error.message
    });
  } finally {
    // Always cleanup
    if (receiptId) {
      await cleanupTestReceipt(receiptId);
    }
  }
  
  // Generate report
  console.log('\n📊 End-to-End Test Results');
  console.log('=' .repeat(50));
  
  let passedSteps = 0;
  const totalSteps = results.length;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`\n${index + 1}. ${status} ${result.step}`);
    console.log(`   ${result.details}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.data && result.success) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2).split('\n').slice(1, -1).join('\n   ')}`);
    }
    
    if (result.success) passedSteps++;
  });
  
  const successRate = totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0;
  
  console.log('\n🎯 End-to-End Test Summary:');
  console.log(`   Steps Passed: ${passedSteps}/${totalSteps}`);
  console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate === 100) {
    console.log('   ✅ Complete workflow is functioning perfectly!');
  } else if (successRate >= 80) {
    console.log('   ✅ Workflow is mostly functional with minor issues');
  } else if (successRate >= 60) {
    console.log('   ⚠️ Workflow has significant issues that need attention');
  } else {
    console.log('   ❌ Workflow is not functioning properly');
  }
  
  console.log('\n💡 Next Steps:');
  if (successRate === 100) {
    console.log('   - Solution is ready for production deployment');
    console.log('   - Monitor performance and user feedback');
  } else {
    console.log('   - Address failed test steps before deployment');
    console.log('   - Run individual component tests for debugging');
  }
}

// Main execution
if (import.meta.main) {
  try {
    await runEndToEndTest();
    console.log('\n✅ End-to-end test completed!');
  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    Deno.exit(1);
  }
}
