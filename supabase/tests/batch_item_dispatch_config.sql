-- Regression test: batch item dispatch stays administrator-configured and
-- fails closed until it is configured.
--
-- Background: 20261104000001_batch_item_vault_trigger.sql replaces the
-- hardcoded endpoint and service credential with a Vault secret plus an
-- administrator-owned config table. The endpoint is environment-specific, so
-- the migration intentionally creates the table empty. This test pins that
-- behavior: an unconfigured environment raises a clear error before
-- net.http_post instead of dispatching to a guessed URL. It also pins that the
-- trigger function returns NEW (a BEFORE trigger would otherwise cancel the
-- row) and that the function keeps its trusted-only privileges.
--
-- How to run: provision a nonproduction scratch PostgreSQL with all migrations
-- applied (Vault and pg_net present, exactly one service_role_key secret),
-- verify DATABASE_URL points to that scratch instance and never production,
-- then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/batch_item_dispatch_config.sql
--
-- The missing-config branch raises before net.http_post, so this file never
-- contacts an endpoint. If a config row is already present, the mutating
-- sections are skipped with a NOTICE so a real privileged request is never
-- enqueued. Everything runs inside one transaction that ends in ROLLBACK, so it
-- creates no lasting state and is safe to re-run.
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
  IF to_regclass('public.batch_item_dispatch_config') IS NULL
     OR to_regprocedure('public.handle_new_batch_item()') IS NULL
     OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'This test needs the nonproduction schema with 20261104000001 applied; never run it against production';
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM vault.decrypted_secrets WHERE name = 'service_role_key') <> 1 THEN
    RAISE EXCEPTION 'This test needs exactly one service_role_key Vault secret; never log or print its value';
  END IF;
END $$;

CREATE FUNCTION pg_temp.test_raises_code(p_sql TEXT, p_state TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE = p_state;
END;
$f$;

-- ---------------------------------------------------------------------------
-- 1. The config table is administrator-only and its constraints hold.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner TEXT;
  v_rls BOOLEAN;
BEGIN
  SELECT pg_get_userbyid(c.relowner), c.relrowsecurity
  INTO v_owner, v_rls
  FROM pg_class c
  WHERE c.oid = 'public.batch_item_dispatch_config'::regclass;

  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'config: expected owner postgres, got %', v_owner;
  END IF;
  IF NOT v_rls THEN
    RAISE EXCEPTION 'config: row-level security must be enabled';
  END IF;

  IF has_table_privilege('anon', 'public.batch_item_dispatch_config', 'SELECT')
     OR has_table_privilege('authenticated', 'public.batch_item_dispatch_config', 'SELECT')
     OR has_table_privilege('service_role', 'public.batch_item_dispatch_config', 'SELECT')
     OR has_table_privilege('service_role', 'public.batch_item_dispatch_config', 'INSERT')
     OR has_table_privilege('service_role', 'public.batch_item_dispatch_config', 'UPDATE') THEN
    RAISE EXCEPTION 'config: application roles must not read or modify the dispatch config';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c, aclexplode(c.relacl) acl
    WHERE c.oid = 'public.batch_item_dispatch_config'::regclass
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'config: PUBLIC must not hold privileges on the dispatch config';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The trigger function keeps its trusted-only shape and timing-agnostic
--    return value.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_def TEXT;
  v_owner TEXT;
  v_secdef BOOLEAN;
  v_config TEXT[];
BEGIN
  SELECT pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
  INTO v_def, v_owner, v_secdef, v_config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_batch_item';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'function: public.handle_new_batch_item() is missing';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'function: handle_new_batch_item must be SECURITY DEFINER';
  END IF;
  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'function: expected owner postgres, got %', v_owner;
  END IF;
  IF v_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::TEXT[] THEN
    RAISE EXCEPTION 'function: expected search_path = pg_catalog, got %', v_config;
  END IF;

  IF v_def ~ '\mRETURN\s+NULL\M' OR v_def !~ '\mRETURN\s+NEW\M' THEN
    RAISE EXCEPTION 'function: a row-level BEFORE trigger needs RETURN NEW, not RETURN NULL';
  END IF;
  IF position('vault.decrypted_secrets' IN v_def) = 0
     OR position('public.batch_item_dispatch_config' IN v_def) = 0
     OR position('net.http_post' IN v_def) = 0 THEN
    RAISE EXCEPTION 'function: Vault, config table, or pg_net dispatch is missing';
  END IF;

  IF has_function_privilege('anon', 'public.handle_new_batch_item()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_batch_item()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.handle_new_batch_item()', 'EXECUTE') THEN
    RAISE EXCEPTION 'function: application roles must not execute the trigger function';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. An unconfigured environment fails closed before calling the endpoint.
--    A BEFORE attachment is used deliberately: RETURN NEW must not cancel the
--    insert (the function's own RAISE is what aborts it here).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_raised BOOLEAN := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.batch_item_dispatch_config) THEN
    RAISE NOTICE 'config row is present; skipping the missing-config dispatch test to avoid a real request';
    RETURN;
  END IF;

  CREATE TEMP TABLE _test_batch_items (id UUID PRIMARY KEY);
  CREATE TRIGGER _test_batch_item_dispatch
    BEFORE INSERT ON _test_batch_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_batch_item();

  BEGIN
    INSERT INTO _test_batch_items (id) VALUES (gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Missing administrator-configured batch item endpoint%' THEN
      RAISE;
    END IF;
    v_raised := true;
  END;

  IF NOT v_raised THEN
    RAISE EXCEPTION 'missing config: a batch insert must fail closed instead of dispatching';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The endpoint CHECK and the singleton key reject ambiguous configuration.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.batch_item_dispatch_config) THEN
    RAISE NOTICE 'config row is present; skipping config constraint tests';
    RETURN;
  END IF;

  IF NOT pg_temp.test_raises_code($t$
    INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
    VALUES (true, 'http://project-ref.supabase.co/functions/v1/process-batch-item')
  $t$, '23514') THEN
    RAISE EXCEPTION 'config: a non-HTTPS endpoint must be rejected by a check constraint';
  END IF;

  IF NOT pg_temp.test_raises_code($t$
    INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
    VALUES (true, 'https://project-ref.supabase.co/functions/v1/other-function')
  $t$, '23514') THEN
    RAISE EXCEPTION 'config: an endpoint that is not process-batch-item must be rejected by a check constraint';
  END IF;

  IF NOT pg_temp.test_raises_code($t$
    INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
    VALUES (false, 'https://project-ref.supabase.co/functions/v1/process-batch-item')
  $t$, '23514') THEN
    RAISE EXCEPTION 'config: singleton = false must be rejected by a check constraint';
  END IF;

  INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
  VALUES (true, 'https://project-ref.supabase.co/functions/v1/process-batch-item');

  IF NOT pg_temp.test_raises_code($t$
    INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
    VALUES (true, 'https://other-ref.supabase.co/functions/v1/process-batch-item')
  $t$, '23505') THEN
    RAISE EXCEPTION 'config: a second row must be rejected by the singleton primary key';
  END IF;
END $$;

ROLLBACK;
