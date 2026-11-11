-- Run only on a disposable local database with all migrations applied, as the
-- database owner; psql -v ON_ERROR_STOP=1 -f this file. No state is retained.
\set ON_ERROR_STOP on
BEGIN;

-- The bare PostgreSQL CI fixture only creates columns needed by the migrations.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.receipts DISABLE TRIGGER USER;

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
  v_probe TIMESTAMPTZ;
  v_expected NUMERIC;
  v_actual NUMERIC;
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

  -- Pick a boundary where Los Angeles and Kuala Lumpur disagree about whether
  -- a receipt is in the current month, regardless of when this suite runs.
  SELECT candidate INTO v_probe
  FROM (
    SELECT (date_trunc('month', timezone('America/Los_Angeles', now()))
      + month_offset * interval '1 month' + hour_offset * interval '1 hour')
      AT TIME ZONE 'America/Los_Angeles' AS candidate
    FROM generate_series(0, 1) AS month_offset
    CROSS JOIN generate_series(-1, 1, 2) AS hour_offset
  ) boundaries
  WHERE (date_trunc('month', timezone('America/Los_Angeles', candidate)) =
         date_trunc('month', timezone('America/Los_Angeles', now())))
    IS DISTINCT FROM
        (date_trunc('month', timezone('Asia/Kuala_Lumpur', candidate)) =
         date_trunc('month', timezone('Asia/Kuala_Lumpur', now())))
  LIMIT 1;
  IF v_probe IS NULL THEN
    RAISE EXCEPTION 'could not construct a timezone month-boundary fixture';
  END IF;

  INSERT INTO public.user_gamification_stats (user_id, leaderboard_opt_in)
  VALUES (v_user, true)
  ON CONFLICT (user_id) DO UPDATE SET leaderboard_opt_in = true;
  INSERT INTO public.receipts (user_id, merchant, date, total, processing_status, created_at)
  VALUES (v_user, 'Timezone fixture', CURRENT_DATE, 1, 'complete', v_probe);
  v_expected := CASE WHEN date_trunc('month', public.get_user_local_date(v_user, v_probe)::timestamp) =
    date_trunc('month', public.get_user_local_date(v_user, now())::timestamp) THEN 1 ELSE 0 END;
  SELECT metric_value INTO v_actual
  FROM public.get_gamification_leaderboard('monthly_receipts', NULL, 100)
  WHERE is_current_user;
  IF NOT FOUND OR v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'legacy padded timezone: local date expects % monthly receipts, leaderboard returned %', v_expected, v_actual;
  END IF;

  UPDATE public.profiles SET timezone_preference = E' \t\n' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'legacy blank timezone must use the default';
  END IF;
  UPDATE public.profiles SET timezone_preference = ' Not/AZone ' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'legacy malformed timezone must use the default';
  END IF;
  UPDATE public.profiles SET timezone_preference = '+05:30' WHERE id = v_user;
  IF public.get_user_local_date(v_user, v_reference) IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'legacy non-catalog timezone must use the leaderboard default';
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
  INSERT INTO auth.users (id, email)
  VALUES ('a1000000-0000-4000-8000-000000000002', 'timezone-missing-profile@example.invalid')
  ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.profiles WHERE id = 'a1000000-0000-4000-8000-000000000002';

  PERFORM set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  PERFORM public.record_daily_login();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_gamification_stats
    WHERE user_id = 'a1000000-0000-4000-8000-000000000002'
      AND last_login_date = timezone('Asia/Kuala_Lumpur', now())::DATE
      AND login_streak_days = 1
  ) THEN
    RAISE EXCEPTION 'missing profile must still record the local login day and streak';
  END IF;
  IF public.get_user_local_date('a1000000-0000-4000-8000-000000000002', v_reference)
     IS DISTINCT FROM DATE '2026-01-02' THEN
    RAISE EXCEPTION 'missing profile must use the Kuala Lumpur default';
  END IF;
  IF public.get_user_local_date('a1000000-0000-4000-8000-000000000002', NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'NULL reference time must remain NULL for a missing profile';
  END IF;
  PERFORM public.record_daily_login();
  IF (SELECT login_streak_days FROM public.user_gamification_stats
      WHERE user_id = 'a1000000-0000-4000-8000-000000000002') IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'repeated login on the same local day must not increase the streak';
  END IF;
  UPDATE public.user_gamification_stats
  SET last_login_date = timezone('Asia/Kuala_Lumpur', now())::DATE - 1,
      login_streak_days = 2
  WHERE user_id = 'a1000000-0000-4000-8000-000000000002';
  PERFORM public.record_daily_login();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_gamification_stats
    WHERE user_id = 'a1000000-0000-4000-8000-000000000002'
      AND last_login_date = timezone('Asia/Kuala_Lumpur', now())::DATE
      AND login_streak_days = 3
  ) THEN
    RAISE EXCEPTION 'login after yesterday must extend the streak for a missing profile';
  END IF;
END $$;

ROLLBACK;
