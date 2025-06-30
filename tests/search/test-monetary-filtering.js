// Test script to debug monetary filtering issues
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test user ID with receipts (from our database query)
const TEST_USER_ID = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';

async function testMonetaryFiltering() {
  console.log('=== Testing Monetary Filtering Issues ===\n');

  try {
    // Test 1: Get receipts for our test user to see what we're working with
    console.log('1. Getting sample receipts for test user:');
    const { data: sampleResults, error: sampleError } = await supabase
      .from('receipts')
      .select('id, merchant, total, currency, user_id')
      .eq('user_id', TEST_USER_ID)
      .order('total', { ascending: false })
      .limit(5);

    if (sampleError) {
      console.error('Sample Error:', sampleError);
    } else {
      console.log('Sample Results:', sampleResults?.length || 0, 'receipts found');
      if (sampleResults?.length > 0) {
        console.log('Top receipt:', sampleResults[0]);
        console.log('Data types:', {
          total: sampleResults[0].total,
          totalType: typeof sampleResults[0].total,
          asNumber: Number(sampleResults[0].total)
        });
      }
    }

    // Test 2: Supabase client .gte() method (this is what's failing in the app)
    console.log('\n2. Testing Supabase client .gte() method with user filter:');
    const { data: clientResults, error: clientError } = await supabase
      .from('receipts')
      .select('id, merchant, total, currency, user_id')
      .eq('user_id', TEST_USER_ID)
      .gte('total', 100)
      .order('total', { ascending: false })
      .limit(5);

    if (clientError) {
      console.error('Client Error:', clientError);
    } else {
      console.log('Client Results:', clientResults?.length || 0, 'receipts found');
      if (clientResults?.length > 0) {
        console.log('Sample:', clientResults[0]);
      }
    }

    // Test 3: Test with string comparison (to confirm the issue)
    console.log('\n3. Testing string comparison with user filter:');
    const { data: stringResults, error: stringError } = await supabase
      .from('receipts')
      .select('id, merchant, total, currency, user_id')
      .eq('user_id', TEST_USER_ID)
      .gte('total', '100')
      .order('total', { ascending: false })
      .limit(5);

    if (stringError) {
      console.error('String Error:', stringError);
    } else {
      console.log('String Results:', stringResults?.length || 0, 'receipts found');
      if (stringResults?.length > 0) {
        console.log('Sample:', stringResults[0]);
      }
    }

    // Test 4: Test different approaches to fix the issue
    console.log('\n4. Testing potential fixes:');

    // Test 4a: Using filter() instead of gte()
    console.log('4a. Using filter() with numeric comparison:');
    const { data: filterResults, error: filterError } = await supabase
      .from('receipts')
      .select('id, merchant, total, currency, user_id')
      .eq('user_id', TEST_USER_ID)
      .filter('total', 'gte', 100)
      .order('total', { ascending: false })
      .limit(5);

    if (filterError) {
      console.error('Filter Error:', filterError);
    } else {
      console.log('Filter Results:', filterResults?.length || 0, 'receipts found');
      if (filterResults?.length > 0) {
        console.log('Sample:', filterResults[0]);
      }
    }

    // Test 4b: Using raw SQL through RPC
    console.log('\n4b. Using raw SQL through RPC:');
    const { data: rpcResults, error: rpcError } = await supabase
      .rpc('execute_sql', {
        query: `SELECT id, merchant, total, currency, user_id
                FROM receipts
                WHERE user_id = '${TEST_USER_ID}' AND total >= 100
                ORDER BY total DESC
                LIMIT 5`
      });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
    } else {
      console.log('RPC Results:', rpcResults?.length || 0, 'receipts found');
      if (rpcResults?.length > 0) {
        console.log('Sample:', rpcResults[0]);
      }
    }

    // Test 5: Check data types of returned values
    console.log('\n5. Checking data types of returned values:');
    const { data: typeCheckResults, error: typeError } = await supabase
      .from('receipts')
      .select('id, merchant, total, currency, user_id')
      .eq('user_id', TEST_USER_ID)
      .limit(3);

    if (typeError) {
      console.error('Type Check Error:', typeError);
    } else if (typeCheckResults?.length > 0) {
      console.log('Sample data with types:');
      typeCheckResults.forEach((receipt, index) => {
        console.log(`Receipt ${index + 1}:`, {
          total: receipt.total,
          totalType: typeof receipt.total,
          isNumeric: !isNaN(Number(receipt.total)),
          asNumber: Number(receipt.total),
          comparison100: Number(receipt.total) >= 100,
          stringComparison: receipt.total >= '100'
        });
      });
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testMonetaryFiltering();
