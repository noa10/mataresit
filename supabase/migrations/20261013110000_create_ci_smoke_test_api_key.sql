-- Migration: 20261013110000_create_ci_smoke_test_api_key.sql
--
-- Provisions the mk_test_ API key used by the "Weekly Receipt API Smoke Test"
-- workflow (.github/workflows/weekly-receipt-smoke-test.yml).
--
-- Normally this is done by scripts/create-test-api-keys.js, but the local
-- VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION in .env.local is stale (the key was
-- rotated on the platform), so the provisioning is done through the sanctioned
-- migration path instead.
--
-- Only the SHA-256 hash and the 12-character key prefix are stored here —
-- exactly what the application validates against (api_keys.key_hash, see
-- supabase/functions/_shared/api-auth.ts). The RAW key exists only in the
-- TEST_API_KEY secret on the repository's Production environment. If it is
-- ever lost: set is_active = false on this row and re-issue with a new prefix.
--
-- Bound to the project owner account (earliest auth.users row) because the
-- smoke test creates and immediately deletes one receipt under that account.
-- Reassign user_id to a dedicated account if you prefer isolation.
--
-- Idempotent: skipped when the key prefix already exists.

DO $$
DECLARE
  v_user_id uuid;
  v_key_prefix text := 'mk_test_f013';
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth users found; create an account before provisioning the smoke test key';
  END IF;

  IF EXISTS (SELECT 1 FROM public.api_keys WHERE key_prefix = v_key_prefix) THEN
    RAISE NOTICE 'CI smoke test key (%) already provisioned — skipping', v_key_prefix;
    RETURN;
  END IF;

  INSERT INTO public.api_keys (user_id, name, description, key_hash, key_prefix, scopes, is_active, created_by)
  VALUES (
    v_user_id,
    'CI Smoke Test Key',
    'Weekly receipt API smoke test — created via migration 20261013110000',
    'ee62d3316bc9c8a4e231fd08296fc19bff2640160b203488034e06856b396132',
    v_key_prefix,
    ARRAY['receipts:read', 'receipts:write', 'receipts:delete']::api_scope[],
    true,
    v_user_id
  );

  RAISE NOTICE 'Provisioned smoke test key % for user %', v_key_prefix, v_user_id;
END $$;
