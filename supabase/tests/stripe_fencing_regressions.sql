-- Regression test: Stripe fencing regressions.
--
-- Covers the production-readiness defects left after
-- 20261106000000_stripe_checkout_locks_and_payment_fencing.sql:
--
--  1. Distinct events created in the same second report ambiguity instead of
--     picking a lexical event-id winner; a reconciled apply with a current
--     timestamp advances the watermark.
--  2. A delayed event for a superseded subscription must not overwrite the
--     profile's current subscription binding.
--  3. A payment for a superseded subscription is recorded but cannot advance
--     entitlement state or close another subscription's retry tracking.
--  4. Renewal failure and renewal tracking writes must be scoped to the
--     profile's current subscription.
--  5. stripe_payment_method_id is a protected billing column.
--
-- How to run: provision an isolated scratch PostgreSQL with the required
-- migrations already applied, verify DATABASE_URL points to that scratch
-- instance and never production, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_fencing_regressions.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK.

\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'This test needs the Supabase auth schema (auth.users, auth.role(), auth.uid()); never run it against production';
  END IF;

  IF to_regprocedure('public.apply_fenced_stripe_subscription_event(text, uuid, timestamp with time zone, text, text, public.subscription_tier, public.subscription_status, timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean, text, boolean)') IS NULL THEN
    RAISE EXCEPTION 'Missing apply_fenced_stripe_subscription_event; apply the billing migrations first';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'stripe_payment_method_id'
  ) THEN
    RAISE EXCEPTION 'Missing profiles.stripe_payment_method_id; apply 20261110010000_stripe_fencing_regressions.sql first';
  END IF;
END $$;

CREATE TEMP TABLE _test_users (id UUID PRIMARY KEY);

INSERT INTO _test_users (id)
VALUES
  ('00000000-0000-4000-8000-000000000013'),
  ('00000000-0000-4000-8000-000000000014');

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
SELECT id,
       'authenticated',
       'authenticated',
       'stripe-fencing-regression-' || id::text || '@example.invalid',
       '{}'::jsonb,
       clock_timestamp(),
       clock_timestamp()
FROM _test_users;

UPDATE public.profiles
SET stripe_customer_id = 'cus_test_reg_1',
    stripe_subscription_id = 'sub_test_reg_current',
    subscription_status = 'active',
    subscription_tier = 'pro',
    billing_interval = 'monthly',
    cancel_at_period_end = true,
    next_billing_date = '2026-12-01 00:00:00+00'
WHERE id = '00000000-0000-4000-8000-000000000013';

INSERT INTO public.billing_preferences (user_id)
VALUES ('00000000-0000-4000-8000-000000000013')
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Distinct same-second events report -2 instead of trusting lexical event
--    ids. The caller re-reads Stripe and re-applies with a current timestamp;
--    replaying the same event stays accepted; the original timestamp is stale
--    afterwards.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000013';
  v_customer TEXT := 'cus_test_reg_1';
  v_subscription TEXT := 'sub_test_reg_current';
  v_outcome TEXT;
  v_token UUID;
  v_token_b UUID;
  v_created TIMESTAMP WITH TIME ZONE := clock_timestamp();
  v_applied INTEGER;
  v_tier public.subscription_tier;
  v_status public.subscription_status;
  v_last_event TEXT;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_same_a', 'customer.subscription.updated');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'same-second setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_same_a', v_token, v_created,
    v_customer, v_subscription, 'pro', 'active',
    v_created - INTERVAL '30 days', v_created + INTERVAL '30 days',
    NULL, true, 'monthly'
  );
  IF v_applied <> 1 THEN
    RAISE EXCEPTION 'same-second first event: expected 1, got %', v_applied;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token_b
  FROM public.claim_stripe_webhook_event('evt_reg_same_b', 'customer.subscription.updated');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'same-second setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_same_b', v_token_b, v_created,
    v_customer, v_subscription, 'max', 'active',
    v_created - INTERVAL '30 days', v_created + INTERVAL '30 days',
    NULL, true, 'monthly'
  );
  IF v_applied <> -2 THEN
    RAISE EXCEPTION 'same-second distinct event: expected -2 (ambiguous), got %', v_applied;
  END IF;

  SELECT subscription_tier, subscription_status INTO v_tier, v_status
  FROM public.profiles WHERE id = v_user;
  IF v_tier <> 'pro' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'same-second ambiguous event: profile changed unexpectedly (%, %)', v_tier, v_status;
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = v_subscription
    AND event_family = 'subscription';
  IF v_last_event <> 'evt_reg_same_a' THEN
    RAISE EXCEPTION 'same-second ambiguity: watermark must stay on evt_reg_same_a, got %', v_last_event;
  END IF;

  -- Replaying the applied event is still idempotent.
  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_same_a', v_token, v_created,
    v_customer, v_subscription, 'pro', 'active',
    v_created - INTERVAL '30 days', v_created + INTERVAL '30 days',
    NULL, true, 'monthly'
  );
  IF v_applied <> 1 THEN
    RAISE EXCEPTION 'same-second replay: expected 1, got %', v_applied;
  END IF;

  -- The webhook reconciles by re-reading Stripe and applying with a current
  -- timestamp; that snapshot wins over the ambiguous delivery.
  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_same_b', v_token_b, v_created + INTERVAL '1 second',
    v_customer, v_subscription, 'max', 'active',
    v_created - INTERVAL '30 days', v_created + INTERVAL '30 days',
    NULL, true, 'monthly'
  );
  IF v_applied <> 1 THEN
    RAISE EXCEPTION 'same-second reconciled apply: expected 1, got %', v_applied;
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = v_subscription
    AND event_family = 'subscription';
  IF v_last_event <> 'evt_reg_same_b' THEN
    RAISE EXCEPTION 'same-second reconciliation: watermark must move to evt_reg_same_b, got %', v_last_event;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_same_0', 'customer.subscription.updated');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'same-second setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_same_0', v_token, v_created,
    v_customer, v_subscription, 'pro', 'active',
    v_created - INTERVAL '30 days', v_created + INTERVAL '30 days',
    NULL, true, 'monthly'
  );
  IF v_applied <> -1 THEN
    RAISE EXCEPTION 'same-second stale event: expected -1, got %', v_applied;
  END IF;

  SELECT subscription_tier, subscription_status INTO v_tier, v_status
  FROM public.profiles WHERE id = v_user;
  IF v_tier <> 'max' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'same-second stale event: profile changed unexpectedly (%, %)', v_tier, v_status;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. A subscription event may bind an unbound profile, but it cannot replace
--    the profile's current subscription. An unknown customer returns 0.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000013';
  v_customer TEXT := 'cus_test_reg_1';
  v_outcome TEXT;
  v_token UUID;
  v_applied INTEGER;
  v_bound_subscription TEXT;
  v_tier public.subscription_tier;
  v_status public.subscription_status;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_old_sub', 'customer.subscription.updated');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'superseded subscription setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_old_sub', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_old', 'max', 'past_due',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp() + INTERVAL '30 days',
    NULL, false, 'monthly'
  );
  IF v_applied <> -1 THEN
    RAISE EXCEPTION 'superseded subscription: expected -1 (skipped), got %', v_applied;
  END IF;

  SELECT stripe_subscription_id, subscription_tier, subscription_status
  INTO v_bound_subscription, v_tier, v_status
  FROM public.profiles WHERE id = v_user;
  IF v_bound_subscription <> 'sub_test_reg_current' OR v_tier <> 'max' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'superseded subscription: profile was overwritten (%, %, %)',
      v_bound_subscription, v_tier, v_status;
  END IF;

  -- An unbound profile is the normal first-subscription case and must bind.
  UPDATE public.profiles
  SET stripe_subscription_id = NULL,
      subscription_tier = 'free',
      subscription_status = 'active'
  WHERE id = v_user;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_new_sub', 'customer.subscription.created');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'unbound subscription setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_new_sub', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_new', 'pro', 'active',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp() + INTERVAL '30 days',
    NULL, false, 'monthly'
  );
  IF v_applied <> 1 THEN
    RAISE EXCEPTION 'unbound subscription: expected 1, got %', v_applied;
  END IF;

  SELECT stripe_subscription_id INTO v_bound_subscription
  FROM public.profiles WHERE id = v_user;
  IF v_bound_subscription <> 'sub_test_reg_new' THEN
    RAISE EXCEPTION 'unbound subscription: expected sub_test_reg_new, got %', v_bound_subscription;
  END IF;

  -- A canceled profile stays bound to its canceled subscription unless the
  -- caller marks the event as an authorized rebind (cancel-then-resubscribe).
  UPDATE public.profiles
  SET subscription_status = 'canceled'
  WHERE id = v_user;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_rebind_blocked', 'customer.subscription.updated');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'blocked rebind setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_rebind_blocked', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_rebound', 'max', 'active',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp() + INTERVAL '30 days',
    NULL, false, 'monthly'
  );
  IF v_applied <> -1 THEN
    RAISE EXCEPTION 'blocked rebind: expected -1, got %', v_applied;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_rebind', 'customer.subscription.created');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'authorized rebind setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_rebind', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_rebound', 'max', 'active',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp() + INTERVAL '30 days',
    NULL, false, 'monthly', true
  );
  IF v_applied <> 1 THEN
    RAISE EXCEPTION 'authorized rebind: expected 1, got %', v_applied;
  END IF;

  SELECT stripe_subscription_id, subscription_status
  INTO v_bound_subscription, v_status
  FROM public.profiles WHERE id = v_user;
  IF v_bound_subscription <> 'sub_test_reg_rebound' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'authorized rebind: profile did not take the new subscription (%, %)',
      v_bound_subscription, v_status;
  END IF;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_unknown_customer', 'customer.subscription.created');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'unknown customer setup: expected claimed, got %', v_outcome;
  END IF;

  v_applied := public.apply_fenced_stripe_subscription_event(
    'evt_reg_unknown_customer', v_token, clock_timestamp(),
    'cus_test_reg_unknown', 'sub_test_reg_unknown', 'pro', 'active',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp() + INTERVAL '30 days',
    NULL, false, 'monthly'
  );
  IF v_applied <> 0 THEN
    RAISE EXCEPTION 'unknown customer: expected 0, got %', v_applied;
  END IF;

  UPDATE public.profiles
  SET stripe_subscription_id = 'sub_test_reg_current',
      subscription_tier = 'pro',
      subscription_status = 'active',
      cancel_at_period_end = true,
      grace_period_end_date = NULL,
      payment_retry_attempts = 0,
      last_payment_attempt = NULL,
      next_billing_date = '2026-12-01 00:00:00+00'
  WHERE id = v_user;
END $$;

-- ---------------------------------------------------------------------------
-- 3. A payment for a superseded subscription is a recorded fact, but it must
--    not advance the current profile's entitlement state, close the other
--    subscription's retry tracking, or move the current payment watermark.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000013';
  v_customer TEXT := 'cus_test_reg_1';
  v_outcome TEXT;
  v_token UUID;
  v_payment TEXT;
  v_retry_status TEXT;
  v_succeeded TIMESTAMP WITH TIME ZONE;
  v_status public.subscription_status;
  v_last_event TEXT;
  v_unbound_created TIMESTAMP WITH TIME ZONE;
BEGIN
  INSERT INTO public.payment_retry_tracking (
    user_id, stripe_subscription_id, stripe_invoice_id, amount_cents, currency, status
  ) VALUES (
    v_user, 'sub_test_reg_old', 'in_test_reg_old_pending', 4900, 'myr', 'pending'
  );

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_pay_old', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'superseded payment setup: expected claimed, got %', v_outcome;
  END IF;

  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_reg_pay_old', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_old', 'pi_test_reg_old',
    4900, 'myr', 'max',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp()
  );
  IF v_payment <> 'recorded' THEN
    RAISE EXCEPTION 'superseded payment: expected recorded, got %', v_payment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_history WHERE stripe_payment_intent_id = 'pi_test_reg_old'
  ) THEN
    RAISE EXCEPTION 'superseded payment: the payment fact must be recorded';
  END IF;

  SELECT status, succeeded_at INTO v_retry_status, v_succeeded
  FROM public.payment_retry_tracking
  WHERE stripe_subscription_id = 'sub_test_reg_old'
    AND stripe_invoice_id = 'in_test_reg_old_pending';
  IF v_retry_status <> 'pending' OR v_succeeded IS NOT NULL THEN
    RAISE EXCEPTION 'superseded payment: another subscription retry row was closed (%, %)',
      v_retry_status, v_succeeded;
  END IF;

  SELECT subscription_status INTO v_status FROM public.profiles WHERE id = v_user;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'superseded payment: profile status changed to %', v_status;
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_reg_current'
    AND event_family = 'payment';
  IF v_last_event IS NOT NULL THEN
    RAISE EXCEPTION 'superseded payment: current payment watermark moved to %', v_last_event;
  END IF;

  -- Positive control: the profile's own subscription still applies.
  INSERT INTO public.payment_retry_tracking (
    user_id, stripe_subscription_id, stripe_invoice_id, amount_cents, currency, status
  ) VALUES (
    v_user, 'sub_test_reg_current', 'in_test_reg_current_pending', 4900, 'myr', 'pending'
  );

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_pay_current', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'current payment setup: expected claimed, got %', v_outcome;
  END IF;

  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_reg_pay_current', v_token, clock_timestamp(),
    v_customer, 'sub_test_reg_current', 'pi_test_reg_current',
    4900, 'myr', 'pro',
    clock_timestamp() - INTERVAL '30 days', clock_timestamp()
  );
  IF v_payment <> 'applied' THEN
    RAISE EXCEPTION 'current payment: expected applied, got %', v_payment;
  END IF;

  SELECT status, succeeded_at INTO v_retry_status, v_succeeded
  FROM public.payment_retry_tracking
  WHERE stripe_subscription_id = 'sub_test_reg_current'
    AND stripe_invoice_id = 'in_test_reg_current_pending';
  IF v_retry_status <> 'succeeded' OR v_succeeded IS NULL THEN
    RAISE EXCEPTION 'current payment: retry row was not closed (%, %)', v_retry_status, v_succeeded;
  END IF;

  -- Payment before subscription binding: record the fact, report a retryable
  -- outcome, and apply normally once the profile is bound.
  UPDATE public.profiles
  SET stripe_subscription_id = NULL
  WHERE id = v_user;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_pay_unbound', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'unbound payment setup: expected claimed, got %', v_outcome;
  END IF;

  v_unbound_created := clock_timestamp();
  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_reg_pay_unbound', v_token, v_unbound_created,
    v_customer, 'sub_test_reg_current', 'pi_test_reg_unbound',
    4900, 'myr', 'pro',
    v_unbound_created - INTERVAL '30 days', v_unbound_created
  );
  IF v_payment <> 'unbound' THEN
    RAISE EXCEPTION 'unbound payment: expected unbound, got %', v_payment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_history WHERE stripe_payment_intent_id = 'pi_test_reg_unbound'
  ) THEN
    RAISE EXCEPTION 'unbound payment: the payment fact must still be recorded';
  END IF;

  SELECT stripe_event_id INTO v_last_event
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = 'sub_test_reg_current'
    AND event_family = 'payment';
  IF v_last_event <> 'evt_reg_pay_current' THEN
    RAISE EXCEPTION 'unbound payment: watermark moved to % before binding', v_last_event;
  END IF;

  UPDATE public.profiles
  SET stripe_subscription_id = 'sub_test_reg_current',
      subscription_status = 'active'
  WHERE id = v_user;

  v_payment := public.apply_fenced_stripe_payment_event(
    'evt_reg_pay_unbound', v_token, v_unbound_created,
    v_customer, 'sub_test_reg_current', 'pi_test_reg_unbound',
    4900, 'myr', 'pro',
    v_unbound_created - INTERVAL '30 days', v_unbound_created
  );
  IF v_payment <> 'applied' THEN
    RAISE EXCEPTION 'unbound payment replay: expected applied, got %', v_payment;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. A delayed renewal failure for a superseded subscription must not start a
--    grace period or create retry tracking on the current subscription.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000013';
  v_outcome TEXT;
  v_token UUID;
  v_status public.subscription_status;
  v_grace TIMESTAMP WITH TIME ZONE;
  v_attempts INTEGER;
  v_rows INTEGER;
BEGIN
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_fail_old', 'invoice.payment_failed');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'superseded renewal failure setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_failure(
    'evt_reg_fail_old', v_token, clock_timestamp(), v_user,
    'sub_test_reg_old', 'card declined', 'in_test_reg_fail_old'
  );

  SELECT COUNT(*) INTO v_rows
  FROM public.payment_retry_tracking
  WHERE stripe_invoice_id = 'in_test_reg_fail_old';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'superseded renewal failure: retry tracking must not be created, got % rows', v_rows;
  END IF;

  SELECT subscription_status, grace_period_end_date, payment_retry_attempts
  INTO v_status, v_grace, v_attempts
  FROM public.profiles WHERE id = v_user;
  IF v_status <> 'active' OR v_grace IS NOT NULL OR v_attempts <> 0 THEN
    RAISE EXCEPTION 'superseded renewal failure: profile was changed (%, %, %)',
      v_status, v_grace, v_attempts;
  END IF;

  -- Positive control: a failure for the bound subscription still applies.
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_fail_current', 'invoice.payment_failed');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'current renewal failure setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_failure(
    'evt_reg_fail_current', v_token, clock_timestamp(), v_user,
    'sub_test_reg_current', 'card declined', 'in_test_reg_fail_current'
  );

  SELECT subscription_status, grace_period_end_date, payment_retry_attempts
  INTO v_status, v_grace, v_attempts
  FROM public.profiles WHERE id = v_user;
  IF v_status <> 'past_due' OR v_grace IS NULL OR v_attempts <> 1 THEN
    RAISE EXCEPTION 'current renewal failure: expected past_due with grace, got (%, %, %)',
      v_status, v_grace, v_attempts;
  END IF;

  UPDATE public.profiles
  SET subscription_status = 'active',
      grace_period_end_date = NULL,
      payment_retry_attempts = 0,
      last_payment_attempt = NULL
  WHERE id = v_user;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Renewal tracking for a superseded subscription must not move the current
--    next_billing_date or create a tracking row for the old subscription.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user UUID := '00000000-0000-4000-8000-000000000013';
  v_outcome TEXT;
  v_token UUID;
  v_next_billing TIMESTAMP WITH TIME ZONE;
  v_rows INTEGER;
BEGIN
  UPDATE public.profiles
  SET next_billing_date = '2026-12-01 00:00:00+00'
  WHERE id = v_user;

  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_track_old', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'superseded renewal tracking setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_tracking(
    'evt_reg_track_old', v_token, clock_timestamp(), v_user,
    'sub_test_reg_old',
    '2026-11-01 00:00:00+00', '2027-01-01 00:00:00+00',
    'max', 'price_test_reg_old', 'active'
  );

  SELECT next_billing_date INTO v_next_billing FROM public.profiles WHERE id = v_user;
  IF v_next_billing <> '2026-12-01 00:00:00+00' THEN
    RAISE EXCEPTION 'superseded renewal tracking: next_billing_date moved to %', v_next_billing;
  END IF;

  SELECT COUNT(*) INTO v_rows
  FROM public.subscription_renewal_tracking
  WHERE stripe_subscription_id = 'sub_test_reg_old';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'superseded renewal tracking: tracking row must not be created, got %', v_rows;
  END IF;

  -- Positive control: tracking for the bound subscription still applies.
  SELECT outcome, token INTO v_outcome, v_token
  FROM public.claim_stripe_webhook_event('evt_reg_track_current', 'invoice.payment_succeeded');
  IF v_outcome <> 'claimed' THEN
    RAISE EXCEPTION 'current renewal tracking setup: expected claimed, got %', v_outcome;
  END IF;

  PERFORM public.apply_fenced_renewal_tracking(
    'evt_reg_track_current', v_token, clock_timestamp(), v_user,
    'sub_test_reg_current',
    '2026-12-01 00:00:00+00', '2027-02-01 00:00:00+00',
    'pro', 'price_test_reg_current', 'active'
  );

  SELECT next_billing_date INTO v_next_billing FROM public.profiles WHERE id = v_user;
  IF v_next_billing <> '2027-02-01 00:00:00+00' THEN
    RAISE EXCEPTION 'current renewal tracking: expected 2027-02-01, got %', v_next_billing;
  END IF;

  SELECT COUNT(*) INTO v_rows
  FROM public.subscription_renewal_tracking
  WHERE stripe_subscription_id = 'sub_test_reg_current';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'current renewal tracking: expected one tracking row, got %', v_rows;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. stripe_payment_method_id is a protected billing column: the service role
--    may write it, an authenticated user cannot, and an authenticated INSERT is
--    forced back to NULL.
-- ---------------------------------------------------------------------------
DELETE FROM public.profiles
WHERE id = '00000000-0000-4000-8000-000000000014';

SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_id UUID := '00000000-0000-4000-8000-000000000013';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE public.profiles
  SET stripe_payment_method_id = 'pm_test_reg_service'
  WHERE id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_role: payment method id update must succeed';
  END IF;
END $$;

RESET ROLE;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_update_id UUID := '00000000-0000-4000-8000-000000000013';
  v_insert_id UUID := '00000000-0000-4000-8000-000000000014';
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_update_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_update_id)::text,
    true
  );

  BEGIN
    UPDATE public.profiles
    SET stripe_payment_method_id = 'pm_test_reg_attacker'
    WHERE id = v_update_id;

    RAISE EXCEPTION 'authenticated: a direct payment method id update was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Billing fields can only be changed by the billing service%' THEN
      RAISE;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_insert_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_insert_id)::text,
    true
  );

  INSERT INTO public.profiles (
    id, email, subscription_tier, subscription_status,
    receipts_used_this_month, stripe_customer_id, stripe_payment_method_id
  ) VALUES (
    v_insert_id,
    'stripe-fencing-regression-insert@example.invalid',
    'max',
    'past_due',
    99,
    'cus_should_be_cleared',
    'pm_should_be_cleared'
  );
END $$;

RESET ROLE;

DO $$
DECLARE
  v_pm TEXT;
  v_service_pm TEXT;
BEGIN
  SELECT stripe_payment_method_id INTO v_pm
  FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000014';

  IF v_pm IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated INSERT: stripe_payment_method_id must be forced to NULL, got %', v_pm;
  END IF;

  SELECT stripe_payment_method_id INTO v_service_pm
  FROM public.profiles
  WHERE id = '00000000-0000-4000-8000-000000000013';

  IF v_service_pm IS DISTINCT FROM 'pm_test_reg_service' THEN
    RAISE EXCEPTION 'service_role: payment method id was lost, got %', v_service_pm;
  END IF;
END $$;

ROLLBACK;
