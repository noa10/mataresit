-- Behavioral regression coverage for the restored billing schema. Run only on
-- the disposable SQL regression database; fixtures are removed at the end.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES
  ('25100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'billing-a@example.invalid', '{}'::jsonb),
  ('25100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'billing-b@example.invalid', '{}'::jsonb);

UPDATE public.profiles SET first_name = 'Ada', last_name = 'Lovelace'
WHERE id = '25100000-0000-4000-8000-000000000001';
UPDATE public.billing_preferences SET retry_interval_hours = 12,
  quiet_hours_start = '20:15', quiet_hours_end = '06:45'
WHERE user_id = '25100000-0000-4000-8000-000000000001';
DELETE FROM public.billing_preferences WHERE user_id = '25100000-0000-4000-8000-000000000002';

-- A future reminder becomes due after this statement's transaction commits.
INSERT INTO public.billing_email_schedule (id, user_id, reminder_type, scheduled_for)
VALUES
  ('25100000-0000-4000-8000-000000000003', '25100000-0000-4000-8000-000000000001', 'upcoming_renewal', clock_timestamp() + interval '2 seconds'),
  ('25100000-0000-4000-8000-000000000004', '25100000-0000-4000-8000-000000000002', 'upcoming_renewal', clock_timestamp() + interval '2 seconds');
SELECT pg_sleep(2.2);

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '25100000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
DO $$
BEGIN
  IF (SELECT retry_interval_hours FROM public.get_my_billing_preferences()) IS DISTINCT FROM 12 OR
     (SELECT quiet_hours_start FROM public.get_my_billing_preferences()) IS DISTINCT FROM '20:15'::time OR
     (SELECT quiet_hours_end FROM public.get_my_billing_preferences()) IS DISTINCT FROM '06:45'::time THEN
    RAISE EXCEPTION 'authenticated user cannot read saved preferences and quiet hours';
  END IF;
  BEGIN
    PERFORM * FROM public.get_billing_preferences('25100000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'authenticated user accessed the service-only preferences RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM * FROM public.get_my_billing_preferences();
    RAISE EXCEPTION 'authenticated request without subject read preferences';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', '25100000-0000-4000-8000-000000000002', true);
  IF (SELECT retry_interval_hours FROM public.get_my_billing_preferences()) IS DISTINCT FROM 24 OR
     (SELECT quiet_hours_start FROM public.get_my_billing_preferences()) IS NOT NULL THEN
    RAISE EXCEPTION 'missing own preferences must return defaults without exposing another user';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
BEGIN
  IF (SELECT retry_interval_hours FROM public.get_billing_preferences('25100000-0000-4000-8000-000000000001')) <> 12 OR
     (SELECT retry_interval_hours FROM public.get_billing_preferences('25100000-0000-4000-8000-000000000002')) <> 24 THEN
    RAISE EXCEPTION 'service role must read saved preferences and defaults';
  END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  retry_id uuid;
  tracking_id uuid;
  reminder record;
BEGIN
  IF has_function_privilege('anon', 'public.get_my_billing_preferences()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_billing_preferences(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_billing_preferences(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'billing preferences RPC grants are too broad';
  END IF;
  IF has_function_privilege('authenticated', 'public.get_pending_billing_reminders()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_billing_reminder_sent(uuid,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated user can execute a service-only billing RPC';
  END IF;
  retry_id := public.create_payment_retry_tracking('25100000-0000-4000-8000-000000000001', 'sub_custom', 'invoice_custom', 100);
  IF (SELECT next_retry_at FROM public.payment_retry_tracking WHERE id = retry_id) IS DISTINCT FROM now() + interval '12 hours' THEN
    RAISE EXCEPTION 'configured retry interval must be honored';
  END IF;
  retry_id := public.create_payment_retry_tracking('25100000-0000-4000-8000-000000000002', 'sub_retry', 'invoice_retry', 100);
  IF (SELECT next_retry_at FROM public.payment_retry_tracking WHERE id = retry_id) IS DISTINCT FROM now() + interval '24 hours' THEN
    RAISE EXCEPTION 'missing preferences must schedule a retry in 24 hours';
  END IF;
  tracking_id := public.update_subscription_renewal_tracking('25100000-0000-4000-8000-000000000001', 'sub_audit', now(), now() + interval '30 days', 'pro'::public.subscription_tier, 'price_test', 'active');
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_audit_trail
    WHERE user_id = '25100000-0000-4000-8000-000000000001'
      AND event_type = 'subscription_renewal_tracking_updated'
      AND stripe_subscription_id = 'sub_audit'
      AND new_values @> jsonb_build_object('tracking_id', tracking_id, 'current_tier', 'pro', 'status', 'active')
  ) THEN
    RAISE EXCEPTION 'renewal tracking audit event missing';
  END IF;
  SELECT * INTO reminder FROM public.get_pending_billing_reminders()
  WHERE schedule_id = '25100000-0000-4000-8000-000000000003';
  IF reminder.user_name IS DISTINCT FROM 'Ada Lovelace' OR reminder.user_email IS DISTINCT FROM 'billing-a@example.invalid' THEN
    RAISE EXCEPTION 'pending reminder missing expected profile details';
  END IF;
  SELECT * INTO reminder FROM public.get_pending_billing_reminders()
  WHERE schedule_id = '25100000-0000-4000-8000-000000000004';
  IF reminder.user_name IS DISTINCT FROM 'billing-b@example.invalid' THEN
    RAISE EXCEPTION 'blank profile name must fall back to email';
  END IF;
  IF NOT public.mark_billing_reminder_sent('25100000-0000-4000-8000-000000000003', true) THEN
    RAISE EXCEPTION 'due reminder could not be marked sent';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_pending_billing_reminders() WHERE schedule_id = '25100000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'sent reminder remains pending';
  END IF;
  BEGIN
    INSERT INTO public.billing_email_schedule (user_id, reminder_type, scheduled_for)
    VALUES ('25100000-0000-4000-8000-000000000001', 'upcoming_renewal', now() - interval '1 second');
    RAISE EXCEPTION 'past reminder insertion was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.billing_email_schedule SET scheduled_for = now() - interval '1 second'
    WHERE id = '25100000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'rescheduling a reminder into the past was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.billing_email_schedule SET delivery_attempts = max_delivery_attempts + 1
    WHERE id = '25100000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'unrelated delivery attempts constraint was removed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;

DELETE FROM auth.users WHERE id IN ('25100000-0000-4000-8000-000000000001', '25100000-0000-4000-8000-000000000002');
