-- Add missing embedding-related columns to receipts table
-- This migration adds the embedding_status and has_embeddings columns that are referenced in the code

-- Add has_embeddings column if it doesn't exist
ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS has_embeddings BOOLEAN DEFAULT FALSE;

-- Add embedding_status column if it doesn't exist
ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS embedding_status TEXT;

-- Create index for better performance on embedding status queries
CREATE INDEX IF NOT EXISTS idx_receipts_embedding_status 
ON public.receipts (processing_status, has_embeddings, embedding_status);

-- Add comments to explain the purpose of these columns
COMMENT ON COLUMN public.receipts.has_embeddings IS 'Indicates whether this receipt has embeddings generated';
COMMENT ON COLUMN public.receipts.embedding_status IS 'Status of embedding generation: complete, failed, pending';

-- Update existing receipts to have proper embedding status
-- Set has_embeddings to true for receipts that already have embeddings in receipt_embeddings table
UPDATE public.receipts 
SET has_embeddings = TRUE, embedding_status = 'complete'
WHERE id IN (
  SELECT DISTINCT receipt_id 
  FROM public.receipt_embeddings 
  WHERE receipt_id IS NOT NULL
);

-- Set default embedding status for receipts without embeddings
UPDATE public.receipts 
SET has_embeddings = FALSE, embedding_status = 'pending'
WHERE has_embeddings IS NULL OR embedding_status IS NULL;
