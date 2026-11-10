-- Regression test: the Stripe webhook claim must stay single-active-claim and
-- token-fenced.
--
-- Background: stripe-webhook used to do a non-atomic SELECT + UPSERT against
-- stripe_webhook_events, so two concurrent Stripe deliveries could both process
-- the same event, and a slow worker could overwrite a newer claim's result.
-- 20261104000000_stripe_production_hardening.sql replaces that with a single
-- INSERT ... ON CONFLICT plus a per-claim token and a lease.
--
-- This test asserts the SQL guarantees directly; _shared/webhook-idempotency_test.ts
-- only covers how the Deno client maps outcomes. It fails if the functions are
-- ever weakened.
--
-- How to run: provision an isolated scratch PostgreSQL with the required
-- migrations already applied, verify DATABASE_URL points to that scratch instance
-- and never production, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_webhook_claim_fencing.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK, so it creates
-- no lasting state and is safe to re-run. It exits non-zero on the first failed
-- assertion.
--
-- Deliberately does NOT use pgTAP: the repo has no SQL test infrastructure and
-- this file should not be the reason to add one. Plain DO blocks with
-- RAISE EXCEPTION give a non-zero exit and a readable message.
--
-- Not covered here: two genuinely concurrent connections. The single-active
-- guarantee rests on ON CONFLICT serialising writers; exercise it by running two
-- psql sessions that claim the same event id inside open transactions.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. First delivery claims; a concurrent delivery sees in_flight; completion is
--    token-fenced; a processed event reports duplicate.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_outcome TEXT;
  v_token UUID;
  v_other UUID;
  v_status TEXT;
  v_stored_token UUID;
  v_lease TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_succeeded');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'first delivery: expected claimed, got %', v_outcome;
  END IF;
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'first delivery: a claim must carry a fencing token';
  END IF;

  -- Second delivery while the lease is live must not get a claim.
  SELECT outcome, token INTO v_outcome, v_other
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_succeeded');

  IF v_outcome <> 'in_flight' THEN
    RAISE EXCEPTION 'concurrent delivery: expected in_flight, got %', v_outcome;
  END IF;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'concurrent delivery: in_flight must not receive a token';
  END IF;

  -- A non-owner must not be able to complete the claim.
  IF public.complete_stripe_webhook_event(v_event, gen_random_uuid(), 'processed') THEN
    RAISE EXCEPTION 'stale token: completion must return false';
  END IF;

  SELECT status, claim_token, lease_expires_at
  INTO v_status, v_stored_token, v_lease
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_status <> 'processing' OR v_stored_token IS DISTINCT FROM v_token THEN
    RAISE EXCEPTION 'stale token: the active claim must be untouched (status=%, token changed=%)',
      v_status, v_stored_token IS DISTINCT FROM v_token;
  END IF;
  IF v_lease IS NULL OR v_lease <= NOW() THEN
    RAISE EXCEPTION 'first delivery: a live lease must be in the future, got %', v_lease;
  END IF;

  -- The owner can complete it.
  IF NOT public.complete_stripe_webhook_event(v_event, v_token, 'processed') THEN
    RAISE EXCEPTION 'owner completion: expected true';
  END IF;

  SELECT status, claim_token, lease_expires_at INTO v_status, v_stored_token, v_lease
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_status <> 'processed' THEN
    RAISE EXCEPTION 'owner completion: expected processed, got %', v_status;
  END IF;
  IF v_stored_token IS NOT NULL OR v_lease IS NOT NULL THEN
    RAISE EXCEPTION 'owner completion: claim token and lease must be cleared';
  END IF;

  -- A redelivery of a processed event is a duplicate, not new work.
  SELECT outcome INTO v_outcome
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_succeeded');
  IF v_outcome <> 'duplicate' THEN
    RAISE EXCEPTION 'redelivery after processing: expected duplicate, got %', v_outcome;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. A failed event is reclaimable immediately and the attempt counter advances.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_outcome TEXT;
  v_token UUID;
  v_second UUID;
  v_attempts INTEGER;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event(v_event, 'customer.subscription.updated');

  IF NOT public.complete_stripe_webhook_event(v_event, v_token, 'failed', 'boom') THEN
    RAISE EXCEPTION 'failed completion: expected true';
  END IF;

  SELECT outcome, token INTO v_outcome, v_second
  FROM public.claim_stripe_webhook_event(v_event, 'customer.subscription.updated');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'reclaim of failed event: expected claimed, got %', v_outcome;
  END IF;
  IF v_second IS NULL OR v_second = v_token THEN
    RAISE EXCEPTION 'reclaim of failed event: expected a new fencing token';
  END IF;

  SELECT attempts INTO v_attempts
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_attempts <> 2 THEN
    RAISE EXCEPTION 'reclaim of failed event: expected attempts=2, got %', v_attempts;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. An expired lease is reclaimable, and the previous owner is fenced out.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_old_token UUID;
  v_outcome TEXT;
  v_new_token UUID;
  v_status TEXT;
  v_stored_token UUID;
BEGIN
  SELECT token INTO v_old_token
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_failed');

  UPDATE public.stripe_webhook_events
  SET lease_expires_at = NOW() - INTERVAL '1 second'
  WHERE event_id = v_event;

  SELECT outcome, token INTO v_outcome, v_new_token
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_failed');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'expired lease: expected claimed, got %', v_outcome;
  END IF;
  IF v_new_token IS NULL OR v_new_token = v_old_token THEN
    RAISE EXCEPTION 'expired lease: expected a new fencing token';
  END IF;

  -- The slow original worker finishing late must not mark the new claim done.
  IF public.complete_stripe_webhook_event(v_event, v_old_token, 'processed') THEN
    RAISE EXCEPTION 'expired lease: the superseded token must not complete';
  END IF;

  SELECT status, claim_token INTO v_status, v_stored_token
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_status <> 'processing' OR v_stored_token IS DISTINCT FROM v_new_token THEN
    RAISE EXCEPTION 'expired lease: the new claim must survive the stale completion';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Repeated failures remain reclaimable, including an expired fifth lease.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_outcome TEXT;
  v_token UUID;
  i INTEGER;
  v_attempts INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    SELECT outcome, token INTO v_outcome, v_token
    FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_succeeded');

    IF v_outcome <> 'claimed' THEN
      RAISE EXCEPTION 'attempt %: expected claimed, got %', i, v_outcome;
    END IF;

    IF NOT public.complete_stripe_webhook_event(v_event, v_token, 'failed', 'boom') THEN
      RAISE EXCEPTION 'attempt %: expected failed completion to succeed', i;
    END IF;
  END LOOP;

  SELECT attempts INTO v_attempts
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_attempts <> 5 THEN
    RAISE EXCEPTION 'after five failures: expected attempts=5, got %', v_attempts;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' OR v_token IS NULL THEN
    RAISE EXCEPTION 'after five failures: expected claimed, got %', v_outcome;
  END IF;

  SELECT attempts INTO v_attempts
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_attempts <> 6 THEN
    RAISE EXCEPTION 'after five failures: expected attempts=6, got %', v_attempts;
  END IF;
END $$;

-- The fifth owner can crash; its expired lease must still be reclaimed.
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_outcome TEXT;
  v_token UUID;
  v_old_token UUID;
  v_attempts INTEGER;
  i INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    SELECT outcome, token INTO v_outcome, v_token
    FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_failed');
    IF v_outcome <> 'claimed' OR v_token IS NULL THEN
      RAISE EXCEPTION 'lease attempt %: expected claimed, got %', i, v_outcome;
    END IF;
    IF i < 5 AND NOT public.complete_stripe_webhook_event(v_event, v_token, 'failed', 'boom') THEN
      RAISE EXCEPTION 'lease attempt %: failed completion rejected', i;
    END IF;
  END LOOP;

  v_old_token := v_token;
  UPDATE public.stripe_webhook_events SET lease_expires_at = NOW() - INTERVAL '1 second'
  WHERE event_id = v_event;
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event(v_event, 'invoice.payment_failed');
  SELECT attempts INTO v_attempts FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_outcome <> 'claimed' OR v_token IS NULL OR v_token = v_old_token OR v_attempts <> 6 THEN
    RAISE EXCEPTION 'expired fifth lease: expected new sixth claim, got %, attempts %', v_outcome, v_attempts;
  END IF;
  IF public.complete_stripe_webhook_event(v_event, v_old_token, 'processed') THEN
    RAISE EXCEPTION 'expired fifth lease: old token must be fenced';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Bad inputs fail closed instead of writing a half-valid claim.
-- ---------------------------------------------------------------------------
-- Returns true only when the statement raises. Created in pg_temp so it is gone
-- with the transaction and never lands in the tracked schema.
CREATE FUNCTION pg_temp.test_raises(p_sql TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE p_sql;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$f$;

DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
BEGIN
  IF NOT pg_temp.test_raises(format(
    'SELECT public.claim_stripe_webhook_event(%L, %L, 0)', v_event, 'invoice.payment_succeeded')) THEN
    RAISE EXCEPTION 'lease validation: a zero-second lease must raise';
  END IF;

  IF NOT pg_temp.test_raises(format(
    'SELECT public.complete_stripe_webhook_event(%L, NULL, %L)', v_event, 'processed')) THEN
    RAISE EXCEPTION 'token validation: a null claim token must raise';
  END IF;

  IF NOT pg_temp.test_raises(format(
    'SELECT public.complete_stripe_webhook_event(%L, gen_random_uuid(), %L)',
    v_event, 'processing')) THEN
    RAISE EXCEPTION 'status validation: a non-terminal completion status must raise';
  END IF;

  -- A rejected call must not have created a row for the event.
  IF EXISTS (SELECT 1 FROM public.stripe_webhook_events WHERE event_id = v_event) THEN
    RAISE EXCEPTION 'input validation: a rejected call must not write an event row';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. The claim RPCs and the event table stay service-role only.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.claim_stripe_webhook_event(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges: anon must not execute claim_stripe_webhook_event';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_stripe_webhook_event(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges: authenticated must not execute claim_stripe_webhook_event';
  END IF;
  IF has_function_privilege('anon', 'public.complete_stripe_webhook_event(text,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges: anon must not execute complete_stripe_webhook_event';
  END IF;
  IF has_function_privilege('authenticated', 'public.complete_stripe_webhook_event(text,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges: authenticated must not execute complete_stripe_webhook_event';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.stripe_webhook_events', 'SELECT') THEN
    RAISE EXCEPTION 'privileges: service_role must retain access to stripe_webhook_events';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Distinct events created in the same second get a stable total order: the
-- higher event id is treated as newer, the lower one is stale, and replaying
-- the same event remains allowed. Nothing raises, so a same-second burst does
-- not retry forever.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_subscription TEXT := 'sub_test_' || gen_random_uuid()::text;
  v_created TIMESTAMPTZ := '2026-01-01 00:00:00+00';
BEGIN
  IF NOT public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_z', v_created) THEN
    RAISE EXCEPTION 'first event should be accepted';
  END IF;
  IF NOT public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_z', v_created) THEN
    RAISE EXCEPTION 'same-event retry should be accepted';
  END IF;
  IF public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_newer_id', v_created - INTERVAL '1 second') THEN
    RAISE EXCEPTION 'older timestamp should be rejected regardless of event id';
  END IF;
  IF NOT public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_zz', v_created) THEN
    RAISE EXCEPTION 'an equal-timestamp distinct event should be accepted in delivery order';
  END IF;
  IF NOT public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_a', v_created) THEN
    RAISE EXCEPTION 'event ids are opaque; a lower id in the same second is not stale';
  END IF;
  IF NOT public.assert_stripe_event_order(v_subscription, 'subscription', 'evt_a', v_created + INTERVAL '1 second') THEN
    RAISE EXCEPTION 'newer timestamp should be accepted regardless of event id';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. The fenced claim check renews a live lease and rejects an expired one.
-- A handler whose lease expires while it is still working cannot renew the
-- claim; a live claim is extended so a newer delivery cannot reclaim it
-- mid-flight.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_event TEXT := 'evt_test_' || gen_random_uuid()::text;
  v_old_token UUID;
  v_new_token UUID;
  v_outcome TEXT;
  v_lease_before TIMESTAMP WITH TIME ZONE;
  v_lease_after TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT token INTO v_old_token
  FROM public.claim_stripe_webhook_event(v_event, 'customer.subscription.updated');

  SELECT lease_expires_at INTO v_lease_before
  FROM public.stripe_webhook_events WHERE event_id = v_event;

  -- A live claim passes the fence, which renews the lease five minutes ahead.
  PERFORM public.assert_active_stripe_claim(v_event, v_old_token);

  SELECT lease_expires_at INTO v_lease_after
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_lease_after IS NULL OR v_lease_after <= v_lease_before THEN
    RAISE EXCEPTION 'live claim: the fenced check must renew the lease (% -> %)',
      v_lease_before, v_lease_after;
  END IF;

  -- The same handler finishes after its lease expired. It must not renew the
  -- claim, and the stored lease must stay expired.
  UPDATE public.stripe_webhook_events
  SET lease_expires_at = clock_timestamp() - INTERVAL '1 second'
  WHERE event_id = v_event;

  IF NOT pg_temp.test_raises(format(
    'SELECT public.assert_active_stripe_claim(%L, %L)', v_event, v_old_token)) THEN
    RAISE EXCEPTION 'expired lease: the fenced check must reject the expired owner';
  END IF;

  SELECT lease_expires_at INTO v_lease_after
  FROM public.stripe_webhook_events WHERE event_id = v_event;
  IF v_lease_after IS NULL OR v_lease_after > clock_timestamp() THEN
    RAISE EXCEPTION 'expired lease: a rejected check must not renew the lease';
  END IF;

  -- A newer delivery can then reclaim it, and the old token stays fenced out.
  SELECT outcome, token INTO v_outcome, v_new_token
  FROM public.claim_stripe_webhook_event(v_event, 'customer.subscription.updated');
  IF v_outcome <> 'claimed' OR v_new_token IS NULL OR v_new_token = v_old_token THEN
    RAISE EXCEPTION 'reclaim after expiry: expected a new claim with a new token, got %',
      v_outcome;
  END IF;

  IF NOT pg_temp.test_raises(format(
    'SELECT public.assert_active_stripe_claim(%L, %L)', v_event, v_old_token)) THEN
    RAISE EXCEPTION 'reclaim after expiry: the old token must stay fenced out';
  END IF;

  -- The new owner can renew its claim.
  PERFORM public.assert_active_stripe_claim(v_event, v_new_token);
END $$;

ROLLBACK;
