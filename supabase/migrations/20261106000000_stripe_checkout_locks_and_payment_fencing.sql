-- Stripe checkout ownership and payment-state fencing.
--
-- Follow-up to 20261104000000_stripe_production_hardening.sql. That migration
-- fenced subscription-state webhook writes. Two production blockers remained:
--
--  1. Concurrent create-checkout-session requests could create duplicate Stripe
--     customers and multiple completable Checkout Sessions for one user.
--  2. Payment, invoice-failure, and payment-action-required webhook handlers
--     wrote billing state outside any claim fence, so an expired worker could
--     still write after a newer delivery claimed the event.
--
-- This migration adds a per-user checkout lock with a fenced, owner-scoped
-- lifecycle, and fenced RPCs for payment-state webhook writes. It also adds the
-- receipt usage counter RPC and its trigger: the previous implementation called
-- a non-existent Supabase client method, so the counter never incremented.
--
-- No credential values appear in this file. Never put a key in a tracked file.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Per-user checkout ownership.
--
-- At most one row per user. The row's lifetime is the checkout's lifetime:
-- acquisition grants a short preparation TTL, and bind_checkout_session extends
-- it to the Stripe Checkout Session's own expiry. A session that is still
-- completable therefore always has a live lock, which is what makes "at most
-- one completable Checkout Session per user" durable rather than best-effort.
--
-- lock_token identifies the request that acquired the row. bind and the
-- failure-path release require it, so a stale request cannot bind or free a
-- lock that now belongs to a newer request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_checkout_locks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_token UUID NOT NULL,
  session_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_checkout_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_checkout_locks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_checkout_locks TO service_role;

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_locks_expiry
  ON public.stripe_checkout_locks (expires_at);

-- ---------------------------------------------------------------------------
-- 2. Checkout lock lifecycle.
--
-- Acquisition is a single atomic INSERT ... ON CONFLICT. An expired row is
-- deleted and the insert retried; a live row is reported back with its bound
-- session id so the caller can reuse the existing Checkout Session instead of
-- creating a second one. The loop cannot spin: every iteration either returns
-- or removes one expired row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_acquire_checkout_lock(
  _user_id UUID,
  _ttl_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (acquired BOOLEAN, session_id TEXT, lock_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session_id TEXT;
  v_token UUID := gen_random_uuid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required';
  END IF;

  IF _ttl_seconds IS NULL OR _ttl_seconds < 1 THEN
    RAISE EXCEPTION 'Lease must be at least 1 second';
  END IF;

  LOOP
    INSERT INTO public.stripe_checkout_locks (user_id, lock_token, expires_at)
    VALUES (_user_id, v_token, clock_timestamp() + (_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING public.stripe_checkout_locks.session_id INTO v_session_id;

    IF FOUND THEN
      RETURN QUERY SELECT TRUE, NULL::TEXT, v_token;
      RETURN;
    END IF;

    -- A row exists. Expired locks are stealable; the delete is the gate, so two
    -- workers that both see an expired row still race only through the insert.
    DELETE FROM public.stripe_checkout_locks
    WHERE user_id = _user_id
      AND expires_at <= clock_timestamp();

    IF NOT FOUND THEN
      SELECT l.session_id INTO v_session_id
      FROM public.stripe_checkout_locks l
      WHERE l.user_id = _user_id;

      -- The expired row was removed by a concurrent worker: retry the insert.
      -- Each retry follows another worker's delete, so the loop still cannot
      -- spin without progress.
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      -- A live lock is held by another request. Surface its session so the
      -- caller can reuse the open Checkout Session, if one is bound yet. No
      -- token is returned: only the owner may bind or release.
      RETURN QUERY SELECT FALSE, v_session_id, NULL::UUID;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_checkout_lock(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_checkout_lock(UUID, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.bind_checkout_session(
  _user_id UUID,
  _lock_token UUID,
  _session_id TEXT,
  _expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _user_id IS NULL OR _lock_token IS NULL OR _session_id IS NULL OR _expires_at IS NULL THEN
    RAISE EXCEPTION 'A user id, lock token, session id, and expiry are required';
  END IF;

  IF _expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Cannot bind an already-expired Checkout Session %', _session_id;
  END IF;

  -- Only the owning request can bind, only while the lock is live and unbound.
  -- The session expiry becomes the lock expiry so the lock cannot outlive the
  -- session it protects, nor expire while the session is still completable.
  UPDATE public.stripe_checkout_locks
  SET session_id = _session_id,
      expires_at = _expires_at,
      updated_at = NOW()
  WHERE user_id = _user_id
    AND lock_token = _lock_token
    AND session_id IS NULL
    AND expires_at > clock_timestamp();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_checkout_session(UUID, UUID, TEXT, TIMESTAMP WITH TIME ZONE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_checkout_session(UUID, UUID, TEXT, TIMESTAMP WITH TIME ZONE)
  TO service_role;

CREATE OR REPLACE FUNCTION public.release_checkout_lock(
  _user_id UUID,
  _session_id TEXT DEFAULT NULL,
  _lock_token UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required';
  END IF;

  IF _session_id IS NULL AND _lock_token IS NULL THEN
    RAISE EXCEPTION 'Either a session id or a lock token is required';
  END IF;

  -- Two release modes, both owner-scoped:
  --  * lock token: the request that acquired the lock releases its own row,
  --    bound or not. A stale request's token can only match its own row.
  --  * session id: the completion webhook releases the row bound to exactly
  --    that session. An unbound or differently-bound row never matches, so a
  --    delayed webhook cannot free a newer checkout's lock.
  DELETE FROM public.stripe_checkout_locks
  WHERE user_id = _user_id
    AND (
      (_lock_token IS NOT NULL AND lock_token = _lock_token)
      OR (_lock_token IS NULL AND session_id = _session_id)
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.release_checkout_lock(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_checkout_lock(UUID, TEXT, UUID)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Receipt usage counter.
--
-- _shared/api-subscription-enforcement.ts previously called
-- context.supabase.raw('receipts_used_this_month + n'), which does not exist on
-- the Supabase client, so the increment never wrote and the displayed counter
-- stayed at zero. The counter is a protected billing column, so the increment
-- is a service-only SECURITY DEFINER RPC.
--
-- The receipts insert trigger is the authoritative incrementer: every receipt
-- row is counted exactly once regardless of which path created it (web,
-- external API, batch).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_receipts_used(
  _user_id UUID,
  _quantity INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_value INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required';
  END IF;

  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 10000 THEN
    RAISE EXCEPTION 'Usage quantity must be between 1 and 10000';
  END IF;

  -- The increment doubles as the lazy monthly reset, folded into the same
  -- atomic UPDATE: the counter was never incremented before this RPC existed
  -- (the Deno incrementer called a non-existent method), and
  -- reset_monthly_usage is not scheduled anywhere, so a counter that only
  -- grows would eventually exceed every tier limit. The reset here mirrors
  -- reset_monthly_usage: usage starts fresh at the start of the next month.
  UPDATE public.profiles
  SET receipts_used_this_month = CASE
        WHEN monthly_reset_date IS NULL OR monthly_reset_date <= NOW() THEN _quantity
        ELSE receipts_used_this_month + _quantity
      END,
      monthly_reset_date = CASE
        WHEN monthly_reset_date IS NULL OR monthly_reset_date <= NOW() THEN DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
        ELSE monthly_reset_date
      END,
      updated_at = NOW()
  WHERE id = _user_id
  RETURNING receipts_used_this_month INTO v_new_value;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile matched user %', _user_id;
  END IF;

  RETURN v_new_value;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_receipts_used(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_receipts_used(UUID, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.track_receipt_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- AFTER INSERT, so a rolled-back insert never counts. Receipt rows reference
  -- auth.users, not profiles, so a receipt for a user without a profile row
  -- would otherwise abort the insert: those are skipped (no profile, no
  -- billable counter), while the explicit RPC keeps its strict behavior for
  -- its own callers.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  PERFORM public.increment_receipts_used(NEW.user_id, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_receipt_usage ON public.receipts;

CREATE TRIGGER track_receipt_usage
  AFTER INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.track_receipt_usage();

-- ---------------------------------------------------------------------------
-- 4. Fenced payment success.
--
-- One transaction: verify the claim is live, record the payment idempotently,
-- then advance state only for an in-order event. Money collected is a fact
-- worth recording even when the state advance is superseded, so the row is
-- inserted before the order check and the advance is gated on the order
-- check passing instead of failing the delivery: the newer event that won
-- the order race already applied that state.
--
-- The profile state write requires the payment to belong to the profile's
-- current subscription. A payment for a superseded subscription, or a one-off
-- invoice that carries no subscription, still records its payment row but does
-- not change entitlement state: a late or unrelated payment must not resurrect
-- or upgrade a subscription it does not belong to.
--
-- Returns 'applied' when the state advance ran, 'recorded' when the payment row
-- was recorded but the advance was skipped (one-off, superseded, or
-- out-of-order payment).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fenced_stripe_payment_event(
  _event_id TEXT,
  _claim_token UUID,
  _event_created TIMESTAMP WITH TIME ZONE,
  _stripe_customer_id TEXT,
  _stripe_subscription_id TEXT,
  _payment_intent_id TEXT,
  _amount INTEGER,
  _currency TEXT,
  _tier public.subscription_tier,
  _billing_period_start TIMESTAMP WITH TIME ZONE,
  _billing_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID;
  v_inserted INTEGER := 0;
  v_in_order BOOLEAN;
BEGIN
  IF _claim_token IS NULL OR _event_id IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A claim token, event id, and event timestamp are required';
  END IF;

  IF _stripe_customer_id IS NULL OR _payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'A Stripe customer id and payment intent id are required';
  END IF;

  PERFORM public.assert_active_stripe_claim(_event_id, _claim_token);

  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE stripe_customer_id = _stripe_customer_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile matched Stripe customer %', _stripe_customer_id;
  END IF;

  INSERT INTO public.payment_history (
    user_id, stripe_payment_intent_id, stripe_subscription_id, amount, currency,
    status, tier, billing_period_start, billing_period_end
  )
  VALUES (
    v_user_id, _payment_intent_id, _stripe_subscription_id, _amount, _currency,
    'succeeded', _tier, _billing_period_start, _billing_period_end
  )
  ON CONFLICT (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- The state advance runs only for an in-order event. assert_stripe_event_order
  -- raises only when two distinct events share a creation second; otherwise it
  -- returns whether this event is at least as new as the family watermark.
  IF _stripe_subscription_id IS NOT NULL THEN
    v_in_order := public.assert_stripe_event_order(
      _stripe_subscription_id, 'payment', _event_id, _event_created
    );
  END IF;

  IF v_in_order THEN
    UPDATE public.profiles
      SET subscription_status = 'active',
          grace_period_end_date = NULL,
          payment_retry_attempts = 0,
          last_payment_attempt = NULL,
          updated_at = NOW()
      WHERE id = v_user_id
        AND _stripe_subscription_id IS NOT NULL
        AND stripe_subscription_id = _stripe_subscription_id;

    UPDATE public.payment_retry_tracking
      SET status = 'succeeded',
          succeeded_at = NOW()
      WHERE stripe_subscription_id = _stripe_subscription_id
        AND status = 'pending';

    UPDATE public.stripe_subscription_event_order
      SET stripe_event_id = _event_id,
          stripe_event_created = _event_created,
          updated_at = NOW()
      WHERE stripe_subscription_id = _stripe_subscription_id
        AND event_family = 'payment';

    RETURN 'applied';
  END IF;
  RETURN 'recorded';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fenced_stripe_payment_event(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT,
  INTEGER, TEXT, public.subscription_tier,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_fenced_stripe_payment_event(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT,
  INTEGER, TEXT, public.subscription_tier,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE
) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Fenced renewal failure.
--
-- handle_renewal_failure starts the grace period. The claim and the payment
-- event order are checked in the same transaction as the grace-period write,
-- so an expired worker cannot start a grace period after a newer delivery
-- resolved the event, and an older failure cannot overwrite a newer success.
--
-- Replay is made idempotent here, not by the callee: handle_renewal_failure
-- inserts a payment_retry_tracking row and resets the grace period on every
-- call, so an already-recorded invoice short-circuits before it runs. Stripe
-- retries after a post-RPC handler failure therefore cannot duplicate retry
-- rows or extend the grace period.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fenced_renewal_failure(
  _event_id TEXT,
  _claim_token UUID,
  _event_created TIMESTAMP WITH TIME ZONE,
  _user_id UUID,
  _stripe_subscription_id TEXT,
  _failure_reason TEXT,
  _stripe_invoice_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF _claim_token IS NULL OR _event_id IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A claim token, event id, and event timestamp are required';
  END IF;

  IF _user_id IS NULL OR _stripe_subscription_id IS NULL OR _stripe_invoice_id IS NULL THEN
    RAISE EXCEPTION 'A user id, subscription id, and invoice id are required';
  END IF;

  PERFORM public.assert_active_stripe_claim(_event_id, _claim_token);

  IF NOT public.assert_stripe_event_order(
    _stripe_subscription_id, 'payment', _event_id, _event_created
  ) THEN
    RAISE EXCEPTION 'Stripe event % is older than the newest processed payment event for subscription %',
      _event_id, _stripe_subscription_id
      USING ERRCODE = 'serialization_failure';
  END IF;

  -- Replaying an invoice that already has retry tracking must not re-run the
  -- grace-period start.
  IF EXISTS (
    SELECT 1
    FROM public.payment_retry_tracking
    WHERE stripe_subscription_id = _stripe_subscription_id
      AND stripe_invoice_id = _stripe_invoice_id
  ) THEN
    RETURN;
  END IF;

  PERFORM public.handle_renewal_failure(
    _user_id, _stripe_subscription_id, _failure_reason, _stripe_invoice_id
  );

  UPDATE public.stripe_subscription_event_order
  SET stripe_event_id = _event_id,
      stripe_event_created = _event_created,
      updated_at = NOW()
  WHERE stripe_subscription_id = _stripe_subscription_id
    AND event_family = 'payment';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fenced_renewal_failure(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_fenced_renewal_failure(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Fenced profile status for invoice state changes.
--
-- invoice.payment_action_required and the non-subscription payment-failure
-- fallback only change subscription_status. They still must not write after
-- their claim is lost, and an event for a superseded subscription must not
-- change the current subscription's status. Returns the number of updated
-- rows: 0 means the write was skipped because the subscription moved on.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fenced_profile_status(
  _event_id TEXT,
  _claim_token UUID,
  _event_created TIMESTAMP WITH TIME ZONE,
  _stripe_customer_id TEXT,
  _stripe_subscription_id TEXT,
  _status public.subscription_status
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID;
  v_updated INTEGER;
BEGIN
  IF _claim_token IS NULL OR _event_id IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A claim token, event id, and event timestamp are required';
  END IF;

  IF _stripe_customer_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'A Stripe customer id and status are required';
  END IF;

  PERFORM public.assert_active_stripe_claim(_event_id, _claim_token);

  IF _stripe_subscription_id IS NOT NULL THEN
    IF NOT public.assert_stripe_event_order(
      _stripe_subscription_id, 'payment', _event_id, _event_created
    ) THEN
      RAISE EXCEPTION 'Stripe event % is older than the newest processed payment event for subscription %',
        _event_id, _stripe_subscription_id
        USING ERRCODE = 'serialization_failure';
    END IF;
  END IF;

  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE stripe_customer_id = _stripe_customer_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile matched Stripe customer %', _stripe_customer_id;
  END IF;

  UPDATE public.profiles
  SET subscription_status = _status,
      updated_at = NOW()
  WHERE id = v_user_id
    AND (_stripe_subscription_id IS NULL
         OR stripe_subscription_id IS NULL
         OR stripe_subscription_id = _stripe_subscription_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 1 AND _stripe_subscription_id IS NOT NULL THEN
    UPDATE public.stripe_subscription_event_order
    SET stripe_event_id = _event_id,
        stripe_event_created = _event_created,
        updated_at = NOW()
    WHERE stripe_subscription_id = _stripe_subscription_id
      AND event_family = 'payment';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fenced_profile_status(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, public.subscription_status
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_fenced_profile_status(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, public.subscription_status
) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Fenced renewal tracking.
--
-- update_subscription_renewal_tracking writes profiles.next_billing_date and
-- subscription_renewal_tracking. It is a required billing write, not an
-- external effect: an expired worker that calls it late can overwrite a newer
-- billing period, so it is wrapped in a claim check like the other handlers.
-- The event was already order-checked by the payment RPC in the same handler;
-- repeating the check here keeps the wrapper safe when called on its own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fenced_renewal_tracking(
  _event_id TEXT,
  _claim_token UUID,
  _event_created TIMESTAMP WITH TIME ZONE,
  _user_id UUID,
  _stripe_subscription_id TEXT,
  _current_period_start TIMESTAMP WITH TIME ZONE,
  _current_period_end TIMESTAMP WITH TIME ZONE,
  _current_tier public.subscription_tier,
  _current_price_id TEXT,
  _status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF _claim_token IS NULL OR _event_id IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A claim token, event id, and event timestamp are required';
  END IF;

  IF _user_id IS NULL OR _stripe_subscription_id IS NULL THEN
    RAISE EXCEPTION 'A user id and subscription id are required';
  END IF;

  PERFORM public.assert_active_stripe_claim(_event_id, _claim_token);

  IF NOT public.assert_stripe_event_order(
    _stripe_subscription_id, 'payment', _event_id, _event_created
  ) THEN
    RAISE EXCEPTION 'Stripe event % is older than the newest processed payment event for subscription %',
      _event_id, _stripe_subscription_id
      USING ERRCODE = 'serialization_failure';
  END IF;

  PERFORM public.update_subscription_renewal_tracking(
    _user_id,
    _stripe_subscription_id,
    _current_period_start,
    _current_period_end,
    _current_tier,
    _current_price_id,
    _status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fenced_renewal_tracking(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, UUID, TEXT,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  public.subscription_tier, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_fenced_renewal_tracking(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, UUID, TEXT,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  public.subscription_tier, TEXT, TEXT
) TO service_role;

COMMIT;
