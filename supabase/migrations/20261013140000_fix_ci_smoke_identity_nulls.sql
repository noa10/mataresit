-- Migration: 20261013140000_fix_ci_smoke_identity_nulls.sql
--
-- 20261013120000 left the auth.users varchar token columns NULL, which GoTrue
-- rejects with 500 "Database error querying schema" on password grant
-- (https://supabase.com/docs/guides/troubleshooting/auth-error-500-database-error-querying-schema-eb6b44).
-- Normalizes them to empty strings, matching what signups produce.
--
-- 20261013120000 is amended to write '' directly for fresh environments; this
-- migration is the fix for environments where it already ran.
--
-- Idempotent: only touches rows that still carry NULLs.

UPDATE auth.users
SET confirmation_token         = '',
    recovery_token             = '',
    email_change               = '',
    email_change_token_new     = '',
    email_change_token_current = ''
WHERE email = 'ci-smoke@mataresit.com'
  AND (confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change IS NULL
    OR email_change_token_new IS NULL
    OR email_change_token_current IS NULL);
