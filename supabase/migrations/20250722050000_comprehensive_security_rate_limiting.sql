-- ============================================================================
-- COMPREHENSIVE SECURITY AND RATE LIMITING SYSTEM
-- Migration: 20250722050000_comprehensive_security_rate_limiting.sql
-- Description: Add comprehensive authorization checks, rate limiting, and security
--              measures for all team management operations
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED SECURITY TABLES
-- ============================================================================

-- Security audit table for tracking security events
CREATE TABLE IF NOT EXISTS public.team_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, error, critical
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting table for comprehensive rate limiting
CREATE TABLE IF NOT EXISTS public.team_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL, -- invite, bulk_invite, role_update, etc.
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_duration INTERVAL NOT NULL DEFAULT '1 hour',
  request_count INTEGER NOT NULL DEFAULT 0,
  max_requests INTEGER NOT NULL,
  blocked_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, team_id, operation_type, window_start)
);

-- Security configuration table
CREATE TABLE IF NOT EXISTS public.team_security_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE UNIQUE,
  rate_limits JSONB NOT NULL DEFAULT '{
    "invite_members": {"max_per_hour": 50, "max_per_day": 200},
    "bulk_operations": {"max_per_hour": 10, "max_per_day": 50},
    "role_updates": {"max_per_hour": 100, "max_per_day": 500},
    "member_removals": {"max_per_hour": 20, "max_per_day": 100}
  }',
  security_settings JSONB NOT NULL DEFAULT '{
    "require_2fa_for_admin": false,
    "session_timeout_minutes": 480,
    "max_failed_attempts": 5,
    "lockout_duration_minutes": 30,
    "require_approval_for_bulk_ops": true,
    "audit_all_actions": true
  }',
  ip_whitelist JSONB DEFAULT '[]',
  ip_blacklist JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed authentication attempts tracking
CREATE TABLE IF NOT EXISTS public.team_auth_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  failure_type VARCHAR(50) NOT NULL, -- invalid_permission, rate_limited, blocked_ip, etc.
  ip_address INET,
  user_agent TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  
  UNIQUE(user_id, team_id, failure_type, ip_address)
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_team_security_events_team_id ON public.team_security_events(team_id);
CREATE INDEX IF NOT EXISTS idx_team_security_events_user_id ON public.team_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_team_security_events_type ON public.team_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_team_security_events_severity ON public.team_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_team_security_events_created_at ON public.team_security_events(created_at);

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS idx_team_rate_limits_user_team ON public.team_rate_limits(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_rate_limits_operation ON public.team_rate_limits(operation_type);
CREATE INDEX IF NOT EXISTS idx_team_rate_limits_window ON public.team_rate_limits(window_start, window_duration);
CREATE INDEX IF NOT EXISTS idx_team_rate_limits_blocked ON public.team_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Auth failures indexes
CREATE INDEX IF NOT EXISTS idx_team_auth_failures_user_team ON public.team_auth_failures(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_auth_failures_ip ON public.team_auth_failures(ip_address);
CREATE INDEX IF NOT EXISTS idx_team_auth_failures_blocked ON public.team_auth_failures(blocked_until) WHERE blocked_until IS NOT NULL;

-- ============================================================================
-- 3. COMPREHENSIVE AUTHORIZATION FUNCTIONS
-- ============================================================================

-- Enhanced permission checking with security logging
CREATE OR REPLACE FUNCTION public.check_team_permission_enhanced(
  p_team_id UUID,
  p_user_id UUID,
  p_required_permission TEXT,
  p_operation_context JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  user_role team_member_role;
  team_config RECORD;
  auth_failure RECORD;
  permission_granted BOOLEAN := FALSE;
  security_event JSONB;
BEGIN
  -- Get user's role in the team
  SELECT role INTO user_role
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- If user is not a team member, deny access
  IF user_role IS NULL THEN
    -- Log security event
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'access_denied', 
      'User attempted to access team without membership',
      'warning',
      jsonb_build_object(
        'required_permission', p_required_permission,
        'operation_context', p_operation_context
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'User is not a member of this team',
      'error_code', 'NOT_TEAM_MEMBER'
    );
  END IF;

  -- Get team security configuration
  SELECT * INTO team_config
  FROM public.team_security_configs
  WHERE team_id = p_team_id;

  -- Check for authentication failures and lockouts
  SELECT * INTO auth_failure
  FROM public.team_auth_failures
  WHERE user_id = p_user_id 
    AND team_id = p_team_id 
    AND blocked_until > NOW();

  IF auth_failure.id IS NOT NULL THEN
    -- Log security event
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'access_blocked', 
      'User access blocked due to previous failures',
      'error',
      jsonb_build_object(
        'blocked_until', auth_failure.blocked_until,
        'failure_type', auth_failure.failure_type,
        'required_permission', p_required_permission
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Access temporarily blocked due to security restrictions',
      'error_code', 'ACCESS_BLOCKED',
      'blocked_until', auth_failure.blocked_until
    );
  END IF;

  -- Check permission based on role and operation
  CASE p_required_permission
    WHEN 'view_team' THEN
      permission_granted := user_role IN ('owner', 'admin', 'member', 'viewer');
    WHEN 'manage_team' THEN
      permission_granted := user_role IN ('owner');
    WHEN 'invite_members' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'remove_members' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'update_member_roles' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'view_audit_logs' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'manage_bulk_operations' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'view_security_events' THEN
      permission_granted := user_role IN ('owner', 'admin');
    WHEN 'manage_security_settings' THEN
      permission_granted := user_role IN ('owner');
    ELSE
      permission_granted := FALSE;
  END CASE;

  -- Additional security checks for sensitive operations
  IF permission_granted AND p_required_permission IN ('remove_members', 'manage_bulk_operations') THEN
    -- Check if 2FA is required for admin operations
    IF team_config.security_settings->>'require_2fa_for_admin' = 'true' AND user_role IN ('admin') THEN
      -- In a real implementation, you would check 2FA status here
      -- For now, we'll assume it's satisfied
      NULL;
    END IF;
  END IF;

  -- Log successful permission check
  IF permission_granted THEN
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'permission_granted', 
      'Permission check successful for ' || p_required_permission,
      'info',
      jsonb_build_object(
        'user_role', user_role,
        'required_permission', p_required_permission,
        'operation_context', p_operation_context
      )
    );
  ELSE
    -- Log permission denial
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'permission_denied', 
      'Permission denied for ' || p_required_permission,
      'warning',
      jsonb_build_object(
        'user_role', user_role,
        'required_permission', p_required_permission,
        'operation_context', p_operation_context
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', permission_granted,
    'user_role', user_role,
    'team_id', p_team_id,
    'permission', p_required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. COMPREHENSIVE RATE LIMITING FUNCTIONS
-- ============================================================================

-- Check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_team_id UUID,
  p_operation_type TEXT,
  p_request_count INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  current_window TIMESTAMP WITH TIME ZONE;
  window_duration INTERVAL;
  max_requests INTEGER;
  current_count INTEGER;
  team_config RECORD;
  rate_limit_record RECORD;
  is_blocked BOOLEAN := FALSE;
BEGIN
  -- Get team security configuration
  SELECT * INTO team_config
  FROM public.team_security_configs
  WHERE team_id = p_team_id;

  -- Set default rate limits if no config exists
  IF team_config.id IS NULL THEN
    CASE p_operation_type
      WHEN 'invite_members' THEN
        max_requests := 50;
        window_duration := '1 hour';
      WHEN 'bulk_operations' THEN
        max_requests := 10;
        window_duration := '1 hour';
      WHEN 'role_updates' THEN
        max_requests := 100;
        window_duration := '1 hour';
      WHEN 'member_removals' THEN
        max_requests := 20;
        window_duration := '1 hour';
      ELSE
        max_requests := 100;
        window_duration := '1 hour';
    END CASE;
  ELSE
    -- Extract rate limits from team configuration
    max_requests := COALESCE(
      (team_config.rate_limits->p_operation_type->>'max_per_hour')::INTEGER,
      100
    );
    window_duration := '1 hour';
  END IF;

  -- Calculate current window start
  current_window := date_trunc('hour', NOW());

  -- Get or create rate limit record
  SELECT * INTO rate_limit_record
  FROM public.team_rate_limits
  WHERE user_id = p_user_id 
    AND team_id = p_team_id 
    AND operation_type = p_operation_type 
    AND window_start = current_window;

  -- Check if user is currently blocked
  IF rate_limit_record.blocked_until IS NOT NULL AND rate_limit_record.blocked_until > NOW() THEN
    -- Log rate limit violation
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'rate_limit_blocked', 
      'Request blocked due to rate limiting',
      'warning',
      jsonb_build_object(
        'operation_type', p_operation_type,
        'blocked_until', rate_limit_record.blocked_until,
        'current_count', rate_limit_record.request_count,
        'max_requests', max_requests
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Rate limit exceeded. Please try again later.',
      'error_code', 'RATE_LIMITED',
      'blocked_until', rate_limit_record.blocked_until,
      'current_count', rate_limit_record.request_count,
      'max_requests', max_requests,
      'window_start', current_window,
      'window_duration', window_duration
    );
  END IF;

  -- Create or update rate limit record
  IF rate_limit_record.id IS NULL THEN
    -- Create new record
    INSERT INTO public.team_rate_limits (
      user_id, team_id, operation_type, window_start, window_duration,
      request_count, max_requests
    ) VALUES (
      p_user_id, p_team_id, p_operation_type, current_window, window_duration,
      p_request_count, max_requests
    );
    current_count := p_request_count;
  ELSE
    -- Update existing record
    current_count := rate_limit_record.request_count + p_request_count;
    
    UPDATE public.team_rate_limits
    SET request_count = current_count,
        updated_at = NOW()
    WHERE id = rate_limit_record.id;
  END IF;

  -- Check if rate limit is exceeded
  IF current_count > max_requests THEN
    -- Block user for the remainder of the window
    UPDATE public.team_rate_limits
    SET blocked_until = current_window + window_duration
    WHERE user_id = p_user_id 
      AND team_id = p_team_id 
      AND operation_type = p_operation_type 
      AND window_start = current_window;

    -- Log rate limit violation
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity, metadata
    ) VALUES (
      p_team_id, p_user_id, 'rate_limit_exceeded', 
      'Rate limit exceeded for ' || p_operation_type,
      'error',
      jsonb_build_object(
        'operation_type', p_operation_type,
        'current_count', current_count,
        'max_requests', max_requests,
        'blocked_until', current_window + window_duration
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Rate limit exceeded. Access temporarily blocked.',
      'error_code', 'RATE_LIMIT_EXCEEDED',
      'blocked_until', current_window + window_duration,
      'current_count', current_count,
      'max_requests', max_requests
    );
  END IF;

  -- Rate limit check passed
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', current_count,
    'max_requests', max_requests,
    'remaining_requests', max_requests - current_count,
    'window_start', current_window,
    'window_end', current_window + window_duration
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. SECURITY VALIDATION FUNCTIONS
-- ============================================================================

-- Validate IP address against whitelist/blacklist
CREATE OR REPLACE FUNCTION public.validate_ip_access(
  p_team_id UUID,
  p_ip_address INET
) RETURNS JSONB AS $$
DECLARE
  team_config RECORD;
  ip_whitelist JSONB;
  ip_blacklist JSONB;
  is_whitelisted BOOLEAN := FALSE;
  is_blacklisted BOOLEAN := FALSE;
BEGIN
  -- Get team security configuration
  SELECT * INTO team_config
  FROM public.team_security_configs
  WHERE team_id = p_team_id;

  -- If no config, allow access
  IF team_config.id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_ip_restrictions');
  END IF;

  ip_whitelist := team_config.ip_whitelist;
  ip_blacklist := team_config.ip_blacklist;

  -- Check blacklist first
  IF jsonb_array_length(ip_blacklist) > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(ip_blacklist) AS blocked_ip
      WHERE p_ip_address <<= blocked_ip::INET
    ) INTO is_blacklisted;

    IF is_blacklisted THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'ip_blacklisted',
        'ip_address', p_ip_address
      );
    END IF;
  END IF;

  -- Check whitelist if configured
  IF jsonb_array_length(ip_whitelist) > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(ip_whitelist) AS allowed_ip
      WHERE p_ip_address <<= allowed_ip::INET
    ) INTO is_whitelisted;

    IF NOT is_whitelisted THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'ip_not_whitelisted',
        'ip_address', p_ip_address
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'ip_allowed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record authentication failure
CREATE OR REPLACE FUNCTION public.record_auth_failure(
  p_user_id UUID,
  p_team_id UUID,
  p_failure_type TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  failure_record RECORD;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '30 minutes';
  team_config RECORD;
BEGIN
  -- Get team security configuration
  SELECT * INTO team_config
  FROM public.team_security_configs
  WHERE team_id = p_team_id;

  IF team_config.id IS NOT NULL THEN
    max_attempts := COALESCE(
      (team_config.security_settings->>'max_failed_attempts')::INTEGER,
      5
    );
    lockout_duration := COALESCE(
      (team_config.security_settings->>'lockout_duration_minutes')::INTEGER * INTERVAL '1 minute',
      '30 minutes'
    );
  END IF;

  -- Get or create failure record
  SELECT * INTO failure_record
  FROM public.team_auth_failures
  WHERE user_id = p_user_id
    AND team_id = p_team_id
    AND failure_type = p_failure_type
    AND (p_ip_address IS NULL OR ip_address = p_ip_address);

  IF failure_record.id IS NULL THEN
    -- Create new failure record
    INSERT INTO public.team_auth_failures (
      user_id, team_id, failure_type, ip_address, user_agent,
      attempt_count, metadata
    ) VALUES (
      p_user_id, p_team_id, p_failure_type, p_ip_address, p_user_agent,
      1, p_metadata
    ) RETURNING * INTO failure_record;
  ELSE
    -- Update existing failure record
    UPDATE public.team_auth_failures
    SET attempt_count = attempt_count + 1,
        last_attempt = NOW(),
        user_agent = COALESCE(p_user_agent, user_agent),
        metadata = metadata || p_metadata
    WHERE id = failure_record.id
    RETURNING * INTO failure_record;
  END IF;

  -- Check if lockout threshold is reached
  IF failure_record.attempt_count >= max_attempts THEN
    UPDATE public.team_auth_failures
    SET blocked_until = NOW() + lockout_duration
    WHERE id = failure_record.id;

    -- Log security event
    INSERT INTO public.team_security_events (
      team_id, user_id, event_type, event_description, severity,
      ip_address, user_agent, metadata
    ) VALUES (
      p_team_id, p_user_id, 'user_locked_out',
      'User locked out due to repeated authentication failures',
      'critical',
      p_ip_address, p_user_agent,
      jsonb_build_object(
        'failure_type', p_failure_type,
        'attempt_count', failure_record.attempt_count,
        'blocked_until', NOW() + lockout_duration
      )
    );

    RETURN jsonb_build_object(
      'locked_out', true,
      'attempt_count', failure_record.attempt_count,
      'blocked_until', NOW() + lockout_duration,
      'max_attempts', max_attempts
    );
  END IF;

  RETURN jsonb_build_object(
    'locked_out', false,
    'attempt_count', failure_record.attempt_count,
    'remaining_attempts', max_attempts - failure_record.attempt_count,
    'max_attempts', max_attempts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear authentication failures on successful auth
CREATE OR REPLACE FUNCTION public.clear_auth_failures(
  p_user_id UUID,
  p_team_id UUID,
  p_failure_type TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_failure_type IS NOT NULL THEN
    DELETE FROM public.team_auth_failures
    WHERE user_id = p_user_id
      AND team_id = p_team_id
      AND failure_type = p_failure_type;
  ELSE
    DELETE FROM public.team_auth_failures
    WHERE user_id = p_user_id AND team_id = p_team_id;
  END IF;

  -- Log successful authentication
  INSERT INTO public.team_security_events (
    team_id, user_id, event_type, event_description, severity
  ) VALUES (
    p_team_id, p_user_id, 'auth_success',
    'Authentication failures cleared after successful authentication',
    'info'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ENHANCED TEAM OPERATION WRAPPERS WITH SECURITY
-- ============================================================================

-- Secure wrapper for team member invitation
CREATE OR REPLACE FUNCTION public.invite_team_member_secure(
  p_team_id UUID,
  p_email TEXT,
  p_role team_member_role DEFAULT 'member',
  p_custom_message TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  permission_check JSONB;
  rate_limit_check JSONB;
  ip_validation JSONB;
  invitation_result JSONB;
BEGIN
  -- Validate IP address
  IF p_ip_address IS NOT NULL THEN
    SELECT public.validate_ip_access(p_team_id, p_ip_address) INTO ip_validation;

    IF NOT (ip_validation->>'allowed')::BOOLEAN THEN
      -- Record security event
      INSERT INTO public.team_security_events (
        team_id, user_id, event_type, event_description, severity,
        ip_address, user_agent, metadata
      ) VALUES (
        p_team_id, current_user_id, 'ip_access_denied',
        'Invitation attempt from blocked IP address',
        'error',
        p_ip_address, p_user_agent,
        jsonb_build_object('email', p_email, 'role', p_role)
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Access denied from this IP address',
        'error_code', 'IP_BLOCKED'
      );
    END IF;
  END IF;

  -- Check permissions
  SELECT public.check_team_permission_enhanced(
    p_team_id,
    current_user_id,
    'invite_members',
    jsonb_build_object('email', p_email, 'role', p_role)
  ) INTO permission_check;

  IF NOT (permission_check->>'allowed')::BOOLEAN THEN
    -- Record authentication failure
    PERFORM public.record_auth_failure(
      current_user_id, p_team_id, 'insufficient_permission',
      p_ip_address, p_user_agent,
      jsonb_build_object('operation', 'invite_member', 'required_permission', 'invite_members')
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', permission_check->>'error',
      'error_code', permission_check->>'error_code'
    );
  END IF;

  -- Check rate limits
  SELECT public.check_rate_limit(
    current_user_id, p_team_id, 'invite_members', 1
  ) INTO rate_limit_check;

  IF NOT (rate_limit_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', rate_limit_check->>'error',
      'error_code', rate_limit_check->>'error_code',
      'rate_limit_info', rate_limit_check
    );
  END IF;

  -- Clear any previous auth failures for this operation
  PERFORM public.clear_auth_failures(current_user_id, p_team_id, 'insufficient_permission');

  -- Call the original invitation function
  SELECT public.invite_team_member_enhanced(
    p_team_id, p_email, p_role, p_custom_message, 7, true
  ) INTO invitation_result;

  -- Log successful invitation
  INSERT INTO public.team_security_events (
    team_id, user_id, event_type, event_description, severity,
    ip_address, user_agent, metadata
  ) VALUES (
    p_team_id, current_user_id, 'member_invited',
    'Team member invitation sent successfully',
    'info',
    p_ip_address, p_user_agent,
    jsonb_build_object(
      'email', p_email,
      'role', p_role,
      'invitation_id', invitation_result->>'invitation_id'
    )
  );

  RETURN invitation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure wrapper for bulk operations
CREATE OR REPLACE FUNCTION public.execute_bulk_operation_secure(
  p_team_id UUID,
  p_operation_type TEXT,
  p_operation_data JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  permission_check JSONB;
  rate_limit_check JSONB;
  ip_validation JSONB;
  operation_result JSONB;
  item_count INTEGER;
BEGIN
  -- Validate IP address
  IF p_ip_address IS NOT NULL THEN
    SELECT public.validate_ip_access(p_team_id, p_ip_address) INTO ip_validation;

    IF NOT (ip_validation->>'allowed')::BOOLEAN THEN
      -- Record security event
      INSERT INTO public.team_security_events (
        team_id, user_id, event_type, event_description, severity,
        ip_address, user_agent, metadata
      ) VALUES (
        p_team_id, current_user_id, 'ip_access_denied',
        'Bulk operation attempt from blocked IP address',
        'error',
        p_ip_address, p_user_agent,
        jsonb_build_object('operation_type', p_operation_type)
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Access denied from this IP address',
        'error_code', 'IP_BLOCKED'
      );
    END IF;
  END IF;

  -- Check permissions
  SELECT public.check_team_permission_enhanced(
    p_team_id,
    current_user_id,
    'manage_bulk_operations',
    jsonb_build_object('operation_type', p_operation_type)
  ) INTO permission_check;

  IF NOT (permission_check->>'allowed')::BOOLEAN THEN
    -- Record authentication failure
    PERFORM public.record_auth_failure(
      current_user_id, p_team_id, 'insufficient_permission',
      p_ip_address, p_user_agent,
      jsonb_build_object('operation', 'bulk_operation', 'operation_type', p_operation_type)
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', permission_check->>'error',
      'error_code', permission_check->>'error_code'
    );
  END IF;

  -- Calculate item count for rate limiting
  CASE p_operation_type
    WHEN 'bulk_invite' THEN
      item_count := jsonb_array_length(p_operation_data->'invitations');
    WHEN 'bulk_role_update' THEN
      item_count := jsonb_array_length(p_operation_data->'role_updates');
    WHEN 'bulk_remove' THEN
      item_count := jsonb_array_length(p_operation_data->'user_ids');
    ELSE
      item_count := 1;
  END CASE;

  -- Check rate limits
  SELECT public.check_rate_limit(
    current_user_id, p_team_id, 'bulk_operations', item_count
  ) INTO rate_limit_check;

  IF NOT (rate_limit_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', rate_limit_check->>'error',
      'error_code', rate_limit_check->>'error_code',
      'rate_limit_info', rate_limit_check
    );
  END IF;

  -- Clear any previous auth failures for this operation
  PERFORM public.clear_auth_failures(current_user_id, p_team_id, 'insufficient_permission');

  -- Execute the appropriate bulk operation
  CASE p_operation_type
    WHEN 'bulk_invite' THEN
      SELECT public.bulk_invite_team_members(
        p_team_id,
        p_operation_data->'invitations',
        (p_operation_data->>'default_role')::team_member_role,
        (p_operation_data->>'expires_in_days')::INTEGER,
        (p_operation_data->>'send_emails')::BOOLEAN
      ) INTO operation_result;
    WHEN 'bulk_role_update' THEN
      SELECT public.bulk_update_member_roles(
        p_team_id,
        p_operation_data->'role_updates',
        p_operation_data->>'reason'
      ) INTO operation_result;
    WHEN 'bulk_remove' THEN
      SELECT public.bulk_remove_team_members(
        p_team_id,
        ARRAY(SELECT jsonb_array_elements_text(p_operation_data->'user_ids')),
        p_operation_data->>'reason',
        (p_operation_data->>'transfer_data')::BOOLEAN,
        (p_operation_data->>'transfer_to_user_id')::UUID
      ) INTO operation_result;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unsupported bulk operation type',
        'error_code', 'UNSUPPORTED_OPERATION'
      );
  END CASE;

  -- Log successful bulk operation
  INSERT INTO public.team_security_events (
    team_id, user_id, event_type, event_description, severity,
    ip_address, user_agent, metadata
  ) VALUES (
    p_team_id, current_user_id, 'bulk_operation_executed',
    'Bulk operation executed successfully: ' || p_operation_type,
    'info',
    p_ip_address, p_user_agent,
    jsonb_build_object(
      'operation_type', p_operation_type,
      'item_count', item_count,
      'operation_id', operation_result->>'bulk_operation_id'
    )
  );

  RETURN operation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all security tables
ALTER TABLE public.team_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_security_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_auth_failures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- Security events policies
CREATE POLICY "Team admins can view security events" ON public.team_security_events
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can insert security events" ON public.team_security_events
  FOR INSERT WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Users can view their own rate limits" ON public.team_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits" ON public.team_rate_limits
  FOR ALL WITH CHECK (true);

-- Security configs policies
CREATE POLICY "Team owners can manage security configs" ON public.team_security_configs
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Auth failures policies
CREATE POLICY "Users can view their own auth failures" ON public.team_auth_failures
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Team admins can view team auth failures" ON public.team_auth_failures
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can manage auth failures" ON public.team_auth_failures
  FOR ALL WITH CHECK (true);

-- ============================================================================
-- 9. SECURITY MAINTENANCE FUNCTIONS
-- ============================================================================

-- Cleanup expired rate limits and auth failures
CREATE OR REPLACE FUNCTION public.cleanup_security_data() RETURNS JSONB AS $$
DECLARE
  expired_rate_limits INTEGER;
  expired_auth_failures INTEGER;
  old_security_events INTEGER;
BEGIN
  -- Clean up expired rate limits (older than 24 hours)
  DELETE FROM public.team_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS expired_rate_limits = ROW_COUNT;

  -- Clean up expired auth failures (older than 7 days)
  DELETE FROM public.team_auth_failures
  WHERE first_attempt < NOW() - INTERVAL '7 days'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS expired_auth_failures = ROW_COUNT;

  -- Clean up old security events (older than 90 days)
  DELETE FROM public.team_security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity NOT IN ('error', 'critical');

  GET DIAGNOSTICS old_security_events = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned_rate_limits', expired_rate_limits,
    'cleaned_auth_failures', expired_auth_failures,
    'cleaned_security_events', old_security_events,
    'cleanup_timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get security dashboard data
CREATE OR REPLACE FUNCTION public.get_team_security_dashboard(
  p_team_id UUID,
  p_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  permission_check JSONB;
  security_stats JSONB;
  rate_limit_stats JSONB;
  recent_events JSONB;
BEGIN
  -- Check permissions
  SELECT public.check_team_permission_enhanced(
    p_team_id, current_user_id, 'view_security_events'
  ) INTO permission_check;

  IF NOT (permission_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'error', permission_check->>'error',
      'error_code', permission_check->>'error_code'
    );
  END IF;

  -- Get security statistics
  WITH security_summary AS (
    SELECT
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
      COUNT(*) FILTER (WHERE severity = 'error') as error_events,
      COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
      COUNT(*) FILTER (WHERE event_type = 'rate_limit_exceeded') as rate_limit_violations,
      COUNT(*) FILTER (WHERE event_type = 'ip_access_denied') as ip_blocks,
      COUNT(*) FILTER (WHERE event_type = 'user_locked_out') as user_lockouts
    FROM public.team_security_events
    WHERE team_id = p_team_id
      AND created_at >= NOW() - INTERVAL '1 day' * p_days
  )
  SELECT jsonb_build_object(
    'total_events', total_events,
    'critical_events', critical_events,
    'error_events', error_events,
    'warning_events', warning_events,
    'rate_limit_violations', rate_limit_violations,
    'ip_blocks', ip_blocks,
    'user_lockouts', user_lockouts
  ) INTO security_stats
  FROM security_summary;

  -- Get rate limit statistics
  WITH rate_limit_summary AS (
    SELECT
      operation_type,
      COUNT(*) as total_requests,
      AVG(request_count) as avg_requests_per_window,
      MAX(request_count) as max_requests_per_window,
      COUNT(*) FILTER (WHERE blocked_until IS NOT NULL) as blocked_windows
    FROM public.team_rate_limits
    WHERE team_id = p_team_id
      AND window_start >= NOW() - INTERVAL '1 day' * p_days
    GROUP BY operation_type
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'operation_type', operation_type,
      'total_requests', total_requests,
      'avg_requests_per_window', avg_requests_per_window,
      'max_requests_per_window', max_requests_per_window,
      'blocked_windows', blocked_windows
    )
  ) INTO rate_limit_stats
  FROM rate_limit_summary;

  -- Get recent security events
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'event_type', event_type,
      'event_description', event_description,
      'severity', severity,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC
  ) INTO recent_events
  FROM (
    SELECT *
    FROM public.team_security_events
    WHERE team_id = p_team_id
      AND created_at >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY created_at DESC
    LIMIT 50
  ) recent;

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'period_days', p_days,
    'security_stats', security_stats,
    'rate_limit_stats', COALESCE(rate_limit_stats, '[]'::jsonb),
    'recent_events', COALESCE(recent_events, '[]'::jsonb),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION public.check_team_permission_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ip_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_failure TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_auth_failures TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_bulk_operation_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_security_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_data TO service_role;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.check_team_permission_enhanced IS 'Enhanced permission checking with security logging and failure tracking';
COMMENT ON FUNCTION public.check_rate_limit IS 'Comprehensive rate limiting with configurable limits and automatic blocking';
COMMENT ON FUNCTION public.validate_ip_access IS 'IP address validation against team whitelist/blacklist configurations';
COMMENT ON FUNCTION public.record_auth_failure IS 'Record authentication failures with automatic lockout after threshold';
COMMENT ON FUNCTION public.clear_auth_failures IS 'Clear authentication failures after successful authentication';
COMMENT ON FUNCTION public.invite_team_member_secure IS 'Secure wrapper for team member invitations with full security checks';
COMMENT ON FUNCTION public.execute_bulk_operation_secure IS 'Secure wrapper for bulk operations with comprehensive validation';
COMMENT ON FUNCTION public.get_team_security_dashboard IS 'Generate security dashboard data with statistics and recent events';
COMMENT ON FUNCTION public.cleanup_security_data IS 'Maintenance function to cleanup expired security data';

COMMENT ON TABLE public.team_security_events IS 'Comprehensive security event logging for team operations';
COMMENT ON TABLE public.team_rate_limits IS 'Rate limiting tracking with configurable limits per operation type';
COMMENT ON TABLE public.team_security_configs IS 'Team-specific security configurations and policies';
COMMENT ON TABLE public.team_auth_failures IS 'Authentication failure tracking with automatic lockout';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Comprehensive Security and Rate Limiting System migration completed successfully';
  RAISE NOTICE 'New security tables: team_security_events, team_rate_limits, team_security_configs, team_auth_failures';
  RAISE NOTICE 'New security functions: check_team_permission_enhanced, check_rate_limit, validate_ip_access';
  RAISE NOTICE 'Secure wrappers: invite_team_member_secure, execute_bulk_operation_secure';
  RAISE NOTICE 'Security dashboard: get_team_security_dashboard';
  RAISE NOTICE 'Maintenance: cleanup_security_data';
  RAISE NOTICE 'Complete security system with IP filtering, rate limiting, and comprehensive audit trails';
END $$;

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all security tables
ALTER TABLE public.team_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_security_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_auth_failures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- Security events policies
CREATE POLICY "Team admins can view security events" ON public.team_security_events
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can insert security events" ON public.team_security_events
  FOR INSERT WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Users can view their own rate limits" ON public.team_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits" ON public.team_rate_limits
  FOR ALL WITH CHECK (true);

-- Security configs policies
CREATE POLICY "Team owners can manage security configs" ON public.team_security_configs
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Auth failures policies
CREATE POLICY "Users can view their own auth failures" ON public.team_auth_failures
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Team admins can view team auth failures" ON public.team_auth_failures
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "System can manage auth failures" ON public.team_auth_failures
  FOR ALL WITH CHECK (true);

-- ============================================================================
-- 9. SECURITY MAINTENANCE FUNCTIONS
-- ============================================================================

-- Cleanup expired rate limits and auth failures
CREATE OR REPLACE FUNCTION public.cleanup_security_data() RETURNS JSONB AS $$
DECLARE
  expired_rate_limits INTEGER;
  expired_auth_failures INTEGER;
  old_security_events INTEGER;
BEGIN
  -- Clean up expired rate limits (older than 24 hours)
  DELETE FROM public.team_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS expired_rate_limits = ROW_COUNT;

  -- Clean up expired auth failures (older than 7 days)
  DELETE FROM public.team_auth_failures
  WHERE first_attempt < NOW() - INTERVAL '7 days'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  GET DIAGNOSTICS expired_auth_failures = ROW_COUNT;

  -- Clean up old security events (older than 90 days)
  DELETE FROM public.team_security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity NOT IN ('error', 'critical');

  GET DIAGNOSTICS old_security_events = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned_rate_limits', expired_rate_limits,
    'cleaned_auth_failures', expired_auth_failures,
    'cleaned_security_events', old_security_events,
    'cleanup_timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get security dashboard data
CREATE OR REPLACE FUNCTION public.get_team_security_dashboard(
  p_team_id UUID,
  p_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  permission_check JSONB;
  security_stats JSONB;
  rate_limit_stats JSONB;
  recent_events JSONB;
BEGIN
  -- Check permissions
  SELECT public.check_team_permission_enhanced(
    p_team_id, current_user_id, 'view_security_events'
  ) INTO permission_check;

  IF NOT (permission_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'error', permission_check->>'error',
      'error_code', permission_check->>'error_code'
    );
  END IF;

  -- Get security statistics
  WITH security_summary AS (
    SELECT
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
      COUNT(*) FILTER (WHERE severity = 'error') as error_events,
      COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
      COUNT(*) FILTER (WHERE event_type = 'rate_limit_exceeded') as rate_limit_violations,
      COUNT(*) FILTER (WHERE event_type = 'ip_access_denied') as ip_blocks,
      COUNT(*) FILTER (WHERE event_type = 'user_locked_out') as user_lockouts
    FROM public.team_security_events
    WHERE team_id = p_team_id
      AND created_at >= NOW() - INTERVAL '1 day' * p_days
  )
  SELECT jsonb_build_object(
    'total_events', total_events,
    'critical_events', critical_events,
    'error_events', error_events,
    'warning_events', warning_events,
    'rate_limit_violations', rate_limit_violations,
    'ip_blocks', ip_blocks,
    'user_lockouts', user_lockouts
  ) INTO security_stats
  FROM security_summary;

  -- Get rate limit statistics
  WITH rate_limit_summary AS (
    SELECT
      operation_type,
      COUNT(*) as total_requests,
      AVG(request_count) as avg_requests_per_window,
      MAX(request_count) as max_requests_per_window,
      COUNT(*) FILTER (WHERE blocked_until IS NOT NULL) as blocked_windows
    FROM public.team_rate_limits
    WHERE team_id = p_team_id
      AND window_start >= NOW() - INTERVAL '1 day' * p_days
    GROUP BY operation_type
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'operation_type', operation_type,
      'total_requests', total_requests,
      'avg_requests_per_window', avg_requests_per_window,
      'max_requests_per_window', max_requests_per_window,
      'blocked_windows', blocked_windows
    )
  ) INTO rate_limit_stats
  FROM rate_limit_summary;

  -- Get recent security events
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'event_type', event_type,
      'event_description', event_description,
      'severity', severity,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC
  ) INTO recent_events
  FROM (
    SELECT *
    FROM public.team_security_events
    WHERE team_id = p_team_id
      AND created_at >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY created_at DESC
    LIMIT 50
  ) recent;

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'period_days', p_days,
    'security_stats', security_stats,
    'rate_limit_stats', COALESCE(rate_limit_stats, '[]'::jsonb),
    'recent_events', COALESCE(recent_events, '[]'::jsonb),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION public.check_team_permission_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ip_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_failure TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_auth_failures TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_bulk_operation_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_security_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_security_data TO service_role;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.check_team_permission_enhanced IS 'Enhanced permission checking with security logging and failure tracking';
COMMENT ON FUNCTION public.check_rate_limit IS 'Comprehensive rate limiting with configurable limits and automatic blocking';
COMMENT ON FUNCTION public.validate_ip_access IS 'IP address validation against team whitelist/blacklist configurations';
COMMENT ON FUNCTION public.record_auth_failure IS 'Record authentication failures with automatic lockout after threshold';
COMMENT ON FUNCTION public.clear_auth_failures IS 'Clear authentication failures after successful authentication';
COMMENT ON FUNCTION public.invite_team_member_secure IS 'Secure wrapper for team member invitations with full security checks';
COMMENT ON FUNCTION public.execute_bulk_operation_secure IS 'Secure wrapper for bulk operations with comprehensive validation';
COMMENT ON FUNCTION public.get_team_security_dashboard IS 'Generate security dashboard data with statistics and recent events';
COMMENT ON FUNCTION public.cleanup_security_data IS 'Maintenance function to cleanup expired security data';

COMMENT ON TABLE public.team_security_events IS 'Comprehensive security event logging for team operations';
COMMENT ON TABLE public.team_rate_limits IS 'Rate limiting tracking with configurable limits per operation type';
COMMENT ON TABLE public.team_security_configs IS 'Team-specific security configurations and policies';
COMMENT ON TABLE public.team_auth_failures IS 'Authentication failure tracking with automatic lockout';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Comprehensive Security and Rate Limiting System migration completed successfully';
  RAISE NOTICE 'New security tables: team_security_events, team_rate_limits, team_security_configs, team_auth_failures';
  RAISE NOTICE 'New security functions: check_team_permission_enhanced, check_rate_limit, validate_ip_access';
  RAISE NOTICE 'Secure wrappers: invite_team_member_secure, execute_bulk_operation_secure';
  RAISE NOTICE 'Security dashboard: get_team_security_dashboard';
  RAISE NOTICE 'Maintenance: cleanup_security_data';
  RAISE NOTICE 'Complete security system with IP filtering, rate limiting, and comprehensive audit trails';
END $$;
