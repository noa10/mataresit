ALTER TABLE public.receipts
ADD COLUMN processing_time FLOAT NULL;

COMMENT ON COLUMN public.receipts.processing_time IS 'Time taken for backend processing (e.g., in seconds)'; 