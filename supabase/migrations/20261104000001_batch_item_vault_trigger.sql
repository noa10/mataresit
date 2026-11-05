-- Batch item dispatch: read the service-role credential from Vault instead of a
-- hardcoded literal, and stop hardcoding the production project URL.
--
-- Why this is separate from 20261104000000_stripe_production_hardening.sql:
-- it changes batch processing, not billing, and it needs its own nonproduction
-- verification because a misconfigured URL or a missing Vault secret makes batch
-- inserts fail (or, worse, sends a privileged request to the wrong project).
--
-- Prerequisites before applying:
--   1. Exactly one Vault secret named 'service_role_key'. Check the count;
--      never log or commit its value.
--   2. Plan a maintenance window: after this migration, an administrator must
--      configure public.batch_item_dispatch_config before batch inserts resume.
--      The URL must point at the current environment's project.
--   3. pg_net for net.http_post; this migration enables it if absent.
--   4. This migration deliberately does NOT create a trigger. No CREATE TRIGGER
--      referencing handle_new_batch_item exists anywhere in this repository, so
--      the attachment - if any - is unversioned drift established outside
--      migrations. The function body is replaced in place. It returns NEW, so
--      a BEFORE trigger no longer cancels the row (RETURN NULL would) and an
--      AFTER trigger ignores the return value. Confirm attachment and timing on
--      a nonproduction database before applying, because timing still decides
--      whether dispatch is enqueued before or after commit.
--
-- No credential values appear in this file.

BEGIN;

-- pg_net provides net.http_post. The tracked schema dump shows it installed in
-- the extensions schema, but no migration ever declared it; create it here and
-- abort loudly if it is unavailable, rather than letting CREATE FUNCTION succeed
-- and fail at trigger time.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'pg_net is unavailable and could not be enabled: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Refuse to apply until this environment has exactly one Vault credential.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM vault.decrypted_secrets WHERE name = 'service_role_key') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one service_role_key Vault secret';
  END IF;
END;
$$;

-- Only trusted database administrators may configure the credential destination.
-- No application role, including service_role, can read or modify it.
CREATE TABLE public.batch_item_dispatch_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  endpoint_url text NOT NULL CHECK (
    endpoint_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/functions/v1/process-batch-item$'
  )
);
ALTER TABLE public.batch_item_dispatch_config OWNER TO postgres;
ALTER TABLE public.batch_item_dispatch_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.batch_item_dispatch_config FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_batch_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_service_key TEXT;
  v_batch_url TEXT;
BEGIN
  SELECT decrypted_secret
  INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE EXCEPTION 'Missing Vault secret service_role_key';
  END IF;

  SELECT endpoint_url INTO v_batch_url
  FROM public.batch_item_dispatch_config
  WHERE singleton;

  IF v_batch_url IS NULL THEN
    RAISE EXCEPTION 'Missing administrator-configured batch item endpoint';
  END IF;

  -- net.http_post enqueues asynchronously; an enqueue is not proof of delivery.
  PERFORM net.http_post(
    url := v_batch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('batch_item_id', NEW.id::text),
    timeout_milliseconds := 5000
  );

  -- Return NEW, not NULL: a row-level BEFORE trigger treats NULL as "cancel
  -- this row", while an AFTER trigger ignores the return value. Returning NEW
  -- keeps inserts working under either timing.
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_batch_item() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_batch_item() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
