-- Verify the restore backfills missing rows without overwriting saved settings.
-- Sleep before the DO block: now() is fixed at transaction start inside it.
SELECT pg_sleep(2.2);
DO $$
DECLARE
  scheduled_id uuid;
  batch_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_preferences
    WHERE user_id = '25100000-0000-4000-8000-000000000011'
      AND billing_email_enabled AND retry_interval_hours = 24
  ) THEN
    RAISE EXCEPTION 'restore did not backfill missing billing preferences';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_preferences
    WHERE user_id = '25100000-0000-4000-8000-000000000012'
      AND NOT billing_email_enabled AND retry_interval_hours = 12
  ) THEN
    RAISE EXCEPTION 'restore overwrote existing billing preferences';
  END IF;

  scheduled_id := public.schedule_billing_reminder(
    '25100000-0000-4000-8000-000000000011', 'sub_single', 'upcoming_renewal', now() + interval '1 day'
  );
  IF scheduled_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.billing_email_schedule WHERE id = scheduled_id AND subscription_id = 'sub_single'
  ) THEN
    RAISE EXCEPTION 'single reminder was not scheduled for backfilled user';
  END IF;
  batch_result := public.schedule_multiple_billing_reminders(ARRAY[
    jsonb_build_object('user_id', '25100000-0000-4000-8000-000000000011', 'subscription_id', 'sub_batch', 'reminder_type', 'upcoming_renewal', 'scheduled_for', now() + interval '1 day'),
    jsonb_build_object('user_id', '25100000-0000-4000-8000-000000000012', 'subscription_id', 'sub_disabled', 'reminder_type', 'upcoming_renewal', 'scheduled_for', now() + interval '1 day')
  ]);
  IF (batch_result->>'scheduled')::integer IS DISTINCT FROM 1 OR
     (batch_result->>'errors')::integer IS DISTINCT FROM 0 OR
     NOT EXISTS (SELECT 1 FROM public.billing_email_schedule WHERE subscription_id = 'sub_batch') OR
     EXISTS (SELECT 1 FROM public.billing_email_schedule WHERE subscription_id = 'sub_disabled') THEN
    RAISE EXCEPTION 'batch scheduling did not respect backfilled and saved preferences: %', batch_result;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_email_schedule'::regclass
      AND contype = 'c'
      AND pg_get_expr(conbin, conrelid) ~* 'scheduled_for'
      AND pg_get_expr(conbin, conrelid) ~* '(now[[:space:]]*\(|current_timestamp|transaction_timestamp[[:space:]]*\(|statement_timestamp[[:space:]]*\(|clock_timestamp[[:space:]]*\()'
  ) THEN
    RAISE EXCEPTION 'time-dependent billing schedule constraint survived the restore';
  END IF;

  IF NOT public.mark_billing_reminder_sent(
    '25100000-0000-4000-8000-000000000013', false, 'smtp down'
  ) THEN
    RAISE EXCEPTION 'failed delivery was not recorded after the restore';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_email_schedule
    WHERE id = '25100000-0000-4000-8000-000000000013'
      AND status = 'scheduled'::public.billing_email_status
      AND delivery_attempts = 1
      AND error_message = 'smtp down'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.get_pending_billing_reminders()
    WHERE schedule_id = '25100000-0000-4000-8000-000000000013'
  ) THEN
    RAISE EXCEPTION 'retryable delivery failure must stay scheduled after the restore';
  END IF;
  IF NOT public.mark_billing_reminder_sent(
    '25100000-0000-4000-8000-000000000013', false, 'smtp down again'
  ) THEN
    RAISE EXCEPTION 'final failed delivery was not recorded after the restore';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_email_schedule
    WHERE id = '25100000-0000-4000-8000-000000000013'
      AND status = 'failed'::public.billing_email_status
      AND delivery_attempts = 2
      AND failed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.get_pending_billing_reminders()
    WHERE schedule_id = '25100000-0000-4000-8000-000000000013'
  ) THEN
    RAISE EXCEPTION 'exhausted delivery failure must become terminal after the restore';
  END IF;
END $$;

DELETE FROM auth.users WHERE id IN ('25100000-0000-4000-8000-000000000011', '25100000-0000-4000-8000-000000000012');
