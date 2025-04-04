
-- Create receipt-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('receipt-images', 'receipt-images', true, false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create a policy to allow authenticated users to upload files to the receipt-images bucket
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'receipt-images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow authenticated users to read their own files
CREATE POLICY "Allow authenticated users to read their own files" ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'receipt-images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));

-- Create a policy to allow public access to all receipt images
CREATE POLICY "Allow public access to receipt images" ON storage.objects 
FOR SELECT TO public 
USING (bucket_id = 'receipt-images');
