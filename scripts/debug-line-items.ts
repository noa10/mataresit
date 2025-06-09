#!/usr/bin/env tsx

/**
 * Debug script to trace line item storage step by step
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

async function debugLineItemStorage() {
  console.log('🔍 Debug Line Item Storage Process');
  console.log('==================================');

  try {
    // Step 1: Find a receipt with a good image
    console.log('1. Finding a receipt with good image...');
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id, merchant, total, image_url')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .neq('merchant', 'Processing...')
      .gt('total', 20)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (receiptError || !receipts || receipts.length === 0) {
      console.error('❌ No suitable receipts found');
      return;
    }

    const testReceipt = receipts[0];
    console.log(`✅ Using receipt: ${testReceipt.id}`);
    console.log(`   Merchant: ${testReceipt.merchant}`);
    console.log(`   Total: ${testReceipt.total}`);
    console.log(`   Image URL: ${testReceipt.image_url}`);

    // Step 2: Clear existing line items
    console.log('\n2. Clearing existing line items...');
    const { error: deleteError } = await supabase
      .from('line_items')
      .delete()
      .eq('receipt_id', testReceipt.id);

    if (deleteError) {
      console.error('❌ Error clearing line items:', deleteError);
      return;
    }
    console.log('✅ Cleared existing line items');

    // Step 3: Call process-receipt function with detailed logging
    console.log('\n3. Calling process-receipt function...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-receipt`;
    
    console.log(`   Function URL: ${functionUrl}`);
    console.log(`   Receipt ID: ${testReceipt.id}`);
    console.log(`   Image URL: ${testReceipt.image_url}`);

    const startTime = Date.now();
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

    const endTime = Date.now();
    console.log(`   Processing time: ${endTime - startTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Function call failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Function call successful');
    console.log(`   Success: ${result.success}`);
    console.log(`   Line items in response: ${result.result?.line_items?.length || 0}`);

    if (result.result?.line_items && result.result.line_items.length > 0) {
      console.log('   Response line items:');
      result.result.line_items.slice(0, 5).forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.description}" - $${item.amount}`);
      });
      if (result.result.line_items.length > 5) {
        console.log(`     ... and ${result.result.line_items.length - 5} more`);
      }
    }

    // Step 4: Wait a moment for database operations to complete
    console.log('\n4. Waiting for database operations to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Check line items in database
    console.log('\n5. Checking line items in database...');
    const { data: storedLineItems, error: selectError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceipt.id);

    if (selectError) {
      console.error('❌ Error retrieving line items:', selectError);
      return;
    }

    console.log(`   Line items found in database: ${storedLineItems?.length || 0}`);
    if (storedLineItems && storedLineItems.length > 0) {
      storedLineItems.forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.description}" - $${item.amount}`);
      });
    }

    // Step 6: Final analysis
    console.log('\n6. Analysis:');
    const extractedCount = result.result?.line_items?.length || 0;
    const storedCount = storedLineItems?.length || 0;

    if (extractedCount > 0 && storedCount > 0) {
      console.log('🎉 SUCCESS: Line items extracted AND stored!');
    } else if (extractedCount > 0 && storedCount === 0) {
      console.log('❌ PROBLEM: Line items extracted but NOT stored');
      console.log('   This indicates an issue in the saveResultsToDatabase function');
    } else if (extractedCount === 0) {
      console.log('❌ PROBLEM: No line items extracted');
      console.log('   This indicates an issue in the AI extraction process');
    }

  } catch (error) {
    console.error('❌ Debug failed with error:', error.message);
  }
}

// Run the debug
debugLineItemStorage().catch(console.error);
