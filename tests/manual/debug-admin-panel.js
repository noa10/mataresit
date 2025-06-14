// Debug script to test line item embedding generation in the admin panel
// Run this in the browser console on the admin settings page

console.log('🔍 Starting line item embedding debug...');

// First, let's check if we can access the Supabase client
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase client is available');
} else {
  console.log('❌ Supabase client not found in global scope');
}

// Try to access the functions from the module
async function testDirectCall() {
  try {
    // Import the functions directly
    const { checkLineItemEmbeddings, generateLineItemEmbeddings } = await import('/src/lib/ai-search.ts');
    
    console.log('✅ Successfully imported functions');
    
    // Test checkLineItemEmbeddings
    console.log('📊 Checking current line item embedding stats...');
    const stats = await checkLineItemEmbeddings();
    console.log('Current stats:', stats);
    
    if (stats.withoutEmbeddings > 0) {
      console.log(`🚀 Found ${stats.withoutEmbeddings} line items without embeddings`);
      console.log('🔄 Attempting to generate embeddings for a small batch...');
      
      // Try to generate embeddings for a small batch
      const result = await generateLineItemEmbeddings(3, false); // Process only 3 receipts
      console.log('Generation result:', result);
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.processed} line items`);
      } else {
        console.log('❌ Generation failed');
      }
    } else {
      console.log('✅ All line items already have embeddings');
    }
    
  } catch (error) {
    console.error('❌ Error importing or calling functions:', error);
    
    // Fallback: try to call the edge function directly
    console.log('🔄 Trying direct edge function call...');
    await testDirectEdgeFunction();
  }
}

async function testDirectEdgeFunction() {
  try {
    // Get the session token
    const session = await window.supabase?.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    if (!token) {
      console.error('❌ No auth token available');
      return;
    }
    
    console.log('✅ Auth token available');
    
    // Test with a specific receipt that has line items without embeddings
    const testReceiptId = '69db6c80-9bbd-4a21-ad1d-5bb30974c645';
    
    console.log(`🧪 Testing with receipt ID: ${testReceiptId}`);
    
    const response = await fetch('https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY'
      },
      body: JSON.stringify({
        receiptId: testReceiptId,
        processLineItems: true,
        forceRegenerate: false
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Edge function response:', result);
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.count} line items`);
      } else {
        console.log(`❌ Edge function failed: ${result.error}`);
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Edge function request failed:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Error calling edge function directly:', error);
  }
}

// Run the test
testDirectCall();
