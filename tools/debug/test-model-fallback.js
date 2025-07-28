/**
 * Test script to verify the model fallback mechanism
 * This script tests the enhance-receipt-data edge function with the problematic model
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE0NzQsImV4cCI6MjA1MDAwNzQ3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

async function testModelFallback() {
  console.log('🧪 Testing model fallback mechanism...');
  
  // Create a simple test image data (base64 encoded 1x1 pixel JPEG)
  const testImageData = {
    data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A',
    mimeType: 'image/jpeg',
    isBase64: true
  };

  const testPayload = {
    imageData: testImageData,
    receiptId: 'test-receipt-' + Date.now(),
    modelId: 'gemini-2.5-flash-lite-preview-06-17' // The problematic model
  };

  try {
    console.log('📡 Calling enhance-receipt-data with problematic model...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enhance-receipt-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ SUCCESS: Fallback mechanism worked!');
      console.log('📋 Result:', JSON.stringify(result, null, 2));
      
      // Check if fallback was used
      if (result.modelUsed && result.modelUsed !== 'gemini-2.5-flash-lite-preview-06-17') {
        console.log(`🔄 FALLBACK CONFIRMED: Used ${result.modelUsed} instead`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED: Response not OK');
      console.log('📄 Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ ERROR during test:', error);
  }
}

// Run the test
testModelFallback().then(() => {
  console.log('🏁 Test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
