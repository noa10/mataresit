-- Add Malaysian Business Directory and Registration Number Validation
-- This migration expands the Malaysian business recognition system

-- Create Malaysian business directory table
CREATE TABLE IF NOT EXISTS public.malaysian_business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(200) NOT NULL,
  business_name_malay VARCHAR(200),
  business_type VARCHAR(100) NOT NULL,
  registration_number VARCHAR(50),
  registration_type VARCHAR(20), -- 'SSM', 'ROC', 'ROB', 'LLP'
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  postcode VARCHAR(10),
  phone VARCHAR(20),
  website VARCHAR(200),
  industry_category VARCHAR(100),
  is_chain BOOLEAN DEFAULT false,
  parent_company VARCHAR(200),
  keywords TEXT[], -- Search keywords for matching
  confidence_score INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Malaysian address formats table
CREATE TABLE IF NOT EXISTS public.malaysian_address_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_name VARCHAR(50) NOT NULL,
  state_code VARCHAR(10) NOT NULL,
  postcode_pattern VARCHAR(20) NOT NULL, -- Regex pattern for postcode validation
  common_cities TEXT[], -- Array of common cities in this state
  timezone VARCHAR(50) DEFAULT 'Asia/Kuala_Lumpur',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Malaysian business hours table
CREATE TABLE IF NOT EXISTS public.malaysian_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type VARCHAR(100) NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Malaysian business fields to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS malaysian_registration_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS malaysian_business_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS detected_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS address_confidence INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_malaysian_business_directory_name ON public.malaysian_business_directory(business_name);
CREATE INDEX IF NOT EXISTS idx_malaysian_business_directory_type ON public.malaysian_business_directory(business_type);
CREATE INDEX IF NOT EXISTS idx_malaysian_business_directory_keywords ON public.malaysian_business_directory USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_malaysian_business_directory_registration ON public.malaysian_business_directory(registration_number);
CREATE INDEX IF NOT EXISTS idx_malaysian_address_formats_state ON public.malaysian_address_formats(state_name);
CREATE INDEX IF NOT EXISTS idx_malaysian_business_hours_type_day ON public.malaysian_business_hours(business_type, day_of_week);

-- Enable RLS on new tables
ALTER TABLE public.malaysian_business_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_address_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_business_hours ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (read-only for all users)
CREATE POLICY "Business directory is viewable by everyone" ON public.malaysian_business_directory
  FOR SELECT USING (true);

CREATE POLICY "Address formats are viewable by everyone" ON public.malaysian_address_formats
  FOR SELECT USING (true);

CREATE POLICY "Business hours are viewable by everyone" ON public.malaysian_business_hours
  FOR SELECT USING (true);

-- Only admins can manage business directory data
CREATE POLICY "Only admins can manage business directory" ON public.malaysian_business_directory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage address formats" ON public.malaysian_address_formats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage business hours" ON public.malaysian_business_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Insert Malaysian states and address formats
INSERT INTO public.malaysian_address_formats (state_name, state_code, postcode_pattern, common_cities) VALUES
('Kuala Lumpur', 'KL', '^5[0-9]{4}$', ARRAY['Kuala Lumpur', 'KL', 'Cheras', 'Bangsar', 'Mont Kiara', 'KLCC']),
('Selangor', 'SEL', '^4[0-9]{4}$', ARRAY['Shah Alam', 'Petaling Jaya', 'Subang Jaya', 'Klang', 'Kajang', 'Puchong', 'Ampang']),
('Johor', 'JHR', '^8[0-9]{4}$', ARRAY['Johor Bahru', 'Skudai', 'Iskandar Puteri', 'Batu Pahat', 'Muar', 'Kluang']),
('Penang', 'PNG', '^1[0-9]{4}$', ARRAY['George Town', 'Butterworth', 'Bukit Mertajam', 'Bayan Lepas', 'Tanjung Bungah']),
('Perak', 'PRK', '^3[0-9]{4}$', ARRAY['Ipoh', 'Taiping', 'Teluk Intan', 'Kampar', 'Sitiawan', 'Parit Buntar']),
('Kedah', 'KDH', '^0[5-9][0-9]{3}$', ARRAY['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi', 'Baling']),
('Kelantan', 'KTN', '^1[5-8][0-9]{3}$', ARRAY['Kota Bharu', 'Wakaf Che Yeh', 'Tanah Merah', 'Machang', 'Gua Musang']),
('Terengganu', 'TRG', '^2[0-4][0-9]{3}$', ARRAY['Kuala Terengganu', 'Kemaman', 'Dungun', 'Marang', 'Besut']),
('Pahang', 'PHG', '^2[5-9][0-9]{3}$', ARRAY['Kuantan', 'Temerloh', 'Bentong', 'Raub', 'Pekan', 'Jerantut']),
('Negeri Sembilan', 'NSN', '^7[0-9]{4}$', ARRAY['Seremban', 'Port Dickson', 'Nilai', 'Rembau', 'Tampin']),
('Melaka', 'MLK', '^7[5-8][0-9]{3}$', ARRAY['Melaka', 'Alor Gajah', 'Jasin', 'Ayer Keroh', 'Batu Berendam']),
('Sabah', 'SBH', '^8[8-9][0-9]{3}$', ARRAY['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Keningau']),
('Sarawak', 'SRW', '^9[0-8][0-9]{3}$', ARRAY['Kuching', 'Miri', 'Sibu', 'Bintulu', 'Limbang', 'Sarikei']),
('Perlis', 'PLS', '^0[1-2][0-9]{3}$', ARRAY['Kangar', 'Arau', 'Padang Besar']),
('Putrajaya', 'PJY', '^62[0-9]{3}$', ARRAY['Putrajaya']),
('Labuan', 'LBN', '^87[0-9]{3}$', ARRAY['Labuan']);

-- Insert major Malaysian business chains
INSERT INTO public.malaysian_business_directory (business_name, business_name_malay, business_type, industry_category, is_chain, keywords, confidence_score) VALUES
-- Grocery Chains
('99 Speedmart', '99 Speedmart', 'Grocery Stores', 'Retail', true, ARRAY['99 speedmart', '99speedmart', 'speedmart', '99'], 100),
('KK Super Mart', 'KK Super Mart', 'Grocery Stores', 'Retail', true, ARRAY['kk super mart', 'kk supermart', 'kkmart', 'kk mart'], 100),
('Tesco', 'Tesco', 'Grocery Stores', 'Retail', true, ARRAY['tesco', 'tesco extra', 'tesco express'], 100),
('AEON', 'AEON', 'Grocery Stores', 'Retail', true, ARRAY['aeon', 'aeon big', 'aeon maxvalu', 'jusco'], 100),
('Mydin', 'Mydin', 'Grocery Stores', 'Retail', true, ARRAY['mydin', 'mydin mall', 'mydin hypermarket'], 100),
('Giant', 'Giant', 'Grocery Stores', 'Retail', true, ARRAY['giant', 'giant hypermarket', 'giant supermarket'], 100),
('Village Grocer', 'Village Grocer', 'Grocery Stores', 'Retail', true, ARRAY['village grocer', 'vg'], 95),
('Jaya Grocer', 'Jaya Grocer', 'Grocery Stores', 'Retail', true, ARRAY['jaya grocer', 'jg'], 95),
('Cold Storage', 'Cold Storage', 'Grocery Stores', 'Retail', true, ARRAY['cold storage', 'coldstorage'], 95),
('Mercato', 'Mercato', 'Grocery Stores', 'Retail', true, ARRAY['mercato'], 90),

-- Fast Food Chains
('McDonald''s', 'McDonald''s', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['mcdonald''s', 'mcdonalds', 'mcd', 'mc donald'], 100),
('KFC', 'KFC', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['kfc', 'kentucky fried chicken'], 100),
('Pizza Hut', 'Pizza Hut', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['pizza hut', 'pizzahut'], 100),
('Domino''s Pizza', 'Domino''s Pizza', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['domino''s', 'dominos', 'domino pizza'], 100),
('Subway', 'Subway', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['subway'], 100),
('Burger King', 'Burger King', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['burger king', 'bk'], 100),

-- Coffee Chains
('Starbucks', 'Starbucks', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['starbucks', 'sbux'], 100),
('Old Town White Coffee', 'Old Town White Coffee', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['old town white coffee', 'oldtown', 'otwc'], 100),
('Coffee Bean & Tea Leaf', 'Coffee Bean & Tea Leaf', 'Restaurants and Food Services', 'Food & Beverage', true, ARRAY['coffee bean', 'cbtl'], 95),

-- Petrol Stations
('Petronas', 'Petronas', 'Petrol Stations', 'Energy', true, ARRAY['petronas', 'petron'], 100),
('Shell', 'Shell', 'Petrol Stations', 'Energy', true, ARRAY['shell'], 100),
('Esso', 'Esso', 'Petrol Stations', 'Energy', true, ARRAY['esso'], 100),
('Caltex', 'Caltex', 'Petrol Stations', 'Energy', true, ARRAY['caltex'], 100),
('BHP', 'BHP', 'Petrol Stations', 'Energy', true, ARRAY['bhp', 'boustead'], 95),

-- Telecommunications
('Celcom', 'Celcom', 'Telecommunications', 'Telecommunications', true, ARRAY['celcom', 'celcom axiata'], 100),
('Digi', 'Digi', 'Telecommunications', 'Telecommunications', true, ARRAY['digi', 'digi telecommunications'], 100),
('Maxis', 'Maxis', 'Telecommunications', 'Telecommunications', true, ARRAY['maxis', 'hotlink'], 100),
('U Mobile', 'U Mobile', 'Telecommunications', 'Telecommunications', true, ARRAY['u mobile', 'umobile'], 100),
('unifi', 'unifi', 'Telecommunications', 'Telecommunications', true, ARRAY['unifi', 'tm unifi', 'telekom malaysia'], 100),

-- Pharmacies
('Guardian', 'Guardian', 'Pharmacies and Healthcare', 'Healthcare', true, ARRAY['guardian', 'guardian pharmacy'], 100),
('Watsons', 'Watsons', 'Pharmacies and Healthcare', 'Healthcare', true, ARRAY['watsons', 'watson'], 100),
('Caring Pharmacy', 'Caring Pharmacy', 'Pharmacies and Healthcare', 'Healthcare', true, ARRAY['caring', 'caring pharmacy'], 100),
('Big Pharmacy', 'Big Pharmacy', 'Pharmacies and Healthcare', 'Healthcare', true, ARRAY['big pharmacy', 'big'], 95),

-- Electronics
('Harvey Norman', 'Harvey Norman', 'Electronics and Appliances', 'Electronics', true, ARRAY['harvey norman', 'hn'], 100),
('Courts', 'Courts', 'Electronics and Appliances', 'Electronics', true, ARRAY['courts', 'courts mammoth'], 100),
('Senheng', 'Senheng', 'Electronics and Appliances', 'Electronics', true, ARRAY['senheng', 'sen heng'], 100),
('Best Denki', 'Best Denki', 'Electronics and Appliances', 'Electronics', true, ARRAY['best denki', 'bestdenki'], 100),

-- Utilities
('TNB', 'Tenaga Nasional Berhad', 'Utilities', 'Utilities', false, ARRAY['tnb', 'tenaga nasional', 'tenaga nasional berhad'], 100),
('Syabas', 'Syabas', 'Utilities', 'Utilities', false, ARRAY['syabas', 'puncak niaga'], 95),
('Air Selangor', 'Air Selangor', 'Utilities', 'Utilities', false, ARRAY['air selangor', 'pengurusan air selangor'], 95),

-- Banks
('Maybank', 'Malayan Banking Berhad', 'Banking', 'Financial Services', true, ARRAY['maybank', 'malayan banking', 'mae'], 100),
('CIMB Bank', 'CIMB Bank', 'Banking', 'Financial Services', true, ARRAY['cimb', 'cimb bank'], 100),
('Public Bank', 'Public Bank', 'Banking', 'Financial Services', true, ARRAY['public bank', 'pbb'], 100),
('RHB Bank', 'RHB Bank', 'Banking', 'Financial Services', true, ARRAY['rhb', 'rhb bank'], 100),
('Hong Leong Bank', 'Hong Leong Bank', 'Banking', 'Financial Services', true, ARRAY['hong leong', 'hlb'], 100);

-- Insert typical Malaysian business hours
-- Grocery Stores (7 days a week, long hours)
INSERT INTO public.malaysian_business_hours (business_type, day_of_week, open_time, close_time) VALUES
('Grocery Stores', 1, '08:00', '22:00'), -- Monday
('Grocery Stores', 2, '08:00', '22:00'), -- Tuesday
('Grocery Stores', 3, '08:00', '22:00'), -- Wednesday
('Grocery Stores', 4, '08:00', '22:00'), -- Thursday
('Grocery Stores', 5, '08:00', '22:00'), -- Friday
('Grocery Stores', 6, '08:00', '22:00'), -- Saturday
('Grocery Stores', 0, '08:00', '22:00'), -- Sunday

-- Restaurants (7 days a week)
('Restaurants and Food Services', 1, '10:00', '22:00'),
('Restaurants and Food Services', 2, '10:00', '22:00'),
('Restaurants and Food Services', 3, '10:00', '22:00'),
('Restaurants and Food Services', 4, '10:00', '22:00'),
('Restaurants and Food Services', 5, '10:00', '23:00'), -- Friday later
('Restaurants and Food Services', 6, '10:00', '23:00'), -- Saturday later
('Restaurants and Food Services', 0, '10:00', '22:00'),

-- Banks (Monday to Friday, Saturday morning)
('Banking', 1, '09:30', '16:00'),
('Banking', 2, '09:30', '16:00'),
('Banking', 3, '09:30', '16:00'),
('Banking', 4, '09:30', '16:00'),
('Banking', 5, '09:30', '16:00'),
('Banking', 6, '09:30', '12:30'), -- Saturday half day
('Banking', 0, NULL, NULL, true), -- Sunday closed

-- Petrol Stations (24/7)
('Petrol Stations', 1, '00:00', '23:59'),
('Petrol Stations', 2, '00:00', '23:59'),
('Petrol Stations', 3, '00:00', '23:59'),
('Petrol Stations', 4, '00:00', '23:59'),
('Petrol Stations', 5, '00:00', '23:59'),
('Petrol Stations', 6, '00:00', '23:59'),
('Petrol Stations', 0, '00:00', '23:59'),

-- Pharmacies
('Pharmacies and Healthcare', 1, '09:00', '21:00'),
('Pharmacies and Healthcare', 2, '09:00', '21:00'),
('Pharmacies and Healthcare', 3, '09:00', '21:00'),
('Pharmacies and Healthcare', 4, '09:00', '21:00'),
('Pharmacies and Healthcare', 5, '09:00', '21:00'),
('Pharmacies and Healthcare', 6, '09:00', '21:00'),
('Pharmacies and Healthcare', 0, '09:00', '21:00');

-- Create function to validate Malaysian business registration numbers
CREATE OR REPLACE FUNCTION public.validate_malaysian_registration_number(
  registration_number TEXT,
  registration_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  result JSONB;
  is_valid BOOLEAN := false;
  detected_type TEXT := NULL;
BEGIN
  -- Remove spaces and convert to uppercase
  registration_number := UPPER(REPLACE(registration_number, ' ', ''));

  -- SSM Company Registration (e.g., 123456-A, 123456-P, 123456-T)
  IF registration_number ~ '^[0-9]{6}-[APTUVWX]$' THEN
    is_valid := true;
    detected_type := 'SSM';
  -- ROC Registration (e.g., 123456-07)
  ELSIF registration_number ~ '^[0-9]{6}-[0-9]{2}$' THEN
    is_valid := true;
    detected_type := 'ROC';
  -- ROB Registration (e.g., PG0123456-A)
  ELSIF registration_number ~ '^[A-Z]{2}[0-9]{7}-[A-Z]$' THEN
    is_valid := true;
    detected_type := 'ROB';
  -- LLP Registration (e.g., LLP0012345-LGN)
  ELSIF registration_number ~ '^LLP[0-9]{7}-[A-Z]{3}$' THEN
    is_valid := true;
    detected_type := 'LLP';
  END IF;

  result := jsonb_build_object(
    'is_valid', is_valid,
    'detected_type', detected_type,
    'formatted_number', registration_number
  );

  RETURN result;
END;
$function$;

-- Create function to parse Malaysian addresses
CREATE OR REPLACE FUNCTION public.parse_malaysian_address(
  address_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  result JSONB;
  detected_state TEXT := NULL;
  detected_postcode TEXT := NULL;
  confidence_score INTEGER := 0;
  state_record RECORD;
BEGIN
  -- Extract postcode (5 digits)
  SELECT substring(address_text FROM '[0-9]{5}') INTO detected_postcode;

  -- If postcode found, try to match with state
  IF detected_postcode IS NOT NULL THEN
    SELECT state_name, state_code INTO state_record
    FROM public.malaysian_address_formats
    WHERE detected_postcode ~ postcode_pattern
    LIMIT 1;

    IF state_record IS NOT NULL THEN
      detected_state := state_record.state_name;
      confidence_score := 90;
    END IF;
  END IF;

  -- If no postcode match, try to find state name in address
  IF detected_state IS NULL THEN
    SELECT state_name INTO detected_state
    FROM public.malaysian_address_formats
    WHERE LOWER(address_text) LIKE '%' || LOWER(state_name) || '%'
       OR LOWER(address_text) LIKE '%' || LOWER(state_code) || '%'
       OR EXISTS (
         SELECT 1 FROM unnest(common_cities) AS city
         WHERE LOWER(address_text) LIKE '%' || LOWER(city) || '%'
       )
    ORDER BY
      CASE
        WHEN LOWER(address_text) LIKE '%' || LOWER(state_name) || '%' THEN 1
        WHEN LOWER(address_text) LIKE '%' || LOWER(state_code) || '%' THEN 2
        ELSE 3
      END
    LIMIT 1;

    IF detected_state IS NOT NULL THEN
      confidence_score := 70;
    END IF;
  END IF;

  result := jsonb_build_object(
    'detected_state', detected_state,
    'detected_postcode', detected_postcode,
    'confidence_score', confidence_score
  );

  RETURN result;
END;
$function$;

-- Create enhanced business search function
CREATE OR REPLACE FUNCTION public.search_malaysian_business(
  search_term TEXT,
  limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  business_name VARCHAR(200),
  business_type VARCHAR(100),
  industry_category VARCHAR(100),
  confidence_score INTEGER,
  is_chain BOOLEAN,
  registration_number VARCHAR(50)
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mbd.business_name,
    mbd.business_type,
    mbd.industry_category,
    mbd.confidence_score,
    mbd.is_chain,
    mbd.registration_number
  FROM public.malaysian_business_directory mbd
  WHERE
    mbd.is_active = true
    AND (
      LOWER(mbd.business_name) LIKE '%' || LOWER(search_term) || '%'
      OR LOWER(mbd.business_name_malay) LIKE '%' || LOWER(search_term) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(mbd.keywords) AS keyword
        WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
      )
    )
  ORDER BY
    -- Exact matches first
    CASE WHEN LOWER(mbd.business_name) = LOWER(search_term) THEN 1 ELSE 2 END,
    -- Then by confidence score
    mbd.confidence_score DESC,
    -- Then by chain status (chains are more recognizable)
    CASE WHEN mbd.is_chain THEN 1 ELSE 2 END,
    -- Finally by name length (shorter names are often more common)
    LENGTH(mbd.business_name)
  LIMIT limit_results;
END;
$function$;

-- Create function to get business hours for a business type
CREATE OR REPLACE FUNCTION public.get_malaysian_business_hours(
  business_type_param VARCHAR(100),
  day_of_week_param INTEGER DEFAULT NULL
)
RETURNS TABLE (
  day_of_week INTEGER,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN,
  notes TEXT
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    mbh.day_of_week,
    mbh.open_time,
    mbh.close_time,
    mbh.is_closed,
    mbh.notes
  FROM public.malaysian_business_hours mbh
  WHERE
    mbh.business_type = business_type_param
    AND (day_of_week_param IS NULL OR mbh.day_of_week = day_of_week_param)
  ORDER BY mbh.day_of_week;
END;
$function$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.validate_malaysian_registration_number(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_malaysian_address(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_malaysian_business(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_malaysian_business_hours(VARCHAR, INTEGER) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.malaysian_business_directory IS 'Comprehensive directory of Malaysian businesses for enhanced recognition';
COMMENT ON TABLE public.malaysian_address_formats IS 'Malaysian state and postcode patterns for address validation';
COMMENT ON TABLE public.malaysian_business_hours IS 'Typical business hours for different types of Malaysian businesses';
COMMENT ON FUNCTION public.validate_malaysian_registration_number(TEXT, TEXT) IS 'Validates Malaysian business registration numbers (SSM, ROC, ROB, LLP)';
COMMENT ON FUNCTION public.parse_malaysian_address(TEXT) IS 'Parses Malaysian addresses to extract state and postcode information';
COMMENT ON FUNCTION public.search_malaysian_business(TEXT, INTEGER) IS 'Searches Malaysian business directory with fuzzy matching';
COMMENT ON FUNCTION public.get_malaysian_business_hours(VARCHAR, INTEGER) IS 'Gets typical business hours for Malaysian business types';

-- Insert Malaysian states and address formats
INSERT INTO public.malaysian_address_formats (state_name, state_code, postcode_pattern, common_cities) VALUES
('Kuala Lumpur', 'KL', '^5[0-9]{4}$', ARRAY['Kuala Lumpur', 'KL', 'Cheras', 'Bangsar', 'Mont Kiara', 'KLCC']),
('Selangor', 'SEL', '^4[0-9]{4}$', ARRAY['Shah Alam', 'Petaling Jaya', 'Subang Jaya', 'Klang', 'Kajang', 'Puchong', 'Ampang']),
('Johor', 'JHR', '^8[0-9]{4}$', ARRAY['Johor Bahru', 'Skudai', 'Iskandar Puteri', 'Batu Pahat', 'Muar', 'Kluang']),
('Penang', 'PNG', '^1[0-9]{4}$', ARRAY['George Town', 'Butterworth', 'Bukit Mertajam', 'Bayan Lepas', 'Tanjung Bungah']),
('Perak', 'PRK', '^3[0-9]{4}$', ARRAY['Ipoh', 'Taiping', 'Teluk Intan', 'Kampar', 'Sitiawan', 'Parit Buntar']),
('Kedah', 'KDH', '^0[5-9][0-9]{3}$', ARRAY['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi', 'Baling']),
('Kelantan', 'KTN', '^1[5-8][0-9]{3}$', ARRAY['Kota Bharu', 'Wakaf Che Yeh', 'Tanah Merah', 'Machang', 'Gua Musang']),
('Terengganu', 'TRG', '^2[0-4][0-9]{3}$', ARRAY['Kuala Terengganu', 'Kemaman', 'Dungun', 'Marang', 'Besut']),
('Pahang', 'PHG', '^2[5-9][0-9]{3}$', ARRAY['Kuantan', 'Temerloh', 'Bentong', 'Raub', 'Pekan', 'Jerantut']),
('Negeri Sembilan', 'NSN', '^7[0-9]{4}$', ARRAY['Seremban', 'Port Dickson', 'Nilai', 'Rembau', 'Tampin']),
('Melaka', 'MLK', '^7[5-8][0-9]{3}$', ARRAY['Melaka', 'Alor Gajah', 'Jasin', 'Ayer Keroh', 'Batu Berendam']),
('Sabah', 'SBH', '^8[8-9][0-9]{3}$', ARRAY['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Keningau']),
('Sarawak', 'SRW', '^9[0-8][0-9]{3}$', ARRAY['Kuching', 'Miri', 'Sibu', 'Bintulu', 'Limbang', 'Sarikei']),
('Perlis', 'PLS', '^0[1-2][0-9]{3}$', ARRAY['Kangar', 'Arau', 'Padang Besar']),
('Putrajaya', 'PJY', '^62[0-9]{3}$', ARRAY['Putrajaya']),
('Labuan', 'LBN', '^87[0-9]{3}$', ARRAY['Labuan']);
