-- Add language support to the application
-- This migration adds language preference columns and translation management

-- Add preferred_language column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Add language columns to categories table for multilingual support
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS name_ms TEXT;

-- Add language columns to posts table for multilingual blog content
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS title_ms TEXT,
ADD COLUMN IF NOT EXISTS content_ms TEXT,
ADD COLUMN IF NOT EXISTS excerpt_ms TEXT;

-- Create translations management table for dynamic translations
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL,
  key VARCHAR(200) NOT NULL,
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(namespace, key, language)
);

-- Enable RLS on translations table
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Create policies for translations table
CREATE POLICY "Translations are viewable by everyone" ON public.translations
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage translations" ON public.translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language ON public.profiles(preferred_language);
CREATE INDEX IF NOT EXISTS idx_translations_namespace_key ON public.translations(namespace, key);
CREATE INDEX IF NOT EXISTS idx_translations_language ON public.translations(language);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language code (en, ms, etc.)';
COMMENT ON COLUMN public.categories.name_ms IS 'Category name in Malay language';
COMMENT ON COLUMN public.posts.title_ms IS 'Blog post title in Malay language';
COMMENT ON COLUMN public.posts.content_ms IS 'Blog post content in Malay language';
COMMENT ON COLUMN public.posts.excerpt_ms IS 'Blog post excerpt in Malay language';
COMMENT ON TABLE public.translations IS 'Dynamic translations for UI elements';

-- Update the handle_new_user function to include language preference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Extract Google avatar URL from user metadata if available
  DECLARE
    google_avatar TEXT := NULL;
    user_language TEXT := 'en'; -- Default language
  BEGIN
    -- Try to extract avatar URL from Google OAuth metadata
    IF new.raw_user_meta_data IS NOT NULL THEN
      google_avatar := new.raw_user_meta_data->>'avatar_url';
      -- Try to detect language from user metadata or locale
      user_language := COALESCE(
        new.raw_user_meta_data->>'locale',
        new.raw_user_meta_data->>'language',
        'en'
      );
      -- Map common locale codes to our supported languages
      IF user_language LIKE 'ms%' OR user_language LIKE 'my%' THEN
        user_language := 'ms';
      ELSE
        user_language := 'en';
      END IF;
    END IF;
  END;

  -- Insert profile with default subscription values, Google avatar, and language preference
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    google_avatar_url,
    preferred_language,
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
    user_language,
    'free',
    'active',
    0,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    google_avatar_url = COALESCE(EXCLUDED.google_avatar_url, profiles.google_avatar_url),
    preferred_language = COALESCE(EXCLUDED.preferred_language, profiles.preferred_language),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    updated_at = NOW();
  
  RETURN new;
END;
$function$;

-- Insert some default translations for common UI elements
INSERT INTO public.translations (namespace, key, language, value) VALUES
  ('common', 'buttons.save', 'en', 'Save'),
  ('common', 'buttons.save', 'ms', 'Simpan'),
  ('common', 'buttons.cancel', 'en', 'Cancel'),
  ('common', 'buttons.cancel', 'ms', 'Batal'),
  ('common', 'buttons.delete', 'en', 'Delete'),
  ('common', 'buttons.delete', 'ms', 'Padam'),
  ('navigation', 'mainMenu.dashboard', 'en', 'Dashboard'),
  ('navigation', 'mainMenu.dashboard', 'ms', 'Papan Pemuka'),
  ('navigation', 'mainMenu.settings', 'en', 'Settings'),
  ('navigation', 'mainMenu.settings', 'ms', 'Tetapan')
ON CONFLICT (namespace, key, language) DO NOTHING;
