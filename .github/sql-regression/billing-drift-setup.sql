-- Seed users that existed before the restore, including one without preferences.
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES
  ('25100000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'billing-drift@example.invalid', '{}'::jsonb),
  ('25100000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'billing-saved@example.invalid', '{}'::jsonb);
DELETE FROM public.billing_preferences WHERE user_id = '25100000-0000-4000-8000-000000000011';
UPDATE public.billing_preferences SET billing_email_enabled = false, retry_interval_hours = 12
WHERE user_id = '25100000-0000-4000-8000-000000000012';

-- Simulate a hosted constraint whose name and expression differ from the
-- checked-in migration. The restore must remove this equivalent form too.
ALTER TABLE public.billing_email_schedule
  DROP CONSTRAINT IF EXISTS billing_email_schedule_scheduled_for_check;
ALTER TABLE public.billing_email_schedule
  DROP CONSTRAINT IF EXISTS billing_email_schedule_due_time_custom;
ALTER TABLE public.billing_email_schedule
  ADD CONSTRAINT billing_email_schedule_due_time_custom
  CHECK (scheduled_for > (CURRENT_TIMESTAMP - interval '0 seconds'));

-- Becomes due while the restore and verification run.
INSERT INTO public.billing_email_schedule (
  id, user_id, reminder_type, scheduled_for, max_delivery_attempts
)
VALUES (
  '25100000-0000-4000-8000-000000000013',
  '25100000-0000-4000-8000-000000000011',
  'upcoming_renewal',
  clock_timestamp() + interval '2 seconds',
  2
)
ON CONFLICT (id) DO NOTHING;
