// scripts/local-backfill-thumbnails.ts
import 'dotenv/config' // loads .env
import { createClient } from '@supabase/supabase-js'
import { Image } from 'imagescript' // Using ImageScript locally

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: receipts, error: fetchErr } = await supabase
    .from('receipts')
    .select('id, image_url')
    .is('thumbnail_url', null)
    .not('image_url', 'is', null)

  if (fetchErr) throw fetchErr
  console.log(`Found ${receipts?.length || 0} receipts to back-fill`)
  if (!receipts || receipts.length === 0) return;

  for (const { id, image_url } of receipts) {
    if (!image_url) {
        console.warn(`[${id}] Skipping due to null image_url`);
        continue;
    }
    try {
      console.log(`⏳ Processing ${id}`)

      // Extract path (using simple split, adjust if needed)
      const pathPrefix = '/receipt_images/';
      const startIndex = image_url.indexOf(pathPrefix);
       if (startIndex === -1) {
         console.warn(`[${id}] Skipping - path prefix '${pathPrefix}' not found in URL: ${image_url}`);
         continue;
       }
      const imagePath = image_url.substring(startIndex + pathPrefix.length).trim().replace(/^\/+|\/+\/?$/g, '');
       if (!imagePath) {
         console.warn(`[${id}] Skipping - extracted path is empty for URL: ${image_url}`);
         continue;
       }
       console.log(`[${id}] Downloading: ${imagePath}`);


      // Download original
      const { data: blob, error: dlErr } = await supabase
        .storage
        .from('receipt_images')
        .download(imagePath)
      if (dlErr || !blob) throw dlErr || new Error(`No data downloaded for ${imagePath}`);
      console.log(`[${id}] Downloaded successfully.`);

      // Decode & resize
      const buf = Buffer.from(await blob.arrayBuffer())
      const img = await Image.decode(buf)
      img.resize(400, Image.RESIZE_AUTO)
      const jpg = await img.encodeJPEG(65) // Use quality 65
       console.log(`[${id}] Resized and encoded.`);

      // Upload new thumbnail (explicit delete first)
      const thumbPath = `thumbnails/${id}_thumb.jpg`
       try {
         await supabase.storage.from('receipt_images').remove([thumbPath]);
         console.log(`[${id}] Deleted existing thumbnail (if any).`);
       } catch(removeErr: any) { // Added type annotation for catch block error
           const removeErrorMessage = (removeErr as Error).message; // Type assertion
           if (!removeErrorMessage || !removeErrorMessage.includes('The resource was not found')) {
                console.warn(`[${id}] Warn: Failed to delete existing thumb: ${removeErrorMessage}`);
           }
       }
      const { error: upErr } = await supabase
        .storage
        .from('receipt_images')
        .upload(thumbPath, jpg, {
          contentType: 'image/jpeg',
          cacheControl: '0', // Ensure no caching
          upsert: false // Important: We deleted first
        })
      if (upErr) throw upErr
       console.log(`[${id}] Uploaded new thumbnail.`);

      // Get public URL & update record
      const { data: pu } = supabase
        .storage
        .from('receipt_images')
        .getPublicUrl(thumbPath)
      if (!pu?.publicUrl) throw new Error('No publicUrl generated'); // Added optional chaining

      await supabase
        .from('receipts')
        .update({ thumbnail_url: pu.publicUrl })
        .eq('id', id)

      console.log(`✅ Done ${id}`)
    } catch (err: any) { // Added type annotation for catch block error
      console.error(`❌ Failed ${id}:`, err.message || err)
      // Optional: Add failed ID to a list for later retry
    }
  }
   console.log('Local thumbnail backfill complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
}) 