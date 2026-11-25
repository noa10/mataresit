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

-- Simulate hosted's type drift. Production never created the billing enums, so
-- these columns are plain varchar there and the type names do not resolve. The
-- restore migration must work without them; casting to them is a hard failure.
-- The partial index carries an enum-typed predicate, and hosted's index is not
-- partial, so replace it the way production has it before converting the column.
DROP INDEX IF EXISTS public.idx_billing_email_schedule_scheduled_for;
ALTER TABLE public.billing_email_schedule
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE VARCHAR(64) USING status::TEXT,
  ALTER COLUMN reminder_type TYPE VARCHAR(64) USING reminder_type::TEXT;
ALTER TABLE public.billing_preferences
  ALTER COLUMN auto_renewal_frequency DROP DEFAULT,
  ALTER COLUMN auto_renewal_frequency TYPE VARCHAR(32) USING auto_renewal_frequency::TEXT;
ALTER TABLE public.profiles
  ALTER COLUMN auto_renewal_frequency DROP DEFAULT,
  ALTER COLUMN auto_renewal_frequency TYPE VARCHAR(32) USING auto_renewal_frequency::TEXT;
DROP TYPE IF EXISTS public.billing_reminder_type CASCADE;
DROP TYPE IF EXISTS public.billing_email_status CASCADE;
DROP TYPE IF EXISTS public.auto_renewal_frequency CASCADE;
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_scheduled_for
  ON public.billing_email_schedule (scheduled_for);
-- Hosted defaults the column to a value no reader uses; keep that shape so the
-- restore has to put the declared default back.
ALTER TABLE public.billing_email_schedule
  ALTER COLUMN status SET DEFAULT 'pending';

-- Column drift the restore must repair before it can reference these columns.
ALTER TABLE public.billing_email_schedule DROP COLUMN IF EXISTS failed_at;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS next_billing_date,
  DROP COLUMN IF EXISTS grace_period_end_date,
  DROP COLUMN IF EXISTS last_payment_attempt,
  DROP COLUMN IF EXISTS payment_retry_attempts,
  DROP COLUMN IF EXISTS auto_renewal_enabled,
  DROP COLUMN IF EXISTS auto_renewal_frequency,
  DROP COLUMN IF EXISTS billing_email_enabled,
  DROP COLUMN IF EXISTS billing_address,
  DROP COLUMN IF EXISTS payment_method_brand,
  DROP COLUMN IF EXISTS payment_method_last_four;
ALTER TABLE public.payment_retry_tracking
  DROP COLUMN IF EXISTS amount_cents,
  DROP COLUMN IF EXISTS currency;
ALTER TABLE public.subscription_renewal_tracking
  RENAME COLUMN auto_renewal_processed_at TO renewal_processed_at;

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
