-- Add missing columns to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS has_embeddings BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS embedding_status TEXT;
