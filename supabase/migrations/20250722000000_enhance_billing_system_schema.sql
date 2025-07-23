-- Enhanced Billing System Schema
-- This migration adds comprehensive billing preferences, email scheduling, renewal tracking, and audit trails

-- Create enum types for billing system
DO $$ BEGIN
  CREATE TYPE billing_reminder_type AS ENUM ('upcoming_renewal', 'payment_failed', 'subscription_expiry', 'payment_retry', 'grace_period_warning');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_email_status AS ENUM ('scheduled', 'sent', 'delivered', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE auto_renewal_frequency AS ENUM ('monthly', 'annual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add billing preferences columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_renewal_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_renewal_frequency auto_renewal_frequency DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS billing_email_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS payment_retry_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS grace_period_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS payment_method_last_four TEXT,
ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- Create billing preferences table for detailed settings
CREATE TABLE IF NOT EXISTS public.billing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-renewal settings
  auto_renewal_enabled BOOLEAN DEFAULT true,
  auto_renewal_frequency auto_renewal_frequency DEFAULT 'monthly',
  auto_renewal_day_of_month INTEGER DEFAULT 1 CHECK (auto_renewal_day_of_month BETWEEN 1 AND 28),
  
  -- Email reminder settings
  billing_email_enabled BOOLEAN DEFAULT true,
  reminder_days_before_renewal INTEGER[] DEFAULT '{7, 3, 1}',
  payment_failure_notifications BOOLEAN DEFAULT true,
  grace_period_notifications BOOLEAN DEFAULT true,
  
  -- Payment retry settings
  max_payment_retry_attempts INTEGER DEFAULT 3,
  retry_interval_hours INTEGER DEFAULT 24,
  grace_period_days INTEGER DEFAULT 7,
  
  -- Notification preferences
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ms')),
  timezone TEXT DEFAULT 'UTC',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id)
);

-- Create billing email schedule table
CREATE TABLE IF NOT EXISTS public.billing_email_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT, -- Stripe subscription ID
  
  -- Email details
  reminder_type billing_reminder_type NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status billing_email_status DEFAULT 'scheduled',
  
  -- Email content context
  template_data JSONB DEFAULT '{}',
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ms')),
  
  -- Delivery tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  delivery_attempts INTEGER DEFAULT 0,
  max_delivery_attempts INTEGER DEFAULT 3,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (scheduled_for > NOW()),
  CHECK (delivery_attempts <= max_delivery_attempts)
);

-- Create billing audit trail table
CREATE TABLE IF NOT EXISTS public.billing_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'subscription_created', 'payment_succeeded', 'payment_failed', 'auto_renewal_triggered', etc.
  event_description TEXT NOT NULL,
  
  -- Context
  stripe_event_id TEXT, -- Stripe webhook event ID
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Event data
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- System context
  ip_address INET,
  user_agent TEXT,
  triggered_by TEXT, -- 'user', 'system', 'stripe_webhook', 'cron_job'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription renewal tracking table
CREATE TABLE IF NOT EXISTS public.subscription_renewal_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  
  -- Renewal details
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  next_renewal_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Auto-renewal status
  auto_renewal_enabled BOOLEAN DEFAULT true,
  auto_renewal_scheduled BOOLEAN DEFAULT false,
  auto_renewal_processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment tracking
  last_successful_payment TIMESTAMP WITH TIME ZONE,
  payment_retry_count INTEGER DEFAULT 0,
  grace_period_active BOOLEAN DEFAULT false,
  grace_period_end TIMESTAMP WITH TIME ZONE,
  
  -- Tier and pricing
  current_tier public.subscription_tier NOT NULL,
  current_price_id TEXT NOT NULL,
  renewal_price_id TEXT, -- For scheduled tier changes
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(stripe_subscription_id),
  CHECK (current_period_end > current_period_start),
  CHECK (next_renewal_date >= current_period_end)
);

-- Create payment retry tracking table
CREATE TABLE IF NOT EXISTS public.payment_retry_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  stripe_invoice_id TEXT NOT NULL,
  
  -- Retry details
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed', 'abandoned')),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  succeeded_at TIMESTAMP WITH TIME ZONE,
  abandoned_at TIMESTAMP WITH TIME ZONE,
  
  -- Error tracking
  last_error_code TEXT,
  last_error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (attempt_number <= max_attempts),
  CHECK (amount_cents > 0)
);

-- Enable RLS on all new tables
ALTER TABLE public.billing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_email_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_renewal_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_tracking ENABLE ROW LEVEL SECURITY;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_billing_preferences_user_id ON public.billing_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_user_id ON public.billing_email_schedule (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_scheduled_for ON public.billing_email_schedule (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_status ON public.billing_email_schedule (status);
CREATE INDEX IF NOT EXISTS idx_billing_audit_trail_user_id ON public.billing_audit_trail (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_trail_event_type ON public.billing_audit_trail (event_type);
CREATE INDEX IF NOT EXISTS idx_billing_audit_trail_created_at ON public.billing_audit_trail (created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_renewal_tracking_user_id ON public.subscription_renewal_tracking (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_renewal_tracking_stripe_subscription_id ON public.subscription_renewal_tracking (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_renewal_tracking_next_renewal_date ON public.subscription_renewal_tracking (next_renewal_date) WHERE auto_renewal_enabled = true;
CREATE INDEX IF NOT EXISTS idx_payment_retry_tracking_user_id ON public.payment_retry_tracking (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_retry_tracking_next_retry_at ON public.payment_retry_tracking (next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_retry_tracking_stripe_subscription_id ON public.payment_retry_tracking (stripe_subscription_id);

-- Add indexes to existing profiles table for billing queries
CREATE INDEX IF NOT EXISTS idx_profiles_next_billing_date ON public.profiles (next_billing_date) WHERE next_billing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles (subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_grace_period_end_date ON public.profiles (grace_period_end_date) WHERE grace_period_end_date IS NOT NULL;

-- Create RLS policies for billing_preferences
CREATE POLICY "Users can view their own billing preferences" ON public.billing_preferences
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing preferences" ON public.billing_preferences
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own billing preferences" ON public.billing_preferences
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for billing_email_schedule
CREATE POLICY "Users can view their own billing email schedule" ON public.billing_email_schedule
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can manage all billing email schedules (for system operations)
CREATE POLICY "Service role can manage billing email schedules" ON public.billing_email_schedule
FOR ALL TO service_role USING (true);

-- Create RLS policies for billing_audit_trail
CREATE POLICY "Users can view their own billing audit trail" ON public.billing_audit_trail
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can manage all billing audit trails
CREATE POLICY "Service role can manage billing audit trails" ON public.billing_audit_trail
FOR ALL TO service_role USING (true);

-- Create RLS policies for subscription_renewal_tracking
CREATE POLICY "Users can view their own subscription renewal tracking" ON public.subscription_renewal_tracking
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can manage all subscription renewal tracking
CREATE POLICY "Service role can manage subscription renewal tracking" ON public.subscription_renewal_tracking
FOR ALL TO service_role USING (true);

-- Create RLS policies for payment_retry_tracking
CREATE POLICY "Users can view their own payment retry tracking" ON public.payment_retry_tracking
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can manage all payment retry tracking
CREATE POLICY "Service role can manage payment retry tracking" ON public.payment_retry_tracking
FOR ALL TO service_role USING (true);

-- Create database functions for billing system

-- Function to create default billing preferences for new users
CREATE OR REPLACE FUNCTION create_default_billing_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.billing_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default billing preferences for new users
DROP TRIGGER IF EXISTS create_billing_preferences_trigger ON auth.users;
CREATE TRIGGER create_billing_preferences_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_billing_preferences();

-- Function to update billing preferences updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for billing_preferences updated_at
CREATE TRIGGER billing_preferences_updated_at_trigger
  BEFORE UPDATE ON public.billing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_preferences_updated_at();

-- Function to update billing_email_schedule updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_email_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for billing_email_schedule updated_at
CREATE TRIGGER billing_email_schedule_updated_at_trigger
  BEFORE UPDATE ON public.billing_email_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_email_schedule_updated_at();

-- Function to update subscription_renewal_tracking updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_renewal_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subscription_renewal_tracking updated_at
CREATE TRIGGER subscription_renewal_tracking_updated_at_trigger
  BEFORE UPDATE ON public.subscription_renewal_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_renewal_tracking_updated_at();

-- Function to update payment_retry_tracking updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_retry_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment_retry_tracking updated_at
CREATE TRIGGER payment_retry_tracking_updated_at_trigger
  BEFORE UPDATE ON public.payment_retry_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_tracking_updated_at();

-- Function to log billing events to audit trail
CREATE OR REPLACE FUNCTION log_billing_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_description TEXT,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT '{}',
  p_new_values JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}',
  p_triggered_by TEXT DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.billing_audit_trail (
    user_id,
    event_type,
    event_description,
    stripe_event_id,
    stripe_subscription_id,
    stripe_payment_intent_id,
    old_values,
    new_values,
    metadata,
    triggered_by
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_description,
    p_stripe_event_id,
    p_stripe_subscription_id,
    p_stripe_payment_intent_id,
    p_old_values,
    p_new_values,
    p_metadata,
    p_triggered_by
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to schedule billing reminder emails
CREATE OR REPLACE FUNCTION schedule_billing_reminder(
  p_user_id UUID,
  p_subscription_id TEXT,
  p_reminder_type billing_reminder_type,
  p_scheduled_for TIMESTAMP WITH TIME ZONE,
  p_template_data JSONB DEFAULT '{}',
  p_language TEXT DEFAULT 'en'
) RETURNS UUID AS $$
DECLARE
  schedule_id UUID;
BEGIN
  -- Check if user has billing emails enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_preferences
    WHERE user_id = p_user_id AND billing_email_enabled = true
  ) THEN
    RETURN NULL; -- User has disabled billing emails
  END IF;

  -- Insert the scheduled email
  INSERT INTO public.billing_email_schedule (
    user_id,
    subscription_id,
    reminder_type,
    scheduled_for,
    template_data,
    language
  ) VALUES (
    p_user_id,
    p_subscription_id,
    p_reminder_type,
    p_scheduled_for,
    p_template_data,
    p_language
  ) RETURNING id INTO schedule_id;

  -- Log the scheduling event
  PERFORM log_billing_event(
    p_user_id,
    'email_reminder_scheduled',
    'Billing reminder email scheduled for ' || p_reminder_type::TEXT,
    NULL,
    p_subscription_id,
    NULL,
    '{}',
    jsonb_build_object(
      'schedule_id', schedule_id,
      'reminder_type', p_reminder_type,
      'scheduled_for', p_scheduled_for
    ),
    '{}',
    'system'
  );

  RETURN schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get billing preferences with defaults
CREATE OR REPLACE FUNCTION get_billing_preferences(p_user_id UUID)
RETURNS TABLE (
  auto_renewal_enabled BOOLEAN,
  auto_renewal_frequency auto_renewal_frequency,
  billing_email_enabled BOOLEAN,
  reminder_days_before_renewal INTEGER[],
  payment_failure_notifications BOOLEAN,
  grace_period_notifications BOOLEAN,
  max_payment_retry_attempts INTEGER,
  retry_interval_hours INTEGER,
  grace_period_days INTEGER,
  preferred_language TEXT,
  timezone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(bp.auto_renewal_enabled, true) as auto_renewal_enabled,
    COALESCE(bp.auto_renewal_frequency, 'monthly'::auto_renewal_frequency) as auto_renewal_frequency,
    COALESCE(bp.billing_email_enabled, true) as billing_email_enabled,
    COALESCE(bp.reminder_days_before_renewal, '{7,3,1}'::INTEGER[]) as reminder_days_before_renewal,
    COALESCE(bp.payment_failure_notifications, true) as payment_failure_notifications,
    COALESCE(bp.grace_period_notifications, true) as grace_period_notifications,
    COALESCE(bp.max_payment_retry_attempts, 3) as max_payment_retry_attempts,
    COALESCE(bp.retry_interval_hours, 24) as retry_interval_hours,
    COALESCE(bp.grace_period_days, 7) as grace_period_days,
    COALESCE(bp.preferred_language, 'en') as preferred_language,
    COALESCE(bp.timezone, 'UTC') as timezone
  FROM public.billing_preferences bp
  WHERE bp.user_id = p_user_id;

  -- If no preferences found, return defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      true as auto_renewal_enabled,
      'monthly'::auto_renewal_frequency as auto_renewal_frequency,
      true as billing_email_enabled,
      '{7,3,1}'::INTEGER[] as reminder_days_before_renewal,
      true as payment_failure_notifications,
      true as grace_period_notifications,
      3 as max_payment_retry_attempts,
      24 as retry_interval_hours,
      7 as grace_period_days,
      'en' as preferred_language,
      'UTC' as timezone;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update subscription renewal tracking
CREATE OR REPLACE FUNCTION update_subscription_renewal_tracking(
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

  -- Log the event
  PERFORM log_billing_event(
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

-- Function to create payment retry tracking
CREATE OR REPLACE FUNCTION create_payment_retry_tracking(
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
  PERFORM log_billing_event(
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

-- Function to get upcoming billing reminders that need to be sent
CREATE OR REPLACE FUNCTION get_pending_billing_reminders()
RETURNS TABLE (
  schedule_id UUID,
  user_id UUID,
  subscription_id TEXT,
  reminder_type billing_reminder_type,
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

-- Function to mark billing reminder as sent
CREATE OR REPLACE FUNCTION mark_billing_reminder_sent(
  p_schedule_id UUID,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  reminder_record RECORD;
BEGIN
  -- Get the reminder record
  SELECT * INTO reminder_record
  FROM public.billing_email_schedule
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update the reminder status
  IF p_success THEN
    UPDATE public.billing_email_schedule
    SET
      status = 'sent',
      sent_at = NOW(),
      delivery_attempts = delivery_attempts + 1,
      updated_at = NOW()
    WHERE id = p_schedule_id;
  ELSE
    UPDATE public.billing_email_schedule
    SET
      status = CASE
        WHEN delivery_attempts + 1 >= max_delivery_attempts THEN 'failed'
        ELSE 'scheduled'
      END,
      failed_at = CASE WHEN delivery_attempts + 1 >= max_delivery_attempts THEN NOW() ELSE failed_at END,
      error_message = p_error_message,
      delivery_attempts = delivery_attempts + 1,
      updated_at = NOW()
    WHERE id = p_schedule_id;
  END IF;

  -- Log the event
  PERFORM log_billing_event(
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create initial billing preferences for existing users
INSERT INTO public.billing_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.billing_preferences IS 'User-specific billing and auto-renewal preferences';
COMMENT ON TABLE public.billing_email_schedule IS 'Scheduled billing reminder emails with delivery tracking';
COMMENT ON TABLE public.billing_audit_trail IS 'Comprehensive audit trail for all billing-related events';
COMMENT ON TABLE public.subscription_renewal_tracking IS 'Tracking table for subscription renewals and auto-renewal status';
COMMENT ON TABLE public.payment_retry_tracking IS 'Tracking table for failed payment retry attempts';

COMMENT ON FUNCTION log_billing_event IS 'Logs billing events to the audit trail with comprehensive context';
COMMENT ON FUNCTION schedule_billing_reminder IS 'Schedules billing reminder emails based on user preferences';
COMMENT ON FUNCTION get_billing_preferences IS 'Gets billing preferences with fallback to defaults';
COMMENT ON FUNCTION update_subscription_renewal_tracking IS 'Updates subscription renewal tracking information';
COMMENT ON FUNCTION create_payment_retry_tracking IS 'Creates payment retry tracking for failed payments';
COMMENT ON FUNCTION get_pending_billing_reminders IS 'Gets billing reminders that are ready to be sent';
COMMENT ON FUNCTION mark_billing_reminder_sent IS 'Marks billing reminder as sent or failed with delivery tracking';

-- Function to get upcoming renewals that need processing
CREATE OR REPLACE FUNCTION get_upcoming_renewals()
RETURNS TABLE (
  user_id UUID,
  stripe_subscription_id TEXT,
  current_tier public.subscription_tier,
  current_price_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  next_renewal_date TIMESTAMP WITH TIME ZONE,
  auto_renewal_enabled BOOLEAN,
  amount NUMERIC,
  currency TEXT,
  payment_method_last_four TEXT,
  payment_method_brand TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    srt.user_id,
    srt.stripe_subscription_id,
    srt.current_tier,
    srt.current_price_id,
    srt.current_period_start,
    srt.current_period_end,
    srt.next_renewal_date,
    srt.auto_renewal_enabled,
    COALESCE(
      CASE srt.current_tier
        WHEN 'pro' THEN 29.99
        WHEN 'max' THEN 99.99
        ELSE 0
      END, 0
    )::NUMERIC as amount,
    'usd'::TEXT as currency,
    p.payment_method_last_four,
    p.payment_method_brand
  FROM public.subscription_renewal_tracking srt
  JOIN public.profiles p ON p.id = srt.user_id
  WHERE srt.auto_renewal_enabled = true
    AND srt.status = 'active'
    AND srt.next_renewal_date <= NOW() + INTERVAL '7 days'
    AND srt.next_renewal_date > NOW()
  ORDER BY srt.next_renewal_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process auto-renewal for a subscription
CREATE OR REPLACE FUNCTION process_auto_renewal(
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
  PERFORM log_billing_event(
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

-- Function to handle subscription renewal failure
CREATE OR REPLACE FUNCTION handle_renewal_failure(
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
  SELECT create_payment_retry_tracking(
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
  PERFORM log_billing_event(
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

COMMENT ON FUNCTION get_upcoming_renewals IS 'Gets subscriptions that need renewal processing within the next 7 days';
COMMENT ON FUNCTION process_auto_renewal IS 'Processes auto-renewal for a specific subscription';
COMMENT ON FUNCTION handle_renewal_failure IS 'Handles subscription renewal failure and initiates grace period';

-- Function to schedule multiple billing reminders efficiently
CREATE OR REPLACE FUNCTION schedule_multiple_billing_reminders(
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
      SELECT schedule_billing_reminder(
        (reminder->>'user_id')::UUID,
        reminder->>'subscription_id',
        (reminder->>'reminder_type')::billing_reminder_type,
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

-- Function to get email delivery statistics
CREATE OR REPLACE FUNCTION get_email_delivery_stats(
  p_user_id UUID DEFAULT NULL,
  p_date_range INTERVAL DEFAULT '7 days',
  p_reminder_type billing_reminder_type DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  stats JSONB;
  date_filter TIMESTAMP WITH TIME ZONE;
BEGIN
  date_filter := NOW() - p_date_range;

  WITH email_stats AS (
    SELECT
      status,
      reminder_type,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (sent_at - created_at))/60) as avg_processing_time_minutes
    FROM public.billing_email_schedule
    WHERE created_at >= date_filter
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_reminder_type IS NULL OR reminder_type = p_reminder_type)
    GROUP BY status, reminder_type
  ),
  total_stats AS (
    SELECT
      COUNT(*) as total_emails,
      COUNT(*) FILTER (WHERE status = 'sent') as sent_emails,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered_emails,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_emails,
      COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_emails
    FROM public.billing_email_schedule
    WHERE created_at >= date_filter
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_reminder_type IS NULL OR reminder_type = p_reminder_type)
  )
  SELECT jsonb_build_object(
    'date_range', p_date_range,
    'total_emails', ts.total_emails,
    'sent_emails', ts.sent_emails,
    'delivered_emails', ts.delivered_emails,
    'failed_emails', ts.failed_emails,
    'scheduled_emails', ts.scheduled_emails,
    'delivery_rate', CASE
      WHEN ts.total_emails > 0 THEN ROUND((ts.delivered_emails::NUMERIC / ts.total_emails) * 100, 2)
      ELSE 0
    END,
    'failure_rate', CASE
      WHEN ts.total_emails > 0 THEN ROUND((ts.failed_emails::NUMERIC / ts.total_emails) * 100, 2)
      ELSE 0
    END,
    'by_status', COALESCE(
      jsonb_object_agg(es.status, es.count) FILTER (WHERE es.status IS NOT NULL),
      '{}'::JSONB
    ),
    'by_type', COALESCE(
      jsonb_object_agg(es.reminder_type, es.count) FILTER (WHERE es.reminder_type IS NOT NULL),
      '{}'::JSONB
    ),
    'avg_processing_time_minutes', COALESCE(
      AVG(es.avg_processing_time_minutes) FILTER (WHERE es.avg_processing_time_minutes IS NOT NULL),
      0
    )
  ) INTO stats
  FROM total_stats ts
  LEFT JOIN email_stats es ON true
  GROUP BY ts.total_emails, ts.sent_emails, ts.delivered_emails, ts.failed_emails, ts.scheduled_emails;

  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old email schedules
CREATE OR REPLACE FUNCTION cleanup_old_email_schedules(
  p_retention_days INTEGER DEFAULT 90
) RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Delete old completed email schedules
  DELETE FROM public.billing_email_schedule
  WHERE created_at < cutoff_date
    AND status IN ('sent', 'delivered', 'failed', 'cancelled');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO public.billing_audit_trail (
    user_id,
    event_type,
    event_description,
    metadata,
    triggered_by
  ) VALUES (
    NULL,
    'email_schedule_cleanup',
    'Cleaned up old email schedules',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'retention_days', p_retention_days,
      'cutoff_date', cutoff_date
    ),
    'system'
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'retention_days', p_retention_days
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION schedule_multiple_billing_reminders IS 'Efficiently schedules multiple billing reminders in batch';
COMMENT ON FUNCTION get_email_delivery_stats IS 'Returns comprehensive email delivery statistics';
COMMENT ON FUNCTION cleanup_old_email_schedules IS 'Cleans up old email schedule records to maintain performance';
