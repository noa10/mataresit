-- Enhanced Invitation Flow Functions Migration
-- Created: 2025-08-22
-- Description: Database functions for multi-scenario invitation workflow support

-- ============================================================================
-- 1. USER STATE DETECTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.detect_user_invitation_state(
  p_invitation_token VARCHAR(255),
  p_browser_fingerprint TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_current_user_id UUID;
  v_current_user_email VARCHAR(255);
  v_user_exists BOOLEAN := false;
  v_user_logged_in BOOLEAN := false;
  v_email_match BOOLEAN := false;
  v_user_type VARCHAR(50);
  v_existing_membership RECORD;
  v_cross_team_count INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Get current user if authenticated
  v_current_user_id := auth.uid();
  
  -- Get invitation details
  SELECT ti.*, t.name as team_name
  INTO v_invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON t.id = ti.team_id
  WHERE ti.token = p_invitation_token
    AND ti.status = 'pending'
    AND ti.expires_at > NOW();
  
  -- Check if invitation exists and is valid
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found or has expired',
      'error_code', 'INVITATION_NOT_FOUND'
    );
  END IF;
  
  -- Check if user exists in system
  SELECT email INTO v_current_user_email
  FROM auth.users
  WHERE id = v_current_user_id;
  
  IF v_current_user_id IS NOT NULL THEN
    v_user_logged_in := true;
    v_email_match := (v_current_user_email = v_invitation.email);
  END IF;
  
  -- Check if target email exists in system
  SELECT COUNT(*) > 0 INTO v_user_exists
  FROM auth.users
  WHERE email = v_invitation.email;
  
  -- Check existing team membership
  IF v_user_logged_in AND v_email_match THEN
    SELECT tm.role, tm.joined_at
    INTO v_existing_membership
    FROM public.team_members tm
    WHERE tm.team_id = v_invitation.team_id
      AND tm.user_id = v_current_user_id;
  END IF;
  
  -- Count cross-team memberships for logged-in user
  IF v_user_logged_in THEN
    SELECT COUNT(*)
    INTO v_cross_team_count
    FROM public.team_members tm
    WHERE tm.user_id = v_current_user_id
      AND tm.team_id != v_invitation.team_id;
  END IF;
  
  -- Determine user type
  IF NOT v_user_exists THEN
    v_user_type := 'unregistered';
  ELSIF v_user_logged_in AND v_email_match THEN
    v_user_type := 'logged_in';
  ELSIF v_user_logged_in AND NOT v_email_match THEN
    v_user_type := 'cross_team';
  ELSE
    v_user_type := 'logged_out';
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'email', v_invitation.email,
      'role', v_invitation.role,
      'team_id', v_invitation.team_id,
      'team_name', v_invitation.team_name,
      'expires_at', v_invitation.expires_at,
      'custom_message', v_invitation.custom_message,
      'invited_by', v_invitation.invited_by
    ),
    'user_state', jsonb_build_object(
      'user_type', v_user_type,
      'user_exists', v_user_exists,
      'user_logged_in', v_user_logged_in,
      'email_match', v_email_match,
      'current_user_id', v_current_user_id,
      'current_user_email', v_current_user_email,
      'existing_team_membership', CASE 
        WHEN v_existing_membership IS NOT NULL THEN
          jsonb_build_object(
            'role', v_existing_membership.role,
            'joined_at', v_existing_membership.joined_at
          )
        ELSE NULL
      END,
      'cross_team_memberships', v_cross_team_count
    )
  );
  
  -- Log the detection for analytics
  INSERT INTO public.team_audit_logs (
    team_id,
    action,
    action_description,
    performed_by,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    v_invitation.team_id,
    'invitation_accessed',
    'Invitation link accessed - user type: ' || v_user_type,
    COALESCE(v_current_user_id, v_invitation.invited_by),
    jsonb_build_object(
      'invitation_token', p_invitation_token,
      'user_type', v_user_type,
      'browser_fingerprint', p_browser_fingerprint
    ),
    p_ip_address,
    p_user_agent
  );
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- 2. INVITATION SESSION MANAGEMENT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_invitation_session(
  p_invitation_token VARCHAR(255),
  p_user_type VARCHAR(50),
  p_target_email VARCHAR(255),
  p_redirect_after_auth TEXT DEFAULT NULL,
  p_browser_fingerprint TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id UUID;
  v_session_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get invitation ID
  SELECT id INTO v_invitation_id
  FROM public.team_invitations
  WHERE token = p_invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF v_invitation_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid invitation token',
      'error_code', 'INVALID_TOKEN'
    );
  END IF;
  
  -- Set session expiry (2 hours)
  v_expires_at := NOW() + INTERVAL '2 hours';
  
  -- Create or update invitation state
  INSERT INTO public.invitation_states (
    invitation_token,
    invitation_id,
    target_email,
    user_type,
    redirect_after_auth,
    session_data,
    browser_fingerprint,
    ip_address,
    user_agent,
    expires_at
  ) VALUES (
    p_invitation_token,
    v_invitation_id,
    p_target_email,
    p_user_type,
    p_redirect_after_auth,
    jsonb_build_object(
      'created_at', NOW(),
      'user_type', p_user_type
    ),
    p_browser_fingerprint,
    p_ip_address,
    p_user_agent,
    v_expires_at
  )
  ON CONFLICT (invitation_token)
  DO UPDATE SET
    user_type = p_user_type,
    redirect_after_auth = p_redirect_after_auth,
    browser_fingerprint = p_browser_fingerprint,
    ip_address = p_ip_address,
    user_agent = p_user_agent,
    expires_at = v_expires_at,
    updated_at = NOW()
  RETURNING id INTO v_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_data', jsonb_build_object(
      'session_id', v_session_id,
      'invitation_token', p_invitation_token,
      'user_type', p_user_type,
      'target_email', p_target_email,
      'redirect_after_auth', p_redirect_after_auth,
      'expires_at', v_expires_at,
      'created_at', NOW()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invitation_session(
  p_invitation_token VARCHAR(255),
  p_browser_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Get session data
  SELECT *
  INTO v_session
  FROM public.invitation_states
  WHERE invitation_token = p_invitation_token
    AND expires_at > NOW()
    AND (p_browser_fingerprint IS NULL OR browser_fingerprint = p_browser_fingerprint);
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found or expired',
      'error_code', 'SESSION_NOT_FOUND'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_data', jsonb_build_object(
      'session_id', v_session.id,
      'invitation_token', v_session.invitation_token,
      'user_type', v_session.user_type,
      'target_email', v_session.target_email,
      'redirect_after_auth', v_session.redirect_after_auth,
      'expires_at', v_session.expires_at,
      'created_at', v_session.created_at
    )
  );
END;
$$;

-- ============================================================================
-- 3. POST-AUTHENTICATION INVITATION PROCESSING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_post_auth_invitation(
  p_invitation_token VARCHAR(255),
  p_user_id UUID,
  p_authentication_method VARCHAR(50),
  p_browser_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_session RECORD;
  v_team RECORD;
  v_existing_member RECORD;
  v_onboarding_required BOOLEAN := true;
  v_redirect_url TEXT;
BEGIN
  -- Get invitation and session
  SELECT ti.*, t.name as team_name, t.slug as team_slug
  INTO v_invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON t.id = ti.team_id
  WHERE ti.token = p_invitation_token
    AND ti.status = 'pending'
    AND ti.expires_at > NOW();
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found or expired',
      'error_code', 'INVITATION_NOT_FOUND'
    );
  END IF;
  
  -- Verify user email matches invitation
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id AND email = v_invitation.email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User email does not match invitation',
      'error_code', 'EMAIL_MISMATCH'
    );
  END IF;
  
  -- Check if user is already a team member
  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id AND user_id = p_user_id;
  
  -- Accept the invitation
  IF v_existing_member IS NULL THEN
    -- Add user to team
    INSERT INTO public.team_members (
      team_id,
      user_id,
      role,
      permissions,
      invitation_accepted_at,
      added_by
    ) VALUES (
      v_invitation.team_id,
      p_user_id,
      v_invitation.role,
      v_invitation.permissions,
      NOW(),
      v_invitation.invited_by
    );
  ELSE
    -- User already exists, just mark invitation as accepted
    v_onboarding_required := false;
  END IF;
  
  -- Update invitation status
  UPDATE public.team_invitations
  SET 
    status = 'accepted',
    accepted_at = NOW(),
    authentication_method = p_authentication_method,
    acceptance_ip_address = (
      SELECT ip_address FROM public.invitation_states 
      WHERE invitation_token = p_invitation_token
    ),
    acceptance_user_agent = (
      SELECT user_agent FROM public.invitation_states 
      WHERE invitation_token = p_invitation_token
    )
  WHERE id = v_invitation.id;
  
  -- Update invitation state
  UPDATE public.invitation_states
  SET 
    state = 'accepted',
    user_id = p_user_id,
    authentication_method = p_authentication_method,
    authenticated_at = NOW()
  WHERE invitation_token = p_invitation_token;
  
  -- Get redirect URL from session
  SELECT redirect_after_auth INTO v_redirect_url
  FROM public.invitation_states
  WHERE invitation_token = p_invitation_token;
  
  -- Log the acceptance
  INSERT INTO public.team_audit_logs (
    team_id,
    action,
    action_description,
    performed_by,
    target_user_id,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    v_invitation.team_id,
    'invitation_accepted',
    'Team invitation accepted via ' || p_authentication_method,
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'authentication_method', p_authentication_method,
      'browser_fingerprint', p_browser_fingerprint,
      'was_existing_member', v_existing_member IS NOT NULL
    ),
    (SELECT ip_address FROM public.invitation_states WHERE invitation_token = p_invitation_token),
    (SELECT user_agent FROM public.invitation_states WHERE invitation_token = p_invitation_token)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'result', jsonb_build_object(
      'invitation_accepted', true,
      'team_id', v_invitation.team_id,
      'team_name', v_invitation.team_name,
      'user_role', v_invitation.role,
      'onboarding_required', v_onboarding_required,
      'redirect_url', COALESCE(v_redirect_url, '/teams/' || v_invitation.team_slug)
    )
  );
END;
$$;

-- ============================================================================
-- 4. DIRECT INVITATION VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_direct_invitation_acceptance(
  p_invitation_token VARCHAR(255),
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_user_email VARCHAR(255);
  v_existing_member RECORD;
  v_can_accept BOOLEAN := false;
  v_email_match BOOLEAN := false;
  v_already_member BOOLEAN := false;
  v_invitation_valid BOOLEAN := false;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  -- Get invitation details
  SELECT ti.*, t.name as team_name
  INTO v_invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON t.id = ti.team_id
  WHERE ti.token = p_invitation_token;

  -- Check invitation validity
  IF v_invitation IS NOT NULL
     AND v_invitation.status = 'pending'
     AND v_invitation.expires_at > NOW() THEN
    v_invitation_valid := true;
  END IF;

  -- Check email match
  IF v_user_email = v_invitation.email THEN
    v_email_match := true;
  END IF;

  -- Check existing membership
  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id AND user_id = p_user_id;

  IF v_existing_member IS NOT NULL THEN
    v_already_member := true;
  END IF;

  -- Determine if can accept
  v_can_accept := v_invitation_valid AND v_email_match AND NOT v_already_member;

  RETURN jsonb_build_object(
    'can_accept', v_can_accept,
    'email_match', v_email_match,
    'already_member', v_already_member,
    'invitation_valid', v_invitation_valid,
    'team_id', COALESCE(v_invitation.team_id, NULL),
    'team_name', COALESCE(v_invitation.team_name, NULL),
    'role', COALESCE(v_invitation.role, NULL)
  );
END;
$$;

-- ============================================================================
-- 5. CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_invitation_sessions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_count INTEGER;
BEGIN
  -- Delete expired invitation states
  DELETE FROM public.invitation_states
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned_count', v_cleaned_count
  );
END;
$$;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.detect_user_invitation_state TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_direct_invitation_acceptance TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitation_sessions TO authenticated;

-- Grant execute permissions to service role for system operations
GRANT EXECUTE ON FUNCTION public.detect_user_invitation_state TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invitation_session TO service_role;
GRANT EXECUTE ON FUNCTION public.get_invitation_session TO service_role;
GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_direct_invitation_acceptance TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitation_sessions TO service_role;
