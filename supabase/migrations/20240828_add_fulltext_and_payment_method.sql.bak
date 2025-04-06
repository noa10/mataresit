-- Add fullText column to receipts table
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
END $$;

-- Add payment_method column to confidence_scores table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'confidence_scores' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE public.confidence_scores ADD COLUMN "payment_method" FLOAT;
    END IF;
END $$; 