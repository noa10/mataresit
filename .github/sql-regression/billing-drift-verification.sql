-- Verify the restore backfills missing rows without overwriting saved settings.
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
END $$;

DELETE FROM auth.users WHERE id IN ('25100000-0000-4000-8000-000000000011', '25100000-0000-4000-8000-000000000012');
