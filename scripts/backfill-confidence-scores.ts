import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts';

// --- Configuration ---
// Load environment variables from .env file (optional, if you have one in this script's directory)
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment or .env file
config({ export: true, path: './.env.local' }); // Adjust path if your .env is elsewhere

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BATCH_SIZE = 250; // Number of records to process per batch

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.',
  );
  Deno.exit(1);
}

// --- Types (simplified for script) ---
interface OldConfidenceScore {
  receipt_id: string;
  merchant?: number | null;
  date?: number | null;
  total?: number | null;
  tax?: number | null;
  line_items?: number | null;
  payment_method?: number | null;
}

interface NewConfidenceScore {
  merchant: number;
  date: number;
  total: number;
  tax: number;
  line_items: number;
  payment_method: number;
}

// --- Main Function ---
async function backfillConfidenceScores() {
  console.log('Starting backfill process...');

  const supabase: SupabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  let totalProcessed = 0;
  let totalFailed = 0;
  let batchOffset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchStart = batchOffset * BATCH_SIZE;
    const batchEnd = batchStart + BATCH_SIZE - 1;
    console.log(`\nProcessing batch: ${batchStart} - ${batchEnd}`);

    let batchData: OldConfidenceScore[] | null = null;
    let fetchError: any = null;

    // Fetch batch from old confidence_scores table
    try {
      const { data, error } = await supabase
        .from('confidence_scores')
        .select('receipt_id, merchant, date, total, tax, line_items, payment_method')
        .range(batchStart, batchEnd);

      if (error) throw error;
      batchData = data;
    } catch (error) {
      fetchError = error;
      console.error(`Error fetching batch ${batchStart}-${batchEnd}:`, error.message);
      // Decide whether to stop or continue on fetch error
      // For now, we'll stop. Change 'break' to 'continue' to skip the batch.
      break; 
    }

    if (!batchData || batchData.length === 0) {
      console.log('No more data found in confidence_scores table.');
      hasMore = false;
      break;
    }

    console.log(`Fetched ${batchData.length} records for batch.`);

    // Prepare update promises
    const updatePromises = batchData.map((oldScore) => {
      const newScore: NewConfidenceScore = {
        merchant: oldScore.merchant ?? 0,
        date: oldScore.date ?? 0,
        total: oldScore.total ?? 0,
        tax: oldScore.tax ?? 0,
        line_items: oldScore.line_items ?? 0,
        payment_method: oldScore.payment_method ?? 0,
      };

      // Update the receipts table only if confidence_scores is currently null
      return supabase
        .from('receipts')
        .update({ confidence_scores: newScore })
        .eq('id', oldScore.receipt_id)
        .is('confidence_scores', null) // IMPORTANT: Avoid overwriting already populated scores
        .then(({ error }) => {
          if (error) {
            return { status: 'rejected', reason: error, receipt_id: oldScore.receipt_id };
          }
          return { status: 'fulfilled', receipt_id: oldScore.receipt_id };
        });
    });

    // Execute updates concurrently for the batch
    console.log(`Executing ${updatePromises.length} updates for the batch...`);
    const results = await Promise.allSettled(updatePromises);

    // Process results
    let batchSuccess = 0;
    let batchFailed = 0;
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        // The inner promise resolves with the status object we created
        if (result.value.status === 'fulfilled') {
          batchSuccess++;
        } else if (result.value.status === 'rejected') {
          // This case handles errors returned by the .then() block's error check
          console.error(`Failed to update receipt ${result.value.receipt_id}:`, result.value.reason.message);
          batchFailed++;
        }
      } else {
        // This case handles errors thrown before or during the supabase update call itself
        // We need to extract receipt_id differently if possible, or log generically
        console.error(`Update promise rejected:`, result.reason); 
        // Attempt to find receipt_id if the error object contains it (might not always work)
        const failedReceiptId = updatePromises[results.indexOf(result)]?.['receipt_id'] || 'unknown';
        console.error(` -> Associated with receipt_id (best guess): ${failedReceiptId}`);
        batchFailed++;
      }
    });

    totalProcessed += batchData.length; // Count based on fetched data
    totalFailed += batchFailed;

    console.log(`Batch complete: ${batchSuccess} successful updates, ${batchFailed} failures.`);

    // Move to the next batch
    batchOffset++;

    // Optional: Add a small delay between batches to avoid overwhelming the DB
    // await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
  }

  console.log('\n--- Backfill Process Summary ---');
  console.log(`Total records processed (attempted updates): ${totalProcessed}`);
  console.log(`Total failed updates: ${totalFailed}`);
  console.log('Backfill process finished.');
}

// Run the backfill function
backfillConfidenceScores().catch((err) => {
  console.error('Unhandled error during backfill:', err);
  Deno.exit(1);
});