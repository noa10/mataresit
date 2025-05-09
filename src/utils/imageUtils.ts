import { supabase } from "@/integrations/supabase/client";

/**
 * Formats an image URL for consistent display across the application
 * Uses multiple strategies to ensure images can load in various environments
 * @param url The raw image URL or path
 * @returns Formatted URL suitable for display
 */
export const getFormattedImageUrl = async (url: string | undefined): Promise<string> => {
  if (!url) return "/placeholder.svg";

  console.log("Original URL:", url);

  // For local development or testing with placeholder
  if (url.startsWith('/')) {
    console.log("Local URL detected, returning as is");
    return url;
  }

  try {
    // STRATEGY 1: Handle deeply nested paths with UUIDs by downloading and creating a data URL
    // This matches patterns like: 14367916-d0f8-4cdd-a916-4ff1a3e11c8f/1745555124724_fybcrq5b5tv.jpg
    if (url.includes('/') && url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
      console.log("Detected complex nested UUID-based file path, attempting direct fetch");

      // Remove any duplicate or unnecessary path prefixes
      const cleanPath = url.includes('receipt_images/')
        ? url.substring(url.indexOf('receipt_images/') + 'receipt_images/'.length)
        : url;

      try {
        // Directly download the file as an array buffer
        const { data, error } = await supabase.storage
          .from('receipt_images')
          .download(cleanPath);

        if (error) {
          console.error("Error downloading image:", error);
          throw error;
        }

        if (data) {
          // Convert the blob to a data URL
          const dataUrl = URL.createObjectURL(data);
          console.log("Created object URL from blob:", dataUrl);
          return dataUrl;
        }
      } catch (e) {
        console.error("Error with direct download approach:", e);
        // Fall through to other strategies
      }
    }

    // STRATEGY 2: Check if the URL is already a complete Supabase URL
    if (url.includes('supabase.co') && url.includes('/storage/v1/object/')) {
      // If it already has public/ in the path, return as is but add cache buster
      if (url.includes('/public/')) {
        const cacheBuster = `?t=${Date.now()}`;
        const formatted = url + cacheBuster;
        console.log("Complete Supabase URL with public path, adding cache buster:", formatted);
        return formatted;
      }
      // Add 'public/' to the path if it's missing
      const cacheBuster = `?t=${Date.now()}`;
      const formatted = url.replace('/object/', '/object/public/') + cacheBuster;
      console.log("Added public/ to Supabase URL with cache buster:", formatted);
      return formatted;
    }

    // STRATEGY 3: Special case: URL contains another Supabase URL inside it
    if (url.includes('receipt_images/https://')) {
      console.log("Detected nested Supabase URL with receipt_images prefix");
      // Extract the actual URL after receipt_images/
      const actualUrl = url.substring(url.indexOf('receipt_images/') + 'receipt_images/'.length);
      console.log("Extracted actual URL:", actualUrl);

      // Recursively call this function with the extracted URL
      return await getFormattedImageUrl(actualUrl);
    }

    // STRATEGY 4: Another special case: URL might have two supabase.co domains (duplicated URL)
    if ((url.match(/supabase\.co/g) || []).length > 1) {
      console.log("Detected multiple Supabase domains in URL");
      // Find where the second URL starts (likely after the first one)
      const secondUrlStart = url.indexOf('https://', url.indexOf('supabase.co') + 1);
      if (secondUrlStart !== -1) {
        const actualUrl = url.substring(secondUrlStart);
        console.log("Extracted second URL:", actualUrl);
        return await getFormattedImageUrl(actualUrl);
      }
    }

    // STRATEGY 5: Check if the URL is a full URL that doesn't need processing
    if (url.startsWith('http') && !url.includes('receipt_images/')) {
      console.log("Full URL that doesn't need processing detected, adding cache buster");
      const cacheBuster = `?t=${Date.now()}`;
      return url + cacheBuster; // Add cache buster to avoid caching issues
    }

    // STRATEGY 6: Handle relative paths that might be just storage keys
    if (!url.includes('supabase.co')) {
      // Check if this looks like a UUID-based path (simple pattern)
      if (url.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.*$/i)) {
        console.log("Detected UUID-based file path");
        try {
          // Try direct download first
          const { data, error } = await supabase.storage
            .from('receipt_images')
            .download(url);

          if (!error && data) {
            // Convert the blob to a data URL
            const dataUrl = URL.createObjectURL(data);
            console.log("Created object URL from blob for UUID path:", dataUrl);
            return dataUrl;
          }
        } catch (e) {
          console.error("Failed direct download for UUID path, falling back to public URL", e);
        }

        // Fall back to public URL if direct download fails
        const { data } = supabase.storage
          .from('receipt_images')
          .getPublicUrl(url);

        console.log("Generated publicUrl from UUID path:", data?.publicUrl);
        return data?.publicUrl ? data.publicUrl + `?t=${Date.now()}` : "/placeholder.svg";
      }

      // Extract just the filename if there's a path
      const fileName = url.includes('/')
        ? url.substring(url.lastIndexOf('/') + 1)
        : url.replace('receipt_images/', '');

      console.log("Processing as storage key, extracted filename:", fileName);

      const { data } = supabase.storage
        .from('receipt_images')
        .getPublicUrl(fileName);

      console.log("Generated publicUrl:", data?.publicUrl);
      return data?.publicUrl ? data.publicUrl + `?t=${Date.now()}` : "/placeholder.svg";
    }

    console.log("URL didn't match any formatting rules, returning placeholder");
    return "/placeholder.svg"; // Return placeholder as fallback
  } catch (error) {
    console.error("Error formatting image URL:", error);
    return "/placeholder.svg"; // Return placeholder on error
  }
};

/**
 * Simple synchronous version that returns the current URL immediately
 * while asynchronously updating the URL in the background
 * @param url The original image URL
 * @param setImageUrl Callback to set the updated URL when ready
 */
export const getFormattedImageUrlSync = (url: string | undefined, setImageUrl: (url: string) => void): string => {
  if (!url) return "/placeholder.svg";

  // Return a placeholder or the original URL immediately
  const initialUrl = url.startsWith('/') ? url : "/placeholder.svg";

  // Asynchronously get the proper URL and update via callback when ready
  getFormattedImageUrl(url).then(formattedUrl => {
    setImageUrl(formattedUrl);
  }).catch(err => {
    console.error("Error in async URL formatting:", err);
    setImageUrl("/placeholder.svg");
  });

  return initialUrl;
};

/**
 * Optimizes an image file before uploading to reduce size and improve processing success
 * @param file The original image file
 * @param maxWidth Maximum width for the optimized image
 * @param quality JPEG quality (0-100)
 * @returns A Promise resolving to the optimized image as a File object
 */
export const optimizeImageForUpload = async (
  file: File,
  maxWidth: number = 1500,
  quality: number = 80
): Promise<File> => {
  console.log('optimizeImageForUpload called with:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    maxWidth,
    quality
  });

  // Check if the file is an image
  if (!file.type.startsWith('image/')) {
    console.log('Not an image file, skipping optimization');
    return file;
  }

  // Skip optimization for small files (less than 1MB)
  if (file.size < 1024 * 1024) {
    console.log('File is already small, skipping optimization');
    return file;
  }

  return new Promise<File>((resolve, reject) => {
    try {
      // Create a FileReader to read the file
      const reader = new FileReader();

      reader.onload = (event) => {
        if (!event.target || !event.target.result) {
          console.error('FileReader result is null or undefined');
          resolve(file); // Return original file if result is missing
          return;
        }

        // Create an image element to load the file
        const img = new Image();

        img.onload = () => {
          try {
            console.log(`Image loaded with dimensions: ${img.width}x${img.height}`);

            // Create a canvas to resize the image
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions if needed
            if (width > maxWidth) {
              const ratio = maxWidth / width;
              width = maxWidth;
              height = Math.round(height * ratio);
              console.log(`Resizing to: ${width}x${height}`);
            } else {
              console.log(`No resize needed, dimensions already under max width: ${width}x${height}`);
            }

            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;

            // Draw the image on the canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error('Failed to get canvas context');
              resolve(file); // Return original file if we can't get context
              return;
            }

            // Draw with better quality settings
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob with specified quality
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  console.error('Failed to create blob from canvas');
                  resolve(file); // Return original file if blob creation fails
                  return;
                }

                console.log(`Blob created with size: ${blob.size} bytes`);

                // Create a new File from the blob
                const optimizedFile = new File(
                  [blob],
                  file.name,
                  {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  }
                );

                console.log(`Image optimized: ${file.size} bytes → ${optimizedFile.size} bytes (${Math.round(optimizedFile.size / file.size * 100)}%)`);
                resolve(optimizedFile);
              },
              'image/jpeg',
              quality / 100
            );
          } catch (err) {
            console.error('Error during canvas operations:', err);
            resolve(file); // Return original file on error
          }
        };

        img.onerror = (err) => {
          console.error('Failed to load image for optimization:', err);
          resolve(file); // Return original file if image loading fails
        };

        // Set the image source to the file data
        img.src = event.target.result as string;
      };

      reader.onerror = (err) => {
        console.error('Failed to read file for optimization:', err);
        resolve(file); // Return original file if reading fails
      };

      // Read the file as a data URL
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Unexpected error during image optimization:', err);
      resolve(file); // Return original file on any error
    }
  });
};

// Export a named constant to ensure the function is properly exported
export const ImageOptimizer = {
  optimizeImageForUpload
};
