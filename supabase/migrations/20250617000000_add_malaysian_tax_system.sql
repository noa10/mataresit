-- Add Malaysian Tax System (GST/SST) Support
-- This migration adds comprehensive Malaysian tax handling including GST and SST

-- Create Malaysian tax categories table
CREATE TABLE IF NOT EXISTS public.malaysian_tax_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type VARCHAR(10) NOT NULL, -- 'GST', 'SST_SALES', 'SST_SERVICE', 'EXEMPT', 'ZERO_RATED'
  category_name VARCHAR(100) NOT NULL,
  category_code VARCHAR(20),
  tax_rate DECIMAL(5,2) NOT NULL, -- e.g., 6.00 for 6%, 10.00 for 10%
  description TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL means currently active
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Malaysian business categories mapping
CREATE TABLE IF NOT EXISTS public.malaysian_business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type VARCHAR(100) NOT NULL,
  business_keywords TEXT[], -- Array of keywords to match against merchant names
  tax_category_id UUID REFERENCES public.malaysian_tax_categories(id),
  confidence_weight INTEGER DEFAULT 100, -- Higher weight = more confident match
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Malaysian tax fields to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS detected_tax_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS detected_tax_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS tax_breakdown JSONB, -- Detailed tax calculation
ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS malaysian_business_category VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_malaysian_tax_categories_type_active ON public.malaysian_tax_categories(tax_type, is_active);
CREATE INDEX IF NOT EXISTS idx_malaysian_tax_categories_effective_dates ON public.malaysian_tax_categories(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_malaysian_business_categories_type ON public.malaysian_business_categories(business_type);
CREATE INDEX IF NOT EXISTS idx_receipts_detected_tax_type ON public.receipts(detected_tax_type);
CREATE INDEX IF NOT EXISTS idx_receipts_malaysian_business_category ON public.receipts(malaysian_business_category);

-- Enable RLS on new tables
ALTER TABLE public.malaysian_tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_business_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tax categories (read-only for all users)
CREATE POLICY "Tax categories are viewable by everyone" ON public.malaysian_tax_categories
  FOR SELECT USING (true);

CREATE POLICY "Business categories are viewable by everyone" ON public.malaysian_business_categories
  FOR SELECT USING (true);

-- Only admins can manage tax data
CREATE POLICY "Only admins can manage tax categories" ON public.malaysian_tax_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage business categories" ON public.malaysian_business_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Insert Malaysian tax categories data
-- Current SST system (2018 onwards)
INSERT INTO public.malaysian_tax_categories (tax_type, category_name, category_code, tax_rate, description, effective_from) VALUES
-- SST Sales Tax categories
('SST_SALES', 'Food and Beverages', 'FB', 0.00, 'Most food items are zero-rated or exempt', '2018-09-01'),
('SST_SALES', 'Alcoholic Beverages', 'ALB', 10.00, 'Alcoholic beverages and tobacco', '2018-09-01'),
('SST_SALES', 'Tobacco Products', 'TOB', 10.00, 'Tobacco and related products', '2018-09-01'),
('SST_SALES', 'Petroleum Products', 'PET', 5.00, 'Petroleum and petroleum products', '2018-09-01'),
('SST_SALES', 'Motor Vehicles', 'MOT', 10.00, 'Motor vehicles and parts', '2018-09-01'),
('SST_SALES', 'Electrical Appliances', 'ELE', 10.00, 'Electrical and electronic goods', '2018-09-01'),
('SST_SALES', 'Cosmetics', 'COS', 5.00, 'Cosmetics and toiletries', '2018-09-01'),
('SST_SALES', 'Textiles and Clothing', 'TEX', 5.00, 'Textiles, clothing, and footwear', '2018-09-01'),
('SST_SALES', 'Furniture', 'FUR', 5.00, 'Furniture and fixtures', '2018-09-01'),
('SST_SALES', 'Stationery', 'STA', 5.00, 'Stationery and office supplies', '2018-09-01'),

-- SST Service Tax categories
('SST_SERVICE', 'Professional Services', 'PROF', 6.00, 'Legal, accounting, consulting services', '2018-09-01'),
('SST_SERVICE', 'Telecommunications', 'TEL', 6.00, 'Telecommunication services', '2018-09-01'),
('SST_SERVICE', 'Insurance', 'INS', 6.00, 'Insurance services', '2018-09-01'),
('SST_SERVICE', 'Banking', 'BNK', 6.00, 'Banking and financial services', '2018-09-01'),
('SST_SERVICE', 'Hotel and Accommodation', 'HOT', 6.00, 'Hotel and accommodation services', '2018-09-01'),
('SST_SERVICE', 'Restaurant Services', 'REST', 6.00, 'Restaurant and catering services', '2018-09-01'),
('SST_SERVICE', 'Entertainment', 'ENT', 6.00, 'Entertainment and recreational services', '2018-09-01'),
('SST_SERVICE', 'Transportation', 'TRA', 6.00, 'Transportation services', '2018-09-01'),

-- Exempt and Zero-rated categories
('EXEMPT', 'Basic Food Items', 'FOOD_BASIC', 0.00, 'Rice, flour, bread, vegetables, fruits', '2018-09-01'),
('EXEMPT', 'Medical Services', 'MED', 0.00, 'Healthcare and medical services', '2018-09-01'),
('EXEMPT', 'Education', 'EDU', 0.00, 'Educational services and materials', '2018-09-01'),
('ZERO_RATED', 'Exports', 'EXP', 0.00, 'Export goods and services', '2018-09-01'),

-- Historical GST (2015-2018)
('GST', 'Standard Rate', 'GST_STD', 6.00, 'Standard GST rate', '2015-04-01'),
('GST', 'Zero Rate', 'GST_ZERO', 0.00, 'Zero-rated GST items', '2015-04-01'),
('GST', 'Exempt', 'GST_EXEMPT', 0.00, 'GST exempt items', '2015-04-01');

-- Update effective_to dates for GST (ended when SST started)
UPDATE public.malaysian_tax_categories
SET effective_to = '2018-08-31', is_active = false
WHERE tax_type = 'GST';

-- Insert Malaysian business category mappings
INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Grocery Stores',
  ARRAY['99 speedmart', 'kk super mart', 'tesco', 'aeon', 'mydin', 'giant', 'village grocer', 'jaya grocer', 'cold storage', 'mercato', 'ben''s independent grocer'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'FOOD_BASIC' AND is_active = true LIMIT 1),
  100;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Restaurants and Food Services',
  ARRAY['mcdonald''s', 'kfc', 'pizza hut', 'domino''s', 'subway', 'starbucks', 'old town white coffee', 'kopitiam', 'mamak', 'restoran', 'kedai kopi', 'food court', 'hawker'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'REST' AND is_active = true LIMIT 1),
  90;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Telecommunications',
  ARRAY['celcom', 'digi', 'maxis', 'u mobile', 'unifi', 'streamyx', 'yes', 'tunetalk', 'hotlink', 'prepaid'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'TEL' AND is_active = true LIMIT 1),
  95;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Utilities',
  ARRAY['tnb', 'tenaga nasional', 'syabas', 'air selangor', 'pba', 'sab', 'electricity', 'water', 'utility'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'PROF' AND is_active = true LIMIT 1),
  85;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Petrol Stations',
  ARRAY['petronas', 'shell', 'esso', 'caltex', 'bhp', 'petron', 'petrol', 'fuel', 'gas station'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'PET' AND is_active = true LIMIT 1),
  95;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Electronics and Appliances',
  ARRAY['harvey norman', 'courts', 'senheng', 'best denki', 'electronic', 'appliance', 'computer', 'phone', 'laptop'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'ELE' AND is_active = true LIMIT 1),
  90;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Pharmacies and Healthcare',
  ARRAY['guardian', 'watsons', 'caring', 'alpro', 'pharmacy', 'farmasi', 'clinic', 'klinik', 'hospital'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'MED' AND is_active = true LIMIT 1),
  90;

INSERT INTO public.malaysian_business_categories (business_type, business_keywords, tax_category_id, confidence_weight)
SELECT
  'Transportation Services',
  ARRAY['grab', 'taxi', 'bus', 'lrt', 'mrt', 'ktm', 'rapid', 'transport', 'toll', 'parking'],
  (SELECT id FROM public.malaysian_tax_categories WHERE category_code = 'TRA' AND is_active = true LIMIT 1),
  85;

-- Create function to detect Malaysian tax category for a business
CREATE OR REPLACE FUNCTION public.detect_malaysian_tax_category(
  merchant_name TEXT,
  receipt_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  tax_type VARCHAR(20),
  tax_rate DECIMAL(5,2),
  category_name VARCHAR(100),
  confidence_score INTEGER
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mtc.tax_type,
    mtc.tax_rate,
    mtc.category_name,
    mbc.confidence_weight as confidence_score
  FROM public.malaysian_business_categories mbc
  JOIN public.malaysian_tax_categories mtc ON mbc.tax_category_id = mtc.id
  WHERE
    mtc.is_active = true
    AND (mtc.effective_from <= receipt_date)
    AND (mtc.effective_to IS NULL OR mtc.effective_to >= receipt_date)
    AND EXISTS (
      SELECT 1 FROM unnest(mbc.business_keywords) AS keyword
      WHERE LOWER(merchant_name) LIKE '%' || LOWER(keyword) || '%'
    )
  ORDER BY mbc.confidence_weight DESC, mtc.tax_rate DESC
  LIMIT 1;
END;
$function$;

-- Create function to calculate Malaysian tax breakdown
CREATE OR REPLACE FUNCTION public.calculate_malaysian_tax(
  total_amount DECIMAL(10,2),
  tax_rate DECIMAL(5,2),
  is_inclusive BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  tax_amount DECIMAL(10,2);
  subtotal DECIMAL(10,2);
  result JSONB;
BEGIN
  IF tax_rate = 0 THEN
    -- No tax applicable
    result := jsonb_build_object(
      'subtotal', total_amount,
      'tax_amount', 0.00,
      'tax_rate', tax_rate,
      'total', total_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'zero_rated'
    );
  ELSIF is_inclusive THEN
    -- Tax is included in the total amount
    tax_amount := ROUND(total_amount * tax_rate / (100 + tax_rate), 2);
    subtotal := total_amount - tax_amount;
    result := jsonb_build_object(
      'subtotal', subtotal,
      'tax_amount', tax_amount,
      'tax_rate', tax_rate,
      'total', total_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'inclusive'
    );
  ELSE
    -- Tax is added to the subtotal
    subtotal := total_amount;
    tax_amount := ROUND(total_amount * tax_rate / 100, 2);
    result := jsonb_build_object(
      'subtotal', subtotal,
      'tax_amount', tax_amount,
      'tax_rate', tax_rate,
      'total', subtotal + tax_amount,
      'is_inclusive', is_inclusive,
      'calculation_method', 'exclusive'
    );
  END IF;

  RETURN result;
END;
$function$;

-- Add comments for documentation
COMMENT ON TABLE public.malaysian_tax_categories IS 'Malaysian tax categories including GST (historical) and SST (current) rates';
COMMENT ON TABLE public.malaysian_business_categories IS 'Mapping of business types to Malaysian tax categories for automatic detection';
COMMENT ON COLUMN public.receipts.detected_tax_type IS 'Automatically detected Malaysian tax type (GST, SST_SALES, SST_SERVICE, etc.)';
COMMENT ON COLUMN public.receipts.detected_tax_rate IS 'Automatically detected tax rate percentage';
COMMENT ON COLUMN public.receipts.tax_breakdown IS 'Detailed tax calculation breakdown in JSON format';
COMMENT ON COLUMN public.receipts.is_tax_inclusive IS 'Whether the total amount includes tax (true) or tax is added separately (false)';
COMMENT ON COLUMN public.receipts.malaysian_business_category IS 'Detected Malaysian business category for tax classification';

-- Create RPC function for frontend to get tax information
CREATE OR REPLACE FUNCTION public.get_malaysian_tax_info(
  merchant_name TEXT,
  receipt_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
AS $function$
DECLARE
  tax_info RECORD;
  result JSONB;
BEGIN
  -- Get tax category information
  SELECT * INTO tax_info
  FROM public.detect_malaysian_tax_category(merchant_name, receipt_date);

  IF tax_info IS NULL THEN
    -- Default to exempt if no match found
    result := jsonb_build_object(
      'tax_type', 'EXEMPT',
      'tax_rate', 0.00,
      'category_name', 'Unknown/Exempt',
      'confidence_score', 0,
      'is_detected', false
    );
  ELSE
    result := jsonb_build_object(
      'tax_type', tax_info.tax_type,
      'tax_rate', tax_info.tax_rate,
      'category_name', tax_info.category_name,
      'confidence_score', tax_info.confidence_score,
      'is_detected', true
    );
  END IF;

  RETURN result;
END;
$function$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.detect_malaysian_tax_category(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_malaysian_tax(DECIMAL, DECIMAL, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_malaysian_tax_info(TEXT, DATE) TO authenticated;
