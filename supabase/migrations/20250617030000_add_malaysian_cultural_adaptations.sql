-- Add Malaysian Cultural Adaptations
-- This migration adds Malaysian date/time formats, public holidays, and cultural preferences

-- Create Malaysian public holidays table
CREATE TABLE IF NOT EXISTS public.malaysian_public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_name VARCHAR(100) NOT NULL,
  holiday_name_malay VARCHAR(100),
  holiday_date DATE NOT NULL,
  holiday_type VARCHAR(50) NOT NULL, -- 'federal', 'state', 'religious', 'cultural'
  applicable_states TEXT[], -- Array of state codes, NULL means federal (all states)
  is_recurring BOOLEAN DEFAULT false, -- True for holidays that repeat annually
  recurring_pattern VARCHAR(100), -- Pattern for recurring holidays (e.g., 'lunar_calendar')
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Malaysian cultural preferences table
CREATE TABLE IF NOT EXISTS public.malaysian_cultural_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_name VARCHAR(100) NOT NULL UNIQUE,
  preference_category VARCHAR(50) NOT NULL, -- 'date_format', 'time_format', 'number_format', 'language'
  default_value TEXT NOT NULL,
  possible_values TEXT[], -- Array of possible values
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add cultural preference fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_format_preference VARCHAR(20) DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS time_format_preference VARCHAR(10) DEFAULT '24h',
ADD COLUMN IF NOT EXISTS number_format_preference VARCHAR(20) DEFAULT 'MY',
ADD COLUMN IF NOT EXISTS timezone_preference VARCHAR(50) DEFAULT 'Asia/Kuala_Lumpur',
ADD COLUMN IF NOT EXISTS cultural_context VARCHAR(20) DEFAULT 'MY';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_malaysian_public_holidays_date ON public.malaysian_public_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_malaysian_public_holidays_type ON public.malaysian_public_holidays(holiday_type);
CREATE INDEX IF NOT EXISTS idx_malaysian_public_holidays_states ON public.malaysian_public_holidays USING GIN(applicable_states);
CREATE INDEX IF NOT EXISTS idx_malaysian_cultural_preferences_category ON public.malaysian_cultural_preferences(preference_category);
CREATE INDEX IF NOT EXISTS idx_profiles_cultural_context ON public.profiles(cultural_context);

-- Enable RLS on new tables
ALTER TABLE public.malaysian_public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malaysian_cultural_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (read-only for all users)
CREATE POLICY "Public holidays are viewable by everyone" ON public.malaysian_public_holidays
  FOR SELECT USING (true);

CREATE POLICY "Cultural preferences are viewable by everyone" ON public.malaysian_cultural_preferences
  FOR SELECT USING (true);

-- Only admins can manage cultural data
CREATE POLICY "Only admins can manage public holidays" ON public.malaysian_public_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage cultural preferences" ON public.malaysian_cultural_preferences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Insert Malaysian cultural preferences
INSERT INTO public.malaysian_cultural_preferences (preference_name, preference_category, default_value, possible_values, description) VALUES
-- Date Format Preferences
('date_format', 'date_format', 'DD/MM/YYYY', ARRAY['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'], 'Preferred date display format'),
('date_separator', 'date_format', '/', ARRAY['/', '-', '.'], 'Separator character for dates'),

-- Time Format Preferences
('time_format', 'time_format', '24h', ARRAY['12h', '24h'], 'Preferred time display format (12-hour or 24-hour)'),
('time_separator', 'time_format', ':', ARRAY[':', '.'], 'Separator character for time'),

-- Number Format Preferences
('number_format', 'number_format', 'MY', ARRAY['MY', 'US', 'EU'], 'Number formatting style (MY: 1,234.56, US: 1,234.56, EU: 1.234,56)'),
('thousands_separator', 'number_format', ',', ARRAY[',', '.', ' ', ''''], 'Thousands separator character'),
('decimal_separator', 'number_format', '.', ARRAY['.', ','], 'Decimal separator character'),

-- Language Preferences
('primary_language', 'language', 'en', ARRAY['en', 'ms', 'zh', 'ta'], 'Primary language preference'),
('secondary_language', 'language', 'ms', ARRAY['en', 'ms', 'zh', 'ta'], 'Secondary language for fallback'),

-- Cultural Context
('cultural_context', 'cultural', 'MY', ARRAY['MY', 'SG', 'ID', 'TH', 'GLOBAL'], 'Cultural context for localization'),
('business_culture', 'cultural', 'multicultural', ARRAY['multicultural', 'malay', 'chinese', 'indian', 'western'], 'Business culture preference');

-- Insert Malaysian public holidays (2024-2025 examples)
INSERT INTO public.malaysian_public_holidays (holiday_name, holiday_name_malay, holiday_date, holiday_type, applicable_states, is_recurring, description) VALUES
-- Federal Holidays (applicable to all states)
('New Year''s Day', 'Hari Tahun Baru', '2024-01-01', 'federal', NULL, true, 'New Year celebration'),
('Chinese New Year', 'Tahun Baru Cina', '2024-02-10', 'federal', NULL, true, 'Chinese New Year Day 1'),
('Chinese New Year (Day 2)', 'Tahun Baru Cina (Hari 2)', '2024-02-11', 'federal', NULL, true, 'Chinese New Year Day 2'),
('Federal Territory Day', 'Hari Wilayah Persekutuan', '2024-02-01', 'federal', ARRAY['KL', 'PJY', 'LBN'], true, 'Federal Territory Day'),
('Labour Day', 'Hari Pekerja', '2024-05-01', 'federal', NULL, true, 'International Workers Day'),
('Wesak Day', 'Hari Wesak', '2024-05-22', 'federal', NULL, true, 'Buddha''s Birthday'),
('Hari Raya Aidilfitri', 'Hari Raya Aidilfitri', '2024-04-10', 'federal', NULL, true, 'End of Ramadan Day 1'),
('Hari Raya Aidilfitri (Day 2)', 'Hari Raya Aidilfitri (Hari 2)', '2024-04-11', 'federal', NULL, true, 'End of Ramadan Day 2'),
('Hari Raya Haji', 'Hari Raya Haji', '2024-06-17', 'federal', NULL, true, 'Festival of Sacrifice'),
('Merdeka Day', 'Hari Kemerdekaan', '2024-08-31', 'federal', NULL, true, 'Independence Day'),
('Malaysia Day', 'Hari Malaysia', '2024-09-16', 'federal', NULL, true, 'Formation of Malaysia'),
('Deepavali', 'Deepavali', '2024-10-31', 'federal', NULL, true, 'Festival of Lights'),
('Christmas Day', 'Hari Krismas', '2024-12-25', 'federal', NULL, true, 'Christmas celebration'),

-- State-specific holidays (examples)
('Birthday of Sultan of Selangor', 'Hari Keputeraan Sultan Selangor', '2024-12-11', 'state', ARRAY['SEL'], true, 'Sultan of Selangor Birthday'),
('Birthday of Yang di-Pertuan Agong', 'Hari Keputeraan Yang di-Pertuan Agong', '2024-06-03', 'federal', NULL, true, 'King''s Birthday'),
('Nuzul Al-Quran', 'Nuzul Al-Quran', '2024-03-28', 'federal', NULL, true, 'Revelation of Quran'),
('Awal Muharram', 'Awal Muharram', '2024-07-07', 'federal', NULL, true, 'Islamic New Year'),
('Maulidur Rasul', 'Maulidur Rasul', '2024-09-15', 'federal', NULL, true, 'Prophet Muhammad''s Birthday'),

-- 2025 holidays
('New Year''s Day', 'Hari Tahun Baru', '2025-01-01', 'federal', NULL, true, 'New Year celebration'),
('Chinese New Year', 'Tahun Baru Cina', '2025-01-29', 'federal', NULL, true, 'Chinese New Year Day 1'),
('Chinese New Year (Day 2)', 'Tahun Baru Cina (Hari 2)', '2025-01-30', 'federal', NULL, true, 'Chinese New Year Day 2'),
('Federal Territory Day', 'Hari Wilayah Persekutuan', '2025-02-01', 'federal', ARRAY['KL', 'PJY', 'LBN'], true, 'Federal Territory Day'),
('Labour Day', 'Hari Pekerja', '2025-05-01', 'federal', NULL, true, 'International Workers Day'),
('Merdeka Day', 'Hari Kemerdekaan', '2025-08-31', 'federal', NULL, true, 'Independence Day'),
('Malaysia Day', 'Hari Malaysia', '2025-09-16', 'federal', NULL, true, 'Formation of Malaysia'),
('Christmas Day', 'Hari Krismas', '2025-12-25', 'federal', NULL, true, 'Christmas celebration');

-- Create function to format dates according to Malaysian preferences
CREATE OR REPLACE FUNCTION public.format_malaysian_date(
  input_date DATE,
  format_preference VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  separator_preference VARCHAR(1) DEFAULT '/'
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  formatted_date TEXT;
BEGIN
  CASE format_preference
    WHEN 'DD/MM/YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'DD') || separator_preference ||
                       TO_CHAR(input_date, 'MM') || separator_preference ||
                       TO_CHAR(input_date, 'YYYY');
    WHEN 'MM/DD/YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'MM') || separator_preference ||
                       TO_CHAR(input_date, 'DD') || separator_preference ||
                       TO_CHAR(input_date, 'YYYY');
    WHEN 'YYYY-MM-DD' THEN
      formatted_date := TO_CHAR(input_date, 'YYYY-MM-DD');
    WHEN 'DD-MM-YYYY' THEN
      formatted_date := TO_CHAR(input_date, 'DD-MM-YYYY');
    ELSE
      -- Default to DD/MM/YYYY
      formatted_date := TO_CHAR(input_date, 'DD/MM/YYYY');
  END CASE;

  RETURN formatted_date;
END;
$function$;

-- Create function to format time according to Malaysian preferences
CREATE OR REPLACE FUNCTION public.format_malaysian_time(
  input_time TIME,
  format_preference VARCHAR(10) DEFAULT '24h',
  separator_preference VARCHAR(1) DEFAULT ':'
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  formatted_time TEXT;
BEGIN
  CASE format_preference
    WHEN '12h' THEN
      formatted_time := TO_CHAR(input_time, 'HH12') || separator_preference ||
                       TO_CHAR(input_time, 'MI') || ' ' ||
                       TO_CHAR(input_time, 'AM');
    WHEN '24h' THEN
      formatted_time := TO_CHAR(input_time, 'HH24') || separator_preference ||
                       TO_CHAR(input_time, 'MI');
    ELSE
      -- Default to 24h
      formatted_time := TO_CHAR(input_time, 'HH24:MI');
  END CASE;

  RETURN formatted_time;
END;
$function$;

-- Create function to format numbers according to Malaysian preferences
CREATE OR REPLACE FUNCTION public.format_malaysian_number(
  input_number DECIMAL(15,2),
  format_style VARCHAR(20) DEFAULT 'MY',
  thousands_sep VARCHAR(1) DEFAULT ',',
  decimal_sep VARCHAR(1) DEFAULT '.'
)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  formatted_number TEXT;
  integer_part TEXT;
  decimal_part TEXT;
BEGIN
  -- Split number into integer and decimal parts
  integer_part := FLOOR(input_number)::TEXT;
  decimal_part := LPAD(((input_number - FLOOR(input_number)) * 100)::INTEGER::TEXT, 2, '0');

  CASE format_style
    WHEN 'MY' THEN
      -- Malaysian style: 1,234.56
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1' || thousands_sep, 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || decimal_sep || decimal_part;
      END IF;
    WHEN 'EU' THEN
      -- European style: 1.234,56
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1.', 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || ',' || decimal_part;
      END IF;
    ELSE
      -- Default Malaysian style
      formatted_number := REGEXP_REPLACE(integer_part, '(\d)(?=(\d{3})+(?!\d))', '\1,', 'g');
      IF decimal_part != '00' THEN
        formatted_number := formatted_number || '.' || decimal_part;
      END IF;
  END CASE;

  RETURN formatted_number;
END;
$function$;

-- Create function to check if a date is a Malaysian public holiday
CREATE OR REPLACE FUNCTION public.is_malaysian_public_holiday(
  check_date DATE,
  state_code VARCHAR(10) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  holiday_record RECORD;
  result JSONB;
BEGIN
  -- Check for holidays on the given date
  SELECT holiday_name, holiday_name_malay, holiday_type, applicable_states
  INTO holiday_record
  FROM public.malaysian_public_holidays
  WHERE
    holiday_date = check_date
    AND is_active = true
    AND (
      applicable_states IS NULL  -- Federal holiday (applies to all states)
      OR state_code IS NULL      -- No state specified, check all holidays
      OR state_code = ANY(applicable_states)  -- State-specific holiday
    )
  ORDER BY
    CASE WHEN applicable_states IS NULL THEN 1 ELSE 2 END  -- Federal holidays first
  LIMIT 1;

  IF holiday_record IS NOT NULL THEN
    result := jsonb_build_object(
      'is_holiday', true,
      'holiday_name', holiday_record.holiday_name,
      'holiday_name_malay', holiday_record.holiday_name_malay,
      'holiday_type', holiday_record.holiday_type,
      'applicable_states', holiday_record.applicable_states
    );
  ELSE
    result := jsonb_build_object(
      'is_holiday', false,
      'holiday_name', NULL,
      'holiday_name_malay', NULL,
      'holiday_type', NULL,
      'applicable_states', NULL
    );
  END IF;

  RETURN result;
END;
$function$;

-- Create function to get user's cultural preferences
CREATE OR REPLACE FUNCTION public.get_user_cultural_preferences(
  user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_prefs RECORD;
  result JSONB;
BEGIN
  -- Get user preferences from profiles
  SELECT
    date_format_preference,
    time_format_preference,
    number_format_preference,
    timezone_preference,
    cultural_context,
    preferred_language
  INTO user_prefs
  FROM public.profiles
  WHERE id = user_id;

  IF user_prefs IS NOT NULL THEN
    result := jsonb_build_object(
      'date_format', COALESCE(user_prefs.date_format_preference, 'DD/MM/YYYY'),
      'time_format', COALESCE(user_prefs.time_format_preference, '24h'),
      'number_format', COALESCE(user_prefs.number_format_preference, 'MY'),
      'timezone', COALESCE(user_prefs.timezone_preference, 'Asia/Kuala_Lumpur'),
      'cultural_context', COALESCE(user_prefs.cultural_context, 'MY'),
      'language', COALESCE(user_prefs.preferred_language, 'en')
    );
  ELSE
    -- Default Malaysian preferences
    result := jsonb_build_object(
      'date_format', 'DD/MM/YYYY',
      'time_format', '24h',
      'number_format', 'MY',
      'timezone', 'Asia/Kuala_Lumpur',
      'cultural_context', 'MY',
      'language', 'en'
    );
  END IF;

  RETURN result;
END;
$function$;

-- Create function to get business days (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION public.get_malaysian_business_days(
  start_date DATE,
  end_date DATE,
  state_code VARCHAR(10) DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
  business_days INTEGER := 0;
  current_date DATE := start_date;
  day_of_week INTEGER;
  holiday_check JSONB;
BEGIN
  WHILE current_date <= end_date LOOP
    -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    day_of_week := EXTRACT(DOW FROM current_date);

    -- Check if it's a weekday (Monday to Friday)
    IF day_of_week BETWEEN 1 AND 5 THEN
      -- Check if it's not a public holiday
      holiday_check := public.is_malaysian_public_holiday(current_date, state_code);

      IF NOT (holiday_check->>'is_holiday')::BOOLEAN THEN
        business_days := business_days + 1;
      END IF;
    END IF;

    current_date := current_date + INTERVAL '1 day';
  END LOOP;

  RETURN business_days;
END;
$function$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.format_malaysian_date(DATE, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_malaysian_time(TIME, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_malaysian_number(DECIMAL, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_malaysian_public_holiday(DATE, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_cultural_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_malaysian_business_days(DATE, DATE, VARCHAR) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.malaysian_public_holidays IS 'Malaysian federal and state public holidays with recurring patterns';
COMMENT ON TABLE public.malaysian_cultural_preferences IS 'Cultural preferences for Malaysian users (date/time/number formats)';
COMMENT ON COLUMN public.profiles.date_format_preference IS 'User preferred date format (DD/MM/YYYY, MM/DD/YYYY, etc.)';
COMMENT ON COLUMN public.profiles.time_format_preference IS 'User preferred time format (12h or 24h)';
COMMENT ON COLUMN public.profiles.number_format_preference IS 'User preferred number format (MY, US, EU)';
COMMENT ON COLUMN public.profiles.timezone_preference IS 'User preferred timezone (default: Asia/Kuala_Lumpur)';
COMMENT ON COLUMN public.profiles.cultural_context IS 'User cultural context for localization (MY, SG, etc.)';

COMMENT ON FUNCTION public.format_malaysian_date(DATE, VARCHAR, VARCHAR) IS 'Formats dates according to Malaysian cultural preferences';
COMMENT ON FUNCTION public.format_malaysian_time(TIME, VARCHAR, VARCHAR) IS 'Formats time according to Malaysian cultural preferences';
COMMENT ON FUNCTION public.format_malaysian_number(DECIMAL, VARCHAR, VARCHAR, VARCHAR) IS 'Formats numbers according to Malaysian cultural preferences';
COMMENT ON FUNCTION public.is_malaysian_public_holiday(DATE, VARCHAR) IS 'Checks if a date is a Malaysian public holiday';
COMMENT ON FUNCTION public.get_user_cultural_preferences(UUID) IS 'Gets user cultural preferences with Malaysian defaults';
COMMENT ON FUNCTION public.get_malaysian_business_days(DATE, DATE, VARCHAR) IS 'Calculates business days excluding weekends and Malaysian holidays';
