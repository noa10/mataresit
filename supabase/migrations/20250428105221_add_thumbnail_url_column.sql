ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
COMMENT ON COLUMN public.receipts.thumbnail_url IS 'URL to the thumbnail version of the receipt image';