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
-- 0. Every column the guard references exists. 20261126010000 restores the six
--    that older hosted schemas never created; this runs after all curated
--    migrations on both the fresh/enum and the drifted/varchar shapes.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(c.name, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'auto_renewal_enabled', 'auto_renewal_frequency', 'billing_email_enabled',
    'billing_address', 'payment_method_brand', 'payment_method_last_four'
  ]) AS c(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = c.name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'profiles is missing billing columns the guard references: %', v_missing;
  END IF;
END $$;

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
      next_billing_date = clock_timestamp() + INTERVAL '30 days',
      auto_renewal_enabled = false,
      auto_renewal_frequency = 'annual',
      billing_email_enabled = false,
      billing_address = '{"city":"Kuala Lumpur"}'::jsonb,
      payment_method_brand = 'visa',
      payment_method_last_four = '4242'
  WHERE id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_role: protected billing update must succeed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_id
      AND subscription_status = 'past_due'
      AND auto_renewal_enabled = false AND auto_renewal_frequency = 'annual'
      AND billing_email_enabled = false AND billing_address = '{"city":"Kuala Lumpur"}'::jsonb
      AND payment_method_brand = 'visa' AND payment_method_last_four = '4242'
  ) THEN
    RAISE EXCEPTION 'service_role: billing update was not stored';
  END IF;

  -- Both shapes must reject values outside the declared contract: the hosted
  -- varchar column through its check constraint, the fresh schema through the
  -- enum type.
  BEGIN
    UPDATE public.profiles SET auto_renewal_frequency = 'weekly' WHERE id = v_id;
    RAISE EXCEPTION 'service_role: an unsupported renewal frequency was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'service_role: an unsupported renewal frequency was accepted' THEN
      RAISE;
    END IF;
  END;
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
  v_assignment TEXT;
  v_state TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_update_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_update_id)::text,
    true
  );

  -- Positive control: the row is visible and writable through RLS. An ordinary
  -- update must succeed on the repaired shape; on the drifted shape the guard
  -- aborted here with "record \"new\" has no field ...".
  UPDATE public.profiles SET first_name = 'Test', last_name = 'Ordinary' WHERE id = v_update_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authenticated: own-profile update must pass RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_update_id AND first_name = 'Test' AND last_name = 'Ordinary'
  ) THEN
    RAISE EXCEPTION 'authenticated: ordinary profile update was not stored';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET subscription_tier = 'max',
        auto_renewal_frequency = 'annual',
        payment_method_brand = 'visa'
    WHERE id = v_update_id;

    RAISE EXCEPTION 'authenticated: a direct billing update was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF SQLERRM NOT LIKE '%Billing fields can only be changed by the billing service%'
       OR v_state <> '42501' THEN
      RAISE;
    END IF;
  END;

  -- Every restored column must be compared by the guard on its own, otherwise
  -- one of them could be self-served while a sibling triggers the error. The
  -- values differ from what section 1 stored, so each attempt is a real change.
  FOREACH v_assignment IN ARRAY ARRAY[
    'auto_renewal_enabled = true',
    'auto_renewal_frequency = ''monthly''',
    'billing_email_enabled = true',
    'billing_address = ''{}''::jsonb',
    'payment_method_brand = NULL',
    'payment_method_last_four = NULL'
  ] LOOP
    BEGIN
      EXECUTE format(
        'UPDATE public.profiles SET %s WHERE id = %L', v_assignment, v_update_id
      );
      RAISE EXCEPTION 'authenticated: % was accepted', v_assignment;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      IF SQLERRM NOT LIKE '%Billing fields can only be changed by the billing service%'
         OR v_state <> '42501' THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_insert_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_insert_id)::text,
    true
  );

  INSERT INTO public.profiles (
    id, email, subscription_tier, subscription_status,
    receipts_used_this_month, stripe_customer_id,
    auto_renewal_enabled, auto_renewal_frequency, billing_email_enabled,
    billing_address, payment_method_brand, payment_method_last_four
  )
  VALUES (
    v_insert_id,
    'billing-protection-insert@example.invalid',
    'max',
    'past_due',
    99,
    'cus_should_be_cleared',
    false,
    'annual',
    false,
    '{"city":"Kuala Lumpur"}'::jsonb,
    'visa',
    '4242'
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

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000002'
      AND (auto_renewal_enabled IS DISTINCT FROM true
        OR auto_renewal_frequency IS DISTINCT FROM 'monthly'
        OR billing_email_enabled IS DISTINCT FROM true
        OR billing_address IS DISTINCT FROM '{}'::jsonb
        OR payment_method_brand IS NOT NULL
        OR payment_method_last_four IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'authenticated INSERT: restored billing preferences were not reset to defaults';
  END IF;

  -- The rejected per-column updates must not have changed the service-role values.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000001'
      AND (auto_renewal_enabled IS DISTINCT FROM false
        OR auto_renewal_frequency IS DISTINCT FROM 'annual'
        OR billing_email_enabled IS DISTINCT FROM false
        OR billing_address IS DISTINCT FROM '{"city":"Kuala Lumpur"}'::jsonb
        OR payment_method_brand IS DISTINCT FROM 'visa'
        OR payment_method_last_four IS DISTINCT FROM '4242')
  ) THEN
    RAISE EXCEPTION 'authenticated UPDATE: a protected billing column changed despite the guard';
  END IF;

  SELECT payment_retry_attempts INTO v_retry
  FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000001';

  IF v_retry IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'service_role: billing update was lost (payment_retry_attempts %)', v_retry;
  END IF;
END $$;

ROLLBACK;
