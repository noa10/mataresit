-- Create comprehensive alerting system for performance monitoring and health alerts
-- Migration: 20250718000000_create_alerting_system.sql

-- Create alert severity enum
DO $$ BEGIN
    CREATE TYPE "public"."alert_severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create alert status enum
DO $$ BEGIN
    CREATE TYPE "public"."alert_status" AS ENUM ('active', 'acknowledged', 'resolved', 'suppressed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create alert rule condition type enum
DO $$ BEGIN
    CREATE TYPE "public"."alert_condition_type" AS ENUM ('threshold', 'percentage', 'rate', 'count', 'duration', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create notification channel type enum
DO $$ BEGIN
    CREATE TYPE "public"."notification_channel_type" AS ENUM ('email', 'push', 'webhook', 'slack', 'sms', 'in_app');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alert rules configuration table
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Rule configuration
  metric_name VARCHAR(100) NOT NULL, -- 'success_rate', 'response_time', 'error_rate', 'health_score'
  metric_source VARCHAR(100) NOT NULL, -- 'embedding_metrics', 'performance_metrics', 'system_health'
  condition_type alert_condition_type NOT NULL,
  
  -- Threshold configuration
  threshold_value DECIMAL(15,4) NOT NULL,
  threshold_operator VARCHAR(10) NOT NULL CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=', '!=')),
  threshold_unit VARCHAR(20), -- 'ms', 'seconds', 'percentage', 'count'
  
  -- Time-based conditions
  evaluation_window_minutes INTEGER DEFAULT 5, -- How long to evaluate the condition
  evaluation_frequency_minutes INTEGER DEFAULT 1, -- How often to check
  consecutive_failures_required INTEGER DEFAULT 1, -- How many consecutive failures before alerting
  
  -- Alert configuration
  severity alert_severity NOT NULL DEFAULT 'medium',
  enabled BOOLEAN DEFAULT true,
  
  -- Suppression and rate limiting
  cooldown_minutes INTEGER DEFAULT 15, -- Minimum time between alerts for same rule
  max_alerts_per_hour INTEGER DEFAULT 10,
  auto_resolve_minutes INTEGER, -- Auto-resolve after X minutes if condition clears
  
  -- Metadata
  tags JSONB DEFAULT '{}', -- For grouping and filtering
  custom_conditions JSONB DEFAULT '{}', -- For complex custom logic
  
  -- Ownership and permissions
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_evaluated_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(name, team_id)
);

-- Notification channels configuration table
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Channel configuration
  channel_type notification_channel_type NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  -- Channel-specific configuration
  configuration JSONB NOT NULL DEFAULT '{}', -- Email addresses, webhook URLs, Slack channels, etc.
  
  -- Rate limiting per channel
  max_notifications_per_hour INTEGER DEFAULT 50,
  max_notifications_per_day INTEGER DEFAULT 200,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(name, team_id)
);

-- Alert escalation policies table
CREATE TABLE IF NOT EXISTS public.alert_escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Escalation configuration
  escalation_rules JSONB NOT NULL DEFAULT '[]', -- Array of escalation steps with timing and channels
  
  -- Default escalation timing
  initial_delay_minutes INTEGER DEFAULT 0,
  escalation_interval_minutes INTEGER DEFAULT 30,
  max_escalation_level INTEGER DEFAULT 3,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(name, team_id)
);

-- Alert rule to notification channel mapping
CREATE TABLE IF NOT EXISTS public.alert_rule_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
  notification_channel_id UUID REFERENCES public.notification_channels(id) ON DELETE CASCADE NOT NULL,
  escalation_policy_id UUID REFERENCES public.alert_escalation_policies(id) ON DELETE SET NULL,
  
  -- Channel-specific overrides
  severity_filter alert_severity[], -- Only send alerts of these severities to this channel
  enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(alert_rule_id, notification_channel_id)
);

-- Active alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
  
  -- Alert details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity alert_severity NOT NULL,
  status alert_status NOT NULL DEFAULT 'active',
  
  -- Metric information
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4),
  threshold_value DECIMAL(15,4),
  threshold_operator VARCHAR(10),
  
  -- Context and metadata
  context JSONB DEFAULT '{}', -- Additional context about the alert
  tags JSONB DEFAULT '{}',
  
  -- Status tracking
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  suppressed_until TIMESTAMP WITH TIME ZONE,
  
  -- Escalation tracking
  escalation_level INTEGER DEFAULT 0,
  last_escalated_at TIMESTAMP WITH TIME ZONE,
  next_escalation_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Alert history for tracking all alert events
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'created', 'acknowledged', 'resolved', 'escalated', 'suppressed'
  event_description TEXT,
  
  -- Event context
  previous_status alert_status,
  new_status alert_status,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert notification delivery tracking
CREATE TABLE IF NOT EXISTS public.alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  notification_channel_id UUID REFERENCES public.notification_channels(id) ON DELETE CASCADE NOT NULL,
  
  -- Delivery details
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'retrying'
  delivery_attempt INTEGER DEFAULT 1,
  max_delivery_attempts INTEGER DEFAULT 3,
  
  -- Content
  subject VARCHAR(500),
  message TEXT,
  
  -- Delivery tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- External tracking
  external_message_id VARCHAR(255), -- For tracking with external services
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON public.alert_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_team_enabled ON public.alert_rules(team_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON public.alert_rules(metric_name, metric_source);
CREATE INDEX IF NOT EXISTS idx_alert_rules_last_evaluated ON public.alert_rules(last_evaluated_at);

CREATE INDEX IF NOT EXISTS idx_notification_channels_type_enabled ON public.notification_channels(channel_type, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_notification_channels_team ON public.notification_channels(team_id);

CREATE INDEX IF NOT EXISTS idx_alert_escalation_policies_team ON public.alert_escalation_policies(team_id);

CREATE INDEX IF NOT EXISTS idx_alert_rule_channels_rule ON public.alert_rule_channels(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_channels_channel ON public.alert_rule_channels(notification_channel_id);

CREATE INDEX IF NOT EXISTS idx_alerts_status_team ON public.alerts(status, team_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_status ON public.alerts(severity, status);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_status ON public.alerts(alert_rule_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_desc ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_next_escalation ON public.alerts(next_escalation_at) WHERE next_escalation_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON public.alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_desc ON public.alert_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert ON public.alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_channel ON public.alert_notifications(notification_channel_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON public.alert_notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_pending ON public.alert_notifications(created_at) WHERE delivery_status = 'pending';

-- Enable RLS on all tables
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rule_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for alert_rules
CREATE POLICY "Users can manage alert rules in their teams" ON public.alert_rules
  FOR ALL USING (
    team_id IS NULL AND auth.uid() = created_by OR
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for notification_channels
CREATE POLICY "Users can manage notification channels in their teams" ON public.notification_channels
  FOR ALL USING (
    team_id IS NULL AND auth.uid() = created_by OR
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for alert_escalation_policies
CREATE POLICY "Users can manage escalation policies in their teams" ON public.alert_escalation_policies
  FOR ALL USING (
    team_id IS NULL AND auth.uid() = created_by OR
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for alert_rule_channels
CREATE POLICY "Users can manage alert rule channels in their teams" ON public.alert_rule_channels
  FOR ALL USING (
    alert_rule_id IN (
      SELECT id FROM public.alert_rules WHERE
        team_id IS NULL AND auth.uid() = created_by OR
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    )
  );

-- RLS policies for alerts
CREATE POLICY "Users can view alerts in their teams" ON public.alerts
  FOR SELECT USING (
    team_id IS NULL OR
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update alerts in their teams" ON public.alerts
  FOR UPDATE USING (
    team_id IS NULL OR
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- RLS policies for alert_history
CREATE POLICY "Users can view alert history in their teams" ON public.alert_history
  FOR SELECT USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE
        team_id IS NULL OR
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

-- RLS policies for alert_notifications
CREATE POLICY "Users can view alert notifications in their teams" ON public.alert_notifications
  FOR SELECT USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE
        team_id IS NULL OR
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.update_alerting_updated_at()
RETURNS TRIGGER AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_notification_channels_updated_at
  BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_escalation_policies_updated_at
  BEFORE UPDATE ON public.alert_escalation_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_notifications_updated_at
  BEFORE UPDATE ON public.alert_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

-- Function to evaluate alert rules
CREATE OR REPLACE FUNCTION public.evaluate_alert_rule(_rule_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _rule RECORD;
  _metric_value DECIMAL(15,4);
  _condition_met BOOLEAN := FALSE;
  _existing_alert_id UUID;
BEGIN
  -- Get the alert rule
  SELECT * INTO _rule FROM public.alert_rules WHERE id = _rule_id AND enabled = true;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update last evaluated timestamp
  UPDATE public.alert_rules SET last_evaluated_at = NOW() WHERE id = _rule_id;

  -- Get current metric value based on metric source
  CASE _rule.metric_source
    WHEN 'embedding_metrics' THEN
      -- Calculate embedding success rate from recent metrics
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 100.0
          ELSE (COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*))
        END INTO _metric_value
      FROM public.embedding_performance_metrics
      WHERE created_at > NOW() - INTERVAL '1 hour' * _rule.evaluation_window_minutes / 60.0;

    WHEN 'performance_metrics' THEN
      -- Get latest performance metric value
      SELECT metric_value INTO _metric_value
      FROM public.performance_metrics
      WHERE metric_name = _rule.metric_name
        AND created_at > NOW() - INTERVAL '1 hour' * _rule.evaluation_window_minutes / 60.0
      ORDER BY created_at DESC
      LIMIT 1;

    WHEN 'system_health' THEN
      -- Calculate system health score (simplified)
      _metric_value := 85.0; -- Placeholder - would integrate with actual health monitoring

    ELSE
      -- Unknown metric source
      RETURN FALSE;
  END CASE;

  -- Evaluate condition
  CASE _rule.threshold_operator
    WHEN '>' THEN _condition_met := _metric_value > _rule.threshold_value;
    WHEN '<' THEN _condition_met := _metric_value < _rule.threshold_value;
    WHEN '>=' THEN _condition_met := _metric_value >= _rule.threshold_value;
    WHEN '<=' THEN _condition_met := _metric_value <= _rule.threshold_value;
    WHEN '=' THEN _condition_met := _metric_value = _rule.threshold_value;
    WHEN '!=' THEN _condition_met := _metric_value != _rule.threshold_value;
    ELSE _condition_met := FALSE;
  END CASE;

  -- Check if there's already an active alert for this rule
  SELECT id INTO _existing_alert_id
  FROM public.alerts
  WHERE alert_rule_id = _rule_id AND status IN ('active', 'acknowledged');

  IF _condition_met THEN
    -- Condition is met, create or update alert
    IF _existing_alert_id IS NULL THEN
      -- Create new alert
      INSERT INTO public.alerts (
        alert_rule_id,
        title,
        description,
        severity,
        metric_name,
        metric_value,
        threshold_value,
        threshold_operator,
        context,
        team_id
      ) VALUES (
        _rule_id,
        _rule.name || ' - Threshold Exceeded',
        format('Metric %s (%s) is %s %s (threshold: %s %s)',
               _rule.metric_name, _metric_value, _rule.threshold_operator,
               _rule.threshold_value, _rule.threshold_operator, _rule.threshold_value),
        _rule.severity,
        _rule.metric_name,
        _metric_value,
        _rule.threshold_value,
        _rule.threshold_operator,
        jsonb_build_object(
          'rule_name', _rule.name,
          'evaluation_window_minutes', _rule.evaluation_window_minutes,
          'metric_source', _rule.metric_source
        ),
        _rule.team_id
      );
    END IF;
  ELSE
    -- Condition is not met, resolve existing alert if auto-resolve is enabled
    IF _existing_alert_id IS NOT NULL AND _rule.auto_resolve_minutes IS NOT NULL THEN
      UPDATE public.alerts
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = _existing_alert_id;
    END IF;
  END IF;

  RETURN _condition_met;
END;
$function$;

-- Function to acknowledge an alert
CREATE OR REPLACE FUNCTION public.acknowledge_alert(_alert_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update alert status
  UPDATE public.alerts
  SET
    status = 'acknowledged',
    acknowledged_at = NOW(),
    acknowledged_by = _user_id,
    updated_at = NOW()
  WHERE id = _alert_id AND status = 'active';

  -- Add to history
  INSERT INTO public.alert_history (
    alert_id,
    event_type,
    event_description,
    previous_status,
    new_status,
    performed_by
  ) VALUES (
    _alert_id,
    'acknowledged',
    'Alert acknowledged by user',
    'active',
    'acknowledged',
    _user_id
  );

  RETURN FOUND;
END;
$function$;

-- Function to resolve an alert
CREATE OR REPLACE FUNCTION public.resolve_alert(_alert_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update alert status
  UPDATE public.alerts
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = _user_id,
    updated_at = NOW()
  WHERE id = _alert_id AND status IN ('active', 'acknowledged');

  -- Add to history
  INSERT INTO public.alert_history (
    alert_id,
    event_type,
    event_description,
    previous_status,
    new_status,
    performed_by
  ) VALUES (
    _alert_id,
    'resolved',
    'Alert resolved by user',
    CASE WHEN (SELECT acknowledged_at FROM public.alerts WHERE id = _alert_id) IS NOT NULL
         THEN 'acknowledged' ELSE 'active' END,
    'resolved',
    _user_id
  );

  RETURN FOUND;
END;
$function$;

-- Function to suppress an alert
CREATE OR REPLACE FUNCTION public.suppress_alert(_alert_id UUID, _suppress_until TIMESTAMP WITH TIME ZONE, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update alert status
  UPDATE public.alerts
  SET
    status = 'suppressed',
    suppressed_until = _suppress_until,
    updated_at = NOW()
  WHERE id = _alert_id AND status IN ('active', 'acknowledged');

  -- Add to history
  INSERT INTO public.alert_history (
    alert_id,
    event_type,
    event_description,
    previous_status,
    new_status,
    performed_by,
    metadata
  ) VALUES (
    _alert_id,
    'suppressed',
    'Alert suppressed until ' || _suppress_until::TEXT,
    CASE WHEN (SELECT acknowledged_at FROM public.alerts WHERE id = _alert_id) IS NOT NULL
         THEN 'acknowledged' ELSE 'active' END,
    'suppressed',
    _user_id,
    jsonb_build_object('suppressed_until', _suppress_until)
  );

  RETURN FOUND;
END;
$function$;

-- Function to get alert statistics
CREATE OR REPLACE FUNCTION public.get_alert_statistics(_team_id UUID DEFAULT NULL, _hours INTEGER DEFAULT 24)
RETURNS TABLE(
  total_alerts INTEGER,
  active_alerts INTEGER,
  acknowledged_alerts INTEGER,
  resolved_alerts INTEGER,
  critical_alerts INTEGER,
  high_alerts INTEGER,
  medium_alerts INTEGER,
  low_alerts INTEGER,
  avg_resolution_time_minutes NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    COUNT(*)::INTEGER as total_alerts,
    COUNT(*) FILTER (WHERE status = 'active')::INTEGER as active_alerts,
    COUNT(*) FILTER (WHERE status = 'acknowledged')::INTEGER as acknowledged_alerts,
    COUNT(*) FILTER (WHERE status = 'resolved')::INTEGER as resolved_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_alerts,
    COUNT(*) FILTER (WHERE severity = 'high')::INTEGER as high_alerts,
    COUNT(*) FILTER (WHERE severity = 'medium')::INTEGER as medium_alerts,
    COUNT(*) FILTER (WHERE severity = 'low')::INTEGER as low_alerts,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60.0)::NUMERIC as avg_resolution_time_minutes
  FROM public.alerts
  WHERE
    created_at > NOW() - INTERVAL '1 hour' * _hours
    AND (_team_id IS NULL OR team_id = _team_id);
$function$;

-- Add notification types for system alerts
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system_alert_critical';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system_alert_high';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system_alert_medium';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system_alert_resolved';
