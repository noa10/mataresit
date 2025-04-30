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
