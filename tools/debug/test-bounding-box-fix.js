/**
 * Test script to verify the bounding box format detection and fallback mechanism
 * This tests the fix for Gemini 2.5 Flash Lite Preview returning bounding box data
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE0NzQsImV4cCI6MjA1MDAwNzQ3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// Test image data
const testImageData = {
  data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
  mimeType: 'image/jpeg',
  isBase64: true
};

async function testBoundingBoxFix() {
  console.log('🧪 TESTING BOUNDING BOX FORMAT FIX');
  console.log('Testing Gemini 2.5 Flash Lite Preview bounding box detection and fallback...\n');
  
  const testPayload = {
    imageData: testImageData,
    receiptId: `test-bbox-fix-${Date.now()}`,
    modelId: 'gemini-2.5-flash-lite-preview-06-17'
  };

  try {
    console.log('📡 Testing with Gemini 2.5 Flash Lite Preview...');
    const startTime = Date.now();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enhance-receipt-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
    
    if (response.ok) {
      const result = await response.json();
      
      console.log('\n✅ SUCCESS - Analyzing Response:');
      console.log(`   🎯 Model Requested: ${result.model_requested || 'N/A'}`);
      console.log(`   🤖 Model Actually Used: ${result.model_used || 'N/A'}`);
      
      // Check for fallback
      const fallbackOccurred = result.model_used !== result.model_requested;
      console.log(`   🔄 Fallback Occurred: ${fallbackOccurred ? '✅ YES' : '❌ NO'}`);
      
      if (fallbackOccurred) {
        console.log(`   📋 Fallback Details: ${result.model_requested} → ${result.model_used}`);
        console.log('   💡 This indicates the bounding box format was detected and fallback triggered');
      }
      
      // Analyze extracted data
      if (result.result) {
        const data = result.result;
        console.log('\n📊 EXTRACTED DATA:');
        console.log(`   🏪 Merchant: "${data.merchant || 'EMPTY'}"`);
        console.log(`   💰 Total: ${data.total || 0}`);
        console.log(`   📅 Date: "${data.date || 'EMPTY'}"`);
        console.log(`   🏷️ Category: "${data.predicted_category || 'EMPTY'}"`);
        console.log(`   📦 Line Items: ${data.line_items?.length || 0}`);
        
        // Check for bounding box metadata
        if (data.bounding_box_metadata) {
          console.log('\n📦 BOUNDING BOX METADATA DETECTED:');
          console.log(`   📋 Format: ${data.bounding_box_metadata.format_detected}`);
          console.log(`   📊 Total Elements: ${data.bounding_box_metadata.total_elements}`);
          console.log(`   🏷️ Unique Labels: ${data.bounding_box_metadata.unique_labels}`);
          console.log(`   📝 Requires Text Extraction: ${data.bounding_box_metadata.requires_text_extraction}`);
          console.log(`   🔍 Detected Labels: ${data.bounding_box_metadata.detected_labels?.join(', ')}`);
        }
        
        // Check data quality
        const hasData = data.merchant || data.total > 0 || data.date || 
                       (data.line_items && data.line_items.length > 0);
        
        console.log(`\n📈 DATA QUALITY: ${hasData ? '✅ GOOD' : '⚠️ LIMITED'}`);
        
        if (!hasData && !fallbackOccurred) {
          console.log('🚨 ISSUE: No fallback occurred but no meaningful data extracted');
          console.log('💡 This suggests the bounding box format was not detected properly');
        } else if (fallbackOccurred && hasData) {
          console.log('✅ SUCCESS: Fallback mechanism worked and extracted meaningful data');
        } else if (fallbackOccurred && !hasData) {
          console.log('⚠️ PARTIAL: Fallback occurred but limited data extracted');
        }
        
      } else {
        console.log('❌ ERROR: No result data in response');
      }
      
    } else {
      const errorText = await response.text();
      console.log('\n❌ FAILED:');
      console.log('📄 Error:', errorText);
    }
    
  } catch (error) {
    console.error('\n💥 EXCEPTION:', error.message);
  }
}

async function testComparisonWithWorkingModel() {
  console.log('\n\n🔬 COMPARISON TEST');
  console.log('Testing with known working model for comparison...\n');
  
  const testPayload = {
    imageData: testImageData,
    receiptId: `test-comparison-${Date.now()}`,
    modelId: 'gemini-2.0-flash-lite'
  };

  try {
    console.log('📡 Testing with Gemini 2.0 Flash Lite (baseline)...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enhance-receipt-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Baseline model working: ${result.success ? 'YES' : 'NO'}`);
      console.log(`📋 Model used: ${result.model_used}`);
      
      if (result.result) {
        const hasData = result.result.merchant || result.result.total > 0 || result.result.date;
        console.log(`📊 Data extracted: ${hasData ? 'YES' : 'NO'}`);
      }
    } else {
      console.log('❌ Baseline model failed');
    }
    
  } catch (error) {
    console.error('💥 Baseline test failed:', error.message);
  }
}

async function runComprehensiveTest() {
  console.log('🔍 COMPREHENSIVE BOUNDING BOX FIX TEST');
  console.log('Testing the fix for Gemini 2.5 Flash Lite Preview bounding box issue...\n');
  
  await testBoundingBoxFix();
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait between tests
  await testComparisonWithWorkingModel();
  
  console.log('\n🏁 TEST COMPLETE');
  console.log('\n📊 EXPECTED RESULTS:');
  console.log('1. ✅ Bounding box format should be detected');
  console.log('2. ✅ Automatic fallback to gemini-2.5-flash should occur');
  console.log('3. ✅ Meaningful data should be extracted from fallback model');
  console.log('4. ✅ model_used should differ from model_requested');
  console.log('5. ✅ No bounding box metadata in final result (due to fallback)');
}

// Run the comprehensive test
runComprehensiveTest().catch(error => {
  console.error('💥 Test suite failed:', error);
});
