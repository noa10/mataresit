-- Fix storage policies to use the correct bucket name 'receipt_images' instead of 'receipt-images'

-- Drop existing policies with incorrect bucket name
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to receipt images" ON storage.objects;

-- Create corrected policies for the actual bucket name 'receipt_images'
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow authenticated users to read their own files
CREATE POLICY "Allow authenticated users to read their own files" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow public access to all receipt images
CREATE POLICY "Allow public access to receipt images" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'receipt_images');

-- Create a policy to allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update their own files" ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete their own files" ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
