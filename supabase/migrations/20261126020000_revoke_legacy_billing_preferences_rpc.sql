-- Legacy hosted schemas can contain this SECURITY DEFINER RPC even though it
-- is absent from the checked-in baseline. Its user-id argument is not scoped
-- to the caller. Remove browser access from every overload, including
-- overloads that never had an explicit browser grant. Explicit service-role
-- grants remain, but service access inherited solely from PUBLIC is removed
-- with that grant and requires separate review.
BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_billing_preferences'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname, r.proname, r.identity_args
    );
  END LOOP;
END $$;

COMMIT;
