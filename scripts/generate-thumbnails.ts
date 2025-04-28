import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Initialize Supabase client with alternative credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL2 || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY2 || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure thumbnail size
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_QUALITY = 75;

// Storage bucket name
const STORAGE_BUCKET = 'receipt_images';

interface ImageSource {
  id: string;
  url: string;
}

async function fetchImagesFromDatabase(): Promise<ImageSource[]> {
  console.log('Fetching image URLs from database...');
  
  // First check if there are any receipts at all
  const { count, error: countError } = await supabase
    .from('receipts')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error counting receipts:', countError);
    return [];
  }
  
  console.log(`Total receipts in database: ${count}`);
  
  if (count === 0) {
    console.log('No receipts found in database');
    return [];
  }
  
  // Fetch all receipts with image URLs
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('id, image_url')
    .not('image_url', 'is', null);

  if (error) {
    console.error(`Error fetching receipts with images: ${error.message}`);
    return [];
  }

  if (!receipts || receipts.length === 0) {
    console.log('No receipts with image_url found');
    
    // If there are receipts but none have image_url, check for any URL-like field
    console.log('Checking for alternative image URL fields...');
    
    // Fetch a sample receipt to examine its structure
    const { data: sampleReceipt, error: sampleError } = await supabase
      .from('receipts')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.error('Error fetching sample receipt:', sampleError);
      return [];
    }
    
    if (sampleReceipt) {
      console.log('Sample receipt fields:', Object.keys(sampleReceipt));
      
      // Look for potential image URL fields
      const potentialImageFields = Object.entries(sampleReceipt)
        .filter(([key, value]) => 
          typeof value === 'string' && 
          (key.includes('image') || key.includes('url') || key.includes('file')) &&
          (value as string).match(/\.(jpg|jpeg|png|gif|webp|pdf)/i)
        )
        .map(([key]) => key);
      
      if (potentialImageFields.length > 0) {
        console.log(`Found potential image fields: ${potentialImageFields.join(', ')}`);
        
        // Try the first potential field
        const alternativeField = potentialImageFields[0];
        console.log(`Trying to use '${alternativeField}' as image URL field`);
        
        const { data: alternativeReceipts, error: altError } = await supabase
          .from('receipts')
          .select(`id, ${alternativeField}`)
          .not(alternativeField, 'is', null);
        
        if (altError) {
          console.error(`Error fetching with alternative field: ${altError.message}`);
          return [];
        }
        
        if (alternativeReceipts && alternativeReceipts.length > 0) {
          console.log(`Found ${alternativeReceipts.length} receipts with ${alternativeField}`);
          return alternativeReceipts.map(receipt => ({
            id: receipt.id,
            url: receipt[alternativeField]
          }));
        }
      }
    }
    
    return [];
  }

  console.log(`Found ${receipts.length} receipts with image_url`);
  return receipts.map(receipt => ({
    id: receipt.id,
    url: receipt.image_url
  }));
}

// List all files in a storage bucket folder
async function listStorageFiles(folder: string = ''): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder);
    
    if (error) {
      console.error(`Error listing files in ${folder}:`, error);
      return [];
    }
    
    if (!data || !Array.isArray(data)) return [];
    
    // Get files and folders
    const files: string[] = [];
    const folders: string[] = [];
    
    for (const item of data) {
      // Supabase storage items have name property
      if (item && typeof item === 'object' && 'name' in item) {
        const name = item.name as string;
        
        // Check if it's likely a folder (no extension or ends with /)
        if (name.endsWith('/') || !name.includes('.')) {
          folders.push(folder ? `${folder}/${name}` : name);
        } else {
          files.push(folder ? `${folder}/${name}` : name);
        }
      }
    }
    
    // List files in subfolders recursively
    let allFiles = [...files];
    
    for (const subfolder of folders) {
      const subfolderFiles = await listStorageFiles(subfolder);
      allFiles = [...allFiles, ...subfolderFiles];
    }
    
    return allFiles;
  } catch (error) {
    console.error('Error listing storage files:', error);
    return [];
  }
}

// Fallback: Find images directly in storage if no database records have image URLs
async function fetchImagesFromStorage(): Promise<ImageSource[]> {
  console.log('Fetching images directly from storage...');
  
  const files = await listStorageFiles();
  
  // Filter for image files only
  const imageFiles = files.filter(file => 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
  );
  
  console.log(`Found ${imageFiles.length} images in storage`);
  
  return imageFiles.map(file => {
    // Extract a unique ID from the filename or use the filename itself
    const id = path.basename(file, path.extname(file));
    
    // Get the full URL
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(file);
    
    return {
      id,
      url: data?.publicUrl || file
    };
  });
}

async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(THUMBNAIL_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();
}

async function downloadImage(imagePath: string): Promise<Buffer> {
  try {
    // Check if this is a full URL
    if (imagePath.startsWith('http')) {
      console.log(`Downloading from URL: ${imagePath}`);
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
    
    // Extract storage path if it's a Supabase URL
    if (imagePath.includes('/storage/v1/object/') && imagePath.includes('/receipt_images/')) {
      const pathParts = imagePath.split('/receipt_images/');
      if (pathParts.length > 1) {
        imagePath = pathParts[1];
      }
    }
    
    console.log(`Downloading from storage: ${imagePath}`);
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(imagePath);

    if (error) {
      throw new Error(`Error downloading image: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from download');
    }

    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

async function processImageSource(source: ImageSource): Promise<void> {
  try {
    console.log(`Processing image for ${source.id}`);

    // Skip if no URL
    if (!source.url) {
      console.log(`Skipping ${source.id} - no image URL`);
      return;
    }

    // Extract the path from the full URL
    let imagePath = source.url;
    
    try {
      // Try to download and process the image
      const imageBuffer = await downloadImage(imagePath);
      
      console.log(`Generating thumbnail for ${source.id}`);
      const thumbnailBuffer = await generateThumbnail(imageBuffer);
      
      // Generate thumbnail path
      const thumbnailPath = `thumbnails/${source.id}_thumb.jpg`;
      
      console.log(`Uploading thumbnail to ${thumbnailPath}`);
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Error uploading thumbnail: ${uploadError.message}`);
      }

      // Get public URL for the thumbnail
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(thumbnailPath);

      if (!publicUrlData?.publicUrl) {
        console.warn(`Could not get public URL for thumbnail for ${source.id}`);
      } else {
        console.log(`Generated thumbnail URL: ${publicUrlData.publicUrl}`);
        
        // Log the thumbnail URL to a CSV file for later reference
        fs.appendFileSync('thumbnail-urls.csv', `${source.id},${imagePath},${publicUrlData.publicUrl}\n`);
      }

      console.log(`Successfully processed ${source.id}`);
    } catch (error) {
      console.error(`Error processing image: ${error.message}`);
      fs.appendFileSync('errors.log', `${source.id},${imagePath},${error.message}\n`);
    }
  } catch (error) {
    console.error(`Error processing source ${source.id}:`, error);
  }
}

async function main() {
  try {
    console.log('Starting thumbnail generation script...');
    
    // Initialize the CSV file with headers
    fs.writeFileSync('thumbnail-urls.csv', 'receipt_id,original_image_path,thumbnail_url\n');
    fs.writeFileSync('errors.log', 'receipt_id,original_image_path,error\n');
    
    // Create thumbnails folder in storage if it doesn't exist
    try {
      const { data: folderData, error: folderError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list('thumbnails');
        
      if (folderError && folderError.message !== 'The resource was not found') {
        // Only throw if it's not a "not found" error, which just means we need to create the folder
        throw folderError;
      }
      
      if (!folderData) {
        // Create an empty file to establish the thumbnails folder
        const { error: mkdirError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload('thumbnails/.placeholder', new Uint8Array(0), {
            upsert: true,
          });
          
        if (mkdirError) {
          throw new Error(`Error creating thumbnails folder: ${mkdirError.message}`);
        }
        
        console.log('Created thumbnails folder in storage');
      } else {
        console.log('Thumbnails folder already exists');
      }
    } catch (error) {
      console.error('Error checking or creating thumbnails folder:', error);
      // Continue anyway
    }
    
    // Try to get images from database first
    let imageSources = await fetchImagesFromDatabase();
    
    // If no images found in database, try to get them directly from storage
    if (imageSources.length === 0) {
      console.log('No images found in database, trying storage directly...');
      imageSources = await fetchImagesFromStorage();
    }
    
    if (imageSources.length === 0) {
      console.log('No images found to process');
      return;
    }

    console.log(`Found ${imageSources.length} images to process`);

    // Process each image
    let processed = 0;
    for (const source of imageSources) {
      await processImageSource(source);
      processed++;
      
      // Log progress every 10 images
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${imageSources.length} images`);
      }
    }

    console.log(`Completed processing ${processed} images`);
    console.log(`Thumbnail URLs have been saved to thumbnail-urls.csv`);
    console.log(`Any errors have been logged to errors.log`);
    console.log(`You can use these URLs to manually update your database later`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main(); 