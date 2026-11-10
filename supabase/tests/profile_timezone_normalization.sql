-- Run only on a disposable local database with all migrations applied, as the
-- database owner; psql -v ON_ERROR_STOP=1 -f this file. No state is retained.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email)
VALUES ('a1000000-0000-4000-8000-000000000001', 'timezone-test@example.invalid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, timezone_preference)
VALUES ('a1000000-0000-4000-8000-000000000001', 'Asia/Kuala_Lumpur')
ON CONFLICT (id) DO UPDATE SET timezone_preference = EXCLUDED.timezone_preference;

DO $$
DECLARE
  v_timezone TEXT;
  v_date DATE;
  v_message TEXT;
  v_user CONSTANT UUID := 'a1000000-0000-4000-8000-000000000001';
  v_reference CONSTANT TIMESTAMPTZ := '2026-01-01 18:00:00+00';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::TEXT, true);

  UPDATE public.profiles SET timezone_preference = E' \tAmerica/Los_Angeles\n ' WHERE id = v_user;
  SELECT timezone_preference INTO v_timezone FROM public.profiles WHERE id = v_user;
  IF v_timezone IS DISTINCT FROM 'America/Los_Angeles' THEN
    RAISE EXCEPTION 'padded timezone was not normalized: %', v_timezone;
  END IF;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-01' THEN
    RAISE EXCEPTION 'normalized timezone produced the wrong local date';
  END IF;

  UPDATE public.profiles SET timezone_preference = E' \t\n ' WHERE id = v_user;
  SELECT timezone_preference INTO v_timezone FROM public.profiles WHERE id = v_user;
  IF v_timezone IS NOT NULL THEN
    RAISE EXCEPTION 'blank timezone must be stored as NULL: %', v_timezone;
  END IF;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'blank timezone must use the Kuala Lumpur default';
  END IF;

  UPDATE public.profiles SET timezone_preference = NULL WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'NULL timezone must use the Kuala Lumpur default';
  END IF;
  IF public.get_user_local_date(v_user, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'NULL reference time must return NULL';
  END IF;

  BEGIN
    UPDATE public.profiles SET timezone_preference = ' Not/AZone ' WHERE id = v_user;
    RAISE EXCEPTION 'invalid timezone was accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE 'Invalid timezone:%' THEN
      RAISE EXCEPTION 'unexpected invalid-write error: %', v_message;
    END IF;
  END;

  -- Simulate historical rows that predate the write trigger.
  ALTER TABLE public.profiles DISABLE TRIGGER validate_profile_timezone;
  UPDATE public.profiles SET timezone_preference = E' \tAmerica/Los_Angeles\n' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-01' THEN
    RAISE EXCEPTION 'legacy padded valid timezone must be trimmed';
  END IF;
  UPDATE public.profiles SET timezone_preference = E' \t\n' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'legacy blank timezone must use the default';
  END IF;
  UPDATE public.profiles SET timezone_preference = ' Not/AZone ' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'legacy malformed timezone must use the default';
  END IF;
  ALTER TABLE public.profiles ENABLE TRIGGER validate_profile_timezone;

  IF NOT has_function_privilege('authenticated', 'public.get_user_local_date(uuid,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_user_local_date(uuid,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'existing local-date grants must remain available';
  END IF;

  PERFORM set_config('role', 'authenticated', true);
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'authenticated caller cannot resolve their own date';
  END IF;
  BEGIN
    v_date := public.get_user_local_date('a1000000-0000-4000-8000-000000000002', v_reference);
    RAISE EXCEPTION 'cross-account lookup was accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message IS DISTINCT FROM 'You can only resolve the local date for your own account' THEN
      RAISE EXCEPTION 'unexpected cross-account error: %', v_message;
    END IF;
  END;
  PERFORM set_config('role', 'none', true);

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  IF public.get_user_local_date('a1000000-0000-4000-8000-000000000002', v_reference) IS NOT NULL THEN
    RAISE EXCEPTION 'missing profile must preserve the existing NULL result';
  END IF;
END $$;

ROLLBACK;
