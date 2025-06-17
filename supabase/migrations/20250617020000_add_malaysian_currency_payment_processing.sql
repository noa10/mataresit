-- Add Malaysian Currency and Payment Processing Enhancements
-- This migration improves MYR currency handling and Malaysian payment methods

-- Create Malaysian payment methods table
CREATE TABLE IF NOT EXISTS public.malaysian_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_name VARCHAR(100) NOT NULL,
  method_type VARCHAR(50) NOT NULL, -- 'card', 'ewallet', 'bank_transfer', 'cash', 'other'
  provider VARCHAR(100),
  keywords TEXT[], -- Keywords for detection
  is_active BOOLEAN DEFAULT true,
  processing_fee_percentage DECIMAL(5,2) DEFAULT 0.00,
  min_amount DECIMAL(10,2) DEFAULT 0.00,
  max_amount DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Malaysian currency exchange rates table
CREATE TABLE IF NOT EXISTS public.malaysian_currency_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(5) NOT NULL,
  to_currency VARCHAR(5) NOT NULL,
  exchange_rate DECIMAL(10,6) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual', -- 'bnm', 'xe', 'manual'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);

-- Create Malaysian receipt formats table for better parsing
CREATE TABLE IF NOT EXISTS public.malaysian_receipt_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type VARCHAR(100) NOT NULL,
  format_name VARCHAR(100) NOT NULL,
  currency_patterns TEXT[], -- Regex patterns for currency detection
  amount_patterns TEXT[], -- Patterns for amount extraction
  tax_patterns TEXT[], -- Patterns for tax detection
  payment_patterns TEXT[], -- Patterns for payment method detection
  date_patterns TEXT[], -- Patterns for date extraction
  confidence_weight INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add enhanced currency and payment fields to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS original_currency VARCHAR(5),
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS payment_method_confidence INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency_confidence INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS malaysian_payment_provider VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_malaysian_payment_methods_type ON public.malaysian_payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_malaysian_payment_methods_keywords ON public.malaysian_payment_methods USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_malaysian_currency_rates_currencies ON public.malaysian_currency_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_malaysian_currency_rates_date ON public.malaysian_currency_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_malaysian_receipt_formats_business_type ON public.malaysian_receipt_formats(business_type);

-- Enable RLS on new tables
ALTER TABLE public.malaysian_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_receipt_formats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (read-only for all users)
CREATE POLICY "Payment methods are viewable by everyone" ON public.malaysian_payment_methods
  FOR SELECT USING (true);

CREATE POLICY "Currency rates are viewable by everyone" ON public.malaysian_currency_rates
  FOR SELECT USING (true);

CREATE POLICY "Receipt formats are viewable by everyone" ON public.malaysian_receipt_formats
  FOR SELECT USING (true);

-- Only admins can manage payment and currency data
CREATE POLICY "Only admins can manage payment methods" ON public.malaysian_payment_methods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage currency rates" ON public.malaysian_currency_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage receipt formats" ON public.malaysian_receipt_formats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Insert Malaysian payment methods
INSERT INTO public.malaysian_payment_methods (method_name, method_type, provider, keywords, processing_fee_percentage, description) VALUES
-- E-wallets
('Touch ''n Go eWallet', 'ewallet', 'Touch ''n Go', ARRAY['touch n go', 'tng', 'touchngo', 'touch and go', 'touch''n go'], 0.00, 'Popular Malaysian e-wallet'),
('GrabPay', 'ewallet', 'Grab', ARRAY['grabpay', 'grab pay', 'grab wallet'], 0.00, 'Grab ride-hailing e-wallet'),
('Boost', 'ewallet', 'Axiata', ARRAY['boost', 'boost pay', 'boost wallet'], 0.00, 'Axiata e-wallet service'),
('ShopeePay', 'ewallet', 'Shopee', ARRAY['shopeepay', 'shopee pay', 'shopee wallet'], 0.00, 'Shopee e-commerce e-wallet'),
('BigPay', 'ewallet', 'AirAsia', ARRAY['bigpay', 'big pay', 'airasia bigpay'], 0.00, 'AirAsia digital payment'),
('MAE', 'ewallet', 'Maybank', ARRAY['mae', 'maybank mae', 'mae wallet'], 0.00, 'Maybank e-wallet'),
('FPX', 'bank_transfer', 'PayNet', ARRAY['fpx', 'financial process exchange', 'online banking'], 0.00, 'Malaysian online banking'),

-- Credit/Debit Cards
('Visa', 'card', 'Visa', ARRAY['visa', 'visa card'], 2.50, 'International credit/debit card'),
('Mastercard', 'card', 'Mastercard', ARRAY['mastercard', 'master card', 'mc'], 2.50, 'International credit/debit card'),
('American Express', 'card', 'Amex', ARRAY['american express', 'amex', 'ae'], 3.00, 'Premium credit card'),
('MyDebit', 'card', 'PayNet', ARRAY['mydebit', 'my debit', 'debit card'], 0.50, 'Malaysian debit card'),

-- Bank Transfers
('Maybank2u', 'bank_transfer', 'Maybank', ARRAY['maybank2u', 'maybank 2u', 'm2u'], 0.00, 'Maybank online banking'),
('CIMB Clicks', 'bank_transfer', 'CIMB', ARRAY['cimb clicks', 'cimbclicks'], 0.00, 'CIMB online banking'),
('Public Bank PBe', 'bank_transfer', 'Public Bank', ARRAY['pbe', 'public bank pbe', 'pb engage'], 0.00, 'Public Bank online banking'),
('RHB Now', 'bank_transfer', 'RHB', ARRAY['rhb now', 'rhbnow'], 0.00, 'RHB online banking'),
('Hong Leong Connect', 'bank_transfer', 'Hong Leong', ARRAY['hong leong connect', 'hlb connect'], 0.00, 'Hong Leong online banking'),

-- Cash and Others
('Cash', 'cash', NULL, ARRAY['cash', 'tunai', 'wang tunai'], 0.00, 'Physical cash payment'),
('Bank Draft', 'bank_transfer', NULL, ARRAY['bank draft', 'banker''s draft'], 0.00, 'Bank guaranteed payment'),
('Cheque', 'other', NULL, ARRAY['cheque', 'check', 'cek'], 0.00, 'Written payment instruction');

-- Insert common currency exchange rates (approximate)
INSERT INTO public.malaysian_currency_rates (from_currency, to_currency, exchange_rate, source) VALUES
('USD', 'MYR', 4.50, 'manual'),
('MYR', 'USD', 0.22, 'manual'),
('SGD', 'MYR', 3.35, 'manual'),
('MYR', 'SGD', 0.30, 'manual'),
('EUR', 'MYR', 4.75, 'manual'),
('MYR', 'EUR', 0.21, 'manual'),
('GBP', 'MYR', 5.60, 'manual'),
('MYR', 'GBP', 0.18, 'manual'),
('JPY', 'MYR', 0.030, 'manual'),
('MYR', 'JPY', 33.33, 'manual'),
('CNY', 'MYR', 0.62, 'manual'),
('MYR', 'CNY', 1.61, 'manual'),
('THB', 'MYR', 0.13, 'manual'),
('MYR', 'THB', 7.69, 'manual'),
('IDR', 'MYR', 0.00028, 'manual'),
('MYR', 'IDR', 3571.43, 'manual');

-- Insert Malaysian receipt format patterns
INSERT INTO public.malaysian_receipt_formats (business_type, format_name, currency_patterns, amount_patterns, tax_patterns, payment_patterns, date_patterns) VALUES
-- Grocery Stores
('Grocery Stores', 'Standard Malaysian Grocery',
 ARRAY['RM\s*([0-9,]+\.?[0-9]*)', 'MYR\s*([0-9,]+\.?[0-9]*)', 'RINGGIT\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['TOTAL\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'JUMLAH\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'AMOUNT\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['GST\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'SST\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'TAX\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['CASH', 'TUNAI', 'CARD', 'KAD', 'VISA', 'MASTERCARD', 'TOUCH.*GO', 'GRABPAY', 'BOOST'],
 ARRAY['[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}', '[0-9]{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+[0-9]{2,4}']),

-- Restaurants
('Restaurants and Food Services', 'Malaysian Restaurant Format',
 ARRAY['RM\s*([0-9,]+\.?[0-9]*)', 'MYR\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['TOTAL\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'JUMLAH\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'BILL\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['SERVICE\s*CHARGE\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'SST\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'TAX\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['CASH', 'TUNAI', 'CARD', 'VISA', 'MASTERCARD', 'GRABPAY', 'BOOST', 'SHOPEEPAY'],
 ARRAY['[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}', '[0-9]{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+[0-9]{2,4}']),

-- Petrol Stations
('Petrol Stations', 'Malaysian Petrol Station Format',
 ARRAY['RM\s*([0-9,]+\.?[0-9]*)', 'MYR\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['TOTAL\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'AMOUNT\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'FUEL\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['SST\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)', 'TAX\s*:?\s*RM?\s*([0-9,]+\.?[0-9]*)'],
 ARRAY['CASH', 'CARD', 'VISA', 'MASTERCARD', 'TOUCH.*GO', 'FLEET\s*CARD', 'PETRONAS\s*CARD'],
 ARRAY['[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}', '[0-9]{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+[0-9]{2,4}']);

-- Create function to format Malaysian currency
CREATE OR REPLACE FUNCTION public.format_malaysian_currency(
  amount DECIMAL(10,2),
  currency_code VARCHAR(5) DEFAULT 'MYR',
  include_symbol BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  formatted_amount TEXT;
  currency_symbol TEXT;
BEGIN
  -- Format the amount with commas for thousands
  formatted_amount := TO_CHAR(amount, 'FM999,999,999,990.00');

  -- Determine currency symbol
  CASE currency_code
    WHEN 'MYR' THEN currency_symbol := 'RM';
    WHEN 'USD' THEN currency_symbol := '$';
    WHEN 'SGD' THEN currency_symbol := 'S$';
    WHEN 'EUR' THEN currency_symbol := '€';
    WHEN 'GBP' THEN currency_symbol := '£';
    WHEN 'JPY' THEN currency_symbol := '¥';
    WHEN 'CNY' THEN currency_symbol := '¥';
    WHEN 'THB' THEN currency_symbol := '฿';
    WHEN 'IDR' THEN currency_symbol := 'Rp';
    ELSE currency_symbol := currency_code || ' ';
  END CASE;

  -- Return formatted currency
  IF include_symbol THEN
    RETURN currency_symbol || ' ' || formatted_amount;
  ELSE
    RETURN formatted_amount;
  END IF;
END;
$function$;

-- Create function to detect Malaysian payment methods
CREATE OR REPLACE FUNCTION public.detect_malaysian_payment_method(
  receipt_text TEXT
)
RETURNS TABLE (
  method_name VARCHAR(100),
  method_type VARCHAR(50),
  provider VARCHAR(100),
  confidence_score INTEGER
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mpm.method_name,
    mpm.method_type,
    mpm.provider,
    CASE
      -- Exact keyword match gets highest score
      WHEN EXISTS (
        SELECT 1 FROM unnest(mpm.keywords) AS keyword
        WHERE LOWER(receipt_text) LIKE '%' || LOWER(keyword) || '%'
      ) THEN 90
      -- Partial match gets lower score
      WHEN LOWER(receipt_text) LIKE '%' || LOWER(mpm.method_name) || '%' THEN 70
      ELSE 0
    END as confidence_score
  FROM public.malaysian_payment_methods mpm
  WHERE
    mpm.is_active = true
    AND (
      EXISTS (
        SELECT 1 FROM unnest(mpm.keywords) AS keyword
        WHERE LOWER(receipt_text) LIKE '%' || LOWER(keyword) || '%'
      )
      OR LOWER(receipt_text) LIKE '%' || LOWER(mpm.method_name) || '%'
    )
  ORDER BY confidence_score DESC, mpm.method_name
  LIMIT 5;
END;
$function$;

-- Create function to convert currency amounts
CREATE OR REPLACE FUNCTION public.convert_malaysian_currency(
  amount DECIMAL(10,2),
  from_currency VARCHAR(5),
  to_currency VARCHAR(5),
  conversion_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  exchange_rate DECIMAL(10,6);
  converted_amount DECIMAL(10,2);
  result JSONB;
BEGIN
  -- If same currency, no conversion needed
  IF from_currency = to_currency THEN
    RETURN jsonb_build_object(
      'original_amount', amount,
      'converted_amount', amount,
      'from_currency', from_currency,
      'to_currency', to_currency,
      'exchange_rate', 1.000000,
      'conversion_date', conversion_date,
      'formatted_amount', public.format_malaysian_currency(amount, to_currency)
    );
  END IF;

  -- Get exchange rate
  SELECT mcr.exchange_rate INTO exchange_rate
  FROM public.malaysian_currency_rates mcr
  WHERE
    mcr.from_currency = convert_malaysian_currency.from_currency
    AND mcr.to_currency = convert_malaysian_currency.to_currency
    AND mcr.rate_date <= conversion_date
    AND mcr.is_active = true
  ORDER BY mcr.rate_date DESC
  LIMIT 1;

  -- If no direct rate found, try reverse rate
  IF exchange_rate IS NULL THEN
    SELECT (1.0 / mcr.exchange_rate) INTO exchange_rate
    FROM public.malaysian_currency_rates mcr
    WHERE
      mcr.from_currency = convert_malaysian_currency.to_currency
      AND mcr.to_currency = convert_malaysian_currency.from_currency
      AND mcr.rate_date <= conversion_date
      AND mcr.is_active = true
    ORDER BY mcr.rate_date DESC
    LIMIT 1;
  END IF;

  -- If still no rate found, return error
  IF exchange_rate IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Exchange rate not found',
      'from_currency', from_currency,
      'to_currency', to_currency
    );
  END IF;

  -- Calculate converted amount
  converted_amount := ROUND(amount * exchange_rate, 2);

  -- Build result
  result := jsonb_build_object(
    'original_amount', amount,
    'converted_amount', converted_amount,
    'from_currency', from_currency,
    'to_currency', to_currency,
    'exchange_rate', exchange_rate,
    'conversion_date', conversion_date,
    'formatted_amount', public.format_malaysian_currency(converted_amount, to_currency)
  );

  RETURN result;
END;
$function$;

-- Create function to get latest exchange rate
CREATE OR REPLACE FUNCTION public.get_latest_malaysian_exchange_rate(
  from_currency VARCHAR(5),
  to_currency VARCHAR(5)
)
RETURNS DECIMAL(10,6)
LANGUAGE plpgsql
AS $function$
DECLARE
  rate DECIMAL(10,6);
BEGIN
  -- Get the latest exchange rate
  SELECT mcr.exchange_rate INTO rate
  FROM public.malaysian_currency_rates mcr
  WHERE
    mcr.from_currency = get_latest_malaysian_exchange_rate.from_currency
    AND mcr.to_currency = get_latest_malaysian_exchange_rate.to_currency
    AND mcr.is_active = true
  ORDER BY mcr.rate_date DESC
  LIMIT 1;

  -- If no direct rate, try reverse
  IF rate IS NULL THEN
    SELECT (1.0 / mcr.exchange_rate) INTO rate
    FROM public.malaysian_currency_rates mcr
    WHERE
      mcr.from_currency = get_latest_malaysian_exchange_rate.to_currency
      AND mcr.to_currency = get_latest_malaysian_exchange_rate.from_currency
      AND mcr.is_active = true
    ORDER BY mcr.rate_date DESC
    LIMIT 1;
  END IF;

  RETURN rate;
END;
$function$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.format_malaysian_currency(DECIMAL, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_malaysian_payment_method(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_malaysian_currency(DECIMAL, VARCHAR, VARCHAR, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_malaysian_exchange_rate(VARCHAR, VARCHAR) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.malaysian_payment_methods IS 'Malaysian payment methods with detection keywords and processing fees';
COMMENT ON TABLE public.malaysian_currency_rates IS 'Exchange rates for Malaysian Ringgit and other currencies';
COMMENT ON TABLE public.malaysian_receipt_formats IS 'Receipt format patterns for better parsing of Malaysian receipts';
COMMENT ON FUNCTION public.format_malaysian_currency(DECIMAL, VARCHAR, BOOLEAN) IS 'Formats currency amounts in Malaysian style with proper symbols';
COMMENT ON FUNCTION public.detect_malaysian_payment_method(TEXT) IS 'Detects payment methods from receipt text using keyword matching';
COMMENT ON FUNCTION public.convert_malaysian_currency(DECIMAL, VARCHAR, VARCHAR, DATE) IS 'Converts between currencies using stored exchange rates';
COMMENT ON FUNCTION public.get_latest_malaysian_exchange_rate(VARCHAR, VARCHAR) IS 'Gets the latest exchange rate between two currencies';
