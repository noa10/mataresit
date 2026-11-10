-- Regression test: payment-state webhook writes must be claim-fenced, ordered,
-- and scoped to the current subscription.
--
-- Background: invoice.payment_succeeded, invoice.payment_failed, and
-- invoice.payment_action_required wrote profiles/payment_history directly, so
-- an expired webhook worker could still write billing state after a newer
-- delivery claimed the event. 20261106000000_stripe_checkout_locks_and_payment_fencing.sql
-- adds apply_fenced_stripe_payment_event, apply_fenced_renewal_failure, and
-- apply_fenced_profile_status. The Deno mapping is covered by
-- _shared/stripe-sync_test.ts; both together back the webhook handlers.
--
-- How to run: provision an isolated scratch PostgreSQL with the required
-- migrations already applied, verify DATABASE_URL points to that scratch
-- instance and never production, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/payment_state_fencing.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK.

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
VALUES ('00000000-0000-4000-8000-000000000012');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
SELECT id,
       'authenticated',
       'authenticated',
       'payment-fencing-' || id::text || '@example.invalid',
       '{}'::jsonb,
       clock_timestamp(),
       clock_timestamp()
FROM _test_users;

UPDATE public.profiles
SET stripe_customer_id = 'cus_test_fencing_1',
    stripe_subscription_id = 'sub_test_fencing_1',
    subscription_status = 'active',
    subscription_tier = 'pro',
    billing_interval = 'monthly',
    grace_period_end_date = clock_timestamp() + INTERVAL '1 day',
    payment_retry_attempts = 2
WHERE id = '00000000-0000-4000-8000-000000000012';

INSERT INTO public.billing_preferences (user_id)
VALUES ('00000000-0000-4000-8000-000000000012')
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. A successful payment records once, clears grace state, and advances the
--    payment event order; replaying the same event is idempotent.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000012';
  v_outcome TEXT;
  v_token UUID;
  v_created TIMESTAMP WITH TIME ZONE := clock_timestamp();
  v_payment TEXT;
  v_row_count INTEGER;
  v_status public.subscription_status;
  v_grace TIMESTAMP WITH TIME ZONE;
  v_retries INTEGER;
  v_last_event TEXT;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_payment_ok_1', 'invoice.payment_succeeded');

  IF v_outcome <> 'claimed' OR v_token IS NULL THEN
    RAISE EXCEPTION 'setup: expected a live claim, got %, %', v_outcome, v_token;
  END IF;

  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_payment_ok_1', v_token, v_created,
    'cus_test_fencing_1', 'sub_test_fencing_1',
    'pi_test_fencing_1', 4900, 'myr', 'pro',
    v_created - INTERVAL '30 days', v_created
  );

  IF v_payment <> 'applied' THEN
    RAISE EXCEPTION 'payment: expected applied, got %', v_payment;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM public.payment_history
  WHERE stripe_payment_intent_id = 'pi_test_fencing_1';

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'payment: expected one payment_history row, got %', v_row_count;
  END IF;

  SELECT subscription_status, grace_period_end_date, payment_retry_attempts
  INTO v_status, v_grace, v_retries
  FROM public.profiles
  WHERE id = v_user;

  IF v_status <> 'active' OR v_grace IS NOT NULL OR v_retries <> 0 THEN
    RAISE EXCEPTION 'payment: grace state was not cleared (status %, grace %, retries %)',
      v_status, v_grace, v_retries;
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_fencing_1'
    AND event_family = 'payment';

  IF v_last_event <> 'evt_payment_ok_1' THEN
    RAISE EXCEPTION 'payment: event order was not advanced, got %', v_last_event;
  END IF;

  -- Replay: same event, same claim. The payment row and profile state are
  -- idempotent and the call still reports 'applied'.
  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_payment_ok_1', v_token, v_created,
    'cus_test_fencing_1', 'sub_test_fencing_1',
    'pi_test_fencing_1', 4900, 'myr', 'pro',
    v_created - INTERVAL '30 days', v_created
  );

  IF v_payment <> 'applied' THEN
    RAISE EXCEPTION 'replay: expected applied, got %', v_payment;
  END IF;

  SELECT COUNT(*) INTO v_row_count
  FROM public.payment_history
  WHERE stripe_payment_intent_id = 'pi_test_fencing_1';

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'replay: expected one payment_history row after replay, got %', v_row_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. A superseded worker cannot record a payment: completing the claim and
--    reclaiming it invalidates the old token.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_outcome TEXT;
  v_old_token UUID;
  v_new_token UUID;
BEGIN
  SELECT outcome, token INTO v_outcome, v_old_token
  FROM public.claim_stripe_webhook_event('evt_payment_stale_1', 'invoice.payment_succeeded');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'stale setup: expected claimed, got %', v_outcome;
  END IF;

  IF NOT public.complete_stripe_webhook_event('evt_payment_stale_1', v_old_token, 'failed') THEN
    RAISE EXCEPTION 'stale setup: the owner must be able to fail its claim';
  END IF;

  SELECT outcome, token INTO v_outcome, v_new_token
  FROM public.claim_stripe_webhook_event('evt_payment_stale_1', 'invoice.payment_succeeded');

  IF v_outcome <> 'claimed' OR v_new_token = v_old_token THEN
    RAISE EXCEPTION 'stale setup: reclaim must produce a new token, got %, %', v_outcome, v_new_token;
  END IF;

  BEGIN
    PERFORM public.apply_fenced_stripe_payment_event(
      'evt_payment_stale_1', v_old_token, clock_timestamp(),
      'cus_test_fencing_1', 'sub_test_fencing_1',
      'pi_test_fencing_stale', 4900, 'myr', 'pro',
      clock_timestamp() - INTERVAL '30 days', clock_timestamp()
    );

    RAISE EXCEPTION 'stale worker: the write must be rejected';
  EXCEPTION
    WHEN serialization_failure THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM public.payment_history WHERE stripe_payment_intent_id = 'pi_test_fencing_stale'
  ) THEN
    RAISE EXCEPTION 'stale worker: no payment row may be written';
  END IF;
END $$;

-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. An out-of-order payment records its row but cannot change state; a one-off
--    payment records its row and never touches entitlement state.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_outcome TEXT;
  v_token UUID;
  v_last_created TIMESTAMP WITH TIME ZONE;
  v_last_event TEXT;
  v_status public.subscription_status;
  v_tier public.subscription_tier;
BEGIN
  SELECT stripe_event_created INTO v_last_created
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_fencing_1'
    AND event_family = 'payment';

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_payment_old_1', 'invoice.payment_succeeded');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'old event setup: expected claimed, got %', v_outcome;
  END IF;
  v_outcome := public.apply_fenced_stripe_payment_event(
    'evt_payment_old_1', v_token, v_last_created - INTERVAL '10 seconds',
    'cus_test_fencing_1', 'sub_test_fencing_1',
    'pi_test_fencing_old', 4900, 'myr', 'pro',
    v_last_created - INTERVAL '40 days', v_last_created - INTERVAL '10 days'
  );

  IF v_outcome <> 'recorded' THEN
  RAISE EXCEPTION 'old event: expected recorded, got %', v_outcome;
  END IF;

  -- The payment row IS recorded: money collected is a fact, and Stripe must
  -- not retry a completed fact forever.
  IF NOT EXISTS (SELECT 1 FROM public.payment_history WHERE stripe_payment_intent_id = 'pi_test_fencing_old') THEN
    RAISE EXCEPTION 'old event: the payment row must be recorded';
  END IF;

  -- No state change: the watermark stays on the newer event and the profile
  -- status is untouched.
  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_fencing_1'
    AND event_family = 'payment';

  IF v_last_event <> 'evt_payment_ok_1' THEN
    RAISE EXCEPTION 'old event: the watermark must stay on the newer event, got %', v_last_event;
  END IF;

  SELECT subscription_status, subscription_tier INTO v_status, v_tier
  FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000012';

  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION 'old event: profile status must be untouched, got %', v_status;
  END IF;

  -- A one-off invoice (no subscription) records its payment row and never
  -- touches entitlement state.
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_payment_oneoff_1', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'one-off setup: expected claimed, got %', v_outcome;
  END IF;
  v_outcome := public.apply_fenced_stripe_payment_event(
    'evt_payment_oneoff_1', v_token, clock_timestamp(),
    'cus_test_fencing_1', NULL,
    'pi_test_fencing_oneoff', 1990, 'myr', 'pro',
    NULL, NULL
  );

  IF v_outcome <> 'recorded' THEN
    RAISE EXCEPTION 'one-off: expected recorded, got %', v_outcome;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payment_history WHERE stripe_payment_intent_id = 'pi_test_fencing_oneoff') THEN
    RAISE EXCEPTION 'one-off: the payment row must be recorded';
  END IF;

  SELECT subscription_status, subscription_tier INTO v_status, v_tier
  FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000012';

  IF v_status IS NULL OR v_status <> 'active' OR v_tier IS NULL OR v_tier <> 'pro' THEN
    RAISE EXCEPTION 'one-off: entitlement state must be untouched, got % / %', v_status, v_tier;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Status fencing: an event for a superseded subscription cannot change the
--    current subscription's status; the current subscription can.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000012';
  v_outcome TEXT;
  v_token UUID;
  v_updated INTEGER;
  v_status public.subscription_status;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_status_superseded_1', 'invoice.payment_action_required');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'status setup: expected claimed, got %', v_outcome;
  END IF;

  v_updated := public.apply_fenced_profile_status(
    'evt_status_superseded_1', v_token, clock_timestamp(),
    'cus_test_fencing_1', 'sub_test_superseded_1', 'incomplete'
  );

  IF v_updated <> 0 THEN
    RAISE EXCEPTION 'superseded subscription: expected zero updates, got %', v_updated;
  END IF;

  SELECT subscription_status INTO v_status FROM public.profiles WHERE id = v_user;

  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION 'superseded subscription: status must stay active, got %', v_status;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_status_current_1', 'invoice.payment_action_required');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'status setup: expected claimed, got %', v_outcome;
  END IF;
  v_updated := public.apply_fenced_profile_status(
    'evt_status_current_1', v_token, clock_timestamp(),
    'cus_test_fencing_1', 'sub_test_fencing_1', 'incomplete'
  );

  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'current subscription: expected one update, got %', v_updated;
  END IF;

  SELECT subscription_status INTO v_status FROM public.profiles WHERE id = v_user;

  IF v_status IS NULL OR v_status <> 'incomplete' THEN
    RAISE EXCEPTION 'current subscription: expected incomplete, got %', v_status;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Renewal failures start the grace period only while the claim is live; an
--    older failure cannot overwrite a newer resolved payment; a repeat event
--    for the same invoice short-circuits instead of duplicating retry rows.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000012';
  v_outcome TEXT;
  v_token UUID;
  v_older_token UUID;
  v_rows INTEGER;
  v_attempts INTEGER;
  v_status public.subscription_status;
  v_grace TIMESTAMP WITH TIME ZONE;
  v_last_created TIMESTAMP WITH TIME ZONE;
  v_last_event TEXT;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_renewal_failure_1', 'invoice.payment_failed');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'renewal failure setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_failure(
    'evt_renewal_failure_1', v_token, clock_timestamp(), v_user,
    'sub_test_fencing_1', 'card declined', 'in_test_fencing_1'
  );

  SELECT subscription_status, grace_period_end_date INTO v_status, v_grace
  FROM public.profiles WHERE id = v_user;

  IF v_status IS NULL OR v_status <> 'past_due' OR v_grace IS NULL THEN
    RAISE EXCEPTION 'renewal failure: expected past_due with a grace period, got %, %',
      v_status, v_grace;
  END IF;

  -- An older failure event is acknowledged as stale and must not create retry
  -- tracking or extend the grace period the newer event produced.
  SELECT stripe_event_created, stripe_event_id
  INTO v_last_created, v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_fencing_1'
    AND event_family = 'payment';

  SELECT outcome, token INTO v_outcome, v_older_token
  FROM public.claim_stripe_webhook_event('evt_renewal_failure_old_1', 'invoice.payment_failed');

  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'old renewal failure setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_failure(
    'evt_renewal_failure_old_1', v_older_token,
    v_last_created - INTERVAL '10 seconds', v_user,
    'sub_test_fencing_1', 'card declined', 'in_test_fencing_old_1'
  );

  SELECT COUNT(*) INTO v_rows
  FROM public.payment_retry_tracking
  WHERE stripe_invoice_id = 'in_test_fencing_old_1';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'old renewal failure: no retry-tracking row may be written, got %', v_rows;
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_fencing_1'
    AND event_family = 'payment';
  IF v_last_event <> 'evt_renewal_failure_1' THEN
    RAISE EXCEPTION 'old renewal failure: the watermark must stay on the newer event, got %', v_last_event;
  END IF;

  -- A repeat failure event for the same invoice short-circuits instead of
  -- duplicating retry rows (handle_renewal_failure is not replay-safe on its
  -- own; the fence absorbs that).
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_renewal_failure_2', 'invoice.payment_failed');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'replay setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_failure(
    'evt_renewal_failure_2', v_token, clock_timestamp(), v_user,
    'sub_test_fencing_1', 'card declined again', 'in_test_fencing_1'
  );

  SELECT COUNT(*) INTO v_rows
  FROM public.payment_retry_tracking
  WHERE stripe_invoice_id = 'in_test_fencing_1';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'replay: expected one retry-tracking row, got %', v_rows;
  END IF;

  SELECT payment_retry_attempts INTO v_attempts
  FROM public.profiles WHERE id = v_user;
  IF v_attempts IS NULL OR v_attempts <> 1 THEN
    RAISE EXCEPTION 'replay: attempts must stay at 1 after the short-circuit, got %', v_attempts;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. End users cannot call the payment fencing RPCs directly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.apply_fenced_stripe_payment_event(text, uuid, timestamp with time zone, text, text, text, integer, text, public.subscription_tier, timestamp with time zone, timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must execute apply_fenced_stripe_payment_event';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.apply_fenced_profile_status(text, uuid, timestamp with time zone, text, text, public.subscription_status)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must not execute apply_fenced_profile_status';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.apply_fenced_renewal_failure(text, uuid, timestamp with time zone, uuid, text, text, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon must not execute apply_fenced_renewal_failure';
  END IF;

  IF has_function_privilege(
    'authenticated', 'public.increment_receipts_used(uuid, integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated must not execute increment_receipts_used';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.apply_fenced_renewal_tracking(text, uuid, timestamp with time zone, uuid, text, timestamp with time zone, timestamp with time zone, public.subscription_tier, text, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must execute apply_fenced_renewal_tracking';
  END IF;
END $$;

ROLLBACK;
