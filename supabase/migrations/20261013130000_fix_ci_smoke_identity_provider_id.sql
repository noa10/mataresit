-- Migration: 20261013130000_fix_ci_smoke_identity_provider_id.sql
--
-- Corrects the identities row created by 20261013120000. On this GoTrue
-- version, identities.provider_id is the subject at the provider (for email
-- identities it is the user's own id — confirmed against pre-existing rows),
-- not the provider name. The wrong value made the password grant fail with
-- 500 "Database error querying schema".
--
-- Idempotent: only touches rows that still carry the bad value.

UPDATE auth.identities
SET provider_id = user_id::text
WHERE provider = 'email'
  AND provider_id = 'email';
