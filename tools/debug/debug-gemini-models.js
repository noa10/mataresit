/**
 * Comprehensive test script to debug Gemini model issues
 * Tests both working and problematic models to identify differences
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE0NzQsImV4cCI6MjA1MDAwNzQ3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// Test image data (base64 encoded receipt image)
const testImageData = {
  data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
  mimeType: 'image/jpeg',
  isBase64: true
};

async function testModel(modelId, modelName) {
  console.log(`\n🧪 Testing ${modelName} (${modelId})`);
  console.log('='.repeat(60));
  
  const testPayload = {
    imageData: testImageData,
    receiptId: `test-receipt-${modelId}-${Date.now()}`,
    modelId: modelId
  };

  try {
    console.log(`📡 Calling enhance-receipt-data...`);
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
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`⏱️ Duration: ${duration.toFixed(2)} seconds`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS: Request completed');
      
      // Analyze the response
      console.log('\n📋 Response Analysis:');
      console.log(`   🎯 Model requested: ${result.model_requested || 'N/A'}`);
      console.log(`   🤖 Model used: ${result.model_used || 'N/A'}`);
      console.log(`   📄 Success: ${result.success}`);
      
      if (result.result) {
        const data = result.result;
        console.log(`   🏪 Merchant: ${data.merchant || 'N/A'}`);
        console.log(`   💰 Total: ${data.total || 'N/A'}`);
        console.log(`   📅 Date: ${data.date || 'N/A'}`);
        console.log(`   🏷️ Category: ${data.predicted_category || 'N/A'}`);
        console.log(`   📦 Line items: ${data.line_items?.length || 0}`);
        
        // Check if we got meaningful data
        const hasData = data.merchant || data.total || data.date || (data.line_items && data.line_items.length > 0);
        console.log(`   📊 Has extracted data: ${hasData ? '✅ YES' : '❌ NO'}`);
        
        if (!hasData) {
          console.log('⚠️ WARNING: Processing completed but no data was extracted!');
          console.log('📄 Full result:', JSON.stringify(data, null, 2));
        }
      } else {
        console.log('❌ ERROR: No result data in response');
      }
      
      // Check for fallback
      if (result.model_used !== result.model_requested) {
        console.log(`🔄 FALLBACK DETECTED: ${result.model_requested} → ${result.model_used}`);
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED: Response not OK');
      console.log('📄 Error details:', errorText);
    }
    
  } catch (error) {
    console.error('💥 ERROR during test:', error.message);
  }
}

async function runComprehensiveTest() {
  console.log('🔍 COMPREHENSIVE GEMINI MODEL DEBUG TEST');
  console.log('Testing both working and problematic models...\n');
  
  // Test models in order
  const modelsToTest = [
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Working)' },
    { id: 'gemini-2.5-flash-lite-preview-06-17', name: 'Gemini 2.5 Flash Lite Preview (Problematic)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fallback)' }
  ];
  
  for (const model of modelsToTest) {
    await testModel(model.id, model.name);
    
    // Wait between tests to avoid rate limiting
    if (modelsToTest.indexOf(model) < modelsToTest.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('\n🏁 All tests completed!');
  console.log('\n📊 SUMMARY:');
  console.log('- If Gemini 2.0 Flash Lite works but 2.5 Flash Lite Preview doesn\'t extract data,');
  console.log('  the issue is likely with the model response format or parsing logic.');
  console.log('- If 2.5 Flash Lite Preview shows fallback to 2.5 Flash, the fallback is working.');
  console.log('- If 2.5 Flash works, then the fallback target is valid.');
}

// Run the comprehensive test
runComprehensiveTest().catch(error => {
  console.error('💥 Test suite failed:', error);
});
