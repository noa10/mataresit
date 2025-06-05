-- Fix duplicate foreign key constraints that are causing relationship conflicts
-- This migration removes duplicate foreign key constraints that are causing Supabase ORM confusion

-- 1. Fix line_items table - remove duplicate foreign key constraint
-- Keep the more descriptive constraint name and remove the generic one
DO $$ 
BEGIN
    -- Check if the generic constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_receipt' 
        AND table_name = 'line_items' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.line_items DROP CONSTRAINT fk_receipt;
        RAISE NOTICE 'Dropped duplicate fk_receipt constraint from line_items table';
    END IF;
END $$;

-- 2. Fix processing_logs table - remove duplicate foreign key constraint
DO $$ 
BEGIN
    -- Check if the generic constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_receipt' 
        AND table_name = 'processing_logs' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.processing_logs DROP CONSTRAINT fk_receipt;
        RAISE NOTICE 'Dropped duplicate fk_receipt constraint from processing_logs table';
    END IF;
END $$;

-- 3. Fix receipt_embeddings table - remove duplicate foreign key constraint
DO $$ 
BEGIN
    -- Check if the generic constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_receipt' 
        AND table_name = 'receipt_embeddings' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.receipt_embeddings DROP CONSTRAINT fk_receipt;
        RAISE NOTICE 'Dropped duplicate fk_receipt constraint from receipt_embeddings table';
    END IF;
END $$;

-- 4. Verify the remaining constraints are properly named and functional
-- This query will show the remaining foreign key constraints for verification
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE 'Remaining foreign key constraints after cleanup:';
    
    FOR constraint_record IN
        SELECT 
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('line_items', 'processing_logs', 'receipt_embeddings')
            AND ccu.table_name = 'receipts'
        ORDER BY tc.table_name, tc.constraint_name
    LOOP
        RAISE NOTICE 'Table: %, Constraint: %, Column: % -> %.%', 
            constraint_record.table_name,
            constraint_record.constraint_name,
            constraint_record.column_name,
            constraint_record.foreign_table_name,
            constraint_record.foreign_column_name;
    END LOOP;
END $$;

-- 5. Add comments to document the fix
COMMENT ON TABLE public.line_items IS 'Line items table with single foreign key constraint to receipts table (duplicate fk_receipt constraint removed)';
COMMENT ON TABLE public.processing_logs IS 'Processing logs table with single foreign key constraint to receipts table (duplicate fk_receipt constraint removed)';

-- Only add comment if receipt_embeddings table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'receipt_embeddings'
    ) THEN
        COMMENT ON TABLE public.receipt_embeddings IS 'Receipt embeddings table with single foreign key constraint to receipts table (duplicate fk_receipt constraint removed)';
    END IF;
END $$;

-- 6. Refresh the schema cache to ensure Supabase recognizes the changes
-- This is important for the ORM to pick up the corrected relationships
NOTIFY pgrst, 'reload schema';
