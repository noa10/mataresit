-- Fix scoping bug in handle_new_user(): google_avatar was declared inside a
-- nested DECLARE/BEGIN…END block that closed before the INSERT, so Postgres
-- treated google_avatar in the VALUES clause as a column reference, raising
-- `column "google_avatar" does not exist` and aborting every new-user insert
-- (Google OAuth + email signup) with a 500 at /callback.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  google_avatar TEXT := NULL;
BEGIN
  IF new.raw_user_meta_data IS NOT NULL THEN
    google_avatar := new.raw_user_meta_data->>'avatar_url';
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    google_avatar_url,
    subscription_tier,
    subscription_status,
    receipts_used_this_month,
    monthly_reset_date
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'given_name', ''),
    COALESCE(new.raw_user_meta_data->>'family_name', ''),
    new.email,
    google_avatar,
    'free',
    'active',
    0,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    google_avatar_url = COALESCE(EXCLUDED.google_avatar_url, profiles.google_avatar_url),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    updated_at = NOW();

  RETURN new;
END;
$function$;
