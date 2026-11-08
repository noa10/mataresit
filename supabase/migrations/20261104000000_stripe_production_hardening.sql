-- Stripe production hardening.
--
-- This migration closes the billing-column self-upgrade path, stops exposing
-- subscription-sync RPCs to end users, and adds webhook idempotency.
--
-- This migration does NOT change batch processing; that lives in
-- 20261104000001_batch_item_vault_trigger.sql.
--
-- No credential values appear in this file. Never put a key in a tracked file.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Subscription state needed by the UI and the sync path.
--
-- billing_interval is nullable on purpose: existing paid rows have an unknown
-- interval until they are reconciled from Stripe. Defaulting them to 'monthly'
-- would silently misreport annual subscribers. The UI treats NULL as monthly
-- after reconciliation; see src/contexts/StripeContext.tsx toSubscriptionData.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_interval_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_interval_check
  CHECK (billing_interval IS NULL OR billing_interval IN ('monthly', 'annual'));

COMMENT ON COLUMN public.profiles.cancel_at_period_end IS
  'True when the Stripe subscription is set to cancel at the end of the current period.';
COMMENT ON COLUMN public.profiles.billing_interval IS
  'Current Stripe billing interval: monthly, annual, or NULL when not yet reconciled from Stripe.';

-- ---------------------------------------------------------------------------
-- 2. Billing columns are writable only by the billing service.
--
-- The profiles RLS policy still lets users update their own profile fields
-- (name, language, etc.). This trigger forces safe billing defaults on INSERT
-- and rejects any change to a billing or entitlement column on UPDATE unless the
-- caller is the service role or a trusted database role. SECURITY DEFINER RPCs
-- run as their owner (postgres), so they remain allowed.
--
-- INSERT matters because the existing "Users can insert their own profile"
-- policy checks only auth.uid() = id; without this, a missing-profile user
-- could insert their own row with subscription_tier = 'max'.
--
-- Usage counters are also protected from direct user edits; trusted metering
-- paths and SECURITY DEFINER reset functions retain access.
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

DROP TRIGGER IF EXISTS protect_profile_billing_columns ON public.profiles;

CREATE TRIGGER protect_profile_billing_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_billing_columns();

-- ---------------------------------------------------------------------------
-- 3. Billing RPCs must not be callable by end users.
--
-- Each of these is SECURITY DEFINER and writes protected billing columns, so an
-- unauthenticated caller could otherwise mutate another user's entitlement or
-- billing state directly through PostgREST.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.update_subscription_from_stripe(
  TEXT, TEXT, public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_subscription_from_stripe(
  TEXT, TEXT, public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE
) TO service_role;

REVOKE ALL ON FUNCTION public.update_subscription_renewal_tracking(
  UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, public.subscription_tier, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_subscription_renewal_tracking(
  UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, public.subscription_tier, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.handle_renewal_failure(
  UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_renewal_failure(
  UUID, TEXT, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.reset_monthly_usage()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reset_monthly_usage() TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Subscription sync.
--
-- Plain administrative writes use sync_subscription_from_stripe. Stripe webhook
-- subscription-state writes use apply_fenced_stripe_subscription_event, which
-- checks claim ownership, renews the lease, and checks event ordering in the
-- same transaction as the profile update. A separate preflight request is not
-- equivalent: the lease can expire before the following write request arrives,
-- and only the fenced transaction can reject an expired owner atomically.
-- This fences the profile state, not external side effects such as email.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_subscription_from_stripe(
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
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF _billing_interval IS NOT NULL
     AND _billing_interval NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Invalid billing interval: %', _billing_interval;
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
  WHERE stripe_customer_id = _stripe_customer_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_subscription_from_stripe(
  TEXT, TEXT, public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_subscription_from_stripe(
  TEXT, TEXT, public.subscription_tier, public.subscription_status,
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  BOOLEAN, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_active_stripe_claim(
  _event_id TEXT,
  _claim_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF _claim_token IS NULL OR _event_id IS NULL THEN
    RAISE EXCEPTION 'A claim token and Stripe event id are required';
  END IF;

  -- Lock the claim until this transaction ends and renew its lease so a
  -- handler that is still working cannot be reclaimed mid-flight by a newer
  -- delivery. The lease is renewed only while it is live: an owner whose lease
  -- already expired must not be able to resurrect it. Five minutes matches
  -- LEASE_SECONDS in supabase/functions/_shared/webhook-idempotency.ts.
  UPDATE public.stripe_webhook_events
  SET lease_expires_at = clock_timestamp() + INTERVAL '5 minutes',
      updated_at = clock_timestamp()
  WHERE event_id = _event_id
    AND claim_token = _claim_token
    AND status = 'processing'
    AND lease_expires_at > clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stripe webhook claim % is stale or superseded', _event_id
      USING ERRCODE = 'serialization_failure';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_active_stripe_claim(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_active_stripe_claim(TEXT, UUID)
  TO service_role;

-- Event IDs are opaque, and distinct events with equal timestamps are ambiguous.
-- Such events fail closed until reconciliation; replaying the same event is safe.
-- Created before its callers so the migration reads top-down even though
-- PL/pgSQL string bodies resolve relation names at first execution.
CREATE TABLE IF NOT EXISTS public.stripe_subscription_event_order (
  stripe_subscription_id TEXT NOT NULL,
  event_family TEXT NOT NULL DEFAULT 'subscription'
    CHECK (event_family IN ('subscription', 'payment')),
  stripe_event_id TEXT NOT NULL,
  stripe_event_created TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stripe_subscription_id, event_family)
);

ALTER TABLE public.stripe_subscription_event_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_subscription_event_order
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_subscription_event_order TO service_role;

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

  -- Stripe event IDs are opaque. Two different events created in the same
  -- second cannot be ordered from these fields, so leave the later delivery
  -- retryable instead of allowing an arbitrary ID comparison to roll back state.
  IF _event_created = v_last_created AND _event_id <> v_last_event_id THEN
    RAISE EXCEPTION 'Cannot order Stripe events % and % created at the same time',
      _event_id, v_last_event_id USING ERRCODE = 'serialization_failure';
  END IF;

  RETURN _event_created > v_last_created OR v_last_event_id = _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_stripe_event_order(TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_stripe_event_order(TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE)
  TO service_role;

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
    RAISE EXCEPTION 'Stripe event % is older than the newest processed subscription event for subscription %',
      _event_id, _stripe_subscription_id
      USING ERRCODE = 'serialization_failure';
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
  WHERE stripe_customer_id = _stripe_customer_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No profile matched Stripe customer %', _stripe_customer_id;
  END IF;

  -- Some users predate the preferences trigger. Create defaults in the same
  -- fenced transaction without overwriting an existing user's choices.
  INSERT INTO public.billing_preferences (user_id)
  SELECT id FROM public.profiles WHERE stripe_customer_id = _stripe_customer_id
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
-- 5. Narrow table privileges; the trigger and RLS remain the row-level guard.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Webhook idempotency.
--
-- A primary key prevents duplicate rows, not duplicate work. These RPCs make
-- the claim itself atomic so two concurrent Stripe deliveries cannot both run
-- the handler, and completion is fenced by a per-claim token so a slow or
-- crashed worker cannot mark a newer claim processed.
--
-- Guarantee: at most one ACTIVE claim per event. This is NOT exactly-once for
-- external side effects (emails, audit rows, renewal RPCs): they remain
-- at-least-once and must each stay independently idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  claim_token UUID,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
  ON public.stripe_webhook_events (created_at);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_lease
  ON public.stripe_webhook_events (lease_expires_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  _event_id TEXT,
  _event_type TEXT,
  _lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (outcome TEXT, token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_status TEXT;
  v_lease TIMESTAMP WITH TIME ZONE;
BEGIN
  IF _lease_seconds IS NULL OR _lease_seconds < 1 THEN
    RAISE EXCEPTION 'Lease must be at least 1 second';
  END IF;

  v_token := gen_random_uuid();
  v_lease := NOW() + (_lease_seconds || ' seconds')::INTERVAL;

  INSERT INTO public.stripe_webhook_events (
    event_id, event_type, status, claim_token, lease_expires_at, attempts
  )
  VALUES (_event_id, _event_type, 'processing', v_token, v_lease, 1)
  ON CONFLICT (event_id) DO UPDATE
    SET status = 'processing',
        claim_token = v_token,
        lease_expires_at = v_lease,
        attempts = public.stripe_webhook_events.attempts + 1,
        updated_at = NOW()
    -- Reclaim failed work or an expired lease regardless of attempt count.
    WHERE public.stripe_webhook_events.status = 'failed'
       OR (
         public.stripe_webhook_events.status = 'processing'
         AND public.stripe_webhook_events.lease_expires_at <= NOW()
       )
  RETURNING public.stripe_webhook_events.status, public.stripe_webhook_events.claim_token
  INTO v_status, v_token;

  IF NOT FOUND THEN
    SELECT e.status INTO v_status
    FROM public.stripe_webhook_events e
    WHERE e.event_id = _event_id;

    -- Only a processed event is a duplicate; a live claim remains in flight.
    RETURN QUERY SELECT
      CASE
        WHEN v_status = 'processed' THEN 'duplicate'
        ELSE 'in_flight'
      END,
      NULL::UUID;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'claimed'::TEXT, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(TEXT, TEXT, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(
  _event_id TEXT,
  _claim_token UUID,
  _status TEXT,
  _last_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _claim_token IS NULL THEN
    RAISE EXCEPTION 'A claim token is required to complete a webhook event';
  END IF;

  IF _status NOT IN ('processed', 'failed') THEN
    RAISE EXCEPTION 'Invalid completion status: %', _status;
  END IF;

  UPDATE public.stripe_webhook_events
  SET status = _status,
      last_error = _last_error,
      claim_token = NULL,
      lease_expires_at = NULL,
      updated_at = NOW()
  WHERE event_id = _event_id
    AND claim_token = _claim_token
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- False means someone else owns the active claim; the caller must not report
  -- completion for work it did not own.
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stripe_webhook_event(TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stripe_webhook_event(TEXT, UUID, TEXT, TEXT)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Payment history must be idempotent per payment intent.
--
-- Do not auto-delete duplicates: choosing a survivor by ctid is arbitrary and
-- could keep another user's row. Abort instead, reconcile against Stripe, then
-- re-run.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_history
    WHERE stripe_payment_intent_id IS NOT NULL
    GROUP BY stripe_payment_intent_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate payment intent IDs exist; export and reconcile payment_history against Stripe before applying this migration';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_payment_intent_unique
  ON public.payment_history (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;
