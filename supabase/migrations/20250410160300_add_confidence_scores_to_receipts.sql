-- Add confidence_scores JSONB column to receipts table
ALTER TABLE public.receipts
ADD COLUMN confidence_scores JSONB;

COMMENT ON COLUMN public.receipts.confidence_scores IS 'Stores the calculated confidence scores for various extracted fields as a JSON object.';