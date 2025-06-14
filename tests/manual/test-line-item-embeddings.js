// Test script to debug line item embedding generation
const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTg3MDI0MDAsImV4cCI6MjAzNDI3ODQwMH0.Ej_199Oe6Ry_YDk6Nh_JKlhJQOtBrIjJhGpXEHGpCJo';

async function testLineItemEmbeddings() {
  try {
    console.log('Testing line item embedding generation...');

    // Test receipt ID with line items that need embeddings
    const testReceiptId = '69db6c80-9bbd-4a21-ad1d-5bb30974c645';

    console.log(`Testing with receipt ID: ${testReceiptId}`);

    // Call the edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        receiptId: testReceiptId,
        processLineItems: true,
        forceRegenerate: false
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`✅ Successfully processed ${result.count} line items`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Error testing line item embeddings:', error);
  }
}

// Run the test
testLineItemEmbeddings();