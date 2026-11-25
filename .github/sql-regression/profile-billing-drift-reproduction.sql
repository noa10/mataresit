-- Reproduce the production failure on the drifted profile shape, before
-- 20261126010000_restore_profile_billing_columns.sql runs.
--
-- The guard trigger installed by 20261104000000 / 20261110010000 assigns and
-- compares NEW.payment_method_brand, NEW.payment_method_last_four,
-- NEW.auto_renewal_enabled, NEW.auto_renewal_frequency,
-- NEW.billing_email_enabled and NEW.billing_address. The drifted table has
-- none of them, so any ordinary INSERT or UPDATE aborts inside the trigger
-- with "record \"new\" has no field \"payment_method_brand\"" before the
-- statement's own constraints are even evaluated.
--
-- The trigger admits postgres, supabase_admin and service_role immediately, so
-- the failure is only reachable as an end-user role. PostgREST switches with
-- SET LOCAL ROLE, which is why this test does the same inside one transaction.
BEGIN;

-- The fixture profile is created the supported way: an auth.users row fires
-- handle_new_user, which inserts as postgres and therefore passes the guard.
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-0000000000d0',
  'authenticated',
  'authenticated',
  'profile-drift@example.invalid',
  '{}'::jsonb,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_update_id UUID := '00000000-0000-4000-8000-0000000000d0';
  v_insert_id UUID := '00000000-0000-4000-8000-0000000000d1';
  v_message TEXT;
  v_state TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_update_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_update_id)::text,
    true
  );

  -- An ordinary INSERT of an unrelated column must fail on the drifted shape.
  BEGIN
    INSERT INTO public.profiles (id, first_name)
    VALUES (v_insert_id, 'Drift');
    RAISE EXCEPTION 'drift fixture: the missing-column failure did not reproduce on INSERT';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
    IF v_message <> 'record "new" has no field "payment_method_brand"' THEN
      RAISE EXCEPTION 'drift fixture INSERT raised an unexpected error (%): %', v_state, v_message;
    END IF;
  END;

  -- So must an ordinary UPDATE that never mentions a billing column.
  BEGIN
    UPDATE public.profiles SET first_name = 'Drift' WHERE id = v_update_id;
    RAISE EXCEPTION 'drift fixture: an ordinary update was accepted';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
    IF v_message <> 'record "new" has no field "payment_method_brand"' THEN
      RAISE EXCEPTION 'drift fixture UPDATE raised an unexpected error (%): %', v_state, v_message;
    END IF;
  END;
END $$;

RESET ROLE;

ROLLBACK;
