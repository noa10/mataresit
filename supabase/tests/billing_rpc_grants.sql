-- Billing RPC grant regression for
-- 20261124000000_revoke_legacy_billing_rpc_grants.sql.
--
-- Run after the curated migration chain in .github/sql-regression, or on any
-- nonproduction schema that has applied that migration. Read-only: it asserts
-- catalog state and never mutates rows.
--
-- It proves:
--   1. the four legacy billing RPCs are not executable by anon/authenticated,
--   2. service_role keeps execute so the Edge Functions still work,
--   3. no other public SECURITY DEFINER billing RPC is left with a PUBLIC grant.
--
-- The self-scoped preference read paths (get_my_billing_preferences and the
-- legacy get_billing_preferences alias) are 20261103000000's contract and are
-- covered by supabase/tests/billing_schema_restore.sql, so they are excluded
-- from the sweep below rather than re-asserted here.
DO $$
DECLARE
  r RECORD;
  offenders TEXT := '';
BEGIN
  -- 1 + 2: the four names closed by the migration.
  FOR r IN
    SELECT p.oid::regprocedure::text AS signature,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'schedule_billing_reminder',
        'get_upcoming_renewals',
        'get_email_delivery_stats',
        'cleanup_old_email_schedules'
      )
  LOOP
    IF r.anon OR r.authenticated THEN
      offenders := offenders || r.signature || ' (browser role) ';
    END IF;
    IF NOT r.service_role THEN
      offenders := offenders || r.signature || ' (service_role lost execute) ';
    END IF;
  END LOOP;

  -- 3: belt and braces — no billing-named SECURITY DEFINER function should
  -- still carry a PUBLIC grant (grantee 0) or an anon grant, apart from the
  -- explicitly self-scoped read paths checked above.
  FOR r IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (p.proname ILIKE '%billing%' OR p.proname ILIKE '%renewal%'
           OR p.proname ILIKE '%email_schedule%')
      AND p.proname NOT IN (
        'get_my_billing_preferences',
        'get_billing_preferences',
        'mark_billing_reminder_sent'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR EXISTS (
          SELECT 1
          FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0
        )
      )
  LOOP
    offenders := offenders || r.signature || ' (public/anon SECURITY DEFINER) ';
  END LOOP;

  IF offenders <> '' THEN
    RAISE EXCEPTION 'billing RPC grant regression: %', offenders;
  END IF;

  RAISE NOTICE 'billing RPC grant regression: pass';
END $$;
