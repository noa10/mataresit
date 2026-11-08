/**
 * Check what receipts exist in the database for testing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set; no embedded credentials are shipped.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkReceipts() {
  console.log('🔍 Checking receipts in database');
  console.log('================================');
  
  try {
    // Check total receipts
    const { data: allReceipts, error: allError, count } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, currency', { count: 'exact' })
      .order('date', { ascending: false })
      .limit(20);

    if (allError) {
      console.error('❌ Error fetching receipts:', allError);
      return;
    }

    console.log(`📊 Total receipts in database: ${count}`);
    console.log('\n📋 Recent receipts:');
    
    if (allReceipts && allReceipts.length > 0) {
      allReceipts.forEach((receipt, index) => {
        console.log(`${index + 1}. ${receipt.merchant} - ${receipt.currency} ${receipt.total} (${receipt.date})`);
      });
    } else {
      console.log('No receipts found');
    }

    // Check June 2025 receipts specifically
    console.log('\n🗓️ Checking June 2025 receipts (last month):');
    const { data: juneReceipts, error: juneError } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, currency')
      .gte('date', '2025-06-01')
      .lte('date', '2025-06-30')
      .order('date', { ascending: false });

    if (juneError) {
      console.error('❌ Error fetching June receipts:', juneError);
      return;
    }

    if (juneReceipts && juneReceipts.length > 0) {
      console.log(`Found ${juneReceipts.length} receipts in June 2025:`);
      juneReceipts.forEach((receipt, index) => {
        console.log(`${index + 1}. ${receipt.merchant} - ${receipt.currency} ${receipt.total} (${receipt.date})`);
      });
    } else {
      console.log('❌ No receipts found in June 2025');
      console.log('This explains why the temporal query returns zero results!');
    }

    // Check July 2025 receipts (current month)
    console.log('\n🗓️ Checking July 2025 receipts (current month):');
    const { data: julyReceipts, error: julyError } = await supabase
      .from('receipts')
      .select('id, merchant, date, total, currency')
      .gte('date', '2025-07-01')
      .lte('date', '2025-07-31')
      .order('date', { ascending: false });

    if (julyError) {
      console.error('❌ Error fetching July receipts:', julyError);
      return;
    }

    if (julyReceipts && julyReceipts.length > 0) {
      console.log(`Found ${julyReceipts.length} receipts in July 2025:`);
      julyReceipts.forEach((receipt, index) => {
        console.log(`${index + 1}. ${receipt.merchant} - ${receipt.currency} ${receipt.total} (${receipt.date})`);
      });
    } else {
      console.log('No receipts found in July 2025');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkReceipts().catch(console.error);
