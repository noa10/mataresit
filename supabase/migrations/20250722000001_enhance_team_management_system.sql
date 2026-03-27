-- ============================================================================
-- ENHANCED TEAM MANAGEMENT SYSTEM
-- Migration: 20250722000000_enhance_team_management_system.sql
-- Description: Comprehensive enhancements for team management including audit trails,
--              enhanced invitations, bulk operations support, and security improvements
-- ============================================================================

-- ============================================================================
-- 1. TEAM AUDIT LOGS TABLE
-- ============================================================================

-- Create enum for audit action types
CREATE TYPE team_audit_action AS ENUM (
  'team_created',
  'team_updated', 
  'team_deleted',
  'member_added',
  'member_removed',
  'member_role_changed',
  'member_permissions_updated',
  'invitation_sent',
  'invitation_resent',
  'invitation_cancelled',
  'invitation_accepted',
  'invitation_declined',
  'invitation_expired',
  'bulk_invitation_sent',
  'bulk_member_removed',
  'bulk_role_updated',
  'owner_transferred',
  'team_settings_updated'
);

-- Create team audit logs table
CREATE TABLE IF NOT EXISTS public.team_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Action details
  action team_audit_action NOT NULL,
  action_description TEXT,
  
  -- Actor information
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email VARCHAR(255),
  performed_by_name TEXT,
  
  -- Target information (for member-related actions)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_email VARCHAR(255),
  target_user_name TEXT,
  
  -- Change details
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Context information
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT team_audit_logs_valid_metadata CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT team_audit_logs_valid_old_values CHECK (jsonb_typeof(old_values) = 'object'),
  CONSTRAINT team_audit_logs_valid_new_values CHECK (jsonb_typeof(new_values) = 'object')
);

-- ============================================================================
-- 2. ENHANCED TEAM INVITATIONS
-- ============================================================================

-- Add new columns to existing team_invitations table
ALTER TABLE public.team_invitations 
ADD COLUMN IF NOT EXISTS invitation_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS custom_message TEXT,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create invitation attempts tracking table
CREATE TABLE IF NOT EXISTS public.team_invitation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.team_invitations(id) ON DELETE CASCADE,
  
  -- Attempt details
  attempt_number INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Delivery tracking
  email_provider_id TEXT, -- External email service ID
  delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, delivered, failed, bounced
  delivery_error TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT invitation_attempts_valid_attempt CHECK (attempt_number > 0),
  CONSTRAINT invitation_attempts_valid_status CHECK (
    delivery_status IN ('pending', 'delivered', 'failed', 'bounced', 'spam')
  )
);

-- ============================================================================
-- 3. BULK OPERATIONS SUPPORT
-- ============================================================================

-- Create bulk operations tracking table
CREATE TABLE IF NOT EXISTS public.team_bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type VARCHAR(50) NOT NULL, -- bulk_invite, bulk_remove, bulk_role_update
  operation_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
  
  -- Performer information
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Operation data
  target_data JSONB NOT NULL, -- Array of targets (emails, user_ids, etc.)
  operation_params JSONB DEFAULT '{}', -- Operation-specific parameters
  
  -- Progress tracking
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  
  -- Results
  results JSONB DEFAULT '{}', -- Detailed results for each item
  error_summary TEXT,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT bulk_ops_valid_operation_type CHECK (
    operation_type IN ('bulk_invite', 'bulk_remove', 'bulk_role_update', 'bulk_permission_update')
  ),
  CONSTRAINT bulk_ops_valid_status CHECK (
    operation_status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT bulk_ops_valid_counts CHECK (
    total_items >= 0 AND processed_items >= 0 AND 
    successful_items >= 0 AND failed_items >= 0 AND
    processed_items <= total_items AND
    (successful_items + failed_items) <= processed_items
  )
);

-- ============================================================================
-- 4. RATE LIMITING TABLES
-- ============================================================================

-- Create invitation rate limiting table
CREATE TABLE IF NOT EXISTS public.team_invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rate limiting windows
  invitations_last_hour INTEGER DEFAULT 0,
  invitations_last_day INTEGER DEFAULT 0,
  invitations_last_week INTEGER DEFAULT 0,
  
  -- Window reset timestamps
  hour_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  day_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  week_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Last activity
  last_invitation_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(team_id, user_id)
);

-- ============================================================================
-- 5. ENHANCED TEAM MEMBER TRACKING
-- ============================================================================

-- Add new columns to team_members for enhanced tracking
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS removal_scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS removal_scheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS member_metadata JSONB DEFAULT '{}';

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_id ON public.team_audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_performed_by ON public.team_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_action ON public.team_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_created_at ON public.team_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_target_user ON public.team_audit_logs(target_user_id);

-- Invitation attempts indexes
CREATE INDEX IF NOT EXISTS idx_invitation_attempts_invitation_id ON public.team_invitation_attempts(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_attempts_sent_at ON public.team_invitation_attempts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_attempts_delivery_status ON public.team_invitation_attempts(delivery_status);

-- Enhanced invitations indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_last_sent_at ON public.team_invitations(last_sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invitations_cancelled_at ON public.team_invitations(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_team_invitations_attempts ON public.team_invitations(invitation_attempts);

-- Bulk operations indexes
CREATE INDEX IF NOT EXISTS idx_bulk_operations_team_id ON public.team_bulk_operations(team_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_performed_by ON public.team_bulk_operations(performed_by);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON public.team_bulk_operations(operation_status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_started_at ON public.team_bulk_operations(started_at DESC);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_team_user ON public.team_invitation_rate_limits(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_invitation ON public.team_invitation_rate_limits(last_invitation_at DESC);

-- Enhanced team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_last_active ON public.team_members(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_added_by ON public.team_members(added_by);
CREATE INDEX IF NOT EXISTS idx_team_members_removal_scheduled ON public.team_members(removal_scheduled_at);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.team_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- Team audit logs policies
CREATE POLICY "Team members can view audit logs for their teams" ON public.team_audit_logs
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member', 'viewer')
    )
  );

CREATE POLICY "Team admins can insert audit logs" ON public.team_audit_logs
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Invitation attempts policies
CREATE POLICY "Team admins can view invitation attempts" ON public.team_invitation_attempts
  FOR SELECT USING (
    invitation_id IN (
      SELECT id FROM public.team_invitations
      WHERE team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Team admins can insert invitation attempts" ON public.team_invitation_attempts
  FOR INSERT WITH CHECK (
    invitation_id IN (
      SELECT id FROM public.team_invitations
      WHERE team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Bulk operations policies
CREATE POLICY "Team admins can manage bulk operations" ON public.team_bulk_operations
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Rate limiting policies
CREATE POLICY "Users can view their own rate limits" ON public.team_invitation_rate_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits" ON public.team_invitation_rate_limits
  FOR ALL USING (true); -- This will be restricted by application logic

-- ============================================================================
-- 9. TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to automatically update team member last_active_at
CREATE OR REPLACE FUNCTION update_team_member_last_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_active_at for any team member activity
  UPDATE public.team_members
  SET last_active_at = NOW()
  WHERE user_id = auth.uid();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log team audit events
CREATE OR REPLACE FUNCTION log_team_audit_event(
  p_team_id UUID,
  p_action team_audit_action,
  p_action_description TEXT DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT '{}',
  p_new_values JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  performer_email VARCHAR(255);
  performer_name TEXT;
  target_email VARCHAR(255);
  target_name TEXT;
BEGIN
  -- Get performer information
  SELECT email INTO performer_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO performer_name
  FROM public.profiles WHERE id = auth.uid();

  -- Get target user information if provided
  IF p_target_user_id IS NOT NULL THEN
    SELECT email INTO target_email FROM auth.users WHERE id = p_target_user_id;
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO target_name
    FROM public.profiles WHERE id = p_target_user_id;
  END IF;

  -- Insert audit log
  INSERT INTO public.team_audit_logs (
    team_id,
    action,
    action_description,
    performed_by,
    performed_by_email,
    performed_by_name,
    target_user_id,
    target_user_email,
    target_user_name,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_team_id,
    p_action,
    p_action_description,
    auth.uid(),
    performer_email,
    performer_name,
    p_target_user_id,
    target_email,
    target_name,
    p_old_values,
    p_new_values,
    p_metadata
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update rate limiting counters
CREATE OR REPLACE FUNCTION update_invitation_rate_limit(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Insert or update rate limiting record
  INSERT INTO public.team_invitation_rate_limits (
    team_id,
    user_id,
    invitations_last_hour,
    invitations_last_day,
    invitations_last_week,
    hour_window_reset,
    day_window_reset,
    week_window_reset,
    last_invitation_at
  ) VALUES (
    p_team_id,
    p_user_id,
    1,
    1,
    1,
    current_time + INTERVAL '1 hour',
    current_time + INTERVAL '1 day',
    current_time + INTERVAL '1 week',
    current_time
  )
  ON CONFLICT (team_id, user_id) DO UPDATE SET
    invitations_last_hour = CASE
      WHEN team_invitation_rate_limits.hour_window_reset <= current_time THEN 1
      ELSE team_invitation_rate_limits.invitations_last_hour + 1
    END,
    invitations_last_day = CASE
      WHEN team_invitation_rate_limits.day_window_reset <= current_time THEN 1
      ELSE team_invitation_rate_limits.invitations_last_day + 1
    END,
    invitations_last_week = CASE
      WHEN team_invitation_rate_limits.week_window_reset <= current_time THEN 1
      ELSE team_invitation_rate_limits.invitations_last_week + 1
    END,
    hour_window_reset = CASE
      WHEN team_invitation_rate_limits.hour_window_reset <= current_time
      THEN current_time + INTERVAL '1 hour'
      ELSE team_invitation_rate_limits.hour_window_reset
    END,
    day_window_reset = CASE
      WHEN team_invitation_rate_limits.day_window_reset <= current_time
      THEN current_time + INTERVAL '1 day'
      ELSE team_invitation_rate_limits.day_window_reset
    END,
    week_window_reset = CASE
      WHEN team_invitation_rate_limits.week_window_reset <= current_time
      THEN current_time + INTERVAL '1 week'
      ELSE team_invitation_rate_limits.week_window_reset
    END,
    last_invitation_at = current_time,
    updated_at = current_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits before sending invitations
CREATE OR REPLACE FUNCTION check_invitation_rate_limit(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid(),
  p_requested_count INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  rate_limit_record RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
  result JSONB;
BEGIN
  -- Get current rate limit status
  SELECT * INTO rate_limit_record
  FROM public.team_invitation_rate_limits
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- If no record exists, user is within limits
  IF rate_limit_record IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining_hour', 50 - p_requested_count,
      'remaining_day', 200 - p_requested_count,
      'remaining_week', 1000 - p_requested_count
    );
  END IF;

  -- Reset counters if windows have expired
  IF rate_limit_record.hour_window_reset <= current_time THEN
    rate_limit_record.invitations_last_hour := 0;
  END IF;

  IF rate_limit_record.day_window_reset <= current_time THEN
    rate_limit_record.invitations_last_day := 0;
  END IF;

  IF rate_limit_record.week_window_reset <= current_time THEN
    rate_limit_record.invitations_last_week := 0;
  END IF;

  -- Check limits (configurable limits: 50/hour, 200/day, 1000/week)
  IF (rate_limit_record.invitations_last_hour + p_requested_count) > 50 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit_exceeded',
      'reset_at', rate_limit_record.hour_window_reset,
      'current_count', rate_limit_record.invitations_last_hour,
      'limit', 50
    );
  END IF;

  IF (rate_limit_record.invitations_last_day + p_requested_count) > 200 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'reset_at', rate_limit_record.day_window_reset,
      'current_count', rate_limit_record.invitations_last_day,
      'limit', 200
    );
  END IF;

  IF (rate_limit_record.invitations_last_week + p_requested_count) > 1000 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'weekly_limit_exceeded',
      'reset_at', rate_limit_record.week_window_reset,
      'current_count', rate_limit_record.invitations_last_week,
      'limit', 1000
    );
  END IF;

  -- User is within limits
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_hour', 50 - (rate_limit_record.invitations_last_hour + p_requested_count),
    'remaining_day', 200 - (rate_limit_record.invitations_last_day + p_requested_count),
    'remaining_week', 1000 - (rate_limit_record.invitations_last_week + p_requested_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations() RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update expired invitations
  UPDATE public.team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND status != 'expired';

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Log cleanup activity
  IF expired_count > 0 THEN
    INSERT INTO public.team_audit_logs (
      team_id,
      action,
      action_description,
      performed_by,
      metadata
    )
    SELECT
      team_id,
      'invitation_expired'::team_audit_action,
      'System cleanup: ' || expired_count || ' invitations expired',
      '00000000-0000-0000-0000-000000000000'::UUID, -- System user
      jsonb_build_object('expired_count', expired_count, 'cleanup_type', 'automatic')
    FROM public.team_invitations
    WHERE status = 'expired'
      AND updated_at >= NOW() - INTERVAL '1 minute'
    GROUP BY team_id;
  END IF;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. ADDITIONAL CONSTRAINTS AND VALIDATIONS
-- ============================================================================

-- Add constraints to team_invitations for enhanced validation
ALTER TABLE public.team_invitations
ADD CONSTRAINT team_invitations_attempts_positive CHECK (invitation_attempts > 0),
ADD CONSTRAINT team_invitations_valid_permissions CHECK (jsonb_typeof(permissions) = 'object'),
ADD CONSTRAINT team_invitations_valid_metadata CHECK (jsonb_typeof(metadata) = 'object'),
ADD CONSTRAINT team_invitations_cancelled_logic CHECK (
  (cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL) OR
  (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
);

-- Add constraint to ensure bulk operations have valid data
ALTER TABLE public.team_bulk_operations
ADD CONSTRAINT bulk_ops_valid_target_data CHECK (jsonb_typeof(target_data) = 'array'),
ADD CONSTRAINT bulk_ops_valid_params CHECK (jsonb_typeof(operation_params) = 'object'),
ADD CONSTRAINT bulk_ops_valid_results CHECK (jsonb_typeof(results) = 'object'),
ADD CONSTRAINT bulk_ops_completion_logic CHECK (
  (operation_status != 'completed' AND completed_at IS NULL) OR
  (operation_status = 'completed' AND completed_at IS NOT NULL)
);

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION log_team_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION update_invitation_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_invitation_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO service_role;

-- Grant usage on new enum types
GRANT USAGE ON TYPE team_audit_action TO authenticated;

-- ============================================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.team_audit_logs IS 'Comprehensive audit trail for all team management actions';
COMMENT ON TABLE public.team_invitation_attempts IS 'Tracks individual invitation sending attempts and delivery status';
COMMENT ON TABLE public.team_bulk_operations IS 'Manages and tracks bulk team management operations';
COMMENT ON TABLE public.team_invitation_rate_limits IS 'Rate limiting for team invitation sending to prevent abuse';

COMMENT ON FUNCTION log_team_audit_event IS 'Logs team management actions with full context and metadata';
COMMENT ON FUNCTION update_invitation_rate_limit IS 'Updates rate limiting counters for invitation sending';
COMMENT ON FUNCTION check_invitation_rate_limit IS 'Checks if user can send invitations within rate limits';
COMMENT ON FUNCTION cleanup_expired_invitations IS 'System function to cleanup expired invitations';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Enhanced Team Management System migration completed successfully';
  RAISE NOTICE 'New tables: team_audit_logs, team_invitation_attempts, team_bulk_operations, team_invitation_rate_limits';
  RAISE NOTICE 'Enhanced tables: team_invitations, team_members';
  RAISE NOTICE 'New functions: log_team_audit_event, update_invitation_rate_limit, check_invitation_rate_limit, cleanup_expired_invitations';
END $$;
