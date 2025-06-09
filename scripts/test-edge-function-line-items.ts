#!/usr/bin/env tsx

/**
 * Test the edge function's ability to insert line items
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testEdgeFunctionLineItems() {
  console.log('🧪 Testing Edge Function Line Item Insertion');
  console.log('============================================');

  try {
    // Step 1: Find a test receipt
    console.log('1. Finding a test receipt...');
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id, merchant')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .limit(1);

    if (receiptError || !receipts || receipts.length === 0) {
      console.error('❌ No receipts found for testing');
      return;
    }

    const testReceiptId = receipts[0].id;
    console.log(`✅ Using receipt: ${testReceiptId}`);

    // Step 2: Call the test edge function
    console.log('\n2. Calling test-line-items edge function...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/test-line-items`;
    console.log(`   Function URL: ${functionUrl}`);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        receiptId: testReceiptId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge function call failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Edge function call successful');
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Inserted items: ${result.insertedItems?.length || 0}`);
    console.log(`   Verified items: ${result.verifiedItems?.length || 0}`);

    if (result.verifiedItems && result.verifiedItems.length > 0) {
      console.log('   Verified line items:');
      result.verifiedItems.forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.description}" - $${item.amount}`);
      });
    }

    // Step 3: Double-check with direct database query
    console.log('\n3. Double-checking with direct database query...');
    const { data: directItems, error: directError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceiptId);

    if (directError) {
      console.error('❌ Direct query failed:', directError);
      return;
    }

    console.log(`✅ Direct query found ${directItems?.length || 0} line items`);
    if (directItems && directItems.length > 0) {
      directItems.forEach((item, index) => {
        console.log(`   ${index + 1}. "${item.description}" - $${item.amount}`);
      });
    }

    // Step 4: Analysis
    console.log('\n4. Analysis:');
    if (result.success && directItems && directItems.length > 0) {
      console.log('🎉 SUCCESS: Edge function CAN insert line items!');
      console.log('   This means the issue is specifically in the process-receipt function logic.');
    } else {
      console.log('❌ FAILURE: Edge function cannot insert line items');
      console.log('   This indicates a database permission or configuration issue.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testEdgeFunctionLineItems().catch(console.error);
