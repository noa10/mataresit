#!/usr/bin/env tsx

/**
 * Test script to verify database connection and line item insertion
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

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection and Line Item Insertion');
  console.log('====================================================');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic database connection...');
    const { data: testData, error: testError } = await supabase
      .from('receipts')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    console.log('✅ Database connection successful');

    // Test 2: Find a receipt to use for testing
    console.log('\n2. Finding a test receipt...');
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
    console.log(`✅ Found test receipt: ${testReceiptId}`);

    // Test 3: Clear existing line items for this receipt
    console.log('\n3. Clearing existing line items...');
    const { error: deleteError } = await supabase
      .from('line_items')
      .delete()
      .eq('receipt_id', testReceiptId);

    if (deleteError) {
      console.error('❌ Error deleting line items:', deleteError);
      return;
    }
    console.log('✅ Cleared existing line items');

    // Test 4: Insert test line items
    console.log('\n4. Inserting test line items...');
    const testLineItems = [
      {
        receipt_id: testReceiptId,
        description: 'Test Item 1',
        amount: 10.50
      },
      {
        receipt_id: testReceiptId,
        description: 'Test Item 2',
        amount: 25.99
      }
    ];

    const { data: insertedItems, error: insertError } = await supabase
      .from('line_items')
      .insert(testLineItems)
      .select();

    if (insertError) {
      console.error('❌ Error inserting line items:', insertError);
      return;
    }

    console.log('✅ Successfully inserted line items:');
    insertedItems?.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.description} - $${item.amount}`);
    });

    // Test 5: Verify line items were stored
    console.log('\n5. Verifying line items in database...');
    const { data: storedItems, error: selectError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceiptId);

    if (selectError) {
      console.error('❌ Error retrieving line items:', selectError);
      return;
    }

    console.log(`✅ Found ${storedItems?.length || 0} line items in database:`);
    storedItems?.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.description} - $${item.amount}`);
    });

    // Test 6: Clean up test data
    console.log('\n6. Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('line_items')
      .delete()
      .eq('receipt_id', testReceiptId);

    if (cleanupError) {
      console.error('❌ Error cleaning up:', cleanupError);
      return;
    }
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All database tests passed! Line item insertion works correctly.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testDatabaseConnection().catch(console.error);
