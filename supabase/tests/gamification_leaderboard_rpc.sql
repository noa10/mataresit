-- Regression test: the gamification leaderboard RPC must return ranked rows for
-- every supported metric.
--
-- Background: 20260310110000_add_gamification_leaderboard_rpc.sql declared
-- RETURNS TABLE(... metric_value ...) and then referenced `metric_value`
-- unqualified inside the gap-to-top-ten subquery. RETURNS TABLE columns are
-- PL/pgSQL variables, so every call raised
--
--   ERROR: 42702: column reference "metric_value" is ambiguous
--
-- CREATE OR REPLACE FUNCTION does not compile a PL/pgSQL body until first
-- execution, so the migration applied cleanly and the failure only appeared at
-- runtime. This test calls the real function and fails if the ambiguity (or the
-- NULL-metric / PUBLIC-grant regressions) comes back.
--
-- How to run (needs a scratch PostgreSQL, never production):
--
--   supabase db push                     # or apply migrations however you prefer
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/gamification_leaderboard_rpc.sql
--
-- Run it as the database owner (postgres/supabase_admin). It disables user
-- triggers on public.receipts for the duration of the transaction so the
-- production reward trigger cannot mutate the XP fixtures, and it switches to
-- the authenticated role so the EXECUTE grant is exercised for real.
--
-- Everything happens inside one transaction that ends in ROLLBACK, so it leaves
-- no lasting state and is safe to re-run. It exits non-zero on the first failed
-- assertion.
--
-- Deliberately does NOT use pgTAP: plain DO blocks with RAISE EXCEPTION match
-- the other suites in this directory. CI mirrors Supabase's default function
-- grants for anon, so the anon assertion fails if the migration only revokes
-- PUBLIC and leaves the direct anon grant behind.

\set ON_ERROR_STOP on

BEGIN;

-- Scratch-database conveniences. CI creates these roles before applying the
-- migrations; the guards make a local bare-Postgres run work too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE SCHEMA IF NOT EXISTS auth;

-- Mirrors Supabase's auth.uid(), including its nullif guard.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);

-- The leaderboard migration only needs these projections. In a real Supabase
-- database the tables already exist; the IF NOT EXISTS / ADD COLUMN guards keep
-- this suite usable on a bare scratch database.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  first_name text,
  last_name text,
  email text,
  timezone_preference text
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone_preference text;

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant text,
  date date,
  total numeric(10,2),
  processing_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS merchant text;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS total numeric(10,2);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS processing_status text;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- The production schema awards receipt-scan XP and updates deductible totals
-- from receipt rows. This suite sets those values explicitly, so disable user
-- triggers for the transaction (ROLLBACK restores them).
ALTER TABLE public.receipts DISABLE TRIGGER USER;

-- The gamification foundation migration creates updated_at triggers that call
-- this function. Supabase has it; a bare scratch database may not.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- 14 users: 1-12 are MY, 13-14 are SG. weekly_xp and deductible_total fall by
-- 10 per user, so global rank == user number and the rank-10 threshold is 900.
-- Even users display their name; odd users are anonymous.
INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'user' || g || '@example.com'
FROM generate_series(1, 14) g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, email, timezone_preference)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'User', g::text, 'user' || g || '@example.com', 'Asia/Kuala_Lumpur'
FROM generate_series(1, 14) g
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  timezone_preference = EXCLUDED.timezone_preference;

-- The auth.users trigger already inserted a default stats row per user.
INSERT INTO public.user_gamification_stats (
  user_id, total_xp, deductible_total_amount, leaderboard_opt_in,
  leaderboard_display_mode, country_code
)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       1000 - g * 10,
       (1000 - g * 10)::numeric,
       true,
       CASE WHEN g % 2 = 0 THEN 'name' ELSE 'anonymous' END,
       CASE WHEN g <= 12 THEN 'MY' ELSE 'SG' END
FROM generate_series(1, 14) g
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = EXCLUDED.total_xp,
  deductible_total_amount = EXCLUDED.deductible_total_amount,
  leaderboard_opt_in = EXCLUDED.leaderboard_opt_in,
  leaderboard_display_mode = EXCLUDED.leaderboard_display_mode,
  country_code = EXCLUDED.country_code;

INSERT INTO public.gamification_xp_events (user_id, amount, source_type, idempotency_key, awarded_at)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       1000 - g * 10,
       'receipt_scan',
       'test-weekly-' || g,
       NOW() - INTERVAL '1 day'
FROM generate_series(1, 14) g;
INSERT INTO public.gamification_xp_events (user_id, amount, source_type, idempotency_key, awarded_at)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       5000,
       'receipt_scan',
       'test-old-' || g,
       NOW() - INTERVAL '40 days'
FROM generate_series(1, 14) g;

-- monthly_receipts: g % 3 complete receipts this month, plus one pending row
-- that must not be counted. User 1 gets an old receipt that must not count.
-- merchant/date/total are NOT NULL on the production table.
INSERT INTO public.receipts (user_id, merchant, date, total, processing_status, created_at)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'Test Merchant',
       CURRENT_DATE,
       10.00,
       'complete',
       NOW()
FROM generate_series(1, 14) g, generate_series(1, g % 3) r;

INSERT INTO public.receipts (user_id, merchant, date, total, processing_status, created_at)
SELECT ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'Test Merchant',
       CURRENT_DATE,
       10.00,
       'pending',
       NOW()
FROM generate_series(1, 14) g;

INSERT INTO public.receipts (user_id, merchant, date, total, processing_status, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Old Merchant',
  CURRENT_DATE - 40,
  10.00,
  'complete',
  NOW() - INTERVAL '40 days'
);

-- A non-opted-in user with a deliberately huge score must stay off the board.
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000015', 'user15@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, email, timezone_preference)
VALUES ('00000000-0000-0000-0000-000000000015', 'Hidden', 'User', 'user15@example.com', 'Asia/Kuala_Lumpur')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email;

INSERT INTO public.user_gamification_stats (
  user_id, total_xp, deductible_total_amount, leaderboard_opt_in,
  leaderboard_display_mode, country_code
)
VALUES ('00000000-0000-0000-0000-000000000015', 9999, 9999, false, 'name', 'MY')
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = EXCLUDED.total_xp,
  deductible_total_amount = EXCLUDED.deductible_total_amount,
  leaderboard_opt_in = EXCLUDED.leaderboard_opt_in,
  leaderboard_display_mode = EXCLUDED.leaderboard_display_mode,
  country_code = EXCLUDED.country_code;

INSERT INTO public.gamification_xp_events (user_id, amount, source_type, idempotency_key, awarded_at)
VALUES ('00000000-0000-0000-0000-000000000015', 9999, 'receipt_scan', 'test-weekly-15', NOW() - INTERVAL '1 day');

-- Opted in with display mode "name" but no name set. The board must mask this
-- member instead of publishing the email local part as the display name.
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000016', 'user16@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, email, timezone_preference)
VALUES ('00000000-0000-0000-0000-000000000016', NULL, NULL, 'user16@example.com', 'Asia/Kuala_Lumpur')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  timezone_preference = EXCLUDED.timezone_preference;

INSERT INTO public.user_gamification_stats (
  user_id, total_xp, deductible_total_amount, leaderboard_opt_in,
  leaderboard_display_mode, country_code
)
VALUES ('00000000-0000-0000-0000-000000000016', 0, 0, true, 'name', 'MY')
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = EXCLUDED.total_xp,
  deductible_total_amount = EXCLUDED.deductible_total_amount,
  leaderboard_opt_in = EXCLUDED.leaderboard_opt_in,
  leaderboard_display_mode = EXCLUDED.leaderboard_display_mode,
  country_code = EXCLUDED.country_code;

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------
-- Row assertions combine NOT FOUND with IS DISTINCT FROM. A `<>` comparison
-- whose operand is NULL evaluates to NULL, and `IF NULL THEN` does not raise,
-- so a missing row or a withheld/NULL value would otherwise pass silently.
-- (SELECT ... INTO leaves every field NULL when no row matches.)
-- Timezone handling is exercised before switching to the authenticated role:
-- the trigger update below runs as the table owner.
DO $$
DECLARE
  v_message TEXT;
BEGIN
  BEGIN
    UPDATE public.profiles
    SET timezone_preference = 'Not/AZone'
    WHERE id = '00000000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'invalid timezone write must be rejected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message IS NULL OR v_message NOT LIKE 'Invalid timezone%' THEN
      RAISE EXCEPTION 'invalid timezone write: unexpected error: %', v_message;
    END IF;
  END;
END $$;

-- A bad legacy value (written before the trigger existed) must not abort the
-- monthly metric for every caller.
DO $$
DECLARE
  v_count INTEGER;
  v_value NUMERIC;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  EXECUTE 'ALTER TABLE public.profiles DISABLE TRIGGER validate_profile_timezone';
  UPDATE public.profiles
  SET timezone_preference = 'Not/AZone'
  WHERE id = '00000000-0000-0000-0000-000000000001';
  EXECUTE 'ALTER TABLE public.profiles ENABLE TRIGGER validate_profile_timezone';

  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('monthly_receipts', NULL, 100);
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'bad legacy timezone: expected 15 rows, got %', v_count;
  END IF;

  -- Users 2, 5, 8, 11 and 14 have two complete receipts; user 1 is the first
  -- of the one-receipt group, so it holds rank 6.
  SELECT metric_value INTO v_value
  FROM public.get_gamification_leaderboard('monthly_receipts', NULL, 100)
  WHERE rank = 6;
  IF NOT FOUND OR v_value IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'bad legacy timezone: expected rank 6 value 1, got %', v_value;
  END IF;

  UPDATE public.profiles
  SET timezone_preference = 'Asia/Kuala_Lumpur'
  WHERE id = '00000000-0000-0000-0000-000000000001';
END $$;

DO $$
DECLARE
  v_row RECORD;
  v_count INTEGER;
  v_message TEXT;
BEGIN
  -- Exercise the real caller path: the function is SECURITY DEFINER, and the
  -- authenticated role must have EXECUTE of its own, not merely inherit it.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 1. The original failure: any call to the function raises 42702. Reaching
  --    the next line proves the function compiled and executed.
  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100);
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'weekly_xp global: expected 15 rows, got %', v_count;
  END IF;

  -- 2. Top-N plus the caller, even when the caller is outside the top N.
  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 5);
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'weekly_xp top 5 plus viewer: expected 6 rows, got %', v_count;
  END IF;

  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 5)
  WHERE is_current_user;
  IF NOT FOUND
     OR v_row.rank IS DISTINCT FROM 14
     OR v_row.metric_value IS DISTINCT FROM 860
     OR v_row.gap_to_top_ten IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'viewer row: expected rank 14 / 860 XP / gap 40, got % / % / %',
      v_row.rank, v_row.metric_value, v_row.gap_to_top_ten;
  END IF;

  -- 3. Anonymity masking: names are hidden and the stable user_id is withheld
  --    from everyone except the member themselves.
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100)
  WHERE display_name = 'Anonymous #1';
  IF NOT FOUND OR v_row.is_anonymous IS DISTINCT FROM TRUE OR v_row.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'anonymous user: expected masked name and NULL user_id, got % (anonymous=%, user_id=%)',
      v_row.display_name, v_row.is_anonymous, v_row.user_id;
  END IF;

  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100)
  WHERE user_id = '00000000-0000-0000-0000-000000000002';
  IF NOT FOUND
     OR v_row.is_anonymous IS DISTINCT FROM FALSE
     OR v_row.display_name IS DISTINCT FROM 'User 2'
     OR v_row.user_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000002' THEN
    RAISE EXCEPTION 'named user: expected "User 2" and a visible user_id, got % (anonymous=%, user_id=%)',
      v_row.display_name, v_row.is_anonymous, v_row.user_id;
  END IF;

  -- Display mode "name" without a name must fall back to the masked form, not
  -- to the email local part.
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100)
  WHERE display_name = 'Anonymous #15';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member with no name must still appear on the board';
  END IF;
  IF v_row.is_anonymous IS DISTINCT FROM TRUE OR v_row.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'member with no name: expected masked row, got anonymous=% user_id=%',
      v_row.is_anonymous, v_row.user_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100)
    WHERE display_name = 'user16'
  ) THEN
    RAISE EXCEPTION 'email local part must never be published as a display name';
  END IF;

  -- An anonymous viewer still needs their own id so the UI can highlight them.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 5)
  WHERE is_current_user;
  IF NOT FOUND
     OR v_row.user_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'
     OR v_row.is_anonymous IS DISTINCT FROM TRUE
     OR v_row.display_name IS DISTINCT FROM 'Anonymous #1' THEN
    RAISE EXCEPTION 'anonymous viewer: expected own user_id and "Anonymous #1", got % (anonymous=%)',
      v_row.user_id, v_row.is_anonymous;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);

  -- 4. Country scope, including lower-case input.
  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', 'my', 100);
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'MY scope: expected 13 rows, got %', v_count;
  END IF;

  -- Opt-out is absolute: user 15 has 9999 XP but is not participating.
  IF EXISTS (
    SELECT 1 FROM public.get_gamification_leaderboard('weekly_xp', NULL, 100)
    WHERE user_id = '00000000-0000-0000-0000-000000000015'
  ) THEN
    RAISE EXCEPTION 'non-opted-in user must never appear on the leaderboard';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', 'SG', 100);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'SG scope: expected 2 rows, got %', v_count;
  END IF;

  -- Viewer 12 is rank 12 within MY; rank 10 holds 900 XP and viewer holds 880.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('weekly_xp', 'MY', 5)
  WHERE is_current_user;
  IF NOT FOUND
     OR v_row.rank IS DISTINCT FROM 12
     OR v_row.gap_to_top_ten IS DISTINCT FROM 20 THEN
    RAISE EXCEPTION 'MY viewer row: expected rank 12 gap 20, got rank % gap %',
      v_row.rank, v_row.gap_to_top_ten;
  END IF;

  -- 5. monthly_receipts counts only complete receipts in the current month.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('monthly_receipts', NULL, 100)
  WHERE user_id = '00000000-0000-0000-0000-000000000002';
  IF NOT FOUND OR v_row.metric_value IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'monthly user 2: expected 2 complete receipts, got %', v_row.metric_value;
  END IF;

  -- Users 2, 5, 8, 11 and 14 have two complete receipts; user 1 is the first
  -- of the one-receipt group, so it holds rank 6. Anonymous rows have a NULL
  -- user_id, hence the rank lookup.
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('monthly_receipts', NULL, 100)
  WHERE rank = 6;
  IF NOT FOUND OR v_row.metric_value IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'monthly user 1: expected 1 current-month receipt (old row excluded), got %', v_row.metric_value;
  END IF;

  -- 6. deductible_total ranks the tracked amount.
  SELECT * INTO v_row
  FROM public.get_gamification_leaderboard('deductible_total', NULL, 100)
  WHERE user_id = '00000000-0000-0000-0000-000000000014';
  IF NOT FOUND
     OR v_row.metric_value IS DISTINCT FROM 860
     OR v_row.rank IS DISTINCT FROM 14
     OR v_row.gap_to_top_ten IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'deductible viewer: expected value 860 rank 14 gap 40, got % / % / %',
      v_row.metric_value, v_row.rank, v_row.gap_to_top_ten;
  END IF;

  -- 7. Limit normalization: 0 becomes 1, 500 becomes 100.
  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 0);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'limit 0: expected top 1 plus viewer (2 rows), got %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, 500);
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'limit 500: expected all 15 rows, got %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', NULL, NULL);
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'NULL limit: expected the default ceiling of 15 rows, got %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.get_gamification_leaderboard('weekly_xp', '', 100);
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'blank country: expected the global 15 rows, got %', v_count;
  END IF;

  -- 8. NULL and unsupported metrics are rejected, not silently treated as
  --    deductible_total (NULL NOT IN (...) is NULL, so the old guard missed it).
  BEGIN
    PERFORM * FROM public.get_gamification_leaderboard(NULL, NULL, 5);
    RAISE EXCEPTION 'NULL metric must be rejected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message IS NULL OR v_message NOT LIKE 'Unsupported leaderboard metric%' THEN
      RAISE EXCEPTION 'NULL metric: unexpected error: %', v_message;
    END IF;
  END;

  BEGIN
    PERFORM * FROM public.get_gamification_leaderboard('not_a_metric', NULL, 5);
    RAISE EXCEPTION 'unsupported metric must be rejected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message IS NULL OR v_message NOT LIKE 'Unsupported leaderboard metric%' THEN
      RAISE EXCEPTION 'unsupported metric: unexpected error: %', v_message;
    END IF;
  END;

  -- 9. Missing authentication is rejected.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM * FROM public.get_gamification_leaderboard('weekly_xp', NULL, 5);
    RAISE EXCEPTION 'anonymous caller must be rejected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message IS DISTINCT FROM 'Authentication required' THEN
      RAISE EXCEPTION 'anonymous caller: unexpected error: %', v_message;
    END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000014', true);

  -- 10. Grant hygiene: authenticated/service_role only, no PUBLIC EXECUTE.
  IF NOT has_function_privilege('authenticated',
      'public.get_gamification_leaderboard(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must be able to execute the leaderboard RPC';
  END IF;
  IF NOT has_function_privilege('service_role',
      'public.get_gamification_leaderboard(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must be able to execute the leaderboard RPC';
  END IF;
  IF has_function_privilege('anon',
      'public.get_gamification_leaderboard(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not be able to execute the leaderboard RPC';
  END IF;

  IF (
    SELECT p.proacl IS NULL
       OR EXISTS (
         SELECT 1 FROM aclexplode(p.proacl) a
         WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       )
    FROM pg_proc p
    WHERE p.oid = 'public.get_gamification_leaderboard(text,text,integer)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not hold EXECUTE on the leaderboard RPC';
  END IF;

  RAISE NOTICE 'gamification leaderboard RPC: all assertions passed';
END $$;

ROLLBACK;
