// Test the edge function with proper authentication
// This simulates what the admin panel does

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testEdgeFunctionWithAuth() {
  try {
    console.log('🔍 Testing edge function with authentication...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // You would need to sign in here with actual credentials
    // For testing, we'll use the anon key directly
    
    // Test receipt ID with line items that need embeddings
    const testReceiptId = '69db6c80-9bbd-4a21-ad1d-5bb30974c645';
    
    console.log(`🧪 Testing with receipt ID: ${testReceiptId}`);
    
    // Call the edge function using the same pattern as the admin panel
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      credentials: 'omit',
      mode: 'cors',
      body: JSON.stringify({
        receiptId: testReceiptId,
        processLineItems: true,
        forceRegenerate: false
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Edge function response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.count} line items`);
        if (result.failedCount > 0) {
          console.log(`⚠️ ${result.failedCount} line items failed to process`);
        }
      } else {
        console.log(`❌ Edge function failed: ${result.error}`);
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Edge function request failed:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing edge function:', error);
  }
}

// Run the test
testEdgeFunctionWithAuth();
