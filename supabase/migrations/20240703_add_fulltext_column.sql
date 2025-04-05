-- Add fullText column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'receipts' 
    AND column_name = 'fullText'
  ) THEN
    ALTER TABLE public.receipts ADD COLUMN "fullText" TEXT;
  END IF;
END
$$; 