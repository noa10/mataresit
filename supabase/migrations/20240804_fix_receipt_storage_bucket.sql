
-- Drop the existing receipt_images bucket if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to receipt images" ON storage.objects;

-- Create storage bucket with the correct name "Receipt Images"
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('Receipt Images', 'Receipt Images', true, false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create a policy to allow authenticated users to upload files to the bucket
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'Receipt Images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow authenticated users to read their own files
CREATE POLICY "Allow authenticated users to read their own files" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'Receipt Images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow public access to all receipt images
CREATE POLICY "Allow public access to receipt images" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'Receipt Images');
