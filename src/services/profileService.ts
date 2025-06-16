import { supabase } from "@/integrations/supabase/client";
import { UserWithRole } from "@/types/auth";

export interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
  avatar_updated_at: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  receipts_used_this_month: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  profile?: ProfileData;
  error?: string;
}

/**
 * Fetch complete profile data for a user
 * @param userId The user's ID
 * @returns Promise with profile data
 */
export const getProfile = async (userId: string): Promise<ProfileData | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        google_avatar_url,
        avatar_updated_at,
        subscription_tier,
        subscription_status,
        stripe_customer_id,
        stripe_subscription_id,
        receipts_used_this_month,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Profile fetch error:", error);
    return null;
  }
};

/**
 * Update user profile information
 * @param userId The user's ID
 * @param updates Profile data to update
 * @returns Promise with update result
 */
export const updateProfile = async (
  userId: string,
  updates: ProfileUpdateData
): Promise<ProfileUpdateResult> => {
  try {
    // Validate input
    if (updates.email && !isValidEmail(updates.email)) {
      return {
        success: false,
        error: 'Please enter a valid email address'
      };
    }

    if (updates.first_name && updates.first_name.length > 50) {
      return {
        success: false,
        error: 'First name must be 50 characters or less'
      };
    }

    if (updates.last_name && updates.last_name.length > 50) {
      return {
        success: false,
        error: 'Last name must be 50 characters or less'
      };
    }

    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return {
        success: false,
        error: `Failed to update profile: ${error.message}`
      };
    }

    return {
      success: true,
      profile: data
    };

  } catch (error: any) {
    console.error("Profile update error:", error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Get user's team memberships
 * @param userId The user's ID
 * @returns Promise with team membership data
 */
export const getUserTeamMemberships = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        joined_at,
        teams:team_id (
          id,
          name,
          description,
          status
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Error fetching team memberships:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Team memberships fetch error:", error);
    return [];
  }
};

/**
 * Get user's subscription information with usage stats
 * @param userId The user's ID
 * @returns Promise with subscription data
 */
export const getSubscriptionInfo = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        subscription_tier,
        subscription_status,
        receipts_used_this_month,
        monthly_reset_date,
        subscription_start_date,
        subscription_end_date,
        trial_end_date
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error fetching subscription info:", error);
      return null;
    }

    // Get subscription limits
    const { data: limitsData } = await supabase
      .from('subscription_limits')
      .select('*')
      .eq('tier', data.subscription_tier)
      .single();

    return {
      ...data,
      limits: limitsData
    };
  } catch (error) {
    console.error("Subscription info fetch error:", error);
    return null;
  }
};

/**
 * Request account deletion (soft delete)
 * @param userId The user's ID
 * @param reason Optional reason for deletion
 * @returns Promise with deletion result
 */
export const requestAccountDeletion = async (
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // For now, we'll just mark the account for deletion
    // In a production system, you might want to:
    // 1. Send an email confirmation
    // 2. Set a deletion date in the future
    // 3. Allow users to cancel the deletion
    
    const { error } = await supabase
      .from('profiles')
      .update({
        // Add a deletion_requested_at field in a future migration
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error("Account deletion request error:", error);
      return {
        success: false,
        error: `Failed to process deletion request: ${error.message}`
      };
    }

    // TODO: Implement actual account deletion logic
    // This might involve:
    // - Anonymizing user data
    // - Deleting uploaded files
    // - Canceling subscriptions
    // - Sending confirmation emails

    return {
      success: true
    };

  } catch (error: any) {
    console.error("Account deletion error:", error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

/**
 * Validate email format
 * @param email Email to validate
 * @returns True if valid email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format user's full name
 * @param profile Profile data
 * @returns Formatted full name or fallback
 */
export const getFullName = (profile: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string => {
  const firstName = profile.first_name?.trim();
  const lastName = profile.last_name?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  if (firstName) {
    return firstName;
  }
  
  if (lastName) {
    return lastName;
  }
  
  // Fallback to email username
  if (profile.email) {
    return profile.email.split('@')[0];
  }
  
  return 'User';
};
