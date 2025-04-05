<<<<<<< HEAD
-- Create receipt_images storage bucket if it doesn't exist
=======

-- Create receipt-images storage bucket if it doesn't exist
>>>>>>> 76d6159c383996ce9de5cf38c9dd6ca665c3bc36
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('receipt-images', 'receipt-images', true, false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

<<<<<<< HEAD
-- Create a policy to allow authenticated users to upload files if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to upload files'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
    END IF;
END $$;

-- Create a policy to allow authenticated users to read their own files if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to read their own files'
    ) THEN
        CREATE POLICY "Allow authenticated users to read their own files" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'receipt_images' AND auth.uid()::text = SPLIT_PART(name, '/', 1));
    END IF;
END $$;

-- Create a policy to allow public access to all receipt images if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public access to receipt images'
    ) THEN
        CREATE POLICY "Allow public access to receipt images" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'receipt_images');
    END IF;
END $$;
=======
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
>>>>>>> 76d6159c383996ce9de5cf38c9dd6ca665c3bc36
