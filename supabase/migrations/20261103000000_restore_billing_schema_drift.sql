-- Restore billing schema drift left by
-- 20250722000000_enhance_billing_system_schema.sql.
--
-- That migration is recorded as applied in hosted migration history, but
-- production is missing ten of its functions and all five of its triggers.
-- Every table it creates is present. One function exists only in an
-- unversioned shape:
--
--   update_subscription_renewal_tracking(
--     uuid, character varying, timestamptz, timestamptz,
--     character varying, character varying, numeric, character varying
--   )
--
-- That variant is SECURITY DEFINER and is currently executable by anon and
-- authenticated. 20261104000000_stripe_production_hardening.sql cannot revoke
-- it because it names the canonical seven-argument signature, so the pending
-- migration aborts with SQLSTATE 42883 before any billing hardening applies.
--
-- This migration is forward-only and idempotent:
--   1. recreate the missing functions exactly as 20250722000000 defines them;
--   2. recreate the missing triggers;
--   3. add the canonical seven-argument renewal-tracking function beside the
--      unversioned eight-argument one, because the deployed older build may
--      still call the latter;
--   4. revoke PUBLIC/anon/authenticated execute from every overload of the
--      billing RPCs and grant service_role only.
--
-- No credential values appear in this file. Never put a key in a tracked file.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Missing functions from 20250722000000.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_default_billing_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.billing_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_billing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_billing_email_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_subscription_renewal_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_payment_retry_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Canonical seven-argument signature expected by the pending hardening
-- migrations and by the deployed renewal-failure wrappers.
CREATE OR REPLACE FUNCTION public.update_subscription_renewal_tracking(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_current_period_start TIMESTAMP WITH TIME ZONE,
  p_current_period_end TIMESTAMP WITH TIME ZONE,
  p_current_tier public.subscription_tier,
  p_current_price_id TEXT,
  p_status TEXT DEFAULT 'active'
) RETURNS UUID AS $$
DECLARE
  tracking_id UUID;
  next_renewal TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate next renewal date (same as current period end for auto-renewal)
  next_renewal := p_current_period_end;

  -- Upsert subscription renewal tracking
  INSERT INTO public.subscription_renewal_tracking (
    user_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    next_renewal_date,
    current_tier,
    current_price_id,
    status
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_current_period_start,
    p_current_period_end,
    next_renewal,
    p_current_tier,
    p_current_price_id,
    p_status
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    next_renewal_date = EXCLUDED.next_renewal_date,
    current_tier = EXCLUDED.current_tier,
    current_price_id = EXCLUDED.current_price_id,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO tracking_id;

  -- Update profiles table with next billing date
  UPDATE public.profiles
  SET next_billing_date = next_renewal
  WHERE id = p_user_id;

  RETURN tracking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_payment_retry_tracking(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_invoice_id TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'usd',
  p_max_attempts INTEGER DEFAULT 3
) RETURNS UUID AS $$
DECLARE
  retry_id UUID;
  next_retry TIMESTAMP WITH TIME ZONE;
  retry_interval INTEGER;
BEGIN
  -- Get retry interval from billing preferences
  SELECT COALESCE(retry_interval_hours, 24) INTO retry_interval
  FROM public.billing_preferences
  WHERE user_id = p_user_id;

  -- Calculate next retry time
  next_retry := NOW() + (retry_interval || ' hours')::INTERVAL;

  -- Insert payment retry tracking
  INSERT INTO public.payment_retry_tracking (
    user_id,
    stripe_subscription_id,
    stripe_invoice_id,
    amount_cents,
    currency,
    max_attempts,
    next_retry_at
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_invoice_id,
    p_amount_cents,
    p_currency,
    p_max_attempts,
    next_retry
  ) RETURNING id INTO retry_id;

  -- Log the event
  PERFORM public.log_billing_event(
    p_user_id,
    'payment_retry_created',
    'Payment retry tracking created',
    NULL,
    p_stripe_subscription_id,
    NULL,
    '{}',
    jsonb_build_object(
      'retry_id', retry_id,
      'invoice_id', p_stripe_invoice_id,
      'amount_cents', p_amount_cents,
      'max_attempts', p_max_attempts,
      'next_retry_at', next_retry
    ),
    '{}',
    'system'
  );

  RETURN retry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_pending_billing_reminders()
RETURNS TABLE (
  schedule_id UUID,
  user_id UUID,
  subscription_id TEXT,
  reminder_type public.billing_reminder_type,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  template_data JSONB,
  language TEXT,
  user_email TEXT,
  user_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bes.id as schedule_id,
    bes.user_id,
    bes.subscription_id,
    bes.reminder_type,
    bes.scheduled_for,
    bes.template_data,
    bes.language,
    p.email as user_email,
    COALESCE(p.full_name, p.email) as user_name
  FROM public.billing_email_schedule bes
  JOIN public.profiles p ON p.id = bes.user_id
  WHERE bes.status = 'scheduled'
    AND bes.scheduled_for <= NOW()
    AND bes.delivery_attempts < bes.max_delivery_attempts
  ORDER BY bes.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_auto_renewal(
  p_user_id UUID,
  p_stripe_subscription_id TEXT
) RETURNS JSONB AS $$
DECLARE
  renewal_record RECORD;
  billing_prefs RECORD;
  result JSONB;
BEGIN
  -- Get renewal tracking record
  SELECT * INTO renewal_record
  FROM public.subscription_renewal_tracking
  WHERE user_id = p_user_id
    AND stripe_subscription_id = p_stripe_subscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Renewal tracking record not found'
    );
  END IF;

  -- Get billing preferences
  SELECT * INTO billing_prefs
  FROM public.billing_preferences
  WHERE user_id = p_user_id;

  -- Check if auto-renewal is enabled
  IF NOT COALESCE(billing_prefs.auto_renewal_enabled, true) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Auto-renewal is disabled for this user'
    );
  END IF;

  -- Update renewal tracking to mark as processed
  UPDATE public.subscription_renewal_tracking
  SET
    auto_renewal_processed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND stripe_subscription_id = p_stripe_subscription_id;

  -- Log the auto-renewal processing
  PERFORM public.log_billing_event(
    p_user_id,
    'auto_renewal_processed',
    'Auto-renewal processing initiated',
    NULL,
    p_stripe_subscription_id,
    NULL,
    '{}',
    jsonb_build_object(
      'renewal_date', renewal_record.next_renewal_date,
      'current_tier', renewal_record.current_tier,
      'auto_renewal_enabled', renewal_record.auto_renewal_enabled
    ),
    '{}',
    'system'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Auto-renewal processed successfully',
    'renewal_date', renewal_record.next_renewal_date,
    'tier', renewal_record.current_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_renewal_failure(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_failure_reason TEXT DEFAULT NULL,
  p_stripe_invoice_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  billing_prefs RECORD;
  retry_id UUID;
  grace_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get billing preferences
  SELECT * INTO billing_prefs
  FROM public.billing_preferences
  WHERE user_id = p_user_id;

  -- Create payment retry tracking
  SELECT public.create_payment_retry_tracking(
    p_user_id,
    p_stripe_subscription_id,
    COALESCE(p_stripe_invoice_id, 'unknown'),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id AND subscription_tier = 'pro'
      ) THEN 2999  -- $29.99 in cents
      WHEN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id AND subscription_tier = 'max'
      ) THEN 9999  -- $99.99 in cents
      ELSE 0
    END,
    'usd',
    COALESCE(billing_prefs.max_payment_retry_attempts, 3)
  ) INTO retry_id;

  -- Calculate grace period end
  grace_period_end := NOW() + (COALESCE(billing_prefs.grace_period_days, 7) || ' days')::INTERVAL;

  -- Update profile with grace period
  UPDATE public.profiles
  SET
    subscription_status = 'past_due',
    grace_period_end_date = grace_period_end,
    payment_retry_attempts = 1,
    last_payment_attempt = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the renewal failure
  PERFORM public.log_billing_event(
    p_user_id,
    'renewal_failure',
    'Subscription renewal failed, entering grace period',
    NULL,
    p_stripe_subscription_id,
    p_stripe_invoice_id,
    '{}',
    jsonb_build_object(
      'failure_reason', p_failure_reason,
      'grace_period_end', grace_period_end,
      'retry_tracking_id', retry_id
    ),
    '{}',
    'system'
  );

  RETURN retry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.schedule_multiple_billing_reminders(
  p_reminders JSONB[]
) RETURNS JSONB AS $$
DECLARE
  reminder JSONB;
  schedule_id UUID;
  results JSONB[] := '{}';
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Process each reminder
  FOREACH reminder IN ARRAY p_reminders
  LOOP
    BEGIN
      -- Check if user has billing emails enabled
      IF NOT EXISTS (
        SELECT 1 FROM public.billing_preferences
        WHERE user_id = (reminder->>'user_id')::UUID
          AND billing_email_enabled = true
      ) THEN
        results := results || jsonb_build_object(
          'user_id', reminder->>'user_id',
          'status', 'skipped',
          'reason', 'billing_emails_disabled'
        );
        CONTINUE;
      END IF;

      -- Schedule the reminder
      SELECT public.schedule_billing_reminder(
        (reminder->>'user_id')::UUID,
        reminder->>'subscription_id',
        (reminder->>'reminder_type')::public.billing_reminder_type,
        (reminder->>'scheduled_for')::TIMESTAMP WITH TIME ZONE,
        COALESCE(reminder->'template_data', '{}'::JSONB),
        COALESCE(reminder->>'language', 'en')
      ) INTO schedule_id;

      results := results || jsonb_build_object(
        'user_id', reminder->>'user_id',
        'status', 'scheduled',
        'schedule_id', schedule_id
      );

      success_count := success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object(
        'user_id', reminder->>'user_id',
        'status', 'error',
        'error', SQLERRM
      );

      error_count := error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled', success_count,
    'errors', error_count,
    'results', results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_auto_renewal IS 'Processes auto-renewal for a specific subscription';
COMMENT ON FUNCTION public.handle_renewal_failure IS 'Handles subscription renewal failure and initiates grace period';

-- ---------------------------------------------------------------------------
-- 2. Missing triggers from 20250722000000.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS create_billing_preferences_trigger ON auth.users;
CREATE TRIGGER create_billing_preferences_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_billing_preferences();

DROP TRIGGER IF EXISTS billing_preferences_updated_at_trigger ON public.billing_preferences;
CREATE TRIGGER billing_preferences_updated_at_trigger
  BEFORE UPDATE ON public.billing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_preferences_updated_at();

DROP TRIGGER IF EXISTS billing_email_schedule_updated_at_trigger ON public.billing_email_schedule;
CREATE TRIGGER billing_email_schedule_updated_at_trigger
  BEFORE UPDATE ON public.billing_email_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_email_schedule_updated_at();

DROP TRIGGER IF EXISTS subscription_renewal_tracking_updated_at_trigger ON public.subscription_renewal_tracking;
CREATE TRIGGER subscription_renewal_tracking_updated_at_trigger
  BEFORE UPDATE ON public.subscription_renewal_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_renewal_tracking_updated_at();

DROP TRIGGER IF EXISTS payment_retry_tracking_updated_at_trigger ON public.payment_retry_tracking;
CREATE TRIGGER payment_retry_tracking_updated_at_trigger
  BEFORE UPDATE ON public.payment_retry_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_retry_tracking_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Billing RPCs are service-role only.
--
-- This covers EVERY overload of each name, so the unversioned eight-argument
-- renewal-tracking function loses its anon/authenticated execute grant even
-- though 20261104000000 only names the canonical signature. At least one
-- caller uses a name that can resolve to more than one overload, so the
-- overload is revoked but not dropped: the deployed older build may still
-- call it, and it is replaced by the canonical function at the next deploy.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_subscription_renewal_tracking',
        'handle_renewal_failure',
        'create_payment_retry_tracking',
        'process_auto_renewal',
        'get_pending_billing_reminders',
        'schedule_multiple_billing_reminders',
        'create_default_billing_preferences',
        'update_billing_preferences_updated_at',
        'update_billing_email_schedule_updated_at',
        'update_subscription_renewal_tracking_updated_at',
        'update_payment_retry_tracking_updated_at',
        'log_billing_event',
        'schedule_billing_reminder',
        'mark_billing_reminder_sent',
        'get_upcoming_renewals',
        'get_email_delivery_stats',
        'cleanup_old_email_schedules',
        'get_billing_preferences'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name, r.proname, r.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      r.schema_name, r.proname, r.identity_args
    );
  END LOOP;
END $$;

COMMIT;
