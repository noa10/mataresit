-- Stripe fencing regressions.
--
-- Follow-up to 20261104000000_stripe_production_hardening.sql and
-- 20261106000000_stripe_checkout_locks_and_payment_fencing.sql. Those
-- migrations fenced every entitlement-bearing billing write, but left six
-- correctness defects:
--
--  1. assert_stripe_event_order raised for distinct events created in the same
--     second. Stripe timestamps have one-second resolution, so a same-second
--     burst retried forever and never advanced the watermark.
--  2. apply_fenced_stripe_subscription_event updated a profile by customer id
--     only, so a delayed event for a superseded subscription could replace the
--     current subscription, tier, status, and period.
--  3. apply_fenced_stripe_payment_event returned 'applied' even when its
--     profile UPDATE matched no row, letting a payment for a superseded
--     subscription advance renewal tracking and report a state change.
--  4. apply_fenced_renewal_failure and apply_fenced_renewal_tracking checked
--     event order for the invoice's subscription but called helpers that write
--     profiles by user id only, so a delayed failure for an old subscription
--     could mark the active subscriber past_due.
--  5. payment_method.detached events carry customer = null, leaving no safe way
--     to find the profile and clear stale card fields.
--
-- This migration does not change checkout locks or webhook claiming. It adds
-- profiles.stripe_payment_method_id so attach/setup-intent handlers can store
-- the active method and the detach handler can identify its owner without a
-- customer on the event.
--
-- No credential values appear in this file. Never put a key in a tracked file.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The active Stripe payment method.
--
-- Stripe sends customer = null on payment_method.detached because the method is
-- no longer attached to a customer. Storing the method id on attach (and on
-- setup_intent.succeeded) gives the detach handler an unambiguous profile key
-- that does not depend on the event payload. The partial index supports that
-- lookup and stays small because most profiles have no stored method.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

COMMENT ON COLUMN public.profiles.stripe_payment_method_id IS
  'Stripe PaymentMethod id of the active card, written only by the billing service.';

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_payment_method_id
  ON public.profiles (stripe_payment_method_id)
  WHERE stripe_payment_method_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Billing-column protection includes the new payment method id.
--
-- Without this, an authenticated user could point their profile at another
-- customer's PaymentMethod id and corrupt the detach lookup. The INSERT path
-- also forces the column to NULL, so a self-inserted profile cannot claim an
-- existing method.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_tier := 'free';
    NEW.receipts_used_this_month := 0;
    NEW.monthly_reset_date := date_trunc('month', now()) + interval '1 month';
    NEW.subscription_status := 'active';
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.subscription_start_date := NULL;
    NEW.subscription_end_date := NULL;
    NEW.trial_end_date := NULL;
    NEW.cancel_at_period_end := false;
    NEW.billing_interval := NULL;
    NEW.grace_period_end_date := NULL;
    NEW.payment_retry_attempts := 0;
    NEW.last_payment_attempt := NULL;
    NEW.next_billing_date := NULL;
    NEW.payment_method_brand := NULL;
    NEW.payment_method_last_four := NULL;
    NEW.stripe_payment_method_id := NULL;
    NEW.auto_renewal_enabled := true;
    NEW.auto_renewal_frequency := 'monthly';
    NEW.billing_email_enabled := true;
    NEW.billing_address := '{}'::jsonb;
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.receipts_used_this_month IS DISTINCT FROM OLD.receipts_used_this_month
     OR NEW.monthly_reset_date IS DISTINCT FROM OLD.monthly_reset_date
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_start_date IS DISTINCT FROM OLD.subscription_start_date
     OR NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date
     OR NEW.trial_end_date IS DISTINCT FROM OLD.trial_end_date
     OR NEW.cancel_at_period_end IS DISTINCT FROM OLD.cancel_at_period_end
     OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
     OR NEW.grace_period_end_date IS DISTINCT FROM OLD.grace_period_end_date
     OR NEW.payment_retry_attempts IS DISTINCT FROM OLD.payment_retry_attempts
     OR NEW.last_payment_attempt IS DISTINCT FROM OLD.last_payment_attempt
     OR NEW.next_billing_date IS DISTINCT FROM OLD.next_billing_date
     OR NEW.payment_method_brand IS DISTINCT FROM OLD.payment_method_brand
     OR NEW.payment_method_last_four IS DISTINCT FROM OLD.payment_method_last_four
     OR NEW.stripe_payment_method_id IS DISTINCT FROM OLD.stripe_payment_method_id
     OR NEW.auto_renewal_enabled IS DISTINCT FROM OLD.auto_renewal_enabled
     OR NEW.auto_renewal_frequency IS DISTINCT FROM OLD.auto_renewal_frequency
     OR NEW.billing_email_enabled IS DISTINCT FROM OLD.billing_email_enabled
     OR NEW.billing_address IS DISTINCT FROM OLD.billing_address
  THEN
    RAISE EXCEPTION 'Billing fields can only be changed by the billing service'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deterministic event order.
--
-- Stripe `created` has one-second resolution. Two distinct events in the same
-- second therefore have no semantic order, but failing the later delivery
-- forever is worse than choosing a stable winner: the event is retried
-- indefinitely and the watermark never advances. Compare (created, event id)
-- as a total order instead. The id is used only as a tie-breaker; a replay of
-- the same event is still accepted, and a lower-id same-second delivery is
-- acknowledged as stale rather than raising.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_stripe_event_order(
  _stripe_subscription_id TEXT,
  _event_family TEXT,
  _event_id TEXT,
  _event_created TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_last_created TIMESTAMP WITH TIME ZONE;
  v_last_event_id TEXT;
BEGIN
  IF _stripe_subscription_id IS NULL OR _event_id IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A subscription id, event id, and event timestamp are required';
  END IF;

  INSERT INTO public.stripe_subscription_event_order (
    stripe_subscription_id, event_family, stripe_event_id, stripe_event_created
  )
  VALUES (_stripe_subscription_id, _event_family, _event_id, _event_created)
  ON CONFLICT (stripe_subscription_id, event_family) DO NOTHING;

  SELECT stripe_event_created, stripe_event_id
  INTO v_last_created, v_last_event_id
  FROM public.stripe_subscription_event_order
  WHERE stripe_subscription_id = _stripe_subscription_id
    AND event_family = _event_family
  FOR UPDATE;

  IF _event_id = v_last_event_id THEN
    RETURN _event_created >= v_last_created;
  END IF;

  IF _event_created <> v_last_created THEN
    RETURN _event_created > v_last_created;
  END IF;

  RETURN _event_id > v_last_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_stripe_event_order(TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_stripe_event_order(TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Subscription state is scoped to the profile's bound subscription.
--
-- A profile may bind the subscription it has no subscription for yet
-- (stripe_subscription_id IS NULL, the normal first-checkout case), but once a
-- subscription is bound only that subscription may update it. A delayed event
-- for a superseded subscription returns -1 and is acknowledged: the newest
-- subscription already owns the profile.
--
-- Returns:
--   1  the profile was updated
--   0  no profile matched the customer (retry/alert; data is missing)
--  -1  the profile is bound to a different subscription (stale, acknowledged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_fenced_stripe_subscription_event(
  _event_id TEXT,
  _claim_token UUID,
  _event_created TIMESTAMP WITH TIME ZONE,
  _stripe_customer_id TEXT,
  _stripe_subscription_id TEXT,
  _tier public.subscription_tier,
  _status public.subscription_status,
  _current_period_start TIMESTAMP WITH TIME ZONE,
  _current_period_end TIMESTAMP WITH TIME ZONE,
  _trial_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  _cancel_at_period_end BOOLEAN DEFAULT false,
  _billing_interval TEXT DEFAULT 'monthly'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF _claim_token IS NULL OR _event_created IS NULL THEN
    RAISE EXCEPTION 'A claim token and Stripe event timestamp are required';
  END IF;

  IF _billing_interval IS NOT NULL
     AND _billing_interval NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Invalid billing interval: %', _billing_interval;
  END IF;

  PERFORM public.assert_active_stripe_claim(_event_id, _claim_token);

  IF NOT public.assert_stripe_event_order(
    _stripe_subscription_id, 'subscription', _event_id, _event_created
  ) THEN
    RETURN -1;
  END IF;

  UPDATE public.profiles
  SET stripe_subscription_id = _stripe_subscription_id,
      subscription_tier = _tier,
      subscription_status = _status,
      subscription_start_date = _current_period_start,
      subscription_end_date = _current_period_end,
      next_billing_date = _current_period_end,
      trial_end_date = _trial_end,
      cancel_at_period_end = _cancel_at_period_end,
      billing_interval = _billing_interval,
      updated_at = NOW()
  WHERE stripe_customer_id = _stripe_customer_id
    AND (stripe_subscription_id IS NULL
         OR stripe_subscription_id = _stripe_subscription_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    -- Distinguish a missing profile from a profile that already belongs to a
    -- newer subscription. Only the former is an error worth retrying.
    IF EXISTS (
      SELECT 1 FROM public.profiles WHERE stripe_customer_id = _stripe_customer_id
    ) THEN
      RETURN -1;
    END IF;
    RETURN 0;
  END IF;

  -- Some users predate the preferences trigger. Create defaults in the same
  -- fenced transaction without overwriting an existing user's choices.
  INSERT INTO public.billing_preferences (user_id)
  SELECT id
  FROM public.profiles
  WHERE stripe_customer_id = _stripe_customer_id
    AND stripe_subscription_id = _stripe_subscription_id
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.stripe_subscription_event_order
  SET stripe_event_id = _event_id,
      stripe_event_created = _event_created,
      updated_at = NOW()
  WHERE stripe_subscription_id = _stripe_subscription_id
    AND event_family = 'subscription';

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_fenced_stripe_subscription_event(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT,
  public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_fenced_stripe_subscription_event(
  TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, TEXT,
  public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE, BOOLEAN, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Payment state advances only when the profile row was updated.
--
-- The payment fact is recorded first: money collected must not be lost because
-- the subscription moved on. The entitlement advance, retry-tracking close, and
-- payment watermark then run only when the UPDATE matched the profile's current
-- subscription. A payment for a superseded subscription returns 'recorded', so
-- the caller does not run renewal tracking and overwrite next_billing_date.
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
  v_profile_rows INTEGER := 0;
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

    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;

    IF v_profile_rows = 0 THEN
      RETURN 'recorded';
    END IF;

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
-- 6. Renewal failure starts grace only for the bound subscription.
--
-- The order check runs against the invoice's subscription, but
-- handle_renewal_failure updates profiles by user id only. Guard the helper
-- with the same subscription scoping used everywhere else. A stale event and a
-- failure for a superseded subscription are both acknowledged as no-ops.
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
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND stripe_subscription_id = _stripe_subscription_id
  ) THEN
    RETURN;
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
-- 7. Profile status skips stale events instead of failing the delivery.
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
      RETURN 0;
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
-- 8. Renewal tracking is scoped to the bound subscription.
--
-- update_subscription_renewal_tracking writes profiles.next_billing_date by
-- user id only. Guard it exactly like the renewal-failure path so a delayed
-- payment for a superseded subscription cannot move the current period.
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
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND stripe_subscription_id = _stripe_subscription_id
  ) THEN
    RETURN;
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
