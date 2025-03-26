
-- Create receipt_images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('receipt_images', 'receipt_images', true, false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create a policy to allow authenticated users to upload files to the receipt_images bucket
INSERT INTO storage.policies (name, definition, bucket_id) 
VALUES (
  'Allow authenticated users to upload files',
  'CREATE POLICY "Allow authenticated users to upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''receipt_images'' AND auth.uid()::text = SPLIT_PART(name, ''/'', 1))',
  'receipt_images'
) ON CONFLICT (name, bucket_id) DO NOTHING;

-- Create a policy to allow authenticated users to read their own files
INSERT INTO storage.policies (name, definition, bucket_id) 
VALUES (
  'Allow authenticated users to read their own files',
  'CREATE POLICY "Allow authenticated users to read their own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''receipt_images'' AND auth.uid()::text = SPLIT_PART(name, ''/'', 1))',
  'receipt_images'
) ON CONFLICT (name, bucket_id) DO NOTHING;

-- Create a policy to allow public access to all receipt images
INSERT INTO storage.policies (name, definition, bucket_id) 
VALUES (
  'Allow public access to receipt images',
  'CREATE POLICY "Allow public access to receipt images" ON storage.objects FOR SELECT TO public USING (bucket_id = ''receipt_images'')',
  'receipt_images'
) ON CONFLICT (name, bucket_id) DO NOTHING;
