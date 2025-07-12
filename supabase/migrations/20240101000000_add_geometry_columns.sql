-- Add document_structure and field_geometry columns to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS document_structure JSONB,
ADD COLUMN IF NOT EXISTS field_geometry JSONB;

-- Comment on the new columns
COMMENT ON COLUMN public.receipts.document_structure IS 'Stores the raw document structure from AI processing';
COMMENT ON COLUMN public.receipts.field_geometry IS 'Stores the bounding box coordinates for each field';
