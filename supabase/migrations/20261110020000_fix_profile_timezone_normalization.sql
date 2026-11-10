-- Normalize new writes and tolerate values stored before timezone validation.
-- Replacing the functions preserves their existing ownership and grants.
CREATE OR REPLACE FUNCTION public.validate_profile_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.timezone_preference := NULLIF(
    pg_catalog.regexp_replace(NEW.timezone_preference, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );

  IF NEW.timezone_preference IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_timezone_names zone
       WHERE zone.name = NEW.timezone_preference
     ) THEN
    RAISE EXCEPTION 'Invalid timezone: %', NEW.timezone_preference;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_local_date(
  p_user_id UUID,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolved_timezone TEXT;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You can only resolve the local date for your own account';
  END IF;

  SELECT COALESCE(
    NULLIF(pg_catalog.regexp_replace(p.timezone_preference, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    'Asia/Kuala_Lumpur'
  )
  INTO resolved_timezone
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- Preserve the existing NULL result for a missing profile or reference time.
  IF NOT FOUND OR p_reference_time IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pg_catalog.timezone(resolved_timezone, p_reference_time)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    -- Legacy profiles can contain names that the write trigger now rejects.
    RETURN pg_catalog.timezone('Asia/Kuala_Lumpur', p_reference_time)::DATE;
  END;
END;
$function$;
