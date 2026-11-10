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
--   1. recreate the missing functions with fixes for the current schema;
--   2. recreate the missing triggers;
--   3. add the canonical seven-argument renewal-tracking function beside the
--      unversioned eight-argument one, because the deployed older build may
--      still call the latter;
--   4. restrict billing RPCs to service_role, except self-scoped preferences.
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

  PERFORM public.log_billing_event(
    p_user_id,
    'subscription_renewal_tracking_updated',
    'Subscription renewal tracking updated',
    NULL,
    p_stripe_subscription_id,
    NULL,
    '{}',
    jsonb_build_object(
      'tracking_id', tracking_id,
      'next_renewal_date', next_renewal,
      'current_tier', p_current_tier,
      'status', p_status
    ),
    '{}',
    'system'
  );

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
  SELECT retry_interval_hours INTO retry_interval
  FROM public.billing_preferences
  WHERE user_id = p_user_id;
  retry_interval := COALESCE(retry_interval, 24);

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
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email) as user_name
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

-- Give the browser a self-scoped RPC without removing the legacy read path.
-- Deployed bundles still call get_billing_preferences({ p_user_id: user.id })
-- and expect the original eleven columns.
CREATE OR REPLACE FUNCTION public.get_my_billing_preferences()
RETURNS TABLE (
  auto_renewal_enabled BOOLEAN,
  auto_renewal_frequency public.auto_renewal_frequency,
  billing_email_enabled BOOLEAN,
  reminder_days_before_renewal INTEGER[],
  payment_failure_notifications BOOLEAN,
  grace_period_notifications BOOLEAN,
  max_payment_retry_attempts INTEGER,
  retry_interval_hours INTEGER,
  grace_period_days INTEGER,
  preferred_language TEXT,
  timezone TEXT,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(bp.auto_renewal_enabled, true),
    COALESCE(bp.auto_renewal_frequency, 'monthly'::public.auto_renewal_frequency),
    COALESCE(bp.billing_email_enabled, true),
    COALESCE(bp.reminder_days_before_renewal, '{7,3,1}'::INTEGER[]),
    COALESCE(bp.payment_failure_notifications, true),
    COALESCE(bp.grace_period_notifications, true),
    COALESCE(bp.max_payment_retry_attempts, 3),
    COALESCE(bp.retry_interval_hours, 24),
    COALESCE(bp.grace_period_days, 7),
    COALESCE(bp.preferred_language, 'en'),
    COALESCE(bp.timezone, 'UTC'),
    bp.quiet_hours_start,
    bp.quiet_hours_end
  FROM (VALUES (1)) AS defaults(dummy)
  LEFT JOIN public.billing_preferences bp ON bp.user_id = auth.uid();
END;
$$;

-- Compatibility wrapper for the browser bundle that was already deployed when
-- this migration ships. It preserves the original eleven-column contract,
-- allows authenticated users to read only their own row, and keeps the
-- service-role callers working. The new frontend uses the no-argument
-- get_my_billing_preferences() above. A later migration can remove this alias
-- after the cache window closes.
CREATE OR REPLACE FUNCTION public.get_billing_preferences(p_user_id UUID)
RETURNS TABLE (
  auto_renewal_enabled BOOLEAN,
  auto_renewal_frequency public.auto_renewal_frequency,
  billing_email_enabled BOOLEAN,
  reminder_days_before_renewal INTEGER[],
  payment_failure_notifications BOOLEAN,
  grace_period_notifications BOOLEAN,
  max_payment_retry_attempts INTEGER,
  retry_interval_hours INTEGER,
  grace_period_days INTEGER,
  preferred_language TEXT,
  timezone TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'Not authorized to read billing preferences' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(bp.auto_renewal_enabled, true),
    COALESCE(bp.auto_renewal_frequency, 'monthly'::public.auto_renewal_frequency),
    COALESCE(bp.billing_email_enabled, true),
    COALESCE(bp.reminder_days_before_renewal, '{7,3,1}'::INTEGER[]),
    COALESCE(bp.payment_failure_notifications, true),
    COALESCE(bp.grace_period_notifications, true),
    COALESCE(bp.max_payment_retry_attempts, 3),
    COALESCE(bp.retry_interval_hours, 24),
    COALESCE(bp.grace_period_days, 7),
    COALESCE(bp.preferred_language, 'en'),
    COALESCE(bp.timezone, 'UTC')
  FROM public.billing_preferences bp
  WHERE bp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      true,
      'monthly'::public.auto_renewal_frequency,
      true,
      '{7,3,1}'::INTEGER[],
      true,
      true,
      3,
      24,
      7,
      'en',
      'UTC';
  END IF;
END;
$$;

-- The old time-dependent CHECK prevents updates after a reminder becomes due.
-- The hosted constraint name and expression may not match the checked-in one,
-- so remove every CHECK on this table that references scheduled_for together
-- with a time source, then fail closed if any such constraint survived.
-- Verify the deployed pg_get_expr output with docs/runbooks/production-cutover.md
-- before rollout; this migration deliberately preserves unrelated constraints.
DO $$
DECLARE
  constraint_name TEXT;
  constraint_expression TEXT;
BEGIN
  FOR constraint_name, constraint_expression IN
    SELECT conname, pg_get_expr(conbin, conrelid)
    FROM pg_constraint
    WHERE conrelid = 'public.billing_email_schedule'::regclass
      AND contype = 'c'
      AND pg_get_expr(conbin, conrelid) ~* 'scheduled_for'
      AND pg_get_expr(conbin, conrelid) ~* '(now[[:space:]]*\(|current_timestamp|transaction_timestamp[[:space:]]*\(|statement_timestamp[[:space:]]*\(|clock_timestamp[[:space:]]*\()'
  LOOP
    RAISE NOTICE 'Dropping time-dependent billing schedule constraint %: %',
      constraint_name, constraint_expression;
    EXECUTE format('ALTER TABLE public.billing_email_schedule DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_email_schedule'::regclass
      AND contype = 'c'
      AND pg_get_expr(conbin, conrelid) ~* 'scheduled_for'
      AND pg_get_expr(conbin, conrelid) ~* '(now[[:space:]]*\(|current_timestamp|transaction_timestamp[[:space:]]*\(|statement_timestamp[[:space:]]*\(|clock_timestamp[[:space:]]*\()'
  ) THEN
    RAISE EXCEPTION 'A time-dependent billing schedule constraint remains; inspect pg_constraint before continuing'
      USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_billing_reminder_schedule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for)
     AND NEW.scheduled_for <= NOW() THEN
    RAISE EXCEPTION 'billing reminder must be scheduled in the future' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_billing_reminder_schedule_trigger ON public.billing_email_schedule;
CREATE TRIGGER validate_billing_reminder_schedule_trigger
  BEFORE INSERT OR UPDATE OF scheduled_for ON public.billing_email_schedule
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_reminder_schedule();

-- The canonical function in 20250722000000 assigns an untyped CASE result to
-- the billing_email_status enum. On hosted PostgreSQL that failure branch
-- raises "column status is of type billing_email_status but expression is of
-- type text", leaving failed reminders scheduled forever. Replace the
-- function with explicit enum casts while preserving its audit event.
CREATE OR REPLACE FUNCTION public.mark_billing_reminder_sent(
  p_schedule_id UUID,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  reminder_record RECORD;
BEGIN
  SELECT * INTO reminder_record
  FROM public.billing_email_schedule
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_success THEN
    UPDATE public.billing_email_schedule
    SET
      status = 'sent'::public.billing_email_status,
      sent_at = now(),
      delivery_attempts = delivery_attempts + 1,
      updated_at = now()
    WHERE id = p_schedule_id;
  ELSE
    UPDATE public.billing_email_schedule
    SET
      status = CASE
        WHEN delivery_attempts + 1 >= max_delivery_attempts
          THEN 'failed'::public.billing_email_status
        ELSE 'scheduled'::public.billing_email_status
      END,
      failed_at = CASE
        WHEN delivery_attempts + 1 >= max_delivery_attempts THEN now()
        ELSE failed_at
      END,
      error_message = p_error_message,
      delivery_attempts = delivery_attempts + 1,
      updated_at = now()
    WHERE id = p_schedule_id;
  END IF;

  PERFORM public.log_billing_event(
    reminder_record.user_id,
    CASE WHEN p_success THEN 'billing_reminder_sent' ELSE 'billing_reminder_failed' END,
    'Billing reminder email ' || CASE WHEN p_success THEN 'sent successfully' ELSE 'failed to send' END,
    NULL,
    reminder_record.subscription_id,
    NULL,
    '{}',
    jsonb_build_object(
      'schedule_id', p_schedule_id,
      'reminder_type', reminder_record.reminder_type,
      'success', p_success,
      'error_message', p_error_message,
      'delivery_attempts', reminder_record.delivery_attempts + 1
    ),
    '{}',
    'system'
  );

  RETURN true;
END;
$$;

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

-- The trigger only covers new users; restore defaults for users created while it was missing.
INSERT INTO public.billing_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

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
-- 3. Billing RPCs are service-role only, apart from the self-scoped
--    preferences read paths (get_my_billing_preferences and the legacy
--    get_billing_preferences compatibility wrapper).
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
        'validate_billing_reminder_schedule',
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

REVOKE ALL ON FUNCTION public.get_my_billing_preferences() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_billing_preferences() TO authenticated;

-- Regrant the legacy read only after the service-role-only loop, otherwise
-- deployed browser bundles would fail with 42501 during the frontend rollout.
REVOKE ALL ON FUNCTION public.get_billing_preferences(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_billing_preferences(UUID) TO authenticated, service_role;

COMMIT;
