import { supabase } from "@/integrations/supabase/client";
import { optimizeImageForUpload } from "@/utils/imageUtils";

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

/**
 * Upload and set user avatar
 * @param file The image file to upload
 * @param userId The user's ID
 * @returns Promise with upload result
 */
export const uploadAvatar = async (
  file: File,
  userId: string
): Promise<AvatarUploadResult> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Please select a valid image file (JPEG, PNG, or WebP)'
      };
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: 'Image file must be smaller than 5MB'
      };
    }

    // Optimize image for avatar use (smaller size, square aspect ratio)
    const optimizedFile = await optimizeImageForUpload(file, 400, 90);

    // Create unique filename
    const fileExt = optimizedFile.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    console.log("Uploading avatar:", {
      name: fileName,
      type: optimizedFile.type,
      size: optimizedFile.size,
      bucket: 'avatars'
    });

    // Delete existing avatar if it exists
    await deleteExistingAvatar(userId);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, optimizedFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: 'Failed to generate avatar URL'
      };
    }

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: urlData.publicUrl,
        avatar_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return {
        success: false,
        error: `Failed to update profile: ${updateError.message}`
      };
    }

    return {
      success: true,
      avatarUrl: urlData.publicUrl
    };

  } catch (error: any) {
    console.error("Avatar upload error:", error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Delete existing avatar files for a user
 * @param userId The user's ID
 */
const deleteExistingAvatar = async (userId: string): Promise<void> => {
  try {
    // List all files in user's avatar folder
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(userId);

    if (listError) {
      console.warn("Could not list existing avatars:", listError);
      return;
    }

    if (files && files.length > 0) {
      // Delete all existing avatar files
      const filesToDelete = files.map(file => `${userId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove(filesToDelete);

      if (deleteError) {
        console.warn("Could not delete existing avatars:", deleteError);
      }
    }
  } catch (error) {
    console.warn("Error cleaning up existing avatars:", error);
  }
};

/**
 * Remove user's custom avatar and revert to Google avatar or initials
 * @param userId The user's ID
 * @returns Promise with removal result
 */
export const removeAvatar = async (userId: string): Promise<AvatarUploadResult> => {
  try {
    // Delete avatar files from storage
    await deleteExistingAvatar(userId);

    // Update profile to remove custom avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        avatar_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return {
        success: false,
        error: `Failed to update profile: ${updateError.message}`
      };
    }

    return {
      success: true
    };

  } catch (error: any) {
    console.error("Avatar removal error:", error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Get the best available avatar URL for a user
 * @param profile User profile data
 * @returns Avatar URL or null if none available
 */
export const getAvatarUrl = (profile: {
  avatar_url?: string | null;
  google_avatar_url?: string | null;
}): string | null => {
  // Prefer custom avatar over Google avatar
  return profile.avatar_url || profile.google_avatar_url || null;
};

/**
 * Get user initials for avatar fallback
 * @param profile User profile data
 * @returns User initials string
 */
export const getUserInitials = (profile: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string => {
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
  }
  
  if (profile.first_name) {
    return profile.first_name.charAt(0).toUpperCase();
  }
  
  if (profile.email) {
    return profile.email.charAt(0).toUpperCase();
  }
  
  return 'U';
};
