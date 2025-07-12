-- Add new columns to store AI model information and comparison results
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS primary_method TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS has_alternative_data BOOLEAN DEFAULT FALSE;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS discrepancies JSONB;

-- Add comment to explain the columns
COMMENT ON COLUMN public.receipts.model_used IS 'The AI model used for processing (e.g., gemini-1.5-flash)';
COMMENT ON COLUMN public.receipts.primary_method IS 'The primary processing method used (deprecated - always ai-vision)';
COMMENT ON COLUMN public.receipts.has_alternative_data IS 'Whether alternative processing method data is available';
COMMENT ON COLUMN public.receipts.discrepancies IS 'Discrepancies found between primary and alternative processing methods'; 