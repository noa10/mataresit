/**
 * Enhanced debug script for Gemini model issues
 * This script provides detailed analysis of model responses and parsing
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE0NzQsImV4cCI6MjA1MDAwNzQ3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

// Create a more realistic test image (a simple receipt-like image in base64)
const createTestReceiptImage = () => {
  // This is a minimal 1x1 pixel JPEG, but in a real test you'd use an actual receipt image
  return {
    data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
    mimeType: 'image/jpeg',
    isBase64: true
  };
};

async function testModelWithDetailedAnalysis(modelId, modelName) {
  console.log(`\n🔬 DETAILED ANALYSIS: ${modelName} (${modelId})`);
  console.log('='.repeat(80));
  
  const testPayload = {
    imageData: createTestReceiptImage(),
    receiptId: `debug-${modelId}-${Date.now()}`,
    modelId: modelId
  };

  try {
    console.log(`📡 Sending request to enhance-receipt-data...`);
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
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️ Total Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      
      console.log('\n✅ SUCCESS - Response Analysis:');
      console.log(`   🎯 Model Requested: ${result.model_requested || 'N/A'}`);
      console.log(`   🤖 Model Actually Used: ${result.model_used || 'N/A'}`);
      console.log(`   📄 Success Flag: ${result.success}`);
      
      // Check for fallback
      if (result.model_used !== result.model_requested) {
        console.log(`   🔄 FALLBACK DETECTED: ${result.model_requested} → ${result.model_used}`);
      }
      
      // Analyze the extracted data
      if (result.result) {
        const data = result.result;
        console.log('\n📊 EXTRACTED DATA ANALYSIS:');
        console.log(`   🏪 Merchant: "${data.merchant || 'EMPTY'}" (${data.merchant ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   💰 Total: ${data.total || 0} (${data.total > 0 ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   📅 Date: "${data.date || 'EMPTY'}" (${data.date ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   🏷️ Category: "${data.predicted_category || 'EMPTY'}" (${data.predicted_category ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   💳 Payment Method: "${data.payment_method || 'EMPTY'}" (${data.payment_method ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   💱 Currency: "${data.currency || 'EMPTY'}" (${data.currency ? 'HAS DATA' : 'NO DATA'})`);
        console.log(`   📦 Line Items: ${data.line_items?.length || 0} items`);
        
        // Check confidence scores
        if (data.confidence) {
          console.log('\n🎯 CONFIDENCE SCORES:');
          Object.entries(data.confidence).forEach(([field, score]) => {
            console.log(`   ${field}: ${score}%`);
          });
        }
        
        // Overall data quality assessment
        const hasData = data.merchant || data.total > 0 || data.date || 
                       (data.line_items && data.line_items.length > 0);
        
        console.log(`\n📈 DATA QUALITY: ${hasData ? '✅ GOOD' : '❌ POOR'}`);
        
        if (!hasData) {
          console.log('⚠️ ISSUE DETECTED: Model processed successfully but extracted no meaningful data');
          console.log('🔍 This suggests a parsing or model response format issue');
          
          // Check for parsing errors
          if (data.parsing_error) {
            console.log(`🚨 PARSING ERROR: ${data.parsing_error}`);
          }
        }
        
        // Show full result for debugging
        console.log('\n📄 FULL RESULT (for debugging):');
        console.log(JSON.stringify(result, null, 2));
        
      } else {
        console.log('❌ ERROR: No result data in response');
        console.log('📄 Full response:', JSON.stringify(result, null, 2));
      }
      
    } else {
      const errorText = await response.text();
      console.log('\n❌ FAILED - Error Analysis:');
      console.log('📄 Error Response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('📋 Parsed Error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('📋 Raw Error Text:', errorText);
      }
    }
    
  } catch (error) {
    console.error('\n💥 EXCEPTION during test:', error.message);
    console.error('📄 Full error:', error);
  }
}

async function runEnhancedDiagnostics() {
  console.log('🔬 ENHANCED GEMINI MODEL DIAGNOSTICS');
  console.log('Investigating the data extraction issue with detailed analysis...\n');
  
  const modelsToTest = [
    { 
      id: 'gemini-2.0-flash-lite', 
      name: 'Gemini 2.0 Flash Lite',
      description: 'Known working model - baseline for comparison'
    },
    { 
      id: 'gemini-2.5-flash-lite-preview-06-17', 
      name: 'Gemini 2.5 Flash Lite Preview',
      description: 'Problematic model - returns no data'
    },
    { 
      id: 'gemini-2.5-flash', 
      name: 'Gemini 2.5 Flash',
      description: 'Fallback model - should work if fallback is triggered'
    }
  ];
  
  for (const model of modelsToTest) {
    console.log(`\n📋 Testing: ${model.description}`);
    await testModelWithDetailedAnalysis(model.id, model.name);
    
    // Wait between tests
    if (modelsToTest.indexOf(model) < modelsToTest.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n🏁 DIAGNOSTICS COMPLETE');
  console.log('\n📊 ANALYSIS SUMMARY:');
  console.log('1. Check if fallback is working (model_used vs model_requested)');
  console.log('2. Look for parsing errors in the response');
  console.log('3. Compare data quality between working and problematic models');
  console.log('4. Check for empty data despite successful processing');
  console.log('5. Review confidence scores and response structure differences');
}

// Run the enhanced diagnostics
runEnhancedDiagnostics().catch(error => {
  console.error('💥 Diagnostics failed:', error);
});
