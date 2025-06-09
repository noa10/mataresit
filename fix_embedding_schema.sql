-- Fix missing embedding schema elements
-- Run this script in the Supabase SQL editor to fix the embedding issues

-- 1. Add missing columns to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS has_embeddings BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS embedding_status TEXT;

-- 2. Create the missing RPC function
CREATE OR REPLACE FUNCTION get_line_items_without_embeddings_for_receipt(p_receipt_id uuid)
RETURNS TABLE(id uuid, description text, amount numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT li.id, li.description, li.amount
  FROM public.line_items li
  WHERE li.receipt_id = p_receipt_id
    AND li.description IS NOT NULL -- Only include items that can be processed
    AND NOT EXISTS ( -- Check if embedding does NOT exist in the receipt_embeddings table
       SELECT 1
       FROM public.receipt_embeddings re
       WHERE re.content_type = 'line_item'
         AND re.receipt_id = p_receipt_id
         -- Use a JSON field to store the line item ID since we don't have source_id
         AND (re.metadata->>'line_item_id')::uuid = li.id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Grant permissions to the function
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO anon;

-- 4. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_receipts_embedding_status 
ON public.receipts (processing_status, has_embeddings, embedding_status);

-- 5. Add comments to explain the purpose of these columns
COMMENT ON COLUMN public.receipts.has_embeddings IS 'Indicates whether this receipt has embeddings generated';
COMMENT ON COLUMN public.receipts.embedding_status IS 'Status of embedding generation: complete, failed, pending';

-- 6. Update existing receipts to have proper embedding status
-- Set has_embeddings to true for receipts that already have embeddings in receipt_embeddings table
UPDATE public.receipts 
SET has_embeddings = TRUE, embedding_status = 'complete'
WHERE id IN (
  SELECT DISTINCT receipt_id 
  FROM public.receipt_embeddings 
  WHERE receipt_id IS NOT NULL
);

-- 7. Set default embedding status for receipts without embeddings
UPDATE public.receipts 
SET has_embeddings = FALSE, embedding_status = 'pending'
WHERE has_embeddings IS NULL OR embedding_status IS NULL;
