import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client (will use service_role key from environment)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Handle CORS preflight requests
async function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

// Generate thumbnail for a single receipt
async function generateThumbnail(receiptId: string): Promise<string | null> {
  try {
    console.log(`Processing receipt ${receiptId}`);

    // Fetch the receipt data
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('id, image_url, thumbnail_url')
      .eq('id', receiptId)
      .single();

    if (fetchError) {
      throw new Error(`Error fetching receipt: ${fetchError.message}`);
    }

    // Skip if thumbnail already exists
    if (receipt.thumbnail_url) {
      console.log(`Receipt ${receiptId} already has a thumbnail`);
      return receipt.thumbnail_url;
    }

    // Skip if no image_url
    if (!receipt.image_url) {
      throw new Error(`Receipt ${receiptId} has no image URL`);
    }

    // Extract the path from the full URL
    let imagePath = receipt.image_url;
    if (imagePath.includes('/receipt_images/')) {
      imagePath = imagePath.split('/receipt_images/')[1];
    } else if (imagePath.includes('/receipt-images/')) {
      imagePath = imagePath.split('/receipt-images/')[1];
    }

    if (!imagePath) {
      throw new Error(`Could not extract image path from URL: ${receipt.image_url}`);
    }

    console.log(`Downloading image: ${imagePath}`);
    
    // Download the image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('receipt_images')
      .download(imagePath);

    if (downloadError || !imageData) {
      throw new Error(`Error downloading image: ${downloadError?.message || 'No data received'}`);
    }

    console.log('Image downloaded successfully');
    
    // Convert to ArrayBuffer for ImageScript processing
    const imageArrayBuffer = await imageData.arrayBuffer();
    const imageBytes = new Uint8Array(imageArrayBuffer);

    // Generate thumbnail using ImageScript
    console.log('Decoding image for thumbnail...');
    const image = await Image.decode(imageBytes);
    console.log(`Original dimensions: ${image.width}x${image.height}`);

    const targetWidth = 400; // Target width for thumbnail
    image.resize(targetWidth, Image.RESIZE_AUTO); // Resize maintaining aspect ratio
    console.log(`Resized dimensions: ${image.width}x${image.height}`);

    // Encode as JPEG with quality 75
    const thumbnailBytes = await image.encodeJPEG(75);
    console.log(`Thumbnail encoded as JPEG, size: ${thumbnailBytes.length} bytes`);

    // Generate thumbnail path based on receipt ID
    const thumbnailPath = `thumbnails/${receiptId}_thumb.jpg`;
    
    console.log(`Uploading thumbnail to ${thumbnailPath}`);
    
    // Upload the thumbnail to storage
    const { error: uploadError } = await supabase.storage
      .from('receipt_images')
      .upload(thumbnailPath, thumbnailBytes, {
        contentType: 'image/jpeg',
        cacheControl: '3600', // Cache for 1 hour
        upsert: true // Overwrite if exists
      });

    if (uploadError) {
      throw new Error(`Error uploading thumbnail: ${uploadError.message}`);
    }

    // Get public URL for the thumbnail
    const { data: publicUrlData } = supabase.storage
      .from('receipt_images')
      .getPublicUrl(thumbnailPath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Could not get public URL for thumbnail');
    }

    const thumbnailUrl = publicUrlData.publicUrl;
    console.log(`Thumbnail URL: ${thumbnailUrl}`);

    // Update the receipt record with the thumbnail URL
    const { error: updateError } = await supabase
      .from('receipts')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', receiptId);

    if (updateError) {
      throw new Error(`Error updating receipt: ${updateError.message}`);
    }

    console.log(`Successfully processed receipt ${receiptId}`);
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    throw error;
  }
}

// Process all receipts that don't have thumbnails
async function generateAllThumbnails(limit: number = 50): Promise<{ processed: number, errors: number }> {
  try {
    console.log(`Starting batch thumbnail generation (limit: ${limit})...`);
    
    // Create thumbnails folder in storage if it doesn't exist
    try {
      // Create an empty file to establish the thumbnails folder if needed
      await supabase.storage
        .from('receipt_images')
        .upload('thumbnails/.placeholder', new Uint8Array(0), {
          upsert: true,
        });
      
      console.log('Ensured thumbnails folder exists');
    } catch (error) {
      // Ignore error if file already exists
      console.log('Thumbnails folder check completed');
    }
    
    // Fetch receipts without thumbnails but with image URLs
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, image_url')
      .is('thumbnail_url', null)
      .not('image_url', 'is', null)
      .limit(limit);

    if (error) {
      throw new Error(`Error fetching receipts: ${error.message}`);
    }

    console.log(`Found ${receipts.length} receipts without thumbnails`);

    // Process each receipt
    let processed = 0;
    let errors = 0;
    
    for (const receipt of receipts) {
      try {
        await generateThumbnail(receipt.id);
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
serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = await handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { receiptId, batchProcess, limit } = await req.json();

    if (batchProcess) {
      // Process multiple receipts
      const result = await generateAllThumbnails(limit || 50);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Processed ${result.processed} receipts with ${result.errors} errors`,
          ...result 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (receiptId) {
      // Process a single receipt
      const thumbnailUrl = await generateThumbnail(receiptId);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          receiptId, 
          thumbnailUrl 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing receiptId or batchProcess flag' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 