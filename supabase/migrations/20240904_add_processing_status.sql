-- Add processing_status and processing_error columns to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS processing_status TEXT,
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Add comment to explain the purpose of these columns
COMMENT ON COLUMN public.receipts.processing_status IS 'Tracks the current status of receipt processing (uploading, uploaded, processing, etc.)';
COMMENT ON COLUMN public.receipts.processing_error IS 'Stores error messages if processing fails at any step';

-- Create an index on processing_status for faster queries
CREATE INDEX IF NOT EXISTS idx_receipts_processing_status ON public.receipts (processing_status);

-- Function to update processing status from failed to complete
CREATE OR REPLACE FUNCTION update_processing_status_if_failed(receipt_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.receipts
  SET 
    processing_status = 'complete',
    processing_error = NULL
  WHERE 
    id = receipt_id 
    AND processing_status IN ('failed', 'failed_ai');
END;
$$ LANGUAGE plpgsql; 