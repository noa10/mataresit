-- Fix currency codes migration
-- This migration normalizes currency codes to proper ISO 4217 standards

-- Update RM to MYR (Malaysian Ringgit)
UPDATE public.receipts 
SET currency = 'MYR' 
WHERE currency = 'RM' OR currency = 'rm';

-- Update other common currency variations
UPDATE public.receipts 
SET currency = 'USD' 
WHERE currency = '$' OR currency = 'usd';

UPDATE public.receipts 
SET currency = 'SGD' 
WHERE currency = 'S$' OR currency = 'sgd';

UPDATE public.receipts 
SET currency = 'EUR' 
WHERE currency = '€' OR currency = 'eur';

UPDATE public.receipts 
SET currency = 'GBP' 
WHERE currency = '£' OR currency = 'gbp';

UPDATE public.receipts 
SET currency = 'JPY' 
WHERE currency = '¥' OR currency = 'jpy';

UPDATE public.receipts 
SET currency = 'CNY' 
WHERE currency = 'RMB' OR currency = 'rmb' OR currency = 'cny';

UPDATE public.receipts 
SET currency = 'THB' 
WHERE currency = '฿' OR currency = 'thb';

UPDATE public.receipts 
SET currency = 'IDR' 
WHERE currency = 'Rp' OR currency = 'idr';

UPDATE public.receipts 
SET currency = 'PHP' 
WHERE currency = '₱' OR currency = 'php';

UPDATE public.receipts 
SET currency = 'VND' 
WHERE currency = '₫' OR currency = 'vnd';

-- Set default currency to MYR for any null or empty values
UPDATE public.receipts 
SET currency = 'MYR' 
WHERE currency IS NULL OR currency = '' OR LENGTH(TRIM(currency)) = 0;

-- Ensure all currency codes are uppercase
UPDATE public.receipts 
SET currency = UPPER(currency);

-- Add a check constraint to ensure only valid 3-letter currency codes
-- First, let's see if there are any invalid codes remaining
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.receipts 
    WHERE currency !~ '^[A-Z]{3}$';
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % receipts with invalid currency codes. Setting them to MYR.', invalid_count;
        
        -- Update any remaining invalid currency codes to MYR
        UPDATE public.receipts 
        SET currency = 'MYR' 
        WHERE currency !~ '^[A-Z]{3}$';
    END IF;
END $$;

-- Add a comment to document this migration
COMMENT ON COLUMN public.receipts.currency IS 'ISO 4217 currency code (3 letters, uppercase). Common mappings: RM->MYR, $->USD, €->EUR, £->GBP, etc.';

-- Create a function to normalize currency codes for future use
CREATE OR REPLACE FUNCTION public.normalize_currency_code(input_currency TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Handle null or empty input
    IF input_currency IS NULL OR TRIM(input_currency) = '' THEN
        RETURN 'MYR';
    END IF;
    
    -- Normalize common currency symbols and codes
    CASE UPPER(TRIM(input_currency))
        WHEN 'RM' THEN RETURN 'MYR';
        WHEN '$' THEN RETURN 'USD';
        WHEN 'S$' THEN RETURN 'SGD';
        WHEN '€' THEN RETURN 'EUR';
        WHEN '£' THEN RETURN 'GBP';
        WHEN '¥' THEN RETURN 'JPY';
        WHEN 'RMB' THEN RETURN 'CNY';
        WHEN '฿' THEN RETURN 'THB';
        WHEN 'RP' THEN RETURN 'IDR';
        WHEN '₱' THEN RETURN 'PHP';
        WHEN '₫' THEN RETURN 'VND';
        ELSE
            -- If it's already a 3-letter code, return it uppercase
            IF UPPER(TRIM(input_currency)) ~ '^[A-Z]{3}$' THEN
                RETURN UPPER(TRIM(input_currency));
            ELSE
                -- Default to MYR for unrecognized codes
                RETURN 'MYR';
            END IF;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.normalize_currency_code TO authenticated;

-- Add a comment to the function
COMMENT ON FUNCTION public.normalize_currency_code IS 'Normalizes currency codes to ISO 4217 standard. Maps common symbols (RM, $, €, etc.) to proper 3-letter codes.';
