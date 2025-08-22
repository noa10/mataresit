-- Enhanced Invitation Onboarding System - Utility Functions
-- Phase 1B: Additional utility functions for invitation state management
-- Created: 2025-08-21

-- ============================================================================
-- 1. INVITATION STATE RETRIEVAL AND VALIDATION
-- ============================================================================

-- Function to get invitation state with full context
CREATE OR REPLACE FUNCTION public.get_invitation_state_with_context(
  p_invitation_token VARCHAR(255)
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'invitation_state', row_to_json(ist),
    'invitation', row_to_json(ti),
    'team', jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'slug', t.slug
    ),
    'inviter', jsonb_build_object(
      'id', inviter.id,
      'email', inviter.email,
      'full_name', inviter.raw_user_meta_data->>'full_name'
    ),
    'team_config', row_to_json(toc)
  ) INTO v_result
  FROM public.invitation_states ist
  JOIN public.team_invitations ti ON ist.invitation_id = ti.id
  JOIN public.teams t ON ti.team_id = t.id
  JOIN auth.users inviter ON ti.invited_by = inviter.id
  LEFT JOIN public.team_onboarding_configs toc ON t.id = toc.team_id
  WHERE ist.invitation_token = p_invitation_token
    AND ist.expires_at > NOW();
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation state not found or expired',
      'error_code', 'STATE_NOT_FOUND'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'data', v_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate invitation token and detect user type
CREATE OR REPLACE FUNCTION public.validate_invitation_and_detect_user_type(
  p_invitation_token VARCHAR(255),
  p_user_email VARCHAR(255) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_user_exists BOOLEAN := false;
  v_user_logged_in BOOLEAN := false;
  v_user_type VARCHAR(50);
  v_existing_membership RECORD;
  v_cross_team_memberships INTEGER := 0;
BEGIN
  -- Get invitation details
  SELECT ti.*, t.name as team_name
  INTO v_invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON ti.team_id = t.id
  WHERE ti.token = p_invitation_token
    AND ti.status = 'pending'
    AND ti.expires_at > NOW();
  
  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token',
      'error_code', 'INVALID_TOKEN'
    );
  END IF;
  
  -- Check if user exists
  SELECT EXISTS(
    SELECT 1 FROM auth.users 
    WHERE email = v_invitation.email
  ) INTO v_user_exists;
  
  -- Check if user is currently logged in (if email provided)
  IF p_user_email IS NOT NULL THEN
    v_user_logged_in := (p_user_email = v_invitation.email);
  END IF;
  
  -- Check existing team membership
  IF v_user_exists THEN
    SELECT tm.* INTO v_existing_membership
    FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE u.email = v_invitation.email
      AND tm.team_id = v_invitation.team_id;
    
    -- Count cross-team memberships
    SELECT COUNT(*) INTO v_cross_team_memberships
    FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE u.email = v_invitation.email
      AND tm.team_id != v_invitation.team_id;
  END IF;
  
  -- Determine user type
  IF NOT v_user_exists THEN
    v_user_type := 'unregistered';
  ELSIF v_user_exists AND NOT v_user_logged_in THEN
    v_user_type := 'logged_out';
  ELSIF v_user_exists AND v_user_logged_in THEN
    IF v_cross_team_memberships > 0 THEN
      v_user_type := 'cross_team';
    ELSE
      v_user_type := 'logged_in';
    END IF;
  ELSE
    v_user_type := 'unknown';
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'email', v_invitation.email,
      'role', v_invitation.role,
      'team_id', v_invitation.team_id,
      'team_name', v_invitation.team_name,
      'expires_at', v_invitation.expires_at,
      'custom_message', v_invitation.custom_message
    ),
    'user_analysis', jsonb_build_object(
      'user_type', v_user_type,
      'user_exists', v_user_exists,
      'user_logged_in', v_user_logged_in,
      'existing_membership', CASE 
        WHEN v_existing_membership.id IS NOT NULL THEN
          jsonb_build_object(
            'role', v_existing_membership.role,
            'joined_at', v_existing_membership.joined_at
          )
        ELSE NULL
      END,
      'cross_team_memberships', v_cross_team_memberships
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. ONBOARDING PROGRESS MANAGEMENT
-- ============================================================================

-- Function to update onboarding step completion
CREATE OR REPLACE FUNCTION public.update_onboarding_step(
  p_user_id UUID,
  p_step_name VARCHAR(100),
  p_step_data JSONB DEFAULT '{}',
  p_team_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_progress RECORD;
  v_completed_steps JSONB;
  v_new_percentage INTEGER;
BEGIN
  -- Get current progress
  SELECT * INTO v_progress
  FROM public.onboarding_progress
  WHERE user_id = p_user_id
    AND (p_team_id IS NULL OR team_id = p_team_id)
    AND is_completed = false
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_progress.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Onboarding progress not found',
      'error_code', 'PROGRESS_NOT_FOUND'
    );
  END IF;
  
  -- Add step to completed steps if not already present
  v_completed_steps := v_progress.completed_steps;
  IF NOT (v_completed_steps ? p_step_name) THEN
    v_completed_steps := v_completed_steps || jsonb_build_array(p_step_name);
  END IF;
  
  -- Calculate new completion percentage
  v_new_percentage := (jsonb_array_length(v_completed_steps) * 100) / v_progress.total_steps;
  
  -- Update specific step flags
  UPDATE public.onboarding_progress
  SET 
    completed_steps = v_completed_steps,
    completion_percentage = v_new_percentage,
    current_step = CASE 
      WHEN v_new_percentage >= 100 THEN 'completed'
      ELSE p_step_name
    END,
    profile_completed = CASE WHEN p_step_name = 'profile_setup' THEN true ELSE profile_completed END,
    team_introduction_viewed = CASE WHEN p_step_name = 'team_introduction' THEN true ELSE team_introduction_viewed END,
    first_receipt_uploaded = CASE WHEN p_step_name = 'first_upload' THEN true ELSE first_receipt_uploaded END,
    dashboard_tour_completed = CASE WHEN p_step_name = 'dashboard_tour' THEN true ELSE dashboard_tour_completed END,
    preferences_configured = CASE WHEN p_step_name = 'preferences_setup' THEN true ELSE preferences_configured END,
    is_completed = (v_new_percentage >= 100),
    completed_at = CASE WHEN v_new_percentage >= 100 THEN NOW() ELSE completed_at END,
    onboarding_data = onboarding_data || jsonb_build_object(p_step_name, p_step_data),
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = v_progress.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'progress_id', v_progress.id,
    'step_completed', p_step_name,
    'completion_percentage', v_new_percentage,
    'is_completed', (v_new_percentage >= 100),
    'completed_steps', v_completed_steps
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user onboarding status
CREATE OR REPLACE FUNCTION public.get_user_onboarding_status(
  p_user_id UUID,
  p_team_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_progress RECORD;
  v_team_config RECORD;
BEGIN
  -- Get onboarding progress
  SELECT * INTO v_progress
  FROM public.onboarding_progress
  WHERE user_id = p_user_id
    AND (p_team_id IS NULL OR team_id = p_team_id)
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Get team configuration if team context exists
  IF p_team_id IS NOT NULL THEN
    SELECT * INTO v_team_config
    FROM public.team_onboarding_configs
    WHERE team_id = p_team_id;
  END IF;
  
  IF v_progress.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No onboarding progress found',
      'error_code', 'NO_PROGRESS'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'progress', row_to_json(v_progress),
    'team_config', CASE WHEN v_team_config.id IS NOT NULL THEN row_to_json(v_team_config) ELSE NULL END,
    'next_steps', CASE 
      WHEN v_progress.is_completed THEN '[]'::jsonb
      ELSE jsonb_build_array(
        CASE WHEN NOT v_progress.profile_completed THEN 'profile_setup' END,
        CASE WHEN NOT v_progress.team_introduction_viewed THEN 'team_introduction' END,
        CASE WHEN NOT v_progress.first_receipt_uploaded THEN 'first_upload' END,
        CASE WHEN NOT v_progress.dashboard_tour_completed THEN 'dashboard_tour' END,
        CASE WHEN NOT v_progress.preferences_configured THEN 'preferences_setup' END
      ) - 'null'::jsonb
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CLEANUP AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to cleanup expired invitation states
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitation_states()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.invitation_states
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invitation system analytics
CREATE OR REPLACE FUNCTION public.get_invitation_analytics(
  p_team_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  WITH invitation_stats AS (
    SELECT
      COUNT(*) as total_invitations,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_invitations,
      COUNT(*) FILTER (WHERE status = 'accepted') as accepted_invitations,
      COUNT(*) FILTER (WHERE status = 'expired') as expired_invitations,
      COUNT(*) FILTER (WHERE user_type_detected = 'unregistered') as unregistered_users,
      COUNT(*) FILTER (WHERE user_type_detected = 'logged_out') as logged_out_users,
      COUNT(*) FILTER (WHERE user_type_detected = 'logged_in') as logged_in_users,
      COUNT(*) FILTER (WHERE user_type_detected = 'cross_team') as cross_team_users,
      AVG(EXTRACT(EPOCH FROM (accepted_at - created_at))/3600) as avg_acceptance_hours
    FROM public.team_invitations
    WHERE created_at >= NOW() - INTERVAL '1 day' * p_days_back
      AND (p_team_id IS NULL OR team_id = p_team_id)
  ),
  onboarding_stats AS (
    SELECT
      COUNT(*) as total_onboarding,
      COUNT(*) FILTER (WHERE is_completed = true) as completed_onboarding,
      AVG(completion_percentage) as avg_completion_percentage,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/3600) as avg_completion_hours
    FROM public.onboarding_progress
    WHERE started_at >= NOW() - INTERVAL '1 day' * p_days_back
      AND (p_team_id IS NULL OR team_id = p_team_id)
  )
  SELECT jsonb_build_object(
    'period_days', p_days_back,
    'team_id', p_team_id,
    'invitations', row_to_json(i),
    'onboarding', row_to_json(o),
    'generated_at', NOW()
  ) INTO v_stats
  FROM invitation_stats i, onboarding_stats o;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.get_invitation_state_with_context IS 'Retrieves complete invitation state with team and inviter context';
COMMENT ON FUNCTION public.validate_invitation_and_detect_user_type IS 'Validates invitation token and automatically detects user type for proper flow routing';
COMMENT ON FUNCTION public.update_onboarding_step IS 'Updates onboarding progress when user completes a step';
COMMENT ON FUNCTION public.get_user_onboarding_status IS 'Gets current onboarding status and next steps for a user';
COMMENT ON FUNCTION public.cleanup_expired_invitation_states IS 'Maintenance function to cleanup expired invitation states';
COMMENT ON FUNCTION public.get_invitation_analytics IS 'Provides analytics and insights on invitation and onboarding performance';

-- ============================================================================
-- MIGRATION COMPLETION LOG
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Enhanced Invitation Onboarding System Phase 1B (Utility Functions) completed successfully';
  RAISE NOTICE 'Added functions: get_invitation_state_with_context, validate_invitation_and_detect_user_type';
  RAISE NOTICE 'Added functions: update_onboarding_step, get_user_onboarding_status';
  RAISE NOTICE 'Added functions: cleanup_expired_invitation_states, get_invitation_analytics';
  RAISE NOTICE 'All Phase 1 database enhancements complete - ready for Phase 2 implementation';
END $$;
