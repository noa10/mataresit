-- Disposable SQL regression database only. This deliberately creates an
-- unsafe legacy function, then verifies the real forward migration closes it.
\set ON_ERROR_STOP on
\if :{?billing_revoke_migration}
\else
  \set billing_revoke_migration ../migrations/20261126020000_revoke_legacy_billing_preferences_rpc.sql
\endif

DO $$
BEGIN
  IF to_regclass('public.pr234_verify_marker') IS NULL THEN
    RAISE EXCEPTION 'refusing to run without the disposable regression database marker';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_billing_preferences') THEN
    RAISE EXCEPTION 'refusing to replace an existing billing preferences function';
  END IF;
END $$;

-- An environment without the hosted-only function must allow migration replay.
\ir :billing_revoke_migration
\ir :billing_revoke_migration

CREATE SCHEMA billing_preferences_revoke_fixture;
CREATE TABLE billing_preferences_revoke_fixture.preferences (
  user_id uuid PRIMARY KEY,
  auto_renewal_enabled boolean NOT NULL
);
INSERT INTO billing_preferences_revoke_fixture.preferences VALUES
  ('11111111-1111-4111-8111-111111111111', true),
  ('22222222-2222-4222-8222-222222222222', true);

-- Mirror the hosted signature, default arguments, definer rights and unsafe
-- arbitrary-user upsert, using isolated synthetic rows instead of real accounts.
CREATE FUNCTION public.update_billing_preferences(
  p_user_id uuid,
  p_auto_renewal_enabled boolean DEFAULT NULL,
  p_reminder_days_before_renewal integer[] DEFAULT NULL,
  p_preferred_language varchar DEFAULT NULL,
  p_timezone varchar DEFAULT NULL,
  p_email_notifications_enabled boolean DEFAULT NULL,
  p_sms_notifications_enabled boolean DEFAULT NULL,
  p_push_notifications_enabled boolean DEFAULT NULL,
  p_quiet_hours_start time DEFAULT NULL,
  p_quiet_hours_end time DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO billing_preferences_revoke_fixture.preferences AS prefs (user_id, auto_renewal_enabled)
  VALUES (p_user_id, COALESCE(p_auto_renewal_enabled, true))
  ON CONFLICT (user_id) DO UPDATE
  SET auto_renewal_enabled = COALESCE(p_auto_renewal_enabled, prefs.auto_renewal_enabled);
  RETURN p_user_id;
END $$;

-- A distinct overload demonstrates the migration covers catalog drift and does
-- not create a service-role grant where one did not exist.
CREATE FUNCTION public.update_billing_preferences(p_user_id uuid, p_marker text)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT p_marker $$;
REVOKE ALL ON FUNCTION public.update_billing_preferences(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_billing_preferences(uuid, text) TO anon, authenticated;

-- This overload has no explicit grants, so PUBLIC is its only access path.
CREATE FUNCTION public.update_billing_preferences(p_user_id uuid, p_marker integer)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT p_marker::text $$;

GRANT EXECUTE ON FUNCTION public.update_billing_preferences(uuid, boolean, integer[], varchar, varchar, boolean, boolean, boolean, time, time)
  TO PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE r RECORD; seen integer := 0;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'update_billing_preferences'
  LOOP
    seen := seen + 1;
    IF NOT has_function_privilege('anon', r.oid, 'EXECUTE') OR
       NOT has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'legacy fixture was not exposed to both browser roles';
    END IF;
  END LOOP;
  IF seen <> 3 THEN RAISE EXCEPTION 'expected exactly three legacy overloads, got %', seen; END IF;
  IF (SELECT proacl FROM pg_proc
      WHERE oid = 'public.update_billing_preferences(uuid,integer)'::regprocedure) IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLIC-only fixture unexpectedly has an explicit ACL';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.update_billing_preferences(uuid,boolean,integer[],character varying,character varying,boolean,boolean,boolean,time without time zone,time without time zone)', 'EXECUTE') OR
     has_function_privilege('service_role', 'public.update_billing_preferences(uuid,text)', 'EXECUTE') OR
     NOT has_function_privilege('service_role', 'public.update_billing_preferences(uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service-role fixture privileges are incorrect';
  END IF;
END $$;

\ir :billing_revoke_migration
\ir :billing_revoke_migration

DO $$
DECLARE r RECORD; seen integer := 0;
BEGIN
  FOR r IN SELECT p.oid, p.proacl, p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'update_billing_preferences'
  LOOP
    seen := seen + 1;
    IF has_function_privilege('anon', r.oid, 'EXECUTE') OR
       has_function_privilege('authenticated', r.oid, 'EXECUTE') OR
       EXISTS (SELECT 1 FROM aclexplode(COALESCE(r.proacl, acldefault('f', r.proowner))) a
               WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
      RAISE EXCEPTION 'legacy overload % remains executable by a browser role or PUBLIC', r.oid::regprocedure;
    END IF;
  END LOOP;
  IF seen <> 3 THEN RAISE EXCEPTION 'migration changed the overload count'; END IF;
  IF NOT has_function_privilege('service_role', 'public.update_billing_preferences(uuid,boolean,integer[],character varying,character varying,boolean,boolean,boolean,time without time zone,time without time zone)', 'EXECUTE') OR
     has_function_privilege('service_role', 'public.update_billing_preferences(uuid,text)', 'EXECUTE') OR
     has_function_privilege('service_role', 'public.update_billing_preferences(uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'migration changed service-role access';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM aclexplode(acldefault('f', 'postgres'::regrole))
    WHERE grantee = 0 AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'fixture cannot distinguish inherited PUBLIC access';
  END IF;
END $$;

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.update_billing_preferences(p_user_id => '22222222-2222-4222-8222-222222222222'::uuid, p_auto_renewal_enabled => false);
    RAISE EXCEPTION 'anon was able to update another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_billing_preferences(p_user_id => '11111111-1111-4111-8111-111111111111'::uuid, p_auto_renewal_enabled => false);
    RAISE EXCEPTION 'authenticated caller was able to update its own row via the service-only RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.update_billing_preferences(p_user_id => '22222222-2222-4222-8222-222222222222'::uuid, p_auto_renewal_enabled => false);
    RAISE EXCEPTION 'authenticated caller was able to update another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', '', false);
  BEGIN
    PERFORM public.update_billing_preferences(p_user_id => '22222222-2222-4222-8222-222222222222'::uuid, p_auto_renewal_enabled => false);
    RAISE EXCEPTION 'authenticated caller without a subject could update another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM billing_preferences_revoke_fixture.preferences WHERE auto_renewal_enabled) <> 2 THEN
    RAISE EXCEPTION 'a denied browser call changed fixture data';
  END IF;
END $$;

SET ROLE service_role;
DO $$
BEGIN
  IF public.update_billing_preferences(p_user_id => '22222222-2222-4222-8222-222222222222'::uuid, p_auto_renewal_enabled => false)
     IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid THEN
    RAISE EXCEPTION 'service-role call returned an unexpected value';
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT auto_renewal_enabled FROM billing_preferences_revoke_fixture.preferences
      WHERE user_id = '22222222-2222-4222-8222-222222222222') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'service-role call did not update the fixture';
  END IF;
END $$;

DROP FUNCTION public.update_billing_preferences(uuid, boolean, integer[], varchar, varchar, boolean, boolean, boolean, time, time);
DROP FUNCTION public.update_billing_preferences(uuid, text);
DROP FUNCTION public.update_billing_preferences(uuid, integer);
DROP SCHEMA billing_preferences_revoke_fixture CASCADE;
