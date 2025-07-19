-- Add team escalation configurations for advanced severity management
-- Migration: 20250718010000_add_team_escalation_configs.sql

-- Create team escalation configurations table
CREATE TABLE IF NOT EXISTS public.team_escalation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  
  -- Business hours configuration
  business_hours JSONB NOT NULL DEFAULT '{
    "timezone": "UTC",
    "weekdays": {
      "start": "09:00",
      "end": "17:00"
    },
    "weekends": {
      "enabled": false
    }
  }',
  
  -- Escalation chain configuration
  escalation_chain JSONB NOT NULL DEFAULT '[]',
  
  -- Severity-specific overrides
  severity_overrides JSONB DEFAULT '{}',
  
  -- Contact assignments
  primary_contacts JSONB DEFAULT '[]', -- Array of user IDs
  escalation_contacts JSONB DEFAULT '[]', -- Array of user IDs
  
  -- Notification preferences
  notification_preferences JSONB DEFAULT '{
    "critical": {
      "immediate_channels": ["push", "sms", "in_app"],
      "escalation_channels": ["email", "slack", "webhook"]
    },
    "high": {
      "immediate_channels": ["push", "in_app"],
      "escalation_channels": ["email", "slack"]
    },
    "medium": {
      "immediate_channels": ["in_app"],
      "escalation_channels": ["email"]
    },
    "low": {
      "immediate_channels": ["in_app"],
      "escalation_channels": []
    },
    "info": {
      "immediate_channels": ["in_app"],
      "escalation_channels": []
    }
  }',
  
  -- Auto-resolution settings
  auto_resolution JSONB DEFAULT '{
    "critical": {
      "enabled": false
    },
    "high": {
      "enabled": false
    },
    "medium": {
      "enabled": true,
      "timeout_hours": 8
    },
    "low": {
      "enabled": true,
      "timeout_hours": 24
    },
    "info": {
      "enabled": true,
      "timeout_hours": 48
    }
  }',
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(team_id)
);

-- Create alert severity routing table
CREATE TABLE IF NOT EXISTS public.alert_severity_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  severity alert_severity NOT NULL,
  
  -- Routing configuration
  assigned_users JSONB DEFAULT '[]', -- Array of user IDs
  assigned_channels JSONB DEFAULT '[]', -- Array of channel IDs
  
  -- Escalation timing
  initial_delay_minutes INTEGER DEFAULT 0,
  escalation_interval_minutes INTEGER DEFAULT 30,
  max_escalation_level INTEGER DEFAULT 3,
  
  -- Business hours handling
  business_hours_only BOOLEAN DEFAULT false,
  weekend_escalation BOOLEAN DEFAULT true,
  
  -- Auto-actions
  auto_acknowledge_minutes INTEGER,
  auto_resolve_minutes INTEGER,
  
  -- Conditions
  conditions JSONB DEFAULT '{}', -- Additional routing conditions
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- 1 = highest priority for routing conflicts
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(team_id, severity)
);

-- Create alert assignment tracking table
CREATE TABLE IF NOT EXISTS public.alert_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  
  -- Assignment details
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_reason VARCHAR(100), -- 'manual', 'auto_severity', 'escalation', 'rotation'
  
  -- Assignment metadata
  assignment_level INTEGER DEFAULT 1, -- Which escalation level triggered this assignment
  expected_response_time INTEGER, -- Expected response time in minutes
  
  -- Status tracking
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  response_time_minutes INTEGER, -- Actual response time
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create on-call schedules table
CREATE TABLE IF NOT EXISTS public.on_call_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  
  -- Schedule details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Schedule configuration
  schedule_type VARCHAR(50) NOT NULL DEFAULT 'rotation', -- 'rotation', 'fixed', 'follow_the_sun'
  rotation_config JSONB DEFAULT '{}', -- Rotation-specific configuration
  
  -- Time configuration
  timezone VARCHAR(100) DEFAULT 'UTC',
  effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_until TIMESTAMP WITH TIME ZONE,
  
  -- Severity filters
  applicable_severities alert_severity[] DEFAULT ARRAY['critical', 'high', 'medium', 'low', 'info'],
  
  -- Override settings
  override_business_hours BOOLEAN DEFAULT false,
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(team_id, name)
);

-- Create on-call schedule entries table
CREATE TABLE IF NOT EXISTS public.on_call_schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.on_call_schedules(id) ON DELETE CASCADE NOT NULL,
  
  -- Entry details
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Entry configuration
  is_primary BOOLEAN DEFAULT true,
  backup_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Override information
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  original_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (end_time > start_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_escalation_configs_team ON public.team_escalation_configs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_escalation_configs_enabled ON public.team_escalation_configs(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_alert_severity_routing_team_severity ON public.alert_severity_routing(team_id, severity);
CREATE INDEX IF NOT EXISTS idx_alert_severity_routing_enabled ON public.alert_severity_routing(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_severity_routing_priority ON public.alert_severity_routing(priority);

CREATE INDEX IF NOT EXISTS idx_alert_assignments_alert ON public.alert_assignments(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_assignments_assigned_to ON public.alert_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_alert_assignments_created_desc ON public.alert_assignments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_on_call_schedules_team ON public.on_call_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_enabled ON public.on_call_schedules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_effective ON public.on_call_schedules(effective_from, effective_until);

CREATE INDEX IF NOT EXISTS idx_on_call_schedule_entries_schedule ON public.on_call_schedule_entries(schedule_id);
CREATE INDEX IF NOT EXISTS idx_on_call_schedule_entries_user ON public.on_call_schedule_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_on_call_schedule_entries_time_range ON public.on_call_schedule_entries(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_on_call_schedule_entries_current ON public.on_call_schedule_entries(start_time, end_time) 
  WHERE start_time <= NOW() AND end_time >= NOW();

-- Enable RLS on all tables
ALTER TABLE public.team_escalation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_severity_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_call_schedule_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_escalation_configs
CREATE POLICY "Users can manage escalation configs for their teams" ON public.team_escalation_configs
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for alert_severity_routing
CREATE POLICY "Users can manage severity routing for their teams" ON public.alert_severity_routing
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for alert_assignments
CREATE POLICY "Users can view alert assignments in their teams" ON public.alert_assignments
  FOR SELECT USING (
    alert_id IN (
      SELECT id FROM public.alerts WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create alert assignments in their teams" ON public.alert_assignments
  FOR INSERT WITH CHECK (
    alert_id IN (
      SELECT id FROM public.alerts WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

-- RLS policies for on_call_schedules
CREATE POLICY "Users can manage on-call schedules for their teams" ON public.on_call_schedules
  FOR ALL USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS policies for on_call_schedule_entries
CREATE POLICY "Users can view on-call entries for their teams" ON public.on_call_schedule_entries
  FOR SELECT USING (
    schedule_id IN (
      SELECT id FROM public.on_call_schedules WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage on-call entries for their teams" ON public.on_call_schedule_entries
  FOR ALL USING (
    schedule_id IN (
      SELECT id FROM public.on_call_schedules WHERE 
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_team_escalation_configs_updated_at
  BEFORE UPDATE ON public.team_escalation_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_severity_routing_updated_at
  BEFORE UPDATE ON public.alert_severity_routing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_alert_assignments_updated_at
  BEFORE UPDATE ON public.alert_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_on_call_schedules_updated_at
  BEFORE UPDATE ON public.on_call_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

CREATE TRIGGER update_on_call_schedule_entries_updated_at
  BEFORE UPDATE ON public.on_call_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerting_updated_at();

-- Function to get current on-call user for a team
CREATE OR REPLACE FUNCTION public.get_current_on_call_user(_team_id UUID, _severity alert_severity DEFAULT 'medium')
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  is_primary BOOLEAN,
  schedule_name TEXT,
  backup_user_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT 
    ose.user_id,
    p.full_name,
    p.email,
    ose.is_primary,
    ocs.name as schedule_name,
    ose.backup_user_id
  FROM public.on_call_schedule_entries ose
  JOIN public.on_call_schedules ocs ON ose.schedule_id = ocs.id
  JOIN public.profiles p ON ose.user_id = p.id
  WHERE 
    ocs.team_id = _team_id
    AND ocs.enabled = true
    AND _severity = ANY(ocs.applicable_severities)
    AND ose.start_time <= NOW()
    AND ose.end_time >= NOW()
  ORDER BY ose.is_primary DESC, ocs.created_at ASC
  LIMIT 1;
$function$;

-- Function to assign alert to user
CREATE OR REPLACE FUNCTION public.assign_alert_to_user(
  _alert_id UUID,
  _assigned_to UUID,
  _assigned_by UUID DEFAULT NULL,
  _assignment_reason VARCHAR(100) DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _assignment_id UUID;
  _alert_severity alert_severity;
  _expected_response_time INTEGER;
BEGIN
  -- Get alert severity for response time calculation
  SELECT severity INTO _alert_severity FROM public.alerts WHERE id = _alert_id;
  
  -- Calculate expected response time based on severity
  _expected_response_time := CASE _alert_severity
    WHEN 'critical' THEN 15
    WHEN 'high' THEN 30
    WHEN 'medium' THEN 60
    WHEN 'low' THEN 240
    WHEN 'info' THEN 480
    ELSE 60
  END;
  
  -- Create assignment record
  INSERT INTO public.alert_assignments (
    alert_id,
    assigned_to,
    assigned_by,
    assignment_reason,
    expected_response_time
  ) VALUES (
    _alert_id,
    _assigned_to,
    COALESCE(_assigned_by, auth.uid()),
    _assignment_reason,
    _expected_response_time
  ) RETURNING id INTO _assignment_id;
  
  -- Add assignment event to alert history
  INSERT INTO public.alert_history (
    alert_id,
    event_type,
    event_description,
    performed_by,
    metadata
  ) VALUES (
    _alert_id,
    'assigned',
    'Alert assigned to user',
    COALESCE(_assigned_by, auth.uid()),
    jsonb_build_object(
      'assigned_to', _assigned_to,
      'assignment_reason', _assignment_reason,
      'expected_response_time', _expected_response_time
    )
  );
  
  RETURN _assignment_id;
END;
$function$;
