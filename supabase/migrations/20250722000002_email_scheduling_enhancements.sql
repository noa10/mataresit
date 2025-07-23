-- Email Scheduling System Enhancements
-- This migration adds advanced email scheduling features, delivery tracking, and monitoring

-- Create email delivery tracking table for detailed analytics
CREATE TABLE IF NOT EXISTS public.email_delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.billing_email_schedule(id) ON DELETE CASCADE,
  
  -- Delivery details
  provider_message_id TEXT, -- ID from email service provider
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'bounced', 'complained', 'rejected')),
  
  -- Timing information
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  complained_at TIMESTAMP WITH TIME ZONE,
  
  -- Delivery metadata
  bounce_reason TEXT,
  complaint_reason TEXT,
  delivery_delay_seconds INTEGER,
  
  -- Provider response
  provider_response JSONB DEFAULT '{}',
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email template performance tracking
CREATE TABLE IF NOT EXISTS public.email_template_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  
  -- Performance metrics
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  
  -- Engagement metrics (for future use)
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  
  -- Calculated rates
  delivery_rate NUMERIC(5,2) DEFAULT 0,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  complaint_rate NUMERIC(5,2) DEFAULT 0,
  
  -- Time period
  period_start TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('day', NOW()),
  period_end TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(template_name, language, period_start)
);

-- Create email scheduling rules table
CREATE TABLE IF NOT EXISTS public.email_scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identification
  rule_name TEXT NOT NULL UNIQUE,
  rule_description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Scheduling constraints
  min_interval_hours INTEGER DEFAULT 1, -- Minimum time between emails to same user
  max_daily_emails INTEGER DEFAULT 5, -- Maximum emails per user per day
  max_hourly_emails INTEGER DEFAULT 100, -- Global rate limit per hour
  
  -- Time restrictions
  allowed_hours_start TIME DEFAULT '08:00',
  allowed_hours_end TIME DEFAULT '20:00',
  allowed_days_of_week INTEGER[] DEFAULT '{1,2,3,4,5}', -- Monday to Friday
  
  -- Priority and retry settings
  default_priority INTEGER DEFAULT 5, -- 1-10 scale
  max_retry_attempts INTEGER DEFAULT 3,
  retry_backoff_multiplier NUMERIC(3,2) DEFAULT 2.0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default scheduling rules
INSERT INTO public.email_scheduling_rules (
  rule_name, 
  rule_description,
  min_interval_hours,
  max_daily_emails,
  max_hourly_emails
) VALUES 
(
  'billing_reminders',
  'Rules for billing reminder emails',
  4, -- 4 hours between billing emails
  3, -- Max 3 billing emails per day
  50 -- Max 50 billing emails per hour globally
),
(
  'payment_failures',
  'Rules for payment failure notifications',
  2, -- 2 hours between payment failure emails
  5, -- Max 5 payment failure emails per day
  25 -- Max 25 payment failure emails per hour globally
)
ON CONFLICT (rule_name) DO NOTHING;

-- Add priority and rule columns to billing_email_schedule
ALTER TABLE public.billing_email_schedule
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS scheduling_rule TEXT DEFAULT 'billing_reminders',
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_tracking_schedule_id ON public.email_delivery_tracking (schedule_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_tracking_status ON public.email_delivery_tracking (delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_tracking_sent_at ON public.email_delivery_tracking (sent_at);

CREATE INDEX IF NOT EXISTS idx_email_template_performance_template ON public.email_template_performance (template_name, language);
CREATE INDEX IF NOT EXISTS idx_email_template_performance_period ON public.email_template_performance (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_priority ON public.billing_email_schedule (priority DESC, scheduled_for ASC) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_retry ON public.billing_email_schedule (next_retry_at) WHERE status = 'scheduled' AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_email_schedule_processing ON public.billing_email_schedule (processing_started_at) WHERE processing_started_at IS NOT NULL AND processing_completed_at IS NULL;

-- Enable RLS
ALTER TABLE public.email_delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_scheduling_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role can manage email delivery tracking" ON public.email_delivery_tracking
FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage email template performance" ON public.email_template_performance
FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can view email template performance" ON public.email_template_performance
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage email scheduling rules" ON public.email_scheduling_rules
FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can view email scheduling rules" ON public.email_scheduling_rules
FOR SELECT TO authenticated USING (true);

-- Function to check email scheduling constraints
CREATE OR REPLACE FUNCTION check_email_scheduling_constraints(
  p_user_id UUID,
  p_reminder_type billing_reminder_type,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  rule_record RECORD;
  constraint_violations TEXT[] := '{}';
  recent_emails_count INTEGER;
  hourly_emails_count INTEGER;
  last_email_time TIMESTAMP WITH TIME ZONE;
  time_since_last_email INTERVAL;
BEGIN
  -- Get scheduling rule
  SELECT * INTO rule_record
  FROM public.email_scheduling_rules
  WHERE rule_name = CASE p_reminder_type
    WHEN 'payment_failed' THEN 'payment_failures'
    ELSE 'billing_reminders'
  END
  AND is_active = true;
  
  IF NOT FOUND THEN
    -- Use default constraints if no rule found
    rule_record.min_interval_hours := 1;
    rule_record.max_daily_emails := 5;
    rule_record.max_hourly_emails := 100;
    rule_record.allowed_hours_start := '08:00'::TIME;
    rule_record.allowed_hours_end := '20:00'::TIME;
    rule_record.allowed_days_of_week := '{1,2,3,4,5}';
  END IF;
  
  -- Check minimum interval between emails
  SELECT MAX(scheduled_for) INTO last_email_time
  FROM public.billing_email_schedule
  WHERE user_id = p_user_id
    AND status IN ('sent', 'delivered')
    AND created_at >= NOW() - INTERVAL '7 days';
  
  IF last_email_time IS NOT NULL THEN
    time_since_last_email := p_scheduled_for - last_email_time;
    IF time_since_last_email < (rule_record.min_interval_hours || ' hours')::INTERVAL THEN
      constraint_violations := constraint_violations || 'min_interval_violation';
    END IF;
  END IF;
  
  -- Check daily email limit
  SELECT COUNT(*) INTO recent_emails_count
  FROM public.billing_email_schedule
  WHERE user_id = p_user_id
    AND DATE(scheduled_for) = DATE(p_scheduled_for)
    AND status IN ('scheduled', 'sent', 'delivered');
  
  IF recent_emails_count >= rule_record.max_daily_emails THEN
    constraint_violations := constraint_violations || 'daily_limit_exceeded';
  END IF;
  
  -- Check hourly global limit
  SELECT COUNT(*) INTO hourly_emails_count
  FROM public.billing_email_schedule
  WHERE scheduled_for BETWEEN 
    DATE_TRUNC('hour', p_scheduled_for) AND 
    DATE_TRUNC('hour', p_scheduled_for) + INTERVAL '1 hour'
    AND status IN ('scheduled', 'sent', 'delivered');
  
  IF hourly_emails_count >= rule_record.max_hourly_emails THEN
    constraint_violations := constraint_violations || 'hourly_limit_exceeded';
  END IF;
  
  -- Check allowed hours
  IF EXTRACT(HOUR FROM p_scheduled_for AT TIME ZONE 'UTC') NOT BETWEEN 
     EXTRACT(HOUR FROM rule_record.allowed_hours_start) AND 
     EXTRACT(HOUR FROM rule_record.allowed_hours_end) THEN
    constraint_violations := constraint_violations || 'outside_allowed_hours';
  END IF;
  
  -- Check allowed days of week
  IF NOT (EXTRACT(DOW FROM p_scheduled_for)::INTEGER = ANY(rule_record.allowed_days_of_week)) THEN
    constraint_violations := constraint_violations || 'outside_allowed_days';
  END IF;
  
  RETURN jsonb_build_object(
    'can_schedule', array_length(constraint_violations, 1) IS NULL,
    'violations', constraint_violations,
    'rule_applied', COALESCE(rule_record.rule_name, 'default'),
    'suggested_time', CASE 
      WHEN array_length(constraint_violations, 1) IS NULL THEN p_scheduled_for
      ELSE calculate_next_available_slot(p_user_id, p_reminder_type)
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate next available scheduling slot
CREATE OR REPLACE FUNCTION calculate_next_available_slot(
  p_user_id UUID,
  p_reminder_type billing_reminder_type
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  next_slot TIMESTAMP WITH TIME ZONE;
  rule_record RECORD;
BEGIN
  -- Get scheduling rule
  SELECT * INTO rule_record
  FROM public.email_scheduling_rules
  WHERE rule_name = CASE p_reminder_type
    WHEN 'payment_failed' THEN 'payment_failures'
    ELSE 'billing_reminders'
  END
  AND is_active = true;
  
  -- Start with current time + minimum interval
  next_slot := NOW() + (COALESCE(rule_record.min_interval_hours, 1) || ' hours')::INTERVAL;
  
  -- Adjust to allowed hours
  IF EXTRACT(HOUR FROM next_slot) < EXTRACT(HOUR FROM COALESCE(rule_record.allowed_hours_start, '08:00'::TIME)) THEN
    next_slot := DATE_TRUNC('day', next_slot) + 
                 (EXTRACT(HOUR FROM COALESCE(rule_record.allowed_hours_start, '08:00'::TIME)) || ' hours')::INTERVAL;
  ELSIF EXTRACT(HOUR FROM next_slot) > EXTRACT(HOUR FROM COALESCE(rule_record.allowed_hours_end, '20:00'::TIME)) THEN
    next_slot := DATE_TRUNC('day', next_slot) + INTERVAL '1 day' +
                 (EXTRACT(HOUR FROM COALESCE(rule_record.allowed_hours_start, '08:00'::TIME)) || ' hours')::INTERVAL;
  END IF;
  
  -- Adjust to allowed days of week
  WHILE NOT (EXTRACT(DOW FROM next_slot)::INTEGER = ANY(COALESCE(rule_record.allowed_days_of_week, '{1,2,3,4,5}'))) LOOP
    next_slot := next_slot + INTERVAL '1 day';
  END LOOP;
  
  RETURN next_slot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update email template performance metrics
CREATE OR REPLACE FUNCTION update_email_template_performance(
  p_template_name TEXT,
  p_language TEXT,
  p_delivery_status TEXT
) RETURNS VOID AS $$
DECLARE
  current_period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  current_period_start := DATE_TRUNC('day', NOW());
  
  -- Upsert performance record
  INSERT INTO public.email_template_performance (
    template_name,
    language,
    period_start,
    period_end,
    total_sent,
    total_delivered,
    total_bounced,
    total_complained
  ) VALUES (
    p_template_name,
    p_language,
    current_period_start,
    current_period_start + INTERVAL '1 day',
    CASE WHEN p_delivery_status = 'sent' THEN 1 ELSE 0 END,
    CASE WHEN p_delivery_status = 'delivered' THEN 1 ELSE 0 END,
    CASE WHEN p_delivery_status = 'bounced' THEN 1 ELSE 0 END,
    CASE WHEN p_delivery_status = 'complained' THEN 1 ELSE 0 END
  )
  ON CONFLICT (template_name, language, period_start) DO UPDATE SET
    total_sent = public.email_template_performance.total_sent + 
                 CASE WHEN p_delivery_status = 'sent' THEN 1 ELSE 0 END,
    total_delivered = public.email_template_performance.total_delivered + 
                      CASE WHEN p_delivery_status = 'delivered' THEN 1 ELSE 0 END,
    total_bounced = public.email_template_performance.total_bounced + 
                    CASE WHEN p_delivery_status = 'bounced' THEN 1 ELSE 0 END,
    total_complained = public.email_template_performance.total_complained + 
                       CASE WHEN p_delivery_status = 'complained' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  -- Update calculated rates
  UPDATE public.email_template_performance
  SET 
    delivery_rate = CASE 
      WHEN total_sent > 0 THEN ROUND((total_delivered::NUMERIC / total_sent) * 100, 2)
      ELSE 0 
    END,
    bounce_rate = CASE 
      WHEN total_sent > 0 THEN ROUND((total_bounced::NUMERIC / total_sent) * 100, 2)
      ELSE 0 
    END,
    complaint_rate = CASE 
      WHEN total_sent > 0 THEN ROUND((total_complained::NUMERIC / total_sent) * 100, 2)
      ELSE 0 
    END
  WHERE template_name = p_template_name 
    AND language = p_language 
    AND period_start = current_period_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_email_scheduling_constraints TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_next_available_slot TO authenticated;
GRANT EXECUTE ON FUNCTION update_email_template_performance TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.email_delivery_tracking IS 'Detailed tracking of email delivery status and metrics';
COMMENT ON TABLE public.email_template_performance IS 'Performance metrics for email templates';
COMMENT ON TABLE public.email_scheduling_rules IS 'Rules and constraints for email scheduling';

COMMENT ON FUNCTION check_email_scheduling_constraints IS 'Validates email scheduling against defined rules and constraints';
COMMENT ON FUNCTION calculate_next_available_slot IS 'Calculates the next available time slot for scheduling an email';
COMMENT ON FUNCTION update_email_template_performance IS 'Updates performance metrics for email templates';

-- Create billing system alerts table for monitoring
CREATE TABLE IF NOT EXISTS public.billing_system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert identification
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Alert content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',

  -- Alert context
  component TEXT, -- payment, email, subscription, webhook, database
  user_id UUID REFERENCES auth.users(id),
  subscription_id TEXT,

  -- Alert lifecycle
  resolved BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_system_alerts_type ON public.billing_system_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_billing_system_alerts_severity ON public.billing_system_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_billing_system_alerts_resolved ON public.billing_system_alerts (resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_system_alerts_component ON public.billing_system_alerts (component, created_at);

-- Enable RLS
ALTER TABLE public.billing_system_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role can manage billing system alerts" ON public.billing_system_alerts
FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can view billing system alerts" ON public.billing_system_alerts
FOR SELECT TO authenticated USING (true);

-- Function to create billing system alert
CREATE OR REPLACE FUNCTION create_billing_system_alert(
  p_alert_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_message TEXT,
  p_component TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_subscription_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  alert_id UUID;
BEGIN
  -- Insert the alert
  INSERT INTO public.billing_system_alerts (
    alert_type,
    severity,
    title,
    message,
    component,
    user_id,
    subscription_id,
    details
  ) VALUES (
    p_alert_type,
    p_severity,
    p_title,
    p_message,
    p_component,
    p_user_id,
    p_subscription_id,
    p_details
  ) RETURNING id INTO alert_id;

  -- Log the alert creation
  INSERT INTO public.billing_audit_trail (
    user_id,
    event_type,
    event_description,
    metadata,
    triggered_by
  ) VALUES (
    p_user_id,
    'system_alert_created',
    'Billing system alert created: ' || p_title,
    jsonb_build_object(
      'alert_id', alert_id,
      'alert_type', p_alert_type,
      'severity', p_severity,
      'component', p_component
    ),
    'system'
  );

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get payment health metrics
CREATE OR REPLACE FUNCTION get_payment_health_metrics(
  p_time_filter TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours'
) RETURNS TABLE (
  success_rate NUMERIC,
  failed_payments_24h INTEGER,
  retry_queue_depth INTEGER,
  avg_processing_time NUMERIC,
  total_payments INTEGER,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_stats AS (
    SELECT
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE event_type = 'payment_succeeded') as success_count,
      COUNT(*) FILTER (WHERE event_type = 'payment_failed') as failed_count,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_time,
      SUM((new_values->>'amount_paid')::NUMERIC) FILTER (WHERE event_type = 'payment_succeeded') as total_amount_paid
    FROM public.billing_audit_trail
    WHERE created_at >= p_time_filter
      AND event_type IN ('payment_succeeded', 'payment_failed')
  ),
  retry_stats AS (
    SELECT COUNT(*) as retry_count
    FROM public.billing_email_schedule
    WHERE status = 'scheduled'
      AND reminder_type = 'payment_failed'
      AND created_at >= p_time_filter
  )
  SELECT
    CASE
      WHEN ps.total_count > 0 THEN ROUND((ps.success_count::NUMERIC / ps.total_count) * 100, 2)
      ELSE 100
    END as success_rate,
    ps.failed_count::INTEGER as failed_payments_24h,
    rs.retry_count::INTEGER as retry_queue_depth,
    COALESCE(ps.avg_time, 0)::NUMERIC as avg_processing_time,
    ps.total_count::INTEGER as total_payments,
    COALESCE(ps.total_amount_paid, 0)::NUMERIC as total_amount
  FROM payment_stats ps
  CROSS JOIN retry_stats rs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get subscription health metrics
CREATE OR REPLACE FUNCTION get_subscription_health_metrics(
  p_time_filter TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours'
) RETURNS TABLE (
  active_subscriptions INTEGER,
  grace_period_subscriptions INTEGER,
  failed_renewals_24h INTEGER,
  churn_rate_7d NUMERIC,
  new_subscriptions_24h INTEGER,
  cancelled_subscriptions_24h INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH subscription_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE subscription_status = 'active') as active_count,
      COUNT(*) FILTER (WHERE subscription_status = 'past_due') as grace_period_count
    FROM public.profiles
    WHERE subscription_tier != 'free'
  ),
  recent_events AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'renewal_failed' AND created_at >= p_time_filter) as failed_renewals,
      COUNT(*) FILTER (WHERE event_type = 'subscription_created' AND created_at >= p_time_filter) as new_subs,
      COUNT(*) FILTER (WHERE event_type = 'subscription_cancelled' AND created_at >= p_time_filter) as cancelled_subs,
      COUNT(*) FILTER (WHERE event_type = 'subscription_cancelled' AND created_at >= NOW() - INTERVAL '7 days') as cancelled_7d
    FROM public.billing_audit_trail
  ),
  total_subs AS (
    SELECT COUNT(*) as total_count
    FROM public.profiles
    WHERE subscription_tier != 'free'
      AND created_at <= NOW() - INTERVAL '7 days'
  )
  SELECT
    ss.active_count::INTEGER as active_subscriptions,
    ss.grace_period_count::INTEGER as grace_period_subscriptions,
    re.failed_renewals::INTEGER as failed_renewals_24h,
    CASE
      WHEN ts.total_count > 0 THEN ROUND((re.cancelled_7d::NUMERIC / ts.total_count) * 100, 2)
      ELSE 0
    END as churn_rate_7d,
    re.new_subs::INTEGER as new_subscriptions_24h,
    re.cancelled_subs::INTEGER as cancelled_subscriptions_24h
  FROM subscription_stats ss
  CROSS JOIN recent_events re
  CROSS JOIN total_subs ts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_billing_system_alert IS 'Creates a new billing system alert with proper logging';
COMMENT ON FUNCTION get_payment_health_metrics IS 'Returns comprehensive payment processing health metrics';
COMMENT ON FUNCTION get_subscription_health_metrics IS 'Returns comprehensive subscription health metrics';
