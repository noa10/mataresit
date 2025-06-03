// scripts/backfill-thumbnails.ts

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Configuration
const CONCURRENCY = 5;         // Max number of concurrent function calls
const DELAY_MS = 1000;         // Delay in milliseconds between chunks

async function main() {
  // 1) Grab every receipt still missing a thumbnail
  const { data: receipts, error: fetchError } = await supabase
    .from('receipts')
    .select('id')
    .is('thumbnail_url', null)
    .not('image_url', 'is', null)

  if (fetchError) throw fetchError
  if (!receipts) {
    console.log('No receipts found.')
    return;
  }
  console.log(`Found ${receipts.length} receipts without thumbnails`)

  // 2) Process receipts in chunks with concurrency and delay
  for (let i = 0; i < receipts.length; i += CONCURRENCY) {
    const chunk = receipts.slice(i, i + CONCURRENCY)

    console.log(`Processing chunk ${Math.floor(i / CONCURRENCY) + 1} of ${Math.ceil(receipts.length / CONCURRENCY)}, ${chunk.length} receipts`)

    // Process all receipts in this chunk in parallel
    await Promise.all(
      chunk.map(async ({ id }) => {
        try {
          console.log(`Generating thumbnail for ${id}…`)
          const { data, error } = await supabase.functions.invoke(
            'generate-thumbnails',
            { body: { receiptId: id } }
          )
          if (error) {
            console.error(`✗ Error on ${id}:`, error)
          } else {
            console.log(`✓ Success on ${id}:`, data)
          }
        } catch (invokeError) {
          console.error(`✗ Invocation failure on ${id}:`, invokeError)
        }
      })
    )

    // Delay before next chunk
    if (i + CONCURRENCY < receipts.length) {
      console.log(`Delaying for ${DELAY_MS / 1000} seconds before next chunk...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log('Thumbnail backfill complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})