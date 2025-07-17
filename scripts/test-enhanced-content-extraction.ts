#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Test script for enhanced content extraction from AI vision data
 * This script validates that synthetic fullText generation is working correctly
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Import our content synthesis utilities
import { 
  generateSyntheticFullText,
  synthesizeReceiptContent,
  validateAndEnhanceContent 
} from '../supabase/functions/_shared/content-synthesis.ts';

// Load environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Test data representing AI vision output
 */
const testVisionData = {
  merchant: 'Starbucks Coffee',
  date: '2025-01-15',
  total: 15.50,
  tax: 1.25,
  currency: 'MYR',
  payment_method: 'Credit Card',
  predicted_category: 'Food & Dining',
  line_items: [
    { description: 'Grande Latte', amount: 6.50 },
    { description: 'Blueberry Muffin', amount: 4.25 },
    { description: 'Extra Shot', amount: 0.75 }
  ],
  ai_suggestions: {
    business_type: 'Coffee Shop',
    location_hint: 'Shopping Mall'
  },
  confidence: {
    merchant: 95,
    total: 98,
    line_items: 90
  }
};

/**
 * Test synthetic fullText generation
 */
async function testSyntheticFullTextGeneration() {
  console.log('\n🧪 Testing Synthetic fullText Generation');
  console.log('=' .repeat(50));
  
  const syntheticFullText = generateSyntheticFullText(testVisionData);
  
  console.log('📝 Generated synthetic fullText:');
  console.log(syntheticFullText);
  console.log(`\n📊 Length: ${syntheticFullText.length} characters`);
  
  // Validate content quality
  const hasMinimumContent = syntheticFullText.length >= 10;
  const containsMerchant = syntheticFullText.includes(testVisionData.merchant);
  const containsTotal = syntheticFullText.includes(testVisionData.total.toString());
  const containsLineItems = syntheticFullText.includes('Items:');
  
  console.log('\n✅ Quality Checks:');
  console.log(`   Minimum length (10+ chars): ${hasMinimumContent ? '✅' : '❌'}`);
  console.log(`   Contains merchant: ${containsMerchant ? '✅' : '❌'}`);
  console.log(`   Contains total: ${containsTotal ? '✅' : '❌'}`);
  console.log(`   Contains line items: ${containsLineItems ? '✅' : '❌'}`);
  
  return {
    success: hasMinimumContent && containsMerchant && containsTotal,
    content: syntheticFullText
  };
}

/**
 * Test complete content strategy synthesis
 */
async function testContentStrategySynthesis() {
  console.log('\n🧪 Testing Complete Content Strategy Synthesis');
  console.log('=' .repeat(50));
  
  const contentStrategy = synthesizeReceiptContent(testVisionData);
  const enhancedStrategy = validateAndEnhanceContent(contentStrategy, testVisionData);
  
  console.log('📋 Generated Content Types:');
  Object.entries(enhancedStrategy).forEach(([key, value]) => {
    console.log(`   ${key}: ${value ? `"${value.substring(0, 50)}..."` : 'empty'}`);
  });
  
  // Validate all content types have content
  const contentTypes = Object.keys(enhancedStrategy);
  const nonEmptyTypes = contentTypes.filter(key => enhancedStrategy[key as keyof typeof enhancedStrategy]?.trim());
  
  console.log(`\n📊 Content Coverage: ${nonEmptyTypes.length}/${contentTypes.length} types have content`);
  console.log(`   Non-empty types: ${nonEmptyTypes.join(', ')}`);
  
  return {
    success: nonEmptyTypes.length >= 4, // At least 4 content types should have content
    strategy: enhancedStrategy
  };
}

/**
 * Test with receipts that have empty fullText
 */
async function testWithEmptyFullTextReceipts() {
  console.log('\n🧪 Testing with Receipts Having Empty fullText');
  console.log('=' .repeat(50));
  
  try {
    // Find receipts with empty or null fullText
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, tax, currency, payment_method, predicted_category, fullText')
      .or('fullText.is.null,fullText.eq.')
      .limit(3);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!receipts || receipts.length === 0) {
      console.log('ℹ️ No receipts found with empty fullText');
      return { success: true, processed: 0 };
    }
    
    console.log(`📋 Found ${receipts.length} receipts with empty fullText`);
    
    let successCount = 0;
    
    for (const receipt of receipts) {
      console.log(`\n🔄 Processing receipt ${receipt.id}:`);
      console.log(`   Merchant: ${receipt.merchant || 'N/A'}`);
      console.log(`   Original fullText: ${receipt.fullText || 'empty'}`);
      
      // Generate synthetic content
      const syntheticFullText = generateSyntheticFullText(receipt);
      
      if (syntheticFullText && syntheticFullText.length >= 10) {
        console.log(`   ✅ Generated synthetic fullText (${syntheticFullText.length} chars)`);
        console.log(`   Preview: "${syntheticFullText.substring(0, 100)}..."`);
        successCount++;
      } else {
        console.log(`   ❌ Failed to generate meaningful synthetic fullText`);
      }
    }
    
    console.log(`\n📊 Success Rate: ${successCount}/${receipts.length} receipts processed successfully`);
    
    return {
      success: successCount > 0,
      processed: successCount,
      total: receipts.length
    };
    
  } catch (error) {
    console.error('❌ Error testing with empty fullText receipts:', error.message);
    return { success: false, processed: 0 };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Enhanced Content Extraction Test Suite');
  console.log('=' .repeat(60));
  
  const results = {
    syntheticFullText: await testSyntheticFullTextGeneration(),
    contentStrategy: await testContentStrategySynthesis(),
    emptyFullTextReceipts: await testWithEmptyFullTextReceipts()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([testName, result]) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${testName}: ${status}`);
  });
  
  const allTestsPassed = Object.values(results).every(result => result.success);
  
  console.log(`\n🎯 Overall Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allTestsPassed) {
    console.log('\n🎉 Enhanced content extraction is working correctly!');
    console.log('   - Synthetic fullText generation is functional');
    console.log('   - Multi-source content strategy is working');
    console.log('   - Empty fullText receipts can be processed');
  } else {
    console.log('\n⚠️ Some issues detected. Please review the test output above.');
  }
  
  return allTestsPassed;
}

// Run the tests
if (import.meta.main) {
  const success = await runTests();
  Deno.exit(success ? 0 : 1);
}
