-- Seed users that existed before the restore, including one without preferences.
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
VALUES
  ('25100000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'billing-drift@example.invalid', '{}'::jsonb),
  ('25100000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'billing-saved@example.invalid', '{}'::jsonb);
DELETE FROM public.billing_preferences WHERE user_id = '25100000-0000-4000-8000-000000000011';
UPDATE public.billing_preferences SET billing_email_enabled = false, retry_interval_hours = 12
WHERE user_id = '25100000-0000-4000-8000-000000000012';
