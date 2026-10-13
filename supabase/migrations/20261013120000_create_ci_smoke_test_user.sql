-- Migration: 20261013120000_create_ci_smoke_test_user.sql
--
-- Dedicated CI account for the weekly receipt API smoke test, and rebinding of
-- the smoke-test API key to it.
--
-- The external API requires Authorization: Bearer <user session JWT> whose user
-- owns the X-API-Key (see supabase/functions/_shared/api-auth.ts
-- createApiContext: bearer user must equal key user; the frontend sends the
-- user session token — src/services/teamApiService.ts:55). The smoke test runs
-- in GitHub Actions with no browser session, so it obtains a token via the
-- password grant against this account.
--
-- Security posture:
--   * Only the bcrypt hash of the CI account password is committed here. The
--     raw password exists solely in the Production environment secret
--     TEST_CI_PASSWORD (rotatable: update the hash below + the secret together).
--   * The account is for CI only; it has no billing/Stripe linkage and the
--     smoke test deletes the receipt it creates.
--
-- Idempotent: user + identity inserts use ON CONFLICT DO NOTHING; the key
-- rebind is a no-op once bound.

DO $$
DECLARE
  v_ci_user_id uuid;
BEGIN
  SELECT id INTO v_ci_user_id FROM auth.users WHERE email = 'ci-smoke@mataresit.com';

  IF v_ci_user_id IS NULL THEN
    v_ci_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_ci_user_id,
      'authenticated',
      'authenticated',
      'ci-smoke@mataresit.com',
      '$2a$10$T5qSTj1DEs/U/puuN9oOIOIvCHCM9dTMOZUm3q94jUPjHif0zj.nC',
      now(), now(), now(),
      '', '', '', '', '',
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "CI Smoke Test", "source": "ci-smoke-test"}'::jsonb
    );

    SELECT id INTO v_ci_user_id FROM auth.users WHERE email = 'ci-smoke@mataresit.com';

    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    VALUES (
      v_ci_user_id,
      v_ci_user_id,
      v_ci_user_id::text,
      'email',
      jsonb_build_object('sub', v_ci_user_id::text, 'email', 'ci-smoke@mataresit.com', 'email_verified', true),
      now(), now(), now()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created CI smoke test user ci-smoke@mataresit.com (%)', v_ci_user_id;
  ELSE
    RAISE NOTICE 'CI smoke test user already exists (%)', v_ci_user_id;
  END IF;

  -- Bind the smoke-test API key (provisioned in 20261013110000) to the CI user
  -- so the Bearer JWT and the key share an owner.
  UPDATE public.api_keys
  SET user_id = v_ci_user_id
  WHERE key_prefix = 'mk_test_f013'
    AND user_id IS DISTINCT FROM v_ci_user_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'api_keys row for prefix mk_test_f013 was already bound to the CI user';
  END IF;

  -- Upload limits are enforced per tier via subscription_limits (seeded with
  -- free/pro/max rows); handle_new_user defaults new accounts to 'free', so
  -- nothing to seed here.
END $$;
