-- The production profiles table gained email through unversioned drift.
-- 20250120000000's handle_new_user() inserts it, so the curated replay adds it
-- before that migration runs.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
