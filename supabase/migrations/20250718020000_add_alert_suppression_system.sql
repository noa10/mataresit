-- Add alert suppression and rate limiting system
-- Migration: 20250718020000_add_alert_suppression_system.sql

-- Create alert suppression rules table
CREATE TABLE IF NOT EXISTS public.alert_suppression_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Rule configuration
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('duplicate', 'rate_limit', 'maintenance', 'grouping', 'threshold', 'custom')),
  conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Suppression settings
  suppression_duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_alerts_per_window INTEGER NOT NULL DEFAULT 5,
  window_size_minutes INTEGER NOT NULL DEFAULT 60,
  
  -- Rule metadata
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- Higher number = higher priority
  
  -- Ownership
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create maintenance windows table
CREATE TABLE IF NOT EXISTS public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Time configuration
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  
  -- Suppression configuration
  affected_systems JSONB DEFAULT '[]', -- Array of metric names or system identifiers
  affected_severities alert_severity[] DEFAULT ARRAY['critical', 'high', 'medium', 'low', 'info'],
  suppress_all BOOLEAN DEFAULT false,
  
  -- Notification settings
  notify_before_minutes INTEGER DEFAULT 30,
  notify_after_completion BOOLEAN DEFAULT true,
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  recurring BOOLEAN DEFAULT false,
  recurrence_config JSONB DEFAULT '{}', -- For recurring maintenance windows
  
  -- Ownership
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (end_time > start_time)
);

-- Create alert suppression log table
CREATE TABLE IF NOT EXISTS public.alert_suppression_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  
  -- Suppression details
  suppressed BOOLEAN NOT NULL,
  reason VARCHAR(100) NOT NULL,
  suppression_rule_id UUID REFERENCES public.alert_suppression_rules(id) ON DELETE SET NULL,
  maintenance_window_id UUID REFERENCES public.maintenance_windows(id) ON DELETE SET NULL,
  
  -- Timing
  suppress_until TIMESTAMP WITH TIME ZONE,
  
  -- Additional context
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert groups table for tracking grouped alerts
CREATE TABLE IF NOT EXISTS public.alert_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key VARCHAR(500) NOT NULL,
  
  -- Group details
  first_alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  last_alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  alert_count INTEGER DEFAULT 1,
  
  -- Group characteristics
  metric_name VARCHAR(255) NOT NULL,
  severity alert_severity NOT NULL,
  severities alert_severity[] DEFAULT ARRAY[]::alert_severity[],
  
  -- Timing
  first_alert_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_alert_at TIMESTAMP WITH TIME ZONE NOT NULL,
  time_span_minutes INTEGER DEFAULT 0,
  
  -- Suppression status
  suppression_applied BOOLEAN DEFAULT false,
  suppressed_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(group_key, first_alert_at)
);

-- Create alert group members table
CREATE TABLE IF NOT EXISTS public.alert_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.alert_groups(id) ON DELETE CASCADE NOT NULL,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  
  -- Member details
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suppressed BOOLEAN DEFAULT false,
  
  -- Constraints
  UNIQUE(group_id, alert_id)
);

-- Create rate limiting tracking table
CREATE TABLE IF NOT EXISTS public.alert_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rate limit scope
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  metric_name VARCHAR(255),
  severity alert_severity,
  
  -- Rate limit configuration
  limit_type VARCHAR(50) NOT NULL CHECK (limit_type IN ('rule', 'team', 'metric', 'severity', 'global')),
  max_alerts INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL,
  
  -- Current state
  current_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_alert_at TIMESTAMP WITH TIME ZONE,
  
  -- Reset tracking
  next_reset_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_suppression_rules_enabled ON public.alert_suppression_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_suppression_rules_team ON public.alert_suppression_rules(team_id);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_rules_priority ON public.alert_suppression_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_rules_type ON public.alert_suppression_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active ON public.maintenance_windows(start_time, end_time) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_team ON public.maintenance_windows(team_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_time_range ON public.maintenance_windows(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_alert ON public.alert_suppression_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_created ON public.alert_suppression_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_reason ON public.alert_suppression_log(reason);
CREATE INDEX IF NOT EXISTS idx_alert_suppression_log_suppressed ON public.alert_suppression_log(suppressed);

CREATE INDEX IF NOT EXISTS idx_alert_groups_key ON public.alert_groups(group_key);
CREATE INDEX IF NOT EXISTS idx_alert_groups_team ON public.alert_groups(team_id);
CREATE INDEX IF NOT EXISTS idx_alert_groups_metric ON public.alert_groups(metric_name);
CREATE INDEX IF NOT EXISTS idx_alert_groups_time_range ON public.alert_groups(first_alert_at, last_alert_at);
CREATE INDEX IF NOT EXISTS idx_alert_groups_suppression ON public.alert_groups(suppression_applied);

CREATE INDEX IF NOT EXISTS idx_alert_group_members_group ON public.alert_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_alert_group_members_alert ON public.alert_group_members(alert_id);

CREATE INDEX IF NOT EXISTS idx_alert_rate_limits_rule ON public.alert_rate_limits(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_rate_limits_team ON public.alert_rate_limits(team_id);
CREATE INDEX IF NOT EXISTS idx_alert_rate_limits_metric ON public.alert_rate_limits(metric_name);
CREATE INDEX IF NOT EXISTS idx_alert_rate_limits_window ON public.alert_rate_limits(window_start, next_reset_at);

-- Enable RLS on all tables
ALTER TABLE public.alert_suppression_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_suppression_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for alert_suppression_rules
CREATE POLICY "Users can manage suppression rules for their teams" ON public.alert_suppression_rules
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR team_id IS NULL -- Global rules visible to all
  );

-- RLS policies for maintenance_windows
CREATE POLICY "Users can manage maintenance windows for their teams" ON public.maintenance_windows
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR team_id IS NULL -- Global windows visible to all
  );

-- RLS policies for alert_suppression_log
CREATE POLICY "Users can view suppression logs for their teams" ON public.alert_suppression_log
  FOR SELECT USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
        OR team_id IS NULL
    )
  );

-- RLS policies for alert_groups
CREATE POLICY "Users can view alert groups for their teams" ON public.alert_groups
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IS NULL
  );

-- RLS policies for alert_group_members
CREATE POLICY "Users can view group members for their teams" ON public.alert_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM public.alert_groups WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
        OR team_id IS NULL
    )
  );

-- RLS policies for alert_rate_limits
CREATE POLICY "Users can view rate limits for their teams" ON public.alert_rate_limits
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IS NULL
  );

-- Add updated_at triggers
CREATE TRIGGER update_alert_suppression_rules_updated_at
  BEFORE UPDATE ON public.alert_suppression_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_maintenance_windows_updated_at
  BEFORE UPDATE ON public.maintenance_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_groups_updated_at
  BEFORE UPDATE ON public.alert_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_rate_limits_updated_at
  BEFORE UPDATE ON public.alert_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

-- Function to check if alert should be suppressed
CREATE OR REPLACE FUNCTION public.should_suppress_alert(
  _alert_id UUID,
  _rule_id UUID,
  _metric_name VARCHAR(255),
  _severity alert_severity,
  _team_id UUID DEFAULT NULL
)
RETURNS TABLE(
  should_suppress BOOLEAN,
  reason VARCHAR(100),
  suppress_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _alert_count INTEGER;
  _window_start TIMESTAMP WITH TIME ZONE;
  _suppression_rule RECORD;
  _maintenance_window RECORD;
BEGIN
  -- Check maintenance windows first
  SELECT * INTO _maintenance_window
  FROM public.maintenance_windows
  WHERE enabled = true
    AND start_time <= NOW()
    AND end_time >= NOW()
    AND (team_id = _team_id OR team_id IS NULL)
    AND (
      suppress_all = true 
      OR _metric_name = ANY(SELECT jsonb_array_elements_text(affected_systems))
      OR _severity = ANY(affected_severities)
    )
  ORDER BY priority DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 
      true,
      'maintenance_window'::VARCHAR(100),
      _maintenance_window.end_time,
      jsonb_build_object(
        'maintenance_window_id', _maintenance_window.id,
        'window_name', _maintenance_window.name
      );
    RETURN;
  END IF;

  -- Check for recent duplicate alerts
  SELECT COUNT(*) INTO _alert_count
  FROM public.alerts
  WHERE alert_rule_id = _rule_id
    AND status IN ('active', 'acknowledged')
    AND created_at >= NOW() - INTERVAL '30 minutes';

  IF _alert_count > 0 THEN
    RETURN QUERY SELECT 
      true,
      'duplicate_alert'::VARCHAR(100),
      NOW() + INTERVAL '30 minutes',
      jsonb_build_object('duplicate_count', _alert_count);
    RETURN;
  END IF;

  -- Check rate limiting
  SELECT COUNT(*) INTO _alert_count
  FROM public.alerts
  WHERE alert_rule_id = _rule_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  -- Get max alerts per hour from rule
  IF _alert_count >= (
    SELECT max_alerts_per_hour 
    FROM public.alert_rules 
    WHERE id = _rule_id
  ) THEN
    RETURN QUERY SELECT 
      true,
      'rate_limit_exceeded'::VARCHAR(100),
      NOW() + INTERVAL '1 hour',
      jsonb_build_object('current_count', _alert_count);
    RETURN;
  END IF;

  -- Check custom suppression rules
  FOR _suppression_rule IN
    SELECT *
    FROM public.alert_suppression_rules
    WHERE enabled = true
      AND (team_id = _team_id OR team_id IS NULL)
    ORDER BY priority DESC
  LOOP
    -- Simple condition checking (can be extended)
    IF _suppression_rule.conditions ? 'metric_name' THEN
      IF (_suppression_rule.conditions->>'metric_name') != _metric_name THEN
        CONTINUE;
      END IF;
    END IF;

    IF _suppression_rule.conditions ? 'severity' THEN
      IF NOT (_severity = ANY(
        SELECT jsonb_array_elements_text(_suppression_rule.conditions->'severity')::alert_severity
      )) THEN
        CONTINUE;
      END IF;
    END IF;

    -- Rule matches
    RETURN QUERY SELECT 
      true,
      'custom_rule'::VARCHAR(100),
      NOW() + (_suppression_rule.suppression_duration_minutes || ' minutes')::INTERVAL,
      jsonb_build_object(
        'rule_id', _suppression_rule.id,
        'rule_name', _suppression_rule.name,
        'rule_type', _suppression_rule.rule_type
      );
    RETURN;
  END LOOP;

  -- No suppression applied
  RETURN QUERY SELECT 
    false,
    'no_suppression'::VARCHAR(100),
    NULL::TIMESTAMP WITH TIME ZONE,
    '{}'::JSONB;
END;
$function$;

-- Function to create maintenance window
CREATE OR REPLACE FUNCTION public.create_maintenance_window(
  _name VARCHAR(255),
  _description TEXT,
  _start_time TIMESTAMP WITH TIME ZONE,
  _end_time TIMESTAMP WITH TIME ZONE,
  _affected_systems JSONB DEFAULT '[]',
  _affected_severities alert_severity[] DEFAULT ARRAY['critical', 'high', 'medium', 'low', 'info'],
  _suppress_all BOOLEAN DEFAULT false,
  _team_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _window_id UUID;
BEGIN
  INSERT INTO public.maintenance_windows (
    name,
    description,
    start_time,
    end_time,
    affected_systems,
    affected_severities,
    suppress_all,
    team_id,
    created_by
  ) VALUES (
    _name,
    _description,
    _start_time,
    _end_time,
    _affected_systems,
    _affected_severities,
    _suppress_all,
    _team_id,
    auth.uid()
  ) RETURNING id INTO _window_id;

  -- Log the maintenance window creation
  INSERT INTO public.alert_history (
    alert_id,
    event_type,
    event_description,
    performed_by,
    metadata
  ) SELECT 
    id,
    'maintenance_scheduled',
    'Maintenance window scheduled: ' || _name,
    auth.uid(),
    jsonb_build_object(
      'maintenance_window_id', _window_id,
      'start_time', _start_time,
      'end_time', _end_time,
      'suppress_all', _suppress_all
    )
  FROM public.alerts
  WHERE status IN ('active', 'acknowledged')
    AND (team_id = _team_id OR _team_id IS NULL);

  RETURN _window_id;
END;
$function$;

-- Function to clean up expired suppression data
CREATE OR REPLACE FUNCTION public.cleanup_expired_suppression_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _deleted_count INTEGER := 0;
BEGIN
  -- Clean up old suppression logs (older than 30 days)
  DELETE FROM public.alert_suppression_log
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  -- Clean up expired alert groups (older than 24 hours)
  DELETE FROM public.alert_groups
  WHERE last_alert_at < NOW() - INTERVAL '24 hours';

  -- Clean up expired rate limit entries
  DELETE FROM public.alert_rate_limits
  WHERE next_reset_at < NOW() - INTERVAL '1 hour';

  -- Clean up expired maintenance windows
  UPDATE public.maintenance_windows
  SET enabled = false
  WHERE end_time < NOW() AND enabled = true AND NOT recurring;

  RETURN _deleted_count;
END;
$function$;
