import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-requested-with, user-agent, accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

// Helper function to add CORS headers to any response
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Initialize Supabase client (will use service_role key from environment)
const supabaseUrl = Deno.env.get('PROJECT_URL')!;
const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;

// ---- ADD DEBUG LOGS ----
console.log(`[DEBUG] Runtime PROJECT_URL: ${supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'MISSING!'}`);
console.log(`[DEBUG] Runtime SERVICE_ROLE_KEY: ${supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'MISSING!'}`);
// ---- END DEBUG LOGS ----

const supabase = createClient(supabaseUrl, supabaseKey);

// Retry logic with exponential backoff
async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... ${retries} left`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Enhanced thumbnail generator
async function generateThumbnail(receiptId: string): Promise<string | null> {
  try {
    console.log(`[${receiptId}] Starting thumbnail generation`);
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('id, image_url, thumbnail_url')
      .eq('id', receiptId)
      .single();

    if (fetchError) throw new Error(`Error fetching receipt: ${fetchError.message}`);

    if (!receipt.image_url || !receipt.image_url.startsWith('https://')) {
      console.warn(`Invalid image URL for receipt ${receiptId}: ${receipt.image_url}`);
      return null;
    }

    // --- Simplified Path Extraction (for testing) ---
    const urlString = receipt.image_url;
    const pathPrefix = '/receipt_images/';
    const startIndex = urlString.indexOf(pathPrefix);
    if (startIndex === -1) {
        throw new Error(`Path prefix '${pathPrefix}' not found in URL: ${urlString}`);
    }
    const imagePath = urlString.substring(startIndex + pathPrefix.length);
    // --- End Simplified Path Extraction ---

    console.log(`[${receiptId}] Original image URL: ${urlString}`);
    console.log(`[${receiptId}] Extracted image path (simple split): ${imagePath}`);

    // Ensure no leading/trailing spaces or slashes accidentally included
    const cleanImagePath = imagePath.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanImagePath) {
         throw new Error(`Extracted path is empty for URL: ${urlString}`);
    }
    console.log(`[${receiptId}] Cleaned image path: ${cleanImagePath}`);


    // Download image from storage using the cleaned path
    const bucketName = 'receipt_images'; // Explicitly define
    console.log(`[${receiptId}] Attempting download from bucket '${bucketName}' with path: '${cleanImagePath}'`);
    const { data: imageData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(cleanImagePath); // Use cleaned path
    if (downloadError) {
      console.error(`[${receiptId}] Full download error:`, JSON.stringify(downloadError, null, 2));
      throw new Error(`Error downloading image: ${downloadError.message}`);
    }
    if (!imageData) {
      throw new Error('No data received from image download');
    }
    console.log(`[${receiptId}] Image downloaded successfully`);

    // Decode and resize only if needed
    const imageArrayBuffer = await imageData.arrayBuffer();
    const image = await Image.decode(imageArrayBuffer);
    const targetWidth = 400;
    if (image.width > targetWidth) {
      image.resize(targetWidth, Image.RESIZE_AUTO);
      console.log(`[${receiptId}] Image decoded and resized`);
    } else {
      console.log(`[${receiptId}] Image decoded (no resize needed)`);
    }

    // Lower JPEG quality for faster processing
    const thumbnailBytes = await image.encodeJPEG(65);
    const thumbnailPath = `thumbnails/${receiptId}_thumb.jpg`;

    // --- START MODIFICATION: Explicit Delete before Upload ---
    try {
      // Attempt to delete the existing thumbnail first to ensure clean metadata on upload
      console.log(`[${receiptId}] Attempting to delete existing thumbnail if present: ${thumbnailPath}`);
      const { error: deleteError } = await supabase.storage
        .from('receipt_images')
        .remove([thumbnailPath]); // .remove() expects an array of paths

      if (deleteError && deleteError.message !== 'The resource was not found') {
        // Log non-critical deletion errors but proceed with upload attempt
        console.warn(`[${receiptId}] Error deleting existing thumbnail (continuing upload):`, deleteError.message);
      } else if (!deleteError) {
        console.log(`[${receiptId}] Successfully deleted existing thumbnail.`);
      }
    } catch (deleteCatchError) {
        // Catch any unexpected error during delete and log it, but still try uploading
        console.warn(`[${receiptId}] Caught unexpected error during thumbnail deletion (continuing upload):`, deleteCatchError);
    }

    // Upload thumbnail (with correct Content-Type and no cache)
    console.log(`[${receiptId}] Uploading new thumbnail: ${thumbnailPath}`);
    const { error: uploadError } = await supabase.storage
      .from('receipt_images')
      .upload(thumbnailPath, thumbnailBytes, {
        contentType: 'image/jpeg',
        upsert: false, // Set to false as we explicitly deleted first
        cacheControl: '0' // Set cache control to 0 to bypass CDN/browser cache after update
      });
    if (uploadError) throw new Error(`Error uploading thumbnail: ${uploadError.message}`);
    console.log(`[${receiptId}] Thumbnail uploaded successfully`);
    // --- END MODIFICATION ---

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('receipt_images')
      .getPublicUrl(thumbnailPath);
    const thumbnailUrl = publicUrlData?.publicUrl;
    if (!thumbnailUrl) throw new Error('Failed to get public URL for thumbnail');

    // Update receipt
    await supabase.from('receipts').update({ thumbnail_url: thumbnailUrl }).eq('id', receiptId);
    console.log(`[${receiptId}] Thumbnail generated successfully`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    throw error;
  }
}

// Batch thumbnail generation with retry
async function generateAllThumbnails(limit = 50): Promise<{ processed: number, errors: number }> {
  try {
    console.log(`Starting batch thumbnail generation (limit: ${limit})...`);
    // Ensure thumbnails folder exists
    try {
      await supabase.storage
        .from('receipt_images')
        .upload('thumbnails/.placeholder', new Uint8Array(0), { upsert: true });
      console.log('Ensured thumbnails folder exists');
    } catch (error) {
      console.log('Thumbnails folder check completed');
    }
    // Fetch receipts
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, image_url')
      .is('thumbnail_url', null)
      .not('image_url', 'is', null)
      .limit(limit);
    if (error) throw new Error(`Error fetching receipts: ${error.message}`);
    console.log(`Found ${receipts.length} receipts without thumbnails`);
    let processed = 0;
    let errors = 0;
    for (const receipt of receipts) {
      try {
        await retry(() => generateThumbnail(receipt.id));
        processed++;
      } catch (error) {
        console.error(`Error processing receipt ${receipt.id}:`, error);
        errors++;
      }
    }
    console.log(`Completed processing. Success: ${processed}, Errors: ${errors}`);
    return { processed, errors };
  } catch (error) {
    console.error('Error in batch process:', error);
    throw error;
  }
}

// Main serve function
serve(async (req: Request): Promise<Response> => {
  try {
    // 1) CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 2) Only POST allowed
    if (req.method !== 'POST') {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // 3) Parse inbound JSON in here
    const { receiptId, batchProcess, limit } = await req.json();

    // 4) Dispatch to single vs batch
    if (batchProcess) {
      const result = await generateAllThumbnails(limit || 50);
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            success: true,
            message: `Processed ${result.processed} receipts with ${result.errors} errors`,
            ...result
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
    else if (receiptId) {
      const thumbnailUrl = await retry(() => generateThumbnail(receiptId));
      return addCorsHeaders(
        new Response(
          JSON.stringify({ success: true, receiptId, thumbnailUrl }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
    else {
      return addCorsHeaders(
        new Response(
          JSON.stringify({ error: 'Missing receiptId or batchProcess flag' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

  } catch (err) {
    // THIS catches *everything*, even a bare `throw null`
    console.error('Function error (caught at top level):', err);
    return addCorsHeaders(
      new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          success: false
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
}); 