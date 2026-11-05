-- Regression test: billing and entitlement columns on public.profiles are
-- writable by the billing service and trusted database roles, never by end
-- users.
--
-- Background: 20261104000000_stripe_production_hardening.sql installs a
-- SECURITY INVOKER BEFORE INSERT OR UPDATE trigger. Service-role Edge Functions
-- write billing columns directly through PostgREST. PostgREST switches the
-- request transaction with SET LOCAL ROLE from the JWT role claim, and Supabase
-- service keys authorize as the built-in service_role role, so those calls run
-- with current_user = service_role. This test proves the service role is
-- admitted and an authenticated user is rejected, including on INSERT.
--
-- How to run: provision a Supabase-shaped scratch PostgreSQL with the auth
-- schema present and all migrations applied, verify DATABASE_URL points to that
-- scratch instance and never production, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_billing_column_protection.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK, so it
-- creates no lasting state and is safe to re-run. It exits non-zero on the
-- first failed assertion. It seeds two auth.users rows, which fires the normal
-- handle_new_user profile bootstrap; that is the supported way to satisfy the
-- profiles.id foreign key in a scratch database.
--
-- Deliberately does NOT use pgTAP: plain DO blocks give a non-zero exit and a
-- readable message.
--
-- Unexecuted when added to the PR: no database was available in that
-- environment. Run it on nonproduction before applying the migrations.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'This test needs the Supabase auth schema (auth.users, auth.role(), auth.uid()); never run it against production';
  END IF;
END $$;

-- Two fixed ids keep the assertions readable. Both rows are rolled back.
CREATE TEMP TABLE _test_users (id UUID PRIMARY KEY);

INSERT INTO _test_users (id)
VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
SELECT id,
       'authenticated',
       'authenticated',
       'billing-protection-' || id::text || '@example.invalid',
       '{}'::jsonb,
       clock_timestamp(),
       clock_timestamp()
FROM _test_users;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.profiles WHERE id IN (SELECT id FROM _test_users)) <> 2 THEN
    RAISE EXCEPTION 'setup: handle_new_user must create a profile for each seeded auth user';
  END IF;
END $$;

-- The insert test needs the profile absent so the authenticated INSERT creates
-- it through the trigger. The auth.users row keeps the foreign key satisfied.
DELETE FROM public.profiles
WHERE id = '00000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 1. A service-role request (PostgREST SET LOCAL ROLE service_role) may update
--    protected billing columns.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_id UUID := '00000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE public.profiles
  SET subscription_status = 'past_due',
      grace_period_end_date = clock_timestamp() + INTERVAL '1 day',
      payment_retry_attempts = 2,
      next_billing_date = clock_timestamp() + INTERVAL '30 days'
  WHERE id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_role: protected billing update must succeed';
  END IF;

  IF (SELECT subscription_status FROM public.profiles WHERE id = v_id) <> 'past_due' THEN
    RAISE EXCEPTION 'service_role: billing update was not stored';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 2. An authenticated user may update ordinary profile fields but not billing
--    columns, and an authenticated INSERT is forced to safe defaults.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_update_id UUID := '00000000-0000-4000-8000-000000000001';
  v_insert_id UUID := '00000000-0000-4000-8000-000000000002';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_update_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_update_id)::text,
    true
  );

  -- Positive control: the row is visible and writable through RLS.
  UPDATE public.profiles SET first_name = 'Test' WHERE id = v_update_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authenticated: own-profile update must pass RLS';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET subscription_tier = 'max'
    WHERE id = v_update_id;

    RAISE EXCEPTION 'authenticated: a direct billing update was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Billing fields can only be changed by the billing service%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_insert_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_insert_id)::text,
    true
  );

  INSERT INTO public.profiles (
    id, email, subscription_tier, subscription_status,
    receipts_used_this_month, stripe_customer_id
  )
  VALUES (
    v_insert_id,
    'billing-protection-insert@example.invalid',
    'max',
    'past_due',
    99,
    'cus_should_be_cleared'
  );
END $$;

RESET ROLE;

DO $$
DECLARE
  v_tier public.subscription_tier;
  v_status public.subscription_status;
  v_receipts INTEGER;
  v_customer TEXT;
  v_retry INTEGER;
BEGIN
  SELECT subscription_tier, subscription_status, receipts_used_this_month,
         stripe_customer_id
  INTO v_tier, v_status, v_receipts, v_customer
  FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000002';

  IF v_tier IS DISTINCT FROM 'free' OR v_status IS DISTINCT FROM 'active'
     OR v_receipts IS DISTINCT FROM 0 OR v_customer IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated INSERT: billing defaults were not forced (tier %, status %, receipts %, customer %)',
      v_tier, v_status, v_receipts, v_customer;
  END IF;

  SELECT payment_retry_attempts INTO v_retry
  FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000001';

  IF v_retry IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'service_role: billing update was lost (payment_retry_attempts %)', v_retry;
  END IF;
END $$;

ROLLBACK;
