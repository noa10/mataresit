-- Add avatar fields to profiles table for comprehensive profile functionality
-- This migration adds support for user avatars including Google OAuth avatars

-- Add avatar-related columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS google_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP WITH TIME ZONE;

-- Update the handle_new_user function to capture Google avatar information
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Extract Google avatar URL from user metadata if available
  DECLARE
    google_avatar TEXT := NULL;
  BEGIN
    -- Try to extract avatar URL from Google OAuth metadata
    IF new.raw_user_meta_data IS NOT NULL THEN
      google_avatar := new.raw_user_meta_data->>'avatar_url';
    END IF;
  END;

  -- Insert profile with default subscription values and Google avatar
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    google_avatar_url,
    subscription_tier,
    subscription_status,
    receipts_used_this_month,
    monthly_reset_date
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'given_name', ''),
    COALESCE(new.raw_user_meta_data->>'family_name', ''),
    new.email,
    google_avatar,
    'free',
    'active',
    0,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    google_avatar_url = COALESCE(EXCLUDED.google_avatar_url, profiles.google_avatar_url),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    updated_at = NOW();
  
  RETURN new;
END;
$function$;

-- Add RLS policies for avatar access
CREATE POLICY "Users can view their own avatar" ON "public"."profiles"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own avatar" ON "public"."profiles"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add index for avatar queries
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_updated_at ON public.profiles(avatar_updated_at);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user-uploaded custom avatar image';
COMMENT ON COLUMN public.profiles.google_avatar_url IS 'URL to Google profile picture from OAuth';
COMMENT ON COLUMN public.profiles.avatar_updated_at IS 'Timestamp when avatar was last updated';
