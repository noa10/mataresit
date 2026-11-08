-- Minimal Supabase-shaped bootstrap for the PR #234 billing SQL suites.
-- This is test infrastructure, not a production migration. It provides only
-- the roles, auth helpers, Vault surface, and pg_net extension that the
-- curated migration chain and suites require.
--
-- No credential value here is real: the Vault row is a placeholder and the
-- database is a disposable loopback container.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN;
  END IF;
END $$;

ALTER ROLE service_role BYPASSRLS;

GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA vault TO service_role;

-- Auth helper shims. Only created when the target has no implementation, so
-- running this against a real Supabase stack does not replace its auth helpers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
      );
    $function$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'role'
  ) THEN
    CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.role', true), ''),
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        'anon'
      );
    $function$;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  aud text,
  role text,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vault surface. A real Supabase stack exposes vault.decrypted_secrets as a
-- view over the Vault extension; this shim only fills in when nothing exists,
-- and never writes through a view it does not own.
DO $$
DECLARE
  existing "char";
BEGIN
  SELECT c.relkind INTO existing
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'vault' AND c.relname = 'decrypted_secrets';

  IF existing IS NULL THEN
    CREATE TABLE vault.decrypted_secrets (
      name text,
      decrypted_secret text
    );
    INSERT INTO vault.decrypted_secrets (name, decrypted_secret)
    VALUES ('service_role_key', 'pr234-local-placeholder-not-a-credential');
  ELSIF existing = 'r' THEN
    INSERT INTO vault.decrypted_secrets (name, decrypted_secret)
    SELECT 'service_role_key', 'pr234-local-placeholder-not-a-credential'
    WHERE NOT EXISTS (
      SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key'
    );
  ELSE
    RAISE NOTICE 'vault.decrypted_secrets exists as relkind %; leaving it untouched. Provision the service_role_key secret through Vault before running the suites.', existing;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pr234_verify_marker (id integer PRIMARY KEY);
INSERT INTO public.pr234_verify_marker (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
