-- Regression test: per-user Checkout ownership must serialize checkout creation,
-- and the lock may never outlive the Checkout Session it protects.
--
-- Background: two concurrent create-checkout-session requests could create
-- duplicate Stripe customers and multiple completable Checkout Sessions for one
-- user. 20261106000000_stripe_checkout_locks_and_payment_fencing.sql adds
-- stripe_checkout_locks plus acquire/bind/release RPCs; the Deno side lives in
-- _shared/checkout-locks.ts and _shared/checkout-locks_test.ts.
--
-- How to run: provision an isolated scratch PostgreSQL with the required
-- migrations already applied, verify DATABASE_URL points to that scratch
-- instance and never production, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_checkout_locks.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK, so it
-- creates no lasting state and is safe to re-run. It exits non-zero on the
-- first failed assertion. Deliberately does NOT use pgTAP.
--
-- Not covered here: two genuinely concurrent connections. The single-owner
-- guarantee rests on the primary key plus INSERT ... ON CONFLICT serialising
-- writers; exercise it by running two psql sessions that acquire the same
-- user's lock inside open transactions.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'This test needs the Supabase auth schema (auth.users); never run it against production';
  END IF;
END $$;

CREATE TEMP TABLE _test_users (id UUID PRIMARY KEY);

INSERT INTO _test_users (id)
VALUES ('00000000-0000-4000-8000-000000000011');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
SELECT id,
       'authenticated',
       'authenticated',
       'checkout-lock-' || id::text || '@example.invalid',
       '{}'::jsonb,
       clock_timestamp(),
       clock_timestamp()
FROM _test_users;

-- ---------------------------------------------------------------------------
-- 1. One owner at a time; binding requires the owner's token; release is
--    scoped to the owner's token or the row bound to an exact session id.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _test_state (k TEXT PRIMARY KEY, token UUID);

DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000011';
  v_acquired BOOLEAN;
  v_session TEXT;
  v_token UUID;
  v_bound BOOLEAN;
BEGIN
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);

  IF NOT v_acquired OR v_session IS NOT NULL THEN
    RAISE EXCEPTION 'first acquire: expected acquired with no session, got %, %', v_acquired, v_session;
  END IF;

  INSERT INTO _test_state (k, token) VALUES ('s1', v_token);

  -- A second request while the first is still preparing must be told busy and
  -- must not receive a session to reuse yet.
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);

  IF v_acquired OR v_session IS NOT NULL OR v_token IS NOT NULL THEN
      RAISE EXCEPTION 'busy acquire: a busy response must never carry a token';
  END IF;

  -- Binding requires the owner's token.
  v_bound := public.bind_checkout_session(
    v_user, (SELECT token FROM _test_state WHERE k = 's1'), 'cs_test_lock_first', clock_timestamp() + INTERVAL '24 hours'
  );

  IF NOT v_bound THEN
    RAISE EXCEPTION 'bind: a live pre-bind lock must accept the owner''s token';
  END IF;

  -- A bound lock must not accept a second session, even from its own owner.
  IF public.bind_checkout_session(
    v_user, (SELECT token FROM _test_state WHERE k = 's1'), 'cs_test_lock_second', clock_timestamp() + INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'rebind: a bound lock must not accept a second session';
  END IF;

  -- A later request is handed the bound session id so it can reuse the open
  -- Checkout Session instead of creating another one.
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);

  IF v_acquired OR v_session <> 'cs_test_lock_first' THEN
    RAISE EXCEPTION 'bound acquire: expected busy with the bound session, got %, %', v_acquired, v_session;
  END IF;

  -- A stale token cannot bind: only the row carrying the token matches.
  PERFORM public.release_checkout_lock(v_user, NULL, (SELECT token FROM _test_state WHERE k = 's1'));

  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);
  INSERT INTO _test_state (k, token) VALUES ('s2', v_token);

  IF NOT v_acquired THEN
    RAISE EXCEPTION 'reacquire: the lock must be free after the owner release';
  END IF;

  IF public.bind_checkout_session(
    v_user, (SELECT token FROM _test_state WHERE k = 's1'), 'cs_test_lock_stale', clock_timestamp() + INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'stale bind: an old token must not bind the new lock';
  END IF;

  -- Binding with the fresh token must succeed.
  v_bound := public.bind_checkout_session(
    v_user, (SELECT token FROM _test_state WHERE k = 's2'), 'cs_test_lock_first', clock_timestamp() + INTERVAL '24 hours'
  );
  IF NOT v_bound THEN
    RAISE EXCEPTION 'fresh bind: the new token must bind the new lock';
  END IF;

  -- Releasing with a different session id must not free the bound lock.
  IF public.release_checkout_lock(v_user, 'cs_test_lock_other') THEN
    RAISE EXCEPTION 'foreign release: must not free another session''s lock';
  END IF;

  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);

  IF v_acquired OR v_session <> 'cs_test_lock_first' THEN
    RAISE EXCEPTION 'foreign release: the bound lock must survive, got %, %', v_acquired, v_session;
  END IF;

  -- The completion webhook releases by the exact bound session id.
  IF NOT public.release_checkout_lock(v_user, 'cs_test_lock_first') THEN
    RAISE EXCEPTION 'session release: the bound session must release its own lock';
  END IF;

  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);
  INSERT INTO _test_state (k, token) VALUES ('s1_end', v_token);
  IF NOT v_acquired THEN
    RAISE EXCEPTION 'after release: the next checkout must acquire the lock';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Expiry: an expired lock is stealable; a dead token cannot free a lock
--    that a newer acquisition now owns.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000011';
  v_acquired BOOLEAN;
  v_session TEXT;
  v_token UUID;
BEGIN
  -- Section 1 left an unbound lock; the owner releases it by its token.
  IF NOT public.release_checkout_lock(v_user, NULL, (SELECT token FROM _test_state WHERE k = 's1_end')) THEN
    RAISE EXCEPTION 'pre-expiry release: the owner token must free the unbound lock';
  END IF;

  -- Acquire with a 1s TTL and let it expire.
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 1);
  IF NOT v_acquired THEN
    RAISE EXCEPTION 'short lease: a free lock must be acquired';
  END IF;

  PERFORM pg_sleep(1.2);

  -- The expired row is stealable; the steal returns a fresh token.
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);
  IF NOT v_acquired THEN
    RAISE EXCEPTION 'expiry: an expired lock must be stealable';
  END IF;
  INSERT INTO _test_state (k, token) VALUES ('s2_lock', v_token);

  -- Binding with the new owner's token must succeed.
  IF NOT public.bind_checkout_session(
    v_user, (SELECT token FROM _test_state WHERE k = 's2_lock'), 'cs_test_lock_rebound', clock_timestamp() + INTERVAL '1 hour'
  ) THEN
    RAISE EXCEPTION 'expiry: the stolen lock must accept a session';
  END IF;

  -- A dead token from an earlier acquisition cannot free the bound lock.
  IF public.release_checkout_lock(v_user, NULL, (SELECT token FROM _test_state WHERE k = 's1')) THEN
    RAISE EXCEPTION 'dead-token release: must not free a newer lock';
  END IF;

  -- The bound lock survives and still reports its session.
  SELECT acquired, session_id, lock_token INTO v_acquired, v_session, v_token
  FROM public.try_acquire_checkout_lock(v_user, 900);

  IF v_acquired OR v_session <> 'cs_test_lock_rebound' THEN
    RAISE EXCEPTION 'dead-token release: the bound lock must survive, got %, %', v_acquired, v_session;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. End users cannot call the lock lifecycle RPCs directly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT has_function_privilege(
    'service_role', 'public.try_acquire_checkout_lock(uuid, integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must execute try_acquire_checkout_lock';
  END IF;

  IF has_function_privilege(
    'authenticated', 'public.try_acquire_checkout_lock(uuid, integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must not execute try_acquire_checkout_lock';
  END IF;

  IF has_function_privilege(
    'anon', 'public.bind_checkout_session(uuid, uuid, text, timestamp with time zone)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon must not execute bind_checkout_session';
  END IF;

  IF has_table_privilege('authenticated', 'public.stripe_checkout_locks', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must not read the checkout lock table';
  END IF;
END $$;

ROLLBACK;
