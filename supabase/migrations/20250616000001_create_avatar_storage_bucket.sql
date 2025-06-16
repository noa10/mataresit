-- Create avatar storage bucket for user profile pictures
-- This migration sets up secure storage for user avatars

-- Create avatars storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create a policy to allow authenticated users to upload their own avatar files
CREATE POLICY "Users can upload their own avatar" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = SPLIT_PART(name, '/', 1)
);

-- Create a policy to allow authenticated users to update their own avatar files
CREATE POLICY "Users can update their own avatar" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = SPLIT_PART(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = SPLIT_PART(name, '/', 1)
);

-- Create a policy to allow authenticated users to delete their own avatar files
CREATE POLICY "Users can delete their own avatar" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = SPLIT_PART(name, '/', 1)
);

-- Create a policy to allow public access to all avatar images (for display)
CREATE POLICY "Allow public access to avatar images" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'avatars');

-- Create a policy to allow authenticated users to read their own avatar files
CREATE POLICY "Users can read their own avatar" ON storage.objects 
FOR SELECT TO authenticated 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = SPLIT_PART(name, '/', 1)
);
