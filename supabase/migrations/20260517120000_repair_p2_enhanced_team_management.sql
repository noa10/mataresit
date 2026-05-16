-- Repair P2 (slim): functions the team UI actually calls.
--
-- Drift audit confirmed migrations 20250722010000 (user removal),
-- 20250722020000 (enhanced invitation), and 20250722050000 (security)
-- are recorded as applied but their objects never landed. The original
-- migrations also reference helper functions that were never written
-- (check_invitation_rate_limit, update_invitation_rate_limit,
-- log_team_audit_event without _enhanced) — explaining why they
-- failed at compile time.
--
-- This slim repair recreates only what enhancedTeamService.ts actually
-- calls. Definitions are simplified copies of the originals with all
-- rate-limit and missing-helper references removed; the existing
-- auto_log_team_member_changes / auto_log_team_changes triggers
-- already capture audit events on the underlying tables.
--
-- Out of scope: security wrappers (invite_team_member_secure,
-- execute_bulk_operation_secure), security tables, bulk operations,
-- analytics, scheduled-operations engine. Those are P3+.

-- ============================================================================
-- A. ENHANCED MEMBER REMOVAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_team_member_enhanced(
  _team_id UUID,
  _user_id UUID,
  _reason TEXT DEFAULT NULL,
  _transfer_data BOOLEAN DEFAULT false,
  _transfer_to_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _member_role public.team_member_role;
  _admin_count INTEGER;
  _total_members INTEGER;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _cleanup_results JSONB := '{}';
BEGIN
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  SELECT role INTO _member_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _member_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a team member', 'error_code', 'NOT_MEMBER');
  END IF;

  IF _member_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove team owner. Transfer ownership first.', 'error_code', 'CANNOT_REMOVE_OWNER');
  END IF;

  IF NOT (_current_user_role IN ('owner', 'admin') OR _user_id = _current_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to remove team member', 'error_code', 'INSUFFICIENT_PERMISSIONS');
  END IF;

  SELECT COUNT(*) INTO _admin_count FROM public.team_members
  WHERE team_id = _team_id AND role = 'admin' AND user_id != _user_id;
  SELECT COUNT(*) INTO _total_members FROM public.team_members WHERE team_id = _team_id;

  IF _member_role = 'admin' AND _admin_count = 0 AND _total_members > 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the last admin. Promote another member to admin first.', 'error_code', 'LAST_ADMIN');
  END IF;

  BEGIN
    -- Data transfer or cleanup
    IF _transfer_data AND _transfer_to_user_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _transfer_to_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transfer target must be a team member', 'error_code', 'INVALID_TRANSFER_TARGET');
      END IF;

      UPDATE public.receipts
      SET user_id = _transfer_to_user_id
      WHERE user_id = _user_id AND team_id = _team_id;

      _cleanup_results := jsonb_build_object('data_transferred', true, 'transfer_target', _transfer_to_user_id);
    ELSE
      DELETE FROM public.receipts WHERE user_id = _user_id AND team_id = _team_id;
      _cleanup_results := jsonb_build_object('data_deleted', true);
    END IF;

    -- Cancel any pending invitations sent by this user for this team
    UPDATE public.team_invitations
    SET status = 'cancelled', cancelled_at = NOW(),
        cancelled_by = _current_user_id,
        cancellation_reason = 'Member removed from team'
    WHERE invited_by = _user_id AND team_id = _team_id AND status = 'pending';

    -- Remove the member (the auto-log trigger captures the audit row)
    DELETE FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id;

    RETURN jsonb_build_object(
      'success', true,
      'removed_user_id', _user_id,
      'removed_role', _member_role,
      'removal_reason', _reason,
      'data_transferred', _transfer_data,
      'transfer_target', _transfer_to_user_id,
      'cleanup_performed', _cleanup_results,
      'removed_at', NOW()
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to remove team member: ' || SQLERRM,
      'error_code', 'REMOVAL_FAILED',
      'error_detail', SQLSTATE
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward-compat wrapper preserved (returns BOOLEAN)
CREATE OR REPLACE FUNCTION public.remove_team_member(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE _result JSONB;
BEGIN
  SELECT public.remove_team_member_enhanced(_team_id, _user_id, NULL, false, NULL) INTO _result;
  RETURN (_result->>'success')::boolean;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- B. UPDATE MEMBER ROLE (was never written; service calls it)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_member_role_enhanced(
  _team_id UUID,
  _user_id UUID,
  _new_role team_member_role,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
  _target_role team_member_role;
BEGIN
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  SELECT role INTO _target_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a team member', 'error_code', 'NOT_MEMBER');
  END IF;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions', 'error_code', 'INSUFFICIENT_PERMISSIONS');
  END IF;

  IF _target_role = 'owner' OR _new_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use transfer_team_ownership for owner role changes', 'error_code', 'INVALID_ROLE_CHANGE');
  END IF;

  -- Only owners can promote to admin
  IF _new_role = 'admin' AND _current_user_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owners can assign admin role', 'error_code', 'INSUFFICIENT_PERMISSIONS_FOR_ROLE');
  END IF;

  UPDATE public.team_members
  SET role = _new_role,
      member_metadata = COALESCE(member_metadata, '{}'::jsonb) || jsonb_build_object(
        'last_role_change_reason', _reason,
        'last_role_change_at', NOW(),
        'last_role_changed_by', _current_user_id
      ),
      updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'previous_role', _target_role,
    'new_role', _new_role,
    'changed_by', _current_user_id,
    'reason', _reason,
    'changed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- C. TRANSFER OWNERSHIP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(
  _team_id UUID,
  _new_owner_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_owner_id UUID;
  _current_user_id UUID := auth.uid();
  _new_owner_role team_member_role;
BEGIN
  SELECT owner_id INTO _current_owner_id FROM public.teams WHERE id = _team_id;

  IF _current_owner_id != _current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the team owner can transfer ownership', 'error_code', 'NOT_OWNER');
  END IF;

  SELECT role INTO _new_owner_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _new_owner_id;

  IF _new_owner_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be a team member', 'error_code', 'NOT_MEMBER');
  END IF;

  UPDATE public.teams SET owner_id = _new_owner_id, updated_at = NOW() WHERE id = _team_id;

  UPDATE public.team_members
  SET role = 'admin', updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _current_owner_id;

  UPDATE public.team_members
  SET role = 'owner', updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _new_owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_owner', _current_owner_id,
    'new_owner', _new_owner_id,
    'transfer_reason', _reason,
    'transferred_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- D. SCHEDULED REMOVAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.schedule_member_removal(
  _team_id UUID,
  _user_id UUID,
  _removal_date TIMESTAMP WITH TIME ZONE,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
  _target_role team_member_role;
BEGIN
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  SELECT role INTO _target_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions', 'error_code', 'INSUFFICIENT_PERMISSIONS');
  END IF;

  IF _target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a team member', 'error_code', 'NOT_MEMBER');
  END IF;

  IF _target_role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot schedule removal of team owner', 'error_code', 'CANNOT_SCHEDULE_OWNER');
  END IF;

  UPDATE public.team_members
  SET removal_scheduled_at = _removal_date,
      removal_scheduled_by = _current_user_id,
      member_metadata = COALESCE(member_metadata, '{}'::jsonb) || jsonb_build_object(
        'removal_reason', _reason,
        'scheduled_at', NOW()
      ),
      updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'scheduled_removal_date', _removal_date,
    'reason', _reason,
    'scheduled_by', _current_user_id,
    'scheduled_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_removal(
  _team_id UUID,
  _user_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role team_member_role;
BEGIN
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions', 'error_code', 'INSUFFICIENT_PERMISSIONS');
  END IF;

  UPDATE public.team_members
  SET removal_scheduled_at = NULL,
      removal_scheduled_by = NULL,
      member_metadata = COALESCE(member_metadata, '{}'::jsonb) || jsonb_build_object(
        'removal_cancelled_at', NOW(),
        'removal_cancelled_by', _current_user_id,
        'cancellation_reason', _reason
      ),
      updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'cancellation_reason', _reason,
    'cancelled_by', _current_user_id,
    'cancelled_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- E. REMOVAL CANDIDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_removal_candidates(
  _team_id UUID,
  _inactive_days INTEGER DEFAULT 90
) RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  full_name TEXT,
  role team_member_role,
  last_active_at TIMESTAMP WITH TIME ZONE,
  days_inactive INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    au.email::VARCHAR(255),
    COALESCE(p.first_name || ' ' || p.last_name, au.email)::TEXT AS full_name,
    tm.role,
    tm.last_active_at,
    CASE
      WHEN tm.last_active_at IS NULL THEN EXTRACT(DAY FROM NOW() - tm.joined_at)::INTEGER
      ELSE EXTRACT(DAY FROM NOW() - tm.last_active_at)::INTEGER
    END AS days_inactive,
    tm.joined_at
  FROM public.team_members tm
  JOIN auth.users au ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tm.team_id = _team_id
    AND tm.role != 'owner'
    AND (
      (tm.last_active_at IS NULL AND tm.joined_at <= NOW() - INTERVAL '1 day' * _inactive_days)
      OR tm.last_active_at <= NOW() - INTERVAL '1 day' * _inactive_days
    )
    AND public.is_team_member(_team_id, auth.uid(), 'admin')
  ORDER BY
    CASE WHEN tm.last_active_at IS NULL THEN tm.joined_at ELSE tm.last_active_at END ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- F. ENHANCED INVITATION
-- ============================================================================

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
  _team_name TEXT;
BEGIN
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to invite team members', 'error_code', 'INSUFFICIENT_PERMISSIONS');
  END IF;

  IF _email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email format', 'error_code', 'INVALID_EMAIL');
  END IF;

  SELECT name INTO _team_name FROM public.teams WHERE id = _team_id;

  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = _team_id AND u.email = _email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is already a team member', 'error_code', 'ALREADY_MEMBER');
  END IF;

  SELECT * INTO _existing_invitation
  FROM public.team_invitations
  WHERE team_id = _team_id AND email = _email AND status IN ('pending', 'accepted');

  IF _existing_invitation.id IS NOT NULL THEN
    IF _existing_invitation.status = 'pending' THEN
      IF _existing_invitation.expires_at <= NOW() THEN
        UPDATE public.team_invitations SET status = 'expired', updated_at = NOW()
        WHERE id = _existing_invitation.id;
      ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Active invitation already exists for this email',
          'error_code', 'INVITATION_EXISTS', 'existing_invitation_id', _existing_invitation.id,
          'expires_at', _existing_invitation.expires_at);
      END IF;
    ELSIF _existing_invitation.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'User has already accepted an invitation to this team', 'error_code', 'ALREADY_ACCEPTED');
    END IF;
  END IF;

  IF _role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot invite users as owners. Use ownership transfer instead.', 'error_code', 'INVALID_ROLE');
  END IF;

  IF _role = 'admin' AND _current_user_role != 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owners can invite admins', 'error_code', 'INSUFFICIENT_PERMISSIONS_FOR_ROLE');
  END IF;

  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.team_invitations (
    team_id, email, role, invited_by, token, expires_at,
    custom_message, permissions, invitation_attempts, last_sent_at, metadata
  ) VALUES (
    _team_id, _email, _role, _current_user_id, _token,
    NOW() + INTERVAL '1 day' * _expires_in_days,
    _custom_message, _permissions, 1, NOW(),
    jsonb_build_object('invited_by_role', _current_user_role, 'team_name', _team_name,
                       'expires_in_days', _expires_in_days, 'send_email', _send_email)
  ) RETURNING id INTO _invitation_id;

  IF _send_email THEN
    PERFORM pg_notify(
      'team_invitation_created',
      json_build_object(
        'invitation_id', _invitation_id, 'email', _email,
        'team_id', _team_id, 'role', _role, 'custom_message', _custom_message
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
    'email_will_be_sent', _send_email
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Failed to create invitation: ' || SQLERRM,
                            'error_code', 'INVITATION_FAILED', 'error_detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- G. ENHANCED INVITATION ACCEPTANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_team_invitation_enhanced(_token VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
  _invitation RECORD;
  _current_user_id UUID := auth.uid();
  _current_user_email VARCHAR(255);
  _existing_membership RECORD;
BEGIN
  SELECT email INTO _current_user_email FROM auth.users WHERE id = _current_user_id;

  SELECT ti.*, t.name as team_name INTO _invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON ti.team_id = t.id
  WHERE ti.token = _token;

  IF _invitation.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation token', 'error_code', 'INVALID_TOKEN');
  END IF;

  IF _invitation.expires_at <= NOW() THEN
    UPDATE public.team_invitations SET status = 'expired', updated_at = NOW() WHERE id = _invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired', 'error_code', 'INVITATION_EXPIRED', 'expired_at', _invitation.expires_at);
  END IF;

  IF _invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer pending',
      'error_code', 'INVITATION_NOT_PENDING', 'current_status', _invitation.status);
  END IF;

  IF _invitation.email != _current_user_email THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Email mismatch. This invitation is for ' || _invitation.email,
      'error_code', 'EMAIL_MISMATCH',
      'invitation_email', _invitation.email, 'user_email', _current_user_email);
  END IF;

  SELECT * INTO _existing_membership
  FROM public.team_members WHERE team_id = _invitation.team_id AND user_id = _current_user_id;

  IF _existing_membership.id IS NOT NULL THEN
    UPDATE public.team_invitations
    SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
    WHERE id = _invitation.id;

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

  INSERT INTO public.team_members (
    team_id, user_id, role, permissions, invitation_accepted_at, added_by, member_metadata
  ) VALUES (
    _invitation.team_id, _current_user_id, _invitation.role,
    COALESCE(_invitation.permissions, '{}'), NOW(), _invitation.invited_by,
    jsonb_build_object('joined_via_invitation', true, 'invitation_id', _invitation.id,
                       'invited_by', _invitation.invited_by, 'invitation_sent_at', _invitation.created_at)
  );

  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = _invitation.id;

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
  RETURN jsonb_build_object('success', false, 'error', 'Failed to accept invitation: ' || SQLERRM,
                            'error_code', 'ACCEPTANCE_FAILED', 'error_detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- H. GET TEAM INVITATIONS (admin listing)
-- ============================================================================

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
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to view team invitations';
  END IF;

  RETURN QUERY
  SELECT
    ti.id, ti.email, ti.role, ti.status, ti.invited_by,
    COALESCE(p.first_name || ' ' || p.last_name, au.email)::TEXT AS inviter_name,
    au.email::VARCHAR(255) AS inviter_email,
    ti.created_at, ti.expires_at, ti.accepted_at, ti.cancelled_at,
    ti.invitation_attempts, ti.last_sent_at, ti.custom_message,
    ti.permissions, ti.metadata
  FROM public.team_invitations ti
  JOIN auth.users au ON ti.invited_by = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE ti.team_id = _team_id
    AND (_status IS NULL OR ti.status = _status)
    AND (_include_expired OR ti.status != 'expired' OR ti.expires_at > NOW() - INTERVAL '7 days')
  ORDER BY ti.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- I. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.remove_team_member_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_member_removal TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_removal TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_removal_candidates TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_invitations TO authenticated;
