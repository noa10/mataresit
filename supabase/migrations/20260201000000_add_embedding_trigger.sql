-- Migration to add a trigger for automatic embedding generation when receipt processing is complete

-- First, add embedding status columns to receipts table if they don't exist
ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS has_embeddings BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS embedding_status TEXT;

-- Create a function to trigger embedding generation when a receipt is marked as complete
-- This version doesn't use HTTP extension to avoid dependency issues
CREATE OR REPLACE FUNCTION public.trigger_receipt_embedding_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when processing_status changes to 'complete'
  IF (NEW.processing_status = 'complete' AND
      (OLD.processing_status IS DISTINCT FROM 'complete' OR OLD.processing_status IS NULL)) THEN

    -- Check if embeddings already exist
    IF EXISTS (
      SELECT 1 FROM public.receipt_embeddings
      WHERE receipt_id = NEW.id
      LIMIT 1
    ) THEN
      -- Embeddings already exist, just update the status
      NEW.has_embeddings := TRUE;
      NEW.embedding_status := 'complete';
    ELSE
      -- Mark for processing by the edge function
      -- The edge function will handle the actual embedding generation
      NEW.has_embeddings := FALSE;
      NEW.embedding_status := 'pending';

      -- Log that we need to generate embeddings
      INSERT INTO public.processing_logs (
        receipt_id,
        status_type,
        status_message
      ) VALUES (
        NEW.id,
        'EMBEDDING',
        'Receipt marked for embedding generation via trigger'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the receipts table
DROP TRIGGER IF EXISTS trigger_receipt_embedding_generation ON public.receipts;
CREATE TRIGGER trigger_receipt_embedding_generation
BEFORE UPDATE ON public.receipts
FOR EACH ROW
WHEN (NEW.processing_status = 'complete' AND
      (OLD.processing_status IS DISTINCT FROM 'complete' OR OLD.processing_status IS NULL))
EXECUTE FUNCTION public.trigger_receipt_embedding_generation();

-- Create a function to get receipts that need embedding generation
CREATE OR REPLACE FUNCTION public.get_receipts_needing_embeddings(
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  merchant TEXT,
  date DATE,
  total NUMERIC,
  processing_status TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    id,
    merchant,
    date,
    total,
    processing_status
  FROM
    public.receipts
  WHERE
    processing_status = 'complete' AND
    (has_embeddings = FALSE OR has_embeddings IS NULL OR embedding_status = 'failed')
  ORDER BY
    updated_at DESC
  LIMIT
    limit_count;
$$;

-- Add an index to improve performance of the trigger
CREATE INDEX IF NOT EXISTS idx_receipts_embedding_status ON public.receipts (processing_status, has_embeddings, embedding_status);

-- Add comment to explain the purpose of these columns
COMMENT ON COLUMN public.receipts.has_embeddings IS 'Indicates whether this receipt has embeddings generated';
COMMENT ON COLUMN public.receipts.embedding_status IS 'Status of embedding generation: complete, failed, pending';
