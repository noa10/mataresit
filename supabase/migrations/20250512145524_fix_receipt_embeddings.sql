-- Fix receipt embeddings table structure
-- This migration ensures that the receipt_embeddings table has the correct structure for our embedding generation functionality

-- Make sure the receipt_embeddings table exists
CREATE TABLE IF NOT EXISTS public.receipt_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  embedding vector(1536),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Ensure receipt_id column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings' AND column_name = 'receipt_id'
  ) THEN
    ALTER TABLE public.receipt_embeddings ADD COLUMN receipt_id uuid REFERENCES public.receipts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure content_type column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE public.receipt_embeddings ADD COLUMN content_type text NOT NULL DEFAULT 'full_text';
  END IF;
END $$;

-- Ensure embedding column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE public.receipt_embeddings ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Ensure metadata column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.receipt_embeddings ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index on receipt_id for faster lookups
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'receipt_embeddings' AND indexname = 'idx_receipt_embeddings_receipt_id'
  ) THEN
    CREATE INDEX idx_receipt_embeddings_receipt_id ON public.receipt_embeddings(receipt_id);
  END IF;
END $$;

-- Add index on content_type for faster lookups
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'receipt_embeddings' AND indexname = 'idx_receipt_embeddings_content_type'
  ) THEN
    CREATE INDEX idx_receipt_embeddings_content_type ON public.receipt_embeddings(content_type);
  END IF;
END $$;

-- Create vector index if pgvector extension is enabled
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'receipt_embeddings' AND indexname = 'receipt_embeddings_embedding_idx'
  ) THEN
    CREATE INDEX receipt_embeddings_embedding_idx ON public.receipt_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

-- Create a function to check for receipt embeddings
CREATE OR REPLACE FUNCTION public.count_receipt_embeddings()
RETURNS TABLE (
  total_receipts bigint,
  receipts_with_embeddings bigint,
  receipts_without_embeddings bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_count bigint;
  with_embeddings bigint;
BEGIN
  -- Get total receipt count
  SELECT COUNT(DISTINCT id) INTO total_count FROM public.receipts;
  
  -- Get count of receipts with embeddings
  SELECT COUNT(DISTINCT receipt_id) INTO with_embeddings FROM public.receipt_embeddings;
  
  RETURN QUERY 
  SELECT 
    total_count AS total_receipts,
    with_embeddings AS receipts_with_embeddings,
    (total_count - with_embeddings) AS receipts_without_embeddings;
END;
$$;