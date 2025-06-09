#!/usr/bin/env tsx

/**
 * Force test line item storage by calling process-receipt with a simple test case
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

async function forceLineItemTest() {
  console.log('🧪 Force Line Item Storage Test');
  console.log('===============================');

  try {
    // Step 1: Find a receipt
    console.log('1. Finding a test receipt...');
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id, merchant, image_url')
      .eq('user_id', 'feecc208-3282-49d2-8e15-0c64b0ee4abb')
      .not('image_url', 'is', null)
      .limit(1);

    if (receiptError || !receipts || receipts.length === 0) {
      console.error('❌ No receipts found');
      return;
    }

    const testReceipt = receipts[0];
    console.log(`✅ Using receipt: ${testReceipt.id}`);

    // Step 2: Clear existing line items
    console.log('\n2. Clearing existing line items...');
    await supabase
      .from('line_items')
      .delete()
      .eq('receipt_id', testReceipt.id);

    // Step 3: Call process-receipt with a fresh receipt
    console.log('\n3. Processing receipt with line item storage...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-receipt`;
    
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
    console.log(`   Processing completed in ${endTime - startTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Function failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Function completed successfully');
    console.log(`   Line items in response: ${result.result?.line_items?.length || 0}`);

    // Step 4: Check database immediately
    console.log('\n4. Checking database for line items...');
    
    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: storedItems, error: selectError } = await supabase
      .from('line_items')
      .select('*')
      .eq('receipt_id', testReceipt.id);

    if (selectError) {
      console.error('❌ Database query failed:', selectError);
      return;
    }

    console.log(`   Line items in database: ${storedItems?.length || 0}`);
    
    if (storedItems && storedItems.length > 0) {
      console.log('🎉 SUCCESS! Line items are now being stored!');
      storedItems.forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.description}" - $${item.amount}`);
      });
    } else {
      console.log('❌ STILL FAILING: No line items found in database');
      console.log('   Check the function logs for detailed debugging information');
    }

    // Step 5: Show function logs hint
    console.log('\n5. Next steps:');
    console.log('   - Check the Supabase function logs for detailed debug output');
    console.log('   - Look for "DEBUG: Checking line items" messages');
    console.log('   - Look for "Storing X line items in database" messages');
    console.log('   - Check for any database insertion errors');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
forceLineItemTest().catch(console.error);
