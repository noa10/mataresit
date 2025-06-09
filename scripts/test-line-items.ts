#!/usr/bin/env tsx

/**
 * Test script to verify line item storage functionality
 * This script will process a single receipt and check if line items are stored correctly
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

async function testLineItemStorage() {
  console.log('🧪 Testing Line Item Storage Functionality');
  console.log('==========================================');

  try {
    // Step 1: Find a receipt that was recently processed and has data
    console.log('1. Finding a properly processed receipt...');
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id, merchant, total, image_url, created_at, processing_status')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .neq('merchant', 'Processing...')
      .gt('total', 0)
      .eq('processing_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(5);

    if (receiptError || !receipts || receipts.length === 0) {
      console.error('❌ No receipts found for testing');
      return;
    }

    const testReceipt = receipts[0];
    console.log(`✅ Found test receipt: ${testReceipt.id}`);
    console.log(`   Merchant: ${testReceipt.merchant}`);
    console.log(`   Total: ${testReceipt.total}`);

    // Step 2: Check current line items for this receipt
    console.log('\n2. Checking current line items...');
    const { data: currentLineItems, error: lineItemError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceipt.id);

    if (lineItemError) {
      console.error('❌ Error checking line items:', lineItemError);
      return;
    }

    console.log(`   Current line items: ${currentLineItems?.length || 0}`);
    if (currentLineItems && currentLineItems.length > 0) {
      currentLineItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.description} - $${item.amount}`);
      });
    }

    // Step 3: Reprocess the receipt to test line item storage
    console.log('\n3. Reprocessing receipt to test line item storage...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-receipt`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        receiptId: testReceipt.id,
        imageUrl: testReceipt.image_url,
        modelId: 'gemini-2.0-flash-lite',
        primaryMethod: 'ai-vision',
        compareWithAlternative: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Process receipt function failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Receipt processing completed successfully');
    console.log(`   Line items extracted: ${result.result?.line_items?.length || 0}`);

    // Show the actual line items extracted
    if (result.result?.line_items && result.result.line_items.length > 0) {
      console.log('   Extracted line items:');
      result.result.line_items.forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.description}" - $${item.amount} (type: ${typeof item.amount})`);
      });
    }

    // Step 4: Check line items after processing
    console.log('\n4. Checking line items after processing...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for database update

    const { data: newLineItems, error: newLineItemError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceipt.id);

    if (newLineItemError) {
      console.error('❌ Error checking new line items:', newLineItemError);
      return;
    }

    console.log(`   Line items after processing: ${newLineItems?.length || 0}`);
    if (newLineItems && newLineItems.length > 0) {
      newLineItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.description} - $${item.amount}`);
      });
    }

    // Step 5: Verify the fix worked
    console.log('\n5. Test Results:');
    if (newLineItems && newLineItems.length > 0) {
      console.log('✅ SUCCESS: Line items are now being stored correctly!');
      console.log(`   ${newLineItems.length} line items found in database`);
    } else {
      console.log('❌ FAILURE: No line items found in database');
      console.log('   The fix may not be working or this receipt has no line items');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testLineItemStorage().catch(console.error);
