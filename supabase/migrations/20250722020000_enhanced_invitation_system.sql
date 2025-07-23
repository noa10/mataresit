-- ============================================================================
-- ENHANCED INVITATION SYSTEM
-- Migration: 20250722020000_enhanced_invitation_system.sql
-- Description: Enhanced invitation system with role assignment, expiration handling,
--              resend capabilities, duplicate prevention, and advanced validation
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED INVITE TEAM MEMBER FUNCTION
-- ============================================================================

-- Drop existing function to replace with enhanced version
DROP FUNCTION IF EXISTS public.invite_team_member(uuid, character varying, team_member_role);

-- Create enhanced team member invitation function
CREATE OR REPLACE FUNCTION public.invite_team_member_enhanced(
  _team_id UUID,
  _email VARCHAR(255),
  _role team_member_role DEFAULT 'member',
  _custom_message TEXT DEFAULT NULL,
  _permissions JSONB DEFAULT '{}',
  _expires_in_days INTEGER DEFAULT 7,
  _send_email BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  _invitation_id UUID;
  _token VARCHAR(255);
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
  _existing_invitation RECORD;
  _rate_limit_check JSONB;
  _team_name TEXT;
BEGIN
  -- Get current user's role in the team
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Check if user has permission to invite
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to invite team members',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Validate email format
  IF _email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email format',
      'error_code', 'INVALID_EMAIL'
    );
  END IF;

  -- Check rate limits
  SELECT public.check_invitation_rate_limit(_team_id, _current_user_id, 1) INTO _rate_limit_check;
  
  IF NOT (_rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded: ' || (_rate_limit_check->>'reason'),
      'error_code', 'RATE_LIMIT_EXCEEDED',
      'rate_limit_info', _rate_limit_check
    );
  END IF;

  -- Get team name for logging
  SELECT name INTO _team_name FROM public.teams WHERE id = _team_id;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = _team_id AND u.email = _email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is already a team member',
      'error_code', 'ALREADY_MEMBER'
    );
  END IF;

  -- Check for existing invitations
  SELECT * INTO _existing_invitation
  FROM public.team_invitations
  WHERE team_id = _team_id AND email = _email AND status IN ('pending', 'accepted');

  IF _existing_invitation.id IS NOT NULL THEN
    IF _existing_invitation.status = 'pending' THEN
      -- Check if invitation is expired
      IF _existing_invitation.expires_at <= NOW() THEN
        -- Update expired invitation to expired status
        UPDATE public.team_invitations
        SET status = 'expired', updated_at = NOW()
        WHERE id = _existing_invitation.id;
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Active invitation already exists for this email',
          'error_code', 'INVITATION_EXISTS',
          'existing_invitation_id', _existing_invitation.id,
          'expires_at', _existing_invitation.expires_at
        );
      END IF;
    ELSIF _existing_invitation.status = 'accepted' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User has already accepted an invitation to this team',
        'error_code', 'ALREADY_ACCEPTED'
      );
    END IF;
  END IF;

  -- Validate role assignment permissions
  IF _role = 'owner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot invite users as owners. Use ownership transfer instead.',
      'error_code', 'INVALID_ROLE'
    );
  END IF;

  -- Only owners can invite admins
  IF _role = 'admin' AND _current_user_role != 'owner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners can invite admins',
      'error_code', 'INSUFFICIENT_PERMISSIONS_FOR_ROLE'
    );
  END IF;

  -- Generate unique token
  _token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO public.team_invitations (
    team_id, 
    email, 
    role, 
    invited_by, 
    token, 
    expires_at,
    custom_message,
    permissions,
    invitation_attempts,
    last_sent_at,
    metadata
  ) VALUES (
    _team_id, 
    _email, 
    _role, 
    _current_user_id, 
    _token,
    NOW() + INTERVAL '1 day' * _expires_in_days,
    _custom_message,
    _permissions,
    1,
    NOW(),
    jsonb_build_object(
      'invited_by_role', _current_user_role,
      'team_name', _team_name,
      'expires_in_days', _expires_in_days,
      'send_email', _send_email
    )
  ) RETURNING id INTO _invitation_id;

  -- Create invitation attempt record
  INSERT INTO public.team_invitation_attempts (
    invitation_id,
    attempt_number,
    sent_by,
    metadata
  ) VALUES (
    _invitation_id,
    1,
    _current_user_id,
    jsonb_build_object(
      'invitation_type', 'initial',
      'send_email', _send_email,
      'custom_message_provided', _custom_message IS NOT NULL
    )
  );

  -- Update rate limiting
  PERFORM public.update_invitation_rate_limit(_team_id, _current_user_id);

  -- Log the invitation
  PERFORM public.log_team_audit_event(
    _team_id,
    'invitation_sent'::team_audit_action,
    'Team invitation sent to ' || _email || ' as ' || _role,
    NULL,
    '{}',
    jsonb_build_object(
      'email', _email,
      'role', _role,
      'expires_at', NOW() + INTERVAL '1 day' * _expires_in_days
    ),
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'custom_message_provided', _custom_message IS NOT NULL,
      'permissions_provided', _permissions != '{}',
      'expires_in_days', _expires_in_days
    )
  );

  -- Send email if requested (will be handled by trigger or application)
  IF _send_email THEN
    -- Trigger email sending (handled by existing trigger or application code)
    PERFORM pg_notify(
      'team_invitation_created',
      json_build_object(
        'invitation_id', _invitation_id,
        'email', _email,
        'team_id', _team_id,
        'role', _role,
        'custom_message', _custom_message
      )::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'email', _email,
    'role', _role,
    'expires_at', NOW() + INTERVAL '1 day' * _expires_in_days,
    'token', _token,
    'team_name', _team_name,
    'custom_message_provided', _custom_message IS NOT NULL,
    'email_will_be_sent', _send_email,
    'rate_limit_remaining', _rate_limit_check
  );

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  PERFORM public.log_team_audit_event(
    _team_id,
    'invitation_sent'::team_audit_action,
    'Failed to send invitation to ' || _email || ': ' || SQLERRM,
    NULL,
    '{}',
    '{}',
    jsonb_build_object(
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'email', _email,
      'role', _role
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to create invitation: ' || SQLERRM,
    'error_code', 'INVITATION_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. RESEND INVITATION FUNCTION
-- ============================================================================

-- Function to resend an existing invitation
CREATE OR REPLACE FUNCTION public.resend_team_invitation(
  _invitation_id UUID,
  _custom_message TEXT DEFAULT NULL,
  _extend_expiration BOOLEAN DEFAULT true,
  _new_expiration_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
  _invitation RECORD;
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
  _rate_limit_check JSONB;
  _new_token VARCHAR(255);
  _attempt_number INTEGER;
BEGIN
  -- Get invitation details
  SELECT * INTO _invitation
  FROM public.team_invitations
  WHERE id = _invitation_id;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found',
      'error_code', 'INVITATION_NOT_FOUND'
    );
  END IF;

  -- Get current user's role in the team
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _invitation.team_id AND user_id = _current_user_id;

  -- Check permissions
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to resend invitations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if invitation can be resent
  IF _invitation.status NOT IN ('pending', 'expired') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only resend pending or expired invitations',
      'error_code', 'INVALID_INVITATION_STATUS',
      'current_status', _invitation.status
    );
  END IF;

  -- Check rate limits
  SELECT public.check_invitation_rate_limit(_invitation.team_id, _current_user_id, 1) INTO _rate_limit_check;

  IF NOT (_rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded: ' || (_rate_limit_check->>'reason'),
      'error_code', 'RATE_LIMIT_EXCEEDED',
      'rate_limit_info', _rate_limit_check
    );
  END IF;

  -- Generate new token if extending expiration
  IF _extend_expiration THEN
    _new_token := encode(gen_random_bytes(32), 'hex');
  ELSE
    _new_token := _invitation.token;
  END IF;

  -- Get next attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO _attempt_number
  FROM public.team_invitation_attempts
  WHERE invitation_id = _invitation_id;

  -- Update invitation
  UPDATE public.team_invitations
  SET
    status = 'pending',
    invitation_attempts = _invitation.invitation_attempts + 1,
    last_sent_at = NOW(),
    token = _new_token,
    expires_at = CASE
      WHEN _extend_expiration THEN NOW() + INTERVAL '1 day' * _new_expiration_days
      ELSE expires_at
    END,
    custom_message = COALESCE(_custom_message, custom_message),
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}') || jsonb_build_object(
      'last_resent_by', _current_user_id,
      'last_resent_at', NOW(),
      'resend_count', _invitation.invitation_attempts + 1
    )
  WHERE id = _invitation_id;

  -- Create new invitation attempt record
  INSERT INTO public.team_invitation_attempts (
    invitation_id,
    attempt_number,
    sent_by,
    metadata
  ) VALUES (
    _invitation_id,
    _attempt_number,
    _current_user_id,
    jsonb_build_object(
      'invitation_type', 'resend',
      'extended_expiration', _extend_expiration,
      'new_expiration_days', CASE WHEN _extend_expiration THEN _new_expiration_days ELSE NULL END,
      'custom_message_updated', _custom_message IS NOT NULL
    )
  );

  -- Update rate limiting
  PERFORM public.update_invitation_rate_limit(_invitation.team_id, _current_user_id);

  -- Log the resend action
  PERFORM public.log_team_audit_event(
    _invitation.team_id,
    'invitation_resent'::team_audit_action,
    'Team invitation resent to ' || _invitation.email,
    NULL,
    jsonb_build_object('attempt_number', _invitation.invitation_attempts),
    jsonb_build_object('attempt_number', _invitation.invitation_attempts + 1),
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'resend_attempt', _attempt_number,
      'extended_expiration', _extend_expiration,
      'custom_message_updated', _custom_message IS NOT NULL
    )
  );

  -- Trigger email sending
  PERFORM pg_notify(
    'team_invitation_created',
    json_build_object(
      'invitation_id', _invitation_id,
      'email', _invitation.email,
      'team_id', _invitation.team_id,
      'role', _invitation.role,
      'custom_message', COALESCE(_custom_message, _invitation.custom_message),
      'is_resend', true,
      'attempt_number', _attempt_number
    )::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'email', _invitation.email,
    'attempt_number', _attempt_number,
    'total_attempts', _invitation.invitation_attempts + 1,
    'expires_at', CASE
      WHEN _extend_expiration THEN NOW() + INTERVAL '1 day' * _new_expiration_days
      ELSE _invitation.expires_at
    END,
    'extended_expiration', _extend_expiration,
    'custom_message_updated', _custom_message IS NOT NULL,
    'rate_limit_remaining', _rate_limit_check
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to resend invitation: ' || SQLERRM,
    'error_code', 'RESEND_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CANCEL INVITATION FUNCTION
-- ============================================================================

-- Function to cancel a pending invitation
CREATE OR REPLACE FUNCTION public.cancel_team_invitation(
  _invitation_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _invitation RECORD;
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
BEGIN
  -- Get invitation details
  SELECT * INTO _invitation
  FROM public.team_invitations
  WHERE id = _invitation_id;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found',
      'error_code', 'INVITATION_NOT_FOUND'
    );
  END IF;

  -- Get current user's role in the team
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _invitation.team_id AND user_id = _current_user_id;

  -- Check permissions (admin/owner or the person who sent the invitation)
  IF _current_user_role NOT IN ('owner', 'admin') AND _invitation.invited_by != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to cancel this invitation',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if invitation can be cancelled
  IF _invitation.status NOT IN ('pending', 'expired') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only cancel pending or expired invitations',
      'error_code', 'INVALID_INVITATION_STATUS',
      'current_status', _invitation.status
    );
  END IF;

  -- Cancel the invitation
  UPDATE public.team_invitations
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = _current_user_id,
    cancellation_reason = _reason,
    updated_at = NOW()
  WHERE id = _invitation_id;

  -- Log the cancellation
  PERFORM public.log_team_audit_event(
    _invitation.team_id,
    'invitation_cancelled'::team_audit_action,
    'Team invitation cancelled for ' || _invitation.email,
    NULL,
    jsonb_build_object('status', _invitation.status),
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object(
      'invitation_id', _invitation_id,
      'cancelled_by', _current_user_id,
      'cancellation_reason', _reason,
      'original_inviter', _invitation.invited_by
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', _invitation_id,
    'email', _invitation.email,
    'cancelled_by', _current_user_id,
    'cancellation_reason', _reason,
    'cancelled_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to cancel invitation: ' || SQLERRM,
    'error_code', 'CANCEL_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. BULK INVITATION FUNCTION
-- ============================================================================

-- Function for bulk team member invitations
CREATE OR REPLACE FUNCTION public.bulk_invite_team_members(
  _team_id UUID,
  _invitations JSONB, -- Array of {email, role, custom_message, permissions}
  _default_role team_member_role DEFAULT 'member',
  _expires_in_days INTEGER DEFAULT 7,
  _send_emails BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
  _invitation_data JSONB;
  _invitation_result JSONB;
  _results JSONB := '[]';
  _success_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _bulk_operation_id UUID;
  _rate_limit_check JSONB;
  _total_invitations INTEGER;
BEGIN
  -- Get current user's role in the team
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Check permissions
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to send bulk invitations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Validate invitations array
  IF jsonb_typeof(_invitations) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitations must be an array',
      'error_code', 'INVALID_INPUT'
    );
  END IF;

  _total_invitations := jsonb_array_length(_invitations);

  -- Check rate limits for bulk operation
  SELECT public.check_invitation_rate_limit(_team_id, _current_user_id, _total_invitations) INTO _rate_limit_check;

  IF NOT (_rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded for bulk operation: ' || (_rate_limit_check->>'reason'),
      'error_code', 'RATE_LIMIT_EXCEEDED',
      'rate_limit_info', _rate_limit_check,
      'requested_count', _total_invitations
    );
  END IF;

  -- Create bulk operation record
  INSERT INTO public.team_bulk_operations (
    team_id,
    operation_type,
    operation_status,
    performed_by,
    target_data,
    operation_params,
    total_items
  ) VALUES (
    _team_id,
    'bulk_invite',
    'in_progress',
    _current_user_id,
    _invitations,
    jsonb_build_object(
      'default_role', _default_role,
      'expires_in_days', _expires_in_days,
      'send_emails', _send_emails
    ),
    _total_invitations
  ) RETURNING id INTO _bulk_operation_id;

  -- Process each invitation
  FOR _invitation_data IN SELECT * FROM jsonb_array_elements(_invitations)
  LOOP
    BEGIN
      -- Send individual invitation
      SELECT public.invite_team_member_enhanced(
        _team_id,
        (_invitation_data->>'email')::VARCHAR(255),
        COALESCE((_invitation_data->>'role')::team_member_role, _default_role),
        _invitation_data->>'custom_message',
        COALESCE(_invitation_data->'permissions', '{}'),
        _expires_in_days,
        _send_emails
      ) INTO _invitation_result;

      IF (_invitation_result->>'success')::boolean THEN
        _success_count := _success_count + 1;
      ELSE
        _failed_count := _failed_count + 1;
      END IF;

      _results := _results || jsonb_build_object(
        'email', _invitation_data->>'email',
        'role', COALESCE(_invitation_data->>'role', _default_role),
        'result', _invitation_result
      );

    EXCEPTION WHEN OTHERS THEN
      _failed_count := _failed_count + 1;
      _results := _results || jsonb_build_object(
        'email', _invitation_data->>'email',
        'role', COALESCE(_invitation_data->>'role', _default_role),
        'result', jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'error_code', 'INVITATION_EXCEPTION'
        )
      );
    END;
  END LOOP;

  -- Update bulk operation record
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = _success_count + _failed_count,
      successful_items = _success_count,
      failed_items = _failed_count,
      results = _results,
      completed_at = NOW()
  WHERE id = _bulk_operation_id;

  -- Log bulk invitation
  PERFORM public.log_team_audit_event(
    _team_id,
    'bulk_invitation_sent'::team_audit_action,
    'Bulk invitation sent to ' || _total_invitations || ' recipients',
    NULL,
    '{}',
    jsonb_build_object(
      'total_invitations', _total_invitations,
      'successful', _success_count,
      'failed', _failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', _bulk_operation_id,
      'default_role', _default_role,
      'expires_in_days', _expires_in_days,
      'send_emails', _send_emails
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', _bulk_operation_id,
    'total_invitations', _total_invitations,
    'successful_invitations', _success_count,
    'failed_invitations', _failed_count,
    'results', _results,
    'completed_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Update bulk operation as failed
  UPDATE public.team_bulk_operations
  SET operation_status = 'failed',
      error_summary = SQLERRM,
      completed_at = NOW()
  WHERE id = _bulk_operation_id;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Bulk invitation failed: ' || SQLERRM,
    'error_code', 'BULK_INVITATION_FAILED',
    'bulk_operation_id', _bulk_operation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ENHANCED INVITATION ACCEPTANCE FUNCTION
-- ============================================================================

-- Drop existing function to replace with enhanced version
DROP FUNCTION IF EXISTS public.accept_team_invitation(character varying);

-- Enhanced invitation acceptance function
CREATE OR REPLACE FUNCTION public.accept_team_invitation_enhanced(
  _token VARCHAR(255)
) RETURNS JSONB AS $$
DECLARE
  _invitation RECORD;
  _current_user_id UUID := auth.uid();
  _current_user_email VARCHAR(255);
  _existing_membership RECORD;
BEGIN
  -- Get current user's email
  SELECT email INTO _current_user_email FROM auth.users WHERE id = _current_user_id;

  -- Get invitation details
  SELECT ti.*, t.name as team_name
  INTO _invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON ti.team_id = t.id
  WHERE ti.token = _token;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token',
      'error_code', 'INVALID_TOKEN'
    );
  END IF;

  -- Check if invitation is expired
  IF _invitation.expires_at <= NOW() THEN
    -- Update invitation status to expired
    UPDATE public.team_invitations
    SET status = 'expired', updated_at = NOW()
    WHERE id = _invitation.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation has expired',
      'error_code', 'INVITATION_EXPIRED',
      'expired_at', _invitation.expires_at
    );
  END IF;

  -- Check if invitation is still pending
  IF _invitation.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation is no longer pending',
      'error_code', 'INVITATION_NOT_PENDING',
      'current_status', _invitation.status
    );
  END IF;

  -- Verify email match
  IF _invitation.email != _current_user_email THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email mismatch. This invitation is for ' || _invitation.email,
      'error_code', 'EMAIL_MISMATCH',
      'invitation_email', _invitation.email,
      'user_email', _current_user_email
    );
  END IF;

  -- Check if user is already a team member
  SELECT * INTO _existing_membership
  FROM public.team_members
  WHERE team_id = _invitation.team_id AND user_id = _current_user_id;

  IF _existing_membership.id IS NOT NULL THEN
    -- User is already a member, just update invitation status
    UPDATE public.team_invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = _invitation.id;

    -- Log the acceptance
    PERFORM public.log_team_audit_event(
      _invitation.team_id,
      'invitation_accepted'::team_audit_action,
      'Invitation accepted by existing member ' || _current_user_email,
      _current_user_id,
      jsonb_build_object('existing_role', _existing_membership.role),
      jsonb_build_object('invitation_role', _invitation.role),
      jsonb_build_object(
        'invitation_id', _invitation.id,
        'was_already_member', true,
        'existing_role', _existing_membership.role
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'You were already a member of this team',
      'team_id', _invitation.team_id,
      'team_name', _invitation.team_name,
      'existing_role', _existing_membership.role,
      'invitation_role', _invitation.role,
      'was_already_member', true
    );
  END IF;

  -- Add user to team with the invited role
  INSERT INTO public.team_members (
    team_id,
    user_id,
    role,
    permissions,
    invitation_accepted_at,
    added_by,
    member_metadata
  ) VALUES (
    _invitation.team_id,
    _current_user_id,
    _invitation.role,
    COALESCE(_invitation.permissions, '{}'),
    NOW(),
    _invitation.invited_by,
    jsonb_build_object(
      'joined_via_invitation', true,
      'invitation_id', _invitation.id,
      'invited_by', _invitation.invited_by,
      'invitation_sent_at', _invitation.created_at
    )
  );

  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = _invitation.id;

  -- Log the acceptance and team join
  PERFORM public.log_team_audit_event(
    _invitation.team_id,
    'invitation_accepted'::team_audit_action,
    'Invitation accepted and user joined as ' || _invitation.role,
    _current_user_id,
    '{}',
    jsonb_build_object('role', _invitation.role),
    jsonb_build_object(
      'invitation_id', _invitation.id,
      'invited_by', _invitation.invited_by,
      'was_already_member', false
    )
  );

  PERFORM public.log_team_audit_event(
    _invitation.team_id,
    'member_added'::team_audit_action,
    'New member joined via invitation: ' || _current_user_email,
    _current_user_id,
    '{}',
    jsonb_build_object('role', _invitation.role),
    jsonb_build_object(
      'joined_via_invitation', true,
      'invitation_id', _invitation.id,
      'invited_by', _invitation.invited_by
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined the team',
    'team_id', _invitation.team_id,
    'team_name', _invitation.team_name,
    'role', _invitation.role,
    'joined_at', NOW(),
    'was_already_member', false
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to accept invitation: ' || SQLERRM,
    'error_code', 'ACCEPTANCE_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. INVITATION MANAGEMENT UTILITY FUNCTIONS
-- ============================================================================

-- Function to get team invitations with details
CREATE OR REPLACE FUNCTION public.get_team_invitations(
  _team_id UUID,
  _status invitation_status DEFAULT NULL,
  _include_expired BOOLEAN DEFAULT false
) RETURNS TABLE (
  id UUID,
  email VARCHAR(255),
  role team_member_role,
  status invitation_status,
  invited_by UUID,
  inviter_name TEXT,
  inviter_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  invitation_attempts INTEGER,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  custom_message TEXT,
  permissions JSONB,
  metadata JSONB
) AS $$
BEGIN
  -- Check if user has permission to view invitations
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to view team invitations';
  END IF;

  RETURN QUERY
  SELECT
    ti.id,
    ti.email,
    ti.role,
    ti.status,
    ti.invited_by,
    COALESCE(p.first_name || ' ' || p.last_name, au.email) as inviter_name,
    au.email as inviter_email,
    ti.created_at,
    ti.expires_at,
    ti.accepted_at,
    ti.cancelled_at,
    ti.invitation_attempts,
    ti.last_sent_at,
    ti.custom_message,
    ti.permissions,
    ti.metadata
  FROM public.team_invitations ti
  JOIN auth.users au ON ti.invited_by = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE ti.team_id = _team_id
    AND (_status IS NULL OR ti.status = _status)
    AND (_include_expired OR ti.status != 'expired' OR ti.expires_at > NOW() - INTERVAL '7 days')
  ORDER BY ti.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invitation statistics
CREATE OR REPLACE FUNCTION public.get_invitation_stats(_team_id UUID)
RETURNS JSONB AS $$
DECLARE
  _stats JSONB;
BEGIN
  -- Check if user has permission to view stats
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Insufficient permissions');
  END IF;

  SELECT jsonb_build_object(
    'total_invitations', COUNT(*),
    'pending_invitations', COUNT(*) FILTER (WHERE status = 'pending'),
    'accepted_invitations', COUNT(*) FILTER (WHERE status = 'accepted'),
    'expired_invitations', COUNT(*) FILTER (WHERE status = 'expired'),
    'cancelled_invitations', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'declined_invitations', COUNT(*) FILTER (WHERE status = 'declined'),
    'recent_invitations', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
    'average_attempts', AVG(invitation_attempts),
    'max_attempts', MAX(invitation_attempts),
    'invitations_by_role', jsonb_object_agg(
      role::text,
      COUNT(*) FILTER (WHERE role = role)
    )
  ) INTO _stats
  FROM public.team_invitations
  WHERE team_id = _team_id;

  RETURN _stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. BACKWARD COMPATIBILITY WRAPPERS
-- ============================================================================

-- Create backward compatibility wrapper for existing invite_team_member function
CREATE OR REPLACE FUNCTION public.invite_team_member(
  _team_id UUID,
  _email VARCHAR(255),
  _role team_member_role DEFAULT 'member'
) RETURNS UUID AS $$
DECLARE
  _result JSONB;
  _invitation_id UUID;
BEGIN
  -- Call the enhanced function with default parameters
  SELECT public.invite_team_member_enhanced(
    _team_id,
    _email,
    _role,
    NULL, -- no custom message
    '{}', -- no custom permissions
    7,    -- 7 days expiration
    true  -- send email
  ) INTO _result;

  -- Extract invitation ID for backward compatibility
  IF (_result->>'success')::boolean THEN
    _invitation_id := (_result->>'invitation_id')::UUID;
    RETURN _invitation_id;
  ELSE
    RAISE EXCEPTION '%', _result->>'error';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create backward compatibility wrapper for accept_team_invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  _token VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
  _result JSONB;
BEGIN
  -- Call the enhanced function
  SELECT public.accept_team_invitation_enhanced(_token) INTO _result;

  -- Return boolean for backward compatibility
  RETURN (_result->>'success')::boolean;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.invite_team_member_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_team_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_team_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_invite_team_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_stats TO authenticated;

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.invite_team_member_enhanced IS 'Enhanced team member invitation with role assignment, custom messages, and advanced validation';
COMMENT ON FUNCTION public.resend_team_invitation IS 'Resend an existing invitation with optional expiration extension';
COMMENT ON FUNCTION public.cancel_team_invitation IS 'Cancel a pending or expired invitation';
COMMENT ON FUNCTION public.bulk_invite_team_members IS 'Send multiple invitations in a single operation with progress tracking';
COMMENT ON FUNCTION public.accept_team_invitation_enhanced IS 'Enhanced invitation acceptance with comprehensive validation and logging';
COMMENT ON FUNCTION public.get_team_invitations IS 'Retrieve team invitations with detailed information and filtering';
COMMENT ON FUNCTION public.get_invitation_stats IS 'Get comprehensive statistics about team invitations';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Enhanced Invitation System migration completed successfully';
  RAISE NOTICE 'New functions: invite_team_member_enhanced, resend_team_invitation, cancel_team_invitation, bulk_invite_team_members';
  RAISE NOTICE 'Enhanced functions: accept_team_invitation_enhanced';
  RAISE NOTICE 'Utility functions: get_team_invitations, get_invitation_stats';
  RAISE NOTICE 'Backward compatibility maintained for existing functions';
END $$;
